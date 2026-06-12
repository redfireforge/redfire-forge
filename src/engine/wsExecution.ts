/**
 * WebSocket action execution for the standard test runner (non-workflow).
 *
 * Connect, send, and receive paths map `WsConnectActionConfig` / `WsSendActionConfig` /
 * `WsReceiveActionConfig` to the shared `WsNodeOperations` interface and return a
 * `RequestResult` with `transportType` and `wsResultMeta` populated.
 *
 * This file must NOT be imported by `requestExecution.ts`.  Executor wires it in
 * via the `RunOpts.executeNonHttp` callback to avoid circular dependencies.
 */
import type { Scenario, RequestResult, WsResultMeta, WsActionType } from '../shared/types';
import type { WsNodeOperations, WsMessageMatchCriteria } from '../features/workflow/engine/graphRunnerNodeHandlerContext';
import { nextResultId, buildErrorResult } from './requestExecution';
import { buildValidationResult } from './validationResult';
import { toErrorMessage, parseJsonSafe } from '../shared/utils/helpers';
import { round2 as roundMs } from '../shared/utils/percentiles';
import { isWsActionType } from '../shared/types';
import { classifyWsFailure } from '../features/workflow/engine/graphRunnerWsNodeHandlers';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Execute a WebSocket connect/send/receive action and return a `RequestResult`.
 * Called by `executor.ts` via `RunOpts.executeNonHttp`.
 */
export async function executeWsAction(
  scenario: Scenario,
  wsOps: WsNodeOperations,
  timeoutMs?: number,
): Promise<RequestResult> {
  const actionType = (scenario.actionType ?? 'http') as string;
  if (!isWsActionType(actionType)) {
    return buildErrorResult(scenario, new Error(`Not a WS actionType: '${actionType}'`));
  }
  if (actionType === 'wsConnect') return executeWsConnect(scenario, wsOps, timeoutMs);
  if (actionType === 'wsSend') return executeWsSend(scenario, wsOps, timeoutMs);
  if (actionType === 'wsReceive') return executeWsReceive(scenario, wsOps, timeoutMs);
  return buildErrorResult(scenario, new Error(`Unsupported WS actionType: '${actionType}'`));
}

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

