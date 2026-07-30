import type { Scenario, FeatureGroup, GlobalAuthProfile, SharedDataSource, DataSource, KeyValue, AuthConfig, TestDefinitionVersion } from '../../../shared/types';
import type { MoveType, MoveTarget } from './MoveModal';
import type { VersionExportOptions } from '../utils/scenarioImportExport';
import type { PendingImport } from '../hooks/useScenarioExportImport';
import type { UseTrashReturn } from '../hooks/useTrash';
import type { ConfirmDialog } from '../hooks/useScenarioMutations';
import type { TestEditorInputMode, TestEditorTab } from './TestEditorModal';
import MoveModal from './MoveModal';
import CsvImportModal from './CsvImportModal';
import TestEditorModal from './TestEditorModal';
import CopyTestModal from './CopyTestModal';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import ImportVersionModal from './ImportVersionModal';
import SharedDataSourceModal from './SharedDataSourceModal';
import FromSharedDsPickerModal from './FromSharedDsPickerModal';
import TrashPanel from './TrashPanel';
import TrashUndoToast from './TrashUndoToast';

interface EditingTestState {
  featureId: string;
  scenarioId: string;
  testId: string;
  parameterized?: boolean;
  openDataSourceWizard?: boolean;
}

interface CopyingTestState {
  test: Scenario;
  sourceFeatureId: string;
  sourceScenarioId: string;
}

interface MoveDialogState {
  type: MoveType;
  itemName: string;
  fgId: string;
  scenarioId?: string;
  testId?: string;
  fgEnvironmentId?: string;
  fgMicroserviceId?: string;
  fgAuthProfileId?: string;
}

export interface ScenarioBuilderModalsProps {
  featureGroups: FeatureGroup[];
  globalAuthProfiles: GlobalAuthProfile[];
  sharedDataSources?: SharedDataSource[];
  setSharedDataSources?: React.Dispatch<React.SetStateAction<SharedDataSource[]>>;

  copyingTest: CopyingTestState | null;
  setCopyingTest: (v: CopyingTestState | null) => void;
  confirmCopyTest: (targetFgId: string, targetScenarioId: string) => void;

  editingTest: EditingTestState | null;
  setEditingTest: (v: EditingTestState | null) => void;
  draft: Scenario;
  setDraft: (d: Scenario) => void;
  saveTest: () => void;
  inputMode: TestEditorInputMode;
  setInputMode: (m: TestEditorInputMode) => void;
  activeTab: TestEditorTab;
  setActiveTab: (t: TestEditorTab) => void;
  resolvedBaseUrl: string;
  allAuthProfiles: GlobalAuthProfile[];
  exportTest: (t: Scenario, opts?: VersionExportOptions) => void;
  handleVersionRestore: (version: TestDefinitionVersion) => void;
  handleVersionDelete: (versionId: string) => void;
  handleVersionRename: (versionId: string, label: string) => void;
  handleCreateParameterizedCopy: (copy: Scenario, targetFgId?: string, targetScenarioId?: string) => void;
  handlePromoteToShared: (dataSource: DataSource, name: string, tags?: string[], fetchConfig?: { url: string; method: string; headers: KeyValue[]; auth?: AuthConfig }) => string;
  onOpenSharedDsModal: () => void;

  moveDialog: MoveDialogState | null;
  setMoveDialog: (v: MoveDialogState | null) => void;
  handleMoveConfirm: (target: MoveTarget) => void;

  csvImportOpen: boolean;
  setCsvImportOpen: (v: boolean) => void;
  handleCsvImport: (fgId: string, scenarioId: string, tests: Scenario[]) => void;

  confirmDialog: ConfirmDialog | null;
  setConfirmDialog: (v: ConfirmDialog | null) => void;

  pendingImport: PendingImport | null;
  cancelPendingImport: () => void;

  showSharedDsModal: boolean;
  setShowSharedDsModal: (v: boolean) => void;
  sharedDsModalSelectedId: string | undefined;
  setSharedDsModalSelectedId: (v: string | undefined) => void;
  currentEditingDraft?: { fgName: string; scenarioName: string; test: Scenario };
  handleCreateTestFromSharedDs: (sharedDs: SharedDataSource, fgId: string, scId: string, testName: string, openWizard?: boolean) => void;

  showFromSharedDsPicker: { fgId: string; scId: string } | null;
  setShowFromSharedDsPicker: (v: { fgId: string; scId: string } | null) => void;

  showTrashPanel: boolean;
  setShowTrashPanel: (v: boolean) => void;
  trash: UseTrashReturn;
}

