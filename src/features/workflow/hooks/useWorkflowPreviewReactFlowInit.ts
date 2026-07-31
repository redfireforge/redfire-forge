import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Workflow } from '../types/workflow';
import { getAutoLayoutNodes } from '../utils/workflowAutoLayout';
import type { WorkflowRFEdge, WorkflowRFNode } from '../utils/workflowNodeFactory';

type MeasuredRfInstance = {
  getNodes: () => WorkflowRFNode[];
  getEdges: () => WorkflowRFEdge[];
  setNodes: (n: WorkflowRFNode[]) => void;
  fitView: (opts: { padding: number; maxZoom: number; duration: number }) => void;
  setViewport: (vp: { x: number; y: number; zoom: number }, opts?: { duration: number }) => void;
};

/**
 * onInit for React Flow canvas.
 *
 * - Preview workflow → auto-layout + fit
 * - Saved viewport   → restore exact zoom + pan
 * - First load        → auto-layout + fit (same as Results Explorer)
 */
export function useWorkflowPreviewReactFlowInit(
  previewWorkflow: Workflow | null,
  setLaidOutId: Dispatch<SetStateAction<string | null>>,
) {
  return useCallback(
    (instance: MeasuredRfInstance) => {
      const applyFitView = (padding: number, duration: number) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            instance.fitView({ padding, maxZoom: 1, duration });
          });
        });
      };

      if (previewWorkflow) {
        const currentPreviewId = previewWorkflow.id;
        setTimeout(() => {
          const measuredNodes = instance.getNodes();
          const measuredEdges = instance.getEdges();
          if (measuredNodes.length > 0) {
            const laid = getAutoLayoutNodes(measuredNodes, measuredEdges);
            instance.setNodes(laid);
            applyFitView(0.15, 0);
            setLaidOutId(currentPreviewId);
          } else {
            setLaidOutId(currentPreviewId);
          }
        }, 150);
      } else {
        setTimeout(() => {
          const measuredNodes = instance.getNodes();
          const measuredEdges = instance.getEdges();
          if (measuredNodes.length > 0) {
            const laid = getAutoLayoutNodes(measuredNodes, measuredEdges);
            instance.setNodes(laid);
            applyFitView(0.1, 200);
          }
        }, 150);
      }
    },
    [previewWorkflow, setLaidOutId],
  );
}
