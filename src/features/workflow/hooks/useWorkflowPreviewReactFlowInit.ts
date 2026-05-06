import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Workflow } from '../types/workflow';
import { getAutoLayoutNodes } from '../utils/workflowAutoLayout';
import type { WorkflowRFEdge, WorkflowRFNode } from '../utils/workflowNodeFactory';

type MeasuredRfInstance = {
  getNodes: () => WorkflowRFNode[];
  getEdges: () => WorkflowRFEdge[];
  setNodes: (n: WorkflowRFNode[]) => void;
  fitView: (opts: { padding: number; maxZoom: number; duration: number }) => void;
};

/** onInit for React Flow: auto-layout preview workflows after node measurement. */
export function useWorkflowPreviewReactFlowInit(
  previewWorkflow: Workflow | null,
  setLaidOutId: Dispatch<SetStateAction<string | null>>,
) {
  return useCallback(
    (instance: MeasuredRfInstance) => {
      if (previewWorkflow) {
        const currentPreviewId = previewWorkflow.id;
        setTimeout(() => {
          const measuredNodes = instance.getNodes();
          const measuredEdges = instance.getEdges();
          if (measuredNodes.length > 0) {
            const laid = getAutoLayoutNodes(measuredNodes, measuredEdges);
            instance.setNodes(laid);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                instance.fitView({ padding: 0.15, maxZoom: 1, duration: 0 });
                setLaidOutId(currentPreviewId);
              });
            });
          } else {
            setLaidOutId(currentPreviewId);
          }
        }, 100);
      }
    },
    [previewWorkflow, setLaidOutId],
  );
}
