import { useCallback } from 'react';
import { useWorkflowInspect } from '../WorkflowInspectContext';
import { useWorkflowNodeRunStatus } from '../WorkflowNodeRunContext';

/**
 * Shared boilerplate hook for workflow canvas nodes.
 * Returns the run-state CSS class and a click handler to open the config modal.
 */
export function useNodeBase(nodeId: string) {
  const { openNodeConfig } = useWorkflowInspect();
  const rs = useWorkflowNodeRunStatus(nodeId);
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';

  const handleConfigure = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openNodeConfig(nodeId);
    },
    [nodeId, openNodeConfig],
  );

  return { stateClass, handleConfigure };
}
