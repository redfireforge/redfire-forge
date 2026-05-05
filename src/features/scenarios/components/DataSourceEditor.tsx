import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow, FeatureGroup, SharedDataSource, KeyValue, AuthConfig } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import type { TestEditingContext } from './TestEditorModal';

import { useDataSourceTags } from '../hooks/useDataSourceTags';
import { useDataSourceColumns } from '../hooks/useDataSourceColumns';
import { useDataSourceRows } from '../hooks/useDataSourceRows';
import { useDataSourceFetch } from '../hooks/useDataSourceFetch';
import { useDataSourceGrid } from '../hooks/useDataSourceGrid';
import { useDataSourceImport } from '../hooks/useDataSourceImport';
import { useValidationContract } from '../hooks/useValidationContract';
import DataSourceSetupModal from './DataSourceSetupModal';
import DataSourceRowDetailModal from './DataSourceRowDetailModal';
import DataSourceVerifyModal from './DataSourceVerifyModal';
import PopulateFromApiModal from './PopulateFromApiModal';
import DataSourceEmptyState from './DataSourceEmptyState';
import ValidationContractPanel from './ValidationContractPanel';
import PromoteToSharedModal from './PromoteToSharedModal';
import DataSourceToolbar from './DataSourceToolbar';


const COLUMN_TYPES: { value: DataSourceColumn['type']; label: string }[] = [
  { value: 'path', label: 'Path' },
  { value: 'param', label: 'Param' },
  { value: 'body', label: 'Body' },
  { value: 'header', label: 'Header' },
  { value: 'validate', label: 'Validate' },
];

interface DataSourceEditorProps {
  draft: Scenario;
  onDraftChange: (d: Scenario) => void;
  /** Auth-aware fetch: resolves effective auth, acquires tokens, fires request. */
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<HttpResponse>;
  /** Called when user wants to create a parameterized copy from the Parameterize tab */
  onCreateParameterizedCopy?: (copy: Scenario, targetFgId?: string, targetScenarioId?: string) => void;
  /** All feature groups for destination picker */
  featureGroups?: FeatureGroup[];
  /** Current editing context */
  editingTest?: TestEditingContext;
  /** Top-level shared data sources (for linking) */
  sharedDataSources?: SharedDataSource[];
  /** Called when user promotes inline data to a shared data source; returns new shared DS id */
  onPromoteToShared?: (
    dataSource: DataSource,
    name: string,
    tags?: string[],
    fetchConfig?: { url: string; method: string; headers: KeyValue[]; auth?: AuthConfig }
  ) => string;
  /** Called when user clicks the shared DS badge to open the modal */
  onOpenSharedDsModal?: () => void;
}

