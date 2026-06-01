/**
 * Handlers for trigger/start nodes: Start, WebhookTrigger, ScheduleTrigger, KafkaTrigger.
 */
import type {
  WorkflowNode, StartNodeData, WebhookTriggerNodeData, ScheduleTriggerNodeData,
  KafkaTriggerNodeData, KafkaConsumeHeaderFilterRow, KafkaConsumeJsonPathFilterRow,
} from '../types/workflow';
import type { NodeHandlerContext, KafkaConsumedMessage } from './graphRunnerNodeHandlerContext';
import { extractPayloadVariables } from './graphRunnerHelpers';
import { getByPath } from '../../../shared/utils/jsonPath';
import { KAFKA_TRIGGER_CONTEXT_KEYS } from './kafkaTriggerContracts';

export async function handleStartNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as StartNodeData;
  if (data.inputVariables) {
    for (const [k, v] of Object.entries(data.inputVariables)) {
      hCtx.ctx.set(k, v);
    }
    hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  }
  const varCount = Object.keys(data.inputVariables ?? {}).length;
  hCtx.log({ prefix: '*', text: `[Start] Initialised${varCount > 0 ? ` with ${varCount} variable(s)` : ''}` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

export async function handleWebhookNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as WebhookTriggerNodeData;
  
  // Use runtime webhook payload if provided, otherwise fall back to sample payload
  // Runtime payload is set by webhook load driver or actual webhook invocation
  const runtimePayload = hCtx.ctx.get('__webhookPayload');
  let payload: Record<string, unknown> = {};
  let payloadSource = 'sample';
  
  if (runtimePayload) {
    try {
      payload = typeof runtimePayload === 'string' ? JSON.parse(runtimePayload) : runtimePayload;
      payloadSource = 'runtime';
      // Clear the runtime payload after use
      hCtx.ctx.delete('__webhookPayload');
    } catch {
      // Invalid runtime payload, fall back to sample
      payload = JSON.parse(data.samplePayload || '{}');
    }
  } else if (data.samplePayload) {
    try {
      payload = JSON.parse(data.samplePayload);
    } catch {
      // Invalid sample payload
    }
  }
  
  // Store webhook input in context for trace capture (prefixed with __ to avoid conflicts)
  hCtx.ctx.set('__webhookInput', JSON.stringify(payload));
  hCtx.ctx.set('__webhookMethod', data.method);
  hCtx.ctx.set('__webhookPath', data.path);
  
  // Extract variables from the payload
  if (data.extractVariables && data.extractVariables.length > 0) {
    extractPayloadVariables(payload, data.extractVariables, hCtx.ctx);
  }
  
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[Webhook Trigger] Seeded variables from ${payloadSource} payload` });
  
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

export async function handleScheduleNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as ScheduleTriggerNodeData;
  const now = new Date();
  hCtx.ctx.set('triggerTime', now.toISOString());
  hCtx.ctx.set('triggerTimestamp', String(Math.floor(now.getTime() / 1000)));
  hCtx.ctx.set('triggerDate', now.toISOString().split('T')[0]);
  hCtx.ctx.set('triggerHour', String(now.getHours()));
  hCtx.ctx.set('triggerMinute', String(now.getMinutes()));
  if (data.inputVariables) {
    for (const [k, v] of Object.entries(data.inputVariables)) {
      hCtx.ctx.set(k, v);
    }
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[Schedule Trigger] Seeded trigger time variables` });
  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}

// ── KafkaTrigger ─────────────────────────────────────────────────────────────

/**
 * Test a Kafka message against the filter configuration of a KafkaTrigger node.
 *
 * Returns true if the message should be dispatched to a new workflow run
 * (i.e. all enabled filters pass). This is a pure pre-dispatch utility — it
 * is called by subscription managers before starting a workflow execution, not
 * inside the graph-runner node handler itself.
 *
 * Filter semantics:
 * - `keyRegex`      — the message key must match the regex (invalid regex is silently skipped)
 * - `headerFilters` — each enabled filter: the named header must be present and equal the expected value
 * - `jsonPathFilters` — each enabled filter: the JSON path must exist in the body; if `expectedValue`
 *   is set, the resolved value must equal it (string comparison)
 */
