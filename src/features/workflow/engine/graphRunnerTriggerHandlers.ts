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
  if (data.extractVariables && data.extractVariables.length > 0) {
    try {
      const payload = JSON.parse(data.samplePayload || '{}');
      extractPayloadVariables(payload, data.extractVariables, hCtx.ctx);
    } catch {
      // Invalid JSON in samplePayload — skip extraction
    }
  }
  hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot());
  hCtx.log({ prefix: '*', text: `[Webhook Trigger] Seeded variables from sample payload` });
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
