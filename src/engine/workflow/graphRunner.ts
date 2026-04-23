import type { WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData, DelayNodeData, StartNodeData, ForkNodeData, JoinNodeData, NodeRunStatus } from '../../types/workflow';
import { isHttpWorkflowNode } from '../../utils/workflowVariableHints';
import type { RequestResult, Scenario } from '../../types';
import { httpFetch } from '../../utils/httpClient';
import { serializeWithContentType } from '../../utils/bodySerializer';
import { buildHeaders, buildUrl } from '../executor';
import { validate, evaluateAssertions } from '../validator';
import { TokenManager } from '../tokenManager';
import { VariableContext } from './variableContext';
import { resolveScenario } from './resolveScenario';
import { extractVariables, type ResponseData } from './extractVariables';
import { formatHttpNodeRunDetail, summarizeRequestFailure } from '../../utils/workflowRunErrors';
import { ensureAbsoluteUrlWithBase } from './absoluteUrl';
import { v4 as uuidv4 } from 'uuid';
import { stripTrailingSlash } from '../../utils/workflowHostResolve';
import { escapeRegExp, toErrorMessage } from '../../utils/helpers';
import type { DebugController } from './debugController';

/**
 * Replace remaining `{{…}}` segments using a flat map (workflow + step snapshot + initialVariables).
 * Catches cases where `VariableContext.resolve` still left placeholders (merge / ordering quirks).
 */
function applyTemplateLiteralsFromMap(template: string, flat: Record<string, string>): string {
  if (!template.includes('{{')) return template;
  let out = template;
  for (const [k, val] of Object.entries(flat)) {
    const key = k.trim();
    if (!key) continue;
    const re = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    out = out.replace(re, () => val);
  }
  return out;
}

/** Coerce workflow / per-step maps so substitution never sees `undefined` (would leave `{{name}}` literal). */
function coerceStringMap(source: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!source) return out;
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || v == null) continue;
    out[key] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

function applyTemplateLiteralsToScenario(scenario: Scenario, flat: Record<string, string>): Scenario {
  if (Object.keys(flat).length === 0) return scenario;
  const p = (s: string) => applyTemplateLiteralsFromMap(s, flat);
  return {
    ...scenario,
    url: p(scenario.url),
    body: p(scenario.body),
    headers: scenario.headers.map((h) => ({ key: p(h.key), value: p(h.value) })),
    bodyForm: scenario.bodyForm?.map((h) => ({ key: p(h.key), value: p(h.value) })),
    auth: {
      ...scenario.auth,
      token: scenario.auth.token != null ? p(scenario.auth.token) : scenario.auth.token,
      apiKeyValue: scenario.auth.apiKeyValue != null ? p(scenario.auth.apiKeyValue) : scenario.auth.apiKeyValue,
      username: scenario.auth.username != null ? p(scenario.auth.username) : scenario.auth.username,
      password: scenario.auth.password != null ? p(scenario.auth.password) : scenario.auth.password,
      clientId: scenario.auth.clientId != null ? p(scenario.auth.clientId) : scenario.auth.clientId,
      clientSecret: scenario.auth.clientSecret != null ? p(scenario.auth.clientSecret) : scenario.auth.clientSecret,
    },
  };
}

export interface GraphRunCallbacks {
  onNodeStateChange: (nodeId: string, status: NodeRunStatus) => void;
  onVariablesChange: (variables: Record<string, string>) => void;
  onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => void;
}

/**
 * Execute a workflow graph with topological traversal.
 * Handles HTTP nodes, Condition branching (multiple edges per Yes/No), and Delay nodes.
 * Calls back for canvas animation and variable updates.
 */
