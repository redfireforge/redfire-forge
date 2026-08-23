/**
 * Extracted helper functions for the graph runner engine.
 * These were previously inline at the bottom of graphRunner.ts.
 */
import type { WorkflowNode, WorkflowEdge, HttpNodeData, ConditionNodeData } from '../types/workflow';
import type { RequestResult, Scenario } from '@shared/types';
import type { VariableContext } from './variableContext';
import type { TokenManager } from '@engine/core/tokenManager';
import type { ResponseData } from './extractVariables';
import type { GraphRunCallbacks } from './graphRunner';
import { getByPath } from '@shared/utils/jsonPath';
import { httpFetch } from '@shared/utils/httpClient';
import { serializeWithContentType } from '@shared/utils/bodySerializer';
import { buildHeaders, buildUrl } from '@engine/core/executor';
import { buildValidationResult } from '@engine/core/validationResult';
import { resolveScenario } from './resolveScenario';
import { extractVariables } from './extractVariables';
import { ensureAbsoluteUrlWithBase } from './absoluteUrl';
import { nextResultId, withTimeout } from '@engine/core/requestExecution';
import { stripTrailingSlash } from '../utils/workflowHostResolve';
import { escapeRegExp, toErrorMessage } from '@shared/utils/helpers';

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

/**
 * Pre-compile a single combined regex from all variable names to avoid
 * O(N) regex compilations per string substitution. Returns a resolver
 * function that replaces all `{{varName}}` in one pass.
 */
export function buildCombinedResolver(flat: Record<string, string>): (template: string) => string {
  const entries = Object.entries(flat).filter(([k]) => k.trim());
  if (entries.length === 0) return (t) => t;
  const pattern = entries.map(([k]) => `\\{\\{\\s*${escapeRegExp(k.trim())}\\s*\\}\\}`).join('|');
  const re = new RegExp(pattern, 'g');
  const stripRe = /\{\{\s*|\s*\}\}/g;
  const lookup = new Map(entries.map(([k, v]) => [k.trim(), v]));
  return (template: string): string => {
    if (!template.includes('{{')) return template;
    return template.replace(re, (match) => {
      const key = match.replace(stripRe, '');
      return lookup.get(key) ?? match;
    });
  };
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

export function applyTemplateLiteralsToScenario(scenario: Scenario, flat: Record<string, string>, resolver?: (t: string) => string): Scenario {
  if (Object.keys(flat).length === 0) return scenario;
  const p = resolver ?? ((s: string) => applyTemplateLiteralsFromMap(s, flat));
  return {
    ...scenario,
    url: p(scenario.url),
    body: p(scenario.body),
    headers: scenario.headers.map((h) => ({ key: p(h.key), value: p(h.value) })),
    bodyForm: scenario.bodyForm?.map((h) => ({ key: p(h.key), value: p(h.value) })),
    auth: {
      ...scenario.auth,
      token: scenario.auth?.token != null ? p(scenario.auth.token) : scenario.auth?.token,
      apiKeyValue: scenario.auth?.apiKeyValue != null ? p(scenario.auth.apiKeyValue) : scenario.auth?.apiKeyValue,
      username: scenario.auth?.username != null ? p(scenario.auth.username) : scenario.auth?.username,
      password: scenario.auth?.password != null ? p(scenario.auth.password) : scenario.auth?.password,
    },
  };
}

// ── Graph traversal helpers ──────────────────────────

export function findStartNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const triggerNodes = nodes.filter(n => n.type === 'start' || n.type === 'webhook' || n.type === 'schedule' || n.type === 'kafkaTrigger' || n.type === 'wsTrigger');
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
  timeoutMs?: number,
  abortSignal?: AbortSignal,
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
    validation: data.scenario?.validation ?? { mode: 'none' as const },
    auth: resolveHttpAuth?.(data) ?? data.scenario?.auth ?? { type: 'none' as const },
  };
  const resolved = resolveScenario(resolvedScenario, stepCtx);
  const flatLiterals: Record<string, string> = {
    ...wfVars,
    ...stepCtx.snapshot(),
    ...perStepVars,
  };
  const resolve = buildCombinedResolver(flatLiterals);
  const afterLiterals = applyTemplateLiteralsToScenario(resolved, flatLiterals, resolve);
  const resolvedAbs: Scenario = {
    ...afterLiterals,
    url: ensureAbsoluteUrlWithBase(afterLiterals.url, stepCtx),
  };
  const { body: reqBody, contentType } = serializeWithContentType(resolvedAbs);
  const token = await tokenManager.getToken(resolvedAbs);
  const headers = buildHeaders(resolvedAbs, token, contentType);
  let url = buildUrl(resolvedAbs);
  if (url.includes('{{')) {
    url = resolve(url);
  }


  const start = performance.now();
  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let errorMessage: string | undefined;

  try {
    if (url.includes('{{')) {
      throw new Error(`Unresolved URL template: ${url}`);
    }
    const result = await withTimeout(httpFetch(url, resolvedAbs.method, headers, reqBody, abortSignal), timeoutMs ?? 0);
    if (result.error) {
      errorMessage = result.error;
    } else {
      httpStatus = result.status;
      responseBody = result.body;
      responseHeaders = result.headers;
      const isHttpError = httpStatus >= 400 || httpStatus === 0;
      const needsParse = isHttpError
        || resolvedAbs.validation.mode !== 'none'
        || (resolvedAbs.validation.assertions?.length ?? 0) > 0
        || (resolvedAbs.validation.expectedFields?.length ?? 0) > 0
        || (data.scenario.extractions?.length ?? 0) > 0;
      if (needsParse && responseBody) {
        try { responseObj = JSON.parse(responseBody); } catch { responseObj = responseBody; }
      } else {
        responseObj = responseBody;
      }
    }
  } catch (err) {
    errorMessage = toErrorMessage(err);
  }

  const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;

  const assertions = resolvedAbs.validation.assertions ?? [];
  const { failureDetails, passed, errorMessage: finalErrorMessage } = buildValidationResult({
    httpStatus, responseTimeMs, responseHeaders, responseBody, responseObj,
    errorMessage, validation: resolvedAbs.validation, assertions,
  });

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
    id: nextResultId(),
    scenarioId: data.scenario.id,
    scenarioName: data.scenario.name || data.label,
    featureGroupName: data.scenario.featureGroupName,
    groupName: data.scenario.groupName,
    url,
    method: resolvedAbs.method,
    httpStatus,
    responseTimeMs,
    responseBody: responseBody.slice(0, 2000),
    responseHeaders,
    timestamp: Date.now(),
    passed,
    validationMode: resolvedAbs.validation.mode,
    failureDetails,
    errorMessage: finalErrorMessage,
    requestLog: { headers, body: reqBody },
    dataRowId: data.scenario.dataRowId,
    dataRowLabel: data.scenario.dataRowLabel,
    workflowNodeId: httpNodeId,
    scenarioTags: data.scenario.scenarioTags,
  };

  return { requestResult, extracted, fullResponseBody: responseBody, requestHeaders: headers, requestBody: reqBody ?? '', responseHeaders };
}

