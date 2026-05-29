import { useCallback, useState, useEffect } from 'react';
import { useWorkflowInspect } from '../panels/WorkflowInspectContext';
import { useWorkflowNodeRunStatus, useWorkflowDebugStep } from '../panels/WorkflowNodeRunContext';
import { isNodeNew } from '../panels/WorkflowNewNodeContext';

/**
 * Shared boilerplate hook for workflow canvas nodes.
 * Returns the run-state CSS class, debug step handler, and a click handler to open the config modal.
 */
export function useNodeBase(nodeId: string) {
  const { openNodeConfig, openStepDetail } = useWorkflowInspect();
  const rs = useWorkflowNodeRunStatus(nodeId);
  const debugStep = useWorkflowDebugStep();

  const [isNew, setIsNew] = useState(() => isNodeNew(nodeId));

  useEffect(() => {
    if (!isNew) return;
    const timer = setTimeout(() => setIsNew(false), 350);
    return () => clearTimeout(timer);
  }, [isNew]);

  const runStateClass = rs?.state && rs.state !== 'idle' ? `wf-node-${rs.state}` : '';
  const newClass = isNew ? 'wf-node-new' : '';
  const stateClass = [runStateClass, newClass].filter(Boolean).join(' ');

  const handleConfigure = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openNodeConfig(nodeId);
    },
    [nodeId, openNodeConfig],
  );

  return { rs, stateClass, debugStep, handleConfigure, openStepDetail };
}
