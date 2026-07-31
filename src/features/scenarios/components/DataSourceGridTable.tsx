import type { DragEvent, KeyboardEvent, MouseEvent, RefObject } from 'react';
import type { DataSource, DataSourceColumn, DataSourceRow, SharedDataSource } from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { COLUMN_TYPES } from '../utils/dataSourceEditorUtils';

export interface DataSourceGridTableProps {
  tableRef: RefObject<HTMLTableElement | null>;
  dt: DataSource;
  linkedSharedDs: SharedDataSource | null;
  dragOverColId: string | null;
  handleColDragStart: (colId: string, e: DragEvent) => void;
  handleColDragOver: (colId: string, e: DragEvent) => void;
  handleColDragEnd: () => void;
  handleColDrop: (targetColId: string, e: DragEvent) => void;
  editingColId: string | null;
  setEditingColId: (id: string | null) => void;
  updateColumn: (colId: string, patch: Partial<DataSourceColumn>) => void;
  removeColumn: (colId: string) => void;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
  handleSortColumn: (colId: string) => void;
  handleColResize: (e: MouseEvent, colIdx: number) => void;
  filteredRows: DataSourceRow[];
  selectedRows: Set<string>;
  dragRowId: string | null;
  handleRowSelect: (rowId: string, e: MouseEvent) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDrop: (targetRowId: string, e: DragEvent) => void;
  handleDragStart: (rowId: string, e: DragEvent) => void;
  setDragRowId: (id: string | null) => void;
  toggleRow: (rowId: string) => void;
  setEditingRowId: (id: string | null) => void;
  fetchRowResponse: (rowId: string) => Promise<void>;
  fetchingRowId: string | null;
  toggleSample: (rowId: string) => void;
  duplicateRow: (rowId: string) => void;
  editingNoteRowId: string | null;
  setEditingNoteRowId: (id: string | null) => void;
  updateRowNote: (rowId: string, note: string) => void;
  removeRow: (rowId: string) => void;
  editingTagRowId: string | null;
  setEditingTagRowId: (id: string | null) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  removeTagFromRow: (rowId: string, tag: string) => void;
  addTagToRow: (rowId: string, tag: string) => void;
  updateRowLabel: (rowId: string, label: string) => void;
  updateCell: (rowId: string, colId: string, value: string) => void;
  handleCellKeyDown: (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => void;
  moveRow: (rowId: string, direction: 'up' | 'down') => void;
}

export default function DataSourceGridTable(props: DataSourceGridTableProps) {
  const {
    tableRef,
    dt,
    linkedSharedDs,
    dragOverColId,
    handleColDragStart,
    handleColDragOver,
    handleColDragEnd,
    handleColDrop,
    editingColId,
    setEditingColId,
    updateColumn,
    removeColumn,
    sortCol,
    sortDir,
    handleSortColumn,
    handleColResize,
    filteredRows,
    selectedRows,
    dragRowId,
    handleRowSelect,
    handleDragOver,
    handleDrop,
    handleDragStart,
    setDragRowId,
    toggleRow,
    setEditingRowId,
    fetchRowResponse,
    fetchingRowId,
    toggleSample,
    duplicateRow,
    editingNoteRowId,
    setEditingNoteRowId,
    updateRowNote,
    removeRow,
    editingTagRowId,
    setEditingTagRowId,
    tagInput,
    setTagInput,
    removeTagFromRow,
    addTagToRow,
    updateRowLabel,
    updateCell,
    handleCellKeyDown,
    moveRow,
  } = props;

  return (
    <div className="data-source-scroll">
      <table className="data-source-grid" ref={tableRef}>
        <thead>
          <tr className="data-source-header-row">
            <th className="data-source-th data-source-th-checkbox" />
            <th className="data-source-th data-source-th-label">
              Row Name
              <div className="data-source-col-resize" onMouseDown={(e) => handleColResize(e, -1)} />
            </th>
            {dt.columns.map((col) => (
              <th
                key={col.id}
                className={`data-source-th${dragOverColId === col.id ? ' col-drag-over' : ''}`}
                onDragOver={(e) => handleColDragOver(col.id, e)}
                onDrop={(e) => handleColDrop(col.id, e)}
              >
                <div className="data-source-col-header">
                  <div className="data-source-col-title-row">
                    <button
                      type="button"
                      className="data-source-col-drag-handle"
                      draggable
                      onDragStart={(e) => handleColDragStart(col.id, e)}
                      onDragEnd={handleColDragEnd}
                      title="Drag to reorder column"
                    >⠿</button>
                    {editingColId === col.id ? (
                      <input
                        className="params-input data-source-col-name-input"
                        autoFocus
                        value={col.name}
                        onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                        onBlur={() => setEditingColId(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingColId(null); }}
                      />
                    ) : (
                      <span
                        className="data-source-col-name"
                        onClick={() => setEditingColId(col.id)}
                        title="Click to rename"
                      >
                        {col.name || '(unnamed)'}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`data-source-sort-btn ${sortCol === col.id ? 'active' : ''}`}
                      onClick={() => handleSortColumn(col.id)}
                      title="Sort by this column"
                    >
                      {sortCol === col.id ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </button>
                  </div>
                  {col.type === 'validate' && col.mapping ? (
                    <span
                      className="data-source-col-mapping"
                      data-testid="ds-col-mapping"
                      title="JSON path in the API response — compared against cell values"
                    >
                      {col.mapping.startsWith('$') ? col.mapping : `$.${col.mapping}`}
                    </span>
                  ) : null}
                  <div className="data-source-col-controls">
                    <CustomSelect
                      className="data-source-col-type-select"
                      value={col.type}
                      onChange={(v) => updateColumn(col.id, { type: v as DataSourceColumn['type'] })}
                      options={COLUMN_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                      aria-label="Column type"
                    />
                    <button
                      type="button"
                      className="data-source-col-remove-btn"
                      onClick={() => removeColumn(col.id)}
                      title="Remove column"
                      aria-label={`Remove column ${col.name || 'unnamed'}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </th>
            ))}
            <th className="data-source-th data-source-th-actions" />
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, rowIdx) => (
            <tr
              key={row.id}
              className={`data-source-row ${!row.enabled ? 'disabled' : ''} ${selectedRows.has(row.id) ? 'selected' : ''} ${dragRowId === row.id ? 'dragging' : ''} ${row.isSample ? 'sample-row' : ''}`}
              onClick={(e) => handleRowSelect(row.id, e)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(row.id, e)}
            >
              <td className="data-source-td data-source-td-checkbox">
                <div className="data-source-row-left-actions">
                  {!linkedSharedDs && <span
                    className="data-source-drag-handle"
                    draggable
                    onDragStart={(e) => handleDragStart(row.id, e)}
                    onDragEnd={() => setDragRowId(null)}
                    title="Drag to reorder"
                  >
                    ⠿
                  </span>}
                  <label className="params-toggle" title={row.isSample ? 'Sample rows are always enabled' : (row.enabled ? 'Disable row' : 'Enable row')}>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => toggleRow(row.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={row.isSample || !!linkedSharedDs}
                    />
                  </label>
                  {!linkedSharedDs && <div className="data-source-row-hover-actions">
                    <button type="button" className="data-source-row-action-btn" data-testid="ds-row-edit-btn" onClick={(e) => { e.stopPropagation(); setEditingRowId(row.id); }} disabled={!row.enabled} title="Edit row details">
                      ✎
                    </button>
                    <button type="button" className="data-source-row-action-btn" onClick={(e) => { e.stopPropagation(); void fetchRowResponse(row.id); }} disabled={fetchingRowId === row.id || !row.enabled} title="Fetch response">
                      {fetchingRowId === row.id ? '⏳' : '⚡'}
                    </button>
                    <button type="button" className={`data-source-row-action-btn ${row.isSample ? 'is-sample-active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleSample(row.id); }} title={row.isSample ? 'Unmark as sample' : 'Mark as sample'}>
                      📌
                    </button>
                    <button type="button" className="data-source-row-action-btn" onClick={(e) => { e.stopPropagation(); duplicateRow(row.id); }} title="Duplicate row">⧉</button>
                    <button
                      type="button"
                      className={`data-source-row-action-btn ${row.note ? 'has-note' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setEditingNoteRowId(editingNoteRowId === row.id ? null : row.id); }}
                      title={row.note ? `Note: ${row.note}` : 'Add note'}
                    >
                      {row.note ? '📝' : '🗒️'}
                    </button>
                    <button type="button" className="data-source-row-action-btn data-source-row-action-danger" onClick={(e) => { e.stopPropagation(); removeRow(row.id); }} title="Delete row">×</button>
                  </div>}
                </div>
                {editingNoteRowId === row.id && (
                  <input
                    className="params-input data-source-note-input"
                    placeholder="Add a note…"
                    value={row.note ?? ''}
                    onChange={(e) => updateRowNote(row.id, e.target.value)}
                    onBlur={() => setEditingNoteRowId(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingNoteRowId(null); }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {/* ─── 12: Row tags ─────────────────────── */}
                {!linkedSharedDs && <div className="data-source-row-tags" onClick={(e) => e.stopPropagation()}>
                  {(row.tags ?? []).map(tag => (
                    <span key={tag} className="data-source-tag-pill" title={`Remove tag: ${tag}`}>
                      {tag}
                      <button
                        type="button"
                        className="data-source-tag-remove"
                        onClick={() => removeTagFromRow(row.id, tag)}
                      >×</button>
                    </span>
                  ))}
                  {editingTagRowId === row.id ? (
                    <input
                      className="params-input data-source-tag-input"
                      placeholder="tag…"
                      value={tagInput}
                      list="tag-suggestions"
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          addTagToRow(row.id, tagInput);
                          setTagInput('');
                          setEditingTagRowId(null);
                        } else if (e.key === 'Escape') {
                          setEditingTagRowId(null);
                          setTagInput('');
                        }
                      }}
                      onBlur={() => {
                        if (tagInput.trim()) addTagToRow(row.id, tagInput);
                        setEditingTagRowId(null);
                        setTagInput('');
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="data-source-tag-add-btn"
                      onClick={() => { setEditingTagRowId(row.id); setTagInput(''); }}
                      title="Add tag"
                    >+</button>
                  )}
                </div>}
              </td>
              <td className="data-source-td data-source-td-label">
                {row.isSample && <span className="data-source-sample-badge" title="Sample row">📌 Sample</span>}
                <input
                  className="params-input data-source-cell-input data-source-label-input"
                  value={row.label ?? ''}
                  onChange={(e) => updateRowLabel(row.id, e.target.value)}
                  placeholder={`Row ${rowIdx + 1}`}
                  disabled={!row.enabled}
                  readOnly={!!linkedSharedDs}
                />
              </td>
              {dt.columns.map((col, colIdx) => (
                <td key={col.id} className="data-source-td">
                  <input
                    className="params-input data-source-cell-input"
                    data-row={rowIdx}
                    data-col={colIdx}
                    value={row.values[col.id] ?? ''}
                    onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                    placeholder={col.name}
                    disabled={!row.enabled}
                    readOnly={!!linkedSharedDs}
                  />
                </td>
              ))}
              {!linkedSharedDs && <td className="data-source-td data-source-td-actions">
                <div className="data-source-row-actions">
                  <button
                    type="button"
                    className="data-source-move-btn"
                    onClick={() => moveRow(row.id, 'up')}
                    disabled={rowIdx === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="data-source-move-btn"
                    onClick={() => moveRow(row.id, 'down')}
                    disabled={rowIdx === filteredRows.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