// ── Condition evaluation (shared) ────────────────────

/** Compare two values with the given operator. Used by both Condition and WaitForCondition nodes. */
export function compareValues(left: string, right: string, operator: string): boolean {
  switch (operator) {
    case '==':
    case '===': return left === right;
    case '!=':
    case '!==': return left !== right;
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

// ────────────────────────────────────────────────────────
// Shared: extract variables from a JSON payload via JSON path
// ────────────────────────────────────────────────────────

export interface ExtractVariableMapping {
  name: string;
  jsonPath: string;
}

/**
 * Walk a JSON payload using simple dot-separated JSON paths (e.g. "$.user.id")
 * and set each resolved value into the variable context.
 *
 * Returns a map of extracted name→value pairs (for logging/testing).
 */
export function extractPayloadVariables(
  payload: unknown,
  mappings: ExtractVariableMapping[],
  ctx: VariableContext,
): Record<string, string> {
  const extracted: Record<string, string> = {};
  for (const { name, jsonPath } of mappings) {
    const value = getByPath(payload, jsonPath);
    if (value !== undefined) {
      const strVal = typeof value === 'string' ? value : JSON.stringify(value);
      ctx.set(name, strVal);
      extracted[name] = strVal;
    }
  }
  return extracted;
}

// ────────────────────────────────────────────────────────
// Shared: Log HTTP request/response details
// ────────────────────────────────────────────────────────

type LogFn = (line: { prefix: string; text: string }) => void;

export function logHttpResult(
  label: string,
  log: LogFn,
  result: {
    requestResult: RequestResult;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    fullResponseBody?: string;
    responseHeaders: Record<string, string>;
    extracted?: Record<string, string>;
  },
): void {
  const rr = result.requestResult;

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

  if (rr.failureDetails && rr.failureDetails.length > 0 && !rr.passed) {
    for (const f of rr.failureDetails) {
      log({ prefix: '!', text: `[${label}] assertion ${f.path}: expected ${f.expected}, got ${f.actual}` });
    }
  }
  if (result.extracted && Object.keys(result.extracted).length > 0) {
    for (const [k, v] of Object.entries(result.extracted)) {
      const display = v.length > 80 ? v.slice(0, 80) + '…' : v;
      log({ prefix: '#', text: `[${label}] ${k} = ${display}` });
    }
  }
}
