import { useCallback } from 'react';
import { useWorkflowInspect } from '../panels/WorkflowInspectContext';
import { useWorkflowNodeRunStatus, useWorkflowDebugStep } from '../panels/WorkflowNodeRunContext';

/**
 * Shared boilerplate hook for workflow canvas nodes.
 * Returns the run-state CSS class, debug step handler, and a click handler to open the config modal.
 */
export function useNodeBase(nodeId: string) {
  const { openNodeConfig, openStepDetail } = useWorkflowInspect();
  const rs = useWorkflowNodeRunStatus(nodeId);
  const debugStep = useWorkflowDebugStep();
  const stateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';

  const handleConfigure = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openNodeConfig(nodeId);
    },
    [nodeId, openNodeConfig],
  );

  return { rs, stateClass, debugStep, handleConfigure, openStepDetail };
}
