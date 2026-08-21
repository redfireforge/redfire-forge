/**
 * SharedDataSourceModal — Top-level modal for managing shared data sources.
 *
 * Refactored to use extracted hooks:
 * - useSharedDsListPanel: list panel state (search, selection, resize)
 * - useSharedDsCrud: CRUD operations
 * - useSharedDsEditorPanel: editor panel state (tabs, fetch config display)
 * - useSharedDsFetchConfig: fetch config editing
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SharedDataSource, FeatureGroup, DataSource, Scenario, GlobalAuthProfile } from '../../../shared/types';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import PopupModal from '../../../shared/components/PopupModal';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import SharedDsSaveConfirmModal from './SharedDsSaveConfirmModal';
import SharedDsFetchPanel from './SharedDsFetchPanel';
import DataSourceEditor from './DataSourceEditor';
import { DataMapperModal, createSharedDsFetchAdapter, type SharedDsFetchOutput } from '../../../shared/components/data-mapper';
import { MapperFetchError } from '../../../shared/components/data-mapper/types';
import { buildHeaders } from '../../../engine/executor';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';
import { findUnresolvedTokens } from '../utils/populateFromApiUtils';
import DataSourceSetupModal from './DataSourceSetupModal';
import { useSharedDsFetchConfig } from '../hooks/useSharedDsFetchConfig';
import { useSharedDsListPanel } from '../hooks/useSharedDsListPanel';
import { useSharedDsCrud } from '../hooks/useSharedDsCrud';
import { useSharedDsEditorPanel, extractPathVariablesFromUrlTemplate, defaultFetchConfig } from '../hooks/useSharedDsEditorPanel';
import { deepClone } from '../../../shared/utils/helpers';
import { formatRelativeTime } from '../../../shared/utils/formatRelativeTime';

interface SharedDataSourceModalProps {
  sharedDataSources: SharedDataSource[];
  onUpdate: (sources: SharedDataSource[]) => void;
  featureGroups: FeatureGroup[];
  globalAuthProfiles?: GlobalAuthProfile[];
  onClose: () => void;
  initialSelectedId?: string;
  currentEditingDraft?: { fgName: string; scenarioName: string; test: Scenario };
  onCreateTestFromSharedDs?: (sharedDs: SharedDataSource, targetFgId: string, targetScenarioId: string, testName: string, openWizard?: boolean) => void;
  moveToTrash?: import('../hooks/useTrash').MoveToTrashFn;
}

export default function SharedDataSourceModal({
  sharedDataSources,
  onUpdate,
  featureGroups,
  globalAuthProfiles = [],
  onClose,
  initialSelectedId,
  currentEditingDraft,
  onCreateTestFromSharedDs,
  moveToTrash,
}: SharedDataSourceModalProps) {
  // ─── List panel hook ───────────────────────────────────────
  const listPanel = useSharedDsListPanel({
    sharedDataSources,
    initialSelectedId,
    onUpdate,
  });

  // ─── CRUD hook ─────────────────────────────────────────────
  const crud = useSharedDsCrud({
    sharedDataSources,
    onUpdate,
    selectedId: listPanel.selectedId,
    setSelectedId: listPanel.setSelectedId,
    setContextMenuId: listPanel.setContextMenuId,
    setPendingNameFocusId: listPanel.setPendingNameFocusId,
    featureGroups,
    currentEditingDraft,
    moveToTrash,
  });

  // ─── Editor panel hook ─────────────────────────────────────
  const editorPanel = useSharedDsEditorPanel({
    selected: listPanel.selected,
    sharedDataSources,
    onUpdate,
    featureGroups,
    globalAuthProfiles,
  });

  // ─── Fetch config hook ─────────────────────────────────────
  const fetchConfig = useSharedDsFetchConfig(
    listPanel.selected ?? undefined,
    sharedDataSources,
    onUpdate,
  );

  // ─── Local state ───────────────────────────────────────────
  const [savedSnapshot, setSavedSnapshot] = useState<SharedDataSource[]>(() => deepClone(sharedDataSources));
  const [showPopulateFromApi, setShowPopulateFromApi] = useState(false);
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [createTestName, setCreateTestName] = useState('');
  const [createTestTargetFgId, setCreateTestTargetFgId] = useState('');
  const [createTestTargetScId, setCreateTestTargetScId] = useState('');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const selected = listPanel.selected;

  // ─── Name input focus effect ───────────────────────────────
  const { pendingNameFocusId, setPendingNameFocusId } = listPanel;
  useEffect(() => {
    if (!pendingNameFocusId || selected?.id !== pendingNameFocusId) return;
    if (!nameInputRef.current) return;
    nameInputRef.current.focus();
    nameInputRef.current.select();
    setPendingNameFocusId(null);
  }, [pendingNameFocusId, selected, setPendingNameFocusId]);

  const isDirty = useMemo(() => {
    return JSON.stringify(sharedDataSources) !== JSON.stringify(savedSnapshot);
  }, [sharedDataSources, savedSnapshot]);

  // ─── Wizard apply handler ──────────────────────────────────
  const handleWizardApply = useCallback((dataTable: DataSource, urlTemplate: string, options?: { auth?: Scenario['auth'] }) => {
    if (!selected) return;
    const pathVariables = extractPathVariablesFromUrlTemplate(urlTemplate);
    onUpdate(sharedDataSources.map(ds =>
      ds.id === selected.id
        ? {
            ...ds,
            dataSource: dataTable,
            fetchConfig: {
              ...(ds.fetchConfig ?? defaultFetchConfig()),
              url: urlTemplate || (ds.fetchConfig?.url ?? ''),
              pathVariables: pathVariables.length > 0 ? pathVariables : undefined,
              auth: options?.auth ?? (ds.fetchConfig?.auth ?? { type: 'none' }),
            },
            updatedAt: Date.now(),
          }
        : ds,
    ));
    fetchConfig.setShowSetupWizard(false);
  }, [selected, sharedDataSources, onUpdate, fetchConfig]);

  // ─── Populate from API handler ─────────────────────────────
  const handlePopulateFromApiApply = useCallback((output: SharedDsFetchOutput) => {
    if (!selected) return;
    const current = selected.dataSource;
    const nextRows = output.mode === 'replace' ? output.rows : [...current.rows, ...output.rows];
    const nextDataSource: DataSource = {
      ...current,
      columns: output.columns,
      rows: nextRows,
    };
    onUpdate(sharedDataSources.map(ds =>
      ds.id === selected.id ? { ...ds, dataSource: nextDataSource, updatedAt: Date.now() } : ds,
    ));
    setShowPopulateFromApi(false);
  }, [selected, sharedDataSources, onUpdate]);

  const populateDepsRef = useRef({ fetchDraftScenario: editorPanel.fetchDraftScenario, selected, handleFetchRow: editorPanel.handleFetchRow });
  populateDepsRef.current = { fetchDraftScenario: editorPanel.fetchDraftScenario, selected, handleFetchRow: editorPanel.handleFetchRow };

  const populateAdapter = useMemo(() => {
    if (!showPopulateFromApi || !editorPanel.fetchDraftScenario || !selected) return null;
    const dataTable = selected.dataSource;
    return createSharedDsFetchAdapter({
      dataSource: dataTable,
      fetchConfig: selected.fetchConfig,
      fetchSampleData: async () => {
        const { fetchDraftScenario: draftScenario, selected: sel, handleFetchRow } = populateDepsRef.current;
        if (!draftScenario || !sel) throw new Error('Fetch configuration unavailable');
        const table = sel.dataSource;
        const firstRow = table.rows.find(r => r.enabled);
        const resolved = firstRow
          ? resolveScenarioFromDataRow(draftScenario, table.columns, firstRow, 0)
          : draftScenario;
        const headers = buildHeaders(resolved);
        const baseBody = resolved.body || '';
        const unresolved = findUnresolvedTokens(resolved.url, baseBody || undefined, headers);
        if (unresolved.length > 0) {
          throw new Error(`Unresolved variables: ${unresolved.join(', ')}. Fill the first enabled row before fetching.`);
        }
        const result = await handleFetchRow(
          resolved.url, resolved.method, headers, baseBody || undefined,
        );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPopulateFromApi, selected]);

  // ─── Render ────────────────────────────────────────────────
  return (
    <AppModalFrame
      title={<><span style={{ marginRight: 6 }}>📦</span> Shared Data Sources</>}
      onClose={() => isDirty ? setShowSaveConfirm(true) : onClose()}
      overlayClassName="shared-ds-overlay modal-overlay"
      dialogClassName="shared-ds-modal modal"
      headerClassName="shared-ds-header modal-header"
      bodyClassName="shared-ds-body-wrapper"
      showExpandButton={false}
      closeButtonKind="none"
      closeOnOverlayClick={false}
      disableDrag
      constrainDragToViewport
      dragViewportPadding={12}
      minWidth={980}
      minHeight={560}
      footerContent={() => (
        <div className="shared-ds-footer">
          <span className="shared-ds-footer-stats">
            {sharedDataSources.length} shared data source{sharedDataSources.length !== 1 ? 's' : ''} · {crud.totalRows} total rows
          </span>
          <button
            className="btn btn-sm"
            onClick={() => {
              onUpdate(deepClone(savedSnapshot));
              if (!savedSnapshot.find(ds => ds.id === listPanel.selectedId)) {
                listPanel.setSelectedId(savedSnapshot[0]?.id ?? null);
              }
            }}
            disabled={!isDirty}
          >
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setSavedSnapshot(deepClone(sharedDataSources))}
            disabled={!isDirty}
          >
            Save
          </button>
          <button className="btn btn-sm" onClick={() => isDirty ? setShowSaveConfirm(true) : onClose()}>Close</button>
        </div>
      )}
    >
      <div className="shared-ds-body">
        {/* ─── Left: List Panel ─── */}
        {!listPanel.listPanelCollapsed && (
          <div className="shared-ds-list-panel" style={{ width: `${listPanel.listPanelWidth}px` }}>
            <button className="btn btn-primary btn-sm shared-ds-new-btn" onClick={crud.handleCreate}>
              + New
            </button>

            <input
              className="shared-ds-list-search"
              type="text"
              placeholder="Search…"
              value={listPanel.listSearch}
              onChange={e => listPanel.setListSearch(e.target.value)}
            />

            <div className="shared-ds-list">
              {listPanel.filteredList.length === 0 && (
                <div className="shared-ds-list-empty">
                  {sharedDataSources.length === 0 ? 'No shared data sources yet' : 'No matches'}
                </div>
              )}
              {listPanel.filteredList.map(ds => (
                <div
                  key={ds.id}
                  className={`shared-ds-list-item ${ds.id === listPanel.selectedId ? 'active' : ''}`}
                  onClick={() => { listPanel.setSelectedId(ds.id); listPanel.setContextMenuId(null); }}
                >
                  {listPanel.renamingId === ds.id ? (
                    <input
                      className="shared-ds-rename-input"
                      value={listPanel.renameValue}
                      onChange={e => listPanel.setRenameValue(e.target.value)}
                      onBlur={() => listPanel.handleRename(ds.id, listPanel.renameValue)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') listPanel.handleRename(ds.id, listPanel.renameValue);
                        // Escape cancels the rename only; don't let the modal close too.
                        if (e.key === 'Escape') { e.preventDefault(); listPanel.cancelRenaming(); }
                      }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="shared-ds-list-name">{ds.name}</span>
                      <div className="shared-ds-list-meta">
                        <span className="shared-ds-list-count">{ds.dataSource?.rows.length ?? 0} rows</span>
                        <button
                          className="btn-icon shared-ds-list-menu-btn"
                          onClick={e => { e.stopPropagation(); listPanel.setContextMenuId(listPanel.contextMenuId === ds.id ? null : ds.id); }}
                          title="More"
                        >
                          ⋯
                        </button>
                      </div>
                    </>
                  )}
                  {listPanel.contextMenuId === ds.id && (
                    <div className="shared-ds-context-menu">
                      <button onClick={() => listPanel.startRenaming(ds.id, ds.name)}>Rename</button>
                      <button onClick={() => crud.handleDuplicate(ds.id)}>Duplicate</button>
                      <button className="danger" onClick={() => crud.handleDelete(ds.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div
              className="shared-ds-resize-handle"
              onMouseDown={listPanel.handleResizeMouseDown}
              title="Drag to resize"
            />
          </div>
        )}

        {/* ─── Collapse/Expand Toggle ─── */}
        <button
          type="button"
          className="shared-ds-panel-toggle"
          onClick={() => listPanel.setListPanelCollapsed(!listPanel.listPanelCollapsed)}
          title={listPanel.listPanelCollapsed ? 'Show list panel' : 'Hide list panel'}
        >
          {listPanel.listPanelCollapsed ? '▶' : '◀'}
        </button>

        {/* ─── Right: Editor Panel ─── */}
        <div className="shared-ds-editor-panel">
          {selected ? (
            <>
              <div className="shared-ds-editor-header">
                <input
                  ref={nameInputRef}
                  className="shared-ds-name-input"
                  value={selected.name}
                  onChange={e => crud.handleNameChange(e.target.value)}
                  placeholder="Data source name"
                />
                <span className="shared-ds-updated">{formatRelativeTime(selected.updatedAt)}</span>
              </div>

              <SharedDsFetchPanel
                selected={selected}
                fetchConfig={fetchConfig}
                editorPanel={editorPanel}
                onShowPopulateFromApi={() => setShowPopulateFromApi(true)}
                onOpenCreateTestModal={onCreateTestFromSharedDs ? () => {
                  setCreateTestName(`Test from ${selected.name}`);
                  setCreateTestTargetFgId(featureGroups[0]?.id ?? '');
                  setCreateTestTargetScId(featureGroups[0]?.scenarios[0]?.id ?? '');
                  setShowCreateTestModal(true);
                } : undefined}
              />

              {/* Tags display */}
              {selected.tags && selected.tags.length > 0 && (
                <div className="shared-ds-tags">
                  {selected.tags.map(tag => (
                    <span key={tag} className="shared-ds-tag">{tag}</span>
                  ))}
                </div>
              )}

              {/* Data table editor */}
              <div className="shared-ds-editor-content">
                {editorPanel.editorDraft && (
                  <DataSourceEditor
                    draft={editorPanel.editorDraft}
                    onDraftChange={editorPanel.handleEditorDraftChange}
                    onFetchRow={editorPanel.handleFetchRow}
                  />
                )}
              </div>

              {/* Used by section - always shown so empty state is visible */}
              <div className={`shared-ds-used-by ${editorPanel.usedByExpanded ? 'expanded' : ''}`}>
                <button
                  type="button"
                  className="shared-ds-used-by-toggle"
                  onClick={() => editorPanel.setUsedByExpanded(!editorPanel.usedByExpanded)}
                >
                  <span className="shared-ds-used-by-arrow">{editorPanel.usedByExpanded ? '▼' : '▶'}</span>
                  <span className="shared-ds-used-by-label">
                    Used by {(crud.usedByMap.get(selected.id) ?? []).length} test(s)
                  </span>
                </button>
                {editorPanel.usedByExpanded && (
                  <div className="shared-ds-used-by-list">
                    {(crud.usedByMap.get(selected.id) ?? []).length === 0 ? (
                      <span className="shared-ds-used-by-empty">No linked tests yet</span>
                    ) : (
                      (crud.usedByMap.get(selected.id) ?? []).map((ref, i) => (
                        <span
                          key={i}
                          className={`shared-ds-used-by-ref ${ref.isEditing ? 'editing' : ''}`}
                          title={ref.fullPath}
                        >
                          {ref.testName}{ref.isEditing ? ' ✎' : ''}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="shared-ds-editor-empty">
              <div className="shared-ds-empty-icon">📦</div>
              <div>Create a shared data source to get started</div>
              <div className="shared-ds-empty-hint">
                Shared data sources live at the environment → microservice level.
                Any parameterized test across all feature groups can use them.
              </div>
              {sharedDataSources.length === 0 && (
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={crud.handleCreate}>
                  + Create First Shared Data Source
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showPopulateFromApi && populateAdapter && (
        <DataMapperModal<SharedDsFetchOutput>
          adapter={populateAdapter}
          onSave={handlePopulateFromApiApply}
          onCancel={() => setShowPopulateFromApi(false)}
          contextScope={selected?.id}
        />
      )}

      {fetchConfig.showSetupWizard && fetchConfig.wizardScenario && (
        <DataSourceSetupModal
          test={fetchConfig.wizardScenario}
          mode="parameterize"
          onApply={handleWizardApply}
          onFetchRow={editorPanel.handleFetchRow}
          sourceName={selected?.name ?? fetchConfig.wizardScenario.name}
          onClose={() => fetchConfig.setShowSetupWizard(false)}
        />
      )}

      {crud.pendingDeleteId && (
        <ConfirmModal
          title="Delete Data Source"
          message={`This data source is used by ${(crud.usedByMap.get(crud.pendingDeleteId) ?? []).length} test(s). Delete anyway?`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={crud.confirmDelete}
          onCancel={() => crud.setPendingDeleteId(null)}
        />
      )}

      {showCreateTestModal && selected && onCreateTestFromSharedDs && (
        <PopupModal
          title="Create Test from Shared Data Source"
          onClose={() => setShowCreateTestModal(false)}
          dialogClassName="create-test-modal"
          footer={(
            <>
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={() => setShowCreateTestModal(false)}>Cancel</button>
              <button
                className="btn"
                disabled={!createTestName.trim() || !createTestTargetFgId || !createTestTargetScId}
                onClick={() => {
                  onCreateTestFromSharedDs(selected, createTestTargetFgId, createTestTargetScId, createTestName.trim(), true);
                  setShowCreateTestModal(false);
                  onClose();
                }}
                title="Create the test, then immediately open the Configure wizard to review path variables and columns"
              >
                Create + Open Parameterize Wizard
              </button>
              <button
                className="btn btn-primary"
                disabled={!createTestName.trim() || !createTestTargetFgId || !createTestTargetScId}
                onClick={() => {
                  onCreateTestFromSharedDs(selected, createTestTargetFgId, createTestTargetScId, createTestName.trim());
                  setShowCreateTestModal(false);
                  onClose();
                }}
              >
                Create Test
              </button>
            </>
          )}
        >
          <div className="popup-modal-field">
            <label>Test Name</label>
            <input
              type="text"
              value={createTestName}
              onChange={e => setCreateTestName(e.target.value)}
              placeholder="Enter test name"
              autoFocus
            />
          </div>
          <div className="popup-modal-field">
            <label>Target Feature Group</label>
            <CustomSelect
              value={createTestTargetFgId}
              onChange={(v) => {
                setCreateTestTargetFgId(v);
                const fg = featureGroups.find((f) => f.id === v);
                setCreateTestTargetScId(fg?.scenarios[0]?.id ?? '');
              }}
              options={featureGroups.map((fg) => ({ value: fg.id, label: fg.name }))}
            />
          </div>
          <div className="popup-modal-field">
            <label>Target Scenario</label>
            <CustomSelect
              value={createTestTargetScId}
              onChange={(v) => setCreateTestTargetScId(v)}
              options={(featureGroups.find((f) => f.id === createTestTargetFgId)?.scenarios ?? []).map((sc) => ({
                value: sc.id,
                label: sc.name,
              }))}
            />
          </div>
          <div className="popup-modal-preview">
            <div className="preview-row"><span className="preview-label">Data Source:</span> {selected.name}</div>
            <div className="preview-row"><span className="preview-label">Rows:</span> {selected.dataSource.rows.length}</div>
            <div className="preview-row"><span className="preview-label">URL:</span> <code style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{selected.fetchConfig?.url || '(not set)'}</code></div>
          </div>
        </PopupModal>
      )}

      {showSaveConfirm && (
        <SharedDsSaveConfirmModal
          before={savedSnapshot}
          after={sharedDataSources}
          featureGroups={featureGroups}
          onSave={() => {
            setSavedSnapshot(deepClone(sharedDataSources));
            setShowSaveConfirm(false);
            onClose();
          }}
          onDiscard={() => {
            onUpdate(deepClone(savedSnapshot));
            setShowSaveConfirm(false);
            onClose();
          }}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}
    </AppModalFrame>
  );
}