export default function ScenarioBuilderModals(props: ScenarioBuilderModalsProps) {
  const {
    featureGroups, globalAuthProfiles, sharedDataSources, setSharedDataSources,
    copyingTest, setCopyingTest, confirmCopyTest,
    editingTest, setEditingTest, draft, setDraft, saveTest,
    inputMode, setInputMode, activeTab, setActiveTab,
    resolvedBaseUrl, allAuthProfiles,
    exportTest, handleVersionRestore, handleVersionDelete, handleVersionRename,
    handleCreateParameterizedCopy, handlePromoteToShared, onOpenSharedDsModal,
    moveDialog, setMoveDialog, handleMoveConfirm,
    csvImportOpen, setCsvImportOpen, handleCsvImport,
    confirmDialog, setConfirmDialog,
    pendingImport, cancelPendingImport,
    showSharedDsModal, setShowSharedDsModal, sharedDsModalSelectedId, setSharedDsModalSelectedId,
    currentEditingDraft, handleCreateTestFromSharedDs,
    showFromSharedDsPicker, setShowFromSharedDsPicker,
    showTrashPanel, setShowTrashPanel, trash,
  } = props;

  return (
    <>
      {copyingTest && (
        <CopyTestModal
          test={copyingTest.test}
          sourceFeatureId={copyingTest.sourceFeatureId}
          sourceScenarioId={copyingTest.sourceScenarioId}
          featureGroups={featureGroups}
          sourceScenarioKind={
            featureGroups.find(fg => fg.id === copyingTest.sourceFeatureId)
              ?.scenarios.find(sc => sc.id === copyingTest.sourceScenarioId)?.kind
          }
          onConfirm={confirmCopyTest}
          onClose={() => setCopyingTest(null)}
        />
      )}

      {editingTest && (
        <TestEditorModal
          key={`${editingTest.featureId}-${editingTest.scenarioId}-${editingTest.testId}-${draft.id}`}
          draft={draft}
          onDraftChange={(d) => setDraft(d)}
          onSave={saveTest}
          onCancel={() => setEditingTest(null)}
          isNew={editingTest.testId === 'new'}
          isParameterized={editingTest.parameterized ?? false}
          scenarioKind={featureGroups.find(f => f.id === editingTest.featureId)?.scenarios.find(s => s.id === editingTest.scenarioId)?.kind}
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          resolvedBaseUrl={resolvedBaseUrl}
          allAuthProfiles={allAuthProfiles}
          featureGroups={featureGroups}
          editingTest={{ fgId: editingTest.featureId, scenarioId: editingTest.scenarioId, testId: editingTest.testId }}
          onExportTest={(t, opts) => exportTest(t, opts)}
          onVersionRestore={handleVersionRestore}
          onVersionDelete={handleVersionDelete}
          onVersionRename={handleVersionRename}
          onCreateParameterizedCopy={handleCreateParameterizedCopy}
          sharedDataSources={sharedDataSources}
          onPromoteToShared={handlePromoteToShared}
          onOpenSharedDsModal={onOpenSharedDsModal}
          initialOpenDataSourceWizard={editingTest.openDataSourceWizard ?? false}
        />
      )}

      {moveDialog && (
        <MoveModal
          type={moveDialog.type}
          itemName={moveDialog.itemName}
          featureGroups={featureGroups}
          currentFgId={moveDialog.fgId}
          currentScenarioId={moveDialog.scenarioId}
          sourceScenarioKind={
            moveDialog.type === 'test' && moveDialog.scenarioId
              ? featureGroups.find(fg => fg.id === moveDialog.fgId)?.scenarios.find(sc => sc.id === moveDialog.scenarioId)?.kind
              : undefined
          }
          onMove={handleMoveConfirm}
          onClose={() => setMoveDialog(null)}
        />
      )}

      {csvImportOpen && (
        <CsvImportModal
          featureGroups={featureGroups}
          onImport={handleCsvImport}
          onClose={() => setCsvImportOpen(false)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant="danger"
          confirmLabel={confirmDialog.confirmLabel ?? 'Delete'}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {pendingImport && (
        <ImportVersionModal
          data={pendingImport.data}
          onConfirm={pendingImport.finalize}
          onCancel={cancelPendingImport}
        />
      )}

      {showSharedDsModal && sharedDataSources && setSharedDataSources && (
        <SharedDataSourceModal
          sharedDataSources={sharedDataSources}
          onUpdate={setSharedDataSources}
          featureGroups={featureGroups}
          globalAuthProfiles={globalAuthProfiles}
          initialSelectedId={sharedDsModalSelectedId}
          currentEditingDraft={currentEditingDraft}
          onCreateTestFromSharedDs={handleCreateTestFromSharedDs}
          moveToTrash={trash.moveToTrash}
          onClose={() => { setShowSharedDsModal(false); setSharedDsModalSelectedId(undefined); }}
        />
      )}

      {showFromSharedDsPicker && sharedDataSources && sharedDataSources.length > 0 && (
        <FromSharedDsPickerModal
          sharedDataSources={sharedDataSources}
          onConfirm={(sharedDs, testName) => {
            handleCreateTestFromSharedDs(
              sharedDs,
              showFromSharedDsPicker.fgId,
              showFromSharedDsPicker.scId,
              testName
            );
          }}
          onClose={() => setShowFromSharedDsPicker(null)}
        />
      )}

      {showTrashPanel && (
        <TrashPanel
          trashItems={trash.trashItems}
          loading={trash.loading}
          trashSettings={trash.trashSettings}
          onUpdateSettings={trash.updateTrashSettings}
          onRestore={trash.restoreItem}
          onPermanentlyDelete={trash.permanentlyDelete}
          onEmptyTrash={trash.emptyAllTrash}
          onClose={() => setShowTrashPanel(false)}
        />
      )}

      {trash.lastDeleted && (
        <TrashUndoToast
          item={trash.lastDeleted}
          onUndo={() => trash.undoLastDelete()}
          onDismiss={trash.clearLastDeleted}
        />
      )}
    </>
  );
}
