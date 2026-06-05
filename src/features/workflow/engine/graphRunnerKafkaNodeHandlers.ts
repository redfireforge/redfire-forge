/**
 * Handlers for Kafka workflow nodes (produce and consume).
 * All Kafka network calls go through ctx.kafkaOperations — no singleton/global client access.
 */
import type { WorkflowNode, KafkaProduceNodeData, KafkaConsumeNodeData, KafkaNodeMetadataBinding } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag, KafkaConsumedMessage } from './graphRunnerNodeHandlerContext';
import type { KafkaFailureClass, CapturedKafkaNodeDetails } from '../../../shared/types';
import { toErrorMessage, truncate } from '../../../shared/utils/helpers';
import { waitWithAbort } from './correlationWaitHelpers';

// ── Bounded defaults ────────────────────────────────────────

const DEFAULT_PRODUCE_TIMEOUT_MS = 10_000;
const DEFAULT_CONSUME_TIMEOUT_MS = 30_000;
const DEFAULT_CONSUME_MAX_MESSAGES = 1;
const MAX_BODY_PREVIEW = 512;

// ── Shared metadata helpers ─────────────────────────────────

/** Properties accessible via a KafkaNodeMetadataBinding source on both produce results and consumed messages. */
type KafkaMetadataSource = {
  topic?: string;
  partition?: number;
  offset?: string;
  timestamp?: string;
  key?: string;
};

/**
 * Resolve a KafkaNodeMetadataBinding source field from a metadata source object.
 * Exported for testing; both produce and consume share the same field set.
 */
export function getKafkaSourceValue(
  source: KafkaNodeMetadataBinding['source'],
  meta: KafkaMetadataSource,
): string {
  switch (source) {
    case 'topic':     return meta.topic ?? '';
    case 'partition': return String(meta.partition ?? '');
    case 'offset':    return meta.offset ?? '';
    case 'timestamp': return meta.timestamp ?? '';
    case 'key':       return meta.key ?? '';
    default:          return '';
  }
}

/**
 * Write metadata output bindings into the variable context.
 * When `meta` is undefined (e.g. a consume node received no messages), each active binding
 * emits a diagnostic log and is set to ''.
 */
function writeKafkaBindings(
  bindings: KafkaNodeMetadataBinding[] | undefined,
  meta: KafkaMetadataSource | undefined,
  ctx: NodeHandlerContext['ctx'],
  log: NodeHandlerContext['log'],
  label: string,
): void {
  if (!bindings) return;
  const active = bindings.filter(b => b.enabled && b.targetVariable);
  for (const b of active) {
    if (meta === undefined) {
      log({ prefix: '~', text: `[${label}] Output binding "${b.targetVariable}" ← empty (no message received)` });
      ctx.set(b.targetVariable, '');
    } else {
      ctx.set(b.targetVariable, getKafkaSourceValue(b.source, meta));
    }
  }
  if (active.length > 0) {
    log({ prefix: '*', text: `[${label}] Wrote ${active.length} output binding(s)` });
  }
}

/**
 * Validate that the Kafka node's topic template resolves to a non-blank string.
 * Returns the resolved topic on success, null if validation failed
 * (passed.value and onNodeStateChange are already handled before returning null).
 */
function validateKafkaTopic(
  nodeId: string,
  topicTemplate: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): string | null {
  const resolvedTopic = hCtx.ctx.resolve(topicTemplate).trim();
  if (!resolvedTopic) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Validation failed: topic is blank` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Topic is required' });
    return null;
  }
  return resolvedTopic;
}

/**
 * Validate that Kafka operations are available for network calls.
 * Returns the operations object on success, null if unavailable
 * (passed.value and onNodeStateChange are already handled before returning null).
 *
 * NOTE: Do not call this before load-test early-return paths (auto-resume /
 * synthetic-inject) — those modes intentionally bypass network calls and must
 * not require kafkaOperations to be configured.
 */
function validateKafkaOps(
  nodeId: string,
  label: string,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): import('./graphRunnerNodeHandlerContext').KafkaNodeOperations | null {
  if (!hCtx.kafkaOperations) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] No Kafka operations available` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Kafka operations not configured' });
    return null;
  }
  return hCtx.kafkaOperations;
}

// ── Failure classification ──────────────────────────────────

