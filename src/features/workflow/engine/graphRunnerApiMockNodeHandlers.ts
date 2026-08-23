/**
 * Phase 11 — graphRunner handlers for API Mock lifecycle + assert nodes.
 */
import type { WorkflowNode } from '../types/workflow';
import { apiMockControlBase } from '@shared/api-mock/controlBase';
import type {
  ApiMockApplyNodeData,
  ApiMockAssertCallsNodeData,
  ApiMockResetStateNodeData,
  ApiMockStartNodeData,
  ApiMockStopNodeData,
  ApiMockWorkflowOnError,
} from '../types/workflow/node-api-mock';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import {
  handleApiMockApply,
  handleApiMockAssertCalls,
  handleApiMockResetState,
  handleApiMockStart,
  handleApiMockStop,
  type ApiMockNodeResult,
} from './apiMockNodeHandlers';
import { isolateApiMockServerId, resolveApiMockDefinition } from '../utils/apiMockWorkflowDefinitionResolver';
import { listApiMockServersForRun, registerApiMockServerForRun } from '../utils/apiMockRunIsolation';
import { buildCombinedResolver } from './graphRunnerHelpers';
import { nextResultId } from '../../../engine/requestExecution';
import type { RequestResult } from '@shared/types';
import { toErrorMessage } from '@shared/utils/helpers';
import { httpFetch } from '@shared/utils/httpClient';
import { isTauri } from '@shared/utils/platform';

type ApiMockTransport =
  | 'apiMockStart'
  | 'apiMockApply'
  | 'apiMockResetState'
  | 'apiMockStop'
  | 'apiMockAssertCalls';

function controlBaseUrl(): string {
  // Browser: '' → same-origin `/api/mock` (Vite proxies to localhost:3001).
  // Do not prefix window.location.origin (:5173) or 127.0.0.1 — the companion
  // is reached via the /api proxy, and 127.0.0.1:3001 is ECONNREFUSED when
  // the process is bound to localhost only.
  return apiMockControlBase();
}

function controlUrl(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const base = controlBaseUrl();
  return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

/**
 * Web: native fetch, same as Studio's control client (forwards POST body).
 * Desktop: httpFetch → Tauri HTTP (webview fetch cannot reach the companion).
 */
export async function fetchApiMockControl(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
  if (typeof raw !== 'string' || raw === 'true' || raw === 'false') {
    throw new TypeError(`Invalid control URL: ${String(raw)}`);
  }
  const url = controlUrl(raw);
  if (!isTauri()) {
    return fetch(url, init);
  }
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => { headers[key] = value; });
  }
  const body = typeof init?.body === 'string' ? init.body : undefined;
  const result = await httpFetch(url, method, headers, body);
  if (result.error) throw new Error(result.error);
  return new Response(result.body, {
    status: result.status || 200,
    statusText: result.statusText,
    headers: result.headers,
  });
}

function buildResult(
  nodeId: string,
  label: string,
  transport: ApiMockTransport,
  durationMs: number,
  passed: boolean,
  detail: string,
  result: ApiMockNodeResult,
  errorMessage?: string,
): RequestResult {
  return {
    id: nextResultId(),
    scenarioId: nodeId,
    scenarioName: label,
    url: `apimock://${transport}/${detail}`,
    method: transport,
    httpStatus: passed ? 200 : 0,
    responseTimeMs: durationMs,
    responseBody: '',
    timestamp: Date.now(),
    passed,
    validationMode: 'none',
    failureDetails: errorMessage
      ? [{ path: '(node)', expected: 'pass', actual: errorMessage }]
      : [],
    workflowNodeId: nodeId,
    transportType: transport,
    errorMessage,
    apiMockResultMeta: {
      serverId: result.serverId,
      port: result.port,
      generation: result.generation,
      transactionIds: result.assertionDetails?.transactionIds,
      nearMisses: result.assertionDetails?.nearMisses,
      expected: result.assertionDetails?.expected,
      actual: result.assertionDetails?.actual,
    },
  };
}

function captureDetails(
  hCtx: NodeHandlerContext,
  nodeId: string,
  transport: ApiMockTransport,
  durationMs: number,
  result: ApiMockNodeResult,
): void {
  hCtx.capturedApiMockDetails?.set(nodeId, {
    transport,
    serverId: result.serverId,
    port: result.port,
    generation: result.generation,
    durationMs,
    transactionIds: result.assertionDetails?.transactionIds,
    nearMisses: result.assertionDetails?.nearMisses,
    expected: result.assertionDetails?.expected,
    actual: result.assertionDetails?.actual,
  });
}