async function executeWsConnect(
  scenario: Scenario,
  wsOps: WsNodeOperations,
  timeoutMs?: number,
): Promise<RequestResult> {
  const cfg = scenario.wsConnectAction;
  if (!cfg) return buildErrorResult(scenario, new Error('wsConnectAction is required for wsConnect'));

  const id = nextResultId();
  const start = performance.now();
  const wsActionType: WsActionType = 'wsConnect';

  let httpStatus = 0;
  let responseBody = '';
  let errorMessage: string | undefined;
  let wsResultMeta: WsResultMeta | undefined;

  try {
    const headers = kvToRecord(cfg.headers);
    const queryParams = kvToRecord(cfg.queryParams);
    const subprotocols = cfg.subprotocols
      ? cfg.subprotocols.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const result = await wsOps.connect({
      url: cfg.url,
      connectionId: cfg.connectionId,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      subprotocols: subprotocols?.length ? subprotocols : undefined,
      timeoutMs: cfg.timeoutMs ?? timeoutMs ?? 10_000,
    });

    httpStatus = 200;
    responseBody = JSON.stringify({
      connectionId: result.connectionId,
      protocol: result.protocol,
      extensions: result.extensions,
      latencyMs: result.latencyMs,
    });

    wsResultMeta = {
      connectionId: cfg.connectionId ?? result.connectionId,
      protocol: result.protocol,
      url: cfg.url,
    };
  } catch (err) {
    httpStatus = 0;
    errorMessage = toErrorMessage(err);
    const failureClass = classifyWsFailure(errorMessage);
    if (failureClass !== 'network') {
      errorMessage = `[${failureClass}] ${errorMessage}`;
    }
  }

  const responseTimeMs = roundMs(performance.now() - start);

  return buildWsResult(id, scenario, wsActionType, httpStatus, responseTimeMs, responseBody, errorMessage, wsResultMeta);
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

async function executeWsSend(
  scenario: Scenario,
  wsOps: WsNodeOperations,
  timeoutMs?: number,
): Promise<RequestResult> {
  const cfg = scenario.wsSendAction;
  if (!cfg) return buildErrorResult(scenario, new Error('wsSendAction is required for wsSend'));

  const connectionRef = cfg.connectionRef;
  if (!connectionRef) {
    return buildErrorResult(scenario, new Error('wsSendAction.connectionRef is required — reference a prior wsConnect scenario'));
  }

  const id = nextResultId();
  const start = performance.now();
  const wsActionType: WsActionType = 'wsSend';

  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let errorMessage: string | undefined;
  let wsResultMeta: WsResultMeta | undefined;

  try {
    // Snapshot cursor before sending so waitForMessage skips our own outgoing frame
    let sinceCursor: string | undefined;
    if (cfg.waitForResponse) {
      sinceCursor = await wsOps.snapshotCursor({ connectionId: connectionRef });
    }

    const sendResult = await wsOps.send({
      connectionId: connectionRef,
      data: cfg.message,
      type: cfg.messageType ?? 'text',
    });

    httpStatus = 200;
    wsResultMeta = {
      connectionId: connectionRef,
      messageSize: new TextEncoder().encode(cfg.message).length,
    };

    if (cfg.waitForResponse) {
      const received = await wsOps.waitForMessage({
        connectionId: connectionRef,
        timeoutMs: cfg.responseTimeoutMs ?? timeoutMs ?? 5_000,
        sinceCursor,
      });
      responseBody = received.data;
      responseObj = parseJsonSafe(responseBody);
      wsResultMeta.frameType = received.type;
      wsResultMeta.messageSize = new TextEncoder().encode(received.data).length;
    } else {
      // No response expected — report send latency only
      void sendResult;
    }
  } catch (err) {
    httpStatus = 0;
    errorMessage = toErrorMessage(err);
    const failureClass = classifyWsFailure(errorMessage);
    if (failureClass !== 'network') {
      errorMessage = `[${failureClass}] ${errorMessage}`;
    }
    if (wsResultMeta) {
      wsResultMeta.messageSize = undefined;
      wsResultMeta.frameType = undefined;
    }
  }

  const responseTimeMs = roundMs(performance.now() - start);

  return buildWsResult(id, scenario, wsActionType, httpStatus, responseTimeMs, responseBody, errorMessage, wsResultMeta, responseObj);
}

// ---------------------------------------------------------------------------
// Receive
// ---------------------------------------------------------------------------

async function executeWsReceive(
  scenario: Scenario,
  wsOps: WsNodeOperations,
  timeoutMs?: number,
): Promise<RequestResult> {
  const cfg = scenario.wsReceiveAction;
  if (!cfg) return buildErrorResult(scenario, new Error('wsReceiveAction is required for wsReceive'));

  const connectionRef = cfg.connectionRef;
  if (!connectionRef) {
    return buildErrorResult(scenario, new Error('wsReceiveAction.connectionRef is required — reference a prior wsConnect scenario'));
  }

  const id = nextResultId();
  const start = performance.now();
  const wsActionType: WsActionType = 'wsReceive';

  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let errorMessage: string | undefined;
  let wsResultMeta: WsResultMeta | undefined;

  try {
    const matchCriteria: WsMessageMatchCriteria | undefined = cfg.matchCriteria
      ? {
          contentContains: cfg.matchCriteria.contentContains,
          contentRegex: cfg.matchCriteria.contentRegex,
          jsonPathMatch: cfg.matchCriteria.jsonPathMatch,
          jsonPathValue: cfg.matchCriteria.jsonPathValue,
          messageType: cfg.matchCriteria.messageType,
        }
      : undefined;

    const received = await wsOps.waitForMessage({
      connectionId: connectionRef,
      timeoutMs: cfg.timeoutMs ?? timeoutMs ?? 10_000,
      matchCriteria,
    });

    httpStatus = 200;
    responseBody = received.data;
    responseObj = parseJsonSafe(responseBody);

    wsResultMeta = {
      connectionId: connectionRef,
      frameType: received.type,
      messageSize: new TextEncoder().encode(received.data).length,
    };
  } catch (err) {
    httpStatus = 0;
    errorMessage = toErrorMessage(err);
    const failureClass = classifyWsFailure(errorMessage);
    if (failureClass !== 'network') {
      errorMessage = `[${failureClass}] ${errorMessage}`;
    }
  }

  const responseTimeMs = roundMs(performance.now() - start);

  return buildWsResult(id, scenario, wsActionType, httpStatus, responseTimeMs, responseBody, errorMessage, wsResultMeta, responseObj);
}

// ---------------------------------------------------------------------------
// Shared result builder
// ---------------------------------------------------------------------------

function buildWsResult(
  id: string,
  scenario: Scenario,
  wsActionType: WsActionType,
  httpStatus: number,
  responseTimeMs: number,
  responseBody: string,
  errorMessage: string | undefined,
  wsResultMeta: WsResultMeta | undefined,
  responseObj?: unknown,
): RequestResult {
  const wsContext = wsResultMeta
    ? {
        connectionId: wsResultMeta.connectionId,
        frameType: wsResultMeta.frameType,
        protocol: wsResultMeta.protocol,
        messageSize: wsResultMeta.messageSize,
        latencyMs: responseTimeMs,
        url: wsResultMeta.url,
      }
    : undefined;

  const vr = buildValidationResult({
    httpStatus,
    responseTimeMs,
    responseHeaders: {},
    responseBody,
    responseObj: responseObj ?? parseJsonSafe(responseBody),
    errorMessage,
    validation: scenario.validation,
    assertions: scenario.validation.assertions ?? [],
    wsContext,
    transportType: wsActionType,
  });

  const resolvedUrl = wsResultMeta?.url
    ?? scenario.wsConnectAction?.url
    ?? scenario.wsSendAction?.url
    ?? scenario.wsReceiveAction?.url
    ?? scenario.url;

  return {
    id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    featureGroupName: scenario.featureGroupName,
    groupName: scenario.groupName,
    url: resolvedUrl,
    method: scenario.method,
    httpStatus,
    responseTimeMs,
    responseBody: responseBody.slice(0, 10_000),
    responseHeaders: {},
    timestamp: Date.now(),
    passed: vr.passed,
    validationMode: scenario.validation.mode,
    failureDetails: vr.failureDetails,
    errorMessage: vr.errorMessage,
    dataRowId: scenario.dataRowId,
    dataRowLabel: scenario.dataRowLabel,
    scenarioTags: scenario.scenarioTags,
    transportType: wsActionType,
    wsResultMeta,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kvToRecord(kv?: Array<{ key: string; value: string }>): Record<string, string> {
  if (!kv || kv.length === 0) return {};
  const record: Record<string, string> = {};
  for (const { key, value } of kv) {
    const k = key.trim();
    if (k) record[k] = value;
  }
  return record;
}
