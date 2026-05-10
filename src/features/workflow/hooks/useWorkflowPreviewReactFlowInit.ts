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
  selectedWorkflow: Workflow | null,
  setLaidOutId: Dispatch<SetStateAction<string | null>>,
) {
  return useCallback(
    (instance: MeasuredRfInstance) => {
      if (previewWorkflow) {
        // Preview: auto-layout then fit
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
      } else if (selectedWorkflow?.savedViewport) {
        // Saved layout: restore exact viewport
        setTimeout(() => {
          requestAnimationFrame(() => {
            instance.setViewport(selectedWorkflow.savedViewport!, { duration: 0 });
          });
        }, 100);
      } else {
        // First load (no saved layout): auto-layout + fit
        setTimeout(() => {
          const measuredNodes = instance.getNodes();
          const measuredEdges = instance.getEdges();
          if (measuredNodes.length > 0) {
            const laid = getAutoLayoutNodes(measuredNodes, measuredEdges);
            instance.setNodes(laid);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                instance.fitView({ padding: 0.1, maxZoom: 1, duration: 200 });
              });
            });
          }
        }, 100);
      }
    },
    [previewWorkflow, selectedWorkflow, setLaidOutId],
  );
}
