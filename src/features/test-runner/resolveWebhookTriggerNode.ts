import type { Workflow, WorkflowNode } from '../workflow/types/workflow';

/** Detect if workflow starts with a Webhook Trigger node (Phase 7c). */
export function resolveWebhookTriggerNode(selectedWorkflow: Workflow | null): WorkflowNode | null {
  if (!selectedWorkflow) return null;
  const webhookNode = selectedWorkflow.nodes.find(n => n.type === 'webhook');
  if (!webhookNode) return null;

  // Must have outgoing edges (disconnected/orphaned webhook nodes don't count)
  const hasOutgoing = selectedWorkflow.edges.some(e => e.source === webhookNode.id);
  if (!hasOutgoing) return null;

  // Must have no real incoming edges (it's a trigger, not mid-workflow)
  // Ignore edges from orphaned Start nodes (Start nodes that only connect to this webhook)
  const incomingEdges = selectedWorkflow.edges.filter(e => e.target === webhookNode.id);
  const hasRealIncoming = incomingEdges.some(edge => {
    const sourceNode = selectedWorkflow.nodes.find(n => n.id === edge.source);
    if (!sourceNode) return false;
    if (sourceNode.type === 'start') {
      const startOtherOutgoing = selectedWorkflow.edges.filter(
        e => e.source === sourceNode.id && e.target !== webhookNode.id
      );
      if (startOtherOutgoing.length === 0) return false;
    }
    return true;
  });
  if (hasRealIncoming) return null;

  return webhookNode;
}
