import type {
  ApiMockConflictFindingV1,
  ApiMockSimulationSampleV1,
  ApiMockServerDefinitionV1,
  ApiMockTransactionV1,
} from '../../../shared/api-mock/contracts';
import type { ScenarioStateSnapshot } from '../apiMockControlClient';
import type { ApiMockDockTab } from './ApiMockDock';
import { ApiMockWorkspaceNav, type ApiMockExportRequest, type ApiMockMainView } from './ApiMockWorkspaceNav';
import { ApiMockServerBar } from './ApiMockServerBar';
import { ApiMockStudioMainPanel } from './ApiMockStudioMainPanel';
import type { ApiMockConsoleLine } from '../useApiMockConsole';

interface ApiMockStudioActiveSectionProps {
  activeServer: ApiMockServerDefinitionV1;
  mainView: ApiMockMainView;
  setMainView: (view: ApiMockMainView) => void;
  transactions: ApiMockTransactionV1[];
  conflictFindings: ApiMockConflictFindingV1[];
  conflictIds: string[];
  conflictStats: { analyzedRules: number; durationMs: number } | undefined;
  runtimeTabRequest: ApiMockDockTab | undefined;
  onRuntimeTabConsumed: () => void;
  runtimeRunning: boolean;
  dirty: boolean;
  scenarioState: ScenarioStateSnapshot | null;
  consoleLines: ApiMockConsoleLine[];
  selectedRouteId: string | undefined;
  setSelectedRouteId: (id: string | undefined) => void;
  selectedRoute: ApiMockServerDefinitionV1['routes'][0] | undefined;
  selectedFolderName: string | undefined;
  routesDrawerOpen: boolean;
  setRoutesDrawerOpen: (open: boolean) => void;
  onImportOpen: (source?: 'curl' | 'catalog' | 'requests' | 'openapi' | 'wiremock' | 'native' | 'har') => void;
  onExport: (req: ApiMockExportRequest) => void;
  onAnalyzeConflicts: () => void;
  onStart: () => void;
  onStop: () => void;
  onApply: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onCreateRoute: (folderId?: string) => void;
  onConfirmDeleteRoute: (route: ApiMockServerDefinitionV1['routes'][0]) => void;
  onUpdateRoute: (routeId: string, patch: Partial<ApiMockServerDefinitionV1['routes'][0]>) => void;
  onAddFolder: () => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveRoute: (routeId: string, folderId: string | undefined) => void;
  onSetSimulateOpen: (open: boolean) => void;
  onSimulateSample: (sample: ApiMockSimulationSampleV1) => void;
  onOpenConflictInspector: () => void;
  onOpenRuntime: (tab?: ApiMockDockTab) => void;
  onResetState: () => void;
  onClearTransactions: () => void;
  onClearConsole: () => void;
  onAcknowledgeConflict: (finding: ApiMockConflictFindingV1) => void;
  onAdjustPriority: (routeId: string, delta: number) => void;
  onOpenInRequests: (tx: ApiMockTransactionV1) => void;
  onCreateRouteFromTransaction: (tx: ApiMockTransactionV1) => void;
  onSaveSampleFromTransaction: (tx: ApiMockTransactionV1) => void;
  onCopyTransaction: (tx: ApiMockTransactionV1) => void;
  onUpdateSample: (sample: ApiMockSimulationSampleV1) => void;
  onDeleteSample: (sampleId: string) => void;
  onTrySampleInRequests: (sample: ApiMockSimulationSampleV1) => void;
  onSimulateWitness: (finding?: ApiMockConflictFindingV1) => void;
  onUpdateServer: (patch: Partial<ApiMockServerDefinitionV1>) => void;
  status: import('./ApiMockServerTabs').ApiMockRuntimeStatus;
  generation: number;
  error?: string;
}

