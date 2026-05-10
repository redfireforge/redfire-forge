import { useState, useRef, useCallback, useMemo } from 'react';
import type { Workflow, WorkflowFolder } from '../types/workflow';
import { buildFolderTree, getUnfiledWorkflows } from '../utils/workflowFolderTree';
import type { FolderTreeNode } from '../utils/workflowFolderTree';

interface UseMultiSelectArgs {
  workflows: Workflow[];
  selectedId: string | null;
  folders: WorkflowFolder[];
  foldersLoaded: boolean;
  onSelect: (id: string) => void;
}

export function useWorkflowMultiSelect({
  workflows, selectedId, folders, foldersLoaded, onSelect,
}: UseMultiSelectArgs) {
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);

  const flatWorkflowOrder = useMemo(() => {
    if (!foldersLoaded || folders.length === 0) return workflows.map((w) => w.id);
    const order: string[] = [];
    const tree = buildFolderTree(folders, workflows);
    const traverse = (nodes: FolderTreeNode[]) => {
      for (const node of nodes) {
        node.workflows.forEach((w) => order.push(w.id));
        traverse(node.children);
      }
    };
    traverse(tree);
    const unfld = getUnfiledWorkflows(folders, workflows);
    unfld.forEach((w) => order.push(w.id));
    return order;
  }, [workflows, folders, foldersLoaded]);

  const handleWorkflowClick = useCallback((e: React.MouseEvent, wfId: string) => {
    const isMetaKey = e.metaKey || e.ctrlKey;
    const isShiftKey = e.shiftKey;

    if (isMetaKey) {
      setMultiSelected((prev) => {
        const next = new Set(prev);
        if (next.has(wfId)) { next.delete(wfId); } else { next.add(wfId); }
        if (selectedId && !next.has(selectedId)) next.add(selectedId);
        return next;
      });
      lastClickedIdRef.current = wfId;
    } else if (isShiftKey && lastClickedIdRef.current) {
      const anchorIdx = flatWorkflowOrder.indexOf(lastClickedIdRef.current);
      const targetIdx = flatWorkflowOrder.indexOf(wfId);
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const from = Math.min(anchorIdx, targetIdx);
        const to = Math.max(anchorIdx, targetIdx);
        const rangeIds = flatWorkflowOrder.slice(from, to + 1);
        setMultiSelected(new Set(rangeIds));
      }
    } else {
      setMultiSelected(new Set());
      lastClickedIdRef.current = wfId;
      onSelect(wfId);
    }
  }, [selectedId, flatWorkflowOrder, onSelect]);

  const isMultiDrag = multiSelected.size > 1;
  const effectiveSelection = useMemo(() => {
    if (multiSelected.size > 0) return multiSelected;
    if (selectedId) return new Set([selectedId]);
    return new Set<string>();
  }, [multiSelected, selectedId]);

  return {
    multiSelected, setMultiSelected,
    handleWorkflowClick,
    isMultiDrag, effectiveSelection,
  };
}
