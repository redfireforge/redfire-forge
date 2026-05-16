import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Scenario, DataSource, FeatureGroup, SharedDataSource, KeyValue, AuthConfig } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import type { TestEditingContext } from './TestEditorModal';

import { MapperFetchError } from '../../../shared/components/data-mapper/types';
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
import DataSourceEmptyState from './DataSourceEmptyState';
import ValidationContractPanel from './ValidationContractPanel';
import PromoteToSharedModal from './PromoteToSharedModal';
import DataSourceToolbar from './DataSourceToolbar';
import DataSourceGridTable from './DataSourceGridTable';
import { DataMapperModal, createPopulateFromApiAdapter, createColumnMappingAdapter, type PopulateOutput, type ColumnMappingOutput } from '../../../shared/components/data-mapper';
import { buildHeaders, proxyFetch } from '../../../engine/executor';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import { findUnresolvedTokens } from '../utils/populateFromApiUtils';
import { mergeRowDetailSave, formatErrorBody } from '../utils/dataSourceEditorUtils';

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
    dragRowId, setDragRowId, handleDragStart, handleDragOver, handleDrop,
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
    (output: PopulateOutput) => {
      if (!dt) return;
      const rows = output.mode === 'replace' ? output.rows : [...dt.rows, ...output.rows];
      onDraftChange({
        ...draft,
        dataSource: { ...dt, columns: output.columns, rows, source: { type: 'inline' } },
      });
      setShowPopulateModal(false);
    },
    [draft, dt, onDraftChange],
  );

  const populateDepsRef = useRef({ draft, dt, onFetchRow });
  populateDepsRef.current = { draft, dt, onFetchRow };

  const populateAdapter = useMemo(() => {
    if (!showPopulateModal || !dt) return null;
    return createPopulateFromApiAdapter({
      dataSource: dt,
      fetchSampleData: async () => {
        const { draft: d, dt: table, onFetchRow: fetcher } = populateDepsRef.current;
        if (!table) throw new Error('Data source unavailable');
        const firstRow = table.rows.find(r => r.enabled);
        const resolved = firstRow
          ? resolveScenarioFromDataRow(d, table.columns, firstRow, 0)
          : d;
        const headers = buildHeaders(resolved);
        const baseBody = resolved.body || '';
        const unresolved = findUnresolvedTokens(resolved.url, baseBody || undefined, headers);
        if (unresolved.length > 0) {
          throw new Error(`Unresolved variables: ${unresolved.join(', ')}. Fill the first enabled row before fetching.`);
        }
        const doFetch = fetcher ?? proxyFetch;
        const result = await doFetch(resolved.url, resolved.method, headers, baseBody || undefined);
        if (result.error) throw new MapperFetchError({
          message: result.error,
          status: result.status || undefined,
          statusText: result.statusText || undefined,
          headers: result.headers,
          body: result.body || undefined,
          timing: result.timing ? { ttfb: result.timing.ttfb, total: result.timing.total } : undefined,
        });
        if (result.status >= 400) throw new MapperFetchError({
          message: `HTTP ${result.status}: ${result.statusText}`,
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          body: result.body || undefined,
          timing: result.timing ? { ttfb: result.timing.ttfb, total: result.timing.total } : undefined,
        });
        return JSON.parse(result.body);
      },
    });
  }, [showPopulateModal, dt]);

  // ─── Column Mapping modal ──────────────────────────────────

  const [showColumnMapper, setShowColumnMapper] = useState(false);

  const columnMappingAdapter = useMemo(() => {
    if (!showColumnMapper || !dt) return null;
    return createColumnMappingAdapter({
      columns: dt.columns,
      scenario: draft,
    });
    // Only recreate when modal opens/closes or columns change.
    // `draft` is intentionally excluded — the scenario template is
    // snapshotted when the modal opens to prevent adapter churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showColumnMapper, dt]);

  const handleColumnMapperApply = useCallback(
    (output: ColumnMappingOutput) => {
      if (!dt) return;
      onDraftChange({
        ...draft,
        dataSource: { ...dt, columns: output },
      });
      setShowColumnMapper(false);
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
        onShowColumnMapper={() => setShowColumnMapper(true)}
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
            <pre style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 4, marginTop: 4, maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{formatErrorBody(fetchRowErrorDetail.body)}</pre>
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
      {showPopulateModal && populateAdapter && (
        <DataMapperModal<PopulateOutput>
          adapter={populateAdapter}
          onSave={handlePopulateApply}
          onCancel={() => setShowPopulateModal(false)}
        />
      )}

      {/* Column Mapping Modal */}
      {showColumnMapper && columnMappingAdapter && (
        <DataMapperModal<ColumnMappingOutput>
          adapter={columnMappingAdapter}
          initialData={dt.columns}
          onSave={handleColumnMapperApply}
          onCancel={() => setShowColumnMapper(false)}
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

      <DataSourceGridTable
        tableRef={tableRef}
        dt={dt}
        linkedSharedDs={linkedSharedDs}
        dragOverColId={dragOverColId}
        handleColDragStart={handleColDragStart}
        handleColDragOver={handleColDragOver}
        handleColDragEnd={handleColDragEnd}
        handleColDrop={handleColDrop}
        editingColId={editingColId}
        setEditingColId={setEditingColId}
        updateColumn={updateColumn}
        removeColumn={removeColumn}
        sortCol={sortCol}
        sortDir={sortDir}
        handleSortColumn={handleSortColumn}
        handleColResize={handleColResize}
        filteredRows={filteredRows}
        selectedRows={selectedRows}
        dragRowId={dragRowId}
        handleRowSelect={handleRowSelect}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        handleDragStart={handleDragStart}
        setDragRowId={setDragRowId}
        toggleRow={toggleRow}
        setEditingRowId={setEditingRowId}
        fetchRowResponse={fetchRowResponse}
        fetchingRowId={fetchingRowId}
        toggleSample={toggleSample}
        duplicateRow={duplicateRow}
        editingNoteRowId={editingNoteRowId}
        setEditingNoteRowId={setEditingNoteRowId}
        updateRowNote={updateRowNote}
        removeRow={removeRow}
        editingTagRowId={editingTagRowId}
        setEditingTagRowId={setEditingTagRowId}
        tagInput={tagInput}
        setTagInput={setTagInput}
        removeTagFromRow={removeTagFromRow}
        addTagToRow={addTagToRow}
        updateRowLabel={updateRowLabel}
        updateCell={updateCell}
        handleCellKeyDown={handleCellKeyDown}
        moveRow={moveRow}
      />

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
              onDraftChange({ ...draft, dataSource: mergeRowDetailSave(dt, updatedRow, newColumns) });
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
