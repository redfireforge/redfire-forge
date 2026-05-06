import type { WorkflowRFNode } from './workflowNodeFactory';

/** Count unique workflow + per-http-step initial variable keys. */
export function countWorkflowDesignerVariables(
  workflowVariables: Record<string, string>,
  nodes: WorkflowRFNode[],
  nodeInitialVars: Record<string, Record<string, string>>,
): number {
  const s = new Set<string>(Object.keys(workflowVariables));
  for (const n of nodes) {
    if (n.type === 'http') {
      const iv = nodeInitialVars[n.id];
      if (iv) for (const k of Object.keys(iv)) s.add(k);
    }
  }
  return s.size;
}
