import { useCallback, useRef, useState } from 'react';
import type { DataSource } from '@shared/types';

/**
 * Hook for data source grid interactions: column resize, cell keyboard navigation,
 * and column drag-to-reorder.
 */
export function useDataSourceGrid(
  dt: DataSource | undefined,
  onChange: (ds: DataSource) => void,
) {
  const tableRef = useRef<HTMLTableElement>(null);

  // ─── Column drag to reorder ────────────────────────────────
  const [draggingColDragId, setDraggingColDragId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const handleColDragStart = useCallback((colId: string, e: React.DragEvent) => {
    setDraggingColDragId(colId);
    setDragOverColId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }, []);

  const handleColDragOver = useCallback((colId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColId(colId);
  }, []);

  const handleColDragEnd = useCallback(() => {
    setDraggingColDragId(null);
    setDragOverColId(null);
  }, []);

  const handleColDrop = useCallback((targetColId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dt || !draggingColDragId || draggingColDragId === targetColId) {
      handleColDragEnd();
      return;
    }
    const fromIdx = dt.columns.findIndex(c => c.id === draggingColDragId);
    const toIdx = dt.columns.findIndex(c => c.id === targetColId);
    if (fromIdx === -1 || toIdx === -1) { handleColDragEnd(); return; }
    const cols = [...dt.columns];
    const [moved] = cols.splice(fromIdx, 1);
    cols.splice(toIdx, 0, moved);
    onChange({ ...dt, columns: cols });
    handleColDragEnd();
  }, [dt, draggingColDragId, onChange, handleColDragEnd]);

  // ─── Column resize ─────────────────────────────────────────

  const handleColResize = useCallback((e: React.MouseEvent, _colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest('th') as HTMLTableCellElement;
    if (!th) return;
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;
    const handle = e.target as HTMLElement;
    handle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(80, startWidth + ev.clientX - startX);
      th.style.width = `${newWidth}px`;
    };
    const onMouseUp = () => {
      handle.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // ─── Cell keyboard navigation (Tab/Enter/Arrow between cells) ────

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
      if (!dt) return;
      const totalCols = dt.columns.length;
      const totalRows = dt.rows.length;
      let nextRow = rowIdx;
      let nextCol = colIdx;

      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        nextCol++;
        if (nextCol >= totalCols) { nextCol = 0; nextRow++; }
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        nextCol--;
        if (nextCol < 0) { nextCol = totalCols - 1; nextRow--; }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        nextRow++;
      } else if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
        nextRow++;
      } else if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
        nextRow--;
      } else {
        return;
      }

      if (nextRow < 0 || nextRow >= totalRows) return;
      if (nextCol < 0 || nextCol >= totalCols) return;

      const selector = `[data-row="${nextRow}"][data-col="${nextCol}"]`;
      const target = tableRef.current?.querySelector<HTMLInputElement>(selector);
      target?.focus();
    },
    [dt],
  );

  return {
    tableRef,
    draggingColDragId,
    dragOverColId,
    handleColDragStart,
    handleColDragOver,
    handleColDragEnd,
    handleColDrop,
    handleColResize,
    handleCellKeyDown,
  };
}