/** Classify a Kafka error message into an actionable failure category. */
export function classifyKafkaFailure(errorMessage: string): KafkaFailureClass {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('sasl') || lower.includes('auth') || lower.includes('unauthorized') || lower.includes('forbidden'))
    return 'auth';
  if (lower.includes('tls') || lower.includes('ssl') || lower.includes('certificate') || lower.includes('handshake'))
    return 'tls';
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('timed_out'))
    return 'timeout';
  // Validation check must come before network — 'connection' keyword in the network check
  // is broad enough to appear in validation error messages (e.g. "topic not found: no active connection").
  if (lower.includes('topic') || lower.includes('blank') || lower.includes('required') || lower.includes('validation') || lower.includes('invalid'))
    return 'validation';
  if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('connection') || lower.includes('network') || lower.includes('unreachable'))
    return 'network';
  return 'network'; // default fallback
}

// ── Capture helper ──────────────────────────────────────────

function captureKafkaDetails(
  nodeId: string,
  hCtx: NodeHandlerContext,
  details: CapturedKafkaNodeDetails,
): void {
  hCtx.capturedKafkaDetails?.set(nodeId, details);
}

// ── Kafka Produce Handler ───────────────────────────────────

export async function handleKafkaProduceNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as KafkaProduceNodeData;
  const label = hCtx.nodeLabel(nodeId);

  const resolvedTopic = validateKafkaTopic(nodeId, data.topic ?? '', label, hCtx, passed);
  if (resolvedTopic === null) return;
  const ops = validateKafkaOps(nodeId, label, hCtx, passed);
  if (ops === null) return;

  // Interpolate template fields
  const resolvedKey = data.keyTemplate ? hCtx.ctx.resolve(data.keyTemplate) : undefined;
  const resolvedBody = data.bodyTemplate ? hCtx.ctx.resolve(data.bodyTemplate) : '';
  const resolvedHeaders: Record<string, string> = {};
  for (const h of data.headers ?? []) {
    if (h.enabled && h.key) {
      resolvedHeaders[hCtx.ctx.resolve(h.key)] = hCtx.ctx.resolve(h.value);
    }
  }

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  // ── Request details ──
  hCtx.log({ prefix: '→', text: `[${label}] PRODUCE ${resolvedTopic}` });
  hCtx.log({ prefix: '→', text: `[${label}]   cluster: ${data.clusterId ?? 'default'}` });
  if (resolvedKey) {
    hCtx.log({ prefix: '→', text: `[${label}]   key: ${resolvedKey}` });
  }
  if (data.ackMode && data.ackMode !== 'all') {
    hCtx.log({ prefix: '→', text: `[${label}]   acks: ${data.ackMode}` });
  }
  const hdrEntries = Object.entries(resolvedHeaders);
  if (hdrEntries.length > 0) {
    for (const [k, v] of hdrEntries) {
      hCtx.log({ prefix: '→', text: `[${label}]   header ${k}: ${v}` });
    }
  }
  if (resolvedBody) {
    const bodyPreview = resolvedBody.length > 300 ? resolvedBody.slice(0, 300) + '…' : resolvedBody;
    hCtx.log({ prefix: '→', text: `[${label}]   Body: ${bodyPreview}` });
  }

  const t0 = performance.now();
  try {
    const result = await ops.produce({
      clusterId: data.clusterId,
      topic: resolvedTopic,
      key: resolvedKey,
      value: resolvedBody,
      partition: data.partition,
      headers: hdrEntries.length > 0 ? resolvedHeaders : undefined,
      ackMode: data.ackMode,
      timeoutMs: data.timeoutMs ?? DEFAULT_PRODUCE_TIMEOUT_MS,
      schemaConfig: data.schemaConfig,
    });
    const durationMs = Math.round(performance.now() - t0);

    writeKafkaBindings(data.outputBindings, result, hCtx.ctx, hCtx.log, label);
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    captureKafkaDetails(nodeId, hCtx, {
      topic: resolvedTopic,
      partition: result.partition,
      offset: result.offset,
      key: resolvedKey,
      durationMs,
      bodyPreview: resolvedBody ? truncate(resolvedBody, MAX_BODY_PREVIEW) : undefined,
    });

    // ── Result details ──
    hCtx.log({ prefix: '✓', text: `[${label}] Produced — ${durationMs}ms` });
    hCtx.log({ prefix: '✓', text: `[${label}]   partition: ${result.partition}, offset: ${result.offset}` });
    if (result.timestamp) {
      hCtx.log({ prefix: '✓', text: `[${label}]   timestamp: ${result.timestamp}` });
    }
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    const failureClass = classifyKafkaFailure(msg);

    captureKafkaDetails(nodeId, hCtx, {
      topic: resolvedTopic,
      durationMs,
      failureClass,
    });

    hCtx.log({ prefix: '!', text: `[${label}] Produce failed [${failureClass}] — ${durationMs}ms` });
    hCtx.log({ prefix: '!', text: `[${label}]   ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}

// ── Kafka Consume Handler ───────────────────────────────────

/**
 * Kafka Consume node handler.
 *
 * Load test behavior modes:
 * - `wait-for-real`: normal consume (same as non-load-test mode)
 * - `auto-resume`: skip actual consume, resume immediately with empty result
 * - `synthetic-inject`: inject `data.loadTestBehavior.mockPayload` as if a real message was received;
 *   optionally delays by `syntheticDelayMs ± syntheticJitterMs` before injecting
 */
export async function handleKafkaConsumeNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as KafkaConsumeNodeData;
  const label = hCtx.nodeLabel(nodeId);

  const resolvedTopic = validateKafkaTopic(nodeId, data.topic ?? '', label, hCtx, passed);
  if (resolvedTopic === null) return;

  // ── Load test mode: auto-resume ──
  const ltb = data.loadTestBehavior ?? { mode: 'auto-resume' as const };
  if (hCtx.loadTestMode && ltb.mode === 'auto-resume') {
    hCtx.log({ prefix: '*', text: `[${label}] Auto-resume mode — skipping consume` });
    writeKafkaBindings(data.outputBindings, undefined, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__kafkaConsumeBody', '');
    hCtx.ctx.set('__kafkaConsumeCount', '0');
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // ── Load test mode: synthetic-inject ──
  if (hCtx.loadTestMode && ltb.mode === 'synthetic-inject') {
    const delayMs = ltb.syntheticDelayMs ?? 0;
    const jitterMs = ltb.syntheticJitterMs ?? 0;
    const actualDelay = delayMs + (jitterMs > 0 ? Math.random() * jitterMs * 2 - jitterMs : 0);

    if (actualDelay > 0) {
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running', responseDetail: `Synthetic wait ${Math.round(actualDelay)}ms` });
      const completed = await waitWithAbort(Math.max(0, actualDelay), hCtx.abortSignal);
      if (!completed) {
        hCtx.log({ prefix: '!', text: `[${label}] Synthetic inject aborted` });
        hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
        return;
      }
    }

    const mockPayload = ltb.mockPayload ?? {};
    const syntheticMsg: KafkaConsumedMessage = {
      topic: resolvedTopic,
      partition: 0,
      offset: '0',
      timestamp: String(Date.now()),
      key: 'synthetic',
      value: JSON.stringify(mockPayload),
    };

    hCtx.log({ prefix: '*', text: `[${label}] Synthetic inject — using mock payload` });
    writeKafkaBindings(data.outputBindings, syntheticMsg, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__kafkaConsumeBody', syntheticMsg.value);
    hCtx.ctx.set('__kafkaConsumeCount', '1');
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // ── Normal consume ──
  const ops = validateKafkaOps(nodeId, label, hCtx, passed);
  if (ops === null) return;

  const timeoutMs = data.timeoutMs ?? DEFAULT_CONSUME_TIMEOUT_MS;
  const maxMessages = data.maxMessages ?? DEFAULT_CONSUME_MAX_MESSAGES;

  // Resolve filter expressions
  const headerFilters = (data.headerFilters ?? [])
    .filter(f => f.enabled && f.key)
    .map(f => ({ key: hCtx.ctx.resolve(f.key), value: hCtx.ctx.resolve(f.value) }))
    .filter(f => f.key.trim()); // drop filters where key resolved to empty string
  const jsonPathFilters = (data.jsonPathFilters ?? [])
    .filter(f => f.enabled && f.jsonPath)
    .map(f => ({ jsonPath: hCtx.ctx.resolve(f.jsonPath), expectedValue: f.expectedValue ? hCtx.ctx.resolve(f.expectedValue) : undefined }))
    .filter(f => f.jsonPath.trim()); // drop filters where jsonPath resolved to empty string

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'running' });

  // ── Request details ──
  hCtx.log({ prefix: '→', text: `[${label}] CONSUME ${resolvedTopic}` });
  hCtx.log({ prefix: '→', text: `[${label}]   cluster: ${data.clusterId ?? 'default'}` });
  hCtx.log({ prefix: '→', text: `[${label}]   maxMessages: ${maxMessages}, timeout: ${timeoutMs}ms, startPosition: ${data.startPosition ?? 'latest'}` });
  if (data.keyRegex) {
    hCtx.log({ prefix: '→', text: `[${label}]   keyRegex: ${data.keyRegex}` });
  }
  if (headerFilters.length > 0) {
    for (const f of headerFilters) {
      hCtx.log({ prefix: '→', text: `[${label}]   headerFilter: ${f.key} = ${f.value}` });
    }
  }
  if (jsonPathFilters.length > 0) {
    for (const f of jsonPathFilters) {
      hCtx.log({ prefix: '→', text: `[${label}]   jsonPathFilter: ${f.jsonPath}${f.expectedValue !== undefined ? ` = ${f.expectedValue}` : ''}` });
    }
  }

  const t0 = performance.now();
  try {
    const messages = await ops.consume({
      clusterId: data.clusterId,
      topic: resolvedTopic,
      maxMessages,
      timeoutMs,
      startPosition: data.startPosition ?? 'latest',
      keyRegex: data.keyRegex ? hCtx.ctx.resolve(data.keyRegex) : undefined,
      headerFilters: headerFilters.length > 0 ? headerFilters : undefined,
      jsonPathFilters: jsonPathFilters.length > 0 ? jsonPathFilters : undefined,
      schemaConfig: data.schemaConfig,
    });
    const durationMs = Math.round(performance.now() - t0);

    const firstMsg = messages[0];

    writeKafkaBindings(data.outputBindings, firstMsg, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__kafkaConsumeBody', firstMsg?.value ?? '');
    hCtx.ctx.set('__kafkaConsumeCount', String(messages.length));
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    captureKafkaDetails(nodeId, hCtx, {
      topic: resolvedTopic,
      partition: firstMsg?.partition,
      offset: firstMsg?.offset,
      key: firstMsg?.key,
      durationMs,
      matchedMessages: messages.length,
      bodyPreview: firstMsg?.value ? truncate(firstMsg.value, MAX_BODY_PREVIEW) : undefined,
    });

    // ── Result details ──
    if (messages.length === 0) {
      hCtx.log({ prefix: '~', text: `[${label}] No messages received (timeout, ${durationMs}ms)` });
    } else {
      hCtx.log({ prefix: '✓', text: `[${label}] Consumed ${messages.length} message(s) — ${durationMs}ms` });
      hCtx.log({ prefix: '✓', text: `[${label}]   partition: ${firstMsg!.partition}, offset: ${firstMsg!.offset}` });
      if (firstMsg!.key) {
        hCtx.log({ prefix: '✓', text: `[${label}]   key: ${firstMsg!.key}` });
      }
      if (firstMsg!.headers && Object.keys(firstMsg!.headers).length > 0) {
        for (const [k, v] of Object.entries(firstMsg!.headers)) {
          hCtx.log({ prefix: '✓', text: `[${label}]   header ${k}: ${v}` });
        }
      }
      if (firstMsg!.value) {
        const bodyPreview = firstMsg!.value.length > 300 ? firstMsg!.value.slice(0, 300) + '…' : firstMsg!.value;
        hCtx.log({ prefix: '✓', text: `[${label}]   Body: ${bodyPreview}` });
      }
    }

    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    passed.value = false;
    const msg = toErrorMessage(err);
    const failureClass = classifyKafkaFailure(msg);

    captureKafkaDetails(nodeId, hCtx, {
      topic: resolvedTopic,
      durationMs,
      failureClass,
      matchedMessages: 0,
    });

    hCtx.log({ prefix: '!', text: `[${label}] Consume failed [${failureClass}] — ${durationMs}ms` });
    hCtx.log({ prefix: '!', text: `[${label}]   ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}
