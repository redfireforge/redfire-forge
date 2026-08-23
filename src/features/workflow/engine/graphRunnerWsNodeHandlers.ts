/**
 * Handlers for WebSocket workflow nodes (connect, send, receive, trigger).
 * All WS network calls go through ctx.wsOperations — no singleton/global client access.
 *
 * Known limitation: parallel fork branches share the same wsOperations
 * registry within a single runGraph call. Branches using the same
 * connectionId label will overwrite each other's registry entries.
 * Users should use distinct connectionId values in parallel branches.
 */
import type {
  WorkflowNode,
  WsConnectNodeData,
  WsSendNodeData,
  WsReceiveNodeData,
  WsTriggerNodeData,
  WsExtractionRule,
} from '../types/workflow';
import type { NodeHandlerContext, PassedFlag, WsNodeOperations, WsMessageMatchCriteria } from './graphRunnerNodeHandlerContext';
import type { RequestResult, CapturedWsNodeDetails, WsFailureClass, TransportType, WsResultMeta } from '@shared/types';
import { toErrorMessage, truncate } from '@shared/utils/helpers';
import { getByPath } from '@shared/utils/jsonPath';
import { nextResultId } from '../../../engine/requestExecution';
import { extractPayloadVariables, type ExtractVariableMapping } from './graphRunnerHelpers';

// ── Bounded defaults ────────────────────────────────────────

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_RECEIVE_TIMEOUT_MS = 30_000;
const DEFAULT_RESPONSE_TIMEOUT_MS = 5_000;
const MAX_BODY_PREVIEW = 512;

// ── Shared helpers ──────────────────────────────────────────

function mapExtractionRules(rules: WsExtractionRule[]): ExtractVariableMapping[] {
  return rules
    .filter(r => r.variableName && r.jsonPath)
    .map(r => ({ name: r.variableName, jsonPath: r.jsonPath }));
}

function validateWsOps(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
  transportType: TransportType = 'wsConnect',
): WsNodeOperations | null {
  if (!hCtx.wsOperations) {
    passed.value = false;
    hCtx.results.push(buildWsResult(nodeId, label, transportType, '', 0, false, 'WebSocket operations not configured'));
    hCtx.log({ prefix: '!', text: `[${label}] No WebSocket operations available` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'WebSocket operations not configured' });
    return null;
  }
  return hCtx.wsOperations;
}

/** Classify a WS error message into an actionable failure category. */
export function classifyWsFailure(errorMessage: string): WsFailureClass {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('timed_out'))
    return 'timeout';
  if (lower.includes('protocol') || lower.includes('subprotocol') || lower.includes('upgrade'))
    return 'protocol';
  if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('network') || lower.includes('unreachable'))
    return 'network';
  if (lower.includes('connection') || lower.includes('closed') || lower.includes('not open'))
    return 'connection';
  if (lower.includes('validation') || lower.includes('required') || lower.includes('invalid') || lower.includes('blank'))
    return 'validation';
  return 'network';
}

function captureWsDetails(
  nodeId: string,
  hCtx: NodeHandlerContext,
  details: CapturedWsNodeDetails,
): void {
  hCtx.capturedWsDetails?.set(nodeId, details);
}

interface WsResultExtras {
  requestLog?: { headers: Record<string, string>; body?: string };
  responseBody?: string;
  wsResultMeta?: WsResultMeta;
}

function buildWsResult(
  nodeId: string,
  label: string,
  transportType: TransportType,
  url: string,
  durationMs: number,
  passed: boolean,
  errorMessage?: string,
  extras?: WsResultExtras,
): RequestResult {
  return {
    id: nextResultId(),
    scenarioId: nodeId,
    scenarioName: label,
    url,
    method: transportType === 'wsConnect' ? 'CONNECT' : transportType === 'wsSend' ? 'SEND' : transportType === 'wsTrigger' ? 'TRIGGER' : 'RECEIVE',
    httpStatus: passed ? 200 : 0,
    responseTimeMs: durationMs,
    responseBody: extras?.responseBody ?? '',
    timestamp: Date.now(),
    passed,
    validationMode: 'none',
    failureDetails: [],
    workflowNodeId: nodeId,
    transportType,
    errorMessage,
    requestLog: extras?.requestLog,
    wsResultMeta: extras?.wsResultMeta,
  };
}