export async function runGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  initialVariables: Record<string, string>,
  callbacks: GraphRunCallbacks,
  abortSignal?: AbortSignal,
  /** Low-priority layer (e.g. Harness env base URL as `baseUrl`). Manual initial vars override these. */
  environmentLayer?: Record<string, string>,
  /** Per-HTTP-node base URL when the node sets host env + microservice; falls back to harness when omitted. */
  resolveHttpBaseUrl?: (data: HttpNodeData) => string | undefined,
  /** Optional per-HTTP-node auth profile resolver (workflow-local profile bindings). */
  resolveHttpAuth?: (data: HttpNodeData) => Scenario['auth'] | undefined,
  /** Optional debug controller for step-through execution. */
  debugController?: DebugController,
): Promise<RequestResult[]> {
  const start = performance.now();
  const ctx = new VariableContext(initialVariables, environmentLayer);
  ctx.registerWorkflowNodes(nodes);
  const tokenManager = new TokenManager();
  const results: RequestResult[] = [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.source) ?? [];
    list.push(e);
    outgoing.set(e.source, list);
  }

  const startNodes = findStartNodes(nodes, edges);
  if (startNodes.length === 0) {
    callbacks.onComplete([], true, 0);
    return [];
  }

  for (const node of nodes) {
    callbacks.onNodeStateChange(node.id, { state: 'pending' });
  }

  let allPassed = true;
  const visited = new Set<string>();

  // Join-node barrier: track how many incoming edges have arrived.
  const incomingCount = new Map<string, number>();
  const joinArrived = new Map<string, number>();
  for (const e of edges) {
    incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
  }

  async function visit(nodeId: string, threadId = 'main'): Promise<void> {
    if (abortSignal?.aborted || debugController?.isStopped) return;

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // Join barrier: wait until all incoming branches have arrived.
    if (node.type === 'join') {
      const arrived = (joinArrived.get(nodeId) ?? 0) + 1;
      joinArrived.set(nodeId, arrived);
      const expected = incomingCount.get(nodeId) ?? 1;
      if (arrived < expected) {
        // Show waiting state on join node (both debug and normal mode)
        callbacks.onNodeStateChange(nodeId, {
          state: 'running',
          responseDetail: `waiting (${arrived}/${expected})`,
        });
        if (debugController) {
          debugController.markWaitingJoin(nodeId, threadId);
        }
        return; // not all branches arrived yet
      }
      // All branches arrived — fall through to execute once
    }

    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Debug: pause before executing this node
    if (debugController) {
      callbacks.onNodeStateChange(nodeId, { state: 'paused' });
      await debugController.waitForStep(nodeId, threadId);
      if (debugController.isStopped || abortSignal?.aborted) return;
      debugController.markRunning(nodeId, threadId);
    }

    callbacks.onNodeStateChange(nodeId, { state: 'running' });

    try {
      if (isHttpWorkflowNode(node)) {
        const result = await executeHttpNode(
          node.data as HttpNodeData,
          ctx,
          tokenManager,
          nodeId,
          initialVariables,
          resolveHttpBaseUrl,
          resolveHttpAuth,
        );
        results.push(result.requestResult);

        const status: NodeRunStatus = {
          state: result.requestResult.passed ? 'pass' : 'fail',
          statusCode: result.requestResult.httpStatus,
          responseTimeMs: result.requestResult.responseTimeMs,
          extracted: result.extracted,
          error: result.requestResult.passed ? undefined : summarizeRequestFailure(result.requestResult),
          responseDetail: formatHttpNodeRunDetail(result.requestResult, { fullResponseBody: result.fullResponseBody }),
        };
        if (!result.requestResult.passed) allPassed = false;
        callbacks.onNodeStateChange(nodeId, status);
        callbacks.onVariablesChange(ctx.snapshot());

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }

      } else if (node.type === 'condition') {
        const data = node.data as ConditionNodeData;
        const condResult = evaluateCondition(data, ctx);
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        const matchesTakenBranch = (e: WorkflowEdge) =>
          condResult ? (e.sourceHandle === 'true' || e.label === 'Yes') : (e.sourceHandle === 'false' || e.label === 'No');
        const matchesSkippedBranch = (e: WorkflowEdge) =>
          condResult ? (e.sourceHandle === 'false' || e.label === 'No') : (e.sourceHandle === 'true' || e.label === 'Yes');

        const matchEdges = nextEdges.filter(matchesTakenBranch);
        const skipEdges = nextEdges.filter(matchesSkippedBranch);

        for (const e of skipEdges) {
          markSubtreeSkipped(e.target, outgoing, nodeMap, visited, callbacks, incomingCount);
        }
        // Run matched branches in parallel (like fork) when multiple edges share the same handle
        if (matchEdges.length > 1) {
          await Promise.all(matchEdges.map((e, i) =>
            visit(e.target, `${threadId}-cond-${i}`)
          ));
        } else {
          for (const e of matchEdges) {
            await visit(e.target, threadId);
          }
        }

      } else if (node.type === 'delay') {
        const data = node.data as DelayNodeData;
        const ms = data.mode === 'random'
          ? (data.minMs ?? 0) + Math.random() * ((data.maxMs ?? data.delayMs) - (data.minMs ?? 0))
          : data.delayMs;

        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, ms);
          if (abortSignal) {
            const onAbort = () => { clearTimeout(timer); resolve(); };
            abortSignal.addEventListener('abort', onAbort, { once: true });
          }
        });

        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }

      } else if (node.type === 'start') {
        // Seed variables from the Start node's inputVariables into the context.
        const data = node.data as StartNodeData;
        if (data.inputVariables) {
          for (const [k, v] of Object.entries(data.inputVariables)) {
            ctx.set(k, v);
          }
          callbacks.onVariablesChange(ctx.snapshot());
        }
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }

      } else if (node.type === 'fork') {
        // Fork node: execute all outgoing branches in parallel.
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        await Promise.all(nextEdges.map((edge, i) =>
          visit(edge.target, `${threadId}-branch-${i}`)
        ));
      } else if (node.type === 'join') {
        // Join node: barrier already handled above — just pass through.
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }
      } else if (node.type === 'end') {
        // End node: terminal — mark pass (no outgoing edges).
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });
      }
    } catch (err) {
      allPassed = false;
      callbacks.onNodeStateChange(nodeId, {
        state: 'fail',
        error: toErrorMessage(err),
      });
    }
  }

  for (const startNode of startNodes) {
    if (abortSignal?.aborted) break;
    await visit(startNode.id);
  }

  // If any node failed, implicitly mark unvisited End nodes as failed.
  // If all passed, mark unvisited End nodes as pass (in case they weren't reached via edges).
  const endNodes = nodes.filter(n => n.type === 'end');
  for (const endNode of endNodes) {
    if (!visited.has(endNode.id)) {
      if (!allPassed) {
        // Collect error messages from failed nodes
        const failedErrors: string[] = [];
        for (const [nid, result] of results.entries()) {
          if (result.error) failedErrors.push(result.error);
        }
        const errorSummary = failedErrors.length > 0
          ? failedErrors.join('; ')
          : 'One or more steps failed';
        callbacks.onNodeStateChange(endNode.id, {
          state: 'fail',
          error: errorSummary,
          responseDetail: errorSummary,
        });
      } else {
        callbacks.onNodeStateChange(endNode.id, { state: 'pass' });
      }
    }
  }

  const durationMs = Math.round(performance.now() - start);
  callbacks.onComplete(results, allPassed, durationMs);
  return results;
}