async function finish(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
  onError: ApiMockWorkflowOnError,
  transport: ApiMockTransport,
  durationMs: number,
  result: ApiMockNodeResult,
  detail: string,
): Promise<void> {
  captureDetails(hCtx, nodeId, transport, durationMs, result);
  if (result.success) {
    hCtx.results.push(buildResult(nodeId, label, transport, durationMs, true, detail, result));
    hCtx.log({ prefix: '✓', text: `[${label}] ${transport} ok — ${detail} (${durationMs}ms)` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass', responseTimeMs: durationMs });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  const msg = result.error
    ?? (result.assertionDetails
      ? `${result.assertionDetails.expected}; got ${result.assertionDetails.actual}`
      : 'API Mock node failed');
  passed.value = false;
  hCtx.results.push(buildResult(nodeId, label, transport, durationMs, false, detail, result, msg));
  if (result.assertionDetails?.nearMisses?.length) {
    for (const nm of result.assertionDetails.nearMisses.slice(0, 5)) {
      hCtx.log({ prefix: '!', text: `[${label}]   near-miss: ${nm}` });
    }
  }
  hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg, responseTimeMs: durationMs });
  if (onError === 'continue') {
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  }
}

function setVar(hCtx: NodeHandlerContext, key: string | undefined, value: string): void {
  if (!key?.trim()) return;
  hCtx.ctx.set(key.trim(), value);
}

function resolveStr(hCtx: NodeHandlerContext, value: string | undefined): string {
  if (!value) return '';
  if (!value.includes('{{')) return value;
  return buildCombinedResolver(hCtx.ctx.snapshot())(value);
}

function runIdFor(hCtx: NodeHandlerContext): string {
  return hCtx.executionId ?? hCtx.workflowId ?? 'workflow';
}

/**
 * Map a downstream node's target server id onto the server actually running for
 * this run. When the Start node isolates the run it launches `<id>__run_<runId>`
 * and registers that isolated id; a downstream Apply/Reset/Stop/Assert that still
 * references the base workspace id (a picked studio server, or a `{{var}}` that
 * resolved to it) would otherwise hit a server that was never started. If the
 * base id is not in the run registry but its isolated variant is, retarget to the
 * isolated id. Leaves ids untouched when nothing was isolated for this run, so
 * non-isolated runs and explicit isolated ids behave exactly as before.
 */
function resolveRunServerId(hCtx: NodeHandlerContext, serverId: string): string {
  if (!serverId) return serverId;
  const started = listApiMockServersForRun(runIdFor(hCtx));
  if (started.length === 0 || started.includes(serverId)) return serverId;
  const isolated = isolateApiMockServerId(serverId, runIdFor(hCtx));
  return started.includes(isolated) ? isolated : serverId;
}

function makeCtx(
  hCtx: NodeHandlerContext,
  definition?: import('../../../shared/api-mock/contracts').ApiMockServerDefinitionV1,
  register = false,
) {
  const runId = hCtx.executionId ?? hCtx.workflowId ?? 'workflow';
  return {
    controlBaseUrl: controlBaseUrl(),
    fetch: fetchApiMockControl,
    definition,
    runId,
    registerStarted: register
      ? (serverId: string) => registerApiMockServerForRun(runId, serverId)
      : undefined,
  };
}

export async function handleApiMockStartNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const raw = node.data as ApiMockStartNodeData;
  const data: ApiMockStartNodeData = { ...raw, serverId: resolveStr(hCtx, raw.serverId) };
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const t0 = performance.now();
  hCtx.log({ prefix: '→', text: `[${label}] START mock ${data.serverId || '(missing)'}` });

  try {
    const runId = hCtx.executionId ?? hCtx.workflowId ?? 'workflow';
    const resolved = await resolveApiMockDefinition({
      serverId: data.serverId,
      portOverride: data.portOverride,
      isolateRun: data.isolateRun !== false,
      runId,
    });
    if (!resolved.ok) {
      await finish(nodeId, label, hCtx, passed, onError, 'apiMockStart', Math.round(performance.now() - t0), {
        success: false,
        error: resolved.error,
      }, data.serverId || 'unknown');
      return;
    }

    const result = await handleApiMockStart(
      data,
      makeCtx(hCtx, resolved.definition, data.isolateRun !== false),
    );
    const durationMs = Math.round(performance.now() - t0);
    if (result.success) {
      setVar(hCtx, data.saveServerIdAs || 'mockServerId', result.serverId ?? resolved.definition.id);
      setVar(hCtx, data.savePortAs || 'mockPort', String(result.port ?? resolved.definition.port));
      setVar(hCtx, data.saveBaseUrlAs || 'mockBaseUrl', `http://127.0.0.1:${result.port ?? resolved.definition.port}`);
      setVar(hCtx, data.saveGenerationAs || 'mockGeneration', String(result.generation ?? 1));
    }
    await finish(
      nodeId, label, hCtx, passed, onError, 'apiMockStart', durationMs, result,
      `${result.serverId ?? resolved.definition.id}:${result.port ?? resolved.definition.port}`,
    );
  } catch (err) {
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockStart', Math.round(performance.now() - t0), {
      success: false,
      error: toErrorMessage(err),
    }, data.serverId || 'unknown');
  }
}

