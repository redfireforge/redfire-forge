import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestScenario, FeatureGroup, Microservice, AuthType, GlobalAuthProfile, SharedDataSource, DataSource, KeyValue, AuthConfig } from '../../shared/types';
import type { MoveType, MoveTarget } from './components/MoveModal';
import { useAuthVerify } from '../requests/hooks/useAuthVerify';
import { useScenarioBuilderSearch } from './hooks/useScenarioBuilderSearch';
import AuthConfigPanel from '../requests/components/AuthConfigPanel';
import { useScenarioExportImport } from './hooks/useScenarioExportImport';
import { useScenarioDragDrop } from './hooks/useScenarioDragDrop';
import { useScenarioMutations } from './hooks/useScenarioMutations';
import { useTrash } from './hooks/useTrash';
import ScenarioBuilderModals from './components/ScenarioBuilderModals';
import { buildScenarioInheritHint, resolveScenarioInheritedAuth } from './utils/scenarioAuth';
import ExportOptionsPopover from './components/ExportOptionsPopover';
import type { VersionExportOptions } from './utils/scenarioImportExport';
import { deleteLogEntry, clearLog } from './utils/structureChangeLog';
import StructureChangeLogPanel from './components/StructureChangeLogPanel';
import { SCENARIO_AUTH_TYPE_OPTIONS, buildFeatureAuthTypeOptions, resolveEffectiveAuth } from './utils/scenarioBuilderUtils';
import { useScenarioTags } from './hooks/useScenarioTags';
import ScenarioContextMenu from './components/ScenarioContextMenu';

interface Props {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  sharedDataSources?: SharedDataSource[];
  setSharedDataSources?: React.Dispatch<React.SetStateAction<SharedDataSource[]>>;
  resolvedBaseUrl?: string;
  selectedSvcId?: string;
  selectedSvcName?: string;
  selectedEnvId?: string;
  selectedEnvName?: string;
  isAdditionalEnv?: boolean;
  unassociatedFeatureGroups?: FeatureGroup[];
  microservices?: Microservice[];
  environments?: { id: string; name: string }[];
  globalAuthProfiles?: GlobalAuthProfile[];
  onMoveScenario?: (scenarioId: string, sourceFgId: string, targetFgId: string) => void;
  onMoveTest?: (testId: string, sourceScenarioId: string, sourceFgId: string, targetScenarioId: string, targetFgId: string) => void;
  pendingEditTest?: { featureId: string; scenarioId: string; testId: string };
  onPendingEditConsumed?: () => void;
  onLocateRequest?: (requestId: string) => void;
}

