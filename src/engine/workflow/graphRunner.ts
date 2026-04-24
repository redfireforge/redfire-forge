import type { WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData, DelayNodeData, StartNodeData, ForkNodeData, JoinNodeData, WebhookTriggerNodeData, ScheduleTriggerNodeData, NodeRunStatus } from '../../types/workflow';
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
  onLog?: (line: { prefix: '' | '*' | '>' | '<' | '#' | '!'; text: string; ts?: number }) => void;
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

  const log = (line: { prefix: '' | '*' | '>' | '<' | '#' | '!'; text: string }) => {
    callbacks.onLog?.({ ...line, ts: Date.now() });
  };
  const nodeLabel = (id: string) => {
    const n = nodes.find(nd => nd.id === id);
    return (n?.data as { label?: string })?.label || n?.type || id;
  };

  log({ prefix: '*', text: `Workflow run started — ${nodes.length} nodes` });

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
        const httpData = node.data as HttpNodeData;
        log({ prefix: '>', text: `[${nodeLabel(nodeId)}] ${httpData.scenario?.method ?? 'GET'} request...` });
        const result = await executeHttpNode(
          httpData,
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
        const rr = result.requestResult;
        const label = nodeLabel(nodeId);

        // ── Request details ──
        log({ prefix: '>', text: `[${label}] ${rr.method} ${rr.url}` });
        const reqHdrEntries = Object.entries(result.requestHeaders);
        if (reqHdrEntries.length > 0) {
          for (const [k, v] of reqHdrEntries) {
            const display = /auth|token|key|secret|cookie/i.test(k) ? v.slice(0, 8) + '••••' : v;
            log({ prefix: '>', text: `[${label}]   ${k}: ${display}` });
          }
        }
        if (result.requestBody) {
          const bodyPreview = result.requestBody.length > 200 ? result.requestBody.slice(0, 200) + '…' : result.requestBody;
          log({ prefix: '>', text: `[${label}]   Body: ${bodyPreview}` });
        }

        // ── Response details ──
        const bodyLen = result.fullResponseBody?.length ?? 0;
        const bodySize = bodyLen < 1024 ? `${bodyLen}B` : `${(bodyLen / 1024).toFixed(1)}KB`;
        log({ prefix: '<', text: `[${label}] ${rr.httpStatus} — ${rr.responseTimeMs.toFixed(0)}ms — ${bodySize}` });
        const resHdrEntries = Object.entries(result.responseHeaders);
        if (resHdrEntries.length > 0) {
          for (const [k, v] of resHdrEntries) {
            log({ prefix: '<', text: `[${label}]   ${k}: ${v}` });
          }
        }
        if (result.fullResponseBody) {
          const respPreview = result.fullResponseBody.length > 300 ? result.fullResponseBody.slice(0, 300) + '…' : result.fullResponseBody;
          log({ prefix: '<', text: `[${label}]   Body: ${respPreview}` });
        }

        // ── Assertions ──
        if (rr.failureDetails && rr.failureDetails.length > 0 && !rr.passed) {
          for (const f of rr.failureDetails) {
            log({ prefix: '!', text: `[${label}] assertion ${f.path}: expected ${f.expected}, got ${f.actual}` });
          }
        }
        // ── Extracted variables ──
        if (result.extracted && Object.keys(result.extracted).length > 0) {
          for (const [k, v] of Object.entries(result.extracted)) {
            const display = v.length > 80 ? v.slice(0, 80) + '…' : v;
            log({ prefix: '#', text: `[${label}] ${k} = ${display}` });
          }
        }
        if (!rr.passed && !rr.failureDetails?.length) {
          log({ prefix: '!', text: `[${label}] FAIL — ${status.error ?? 'request failed'}` });
        }
        callbacks.onNodeStateChange(nodeId, status);
        callbacks.onVariablesChange(ctx.snapshot());

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }

      } else if (node.type === 'condition') {
        const data = node.data as ConditionNodeData;
        const resolvedLeft = ctx.resolve(data.left);
        const resolvedRight = ctx.resolve(data.right);
        const condResult = evaluateCondition(data, ctx);
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] ${resolvedLeft} ${data.operator} ${resolvedRight} → ${condResult ? 'Yes' : 'No'}` });
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

        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Delay ${Math.round(ms)}ms...` });
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
        const varCount = Object.keys(data.inputVariables ?? {}).length;
        log({ prefix: '*', text: `[Start] Initialised${varCount > 0 ? ` with ${varCount} variable(s)` : ''}` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }

      } else if (node.type === 'webhook') {
        // Webhook trigger: seed variables from simulated/actual webhook payload.
        // In simulate mode, variables come from workflow-level defaults or manual config.
        // Phase 5 will handle actual webhook server integration.
        const data = node.data as WebhookTriggerNodeData;
        // Extract variables from sample payload if configured
        if (data.extractVariables && data.extractVariables.length > 0) {
          try {
            const payload = JSON.parse(data.samplePayload || '{}');
            for (const { name, jsonPath } of data.extractVariables) {
              // Simple JSONPath extraction (e.g., $.event, $.data.id)
              const keys = jsonPath.replace(/^\$\./, '').split('.');
              let value: unknown = payload;
              for (const key of keys) {
                value = (value as Record<string, unknown>)?.[key];
                if (value === undefined) break;
              }
              if (value !== undefined) {
                ctx.set(name, String(value));
              }
            }
          } catch {
            // Invalid JSON in samplePayload - skip extraction
          }
        }
        callbacks.onVariablesChange(ctx.snapshot());
        log({ prefix: '*', text: `[Webhook Trigger] Seeded variables from sample payload` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }

      } else if (node.type === 'schedule') {
        // Schedule trigger: seed variables with trigger time and any configured inputs.
        const data = node.data as ScheduleTriggerNodeData;
        // Add schedule-specific variables (matches cron-scheduler.ts behavior)
        const now = new Date();
        ctx.set('triggerTime', now.toISOString());
        ctx.set('triggerTimestamp', String(Math.floor(now.getTime() / 1000)));
        ctx.set('triggerDate', now.toISOString().split('T')[0]);
        ctx.set('triggerHour', String(now.getHours()));
        ctx.set('triggerMinute', String(now.getMinutes()));
        // Seed any configured input variables
        if (data.inputVariables) {
          for (const [k, v] of Object.entries(data.inputVariables)) {
            ctx.set(k, v);
          }
        }
        callbacks.onVariablesChange(ctx.snapshot());
        log({ prefix: '*', text: `[Schedule Trigger] Seeded trigger time variables` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        const nextEdges = outgoing.get(nodeId) ?? [];
        for (const edge of nextEdges) {
          await visit(edge.target, threadId);
        }

      } else if (node.type === 'fork') {
        // Fork node: execute all outgoing branches in parallel.
        const nextEdges = outgoing.get(nodeId) ?? [];
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] Forking into ${nextEdges.length} branches` });
        callbacks.onNodeStateChange(nodeId, { state: 'pass' });

        await Promise.all(nextEdges.map((edge, i) =>
          visit(edge.target, `${threadId}-branch-${i}`)
        ));
      } else if (node.type === 'join') {
        // Join node: barrier already handled above — just pass through.
        log({ prefix: '*', text: `[${nodeLabel(nodeId)}] All branches joined` });
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
      log({ prefix: '!', text: `[${nodeLabel(nodeId)}] Error — ${toErrorMessage(err)}` });
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
  log({ prefix: '*', text: `Workflow ${allPassed ? 'PASS' : 'FAIL'} — ${results.length} step(s), ${durationMs}ms` });
  callbacks.onComplete(results, allPassed, durationMs);
  return results;
}

// ── Helpers ──────────────────────────────────────────

function findStartNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  // Prefer explicit trigger nodes (start, webhook, schedule); fall back to nodes with no incoming edges.
  const triggerNodes = nodes.filter(n => n.type === 'start' || n.type === 'webhook' || n.type === 'schedule');
  if (triggerNodes.length > 0) return triggerNodes;
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
  // End nodes with multiple incoming edges (convergence point after condition branches):
  // don't skip — let the other branch visit it normally.
  if (node?.type === 'end' && incomingCount) {
    const current = incomingCount.get(nodeId) ?? 1;
    if (current > 1) {
      incomingCount.set(nodeId, current - 1);
      return;
    }
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
): Promise<{ requestResult: RequestResult; extracted: Record<string, string>; fullResponseBody: string; requestHeaders: Record<string, string>; requestBody: string; responseHeaders: Record<string, string> }> {
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

  return { requestResult, extracted, fullResponseBody: responseBody, requestHeaders: headers, requestBody: reqBody ?? '', responseHeaders };
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
