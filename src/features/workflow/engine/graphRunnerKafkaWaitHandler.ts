/**
 * Handler for KafkaWait nodes — pause/resume on correlated incoming Kafka messages.
 *
 * Architecture note (Phase 5C):
 * - KafkaWait gets its own handler (not an extension of graphRunnerCorrelationWaitHandler.ts)
 *   because Kafka extraction sources differ from HTTP webhook callback sources.
 * - Both handlers share ICorrelationStore abstractions but not handler code.
 * - The topic acts as the routing key (webhookPath equivalent) in the correlation store.
 * - Resume data is a KafkaConsumedMessage-shaped Record seeded into kafka.wait.* context keys.
 * - The actual Kafka consumer dispatch that calls correlationStore.resume() is Phase 5D work.
 */
import type { WorkflowNode, KafkaWaitNodeData } from '../types/workflow';
import type { NodeHandlerContext, PassedFlag, KafkaConsumedMessage } from './graphRunnerNodeHandlerContext';
import { serializeWorkflowState } from './workflowStateSerializer';
import {
  createAbortPromise,
  calculateSyntheticDelay,
  waitWithAbort,
  getMockPayload,
} from './correlationWaitHelpers';
import { extractPayloadVariables } from './graphRunnerHelpers';
import { KAFKA_WAIT_CONTEXT_KEYS } from './kafkaTriggerContracts';
import { toErrorMessage } from '../../../shared/utils/helpers';
import type { CorrelationWaitConfig } from './correlationStore';

// ── Resume data injection ─────────────────────────────────────────────────────

/**
 * Seeds kafka.wait.* context variables from resume data and extracts
 * any user-configured variables from the message body.
 */
function injectKafkaWaitPayload(
  resumeData: Record<string, unknown>,
  correlationId: string,
  data: KafkaWaitNodeData,
  ctx: NodeHandlerContext['ctx'],
  log: NodeHandlerContext['log'],
  label: string,
): void {
  const message = resumeData as Partial<KafkaConsumedMessage>;

  ctx.set(KAFKA_WAIT_CONTEXT_KEYS.topic,     String(message.topic     ?? ''));
  ctx.set(KAFKA_WAIT_CONTEXT_KEYS.partition,  String(message.partition ?? ''));
  ctx.set(KAFKA_WAIT_CONTEXT_KEYS.offset,     String(message.offset    ?? ''));
  ctx.set(KAFKA_WAIT_CONTEXT_KEYS.key,        String(message.key       ?? ''));
  ctx.set(KAFKA_WAIT_CONTEXT_KEYS.value,      String(message.value     ?? ''));
  ctx.set('kafka.wait.correlationId', correlationId);

  // Seed per-header keys
  if (message.headers && typeof message.headers === 'object') {
    for (const [name, val] of Object.entries(message.headers)) {
      ctx.set(`${KAFKA_WAIT_CONTEXT_KEYS.headerPrefix}.${name}`, String(val ?? ''));
    }
  }

  // Extract user-configured variables from the message body
  if (data.extractVariables && data.extractVariables.length > 0) {
    let parsedBody: unknown = {};
    const rawValue = String(message.value ?? '');
    try {
      if (rawValue.trim().startsWith('{') || rawValue.trim().startsWith('[')) {
        parsedBody = JSON.parse(rawValue);
      }
    } catch {
      // Non-JSON body: extractVariables will produce no matches
    }

    const extracted = extractPayloadVariables(parsedBody, data.extractVariables, ctx);
    for (const [name, strVal] of Object.entries(extracted)) {
      log({ prefix: '#', text: `[${label}] ${name} = ${strVal.length > 80 ? strVal.slice(0, 80) + '…' : strVal}` });
    }
  }
}

/**
 * Build a mock Kafka message payload for load test modes.
 * Uses node-level mock payload when provided; otherwise returns an empty-seeded message.
 */
function buildMockKafkaMessage(
  nodeId: string,
  runnerMockPayloads: Record<string, Record<string, unknown>> | undefined,
  nodeLevelPayload: Record<string, unknown> | undefined,
  topic: string,
): Record<string, unknown> {
  const override = getMockPayload(nodeId, runnerMockPayloads, nodeLevelPayload);
  // Provide sensible defaults so kafka.wait.* keys are always seeded
  return {
    topic:     topic,
    partition: 0,
    offset:    '0',
    key:       '',
    value:     '{}',
    headers:   {},
    timestamp: new Date().toISOString(),
    ...override,
  };
}

// ── CorrelationWaitConfig mapping ────────────────────────────────────────────

/**
 * Map KafkaWaitNodeData correlation config to CorrelationWaitConfig for the store.
 * The store uses this when routing incoming Kafka messages to the right paused entry.
 */
