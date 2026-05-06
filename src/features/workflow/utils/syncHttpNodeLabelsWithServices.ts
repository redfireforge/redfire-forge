import type { WorkflowRFNode } from './workflowNodeFactory';
import type { WorkflowService } from '../types/workflow';
import { isHttpWorkflowNode } from './workflowVariableHints';

export function syncHttpNodeLabelsWithServices(
  nodes: WorkflowRFNode[],
  services: WorkflowService[],
): WorkflowRFNode[] {
  const svcMap = new Map(services.map((s) => [s.id, s.name]));
  return nodes.map((n) => {
    if (!isHttpWorkflowNode(n) || !n.data.serviceId) return n;
    const newName = svcMap.get(n.data.serviceId);
    if (newName && n.data.label !== newName) {
      return { ...n, data: { ...n.data, label: newName } };
    }
    return n;
  });
}