// ── WS Connect Handler ─────────────────────────────────────

export async function handleWsConnectNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as WsConnectNodeData;
  const label = hCtx.nodeLabel(nodeId);

  const resolvedUrl = hCtx.ctx.resolve(data.url ?? '').trim();
  if (!resolvedUrl) {
    passed.value = false;
    hCtx.results.push(buildWsResult(nodeId, label, 'wsConnect', '', 0, false, 'URL is required'));
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: URL is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'URL is required' });
    return;
  }

  const ops = validateWsOps(nodeId, label, hCtx, passed);
  if (ops === null) return;

  const resolvedHeaders: Record<string, string> = {};
  for (const h of data.headers ?? []) {
    if (h.enabled && h.key) {
      resolvedHeaders[hCtx.ctx.resolve(h.key)] = hCtx.ctx.resolve(h.value);
    }
  }

  const resolvedQueryParams: Record<string, string> = {};
  for (const q of data.queryParams ?? []) {
    if (q.enabled && q.key) {
      resolvedQueryParams[hCtx.ctx.resolve(q.key)] = hCtx.ctx.resolve(q.value);
    }
  }

  const resolvedSubprotocols = (data.subprotocols ?? [])
    .map(s => hCtx.ctx.resolve(s).trim())
    .filter(Boolean);

  const resolvedConnId = data.connectionId ? hCtx.ctx.resolve(data.connectionId).trim() : undefined;

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  hCtx.log({ prefix: '→', text: `[${label}] WS CONNECT ${resolvedUrl}` });
  if (resolvedConnId) {
    hCtx.log({ prefix: '→', text: `[${label}]   connectionId: ${resolvedConnId}` });
  }
  if (resolvedSubprotocols.length > 0) {
    hCtx.log({ prefix: '→', text: `[${label}]   subprotocols: ${resolvedSubprotocols.join(', ')}` });
  }
  const hdrEntries = Object.entries(resolvedHeaders);
  for (const [k, v] of hdrEntries) {
    hCtx.log({ prefix: '→', text: `[${label}]   header ${k}: ${v}` });
  }

  const t0 = performance.now();
  try {
    const result = await ops.connect({
      url: resolvedUrl,
      connectionId: resolvedConnId || undefined,
      headers: hdrEntries.length > 0 ? resolvedHeaders : undefined,
      queryParams: Object.keys(resolvedQueryParams).length > 0 ? resolvedQueryParams : undefined,
      subprotocols: resolvedSubprotocols.length > 0 ? resolvedSubprotocols : undefined,
      timeoutMs: data.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    });
    const durationMs = Math.round(performance.now() - t0);

    const outputBindings = data.outputBindings ?? [];
    for (const b of outputBindings) {
      if (!b.enabled || !b.variableName) continue;
      switch (b.field) {
        case 'protocol':   hCtx.ctx.set(b.variableName, result.protocol ?? ''); break;
        case 'extensions':  hCtx.ctx.set(b.variableName, result.extensions ?? ''); break;
        case 'latencyMs':   hCtx.ctx.set(b.variableName, String(result.latencyMs)); break;
      }
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    captureWsDetails(nodeId, hCtx, {
      url: resolvedUrl,
      connectionId: resolvedConnId || result.connectionId,
      durationMs,
      protocol: result.protocol,
      extensions: result.extensions,
    });

    hCtx.results.push(buildWsResult(nodeId, label, 'wsConnect', resolvedUrl, durationMs, true, undefined, {
      requestLog: {
        headers: hdrEntries.length > 0 ? resolvedHeaders : {},
        body: JSON.stringify({
          url: resolvedUrl,
          connectionId: resolvedConnId ?? '(auto)',
          ...(resolvedSubprotocols.length > 0 && { subprotocols: resolvedSubprotocols }),
        }),
      },
      responseBody: JSON.stringify({
        connectionId: resolvedConnId || result.connectionId,
        protocol: result.protocol,
        extensions: result.extensions,
        latencyMs: result.latencyMs,
      }),
      wsResultMeta: {
        url: resolvedUrl,
        connectionId: resolvedConnId || result.connectionId,
        protocol: result.protocol,
      },
    }));

    hCtx.log({ prefix: '✓', text: `[${label}] Connected — ${durationMs}ms` });
    if (result.protocol) {
      hCtx.log({ prefix: '✓', text: `[${label}]   protocol: ${result.protocol}` });
    }
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    const failureClass = classifyWsFailure(msg);

    captureWsDetails(nodeId, hCtx, {
      url: resolvedUrl,
      connectionId: resolvedConnId || data.connectionId || '',
      durationMs,
      failureClass,
    });

    hCtx.results.push(buildWsResult(nodeId, label, 'wsConnect', resolvedUrl, durationMs, false, msg, {
      requestLog: {
        headers: hdrEntries.length > 0 ? resolvedHeaders : {},
        body: JSON.stringify({ url: resolvedUrl, connectionId: resolvedConnId ?? '(auto)' }),
      },
      wsResultMeta: { url: resolvedUrl },
    }));

    hCtx.log({ prefix: '!', text: `[${label}] Connect failed [${failureClass}] — ${durationMs}ms` });
    hCtx.log({ prefix: '!', text: `[${label}]   ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ── WS Send Handler ─────────────────────────────────────────

export async function handleWsSendNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as WsSendNodeData;
  const label = hCtx.nodeLabel(nodeId);

  if (!data.connectionId?.trim()) {
    passed.value = false;
    hCtx.results.push(buildWsResult(nodeId, label, 'wsSend', '', 0, false, 'Connection ID is required'));
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: connectionId is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Connection ID is required' });
    return;
  }

  const ops = validateWsOps(nodeId, label, hCtx, passed, 'wsSend');
  if (ops === null) return;

  const resolvedMessage = hCtx.ctx.resolve(data.message ?? '');
  const connId = hCtx.ctx.resolve(data.connectionId).trim();

  if (!connId) {
    passed.value = false;
    hCtx.results.push(buildWsResult(nodeId, label, 'wsSend', '', 0, false, 'Connection ID resolved to empty'));
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: connectionId resolved to empty` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Connection ID resolved to empty' });
    return;
  }

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  hCtx.log({ prefix: '→', text: `[${label}] WS SEND → ${connId}` });
  hCtx.log({ prefix: '→', text: `[${label}]   type: ${data.messageType ?? 'text'}` });
  if (resolvedMessage) {
    const msgPreview = resolvedMessage.length > 300 ? resolvedMessage.slice(0, 300) + '…' : resolvedMessage;
    hCtx.log({ prefix: '→', text: `[${label}]   message: ${msgPreview}` });
  }

  const t0 = performance.now();
  try {
    // Snapshot cursor before sending so waitForMessage skips pre-send buffered messages
    let preSendCursor: string | undefined;
    if (data.waitForResponse) {
      preSendCursor = await ops.snapshotCursor({ connectionId: connId });
    }

    const sendResult = await ops.send({
      connectionId: connId,
      data: resolvedMessage,
      type: data.messageType ?? 'text',
    });
    let totalLatencyMs = sendResult.latencyMs;

    let receivedMsg: import('./graphRunnerNodeHandlerContext').WsReceivedMessage | undefined;
    if (data.waitForResponse) {
      hCtx.log({ prefix: '→', text: `[${label}]   waiting for response (timeout: ${data.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS}ms)` });
      receivedMsg = await ops.waitForMessage({
        connectionId: connId,
        timeoutMs: data.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS,
        sinceCursor: preSendCursor,
        abortSignal: hCtx.abortSignal,
      });
      totalLatencyMs = Math.round(performance.now() - t0);
    }

    const durationMs = Math.round(performance.now() - t0);

    if (data.waitForResponse) {
      const outputBindings = data.outputBindings ?? [];
      for (const b of outputBindings) {
        if (!b.enabled || !b.variableName) continue;
        switch (b.field) {
          case 'responseBody': hCtx.ctx.set(b.variableName, receivedMsg?.data ?? ''); break;
          case 'responseType': hCtx.ctx.set(b.variableName, receivedMsg?.type ?? ''); break;
          case 'latencyMs':    hCtx.ctx.set(b.variableName, String(totalLatencyMs)); break;
        }
      }
      hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    }

    const sentPreview = resolvedMessage ? truncate(resolvedMessage, MAX_BODY_PREVIEW) : undefined;
    const bodyPreview = receivedMsg !== undefined
      ? (receivedMsg.data ? truncate(receivedMsg.data, MAX_BODY_PREVIEW) : '')
      : sentPreview;
    captureWsDetails(nodeId, hCtx, {
      connectionId: connId,
      durationMs,
      messageType: data.messageType ?? 'text',
      bodyPreview,
    });

    hCtx.results.push(buildWsResult(nodeId, label, 'wsSend', connId, durationMs, true, undefined, {
      requestLog: { headers: {}, body: resolvedMessage || undefined },
      responseBody: receivedMsg?.data ?? '',
      wsResultMeta: {
        connectionId: connId,
        messageSize: new TextEncoder().encode(resolvedMessage).length,
        frameType: receivedMsg?.type,
      },
    }));

    hCtx.log({ prefix: '✓', text: `[${label}] Sent — ${durationMs}ms` });
    if (receivedMsg) {
      const respPreview = receivedMsg.data.length > 300 ? receivedMsg.data.slice(0, 300) + '…' : receivedMsg.data;
      hCtx.log({ prefix: '✓', text: `[${label}]   Response: ${respPreview}` });
    }
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    const failureClass = classifyWsFailure(msg);

    captureWsDetails(nodeId, hCtx, {
      connectionId: connId,
      durationMs,
      failureClass,
      bodyPreview: resolvedMessage ? truncate(resolvedMessage, MAX_BODY_PREVIEW) : undefined,
    });

    hCtx.results.push(buildWsResult(nodeId, label, 'wsSend', connId, durationMs, false, msg, {
      requestLog: resolvedMessage ? { headers: {}, body: resolvedMessage } : undefined,
      wsResultMeta: { connectionId: connId },
    }));

    hCtx.log({ prefix: '!', text: `[${label}] Send failed [${failureClass}] — ${durationMs}ms` });
    hCtx.log({ prefix: '!', text: `[${label}]   ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ── WS Receive Handler ──────────────────────────────────────

export async function handleWsReceiveNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as WsReceiveNodeData;
  const label = hCtx.nodeLabel(nodeId);

  if (!data.connectionId?.trim()) {
    passed.value = false;
    hCtx.results.push(buildWsResult(nodeId, label, 'wsReceive', '', 0, false, 'Connection ID is required'));
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: connectionId is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Connection ID is required' });
    return;
  }

  const ops = validateWsOps(nodeId, label, hCtx, passed, 'wsReceive');
  if (ops === null) return;

  const connId = hCtx.ctx.resolve(data.connectionId).trim();
  const timeoutMs = data.timeoutMs ?? DEFAULT_RECEIVE_TIMEOUT_MS;

  if (!connId) {
    passed.value = false;
    hCtx.results.push(buildWsResult(nodeId, label, 'wsReceive', '', 0, false, 'Connection ID resolved to empty'));
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: connectionId resolved to empty` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Connection ID resolved to empty' });
    return;
  }

  const matchCriteria: WsMessageMatchCriteria = {};
  const mc = data.matchCriteria;
  if (mc) {
    if (mc.contentContains) matchCriteria.contentContains = hCtx.ctx.resolve(mc.contentContains);
    if (mc.contentRegex) matchCriteria.contentRegex = hCtx.ctx.resolve(mc.contentRegex);
    if (mc.jsonPathMatch) matchCriteria.jsonPathMatch = hCtx.ctx.resolve(mc.jsonPathMatch);
    if (mc.jsonPathValue) matchCriteria.jsonPathValue = hCtx.ctx.resolve(mc.jsonPathValue);
    if (mc.messageType) matchCriteria.messageType = mc.messageType;
  }

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  hCtx.log({ prefix: '→', text: `[${label}] WS RECEIVE ← ${connId} (timeout: ${timeoutMs}ms)` });
  if (matchCriteria.contentContains) hCtx.log({ prefix: '→', text: `[${label}]   contentContains: ${matchCriteria.contentContains}` });
  if (matchCriteria.contentRegex) hCtx.log({ prefix: '→', text: `[${label}]   contentRegex: ${matchCriteria.contentRegex}` });
  if (matchCriteria.jsonPathMatch) hCtx.log({ prefix: '→', text: `[${label}]   jsonPathMatch: ${matchCriteria.jsonPathMatch}` });

  const t0 = performance.now();
  try {
    const receivedMsg = await ops.waitForMessage({
      connectionId: connId,
      timeoutMs,
      matchCriteria: Object.keys(matchCriteria).length > 0 ? matchCriteria : undefined,
      abortSignal: hCtx.abortSignal,
    });
    const durationMs = Math.round(performance.now() - t0);

    // Apply extraction rules
    const mappings = mapExtractionRules(data.extractionRules ?? []);
    if (mappings.length > 0 && receivedMsg.data) {
      try {
        const parsed = JSON.parse(receivedMsg.data);
        extractPayloadVariables(parsed, mappings, hCtx.ctx);
      } catch {
        hCtx.log({ prefix: '~', text: `[${label}] Message is not JSON — skipping extraction rules` });
      }
    }

    const outputBindings = data.outputBindings ?? [];
    for (const b of outputBindings) {
      if (!b.enabled || !b.variableName) continue;
      switch (b.field) {
        case 'messageBody': hCtx.ctx.set(b.variableName, receivedMsg.data); break;
        case 'messageType': hCtx.ctx.set(b.variableName, receivedMsg.type); break;
        case 'matchedAt':   hCtx.ctx.set(b.variableName, String(receivedMsg.timestamp)); break;
        case 'latencyMs':   hCtx.ctx.set(b.variableName, String(durationMs)); break;
      }
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    captureWsDetails(nodeId, hCtx, {
      connectionId: connId,
      durationMs,
      messageType: receivedMsg.type,
      bodyPreview: receivedMsg.data ? truncate(receivedMsg.data, MAX_BODY_PREVIEW) : undefined,
    });

    const hasMatchCriteria = Object.keys(matchCriteria).length > 0;
    hCtx.results.push(buildWsResult(nodeId, label, 'wsReceive', connId, durationMs, true, undefined, {
      requestLog: hasMatchCriteria ? { headers: {}, body: JSON.stringify(matchCriteria) } : undefined,
      responseBody: receivedMsg.data,
      wsResultMeta: {
        connectionId: connId,
        frameType: receivedMsg.type,
        messageSize: new TextEncoder().encode(receivedMsg.data).length,
      },
    }));

    const bodyPreview = receivedMsg.data.length > 300 ? receivedMsg.data.slice(0, 300) + '…' : receivedMsg.data;
    hCtx.log({ prefix: '✓', text: `[${label}] Received — ${durationMs}ms` });
    hCtx.log({ prefix: '✓', text: `[${label}]   Body: ${bodyPreview}` });
    if (mappings.length > 0) {
      hCtx.log({ prefix: '*', text: `[${label}] Extracted ${mappings.length} variable(s)` });
    }
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    const failureClass = classifyWsFailure(msg);

    captureWsDetails(nodeId, hCtx, {
      connectionId: connId,
      durationMs,
      failureClass,
    });

    hCtx.results.push(buildWsResult(nodeId, label, 'wsReceive', connId, durationMs, false, msg, {
      requestLog: Object.keys(matchCriteria).length > 0 ? { headers: {}, body: JSON.stringify(matchCriteria) } : undefined,
      wsResultMeta: { connectionId: connId },
    }));

    hCtx.log({ prefix: '!', text: `[${label}] Receive failed [${failureClass}] — ${durationMs}ms` });
    hCtx.log({ prefix: '!', text: `[${label}]   ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ── WS Trigger Handler ──────────────────────────────────────

/** Context keys seeded by WS Trigger nodes. */
const WS_TRIGGER_CONTEXT_KEYS = {
  url: 'ws.trigger.url',
  connectionId: 'ws.trigger.connectionId',
  message: 'ws.trigger.message',
  messageType: 'ws.trigger.messageType',
} as const;

/**
 * WS Trigger node handler.
 *
 * Reads `__wsTriggerMessage` from context (pre-set by external trigger runner).
 * Falls back to `data.samplePayload` for Quick Test mode (mirrors Kafka trigger pattern).
 */
export async function handleWsTriggerNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as WsTriggerNodeData;

  const rawMessage = hCtx.ctx.get('__wsTriggerMessage');
  let message: { data: string; type: string; url?: string; connectionId?: string } | null = null;
  let messageSource: 'runtime' | 'sample' | 'none' = 'none';

  if (rawMessage) {
    try {
      message = typeof rawMessage === 'string'
        ? (JSON.parse(rawMessage) as typeof message)
        : (rawMessage as typeof message);
      messageSource = 'runtime';
    } catch {
      // Unparseable — proceed with empty seeds
    }
    hCtx.ctx.delete('__wsTriggerMessage');
  } else if (data.samplePayload?.trim()) {
    message = {
      data: hCtx.ctx.resolve(data.samplePayload.trim()),
      type: (data.matchCriteria?.messageType && data.matchCriteria.messageType !== 'any')
        ? data.matchCriteria.messageType
        : 'text',
      url: data.url ? hCtx.ctx.resolve(data.url) : undefined,
      connectionId: data.connectionId ? hCtx.ctx.resolve(data.connectionId) : undefined,
    };
    messageSource = 'sample';
  }

  const resolvedUrl = message?.url ?? (data.url ? hCtx.ctx.resolve(data.url) : '');
  const resolvedConnId = message?.connectionId ?? (data.connectionId ? hCtx.ctx.resolve(data.connectionId) : '');
  const triggerLabel = data.label || 'WS Trigger';

  // Seed ws.trigger.* context variables early so trace has values on match failure
  hCtx.ctx.set(WS_TRIGGER_CONTEXT_KEYS.url, resolvedUrl);
  hCtx.ctx.set(WS_TRIGGER_CONTEXT_KEYS.connectionId, resolvedConnId);
  hCtx.ctx.set(WS_TRIGGER_CONTEXT_KEYS.message, message?.data ?? '');
  hCtx.ctx.set(WS_TRIGGER_CONTEXT_KEYS.messageType, message?.type ?? 'text');

  // Validate message against match criteria (if configured)
  const mc = data.matchCriteria;
  if (message && mc) {
    const body = typeof message.data === 'string' ? message.data : '';
    let matchError: string | undefined;
    if (mc.contentContains && !body.includes(hCtx.ctx.resolve(mc.contentContains))) {
      matchError = 'Message does not match contentContains criteria';
      hCtx.log({ prefix: '!', text: `[${triggerLabel}] Message does not match contentContains: "${mc.contentContains}"` });
    }
    if (!matchError && mc.contentRegex) {
      try {
        const re = new RegExp(hCtx.ctx.resolve(mc.contentRegex));
        if (!re.test(body)) {
          matchError = 'Message does not match contentRegex criteria';
          hCtx.log({ prefix: '!', text: `[${triggerLabel}] Message does not match contentRegex: /${mc.contentRegex}/` });
        }
      } catch {
        matchError = 'Invalid contentRegex pattern';
        hCtx.log({ prefix: '!', text: `[${triggerLabel}] Invalid contentRegex: /${mc.contentRegex}/` });
      }
    }
    if (!matchError && mc.jsonPathMatch) {
      try {
        const parsed = JSON.parse(body);
        const value = getByPath(parsed, hCtx.ctx.resolve(mc.jsonPathMatch));
        if (value === undefined) {
          matchError = 'Message does not match jsonPathMatch criteria';
          hCtx.log({ prefix: '!', text: `[${triggerLabel}] Message does not match jsonPathMatch: ${mc.jsonPathMatch}` });
        } else if (mc.jsonPathValue !== undefined) {
          const strVal = typeof value === 'string' ? value : JSON.stringify(value);
          if (strVal !== hCtx.ctx.resolve(mc.jsonPathValue)) {
            matchError = 'Message does not match jsonPathValue criteria';
            hCtx.log({ prefix: '!', text: `[${triggerLabel}] JSONPath value mismatch: expected "${mc.jsonPathValue}", got "${strVal}"` });
          }
        }
      } catch {
        matchError = 'jsonPathMatch requires valid JSON body';
        hCtx.log({ prefix: '!', text: `[${triggerLabel}] jsonPathMatch requires valid JSON body — parse failed` });
      }
    }
    if (!matchError && mc.messageType && mc.messageType !== 'any' && message.type !== mc.messageType) {
      matchError = `Message type mismatch: expected ${mc.messageType}`;
      hCtx.log({ prefix: '!', text: `[${triggerLabel}] Message type mismatch: expected "${mc.messageType}", got "${message.type}"` });
    }
    if (matchError) {
      hCtx.results.push(buildWsResult(nodeId, triggerLabel, 'wsTrigger', resolvedUrl, 0, false, matchError));
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: matchError });
      passed.value = false;
      return;
    }
  }

  // Extract user-defined variables from the message body via JSON path
  if (message?.data && data.extractionRules && data.extractionRules.length > 0) {
    const mappings = mapExtractionRules(data.extractionRules);
    if (mappings.length > 0) {
      try {
        const parsed = JSON.parse(message.data);
        extractPayloadVariables(parsed, mappings, hCtx.ctx);
      } catch {
        // Non-JSON message — skip extraction
      }
    }
  }

  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

  if (messageSource === 'runtime') {
    hCtx.log({ prefix: '✓', text: `[${triggerLabel}] Triggered by live WebSocket message` });
  } else if (messageSource === 'sample') {
    hCtx.log({ prefix: '✓', text: `[${triggerLabel}] Triggered by sample payload (Quick Test)` });
  } else {
    hCtx.log({ prefix: '~', text: `[${triggerLabel}] Dry-run (Quick Test) — no sample payload configured` });
  }

  hCtx.log({ prefix: '✓', text: `[${triggerLabel}]   url: ${hCtx.ctx.get(WS_TRIGGER_CONTEXT_KEYS.url)}` });
  hCtx.log({ prefix: '✓', text: `[${triggerLabel}]   connectionId: ${hCtx.ctx.get(WS_TRIGGER_CONTEXT_KEYS.connectionId)}` });
  if (message?.data) {
    const bodyPreview = message.data.length > 300 ? message.data.slice(0, 300) + '…' : message.data;
    hCtx.log({ prefix: '✓', text: `[${triggerLabel}]   message: ${bodyPreview}` });
  }

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
