import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestScenario, FeatureGroup } from '@shared/types';
import type { ScenarioBuilderProps } from './scenarioBuilderTypes';
import type { MoveType, MoveTarget } from './components/MoveModal';
import { useAuthVerify } from '../requests/hooks/useAuthVerify';
import { useScenarioBuilderSearch } from './hooks/useScenarioBuilderSearch';
import { useScenarioExportImport } from './hooks/useScenarioExportImport';
import { useScenarioDragDrop } from './hooks/useScenarioDragDrop';
import { useScenarioMutations } from './hooks/useScenarioMutations';
import { useTrash } from './hooks/useTrash';
import ScenarioBuilderModals from './components/ScenarioBuilderModals';
import ExportOptionsPopover from './components/ExportOptionsPopover';
import type { VersionExportOptions } from './utils/scenarioImportExport';
import { buildFeatureAuthTypeOptions, resolveEffectiveAuth } from './utils/scenarioBuilderUtils';
import { useScenarioTags } from './hooks/useScenarioTags';
import { useSharedDataSourceHandlers } from './hooks/useSharedDataSourceHandlers';
import ScenarioContextMenu from './components/ScenarioContextMenu';
import TestSlaModal from './components/TestSlaModal';
import ScenarioBuilderUnassociatedSection from './components/ScenarioBuilderUnassociatedSection';
import { ScenarioBuilderSearchBar } from './components/ScenarioBuilderSearchBar';
import FeatureGroupCard from './components/FeatureGroupCard';

