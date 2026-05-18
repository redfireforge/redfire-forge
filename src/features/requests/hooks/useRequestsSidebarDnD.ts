import { useState, useCallback, useRef } from 'react';
import type { RequestCollection } from '../../../shared/types';

export type DragItem =
  | { kind: 'request'; reqId: string; colId: string }
  | { kind: 'folder'; folderId: string; colId: string }
  | { kind: 'collection'; colId: string }
  | null;

type OnMoveRequest = (colId: string, reqId: string, targetFolderId: string | null, beforeReqId?: string) => void;
type OnMoveRequestToCollection = (
  srcColId: string,
  reqId: string,
  destColId: string,
  destFolderId: string | null,
) => void;
type OnMoveFolderTo = (colId: string, folderId: string, targetParentFolderId: string | null) => void;
type OnMoveFolderToCollection = (
  srcColId: string,
  folderId: string,
  destColId: string,
  destParentFolderId: string | null,
) => void;
type OnMergeCollectionInto = (srcColId: string, destColId: string) => void;
type OnMoveToGroup = (colId: string, targetGroupId: string | undefined) => void;

export interface UseRequestsSidebarDnDParams {
  collections: RequestCollection[];
  onMoveRequest: OnMoveRequest;
  onMoveRequestToCollection: OnMoveRequestToCollection;
  onMoveFolderTo: OnMoveFolderTo;
  onMoveFolderToCollection: OnMoveFolderToCollection;
  onMergeCollectionInto: OnMergeCollectionInto;
  onMoveToGroup: OnMoveToGroup;
}

