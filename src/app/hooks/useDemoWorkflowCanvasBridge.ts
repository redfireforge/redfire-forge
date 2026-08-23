import { useEffect } from 'react';
import type { WorkflowNodeData } from '@workflow/types/workflow';
import type { WorkflowRFNode } from '@workflow/utils/workflowNodeFactory';

/**
 * Demo-player bridge for live workflow canvas state.
 *   - `__wfPatchNodeDataByType(type, patch)` — merge `patch` into the first canvas node of `type`
 *   - `__wfPatchNodeDataById(id, patch)` — merge `patch` into a canvas node by id
 */
export function useDemoWorkflowCanvasBridge(
  nodes: WorkflowRFNode[],
  handleUpdateNode: (id: string, patch: Partial<WorkflowNodeData>) => void,
): void {
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;

    win.__wfPatchNodeDataByType = (
      nodeType: string,
      patch: Record<string, unknown>,
    ): boolean => {
      const node = nodes.find((n) => n.type === nodeType);
      if (!node) return false;
      handleUpdateNode(node.id, patch as Partial<WorkflowNodeData>);
      return true;
    };

    win.__wfPatchNodeDataById = (
      nodeId: string,
      patch: Record<string, unknown>,
    ): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      handleUpdateNode(nodeId, patch as Partial<WorkflowNodeData>);
      return true;
    };

    return () => {
      delete win.__wfPatchNodeDataByType;
      delete win.__wfPatchNodeDataById;
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

export function patchDemoWorkflowNodeDataById(
  nodeId: string,
  patch: Record<string, unknown>,
): boolean {
  const fn = (window as unknown as Record<string, unknown>).__wfPatchNodeDataById as
    | ((id: string, data: Record<string, unknown>) => boolean)
    | undefined;
  return fn?.(nodeId, patch) ?? false;
}
