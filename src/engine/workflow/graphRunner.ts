import type { WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData, DelayNodeData, NodeRunStatus } from '../../types/workflow';
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

  async function visit(nodeId: string): Promise<void> {
    if (visited.has(nodeId) || abortSignal?.aborted) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

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
          await visit(edge.target);
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
          markSubtreeSkipped(e.target, outgoing, nodeMap, visited, callbacks);
        }
        for (const e of matchEdges) {
          await visit(e.target);
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
          await visit(edge.target);
        }
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

  const durationMs = Math.round(performance.now() - start);
  callbacks.onComplete(results, allPassed, durationMs);
  return results;
}

// ── Helpers ──────────────────────────────────────────

function findStartNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const targets = new Set(edges.map(e => e.target));
  return nodes.filter(n => !targets.has(n.id));
}

function markSubtreeSkipped(
  nodeId: string,
  outgoing: Map<string, WorkflowEdge[]>,
  nodeMap: Map<string, WorkflowNode>,
  visited: Set<string>,
  callbacks: GraphRunCallbacks,
) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);
  callbacks.onNodeStateChange(nodeId, { state: 'skipped' });
  const nextEdges = outgoing.get(nodeId) ?? [];
  for (const edge of nextEdges) {
    markSubtreeSkipped(edge.target, outgoing, nodeMap, visited, callbacks);
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
