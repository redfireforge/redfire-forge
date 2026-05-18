import { useState, useCallback } from 'react';
import {
  TARGET_FIELD_TEXT_PREFIX,
  REMAP_TEXT_PREFIX,
  parseJsonPayload,
} from '../utils/targetTreeHelpers';

interface UseTargetNodeDnDOptions {
  nodePath: string;
  isLeaf: boolean;
  mappingId: string | undefined;
  onDrop: (targetPath: string, sourcePath: string, sourceId: string) => void;
  onReorderField?: (fromPath: string, toPath: string) => void;
  onRemapDrop?: (targetPath: string, mappingId: string) => void;
  onTargetFieldDragStart?: (path: string) => void;
  onTargetFieldDragEnd?: () => void;
  onRemapDragStart?: (id: string) => void;
  onRemapDragEnd?: () => void;
  getDraggedTargetFieldPath?: () => string | null;
  getDraggedSource?: () => { path: string; sourceId: string } | null;
  getDraggedRemapId?: () => string | null;
}

export function useTargetNodeDnD({
  nodePath, isLeaf, mappingId, onDrop,
  onReorderField, onRemapDrop,
  onTargetFieldDragStart, onTargetFieldDragEnd,
  onRemapDragStart, onRemapDragEnd,
  getDraggedTargetFieldPath, getDraggedSource, getDraggedRemapId,
}: UseTargetNodeDnDOptions) {
  const [dragOver, setDragOver] = useState(false);

  const hasMapping = !!mappingId;
  const canRemapDrag = isLeaf && hasMapping && !!onRemapDrop;

  const handleFieldDragStart = useCallback((e: React.DragEvent) => {
    if (!isLeaf || !onReorderField || !nodePath) return;
    onTargetFieldDragStart?.(nodePath);
    e.dataTransfer.effectAllowed = 'move';
    const payload = JSON.stringify({ kind: 'target-field', path: nodePath });
    if (typeof e.dataTransfer.setData === 'function') {
      e.dataTransfer.setData('application/mapper-target-field', payload);
      e.dataTransfer.setData('text/plain', `${TARGET_FIELD_TEXT_PREFIX}${payload}`);
    }
  }, [isLeaf, onReorderField, nodePath, onTargetFieldDragStart]);

  const handleRemapDragStart = useCallback((e: React.DragEvent) => {
    if (!mappingId || !onRemapDrop) return;
    e.dataTransfer.effectAllowed = 'move';
    const payload = JSON.stringify({ kind: 'remap', mappingId });
    e.dataTransfer.setData('application/mapper-remap', payload);
    e.dataTransfer.setData('text/plain', `${REMAP_TEXT_PREFIX}${payload}`);
    onRemapDragStart?.(mappingId);
  }, [mappingId, onRemapDrop, onRemapDragStart]);

  const handleNodeDragStart = useCallback((e: React.DragEvent) => {
    if (isLeaf && onReorderField && nodePath) {
      handleFieldDragStart(e);
    } else if (canRemapDrag) {
      handleRemapDragStart(e);
    }
  }, [isLeaf, onReorderField, nodePath, handleFieldDragStart, canRemapDrag, handleRemapDragStart]);

  const handleNodeDragEnd = useCallback(() => {
    onTargetFieldDragEnd?.();
    onRemapDragEnd?.();
  }, [onTargetFieldDragEnd, onRemapDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!nodePath) return;
    e.preventDefault();
    const activeTargetPath = getDraggedTargetFieldPath?.();
    const hasSourceDrag = !!getDraggedSource?.();
    const hasRemapDrag = !!getDraggedRemapId?.();
    e.dataTransfer.dropEffect = (activeTargetPath && isLeaf && !hasSourceDrag) || hasRemapDrag ? 'move' : 'link';
    setDragOver(true);
  }, [isLeaf, nodePath, getDraggedTargetFieldPath, getDraggedSource, getDraggedRemapId]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!nodePath) return;
    e.preventDefault();
    setDragOver(true);
  }, [nodePath]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!nodePath) return;
      const getDragData = (type: string): string => {
        if (typeof e.dataTransfer.getData !== 'function') return '';
        try {
          return e.dataTransfer.getData(type) ?? '';
        } catch {
          return '';
        }
      };

      try {
        const targetFieldRaw = getDragData('application/mapper-target-field') || getDragData('text/plain');
        const targetFieldData = parseJsonPayload(targetFieldRaw) as { kind?: string; path?: string } | null;
        const fallbackTargetPath = getDraggedSource?.() ? null : (getDraggedTargetFieldPath?.() ?? null);
        const dragPath = targetFieldData?.kind === 'target-field' && typeof targetFieldData.path === 'string'
          ? targetFieldData.path
          : fallbackTargetPath;
        if (
          isLeaf
          && !!onReorderField
          && typeof dragPath === 'string'
          && dragPath !== nodePath
        ) {
          onReorderField?.(dragPath, nodePath);
          onTargetFieldDragEnd?.();
          return;
        }
      } catch { /* not a target-field reorder drop */ }

      try {
        const remapRaw = getDragData('application/mapper-remap') || getDragData('text/plain');
        const remapData = parseJsonPayload(remapRaw) as { kind?: string; mappingId?: string } | null;
        const fallbackRemapId = getDraggedRemapId?.() ?? null;
        const mid = remapData?.kind === 'remap' && typeof remapData.mappingId === 'string'
          ? remapData.mappingId
          : fallbackRemapId;
        if (typeof mid === 'string' && onRemapDrop) {
          onRemapDrop(nodePath, mid);
          return;
        }
      } catch { /* not a remap drop */ }

      try {
        const sourceRaw = getDragData('application/mapper-source') || getDragData('text/plain');
        const data = parseJsonPayload(sourceRaw) as { path?: string; sourceId?: string } | null;
        const fallbackSource = getDraggedSource?.() ?? null;
        const dropSourcePath = typeof data?.path === 'string' ? data.path : fallbackSource?.path;
        const dropSourceId = typeof data?.sourceId === 'string' ? data.sourceId : fallbackSource?.sourceId;
        if (typeof dropSourcePath === 'string' && typeof dropSourceId === 'string') {
          onDrop(nodePath, dropSourcePath, dropSourceId);
          onTargetFieldDragEnd?.();
        }
      } catch { /* ignore invalid drag data */ }
    },
    [nodePath, onDrop, isLeaf, onReorderField, getDraggedSource, getDraggedTargetFieldPath, onTargetFieldDragEnd, onRemapDrop, getDraggedRemapId],
  );

  const canDrag = isLeaf && !!(onReorderField || canRemapDrag);

  return {
    dragOver,
    canDrag,
    canRemapDrag,
    handleNodeDragStart,
    handleNodeDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
  };
}
