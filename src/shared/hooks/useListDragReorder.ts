import { useState, useCallback, type DragEvent } from 'react';

interface UseListDragReorderOptions {
  /** When true, all drag interaction is disabled. */
  disabled?: boolean;
  /** Drag DataTransfer MIME type. Defaults to a generic redfire list mime. */
  mime?: string;
}

export interface ListDragReorder {
  dragIndex: number | null;
  dragOverIndex: number | null;
  /** Attach to the draggable grip: draggable + onDragStart(index) + onDragEnd. */
  onDragStart: (e: DragEvent<HTMLElement>, index: number) => void;
  /** Attach to each row: onDragOver(index). */
  onDragOver: (e: DragEvent<HTMLElement>, index: number) => void;
  /** Attach to each row: onDrop(index). */
  onDrop: (e: DragEvent<HTMLElement>, index: number) => void;
  /** Attach to the grip / document end of drag. */
  onDragEnd: () => void;
  /** True while the row at `index` is the one being dragged. */
  isDragging: (index: number) => boolean;
  /** True while the row at `index` is a valid drop target under the cursor. */
  isDragOver: (index: number) => boolean;
}

/**
 * Reusable HTML5 drag-to-reorder behaviour for a flat list. Owns the drag/over
 * index state and emits a reordered array via `onChange`. Shared by the
 * key-value editor (WS/SSE/Requests headers) and the query-params editor so the
 * reorder logic lives in exactly one place.
 */
export function useListDragReorder<T>(
  items: T[],
  onChange: (next: T[]) => void,
  options: UseListDragReorderOptions = {},
): ListDragReorder {
  const { disabled = false, mime = 'application/x-redfire-list-index' } = options;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const reorder = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [items, onChange],
  );

  const onDragStart = useCallback(
    (e: DragEvent<HTMLElement>, index: number) => {
      if (disabled) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(mime, String(index));
      setDragIndex(index);
    },
    [disabled, mime],
  );

  const onDragOver = useCallback(
    (e: DragEvent<HTMLElement>, index: number) => {
      if (disabled || dragIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex((prev) => (prev === index ? prev : index));
    },
    [disabled, dragIndex],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>, index: number) => {
      if (disabled) return;
      e.preventDefault();
      const raw = e.dataTransfer.getData(mime);
      const from = raw ? parseInt(raw, 10) : dragIndex;
      if (from != null && !Number.isNaN(from)) reorder(from, index);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [disabled, mime, dragIndex, reorder],
  );

  const onDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const isDragging = useCallback((index: number) => dragIndex === index, [dragIndex]);
  const isDragOver = useCallback(
    (index: number) => dragOverIndex === index && dragIndex !== null && dragIndex !== index,
    [dragOverIndex, dragIndex],
  );

  return { dragIndex, dragOverIndex, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDragOver };
}
