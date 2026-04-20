import { createContext, useContext } from 'react';
import type { NodeRunStatus } from '../../types/workflow';

/** Quick Test / run animation state keyed by React Flow node id — kept off `node.data` so HTTP config stays intact. */
export const WorkflowNodeRunContext = createContext<Record<string, NodeRunStatus>>({});

export function useWorkflowNodeRunStatus(nodeId: string): NodeRunStatus | undefined {
  return useContext(WorkflowNodeRunContext)[nodeId];
}