export function useRequestsSidebarDnD({
  collections,
  onMoveRequest,
  onMoveRequestToCollection,
  onMoveFolderTo,
  onMoveFolderToCollection,
  onMergeCollectionInto,
  onMoveToGroup,
}: UseRequestsSidebarDnDParams) {
  const [dragItem, _setDragItem] = useState<DragItem>(null);
  const dragItemRef = useRef<DragItem>(null);
  const setDragItem = useCallback((v: DragItem) => {
    dragItemRef.current = v;
    _setDragItem(v);
  }, []);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropInsert, setDropInsert] = useState<{ beforeReqId: string; folderId: string | null } | null>(null);
  const autoExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCollectionDragStart = useCallback((e: React.DragEvent, colId: string) => {
    setDragItem({ kind: 'collection', colId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }, [setDragItem]);

  const handleReqDragStart = useCallback((e: React.DragEvent, colId: string, reqId: string) => {
    setDragItem({ kind: 'request', reqId, colId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', reqId);
  }, [setDragItem]);

  const handleFolderDragStart = useCallback((e: React.DragEvent, colId: string, folderId: string) => {
    setDragItem({ kind: 'folder', folderId, colId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', folderId);
  }, [setDragItem]);

  const handleDragOver = useCallback((e: React.DragEvent, _targetId: string) => {
    if (!dragItemRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(_targetId);
  }, []);

  const handleDragLeave = useCallback(() => setDropTarget(null), []);

  const handleDrop = useCallback((e: React.DragEvent, colId: string, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const di = dragItemRef.current;
    if (!di) return;
    if (di.kind === 'collection') {
      const targetCol = collections.find(c => c.id === colId);
      if (targetCol?.mode === 'group') {
        if (di.colId !== colId) onMoveToGroup(di.colId, colId);
      } else if (di.colId !== colId) {
        onMergeCollectionInto(di.colId, colId);
      }
    } else if (di.kind === 'request') {
      if (di.colId === colId) {
        onMoveRequest(colId, di.reqId, targetFolderId);
      } else {
        onMoveRequestToCollection(di.colId, di.reqId, colId, targetFolderId);
      }
    } else if (di.kind === 'folder') {
      if (di.colId === colId && targetFolderId === null) {
        onMoveFolderTo(colId, di.folderId, null);
      } else if (di.colId !== colId) {
        onMoveFolderToCollection(di.colId, di.folderId, colId, targetFolderId);
      }
    }
    setDragItem(null);
    setDropTarget(null);
  }, [collections, onMoveFolderTo, onMoveFolderToCollection, onMergeCollectionInto, onMoveRequest, onMoveRequestToCollection, onMoveToGroup, setDragItem]);

  const handleGroupDrop = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const di = dragItemRef.current;
    if (!di) return;
    if (di.kind === 'collection' && di.colId !== groupId) {
      onMoveToGroup(di.colId, groupId);
    }
    setDragItem(null);
    setDropTarget(null);
  }, [onMoveToGroup, setDragItem]);

  const handleFolderDrop = useCallback((e: React.DragEvent, colId: string, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const di = dragItemRef.current;
    if (!di) return;
    if (di.kind === 'request') {
      if (di.colId === colId) {
        onMoveRequest(colId, di.reqId, targetFolderId);
      } else {
        onMoveRequestToCollection(di.colId, di.reqId, colId, targetFolderId);
      }
    } else if (di.kind === 'folder' && di.folderId !== targetFolderId) {
      if (di.colId === colId) {
        onMoveFolderTo(colId, di.folderId, targetFolderId);
      } else {
        onMoveFolderToCollection(di.colId, di.folderId, colId, targetFolderId);
      }
    }
    setDragItem(null);
    setDropTarget(null);
  }, [onMoveFolderTo, onMoveFolderToCollection, onMoveRequest, onMoveRequestToCollection, setDragItem]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDropTarget(null);
    setDropInsert(null);
    if (autoExpandTimer.current) {
      clearTimeout(autoExpandTimer.current);
      autoExpandTimer.current = null;
    }
  }, [setDragItem]);

  const handleReqDragOver = useCallback((e: React.DragEvent, _colId: string, reqId: string, folderId: string | undefined) => {
    const di = dragItemRef.current;
    if (!di || di.kind !== 'request') return;
    if (di.reqId === reqId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      setDropInsert({ beforeReqId: reqId, folderId: folderId ?? null });
    } else {
      setDropInsert({ beforeReqId: `${reqId}:after`, folderId: folderId ?? null });
    }
  }, []);

  const handleReqDrop = useCallback((e: React.DragEvent, colId: string, folderId: string | undefined, requests: { id: string }[]) => {
    e.preventDefault();
    e.stopPropagation();
    const di = dragItemRef.current;
    if (!di || di.kind !== 'request') return;
    const ins = dropInsert;
    setDragItem(null);
    setDropTarget(null);
    setDropInsert(null);
    if (!ins) {
      if (di.colId === colId) onMoveRequest(colId, di.reqId, folderId ?? null);
      else onMoveRequestToCollection(di.colId, di.reqId, colId, folderId ?? null);
      return;
    }
    const isAfter = ins.beforeReqId.endsWith(':after');
    const actualId = isAfter ? ins.beforeReqId.replace(':after', '') : ins.beforeReqId;
    const idx = requests.findIndex(r => r.id === actualId);
    const nextReq = isAfter ? requests[idx + 1] : requests[idx];
    const beforeId = nextReq?.id;
    if (di.colId === colId) onMoveRequest(colId, di.reqId, folderId ?? null, beforeId);
    else onMoveRequestToCollection(di.colId, di.reqId, colId, folderId ?? null);
  }, [dropInsert, onMoveRequest, onMoveRequestToCollection, setDragItem]);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const di = dragItemRef.current;
    if (!di || di.kind !== 'collection') return;
    const col = collections.find(c => c.id === di.colId);
    if (col?.groupId) onMoveToGroup(di.colId, undefined);
    setDragItem(null);
    setDropTarget(null);
  }, [collections, onMoveToGroup, setDragItem]);

  return {
    dragItem,
    dragItemRef,
    dropTarget,
    setDropTarget,
    dropInsert,
    setDropInsert,
    autoExpandTimer,
    setDragItem,
    handleCollectionDragStart,
    handleReqDragStart,
    handleFolderDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleGroupDrop,
    handleFolderDrop,
    handleDragEnd,
    handleReqDragOver,
    handleReqDrop,
    handleRootDrop,
  };
}
