/**
 * useDataSourceRows — Row CRUD, bulk ops, selection, drag, search/sort/filter.
 *
 * Extracted from DataSourceEditor to enable reuse in SharedDataSourceModal.
 */
import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { DataSource, DataSourceRow } from '../../../shared/types';
import { createEmptyRow } from '../utils/dataSourceUtils';

export interface UseDataSourceRowsOptions {
  dataSource: DataSource | undefined;
  onChange: (ds: DataSource) => void;
}

export interface UseDataSourceRowsReturn {
  // Row CRUD
  addRow: () => void;
  addSampleRow: () => void;
  removeRow: (rowId: string) => void;
  moveRow: (rowId: string, direction: 'up' | 'down') => void;
  duplicateRow: (rowId: string) => void;
  toggleRow: (rowId: string) => void;
  toggleSample: (rowId: string) => void;
  updateCell: (rowId: string, colId: string, value: string) => void;
  updateRowLabel: (rowId: string, label: string) => void;
  updateRowNote: (rowId: string, note: string) => void;
  deleteAllRows: () => void;

  // Bulk selection
  selectedRows: Set<string>;
  handleRowSelect: (rowId: string, e: React.MouseEvent) => void;
  selectAll: () => void;
  clearSelection: () => void;
  bulkEnable: (enabled: boolean) => void;
  bulkDelete: () => void;
  bulkDuplicate: () => void;

  // Sort / search / drag
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
  handleSortColumn: (colId: string) => void;
  dragRowId: string | null;
  setDragRowId: (id: string | null) => void;
  handleDragStart: (rowId: string, e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (targetRowId: string, e: React.DragEvent) => void;

  // Derived
  filteredSortedRows: DataSourceRow[];
  enabledCount: number;

  // Tag filter (driven externally from useDataSourceTags)
  filterTag: string | null;
  setFilterTag: (tag: string | null) => void;
}

export function useDataSourceRows({ dataSource: dt, onChange }: UseDataSourceRowsOptions): UseDataSourceRowsReturn {
  // ─── Selection state ───────────────────────────────────────
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastClickedRowId, setLastClickedRowId] = useState<string | null>(null);

  // ─── Search / filter / sort ────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // ─── Drag state ────────────────────────────────────────────
  const [dragRowId, setDragRowId] = useState<string | null>(null);

  // ─── Derived ───────────────────────────────────────────────
  const enabledCount = useMemo(
    () => dt?.rows.filter(r => r.enabled).length ?? 0,
    [dt],
  );

  // ─── Row CRUD ──────────────────────────────────────────────