// ── Helpers ──────────────────────────────────────────

function findStartNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  // Prefer explicit start-type nodes; fall back to nodes with no incoming edges.
  const startTypeNodes = nodes.filter(n => n.type === 'start');
  if (startTypeNodes.length > 0) return startTypeNodes;
  const targets = new Set(edges.map(e => e.target));
  return nodes.filter(n => !targets.has(n.id));
}

function markSubtreeSkipped(
  nodeId: string,
  outgoing: Map<string, WorkflowEdge[]>,
  nodeMap: Map<string, WorkflowNode>,
  visited: Set<string>,
  callbacks: GraphRunCallbacks,
  incomingCount?: Map<string, number>,
) {
  // If this is a join node, don't skip it — just decrement its expected arrival count
  // so the barrier knows fewer branches will arrive.
  const node = nodeMap.get(nodeId);
  if (node?.type === 'join') {
    if (incomingCount) {
      const current = incomingCount.get(nodeId) ?? 1;
      if (current > 1) {
        incomingCount.set(nodeId, current - 1);
      }
    }
    return;
  }
  if (visited.has(nodeId)) return;
  visited.add(nodeId);
  callbacks.onNodeStateChange(nodeId, { state: 'skipped' });
  const nextEdges = outgoing.get(nodeId) ?? [];
  for (const edge of nextEdges) {
    markSubtreeSkipped(edge.target, outgoing, nodeMap, visited, callbacks, incomingCount);
  }
}

