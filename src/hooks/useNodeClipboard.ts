import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '@xyflow/react';
import type { WorkflowNodeType, WorkflowNodeData } from '../types/workflow';
import type { ToastApi } from '../components/workflow/WorkflowToastProvider';

interface ClipboardData {
  type: WorkflowNodeType;
  data: WorkflowNodeData;
}

interface UseNodeClipboardOpts {
  getNodes: () => Node[];
  selectedNodeId: string | null;
  toast: ToastApi;
}

/**
 * Manages the copy/paste clipboard for workflow nodes.
 * The actual node creation is done by the caller via `createNodeFromClipboard`.
 */
export function useNodeClipboard({ getNodes, selectedNodeId, toast }: UseNodeClipboardOpts) {
  const [copiedNodeData, setCopiedNodeData] = useState<ClipboardData | null>(null);

  /** Copy the currently selected node to clipboard. */
  const copyNode = useCallback((nodeId?: string) => {
    const id = nodeId ?? selectedNodeId;
    if (!id) return;
    const node = getNodes().find((n) => n.id === id);
    if (!node) return;
    const data: ClipboardData = {
      type: node.type as WorkflowNodeType,
      data: structuredClone(node.data) as WorkflowNodeData,
    };
    setCopiedNodeData(data);
    toast.show('info', 'Node copied', `"${(node.data as { label?: string }).label ?? node.type}"`);
  }, [selectedNodeId, getNodes, toast]);

  /**
   * Build a new node from clipboard data for pasting.
   * Returns null if nothing is copied.
   */
  const buildPasteNode = useCallback((position: { x: number; y: number }): Node | null => {
    if (!copiedNodeData) return null;
    return {
      id: uuidv4(),
      type: copiedNodeData.type,
      position,
      data: {
        ...structuredClone(copiedNodeData.data),
        label: `${(copiedNodeData.data as { label?: string }).label ?? copiedNodeData.type} (copy)`,
      } as WorkflowNodeData,
    };
  }, [copiedNodeData]);

  /**
   * Build a new node by duplicating a source node.
   * Returns null if the source node is not found.
   */
  const buildDuplicateNode = useCallback((nodeId?: string): Node | null => {
    const id = nodeId ?? selectedNodeId;
    if (!id) return null;
    const node = getNodes().find((n) => n.id === id);
    if (!node) return null;
    return {
      id: uuidv4(),
      type: node.type as WorkflowNodeType,
      position: { x: (node.position?.x ?? 0) + 40, y: (node.position?.y ?? 0) + 80 },
      data: {
        ...structuredClone(node.data),
        label: `${(node.data as { label?: string }).label ?? node.type} (copy)`,
      } as WorkflowNodeData,
    };
  }, [selectedNodeId, getNodes]);

  return { copiedNodeData, copyNode, buildPasteNode, buildDuplicateNode };
}