function buildKafkaCorrelationConfig(data: KafkaWaitNodeData): CorrelationWaitConfig {
  switch (data.correlationSource) {
    case 'body':
      return {
        correlationSource: 'body',
        correlationJsonPath: data.correlationJsonPath,
      };
    case 'header':
      return {
        correlationSource: 'header',
        correlationHeader: data.correlationHeader,
      };
    case 'key':
      return {
        correlationSource: 'key',
      };
    default:
      return { correlationSource: 'body' };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function handleKafkaWaitNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
  passed: PassedFlag,
): Promise<void> {
  const data = node.data as KafkaWaitNodeData;
  const label = hCtx.nodeLabel(nodeId);

  // ── Resolve correlation ID ──
  let correlationId = hCtx.ctx.resolve(data.correlationIdExpression);
  if (!correlationId) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] Correlation ID expression resolved to empty string` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Correlation ID expression resolved to empty string' });
    return;
  }

  const runnerConfig = hCtx.correlationWaitConfig;
  const effectiveMode = runnerConfig?.mode ?? data.loadTestBehavior?.mode ?? 'wait-for-real';

  // Make correlation ID unique per load-test iteration to prevent cross-iteration conflicts
  if (hCtx.loadTestMode && effectiveMode === 'synthetic-inject') {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    correlationId = `${correlationId}-${uniqueSuffix}`;
  }

  const waitStartTime = Date.now();

  // ── Load Test Mode: Auto-Resume ──
  if (hCtx.loadTestMode && effectiveMode === 'auto-resume') {
    const mockData = buildMockKafkaMessage(
      nodeId,
      runnerConfig?.mockPayloads,
      data.loadTestBehavior?.mockPayload,
      data.topic,
    );
    hCtx.log({ prefix: '*', text: `[${label}] Auto-resume mode — skipping wait, injecting mock Kafka message` });
    injectKafkaWaitPayload(mockData, correlationId, data, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__kwWaitDurationMs', String(Date.now() - waitStartTime));
    hCtx.ctx.set('__kwOutcome', 'matched');
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // ── Load Test Mode: Synthetic Inject (inline, no store) ──
  if (hCtx.loadTestMode && effectiveMode === 'synthetic-inject' && !hCtx.correlationStore) {
    const mockData = buildMockKafkaMessage(
      nodeId,
      runnerConfig?.mockPayloads,
      data.loadTestBehavior?.mockPayload,
      data.topic,
    );
    const actualDelay = calculateSyntheticDelay(runnerConfig?.syntheticDelayMs ?? 0, runnerConfig?.syntheticJitterMs);

    hCtx.log({ prefix: '*', text: `[${label}] Synthetic inject (inline) — waiting ${Math.round(actualDelay)}ms` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'paused', responseDetail: `Synthetic wait ${Math.round(actualDelay)}ms` });

    const completed = await waitWithAbort(actualDelay, hCtx.abortSignal);
    if (!completed) {
      hCtx.log({ prefix: '!', text: `[${label}] Synthetic inject aborted` });
      hCtx.ctx.set('__kwOutcome', 'cancelled');
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      return;
    }

    injectKafkaWaitPayload(mockData, correlationId, data, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__kwWaitDurationMs', String(Date.now() - waitStartTime));
    hCtx.ctx.set('__kwOutcome', 'matched');
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
    return;
  }

  // ── Normal Mode / Synthetic Inject with Store: Require correlation store ──
  if (!hCtx.correlationStore) {
    passed.value = false;
    hCtx.log({ prefix: '!', text: `[${label}] No correlation store available` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'No correlation store configured' });
    return;
  }

  const isSyntheticWithStore = hCtx.loadTestMode && effectiveMode === 'synthetic-inject';

  if (isSyntheticWithStore) {
    hCtx.log({ prefix: '*', text: `[${label}] Synthetic inject — pausing for background injector (correlationId=${correlationId})` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'paused', responseDetail: `Waiting for synthetic Kafka event` });
  } else {
    hCtx.log({ prefix: '*', text: `[${label}] Pausing — waiting for Kafka message on topic "${data.topic}" (correlationId=${correlationId})` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'paused', responseDetail: `Waiting for ${correlationId}` });
  }

  const pausedState = serializeWorkflowState(
    hCtx, nodeId,
    hCtx.executionId ?? `exec-${Date.now()}`,
    hCtx.workflowId ?? 'unknown',
    hCtx.startTime ?? Date.now(),
  );

  try {
    const abortPromise = createAbortPromise(hCtx.abortSignal);
    const correlationConfig = buildKafkaCorrelationConfig(data);
    const waitPromise = hCtx.correlationStore.pause(
      correlationId,
      data.topic,
      pausedState,
      data.timeoutMs,
      undefined, // no webhook filter for Kafka
      correlationConfig,
    );
    if (abortPromise) waitPromise.catch(() => {}); // prevent unhandled rejection if abort wins the race
    const resumeData = abortPromise
      ? await Promise.race([waitPromise, abortPromise])
      : await waitPromise;

    injectKafkaWaitPayload(resumeData, correlationId, data, hCtx.ctx, hCtx.log, label);
    hCtx.ctx.set('__kwResumeData', JSON.stringify(resumeData));
    hCtx.ctx.set('__kwWaitDurationMs', String(Date.now() - waitStartTime));
    hCtx.ctx.set('__kwOutcome', 'matched');
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());

    if (isSyntheticWithStore) {
      hCtx.log({ prefix: '*', text: `[${label}] Synthetic inject complete — workflow resumed` });
    } else {
      const timeStr = data.timeoutMs > 0 ? ` (within ${data.timeoutMs}ms timeout)` : '';
      hCtx.log({ prefix: '*', text: `[${label}] Resumed — Kafka message received${timeStr}` });
    }
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
    await hCtx.visitOutgoing(nodeId, hCtx.threadId);
  } catch (err) {
    hCtx.correlationStore?.cancel(correlationId);
    const isAbort = hCtx.abortSignal?.aborted || hCtx.debugController?.isStopped;
    if (isAbort) {
      hCtx.log({ prefix: '!', text: `[${label}] Kafka wait aborted` });
      hCtx.ctx.set('__kwOutcome', 'cancelled');
      hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
      hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: 'Aborted' });
      return;
    }
    passed.value = false;
    const msg = toErrorMessage(err);
    hCtx.ctx.set('__kwOutcome', 'timed_out');
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
    hCtx.log({ prefix: '!', text: `[${label}] ${msg}` });
    hCtx.callbacks.onNodeStateChange(nodeId, { state: 'fail', error: msg });
  }
}