export default function DataSourceEditor({ draft, onDraftChange, onFetchRow, onCreateParameterizedCopy, featureGroups, editingTest, sharedDataSources, onPromoteToShared, onOpenSharedDsModal }: DataSourceEditorProps) {
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showDetachDropdown, setShowDetachDropdown] = useState(false);
  const detachDropdownRef = useRef<HTMLDivElement>(null);

  // Close detach dropdown on outside click
  useEffect(() => {
    if (!showDetachDropdown) return;
    const handler = (e: MouseEvent) => {
      if (detachDropdownRef.current && !detachDropdownRef.current.contains(e.target as Node)) {
        setShowDetachDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDetachDropdown]);

  // ─── 2C: Row notes ─────────────────────────────────────────
  const [editingNoteRowId, setEditingNoteRowId] = useState<string | null>(null);

  const [showColumnOrder, setShowColumnOrder] = useState(false);

  // ─── 19B: Shared data source support (top-level) ─────────
  const availableSharedDs: SharedDataSource[] = sharedDataSources ?? [];
  const linkedSharedDs = draft.sharedDataSourceId
    ? availableSharedDs.find(s => s.id === draft.sharedDataSourceId) ?? null
    : null;

  const linkSharedDs = useCallback((sharedId: string) => {
    onDraftChange({ ...draft, sharedDataSourceId: sharedId });
  }, [draft, onDraftChange]);

  // Detach options: copy data to inline or just unlink
  const detachWithCopy = useCallback(() => {
    if (!linkedSharedDs) return;
    const { sharedDataSourceId: _, ...rest } = draft;
    // Copy the shared data source's data to inline
    onDraftChange({ ...rest, dataSource: linkedSharedDs.dataSource } as Scenario);
  }, [draft, linkedSharedDs, onDraftChange]);

  const detachUnlinkOnly = useCallback(() => {
    const { sharedDataSourceId: _, ...rest } = draft;
    onDraftChange(rest as Scenario);
  }, [draft, onDraftChange]);

  // Promote inline data to a shared data source
  const handlePromote = useCallback((name: string, tags?: string[]) => {
    if (!onPromoteToShared || !draft.dataSource) return;
    // Pass test's URL (with {{variables}}), method, headers, and auth for fetchConfig
    // Priority: test's URL > dataSource urlTemplate (test URL has the parameterized variables)
    const newSharedId = onPromoteToShared(
      draft.dataSource,
      name,
      tags,
      {
        url: draft.url || draft.dataSource.urlTemplate || '',
        method: draft.method || 'GET',
        headers: draft.headers || [],
        auth: draft.auth,
      }
    );
    if (newSharedId) {
      // Link test to new shared DS and clear inline data
      const { dataSource: _, ...rest } = draft;
      onDraftChange({ ...rest, sharedDataSourceId: newSharedId } as Scenario);
    }
    setShowPromoteModal(false);
  }, [draft, onDraftChange, onPromoteToShared]);

  const dt: DataSource | undefined = linkedSharedDs ? linkedSharedDs.dataSource : draft.dataSource;

  // When linked to shared DS, create an effective draft with the shared data for fetch/verify operations
  const effectiveDraft = useMemo(() => {
    if (!linkedSharedDs) return draft;
    return { ...draft, dataSource: linkedSharedDs.dataSource };
  }, [draft, linkedSharedDs]);

  // Keep a ref to always have the latest effective draft in async callbacks
  const draftRef = useRef(effectiveDraft);
  draftRef.current = effectiveDraft;

  // ─── Adapter: DataSource-level onChange for hooks ──────────
  const handleDsChange = useCallback((ds: DataSource) => {
    onDraftChange({ ...draft, dataSource: ds });
  }, [draft, onDraftChange]);

  // ─── Column operations (via hook) ─────────────────────────
  const {
    addColumn, removeColumn, updateColumn,
    editingColId, setEditingColId,
  } = useDataSourceColumns({ dataSource: dt, onChange: handleDsChange, url: draft.url });

  // ─── Row operations (via hook) ─────────────────────────────
  const {
    addRow, addSampleRow, removeRow, moveRow, duplicateRow,
    toggleRow, toggleSample, updateCell, updateRowLabel, updateRowNote,
    deleteAllRows,
    selectedRows, handleRowSelect, selectAll, clearSelection,
    bulkEnable, bulkDelete, bulkDuplicate,
    searchQuery, setSearchQuery,
    sortCol, sortDir, handleSortColumn,
    dragRowId, handleDragStart, handleDragOver, handleDrop,
    filteredSortedRows: filteredRows,
    enabledCount,
    filterTag, setFilterTag,
  } = useDataSourceRows({ dataSource: dt, onChange: handleDsChange });

  // ─── 12: Tag management (extracted hook) ───────────────────
  const {

    editingTagRowId, setEditingTagRowId,
    tagInput, setTagInput,
    allTags, tagCounts, untaggedCount, tagSuggestions,
    addTagToRow, removeTagFromRow, bulkAddTag, bulkRemoveTag,
    addSubset, removeSubset,
  } = useDataSourceTags(draft, dt, onDraftChange, selectedRows);

  // ─── Stored validation contract patterns ────
  const {
    contractPatterns,
    toggleContractPattern,
    addContractPattern: _addContractPattern,
    removeContractPattern,
    toggleArrayMode,
  } = useValidationContract(dt, draft, onDraftChange);

  // ─── Grid interactions (resize, keyboard nav, col drag) ────
  const {
    tableRef,
    draggingColDragId: _draggingColDragId, dragOverColId,
    handleColDragStart, handleColDragOver, handleColDragEnd, handleColDrop,
    handleColResize, handleCellKeyDown,
  } = useDataSourceGrid(dt, handleDsChange);

  // ─── Setup modal callback ──────────────────────────────────

  const handleSetupApply = useCallback((dataTable: DataSource, _urlTemplate: string, options?: { auth?: Scenario['auth'] }) => {
    // Update draft.url to the urlTemplate so the URL field shows {{variables}}
    const authUpdate = options?.auth ? { auth: options.auth } : {};
    onDraftChange({ ...draft, dataSource: dataTable, url: dataTable.urlTemplate || draft.url, ...authUpdate });
  }, [draft, onDraftChange]);

  const handleRemoveTable = useCallback(() => {
    onDraftChange({ ...draft, dataSource: undefined });
  }, [draft, onDraftChange]);



  // ─── Fetch / re-fetch (via hook) ──────────────────────────
  const {
    fetchRowResponse, refetchAllRows,
    fetchingRowId, refetchingAll,
    fetchRowError, fetchRowErrorDetail, clearFetchError,
  } = useDataSourceFetch({
    scenario: effectiveDraft,
    dataSource: dt,
    onChange: handleDsChange,
    onFetchRow,
  });

  // ─── Verify modal ──────────────────────────────────────────

  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // ─── Populate from API modal ───────────────────────────────

  const [showPopulateModal, setShowPopulateModal] = useState(false);

  const handlePopulateApply = useCallback(
    (columns: DataSourceColumn[], newRows: DataSourceRow[], mode: 'append' | 'replace') => {
      if (!dt) return;
      const rows = mode === 'replace' ? newRows : [...dt.rows, ...newRows];
      onDraftChange({
        ...draft,
        dataSource: { ...dt, columns, rows, source: { type: 'inline' } },
      });
    },
    [draft, dt, onDraftChange],
  );



  // ─── Import (CSV / JSON / Excel) ─────────────────────────────
  const { handleImport } = useDataSourceImport({ draft, dataSource: dt, onDraftChange });

  // ─── Distribution ───────────────────────────────────────────

  const handleDistributionChange = useCallback(
    (distribution: DataSource['distribution']) => {
      if (!dt) return;
      onDraftChange({ ...draft, dataSource: { ...dt, distribution } });
    },
    [draft, dt, onDraftChange],
  );

  const handleValidationModeChange = useCallback(
    (validationMode: DataSource['validationMode']) => {
      if (!dt) return;
      onDraftChange({ ...draft, dataSource: { ...dt, validationMode } });
    },
    [draft, dt, onDraftChange],
  );

  // ─── No data table yet ─────────────────────────────────────

  if (!dt) {
    return (
      <DataSourceEmptyState
        draft={draft}
        onDraftChange={onDraftChange}
        onFetchRow={onFetchRow}
        onCreateParameterizedCopy={onCreateParameterizedCopy}
        featureGroups={featureGroups}
        editingTest={editingTest}
        showSetupModal={showSetupModal}
        setShowSetupModal={setShowSetupModal}
        handleSetupApply={handleSetupApply}
      />
    );
  }

  // ─── Render table ──────────────────────────────────────────

  return (
    <div className="params-editor data-source-editor">
      <DataSourceToolbar
        dt={dt}
        linkedSharedDs={linkedSharedDs}
        availableSharedDs={availableSharedDs}
        enabledCount={enabledCount}
        refetchingAll={refetchingAll}
        showDetachDropdown={showDetachDropdown}
        setShowDetachDropdown={setShowDetachDropdown}
        showColumnOrder={showColumnOrder}
        setShowColumnOrder={setShowColumnOrder}
        showContract={showContract}
        setShowContract={setShowContract}
        detachDropdownRef={detachDropdownRef}
        onDetachWithCopy={detachWithCopy}
        onDetachUnlinkOnly={detachUnlinkOnly}
        onLinkSharedDs={linkSharedDs}
        onAddRow={addRow}
        onAddSampleRow={addSampleRow}
        onAddColumn={addColumn}
        onShowPopulateModal={() => setShowPopulateModal(true)}
        onShowVerifyModal={() => setShowVerifyModal(true)}
        onRefetchAllRows={() => void refetchAllRows()}
        onDistributionChange={handleDistributionChange}
        onValidationModeChange={handleValidationModeChange}
        onShowSetupModal={() => setShowSetupModal(true)}
        onShowPromoteModal={() => setShowPromoteModal(true)}
        onDeleteAllRows={deleteAllRows}
        onRemoveTable={handleRemoveTable}
        onColumnOrderApply={(reordered) => onDraftChange({ ...draft, dataSource: { ...dt, columns: reordered } })}
        onOpenSharedDsModal={onOpenSharedDsModal}
        onPromoteToShared={onPromoteToShared}
      />

      {/* File source info bar */}
      {dt.source?.type === 'file' && dt.source.filePath && (
        <div className="data-source-file-info">
          <span className="data-source-file-icon">📄</span>
          <span className="data-source-file-name" title={dt.source.filePath}>{dt.source.filePath}</span>
          {dt.source.fileLastRead && (
            <span className="data-source-file-meta">
              Imported {new Date(dt.source.fileLastRead).toLocaleString()}
              {dt.source.fileRowCount != null && ` • ${dt.source.fileRowCount} rows`}
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void handleImport()}
            title="Re-import from file"
          >
            ↻ Reload
          </button>
          <button
            type="button"
            className="btn-link-sm"
            onClick={() => {
              if (!dt) return;
              onDraftChange({ ...draft, dataSource: { ...dt, source: { type: 'inline' } } });
            }}
            title="Switch to inline data (keeps current rows)"
          >
            Switch to Inline
          </button>
        </div>
      )}

      {fetchRowError && (
        <div className="data-source-fetch-error">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️ Fetch error: {fetchRowError}</span>
            <button type="button" className="btn btn-sm" onClick={clearFetchError}>Dismiss</button>
          </div>
          {fetchRowErrorDetail?.url && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              <strong>URL:</strong> <code style={{ wordBreak: 'break-all' }}>{fetchRowErrorDetail.url}</code>
            </div>
          )}
          {fetchRowErrorDetail?.body && (
            <pre style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 4, marginTop: 4, maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{(() => { try { return JSON.stringify(JSON.parse(fetchRowErrorDetail.body!), null, 2); } catch { return fetchRowErrorDetail.body; } })()}</pre>
          )}
        </div>
      )}

      {/* Validation Contract Panel */}
      {showContract && dt && (
        <ValidationContractPanel
          dataSource={dt}
          contractPatterns={contractPatterns}
          toggleContractPattern={toggleContractPattern}
          removeContractPattern={removeContractPattern}
          toggleArrayMode={toggleArrayMode}
        />
      )}

      {/* Verify Modal */}
      {showVerifyModal && dt && (
        <DataSourceVerifyModal
          draft={effectiveDraft}
          dataTable={dt}
          onDraftChange={onDraftChange}
          onFetchRow={onFetchRow}
          onClose={() => setShowVerifyModal(false)}
        />
      )}

      {/* Populate from API Modal */}
      {showPopulateModal && dt && (
        <PopulateFromApiModal
          draft={draft}
          dataTable={dt}
          onApply={handlePopulateApply}
          onFetchRow={onFetchRow}
          onClose={() => setShowPopulateModal(false)}
        />
      )}

      <div className="data-source-bulk-toolbar">
        <input
          className="params-input data-source-search-input"
          placeholder="Search rows…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {(searchQuery || filterTag) && (
          <span className="data-source-search-count">
            {filteredRows.length} of {dt.rows.length} rows
          </span>
        )}

        {selectedRows.size > 0 && (
          <div className="data-source-bulk-actions">
            <span className="data-source-bulk-count">
              <span className="data-source-bulk-num">{selectedRows.size}</span>
              <span>selected</span>
            </span>
            <div className="data-source-bulk-group">
              <button type="button" className="data-source-action-btn" onClick={() => bulkEnable(true)} title="Enable selected rows">✓ Enable</button>
              <button type="button" className="data-source-action-btn" onClick={() => bulkEnable(false)} title="Disable selected rows">○ Disable</button>
              <button type="button" className="data-source-action-btn" onClick={bulkDuplicate} title="Duplicate selected rows">⧉ Duplicate</button>
            </div>
            <div className="data-source-bulk-group">
              <select
                className="data-source-action-btn data-source-tag-select"
                value=""
                onChange={(e) => { if (e.target.value) bulkAddTag(e.target.value); e.target.value = ''; }}
              >
                <option value="">+ Tag…</option>
                {tagSuggestions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {allTags.length > 0 && (
                <select
                  className="data-source-action-btn data-source-tag-select"
                  value=""
                  onChange={(e) => { if (e.target.value) bulkRemoveTag(e.target.value); e.target.value = ''; }}
                >
                  <option value="">− Untag…</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
            <button type="button" className="data-source-action-btn data-source-action-btn-danger" onClick={bulkDelete} title="Delete selected rows">✕ Delete</button>
            <div className="data-source-bulk-sep" />
            <button type="button" className="data-source-action-btn" onClick={selectAll}>Select All</button>
            <button type="button" className="data-source-action-btn" onClick={clearSelection}>Clear</button>
          </div>
        )}
      </div>

      {/* ─── 12: Tag filter bar ─────────────────────────── */}
      {allTags.length > 0 && (
        <div className="data-source-tag-filter-bar">
          <span className="data-source-tag-filter-label">Filter:</span>
          <button
            type="button"
            className={`data-source-tag-filter-btn ${filterTag === null ? 'active' : ''}`}
            onClick={() => setFilterTag(null)}
          >
            All ({dt.rows.length})
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              className={`data-source-tag-filter-btn ${filterTag === tag ? 'active' : ''}`}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
            >
              🏷 {tag} ({tagCounts[tag] ?? 0})
            </button>
          ))}
          {untaggedCount > 0 && (
            <button
              type="button"
              className={`data-source-tag-filter-btn ${filterTag === '__untagged__' ? 'active' : ''}`}
              onClick={() => setFilterTag(filterTag === '__untagged__' ? null : '__untagged__')}
            >
              untagged ({untaggedCount})
            </button>
          )}
        </div>
      )}

      <div className="data-source-scroll">
        <table className="data-source-grid" ref={tableRef}>
          <thead>
            <tr className="data-source-header-row">
              <th className="data-source-th data-source-th-checkbox" />
              <th className="data-source-th data-source-th-label">
                Row Name
                <div className="data-source-col-resize" onMouseDown={(e) => handleColResize(e, -1)} />
              </th>
              {dt.columns.map((col, colIdx) => (
                <th
                  key={col.id}
                  className={`data-source-th${dragOverColId === col.id ? ' col-drag-over' : ''}`}
                  onDragOver={(e) => handleColDragOver(col.id, e)}
                  onDrop={(e) => handleColDrop(col.id, e)}
                >
                  <div className="data-source-col-header">
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
                    <div className="data-source-col-controls">
                      <select
                        className="data-source-col-type-select"
                        value={col.type}
                        onChange={(e) => updateColumn(col.id, { type: e.target.value as DataSourceColumn['type'] })}
                        title="Column type"
                      >
                        {COLUMN_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="params-delete"
                        onClick={() => removeColumn(col.id)}
                        title="Remove column"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="data-source-col-resize" onMouseDown={(e) => handleColResize(e, colIdx)} />
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
                      <button type="button" className="data-source-row-action-btn" onClick={(e) => { e.stopPropagation(); setEditingRowId(row.id); }} disabled={!row.enabled} title="Edit row details">
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

      <div className="data-source-footer">
        <span className="data-source-preview">
          Run Preview: {enabledCount} enabled row{enabledCount !== 1 ? 's' : ''} → {enabledCount} request{enabledCount !== 1 ? 's' : ''}
        </span>
      </div>

      {showSetupModal && (
        <DataSourceSetupModal
          test={draft}
          mode="configure"
          onApply={handleSetupApply}
          onClose={() => setShowSetupModal(false)}
        />
      )}

      {editingRowId && dt && (() => {
        const row = dt.rows.find(r => r.id === editingRowId);
        const rowIdx = dt.rows.findIndex(r => r.id === editingRowId);
        if (!row) return null;
        return (
          <DataSourceRowDetailModal
            draft={draft}
            dataTable={dt}
            row={row}
            rowIndex={rowIdx}
            onFetchRow={onFetchRow}
            onSave={(updatedRow, newColumns) => {
              let updatedDt = { ...dt };
              // Add any new validate columns
              if (newColumns && newColumns.length > 0) {
                updatedDt = {
                  ...updatedDt,
                  columns: [...updatedDt.columns, ...newColumns],
                };
                // Add empty values for the new columns to ALL other rows
                updatedDt = {
                  ...updatedDt,
                  rows: updatedDt.rows.map(r => {
                    if (r.id === updatedRow.id) return updatedRow;
                    const values = { ...r.values };
                    for (const col of newColumns) {
                      values[col.id] = '';
                    }
                    return { ...r, values };
                  }),
                };
              } else {
                updatedDt = {
                  ...updatedDt,
                  rows: updatedDt.rows.map(r => r.id === updatedRow.id ? updatedRow : r),
                };
              }
              onDraftChange({ ...draft, dataSource: updatedDt });
              setEditingRowId(null);
            }}
            onClose={() => setEditingRowId(null)}
          />
        );
      })()}

      {/* ─── 12: Tag suggestion datalist ──────────────── */}
      <datalist id="tag-suggestions">
        {tagSuggestions.map(t => <option key={t} value={t} />)}
      </datalist>

      {/* ─── 12: Named subsets section ────────────────── */}
      {dt && (dt.subsets?.length ?? 0) > 0 && (
        <div className="data-source-subsets-bar">
          <span className="data-source-subsets-label">Subsets:</span>
          {(dt.subsets ?? []).map(s => (
            <span key={s.name} className="data-source-subset-chip">
              <button
                type="button"
                className={`data-source-subset-btn ${
                  filterTag && s.filter.type === 'tags' && s.filter.tags.length === 1 && filterTag === s.filter.tags[0] ? 'active' : ''
                }`}
                onClick={() => {
                  if (s.filter.type === 'tags' && s.filter.tags.length > 0) {
                    setFilterTag(filterTag === s.filter.tags[0] ? null : s.filter.tags[0]);
                  }
                }}
                title={`Filter: ${s.filter.type === 'tags' ? s.filter.tags.join(', ') : s.filter.rowIds?.join(', ')}`}
              >
                {s.name}
              </button>
              <button
                type="button"
                className="data-source-subset-remove"
                onClick={() => removeSubset(s.name)}
                title="Remove subset"
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* ─── 12: Save as subset button ────────────────── */}
      {filterTag && (
        <div className="data-source-save-subset">
          <button
            type="button"
            className="data-source-action-btn"
            onClick={() => {
              const name = window.prompt('Subset name:');
              if (name?.trim()) {
                addSubset({
                  name: name.trim(),
                  filter: filterTag === '__untagged__'
                    ? { type: 'rows', rowIds: filteredRows.map(r => r.id) }
                    : { type: 'tags', tags: [filterTag], mode: 'any' },
                });
              }
            }}
          >
            Save as Subset ({filteredRows.length} rows)
          </button>
        </div>
      )}

      {/* Promote to Shared Data Source modal */}
      {showPromoteModal && dt && (
        <PromoteToSharedModal
          dataSource={dt}
          testName={draft.name}
          onConfirm={handlePromote}
          onClose={() => setShowPromoteModal(false)}
        />
      )}
    </div>
  );
}
