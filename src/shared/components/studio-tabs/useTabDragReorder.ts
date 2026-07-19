import { useCallback, useState, type DragEvent } from 'react';
import { computeDropIndex } from './computeDropIndex';

export interface TabDragReorderState {
  draggingTabId: string | null;
  dragOverTabId: string | null;
  dropSide: 'before' | 'after' | null;
}

export interface UseTabDragReorderOptions {
  /** MIME type for the drag data transfer — must be unique per studio to prevent cross-studio drops. */
  mimeType: string;
  /** Whether rename editing is active (blocks drag start). */
  isEditing: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export interface UseTabDragReorderReturn extends TabDragReorderState {
  handleDragStart: (e: DragEvent<HTMLElement>, index: number, tabId: string) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: DragEvent<HTMLElement>, tabId: string) => void;
  handleDragLeave: (e: DragEvent<HTMLElement>, tabId: string) => void;
  handleDrop: (e: DragEvent<HTMLElement>, targetIndex: number) => void;
  dropClassFor: (tabId: string) => string;
}

export function useTabDragReorder({
  mimeType,
  isEditing,
  onReorder,
}: UseTabDragReorderOptions): UseTabDragReorderReturn {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLElement>, index: number, tabId: string) => {
      if (isEditing) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(mimeType, String(index));
      setDraggingTabId(tabId);
    },
    [isEditing, mimeType],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDropSide(null);
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>, tabId: string) => {
      if (!e.dataTransfer.types.includes(mimeType)) return;
      if (tabId === draggingTabId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      setDragOverTabId(tabId);
      setDropSide(e.clientX < midX ? 'before' : 'after');
    },
    [draggingTabId, mimeType],
  );

  const handleDragLeave = useCallback(
    (_e: DragEvent<HTMLElement>, tabId: string) => {
      setDragOverTabId((prev) => {
        if (prev === tabId) {
          setDropSide(null);
          return null;
        }
        return prev;
      });
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>, targetIndex: number) => {
      e.preventDefault();
      const fromStr = e.dataTransfer.getData(mimeType);
      if (!fromStr) return;
      const fromIndex = parseInt(fromStr, 10);
      if (Number.isNaN(fromIndex)) return;

      setDragOverTabId(null);
      setDropSide(null);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const toIndex = computeDropIndex(fromIndex, targetIndex, e.clientX, rect.left, rect.width);
      if (toIndex !== null) onReorder?.(fromIndex, toIndex);
    },
    [mimeType, onReorder],
  );

  const dropClassFor = useCallback(
    (tabId: string): string => {
      if (dragOverTabId !== tabId || !dropSide) return '';
      return dropSide === 'before' ? 'studio-tab-drop-before' : 'studio-tab-drop-after';
    },
    [dragOverTabId, dropSide],
  );

  return {
    draggingTabId,
    dragOverTabId,
    dropSide,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    dropClassFor,
  };
}
