/**
 * SharedDataSourceTableEditor — Lightweight table editor for shared data sources
 * Phase 4: Table display, inline editing, row/column CRUD
 */
import { useState, useCallback, useMemo } from 'react';
import type { DataSource, DataSourceColumn } from '../../../shared/types';
import { createEmptyRow, createEmptyColumn } from '../utils/dataSourceUtils';

interface SharedDataSourceTableEditorProps {
  dataSource: DataSource | undefined;
  onChange: (ds: DataSource) => void;
}

interface EditingCell {
  rowId: string;
  colId: string;
}

export default function SharedDataSourceTableEditor({ dataSource, onChange }: SharedDataSourceTableEditorProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const columns = useMemo(() => dataSource?.columns ?? [], [dataSource?.columns]);
  const rows = useMemo(() => dataSource?.rows ?? [], [dataSource?.rows]);

  // ─── Handle cell value change ──────────────────────────────
  const handleCellChange = useCallback((rowId: string, colId: string, value: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    const updatedRows = rows.map(r =>
      r.id === rowId ? { ...r, values: { ...r.values, [colId]: value } } : r,
    );

    onChange({ ...dataSource, rows: updatedRows });
  }, [rows, onChange, dataSource]);

  // ─── Cell editing handlers ────────────────────────────────
  const handleCellDoubleClick = useCallback((rowId: string, colId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const value = row.values[colId] ?? '';
    setEditingCell({ rowId, colId });
    setEditingValue(value);
  }, [rows]);

  const handleCellBlur = useCallback(() => {
    if (!editingCell) return;
    handleCellChange(editingCell.rowId, editingCell.colId, editingValue);
    setEditingCell(null);
    setEditingValue('');
  }, [editingCell, editingValue, handleCellChange]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditingValue('');
    }
  }, [handleCellBlur]);

  // ─── Row CRUD ─────────────────────────────────────────────
  const handleAddRow = useCallback(() => {
    const newRow = createEmptyRow(columns);
    onChange({ ...dataSource, rows: [...rows, newRow] });
  }, [columns, rows, onChange, dataSource]);

  const handleDeleteRow = useCallback((rowId: string) => {
    const updated = rows.filter(r => r.id !== rowId);
    onChange({ ...dataSource, rows: updated });
  }, [rows, onChange, dataSource]);

  const handleMoveRow = useCallback((rowId: string, direction: 'up' | 'down') => {
    const idx = rows.findIndex(r => r.id === rowId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === rows.length - 1) return;

    const newRows = [...rows];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newRows[idx], newRows[targetIdx]] = [newRows[targetIdx], newRows[idx]];

    onChange({ ...dataSource, rows: newRows });
  }, [rows, onChange, dataSource]);

  // ─── Column CRUD ──────────────────────────────────────────
  const handleAddColumn = useCallback(() => {
    const newCol = createEmptyColumn([]);
    const updatedRows = rows.map(row => ({
      ...row,
      values: { ...row.values, [newCol.id]: '' },
    }));
    onChange({ ...dataSource, columns: [...columns, newCol], rows: updatedRows });
  }, [columns, rows, onChange, dataSource]);

  const handleDeleteColumn = useCallback((colId: string) => {
    const updatedCols = columns.filter(c => c.id !== colId);
    const updatedRows = rows.map(row => {
      const newValues = { ...row.values };
      delete newValues[colId];
      return { ...row, values: newValues };
    });

    onChange({ ...dataSource, columns: updatedCols, rows: updatedRows });
  }, [columns, rows, onChange, dataSource]);

  const handleColumnDragStart = useCallback((colId: string, e: React.DragEvent<HTMLButtonElement>) => {
    setDraggingColId(colId);
    setDragOverColId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }, []);

  const handleColumnDragOver = useCallback((targetColId: string, e: React.DragEvent<HTMLTableHeaderCellElement>) => {
    if (!draggingColId || draggingColId === targetColId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== targetColId) {
      setDragOverColId(targetColId);
    }
  }, [draggingColId, dragOverColId]);

  const handleColumnDrop = useCallback((targetColId: string, e: React.DragEvent<HTMLTableHeaderCellElement>) => {
    e.preventDefault();
    const sourceColId = draggingColId || e.dataTransfer.getData('text/plain');
    if (!sourceColId || sourceColId === targetColId) {
      setDraggingColId(null);
      setDragOverColId(null);
      return;
    }

    const fromIdx = columns.findIndex(c => c.id === sourceColId);
    const toIdx = columns.findIndex(c => c.id === targetColId);
    if (fromIdx < 0 || toIdx < 0) {
      setDraggingColId(null);
      setDragOverColId(null);
      return;
    }

    const updatedCols = [...columns];
    const [moved] = updatedCols.splice(fromIdx, 1);
    const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
    updatedCols.splice(insertIdx, 0, moved);
    onChange({ ...dataSource, columns: updatedCols });

    setDraggingColId(null);
    setDragOverColId(null);
  }, [columns, draggingColId, onChange, dataSource]);

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColId(null);
    setDragOverColId(null);
  }, []);

  const handleRenameColumn = useCallback((colId: string, newName: string) => {
    const updated = columns.map(c => {
      if (c.id !== colId) return c;
      const oldName = (c.name ?? '').trim();
      const oldMapping = (c.mapping ?? '').trim();
      const nextName = newName;
      // Keep mapping in sync when it was mirroring the old visible name.
      if (!oldMapping || oldMapping === oldName) {
        return { ...c, name: nextName, mapping: nextName.trim() };
      }
      return { ...c, name: nextName };
    });
    onChange({ ...dataSource, columns: updated });
  }, [columns, onChange, dataSource]);

  const handleChangeColumnType = useCallback((colId: string, newType: DataSourceColumn['type']) => {
    const updated = columns.map(c =>
      c.id === colId ? { ...c, type: newType } : c,
    );
    onChange({ ...dataSource, columns: updated });
  }, [columns, onChange, dataSource]);

  // ─── Render ────────────────────────────────────────────────

  if (!dataSource) return null;

  if (rows.length === 0) {
    return (
      <div className="shared-ds-table-empty">
        <p>No rows yet</p>
        <button className="btn btn-sm" onClick={handleAddRow}>+ Add Row</button>
      </div>
    );
  }

  return (
    <div className="shared-ds-table-editor">
      {/* ─── Table ─── */}
      <div className="shared-ds-table-scroll">
        <table className="shared-ds-table">
          <thead>
            <tr>
              <th className="shared-ds-table-actions"></th>
              {columns.map(col => (
                <th
                  key={col.id}
                  className={`shared-ds-table-header ${dragOverColId === col.id ? 'shared-ds-table-header-drop' : ''}`}
                  onDragOver={(e) => handleColumnDragOver(col.id, e)}
                  onDrop={(e) => handleColumnDrop(col.id, e)}
                >
                  <div className="shared-ds-col-header">
                    <button
                      className="btn-icon shared-ds-col-drag-handle"
                      draggable
                      onDragStart={(e) => handleColumnDragStart(col.id, e)}
                      onDragEnd={handleColumnDragEnd}
                      title="Drag to reorder column"
                      aria-label="Drag to reorder column"
                    >
                      ⋮⋮
                    </button>
                    <input
                      type="text"
                      className="shared-ds-col-name"
                      value={col.name}
                      onChange={e => handleRenameColumn(col.id, e.target.value)}
                      placeholder="Column name"
                    />
                    <select
                      className="shared-ds-col-type"
                      value={col.type}
                      onChange={e => handleChangeColumnType(col.id, e.target.value as DataSourceColumn['type'])}
                    >
                      <option value="path">Path</option>
                      <option value="param">Param</option>
                      <option value="body">Body</option>
                      <option value="header">Header</option>
                      <option value="validate">Validate</option>
                    </select>
                    <button
                      className="btn-icon shared-ds-col-delete"
                      onClick={() => handleDeleteColumn(col.id)}
                      title="Delete column"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className="shared-ds-table-add-col">
                <button className="btn-icon" onClick={handleAddColumn} title="Add column">
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.id} className="shared-ds-table-row">
                <td className="shared-ds-table-actions">
                  <div className="shared-ds-row-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleMoveRow(row.id, 'up')}
                      disabled={rowIdx === 0}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleMoveRow(row.id, 'down')}
                      disabled={rowIdx === rows.length - 1}
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      className="shared-ds-row-delete-btn"
                      onClick={() => handleDeleteRow(row.id)}
                      title="Delete row"
                      aria-label="Delete row"
                    >
                      Delete
                    </button>
                  </div>
                </td>
                {columns.map((col) => (
                  <td key={col.id} className="shared-ds-table-cell">
                    {editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                      <input
                        type="text"
                        className="shared-ds-cell-input"
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="shared-ds-cell-display"
                        onDoubleClick={() => handleCellDoubleClick(row.id, col.id)}
                        title="Double-click to edit"
                      >
                        {row.values[col.id] ?? ''}
                      </div>
                    )}
                  </td>
                ))}
                <td className="shared-ds-table-add-col"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Add Row Button ─── */}
      <div className="shared-ds-table-footer">
        <button className="btn btn-sm" onClick={handleAddRow}>
          + Add Row
        </button>
        <span className="shared-ds-table-stats">
          {rows.length} row{rows.length !== 1 ? 's' : ''} · {columns.length} column{columns.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