async function executeHttpNode(
  data: HttpNodeData,
  ctx: VariableContext,
  tokenManager: TokenManager,
  httpNodeId: string,
  /** Workflow-level defaults from `runGraph` (fallback if snapshot / per-step maps miss a key). */
  workflowDefaults: Record<string, string>,
  resolveHttpBaseUrl?: (data: HttpNodeData) => string | undefined,
  resolveHttpAuth?: (data: HttpNodeData) => Scenario['auth'] | undefined,
): Promise<{ requestResult: RequestResult; extracted: Record<string, string>; fullResponseBody: string }> {
  const wfVars = coerceStringMap(workflowDefaults);
  const perStepVars = coerceStringMap(data.initialVariables);

  const stepBase = resolveHttpBaseUrl?.(data);
  const stepCtx = ctx.child();
  if (stepBase?.trim()) {
    stepCtx.set('baseUrl', stripTrailingSlash(stepBase));
  }
  for (const [name, v] of Object.entries(perStepVars)) {
    const resolved = ctx.resolve(v);
    stepCtx.set(name, resolved);
    ctx.setForNode(httpNodeId, name, resolved);
  }
  const resolvedScenario: Scenario = {
    ...data.scenario,
    auth: resolveHttpAuth?.(data) ?? data.scenario.auth,
  };
  const resolved = resolveScenario(resolvedScenario, stepCtx);
  /** Per-step vars must win over snapshot keys (e.g. same name from upstream). */
  const flatLiterals: Record<string, string> = {
    ...wfVars,
    ...stepCtx.snapshot(),
    ...perStepVars,
  };
  const afterLiterals = applyTemplateLiteralsToScenario(resolved, flatLiterals);
  const resolvedAbs: Scenario = {
    ...afterLiterals,
    url: ensureAbsoluteUrlWithBase(afterLiterals.url, stepCtx),
  };
  const { body: reqBody, contentType } = serializeWithContentType(resolvedAbs);
  const token = await tokenManager.getToken(resolvedAbs);
  const headers = buildHeaders(resolvedAbs, token, contentType);
  let url = buildUrl(resolvedAbs);
  // buildUrl (e.g. apikey in query) rewrites the URL; ensure no `{{…}}` survives in the final href.
  if (url.includes('{{')) {
    url = applyTemplateLiteralsFromMap(url, flatLiterals);
  }

  const start = performance.now();
  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let errorMessage: string | undefined;

  try {
    const result = await httpFetch(url, resolvedAbs.method, headers, reqBody);
    if (result.error) {
      errorMessage = result.error;
    } else {
      httpStatus = result.status;
      responseBody = result.body;
      responseHeaders = result.headers;
      try { responseObj = JSON.parse(responseBody); } catch { responseObj = responseBody; }
    }
  } catch (err) {
    errorMessage = toErrorMessage(err);
  }

  const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;

  const assertions = resolvedAbs.validation.assertions ?? [];
  const { failures: assertionFailures, statusAsserted } = assertions.length > 0
    ? evaluateAssertions(assertions, { httpStatus, responseTimeMs, responseHeaders, responseBody: responseObj })
    : { failures: [], statusAsserted: false };

  const httpOk = httpStatus > 0 && httpStatus < 400;
  const statusOk = statusAsserted ? assertionFailures.every(f => f.path !== '(status)') : httpOk;
  const jsonFailures = resolvedAbs.validation.mode !== 'none' && statusOk ? validate(resolvedAbs.validation, responseObj) : [];
  let failureDetails = [...assertionFailures, ...jsonFailures];

  const httpFailed = !statusAsserted && (httpStatus >= 400 || httpStatus === 0);
  if (httpFailed && errorMessage) {
    failureDetails = [{ path: '(http)', expected: '2xx', actual: errorMessage }, ...assertionFailures];
  }

  const networkError = httpStatus === 0 && !statusAsserted;
  const passed = !networkError && failureDetails.length === 0;

  let extracted: Record<string, string> = {};
  if (data.scenario.extractions?.length) {
    const responseData: ResponseData = { status: httpStatus, headers: responseHeaders, body: responseObj };
    extracted = extractVariables(data.scenario.extractions, responseData, ctx, httpNodeId);
  }
  // If nothing defined `status`, bind it to the numeric HTTP status so `{{status}}` works in conditions.
  if (ctx.get('status') === undefined) {
    ctx.set('status', String(httpStatus));
    ctx.setForNode(httpNodeId, 'status', String(httpStatus));
    extracted = { ...extracted, status: String(httpStatus) };
  }

  const requestResult: RequestResult = {
    id: uuidv4(),
    scenarioId: data.scenario.id,
    scenarioName: data.scenario.name || data.label,
    featureGroupName: data.scenario.featureGroupName,
    groupName: data.scenario.groupName,
    url,
    method: resolvedAbs.method,
    httpStatus,
    responseTimeMs,
    responseBody: responseBody.slice(0, 2000),
    timestamp: Date.now(),
    passed,
    validationMode: resolvedAbs.validation.mode,
    failureDetails,
    errorMessage,
  };

  return { requestResult, extracted, fullResponseBody: responseBody };
}

function evaluateCondition(data: ConditionNodeData, ctx: VariableContext): boolean {
  const left = ctx.resolve(data.left);
  const right = ctx.resolve(data.right);

  switch (data.operator) {
    case '==': return left === right;
    case '!=': return left !== right;
    case '>': return parseFloat(left) > parseFloat(right);
    case '<': return parseFloat(left) < parseFloat(right);
    case '>=': return parseFloat(left) >= parseFloat(right);
    case '<=': return parseFloat(left) <= parseFloat(right);
    case 'contains': return left.includes(right);
    case 'not-contains': return !left.includes(right);
    case 'regex': try { return new RegExp(right).test(left); } catch { return false; }
    default: return false;
  }
}