export function matchesKafkaMessageFilters(
  message: KafkaConsumedMessage,
  keyRegex?: string,
  headerFilters?: KafkaConsumeHeaderFilterRow[],
  jsonPathFilters?: KafkaConsumeJsonPathFilterRow[],
): boolean {
  // Key regex filter
  if (keyRegex?.trim()) {
    try {
      if (!new RegExp(keyRegex).test(message.key ?? '')) return false;
    } catch {
      // Invalid regex — skip this filter rather than blocking all messages
    }
  }

  // Header equality filters
  if (headerFilters) {
    for (const f of headerFilters) {
      const trimmedKey = f.key.trim();
      if (!f.enabled || !trimmedKey) continue;
      const actual = message.headers?.[trimmedKey] ?? '';
      if (actual !== f.value) return false;
    }
  }

  // JSON path value filters (lazy-parse the body once on first match attempt)
  if (jsonPathFilters) {
    let parsed: unknown = null;
    let parsedAttempted = false;
    for (const f of jsonPathFilters) {
      const trimmedPath = f.jsonPath.trim();
      if (!f.enabled || !trimmedPath) continue;
      if (!parsedAttempted) {
        parsedAttempted = true;
        try { parsed = JSON.parse(message.value); } catch { /* non-JSON value */ }
      }
      const actual = getByPath(parsed, trimmedPath);
      if (actual === undefined) return false;
      if (f.expectedValue !== undefined && String(actual) !== f.expectedValue) return false;
    }
  }

  return true;
}

/**
 * Handler for `kafkaTrigger` nodes.
 *
 * Reads the incoming Kafka message from the `__kafkaTriggerMessage` context key
 * (a JSON-encoded `KafkaConsumedMessage` set by the subscription dispatcher before
 * the run starts), seeds `kafka.trigger.*` variables from it, extracts any
 * user-defined JSON-path variables, and advances execution.
 *
 * Falls back gracefully when `__kafkaTriggerMessage` is absent (e.g. manual/design-time
 * test runs): all seeded keys receive empty strings so downstream nodes can still execute.
 */
export async function handleKafkaTriggerNode(
  nodeId: string,
  node: WorkflowNode,
  hCtx: NodeHandlerContext,
): Promise<void> {
  const data = node.data as KafkaTriggerNodeData;

  // Read and clear the runtime Kafka message pre-set by the subscription dispatcher.
  const rawMessage = hCtx.ctx.get('__kafkaTriggerMessage');
  let message: KafkaConsumedMessage | null = null;
  let messageSource = 'none';

  if (rawMessage) {
    try {
      message = typeof rawMessage === 'string'
        ? (JSON.parse(rawMessage) as KafkaConsumedMessage)
        : (rawMessage as KafkaConsumedMessage);
      messageSource = 'runtime';
    } catch {
      // Unparseable __kafkaTriggerMessage — proceed with empty seeds
    }
    // Always clear regardless of parse outcome
    hCtx.ctx.delete('__kafkaTriggerMessage');
  }

  // Seed kafka.trigger.* context variables
  hCtx.ctx.set(KAFKA_TRIGGER_CONTEXT_KEYS.topic,     message?.topic ?? data.topic ?? '');
  hCtx.ctx.set(KAFKA_TRIGGER_CONTEXT_KEYS.partition, message?.partition !== undefined ? String(message.partition) : '');
  hCtx.ctx.set(KAFKA_TRIGGER_CONTEXT_KEYS.offset,    message?.offset ?? '');
  hCtx.ctx.set(KAFKA_TRIGGER_CONTEXT_KEYS.key,       message?.key ?? '');
  hCtx.ctx.set(KAFKA_TRIGGER_CONTEXT_KEYS.value,     message?.value ?? '');

  // Seed kafka.trigger.header.<name> for each message header
  if (message?.headers) {
    for (const [headerName, headerValue] of Object.entries(message.headers)) {
      hCtx.ctx.set(`${KAFKA_TRIGGER_CONTEXT_KEYS.headerPrefix}.${headerName}`, headerValue);
    }
  }

  // Extract user-defined variables from the message body via JSON path
  if (message?.value && data.extractVariables && data.extractVariables.length > 0) {
    try {
      const parsed = JSON.parse(message.value);
      extractPayloadVariables(parsed, data.extractVariables, hCtx.ctx);
    } catch {
      // Non-JSON message value — skip JSON path extraction
    }
  }

  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[Kafka Trigger] Seeded variables from ${messageSource} Kafka message` });

  hCtx.callbacks.onNodeStateChange(nodeId, { state: 'pass' });
  await hCtx.visitOutgoing(nodeId, hCtx.threadId);
}