export default function ScenarioBuilder({ featureGroups, setFeatureGroups, sharedDataSources, setSharedDataSources, resolvedBaseUrl, selectedSvcId, selectedSvcName, selectedEnvId, selectedEnvName, isAdditionalEnv, unassociatedFeatureGroups = [], microservices = [], environments = [], globalAuthProfiles = [], onMoveScenario, onMoveTest, pendingEditTest, onPendingEditConsumed, onLocateRequest }: ScenarioBuilderProps) {
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
    updateScenarioSlaTargets: _updateScenarioSlaTargets,
    updateTestSlaTargets,
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
  const {
    showSharedDsModal, setShowSharedDsModal,
    sharedDsModalSelectedId, setSharedDsModalSelectedId,
    showFromSharedDsPicker, setShowFromSharedDsPicker,
    currentEditingDraft, handlePromoteToShared, handleCreateTestFromSharedDs,
  } = useSharedDataSourceHandlers({
    featureGroups, setFeatureGroups, setSharedDataSources,
    editingTest, draft, setDraft, setEditingTest, setInputMode, setActiveTab,
  });

  const { addTag, removeTag, clearTags, tagSuggestions } = useScenarioTags(featureGroups, setFeatureGroups);
  const [editingTagScenario, setEditingTagScenario] = useState<{ fgId: string; scId: string } | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fgId: string; scId: string } | null>(null);

  const handleCreateParameterizedCopy = useCallback((copy: Scenario, targetFgId?: string, targetScenarioId?: string, newScenarioName?: string) => {
    const fgId = targetFgId || editingTest?.featureId;
    if (!fgId) return;

    // Resolve scenario id before updating App state — never call ScenarioBuilder
    // setState inside the setFeatureGroups updater (that runs in App's update cycle).
    let scId = '';
    if (newScenarioName) {
      scId = uuidv4();
    } else {
      scId = targetScenarioId || editingTest?.scenarioId || '';
      if (!scId) return;
    }

    setFeatureGroups(prev => prev.map(fg => {
      if (fg.id !== fgId) return fg;

      if (newScenarioName) {
        const newScenario = {
          id: scId,
          name: newScenarioName,
          kind: 'parameterized' as const,
          tests: [copy],
        };
        return { ...fg, scenarios: [...fg.scenarios, newScenario] };
      }

      return {
        ...fg,
        scenarios: fg.scenarios.map(sc => {
          if (sc.id !== scId) return sc;
          return { ...sc, tests: [...sc.tests, copy] };
        }),
      };
    }));

    // Close current editor, then open the new test (outside App's setState updater).
    setEditingTest(null);
    setTimeout(() => {
      setDraft(copy);
      setEditingTest({ featureId: fgId, scenarioId: scId, testId: copy.id, parameterized: true });
      setActiveTab('data');
    }, 0);
  }, [editingTest, setFeatureGroups, setEditingTest, setDraft, setActiveTab]);

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

  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const [exportPopover, setExportPopover] = useState<{ id: string; data: unknown; exportFn: (opts: VersionExportOptions) => void } | null>(null);

  const [slaModalTest, setSlaModalTest] = useState<{ fgId: string; scId: string; test: Scenario } | null>(null);

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

  const {
    dragScenario, setDragScenario,
    dragTest, setDragTest,
    dropTarget, setDropTarget,
    handleDragEnd,
  } = useScenarioDragDrop({ setFeatureGroups });
  const dragHandleActive = useRef(false);

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
      <div className="page-header" data-testid="har-page-header">
        <div className="page-title-block">
          <h2>Feature Groups</h2>
          <div className="context-tags">
            {selectedSvcName && <span className="context-tag svc-tag">{selectedSvcName}</span>}
            {selectedEnvName && <span className={`context-tag env-tag${isAdditionalEnv ? ' env-tag-additional' : ''}`}>{selectedEnvName}{isAdditionalEnv && <span className="additional-env-indicator" title="Additional environment (microservice-specific)">+</span>}</span>}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => importAll()} disabled={!selectedSvcId || !selectedEnvId} data-testid="har-import-btn">Import</button>
          <span className="export-opts-anchor">
            <button className="btn" onClick={() => setExportPopover({ id: '__all__', data: featureGroups, exportFn: (o) => { exportAll(o); setExportPopover(null); } })} disabled={featureGroups.length === 0}>Export</button>
            {exportPopover?.id === '__all__' && <ExportOptionsPopover data={exportPopover.data} onExport={exportPopover.exportFn} onClose={() => setExportPopover(null)} />}
          </span>
          <button className="btn" onClick={() => setCsvImportOpen(true)} disabled={!selectedSvcId || !selectedEnvId || featureGroups.length === 0}>Import Template</button>
          <button className="btn" onClick={() => setShowTrashPanel(true)} style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }} data-testid="har-trash-btn">
            Trash
            {trash.trashCount > 0 && <span className="count-badge">{trash.trashCount}</span>}
          </button>
          <button className="btn" onClick={() => setShowSharedDsModal(true)} disabled={!selectedSvcId || !selectedEnvId} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} data-testid="har-shared-ds-btn">
            📦 Shared Data Sources
            {sharedDataSources && sharedDataSources.length > 0 && <span className="count-badge" style={{ background: 'var(--accent)' }}>{sharedDataSources.length}</span>}
          </button>
          <button className="btn btn-primary" onClick={() => { setNamingFeature(true); setNewName(''); }} disabled={!selectedSvcId || !selectedEnvId} data-testid="har-add-fg-btn">+ Add Feature Group</button>
        </div>
      </div>

      {(!selectedSvcId || !selectedEnvId) && (
        <div className="empty-state" data-testid="har-empty-state">Select both a microservice and an environment from the sidebar to view and manage feature groups.</div>
      )}

      {selectedSvcId && selectedEnvId && namingFeature && (
        <div className="inline-name-form">
          <input autoFocus data-testid="har-fg-name-input" value={newName} onChange={(e) => setNewName(e.target.value)}
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
        <ScenarioBuilderSearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          showSearchHelp={showSearchHelp}
          onToggleSearchHelp={() => setShowSearchHelp((v) => !v)}
          isSearching={isSearching}
          matchCount={matchCount}
        />
      )}

      <div className="feature-tree" data-testid="har-feature-tree">
        {featureGroups.filter((fg) => !isSearching || featureMatches(fg)).map((fg) => (
          <FeatureGroupCard
            key={fg.id}
            featureGroup={fg}
            setFeatureGroups={setFeatureGroups}
            expandedFeatures={expandedFeatures}
            expandedScenarios={expandedScenarios}
            isSearching={isSearching}
            editingFeatureName={editingFeatureName}
            editingScenarioName={editingScenarioName}
            editingFeatureAuth={editingFeatureAuth}
            editingScenarioAuth={editingScenarioAuth}
            editName={editName}
            setEditName={setEditName}
            namingScenario={namingScenario}
            newName={newName}
            setNewName={setNewName}
            newScenarioKind={newScenarioKind}
            setNewScenarioKind={setNewScenarioKind}
            showStructureLog={showStructureLog}
            setShowStructureLog={setShowStructureLog}
            exportPopover={exportPopover}
            setExportPopover={setExportPopover}
            editingTagScenario={editingTagScenario}
            setEditingTagScenario={setEditingTagScenario}
            tagInputValue={tagInputValue}
            setTagInputValue={setTagInputValue}
            dragScenario={dragScenario}
            setDragScenario={setDragScenario}
            dragTest={dragTest}
            setDragTest={setDragTest}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            dragHandleActive={dragHandleActive}
            allAuthProfiles={allAuthProfiles}
            sharedDataSources={sharedDataSources}
            featureAuthTypeOptions={featureAuthTypeOptions}
            authVerifying={authVerifying}
            authVerifyResult={authVerifyResult}
            setAuthVerifyResult={setAuthVerifyResult}
            verifyAuth={verifyAuth}
            showSecret={showSecret}
            setShowSecret={setShowSecret}
            tagSuggestions={tagSuggestions}
            toggleFeature={toggleFeature}
            renameFeatureGroup={renameFeatureGroup}
            setEditingFeatureName={setEditingFeatureName}
            toggleFeatureAuth={toggleFeatureAuth}
            updateFeatureAuth={updateFeatureAuth}
            removeFeatureGroup={removeFeatureGroup}
            setNamingScenario={setNamingScenario}
            addScenario={addScenario}
            importScenariosInto={importScenariosInto}
            exportFeatureGroup={exportFeatureGroup}
            toggleScenario={toggleScenario}
            renameScenario={renameScenario}
            setEditingScenarioName={setEditingScenarioName}
            setContextMenu={setContextMenu}
            removeTag={removeTag}
            addTag={addTag}
            toggleScenarioAuth={toggleScenarioAuth}
            updateScenarioAuth={updateScenarioAuth}
            startNewTest={startNewTest}
            startNewParameterizedTest={startNewParameterizedTest}
            setShowFromSharedDsPicker={setShowFromSharedDsPicker}
            setMoveDialog={setMoveDialog}
            importTestsInto={importTestsInto}
            exportScenario={exportScenario}
            removeScenario={removeScenario}
            handleDragEnd={handleDragEnd}
            scenarioMatches={scenarioMatches}
            testMatches={testMatches}
            getEffectiveAuth={getEffectiveAuth}
            onLocateRequest={onLocateRequest}
            setSlaModalTest={setSlaModalTest}
            startEditTest={startEditTest}
            startCopyTest={startCopyTest}
            createParameterizedCopy={createParameterizedCopy}
            removeTest={removeTest}
            exportTest={exportTest}
          />
        ))}
      </div>

      {featureGroups.length > 0 && (
        <div className="tree-summary" data-testid="har-tree-summary">
          {featureGroups.length} feature group{featureGroups.length !== 1 ? 's' : ''} &middot; {featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0)} scenario{featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0) !== 1 ? 's' : ''} &middot; {totalTests} test{totalTests !== 1 ? 's' : ''}
        </div>
      )}

      <ScenarioBuilderUnassociatedSection
        unassociatedFeatureGroups={unassociatedFeatureGroups}
        selectedSvcId={selectedSvcId}
        selectedEnvId={selectedEnvId}
        assignFeatureGroup={assignFeatureGroup}
        removeFeatureGroup={removeFeatureGroup}
        microservices={microservices}
        environments={environments}
        showConfirm={showConfirm}
      />

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

      {slaModalTest && (
        <TestSlaModal
          test={slaModalTest.test}
          onSave={(targets) => updateTestSlaTargets(slaModalTest.fgId, slaModalTest.scId, slaModalTest.test.id, targets)}
          onClose={() => setSlaModalTest(null)}
        />
      )}
    </div>
  );
}