export function ApiMockStudioActiveSection({
  activeServer,
  mainView,
  setMainView,
  transactions,
  conflictFindings,
  conflictIds,
  conflictStats,
  runtimeTabRequest,
  onRuntimeTabConsumed,
  runtimeRunning,
  dirty,
  scenarioState,
  consoleLines,
  selectedRouteId,
  setSelectedRouteId,
  selectedRoute,
  selectedFolderName,
  routesDrawerOpen,
  setRoutesDrawerOpen,
  onImportOpen,
  onExport,
  onAnalyzeConflicts,
  onStart,
  onStop,
  onApply,
  onRestart,
  onSettings,
  onCreateRoute,
  onConfirmDeleteRoute,
  onUpdateRoute,
  onAddFolder,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveRoute,
  onSetSimulateOpen,
  onSimulateSample,
  onOpenConflictInspector,
  onOpenRuntime,
  onResetState,
  onClearTransactions,
  onClearConsole,
  onAcknowledgeConflict,
  onAdjustPriority,
  onOpenInRequests,
  onCreateRouteFromTransaction,
  onSaveSampleFromTransaction,
  onCopyTransaction,
  onUpdateSample,
  onDeleteSample,
  onTrySampleInRequests,
  onSimulateWitness,
  onUpdateServer,
  status,
  generation,
  error,
}: ApiMockStudioActiveSectionProps) {
  return (
    <>
      <ApiMockWorkspaceNav
        view={mainView}
        onChange={view => {
          setMainView(view);
          if (view === 'conflicts' && conflictFindings.length === 0) onAnalyzeConflicts();
        }}
        transactionCount={transactions.length}
        conflictCount={conflictFindings.length || conflictIds.length}
        onImport={onImportOpen}
        onExport={onExport}
      />
      <ApiMockServerBar
        server={activeServer}
        onUpdate={onUpdateServer}
        status={status}
        dirty={dirty}
        generation={generation}
        error={error}
        onStart={onStart}
        onStop={onStop}
        onApply={onApply}
        onRestart={onRestart}
        onSettings={onSettings}
        onOpenRoutes={() => { setMainView('studio'); setRoutesDrawerOpen(true); }}
      />
      <ApiMockStudioMainPanel
        activeServer={activeServer}
        selectedRouteId={selectedRouteId}
        setSelectedRouteId={setSelectedRouteId}
        selectedRoute={selectedRoute}
        selectedFolderName={selectedFolderName}
        mainView={mainView}
        setMainView={setMainView}
        routesDrawerOpen={routesDrawerOpen}
        setRoutesDrawerOpen={setRoutesDrawerOpen}
        transactions={transactions}
        conflictFindings={conflictFindings}
        conflictIds={conflictIds}
        conflictStats={conflictStats}
        runtimeTabRequest={runtimeTabRequest}
        onRuntimeTabConsumed={onRuntimeTabConsumed}
        runtimeRunning={runtimeRunning}
        dirty={dirty}
        scenarioState={scenarioState}
        consoleLines={consoleLines}
        onCreateRoute={onCreateRoute}
        onConfirmDeleteRoute={onConfirmDeleteRoute}
        onUpdateRoute={onUpdateRoute}
        onAddFolder={onAddFolder}
        onToggleFolder={onToggleFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onMoveRoute={onMoveRoute}
        onAnalyzeConflicts={onAnalyzeConflicts}
        onSetSimulateOpen={onSetSimulateOpen}
        onSimulateSample={onSimulateSample}
        onOpenConflictInspector={onOpenConflictInspector}
        onOpenRuntime={onOpenRuntime}
        onResetState={onResetState}
        onClearTransactions={onClearTransactions}
        onClearConsole={onClearConsole}
        onAcknowledgeConflict={onAcknowledgeConflict}
        onAdjustPriority={onAdjustPriority}
        onOpenInRequests={onOpenInRequests}
        onCreateRouteFromTransaction={onCreateRouteFromTransaction}
        onSaveSampleFromTransaction={onSaveSampleFromTransaction}
        onCopyTransaction={onCopyTransaction}
        onUpdateSample={onUpdateSample}
        onDeleteSample={onDeleteSample}
        onTrySampleInRequests={onTrySampleInRequests}
        onSimulateWitness={onSimulateWitness}
        onApplyActiveServer={onApply}
        onUpdateServer={onUpdateServer}
      />
    </>
  );
}
