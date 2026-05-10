import { useState, useRef, useCallback } from 'react';
import type { Workflow, WorkflowFolder } from '../types/workflow';
import { isDescendant } from '../utils/workflowFolderTree';

export type DropZone = 'above' | 'inside' | 'below';

export interface DragState {
  type: 'workflow' | 'folder';
  id: string;
}

export interface DropTarget {
  type: 'workflow' | 'folder' | 'unfiled';
  id: string;
  zone: DropZone;
}

interface UseSidebarDnDArgs {
  folders: WorkflowFolder[];
  workflows: Workflow[];
  multiSelected: Set<string>;
  setMultiSelected: (s: Set<string>) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onSetFolderCollapsed?: (folderId: string, collapsed: boolean) => void;
  onMoveWorkflowToFolder?: (workflowId: string, folderId: string | null) => void;
  onMoveWorkflowsToFolder?: (workflowIds: string[], folderId: string | null) => void;
  onMoveFolder?: (folderId: string, newParentId: string | null, newOrder: number) => void;
}

export function computeDropZone(e: React.DragEvent, targetType: 'folder' | 'workflow'): DropZone {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;
  if (targetType === 'folder') {
    if (y < height * 0.25) return 'above';
    if (y > height * 0.75) return 'below';
    return 'inside';
  }
  return y < height * 0.5 ? 'above' : 'below';
}