export default function ScenarioBuilder({ featureGroups, setFeatureGroups, sharedDataSources, setSharedDataSources, resolvedBaseUrl, selectedSvcId, selectedSvcName, selectedEnvId, selectedEnvName, isAdditionalEnv, unassociatedFeatureGroups = [], microservices = [], environments = [], globalAuthProfiles = [], onMoveScenario, onMoveTest, pendingEditTest, onPendingEditConsumed, onLocateRequest }: Props) {
  const allAuthProfiles = globalAuthProfiles;

  const featureAuthTypeOptions = useMemo(
    () => buildFeatureAuthTypeOptions(allAuthProfiles),
    [allAuthProfiles]
  );

  const getEffectiveAuth = useCallback(
    (t: Scenario, sc: TestScenario, fg: FeatureGroup) => resolveEffectiveAuth(t, sc, fg, allAuthProfiles),
    [allAuthProfiles]
  );

  const { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth } = useAuthVerify();
  const [showSecret, setShowSecret] = useState(false);

  const trash = useTrash({
    featureGroups, setFeatureGroups,
    sharedDataSources: sharedDataSources ?? [],
    setSharedDataSources: setSharedDataSources ?? (() => {}),
    environments: environments ?? [],
    microservices: microservices ?? [],
  });

  const mutations = useScenarioMutations({
    featureGroups, setFeatureGroups, unassociatedFeatureGroups, selectedSvcId, selectedEnvId,
    clearAuthVerifyResult: () => setAuthVerifyResult(null),
    moveToTrash: trash.moveToTrash,
  });
  const {
    expandedFeatures, expandedScenarios,
    namingFeature, setNamingFeature,
    namingScenario, setNamingScenario,
    newName, setNewName,
    newScenarioKind, setNewScenarioKind,
    editingFeatureName, setEditingFeatureName,
    editingScenarioName, setEditingScenarioName,
    editName, setEditName,
    editingFeatureAuth, setEditingFeatureAuth: _setEditingFeatureAuth,
    editingScenarioAuth, setEditingScenarioAuth: _setEditingScenarioAuth,
    editingTest, setEditingTest,
    draft, setDraft,
    inputMode, setInputMode,
    activeTab, setActiveTab,
    confirmDialog, setConfirmDialog,
    copyingTest, setCopyingTest,
    addFeatureGroup, assignFeatureGroup, removeFeatureGroup, renameFeatureGroup,
    addScenario, removeScenario, renameScenario,
    updateFeatureAuth, toggleFeatureAuth,
    updateScenarioAuth, toggleScenarioAuth,
    startNewTest, startNewParameterizedTest, startEditTest, saveTest, removeTest,
    startCopyTest, confirmCopyTest, createParameterizedCopy,
    handleVersionRestore, handleVersionDelete, handleVersionRename,
    toggleFeature, toggleScenario,
  } = mutations;

  useEffect(() => {
    if (!pendingEditTest) return;
    const fg = featureGroups.find(f => f.id === pendingEditTest.featureId);
    const sc = fg?.scenarios.find(s => s.id === pendingEditTest.scenarioId);
    const test = sc?.tests.find(t => t.id === pendingEditTest.testId);
    if (test) {
      startEditTest(fg!.id, sc!.id, test);
    }
    onPendingEditConsumed?.();
  }, [pendingEditTest]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showStructureLog, setShowStructureLog] = useState<string | null>(null);
  const [showTrashPanel, setShowTrashPanel] = useState(false);
  const [showSharedDsModal, setShowSharedDsModal] = useState(false);
  const [sharedDsModalSelectedId, setSharedDsModalSelectedId] = useState<string | undefined>(undefined);
  const [showFromSharedDsPicker, setShowFromSharedDsPicker] = useState<{ fgId: string; scId: string } | null>(null);

  // Tag management
  const { addTag, removeTag, clearTags, tagSuggestions } = useScenarioTags(featureGroups, setFeatureGroups);
  const [editingTagScenario, setEditingTagScenario] = useState<{ fgId: string; scId: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fgId: string; scId: string } | null>(null);

  // Current editing draft context for SharedDataSourceModal "Used by" lookup
  const currentEditingDraft = useMemo(() => {
    if (!editingTest || !draft) return undefined;
    const fg = featureGroups.find(f => f.id === editingTest.featureId);
    const sc = fg?.scenarios.find(s => s.id === editingTest.scenarioId);
    if (!fg || !sc) return undefined;
    return { fgName: fg.name, scenarioName: sc.name, test: draft };
  }, [editingTest, draft, featureGroups]);

  // Handler for creating a parameterized copy from the wizard
  const handleCreateParameterizedCopy = useCallback((copy: Scenario, targetFgId?: string, targetScenarioId?: string) => {
    const fgId = targetFgId || editingTest?.featureId;
    const scId = targetScenarioId || editingTest?.scenarioId;
    if (!fgId || !scId) return;

    // Add the copy to the target scenario's tests
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          return { ...sc, tests: [...sc.tests, copy] };
        }),
      };
    }));

    // Close current editor, then open the new test
    setEditingTest(null);
    setTimeout(() => {
      setDraft(copy);
      setEditingTest({ featureId: fgId, scenarioId: scId, testId: copy.id, parameterized: true });
      setActiveTab('data');
    }, 0);
  }, [editingTest, setFeatureGroups, setEditingTest, setDraft, setActiveTab]);

  // Handler for promoting inline data to a shared data source
  const handlePromoteToShared = useCallback((
    dataSource: DataSource,
    name: string,
    tags?: string[],
    fetchConfig?: { url: string; method: string; headers: KeyValue[]; auth?: AuthConfig }
  ): string => {
    if (!setSharedDataSources) {
      console.warn('handlePromoteToShared: setSharedDataSources not available');
      return '';
    }
    const newSharedDs: SharedDataSource = {
      id: uuidv4(),
      name,
      tags,
      dataSource,
      updatedAt: Date.now(),
      fetchConfig: fetchConfig ? {
        url: fetchConfig.url,
        method: (fetchConfig.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') || 'GET',
        headers: fetchConfig.headers || [],
        auth: fetchConfig.auth,
      } : undefined,
    };
    setSharedDataSources(prev => [...prev, newSharedDs]);
    return newSharedDs.id;
  }, [setSharedDataSources]);

  // Handler for creating a test from a shared data source
  const handleCreateTestFromSharedDs = useCallback((
    sharedDs: SharedDataSource,
    targetFgId: string,
    targetScenarioId: string,
    testName: string
  ) => {
    const newTest: Scenario = {
      id: uuidv4(),
      name: testName,
      url: sharedDs.fetchConfig?.url || '',
      method: sharedDs.fetchConfig?.method || 'GET',
      headers: sharedDs.fetchConfig?.headers || [],
      body: '',
      auth: sharedDs.fetchConfig?.auth || { type: 'none' },
      validation: { mode: 'none' },
      sharedDataSourceId: sharedDs.id,
    };
    // Add the new test to the target scenario
    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== targetFgId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== targetScenarioId) return sc;
          return { ...sc, tests: [...sc.tests, newTest] };
        }),
      };
    }));
    // Open the test editor
    setDraft(newTest);
    setEditingTest({ featureId: targetFgId, scenarioId: targetScenarioId, testId: newTest.id, parameterized: true });
    setInputMode('builder');
    setActiveTab('data');
  }, [setFeatureGroups, setDraft, setEditingTest, setInputMode, setActiveTab]);

  // Move dialog state
  const [moveDialog, setMoveDialog] = useState<{
    type: MoveType;
    itemName: string;
    fgId: string;
    scenarioId?: string;
    testId?: string;
    fgEnvironmentId?: string;
    fgMicroserviceId?: string;
    fgAuthProfileId?: string;
  } | null>(null);

  // CSV Import modal state
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  // Export popover state: tracks which item's export popover is open
  const [exportPopover, setExportPopover] = useState<{ id: string; data: unknown; exportFn: (opts: VersionExportOptions) => void } | null>(null);

  // ── Export / Import (extracted hook) ──
  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ title, message, onConfirm: () => { onConfirm(); setConfirmDialog(null); } });
  }, [setConfirmDialog]);
  const {
    exportAll, importAll, handleCsvImport,
    exportFeatureGroup, importScenariosInto,
    exportScenario, importTestsInto, exportTest,
    pendingImport, cancelPendingImport,
  } = useScenarioExportImport({
    featureGroups, setFeatureGroups,
    sharedDataSources, setSharedDataSources,
    selectedSvcId, selectedSvcName, selectedEnvId, selectedEnvName,
    setCsvImportOpen,
    confirm: showConfirm,
  });

  const {
    searchQuery,
    setSearchQuery,
    showSearchHelp,
    setShowSearchHelp,
    isSearching,
    testMatches,
    scenarioMatches,
    featureMatches,
    matchCount,
  } = useScenarioBuilderSearch(featureGroups);

  // ── Drag-and-drop (extracted hook) ──
  const {
    dragScenario, setDragScenario,
    dragTest, setDragTest,
    dropTarget, setDropTarget,
    handleDragEnd,
  } = useScenarioDragDrop({ setFeatureGroups });
  const dragHandleActive = useRef(false);

  // load/save is handled by App.tsx to avoid overwriting unfiltered groups

  const totalTests = featureGroups.reduce((sum, fg) => sum + fg.scenarios.reduce((s2, sc) => s2 + sc.tests.length, 0), 0);

  const handleMoveConfirm = useCallback((target: MoveTarget) => {
    if (!moveDialog) return;
    const { type, fgId, scenarioId, testId } = moveDialog;

    if (type === 'scenario' && scenarioId && target.fgId && onMoveScenario) {
      onMoveScenario(scenarioId, fgId, target.fgId);
    } else if (type === 'test' && testId && scenarioId && target.fgId && target.scenarioId && onMoveTest) {
      onMoveTest(testId, scenarioId, fgId, target.scenarioId, target.fgId);
    }

    setMoveDialog(null);
  }, [moveDialog, onMoveScenario, onMoveTest]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h2>Feature Groups</h2>
          <div className="context-tags">
            {selectedSvcName && <span className="context-tag svc-tag">{selectedSvcName}</span>}
            {selectedEnvName && <span className={`context-tag env-tag${isAdditionalEnv ? ' env-tag-additional' : ''}`}>{selectedEnvName}{isAdditionalEnv && <span className="additional-env-indicator" title="Additional environment (microservice-specific)">+</span>}</span>}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => importAll()} disabled={!selectedSvcId || !selectedEnvId}>Import</button>
          <span className="export-opts-anchor">
            <button className="btn" onClick={() => setExportPopover({ id: '__all__', data: featureGroups, exportFn: (o) => { exportAll(o); setExportPopover(null); } })} disabled={featureGroups.length === 0}>Export</button>
            {exportPopover?.id === '__all__' && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
          </span>
          <button className="btn" onClick={() => setCsvImportOpen(true)} disabled={!selectedSvcId || !selectedEnvId || featureGroups.length === 0}>Import Template</button>
          <button className="btn" onClick={() => setShowTrashPanel(true)} style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}>
            Trash
            {trash.trashCount > 0 && <span className="count-badge">{trash.trashCount}</span>}
          </button>
          <button className="btn" onClick={() => setShowSharedDsModal(true)} disabled={!selectedSvcId || !selectedEnvId} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            📦 Shared Data Sources
            {sharedDataSources && sharedDataSources.length > 0 && <span className="count-badge" style={{ background: 'var(--accent)' }}>{sharedDataSources.length}</span>}
          </button>
          <button className="btn btn-primary" onClick={() => { setNamingFeature(true); setNewName(''); }} disabled={!selectedSvcId || !selectedEnvId}>+ Add Feature Group</button>
        </div>
      </div>

      {(!selectedSvcId || !selectedEnvId) && (
        <div className="empty-state">Select both a microservice and an environment from the sidebar to view and manage feature groups.</div>
      )}

      {selectedSvcId && selectedEnvId && namingFeature && (
        <div className="inline-name-form">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFeatureGroup(); if (e.key === 'Escape') setNamingFeature(false); }}
            placeholder="Feature group name (e.g. Onboarding)" />
          <button className="btn btn-primary btn-sm" onClick={addFeatureGroup} disabled={!newName.trim()}>Create</button>
          <button className="btn btn-sm" onClick={() => setNamingFeature(false)}>Cancel</button>
        </div>
      )}

      {selectedSvcId && selectedEnvId && featureGroups.length === 0 && !namingFeature && (
        <div className="empty-state">No feature groups for this microservice + environment. Click "+ Add Feature Group" to get started.</div>
      )}

      {selectedSvcId && selectedEnvId && featureGroups.length > 0 && (
        <div className="builder-search-wrapper">
          <div className="builder-search-bar">
            <input
              className="builder-search-input"
              type="text"
              placeholder='Search tests, URLs, methods, tags...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <>
                <span className="builder-search-count">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>
                <button className="btn btn-xs btn-ghost" onClick={() => setSearchQuery('')}>Clear</button>
              </>
            )}
            <button className="btn btn-xs btn-ghost" onClick={() => setShowSearchHelp((v) => !v)} title="Search syntax help">?</button>
          </div>
          {showSearchHelp && (
            <div className="search-help">
              <table className="search-help-table">
                <tbody>
                  <tr><td><code>trial</code></td><td>Substring match (case-insensitive)</td></tr>
                  <tr><td><code>"OnStar One"</code></td><td>Exact phrase (word boundary)</td></tr>
                  <tr><td><code>trial AND US</code></td><td>Both terms must match</td></tr>
                  <tr><td><code>trial OR spike</code></td><td>Either term matches</td></tr>
                  <tr><td><code>NOT CA</code> or <code>-CA</code></td><td>Exclude term</td></tr>
                  <tr><td><code>(US OR CA) AND trial</code></td><td>Group with parentheses</td></tr>
                  <tr><td><code>onboard US -FL</code></td><td>Implicit AND between terms</td></tr>
                </tbody>
              </table>
              <div className="search-help-fields">Searches: name, URL, method, headers, body, auth, validation rules &amp; expected values</div>
            </div>
          )}
        </div>
      )}

      <div className="feature-tree">
        {featureGroups.filter((fg) => !isSearching || featureMatches(fg)).map((fg) => (
          <div key={fg.id} className="feature-group-card">
            <div className="feature-group-header" onClick={() => toggleFeature(fg.id)}>
              <span className={`expand-icon ${(expandedFeatures.has(fg.id) || isSearching) ? 'expanded' : ''}`}>&#9654;</span>
              {editingFeatureName === fg.id ? (
                <input className="inline-edit-input" autoFocus value={editName}
                  onClick={(e) => e.stopPropagation()} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') renameFeatureGroup(fg.id); if (e.key === 'Escape') setEditingFeatureName(null); }}
                  onBlur={() => renameFeatureGroup(fg.id)} />
              ) : (
                <strong className="feature-group-name">{fg.name}</strong>
              )}
              {(() => {
                const std = fg.scenarios.filter(sc => sc.kind !== 'parameterized').length;
                const param = fg.scenarios.filter(sc => sc.kind === 'parameterized').length;
                const total = fg.scenarios.length;
                const tests = fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0);
                const fgTags = [...new Set(fg.scenarios.flatMap(sc => sc.tags ?? []))];
                return (
                  <>
                    <span className="count-badge" title={`${std} standard, ${param} parameterized`}>
                      {total} scenario{total !== 1 ? 's' : ''}
                      {total > 0 && <> ({std}S · {param}P)</>}
                    </span>
                    <span className="count-badge">{tests} test{tests !== 1 ? 's' : ''}</span>
                    {fgTags.length > 0 && (
                      <span className="fg-tag-summary" title={`Tags in this group: ${fgTags.join(', ')}`}>
                        {fgTags.length} tag{fgTags.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </>
                );
              })()}
              {fg.auth && fg.auth.type === 'inherit' && fg.globalAuthProfileId && (() => {
                const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
                return profile
                  ? <span className="count-badge auth-badge auth-badge-global">Auth: {profile.name}</span>
                  : <span className="count-badge auth-badge auth-badge-feature">Auth: inherit (missing profile)</span>;
              })()}
              {fg.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit' && <span className="count-badge auth-badge auth-badge-feature">Auth: {fg.auth.type}</span>}
              <div className="feature-group-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-sm" onClick={() => { setEditingFeatureName(fg.id); setEditName(fg.name); }}>Rename</button>
                <button
                  className={`btn btn-sm ${editingFeatureAuth === fg.id ? 'btn-active' : ''}`}
                  onClick={() => toggleFeatureAuth(fg.id)}
                >Auth</button>
                <button className="btn btn-sm" onClick={() => { setNamingScenario(fg.id); setNewName(''); }}>+ Scenario</button>

                <button className="btn btn-sm" onClick={() => importScenariosInto(fg.id)} title="Import scenarios into this feature group">Import</button>
                <span className="export-opts-anchor">
                  <button className="btn btn-sm" onClick={() => setExportPopover({ id: fg.id, data: fg, exportFn: (o) => { exportFeatureGroup(fg, o); setExportPopover(null); } })} title="Export this feature group">Export</button>
                  {exportPopover?.id === fg.id && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
                </span>
                <button
                  className={`btn btn-sm ${showStructureLog === fg.id ? 'btn-active' : ''}`}
                  onClick={() => setShowStructureLog(showStructureLog === fg.id ? null : fg.id)}
                  title="Structure change history"
                >
                  History {(fg.structureLog?.length ?? 0) > 0 && <span className="count-badge">{fg.structureLog!.length}</span>}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
              </div>
            </div>

            {/* Feature-level auth config panel */}
            {editingFeatureAuth === fg.id && (
              <AuthConfigPanel
                panelClassName="scenario-auth-panel feature-auth-panel"
                auth={fg.auth || { type: 'none' as AuthType }}
                onChange={(next) => updateFeatureAuth(fg.id, next)}
                title="Feature Auth"
                hint="Inherited by all scenarios in this feature (unless overridden)"
                showProfileSelector
                globalAuthProfileId={fg.globalAuthProfileId}
                onProfileChange={(profileId) => updateFeatureAuth(fg.id, fg.auth || { type: 'none' }, profileId)}
                allAuthProfiles={allAuthProfiles}
                authVerifying={authVerifying}
                authVerifyResult={authVerifyResult}
                setAuthVerifyResult={setAuthVerifyResult}
                verifyAuth={verifyAuth}
                showSecret={showSecret}
                setShowSecret={setShowSecret}
                authTypeOptions={featureAuthTypeOptions}
              />
            )}

            {/* Structure change log panel */}
            {showStructureLog === fg.id && (
              <StructureChangeLogPanel
                entries={fg.structureLog ?? []}
                onDelete={(entryId) => setFeatureGroups(prev => prev.map(f => f.id === fg.id ? deleteLogEntry(f, entryId) : f))}
                onClear={() => setFeatureGroups(prev => prev.map(f => f.id === fg.id ? clearLog(f) : f))}
              />
            )}

            {(expandedFeatures.has(fg.id) || isSearching) && (
              <div className="feature-group-body">
                {namingScenario === fg.id && (
                  <div className="inline-name-form nested">
                    <div className="scenario-kind-selector">
                      <label className={`kind-option${newScenarioKind === 'standard' ? ' kind-option-active' : ''}`}>
                        <input type="radio" name="scenario-kind" value="standard" checked={newScenarioKind === 'standard'} onChange={() => setNewScenarioKind('standard')} />
                        Standard
                      </label>
                      <label className={`kind-option${newScenarioKind === 'parameterized' ? ' kind-option-active' : ''}`}>
                        <input type="radio" name="scenario-kind" value="parameterized" checked={newScenarioKind === 'parameterized'} onChange={() => setNewScenarioKind('parameterized')} />
                        Parameterized
                      </label>
                    </div>
                    <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addScenario(fg.id); if (e.key === 'Escape') setNamingScenario(null); }}
                      placeholder={newScenarioKind === 'standard' ? 'Scenario name (e.g. Happy Path)' : 'Parameterized scenario name (e.g. User Sweep)'} />
                    <button className="btn btn-primary btn-sm" onClick={() => addScenario(fg.id)} disabled={!newName.trim()}>Create</button>
                    <button className="btn btn-sm" onClick={() => { setNamingScenario(null); setNewScenarioKind('standard'); }}>Cancel</button>
                  </div>
                )}
                {fg.scenarios.length === 0 && namingScenario !== fg.id && (
                  <div
                    className={`empty-hint ${dragScenario && dragScenario.fromFeatureId !== fg.id ? 'drop-zone-active' : ''} ${dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                    onDragOver={(e) => { if (dragScenario) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'scenario', featureId: fg.id }); } }}
                    onDragLeave={() => { if (dropTarget?.featureId === fg.id && !dropTarget.targetId) setDropTarget(null); }}
                    onDrop={handleDragEnd}
                  >
                    {dragScenario ? 'Drop scenario here' : 'No scenarios. Click "+ Scenario" to add one.'}
                  </div>
                )}
                {fg.scenarios.filter((sc) => !isSearching || scenarioMatches(sc)).map((sc) => {
                  const scAuth = sc.auth || { type: 'none' as AuthType };
                  const isScDragOver = dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && dropTarget.targetId === sc.id;
                  const isSelfScDrag = dragScenario?.scenarioId === sc.id && dragScenario?.fromFeatureId === fg.id;
                  return (
                  <div
                    key={`${fg.id}-${sc.id}`}
                    className={`scenario-group-card ${isSelfScDrag ? 'dragging' : ''} ${isScDragOver ? 'drop-target-before' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      if (!dragHandleActive.current) { e.preventDefault(); return; }
                      dragHandleActive.current = false;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', `sc:${fg.id}:${sc.id}`);
                      requestAnimationFrame(() => {
                        setDragScenario({ scenarioId: sc.id, fromFeatureId: fg.id });
                        setDragTest(null);
                      });
                    }}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (!dragScenario || isSelfScDrag) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDropTarget({ type: 'scenario', featureId: fg.id, targetId: sc.id });
                    }}
                  >
                    <div
                      className="scenario-group-header"
                      onClick={() => toggleScenario(sc.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, fgId: fg.id, scId: sc.id });
                      }}
                    >
                      <span className="drag-handle" title="Drag to reorder or move" onMouseDown={() => { dragHandleActive.current = true; }} onMouseUp={() => { dragHandleActive.current = false; }}>⠿</span>
                      <span className={`expand-icon small ${(expandedScenarios.has(sc.id) || isSearching) ? 'expanded' : ''}`}>&#9654;</span>
                      {editingScenarioName === sc.id ? (
                        <input className="inline-edit-input" autoFocus value={editName}
                          onClick={(e) => e.stopPropagation()} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameScenario(fg.id, sc.id); if (e.key === 'Escape') setEditingScenarioName(null); }}
                          onBlur={() => renameScenario(fg.id, sc.id)} />
                      ) : (
                        <span className="scenario-group-name">{sc.name}</span>
                      )}
                      {sc.kind === 'parameterized' && <span className="count-badge kind-badge kind-badge-param">PARAM</span>}
                      <span className="count-badge">{sc.tests.length} test{sc.tests.length !== 1 ? 's' : ''}</span>
                      {scAuth.type !== 'none' && scAuth.type !== 'inherit' && <span className="count-badge auth-badge auth-badge-scenario">Auth: {scAuth.type}</span>}
                      {scAuth.type === 'inherit' && <span className="count-badge auth-badge auth-badge-scenario-inherit">Auth: inherit</span>}
                      {/* Tag pills */}
                      {sc.tags && sc.tags.length > 0 && (
                        <span className="scenario-tag-pills">
                          {sc.tags.map(tag => (
                            <span key={tag} className="scenario-tag-pill" title={`Tag: ${tag}`}>
                              <span className="scenario-tag-pill-text">{tag}</span>
                              <button
                                className="scenario-tag-pill-remove"
                                onClick={(e) => { e.stopPropagation(); removeTag(fg.id, sc.id, tag); }}
                                title={`Remove tag "${tag}"`}
                                aria-label={`Remove tag ${tag}`}
                              >×</button>
                            </span>
                          ))}
                        </span>
                      )}
                      {/* Add tag button/input */}
                      {editingTagScenario?.fgId === fg.id && editingTagScenario?.scId === sc.id ? (
                        <input
                          className="scenario-tag-input"
                          autoFocus
                          list="scenario-tag-suggestions"
                          placeholder="tag name"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            // Auto-submit on datalist selection (value fully matches a suggestion)
                            const val = e.currentTarget.value.trim();
                            if (val && tagSuggestions.includes(val)) {
                              addTag(fg.id, sc.id, val);
                              e.currentTarget.value = '';
                              setEditingTagScenario(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              addTag(fg.id, sc.id, e.currentTarget.value.trim());
                              e.currentTarget.value = '';
                              setEditingTagScenario(null);
                            }
                            if (e.key === 'Escape') setEditingTagScenario(null);
                          }}
                          onBlur={() => setEditingTagScenario(null)}
                        />
                      ) : (
                        <button
                          className="scenario-tag-add-btn"
                          onClick={(e) => { e.stopPropagation(); setEditingTagScenario({ fgId: fg.id, scId: sc.id }); }}
                          title="Add tag"
                          aria-label="Add tag"
                        >+</button>
                      )}
                      <div className="scenario-group-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => { setEditingScenarioName(sc.id); setEditName(sc.name); }}>Rename</button>
                        <button
                          className={`btn btn-sm ${editingScenarioAuth === sc.id ? 'btn-active' : ''}`}
                          onClick={() => toggleScenarioAuth(fg.id, sc.id)}
                        >Auth</button>
                        {sc.kind !== 'parameterized' && (
                          <button className="btn btn-sm" onClick={() => startNewTest(fg.id, sc.id)}>+ Test</button>
                        )}
                        {sc.kind !== 'standard' && (
                          <>
                            <button className="btn btn-sm" onClick={() => startNewParameterizedTest(fg.id, sc.id)} title="Create a new parameterized test with inline data">+ Param Test</button>
                            <button
                              className="btn btn-sm"
                              onClick={() => setShowFromSharedDsPicker({ fgId: fg.id, scId: sc.id })}
                              disabled={!sharedDataSources || sharedDataSources.length === 0}
                              title={!sharedDataSources || sharedDataSources.length === 0 ? 'No shared data sources available' : 'Create test linked to a shared data source'}
                            >
                              + From Shared DS
                            </button>
                          </>
                        )}
                        <button className="btn btn-sm" onClick={() => setMoveDialog({ type: 'scenario', itemName: sc.name, fgId: fg.id, scenarioId: sc.id })} title="Move to another feature group">Move</button>
                        <button className="btn btn-sm" onClick={() => importTestsInto(fg.id, sc.id)} title="Import tests into this scenario">Import</button>
                        <span className="export-opts-anchor">
                          <button className="btn btn-sm" onClick={() => setExportPopover({ id: sc.id, data: sc, exportFn: (o) => { exportScenario(sc, o); setExportPopover(null); } })} title="Export this scenario">Export</button>
                          {exportPopover?.id === sc.id && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
                        </span>
                        <button className="btn btn-sm btn-danger" onClick={() => removeScenario(fg.id, sc.id)}>Delete</button>
                      </div>
                    </div>

                    {/* Scenario-level auth config panel */}
                    {editingScenarioAuth === sc.id && (() => {
                      const inherited = resolveScenarioInheritedAuth(fg, allAuthProfiles);
                      return (
                        <AuthConfigPanel
                          auth={scAuth}
                          onChange={(next) => updateScenarioAuth(fg.id, sc.id, next)}
                          title="Scenario Auth"
                          hint="Applied to all tests in this scenario (unless overridden at test level)"
                          inheritHint={scAuth.type === 'inherit' ? buildScenarioInheritHint(fg, allAuthProfiles) : null}
                          inheritedAuth={inherited?.auth ?? null}
                          inheritedLabel={inherited?.label}
                          allAuthProfiles={allAuthProfiles}
                          authVerifying={authVerifying}
                          authVerifyResult={authVerifyResult}
                          setAuthVerifyResult={setAuthVerifyResult}
                          verifyAuth={verifyAuth}
                          showSecret={showSecret}
                          setShowSecret={setShowSecret}
                          authTypeOptions={SCENARIO_AUTH_TYPE_OPTIONS}
                        />
                      );
                    })()}

                    {(expandedScenarios.has(sc.id) || isSearching) && (
                      <div
                        className="scenario-group-body"
                        onDragOver={(e) => { if (dragTest && sc.tests.length === 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id }); } }}
                        onDrop={() => { if (dragTest && sc.tests.length === 0) handleDragEnd(); }}
                      >
                        {sc.tests.length === 0 && (
                          <div className={`empty-hint ${dragTest ? 'drop-zone-active' : ''} ${dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}>
                            {dragTest ? 'Drop test here' : 'No tests. Click "+ Test" to add an HTTP request.'}
                          </div>
                        )}
                        {sc.tests.filter((t) => !isSearching || testMatches(t)).map((t, tIdx) => {
                          const isTestDragOver = dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && dropTarget.targetId === t.id;
                          const isSelfTestDrag = dragTest?.testId === t.id && dragTest?.fromFeatureId === fg.id && dragTest?.fromScenarioId === sc.id;
                          return (
                          <div
                            key={`${fg.id}-${sc.id}-${t.id}`}
                            className={`test-card ${t.dataSource ? 'test-card-parameterized' : ''} ${isSelfTestDrag ? 'dragging' : ''} ${isTestDragOver ? 'drop-target-before' : ''} ${isSearching && testMatches(t) ? 'search-match' : ''}`}
                            draggable
                            onDragStart={(e) => {
                              if (!dragHandleActive.current) { e.preventDefault(); return; }
                              dragHandleActive.current = false;
                              e.stopPropagation();
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', `t:${fg.id}:${sc.id}:${t.id}`);
                              requestAnimationFrame(() => {
                                setDragTest({ testId: t.id, fromFeatureId: fg.id, fromScenarioId: sc.id });
                                setDragScenario(null);
                              });
                            }}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => { if (dragTest && !isSelfTestDrag) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id, targetId: t.id }); } }}
                          >
                            <div className="test-card-info">
                              <span className="drag-handle" title="Drag to reorder or move" onMouseDown={() => { dragHandleActive.current = true; }} onMouseUp={() => { dragHandleActive.current = false; }}>⠿</span>
                              <span className="test-number">{tIdx + 1}</span>
                              <span className={`method-badge method-${t.method.toLowerCase()}`}>{t.method}</span>
                              {t.dataSource && <span className="tag data-source-badge" title="Has data source">📋</span>}
                              <strong>{t.name}</strong>
                              {t.sourceRequestId && (
                                <span
                                  className={`test-origin-badge${onLocateRequest ? ' test-origin-badge--clickable' : ''}`}
                                  title={`From: ${t.sourceSpecVersionLabel ? `v${t.sourceSpecVersionLabel}` : 'Request'}${onLocateRequest ? ' — click to locate' : ''}`}
                                  onClick={onLocateRequest ? (e) => { e.stopPropagation(); onLocateRequest(t.sourceRequestId!); } : undefined}
                                  role={onLocateRequest ? 'button' : undefined}
                                >
                                  {t.sourceSpecVersionLabel ? `v${t.sourceSpecVersionLabel}` : 'From Requests'}
                                </span>
                              )}
                            </div>
                            <div className="test-card-meta">
                              {t.dataSource && <span className="tag parameterized-tag">Param</span>}
                              {(() => {
                                const resolved = getEffectiveAuth(t, sc, fg);
                                if (!resolved) return <span className="tag auth-badge auth-badge-test-none">Auth: none</span>;
                                const cls = resolved.source === 'own' ? 'auth-badge-test-own'
                                  : resolved.source === 'scenario' ? 'auth-badge-test-scenario'
                                  : resolved.source === 'feature' ? 'auth-badge-test-feature'
                                  : 'auth-badge-test-global';
                                return <span className={`tag auth-badge ${cls}`}>Auth: {resolved.label} ({resolved.source})</span>;
                              })()}
                              <span className="tag">Validation: {t.validation.mode}</span>
                              {(t.validation.assertions ?? []).length > 0 && (() => {
                                const types = new Set((t.validation.assertions ?? []).map(a => a.type));
                                return (
                                  <>
                                    {types.has('status') && <span className="tag assertion-badge assertion-badge-status">Status</span>}
                                    {types.has('responseTime') && <span className="tag assertion-badge assertion-badge-time">SLA</span>}
                                    {types.has('header') && <span className="tag assertion-badge assertion-badge-header">Header</span>}
                                    {types.has('regex') && <span className="tag assertion-badge assertion-badge-regex">Regex</span>}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="test-card-actions">
                              <button className="btn btn-sm" onClick={() => startEditTest(fg.id, sc.id, t)}>Edit</button>
                              <button className="btn btn-sm" onClick={() => startCopyTest(fg.id, sc.id, t)} title="Copy to another scenario">Copy</button>
                              {!t.dataSource && sc.kind !== 'standard' && (
                                <button className="btn btn-sm" onClick={() => createParameterizedCopy(fg.id, sc.id, t)} title="Create a parameterized copy with data source">Parameterize</button>
                              )}
                              <button className="btn btn-sm" onClick={() => setMoveDialog({ type: 'test', itemName: t.name || t.url, fgId: fg.id, scenarioId: sc.id, testId: t.id })} title="Move to another scenario">Move</button>
                              <span className="export-opts-anchor">
                                <button className="btn btn-sm" onClick={() => setExportPopover({ id: t.id, data: t, exportFn: (o) => { exportTest(t, o); setExportPopover(null); } })} title="Export this test">Export</button>
                                {exportPopover?.id === t.id && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
                              </span>
                              <button className="btn btn-sm btn-danger" onClick={() => removeTest(fg.id, sc.id, t.id)}>Delete</button>
                            </div>
                          </div>
                          );
                        })}
                        {dragTest && sc.tests.length > 0 && (
                          <div
                            className={`drop-zone-end drop-zone-end-sm ${dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                            onDragOver={(e) => { if (dragTest) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id }); } }}
                            onDrop={handleDragEnd}
                          >
                            Drop here
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
                {dragScenario && fg.scenarios.length > 0 && (
                  <div
                    className={`drop-zone-end ${dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                    onDragOver={(e) => { if (dragScenario) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'scenario', featureId: fg.id }); } }}
                    onDragLeave={() => { if (dropTarget?.featureId === fg.id && !dropTarget.targetId) setDropTarget(null); }}
                    onDrop={handleDragEnd}
                  >
                    Drop here to add at end
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {featureGroups.length > 0 && (
        <div className="tree-summary">
          {featureGroups.length} feature group{featureGroups.length !== 1 ? 's' : ''} &middot; {featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0)} scenario{featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0) !== 1 ? 's' : ''} &middot; {totalTests} test{totalTests !== 1 ? 's' : ''}
        </div>
      )}

      {unassociatedFeatureGroups.length > 0 && (
        <div className="unassociated-section">
          <h3>Unassigned Feature Groups ({unassociatedFeatureGroups.length})</h3>
          <p className="unassociated-hint">These feature groups need a microservice and environment assignment. {selectedSvcId && selectedEnvId ? 'Click "Assign here" to assign to the current selection.' : 'Select both from the sidebar, or use the dropdowns below.'}</p>
          {unassociatedFeatureGroups.map((fg) => (
            <div key={fg.id} className="unassociated-card">
              <div className="unassociated-info">
                <strong>{fg.name}</strong>
                <span className="count-badge">{fg.scenarios.length} scenario{fg.scenarios.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="unassociated-actions">
                {selectedSvcId && selectedEnvId ? (
                  <button className="btn btn-sm btn-primary" onClick={() => assignFeatureGroup(fg.id, selectedSvcId, selectedEnvId)}>
                    Assign here
                  </button>
                ) : (
                  <>
                    <select id={`svc-${fg.id}`} defaultValue="">
                      <option value="" disabled>Microservice…</option>
                      {microservices.map((svc) => (
                        <option key={svc.id} value={svc.id}>{svc.name}</option>
                      ))}
                    </select>
                    <select id={`env-${fg.id}`} defaultValue="">
                      <option value="" disabled>Environment…</option>
                      {environments.map((env) => (
                        <option key={env.id} value={env.id}>{env.name}</option>
                      ))}
                      {microservices.flatMap(s => (s.customEnvs ?? []).map(ce => (
                        <option key={ce.id} value={ce.id}>{ce.name} ({s.name})</option>
                      )))}
                    </select>
                    <button className="btn btn-sm btn-primary" onClick={() => {
                      const svcEl = document.getElementById(`svc-${fg.id}`) as HTMLSelectElement;
                      const envEl = document.getElementById(`env-${fg.id}`) as HTMLSelectElement;
                      if (svcEl?.value && envEl?.value) assignFeatureGroup(fg.id, svcEl.value, envEl.value);
                      else showConfirm('Assign Error', 'Select both a microservice and an environment.', () => {});
                    }}>Assign</button>
                  </>
                )}

                <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag suggestions datalist */}
      <datalist id="scenario-tag-suggestions">
        {tagSuggestions.map(t => <option key={t} value={t} />)}
      </datalist>

      {/* Tag context menu */}
      {contextMenu && (() => {
        const fg = featureGroups.find(f => f.id === contextMenu.fgId);
        const sc = fg?.scenarios.find(s => s.id === contextMenu.scId);
        if (!sc) return null;
        return (
          <ScenarioContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            scenario={sc}
            tagSuggestions={tagSuggestions}
            onAddTag={(tag) => addTag(contextMenu.fgId, contextMenu.scId, tag)}
            onRemoveTag={(tag) => removeTag(contextMenu.fgId, contextMenu.scId, tag)}
            onClearTags={() => clearTags(contextMenu.fgId, contextMenu.scId)}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}

      <ScenarioBuilderModals
        featureGroups={featureGroups}
        globalAuthProfiles={globalAuthProfiles}
        sharedDataSources={sharedDataSources}
        setSharedDataSources={setSharedDataSources}
        copyingTest={copyingTest}
        setCopyingTest={setCopyingTest}
        confirmCopyTest={confirmCopyTest}
        editingTest={editingTest}
        setEditingTest={setEditingTest}
        draft={draft}
        setDraft={setDraft}
        saveTest={saveTest}
        inputMode={inputMode}
        setInputMode={setInputMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        resolvedBaseUrl={resolvedBaseUrl ?? ''}
        allAuthProfiles={allAuthProfiles}
        exportTest={exportTest}
        handleVersionRestore={handleVersionRestore}
        handleVersionDelete={handleVersionDelete}
        handleVersionRename={handleVersionRename}
        handleCreateParameterizedCopy={handleCreateParameterizedCopy}
        handlePromoteToShared={handlePromoteToShared}
        onOpenSharedDsModal={() => {
          const linkedId = draft.sharedDataSourceId;
          setEditingTest(null);
          setSharedDsModalSelectedId(linkedId ?? undefined);
          setShowSharedDsModal(true);
        }}
        moveDialog={moveDialog}
        setMoveDialog={setMoveDialog}
        handleMoveConfirm={handleMoveConfirm}
        csvImportOpen={csvImportOpen}
        setCsvImportOpen={setCsvImportOpen}
        handleCsvImport={handleCsvImport}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        pendingImport={pendingImport}
        cancelPendingImport={cancelPendingImport}
        showSharedDsModal={showSharedDsModal}
        setShowSharedDsModal={setShowSharedDsModal}
        sharedDsModalSelectedId={sharedDsModalSelectedId}
        setSharedDsModalSelectedId={setSharedDsModalSelectedId}
        currentEditingDraft={currentEditingDraft}
        handleCreateTestFromSharedDs={handleCreateTestFromSharedDs}
        showFromSharedDsPicker={showFromSharedDsPicker}
        setShowFromSharedDsPicker={setShowFromSharedDsPicker}
        showTrashPanel={showTrashPanel}
        setShowTrashPanel={setShowTrashPanel}
        trash={trash}
      />
    </div>
  );
}

