/**
 * Handlers for trigger/start nodes: Start, WebhookTrigger, ScheduleTrigger.
 */
import type {
  WorkflowNode, StartNodeData, WebhookTriggerNodeData, ScheduleTriggerNodeData,
} from '../types/workflow';
import type { NodeHandlerContext } from './graphRunnerNodeHandlerContext';
import { extractPayloadVariables } from './graphRunnerHelpers';

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
