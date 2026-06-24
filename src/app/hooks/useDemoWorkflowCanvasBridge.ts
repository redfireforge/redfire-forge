import { useEffect } from 'react';
import type { WorkflowNodeData } from '../../features/workflow/types/workflow';
import type { WorkflowRFNode } from '../../features/workflow/utils/workflowNodeFactory';

/**
 * Demo-player bridge for live workflow canvas state.
 *   - `__wfPatchNodeDataByType(type, patch)` — merge `patch` into the first canvas node of `type`
 */
export function useDemoWorkflowCanvasBridge(
  nodes: WorkflowRFNode[],
  handleUpdateNode: (id: string, patch: Partial<WorkflowNodeData>) => void,
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = (
      nodeType: string,
      patch: Record<string, unknown>,
    ): boolean => {
      const node = nodes.find((n) => n.type === nodeType);
      if (!node) return false;
      handleUpdateNode(node.id, patch as Partial<WorkflowNodeData>);
      return true;
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType;
    };
  }, [nodes, handleUpdateNode]);
}

export function patchDemoWorkflowNodeDataByType(
  nodeType: string,
  patch: Record<string, unknown>,
): boolean {
  const fn = (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType as
    | ((type: string, data: Record<string, unknown>) => boolean)
    | undefined;
  return fn?.(nodeType, patch) ?? false;
}