  const updateCell = useCallback(
    (rowId: string, colId: string, value: string) => {
      if (!dt) return;
      const rows = dt.rows.map(r =>
        r.id === rowId ? { ...r, values: { ...r.values, [colId]: value } } : r,
      );
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  const toggleRow = useCallback(
    (rowId: string) => {
      if (!dt) return;
      const row = dt.rows.find(r => r.id === rowId);
      if (row?.isSample && row.enabled) return;
      const rows = dt.rows.map(r =>
        r.id === rowId ? { ...r, enabled: !r.enabled } : r,
      );
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  const addRow = useCallback(() => {
    if (!dt) return;
    const row = createEmptyRow(dt.columns);
    onChange({ ...dt, rows: [...dt.rows, row] });
  }, [dt, onChange]);

  const addSampleRow = useCallback(() => {
    if (!dt) return;
    const row = { ...createEmptyRow(dt.columns), isSample: true };
    onChange({ ...dt, rows: [...dt.rows, row] });
  }, [dt, onChange]);

  const toggleSample = useCallback(
    (rowId: string) => {
      if (!dt) return;
      const rows = dt.rows.map(r =>
        r.id === rowId ? { ...r, isSample: !r.isSample } : r,
      );
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  const removeRow = useCallback(
    (rowId: string) => {
      if (!dt) return;
      const rows = dt.rows.filter(r => r.id !== rowId);
      if (rows.length === 0) rows.push(createEmptyRow(dt.columns));
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  const moveRow = useCallback(
    (rowId: string, direction: 'up' | 'down') => {
      if (!dt) return;
      const idx = dt.rows.findIndex(r => r.id === rowId);
      if (idx < 0) return;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= dt.rows.length) return;
      const rows = [...dt.rows];
      [rows[idx], rows[newIdx]] = [rows[newIdx], rows[idx]];
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  const duplicateRow = useCallback(
    (rowId: string) => {
      if (!dt) return;
      const srcRow = dt.rows.find(r => r.id === rowId);
      if (!srcRow) return;
      const newRow: DataSourceRow = {
        id: uuidv4(),
        values: { ...srcRow.values },
        enabled: true,
      };
      const idx = dt.rows.findIndex(r => r.id === rowId);
      const rows = [...dt.rows];
      rows.splice(idx + 1, 0, newRow);
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  const deleteAllRows = useCallback(() => {
    if (!dt) return;
    onChange({ ...dt, rows: [createEmptyRow(dt.columns)] });
  }, [dt, onChange]);

  const updateRowLabel = useCallback(
    (rowId: string, label: string) => {
      if (!dt) return;
      const rows = dt.rows.map(r =>
        r.id === rowId ? { ...r, label } : r,
      );
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  const updateRowNote = useCallback(
    (rowId: string, note: string) => {
      if (!dt) return;
      const rows = dt.rows.map(r =>
        r.id === rowId ? { ...r, note: note || undefined } : r,
      );
      onChange({ ...dt, rows });
    },
    [dt, onChange],
  );

  // ─── Bulk selection ────────────────────────────────────────

  const handleRowSelect = useCallback((rowId: string, e: React.MouseEvent) => {
    if (!dt) return;
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedRowId) {
        const ids = dt.rows.map(r => r.id);
        const startIdx = ids.indexOf(lastClickedRowId);
        const endIdx = ids.indexOf(rowId);
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        for (let i = lo; i <= hi; i++) next.add(ids[i]);
      } else if (e.ctrlKey || e.metaKey) {
        if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
      } else {
        next.clear();
        next.add(rowId);
      }
      return next;
    });
    setLastClickedRowId(rowId);
  }, [dt, lastClickedRowId]);

  const selectAll = useCallback(() => {
    if (!dt) return;
    setSelectedRows(new Set(dt.rows.map(r => r.id)));
  }, [dt]);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const bulkEnable = useCallback((enabled: boolean) => {
    if (!dt) return;
    const rows = dt.rows.map(r => selectedRows.has(r.id) ? { ...r, enabled } : r);
    onChange({ ...dt, rows });
    setSelectedRows(new Set());
  }, [dt, onChange, selectedRows]);

  const bulkDelete = useCallback(() => {
    if (!dt) return;
    const rows = dt.rows.filter(r => !selectedRows.has(r.id));
    if (rows.length === 0) rows.push(createEmptyRow(dt.columns));
    onChange({ ...dt, rows });
    setSelectedRows(new Set());
  }, [dt, onChange, selectedRows]);

  const bulkDuplicate = useCallback(() => {
    if (!dt) return;
    const rows = [...dt.rows];
    const selectedArr = dt.rows.filter(r => selectedRows.has(r.id));
    const lastIdx = dt.rows.findIndex(r => r.id === selectedArr[selectedArr.length - 1]?.id);
    const newRows = selectedArr.map(r => ({ ...r, id: uuidv4(), values: { ...r.values }, enabled: true }));
    rows.splice(lastIdx + 1, 0, ...newRows);
    onChange({ ...dt, rows });
    setSelectedRows(new Set());
  }, [dt, onChange, selectedRows]);

  // ─── Sort ──────────────────────────────────────────────────

  const handleSortColumn = useCallback((colId: string) => {
    if (sortCol === colId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  }, [sortCol]);

  // ─── Drag ──────────────────────────────────────────────────

  const handleDragStart = useCallback((rowId: string, e: React.DragEvent) => {
    setDragRowId(rowId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetRowId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dt || !dragRowId || dragRowId === targetRowId) return;
    const rows = [...dt.rows];
    const fromIdx = rows.findIndex(r => r.id === dragRowId);
    const toIdx = rows.findIndex(r => r.id === targetRowId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = rows.splice(fromIdx, 1);
    rows.splice(toIdx, 0, moved);
    onChange({ ...dt, rows });
    setDragRowId(null);
  }, [dt, dragRowId, onChange]);

  // ─── Filtered/sorted rows ─────────────────────────────────

  const filteredSortedRows = useMemo(() => {
    if (!dt) return [];
    let rows = dt.rows;
    // Tag filter
    if (filterTag === '__untagged__') {
      rows = rows.filter(r => !r.tags || r.tags.length === 0);
    } else if (filterTag) {
      rows = rows.filter(r => (r.tags ?? []).includes(filterTag));
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => {
        if (r.label?.toLowerCase().includes(q)) return true;
        for (const colId of Object.keys(r.values)) {
          if ((r.values[colId] ?? '').toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    // Sort
    if (sortCol) {
      const col = dt.columns.find(c => c.id === sortCol);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const va = (a.values[col.id] ?? '').toLowerCase();
          const vb = (b.values[col.id] ?? '').toLowerCase();
          const cmp = va.localeCompare(vb);
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }
    // Sample rows always sort to top
    rows = [...rows].sort((a, b) => (b.isSample ? 1 : 0) - (a.isSample ? 1 : 0));
    return rows;
  }, [dt, searchQuery, sortCol, sortDir, filterTag]);

  return {
    // Row CRUD
    addRow, addSampleRow, removeRow, moveRow, duplicateRow,
    toggleRow, toggleSample, updateCell, updateRowLabel, updateRowNote,
    deleteAllRows,
    // Bulk
    selectedRows, handleRowSelect, selectAll, clearSelection,
    bulkEnable, bulkDelete, bulkDuplicate,
    // Sort / search / drag
    searchQuery, setSearchQuery,
    sortCol, sortDir, handleSortColumn,
    dragRowId, setDragRowId, handleDragStart, handleDragOver, handleDrop,
    // Derived
    filteredSortedRows, enabledCount,
    // Tag filter
    filterTag, setFilterTag,
  };
}
