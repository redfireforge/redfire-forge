import { createContext, useContext } from 'react';
import type { NodeRunStatus } from '../../types/workflow';

/** Quick Test / run animation state keyed by React Flow node id — kept off `node.data` so HTTP config stays intact. */
export const WorkflowNodeRunContext = createContext<Record<string, NodeRunStatus>>({});

export function useWorkflowNodeRunStatus(nodeId: string): NodeRunStatus | undefined {
  return useContext(WorkflowNodeRunContext)[nodeId];
}

/** Debug step callback — when set, nodes in 'paused' state show a Step button that calls this with the node id. */
export const WorkflowDebugStepContext = createContext<((nodeId: string) => void) | null>(null);

export function useWorkflowDebugStep(): ((nodeId: string) => void) | null {
  return useContext(WorkflowDebugStepContext);
}
