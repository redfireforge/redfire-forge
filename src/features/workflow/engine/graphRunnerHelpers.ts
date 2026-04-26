/**
 * Extracted helper functions for the graph runner engine.
 * These were previously inline at the bottom of graphRunner.ts.
 */
import type { WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData, WorkflowErrorConfig } from '../types/workflow';
import type { RequestResult, Scenario } from '../../../shared/types';
import type { VariableContext } from './variableContext';
import type { TokenManager } from '../../../engine/tokenManager';
import type { ResponseData } from './extractVariables';
import type { GraphRunCallbacks } from './graphRunner';
import { httpFetch } from '../../../shared/utils/httpClient';
import { serializeWithContentType } from '../../../shared/utils/bodySerializer';
import { buildHeaders, buildUrl } from '../../../engine/executor';
import { validate, evaluateAssertions } from '../../../engine/validator';
import { resolveScenario } from './resolveScenario';
import { extractVariables } from './extractVariables';
import { ensureAbsoluteUrlWithBase } from './absoluteUrl';
import { v4 as uuidv4 } from 'uuid';
import { stripTrailingSlash } from '../utils/workflowHostResolve';
import { escapeRegExp, toErrorMessage } from '../../../shared/utils/helpers';

// ── Template literal substitution ────────────────────

/**
 * Replace remaining `{{…}}` segments using a flat map.
 * Catches cases where `VariableContext.resolve` still left placeholders.
 */
export function applyTemplateLiteralsFromMap(template: string, flat: Record<string, string>): string {
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

/** Coerce workflow / per-step maps so substitution never sees `undefined`. */
export function coerceStringMap(source: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!source) return out;
  for (const [k, v] of Object.entries(source)) {
    const key = k.trim();
    if (!key || v == null) continue;
    out[key] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

export function applyTemplateLiteralsToScenario(scenario: Scenario, flat: Record<string, string>): Scenario {
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
    },
  };
}

// ── Graph traversal helpers ──────────────────────────

export function findStartNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const triggerNodes = nodes.filter(n => n.type === 'start' || n.type === 'webhook' || n.type === 'schedule');
  if (triggerNodes.length > 0) return triggerNodes;
  const targets = new Set(edges.map(e => e.target));
  return nodes.filter(n => !targets.has(n.id));
}

export function collectReachableFromEdges(
  startEdges: WorkflowEdge[],
  outgoing: Map<string, WorkflowEdge[]>,
  nodeMap: Map<string, WorkflowNode>,
  boundaryNodeIds: string[],
): Set<string> {
  const reachable = new Set<string>();
  const boundary = new Set(boundaryNodeIds);
  const queue = startEdges.map(e => e.target);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id) || boundary.has(id)) continue;
    if (!nodeMap.has(id)) continue;
    reachable.add(id);
    const next = outgoing.get(id) ?? [];
    for (const e of next) {
      queue.push(e.target);
    }
  }
  return reachable;
}

export function markSubtreeSkipped(
  nodeId: string,
  outgoing: Map<string, WorkflowEdge[]>,
  nodeMap: Map<string, WorkflowNode>,
  visited: Set<string>,
  callbacks: GraphRunCallbacks,
  incomingCount?: Map<string, number>,
) {
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
  if (incomingCount) {
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

// ── HTTP node execution ──────────────────────────────

export async function executeHttpNode(
  data: HttpNodeData,
  ctx: VariableContext,
  tokenManager: TokenManager,
  httpNodeId: string,
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
  const statusStr = String(httpStatus);
  ctx.set('httpStatus', statusStr);
  ctx.setForNode(httpNodeId, 'status', statusStr);
  ctx.setForNode(httpNodeId, 'httpStatus', statusStr);
  if (!extracted.status && ctx.get('status') === undefined) {
    ctx.set('status', statusStr);
    extracted = { ...extracted, status: statusStr };
  }
  if (!extracted.httpStatus) extracted = { ...extracted, httpStatus: statusStr };

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

// ── Condition evaluation (shared) ────────────────────

/** Compare two values with the given operator. Used by both Condition and WaitForCondition nodes. */
export function compareValues(left: string, right: string, operator: string): boolean {
  switch (operator) {
    case '==': return left === right;
    case '!=': return left !== right;
    case '>': return parseFloat(left) > parseFloat(right);
    case '<': return parseFloat(left) < parseFloat(right);
    case '>=': return parseFloat(left) >= parseFloat(right);
    case '<=': return parseFloat(left) <= parseFloat(right);
    case 'contains': return left.includes(right);
    case 'not-contains':
    case '!contains': return !left.includes(right);
    case 'regex': try { return new RegExp(right).test(left); } catch { return false; }
    default: return false;
  }
}

export function evaluateCondition(data: ConditionNodeData, ctx: VariableContext): boolean {
  const left = ctx.resolve(data.left);
  const right = ctx.resolve(data.right);
  return compareValues(left, right, data.operator);
}

// ── Error Handler helpers ────────────────────────────

export function classifyErrorType(result: RequestResult): string {
  if (result.httpStatus === 0) return 'network-error';
  if (result.httpStatus >= 400) return 'http-error';
  if (result.failureDetails && result.failureDetails.length > 0) return 'assertion-failure';
  return 'http-error';
}

export function matchesErrorFilter(errorType: string, filter: string): boolean {
  if (filter === 'all') return true;
  return errorType === filter;
}

// ── Wait for Condition helpers ───────────────────────

const WAIT_CONDITION_OPERATORS = ['==', '!=', '>=', '<=', '>', '<', 'contains', '!contains'] as const;

export function evaluateWaitCondition(expression: string, ctx: VariableContext): boolean {
  if (!expression.trim()) return false;
  const resolved = ctx.resolve(expression);

  for (const op of WAIT_CONDITION_OPERATORS) {
    const idx = resolved.indexOf(` ${op} `);
    if (idx === -1) continue;
    const left = resolved.slice(0, idx).trim();
    const right = resolved.slice(idx + op.length + 2).trim();
    return compareValues(left, right, op);
  }

  // Fallback: treat as truthy check
  const val = resolved.trim().toLowerCase();
  return val !== '' && val !== 'false' && val !== '0' && val !== 'null' && val !== 'undefined';
}