export function useWorkflowSidebarDnD({
  folders, workflows, multiSelected, setMultiSelected, listRef,
  onSetFolderCollapsed, onMoveWorkflowToFolder, onMoveWorkflowsToFolder, onMoveFolder,
}: UseSidebarDnDArgs) {
  const [dragSource, setDragSource] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoExpandFolderRef = useRef<string | null>(null);
  const edgeScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearDragState = useCallback(() => {
    setDragSource(null);
    setDropTarget(null);
    if (autoExpandTimerRef.current) { clearTimeout(autoExpandTimerRef.current); autoExpandTimerRef.current = null; }
    autoExpandFolderRef.current = null;
    if (edgeScrollTimerRef.current) { clearInterval(edgeScrollTimerRef.current); edgeScrollTimerRef.current = null; }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, type: 'workflow' | 'folder', id: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';

    if (type === 'workflow' && multiSelected.size > 1 && multiSelected.has(id)) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, multiIds: [...multiSelected] }));
    } else {
      if (type === 'workflow') setMultiSelected(new Set());
      e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
    }
    setDragSource({ type, id });
  }, [multiSelected, setMultiSelected]);

  const handleDragOver = useCallback((e: React.DragEvent, targetType: 'workflow' | 'folder', targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSource) return;
    if (dragSource.type === 'folder' && dragSource.id === targetId) {
      e.dataTransfer.dropEffect = 'none';
      setDropTarget(null);
      return;
    }
    if (dragSource.type === 'folder' && targetType === 'folder' && isDescendant(dragSource.id, targetId, folders)) {
      e.dataTransfer.dropEffect = 'none';
      setDropTarget(null);
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    const zone = computeDropZone(e, targetType);
    setDropTarget((prev) => {
      if (prev?.id === targetId && prev?.zone === zone) return prev;
      return { type: targetType, id: targetId, zone };
    });

    if (targetType === 'folder' && zone === 'inside') {
      const folder = folders.find((f) => f.id === targetId);
      if (folder?.collapsed) {
        if (autoExpandFolderRef.current !== targetId) {
          if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current);
          autoExpandFolderRef.current = targetId;
          autoExpandTimerRef.current = setTimeout(() => {
            onSetFolderCollapsed?.(targetId, false);
            autoExpandTimerRef.current = null;
            autoExpandFolderRef.current = null;
          }, 500);
        }
      }
    } else {
      if (autoExpandTimerRef.current) { clearTimeout(autoExpandTimerRef.current); autoExpandTimerRef.current = null; }
      autoExpandFolderRef.current = null;
    }

    const listEl = listRef.current;
    if (listEl) {
      const listRect = listEl.getBoundingClientRect();
      const edgeZone = 30;
      const scrollSpeed = 4;
      if (e.clientY < listRect.top + edgeZone) {
        if (!edgeScrollTimerRef.current) {
          edgeScrollTimerRef.current = setInterval(() => { listEl.scrollTop -= scrollSpeed; }, 16);
        }
      } else if (e.clientY > listRect.bottom - edgeZone) {
        if (!edgeScrollTimerRef.current) {
          edgeScrollTimerRef.current = setInterval(() => { listEl.scrollTop += scrollSpeed; }, 16);
        }
      } else if (edgeScrollTimerRef.current) {
        clearInterval(edgeScrollTimerRef.current);
        edgeScrollTimerRef.current = null;
      }
    }
  }, [dragSource, folders, onSetFolderCollapsed, listRef]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    setDropTarget(null);
  }, []);

  const resolveTargetFolderId = useCallback((tgtType: string, tgtId: string, zone: DropZone): string | null => {
    if (tgtType === 'folder' && zone === 'inside') return tgtId;
    if (tgtType === 'folder' && (zone === 'above' || zone === 'below')) {
      return folders.find((f) => f.id === tgtId)?.parentId ?? null;
    }
    if (tgtType === 'workflow') {
      return workflows.find((w) => w.id === tgtId)?.folderId ?? null;
    }
    return null;
  }, [folders, workflows]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSource || !dropTarget) { clearDragState(); return; }

    const { type: srcType, id: srcId } = dragSource;
    const { type: tgtType, id: tgtId, zone } = dropTarget;

    if (srcType === 'workflow') {
      const destFolderId = resolveTargetFolderId(tgtType, tgtId, zone);
      const draggedIds = multiSelected.size > 1 && multiSelected.has(srcId) ? [...multiSelected] : [srcId];

      if (draggedIds.length > 1 && onMoveWorkflowsToFolder) {
        onMoveWorkflowsToFolder(draggedIds, destFolderId);
      } else {
        onMoveWorkflowToFolder?.(srcId, destFolderId);
      }
      setMultiSelected(new Set());
    } else if (srcType === 'folder' && onMoveFolder) {
      if (tgtType === 'folder' && zone === 'inside') {
        const siblings = folders.filter((f) => f.parentId === tgtId);
        onMoveFolder(srcId, tgtId, siblings.length);
      } else if (tgtType === 'folder' && (zone === 'above' || zone === 'below')) {
        const tgtFolder = folders.find((f) => f.id === tgtId);
        const parentId = tgtFolder?.parentId ?? null;
        const siblings = folders.filter((f) => (f.parentId ?? null) === parentId && f.id !== srcId).sort((a, b) => a.order - b.order);
        const tgtIdx = siblings.findIndex((f) => f.id === tgtId);
        const insertIdx = zone === 'above' ? tgtIdx : tgtIdx + 1;
        onMoveFolder(srcId, parentId, Math.max(0, insertIdx));
      } else if (tgtType === 'unfiled') {
        const rootSiblings = folders.filter((f) => !f.parentId && f.id !== srcId);
        onMoveFolder(srcId, null, rootSiblings.length);
      }
    }

    clearDragState();
  }, [dragSource, dropTarget, folders, multiSelected, onMoveWorkflowToFolder, onMoveWorkflowsToFolder, onMoveFolder, clearDragState, resolveTargetFolderId, setMultiSelected]);

  const handleDragEnd = useCallback(() => { clearDragState(); }, [clearDragState]);

  const getDropClass = (targetType: 'workflow' | 'folder', targetId: string): string => {
    if (!dropTarget || dropTarget.id !== targetId || dropTarget.type !== targetType) return '';
    if (dropTarget.zone === 'above') return 'wf-drop-above';
    if (dropTarget.zone === 'below') return 'wf-drop-below';
    if (dropTarget.zone === 'inside') return 'wf-drop-inside';
    return '';
  };

  return {
    dragSource, dropTarget, setDropTarget,
    handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd,
    clearDragState, getDropClass, resolveTargetFolderId,
  };
}