export async function handleApiMockApplyNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const raw = node.data as ApiMockApplyNodeData;
  const data: ApiMockApplyNodeData = { ...raw, serverId: resolveRunServerId(hCtx, resolveStr(hCtx, raw.serverId)) };
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const t0 = performance.now();
  hCtx.log({ prefix: '→', text: `[${label}] APPLY mock ${data.serverId}` });
  try {
    // Prefer workspace server id base (strip run suffix) for definition content.
    const workspaceId = data.serverId.includes('__run_')
      ? data.serverId.slice(0, data.serverId.indexOf('__run_'))
      : data.serverId;
    const resolved = await resolveApiMockDefinition({
      serverId: workspaceId,
      isolateRun: false,
    });
    const definition = resolved.ok
      ? { ...resolved.definition, id: data.serverId }
      : undefined;
    const result = await handleApiMockApply(data, makeCtx(hCtx, definition));
    const durationMs = Math.round(performance.now() - t0);
    if (result.success) {
      setVar(hCtx, data.saveGenerationAs || 'mockGeneration', String(result.generation ?? 0));
    }
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockApply', durationMs, result, data.serverId);
  } catch (err) {
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockApply', Math.round(performance.now() - t0), {
      success: false,
      error: toErrorMessage(err),
    }, data.serverId);
  }
}

export async function handleApiMockResetStateNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const raw = node.data as ApiMockResetStateNodeData;
  const data: ApiMockResetStateNodeData = { ...raw, serverId: resolveRunServerId(hCtx, resolveStr(hCtx, raw.serverId)) };
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const t0 = performance.now();
  hCtx.log({ prefix: '→', text: `[${label}] RESET mock state ${data.serverId}` });
  try {
    const result = await handleApiMockResetState(data, makeCtx(hCtx));
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockResetState', Math.round(performance.now() - t0), result, data.serverId);
  } catch (err) {
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockResetState', Math.round(performance.now() - t0), {
      success: false,
      error: toErrorMessage(err),
    }, data.serverId);
  }
}

export async function handleApiMockStopNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const raw = node.data as ApiMockStopNodeData;
  const data: ApiMockStopNodeData = { ...raw, serverId: resolveRunServerId(hCtx, resolveStr(hCtx, raw.serverId)) };
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const t0 = performance.now();
  hCtx.log({ prefix: '→', text: `[${label}] STOP mock ${data.serverId}` });
  try {
    const result = await handleApiMockStop(data, makeCtx(hCtx));
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockStop', Math.round(performance.now() - t0), result, data.serverId);
  } catch (err) {
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockStop', Math.round(performance.now() - t0), {
      success: false,
      error: toErrorMessage(err),
    }, data.serverId);
  }
}

export async function handleApiMockAssertCallsNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const raw = node.data as ApiMockAssertCallsNodeData;
  const data: ApiMockAssertCallsNodeData = {
    ...raw,
    serverId: resolveRunServerId(hCtx, resolveStr(hCtx, raw.serverId)),
    routeId: resolveStr(hCtx, raw.routeId) || undefined,
  };
  const label = hCtx.nodeLabel(nodeId);
  const onError = data.onError ?? 'fail';
  const t0 = performance.now();
  hCtx.log({ prefix: '→', text: `[${label}] ASSERT mock calls ${data.serverId}` });
  try {
    const base = controlBaseUrl();
    const res = await fetchApiMockControl(`${base}/api/mock/servers/${encodeURIComponent(data.serverId)}/transactions?limit=500`);
    const json = await res.json() as {
      ok?: boolean;
      data?: { transactions?: import('../../../shared/api-mock/contracts').ApiMockTransactionV1[] };
      error?: { message?: string };
    };
    if (!json.ok) {
      await finish(nodeId, label, hCtx, passed, onError, 'apiMockAssertCalls', Math.round(performance.now() - t0), {
        success: false,
        error: json.error?.message ?? 'Failed to load transactions',
      }, data.serverId);
      return;
    }
    const result = await handleApiMockAssertCalls(data, makeCtx(hCtx), json.data?.transactions ?? []);
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockAssertCalls', Math.round(performance.now() - t0), result, data.serverId);
  } catch (err) {
    await finish(nodeId, label, hCtx, passed, onError, 'apiMockAssertCalls', Math.round(performance.now() - t0), {
      success: false,
      error: toErrorMessage(err),
    }, data.serverId);
  }
}
