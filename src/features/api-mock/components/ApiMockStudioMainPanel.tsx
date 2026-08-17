import { useEffect, useRef, type CSSProperties } from 'react';
import { useSplitPaneResize } from '../../../shared/hooks/useSplitPaneResize';
import type { ApiMockConflictFindingV1, ApiMockServerDefinitionV1, ApiMockSimulationSampleV1, ApiMockTransactionV1 } from '../../../shared/api-mock/contracts';
import { mockClientOrigin } from '../../../shared/api-mock/harExport';
import type { ScenarioStateSnapshot } from '../apiMockControlClient';
import type { ApiMockConsoleLine } from '../useApiMockConsole';
import { API_MOCK_WORKSPACE_PANEL_ID } from './ApiMockServerTabs';
import { ApiMockRouteExplorer } from './ApiMockRouteExplorer';
import { ApiMockRouteEditor } from './ApiMockRouteEditor';
import { ApiMockLiveStrip } from './ApiMockLiveStrip';
import { ApiMockDock, type ApiMockDockTab } from './ApiMockDock';
import { ApiMockConflictInspector, conflictPeerLabel } from './ApiMockConflictInspector';
import type { ApiMockMainView } from './ApiMockWorkspaceNav';

const EXPLORER_SPLIT_STORAGE_KEY = 'redfire-api-mock-explorer-split-v1';
const EXPLORER_DEFAULT_WIDTH = 262;
const EXPLORER_MIN_WIDTH = 180;
const EXPLORER_MIN_EDITOR_WIDTH = 360;

interface ConflictStats {
  analyzedRules: number;
  durationMs: number;
}

interface Props {
  activeServer: ApiMockServerDefinitionV1;
  selectedRouteId?: string;
  setSelectedRouteId: (id: string | undefined) => void;
  selectedRoute?: ApiMockServerDefinitionV1['routes'][0];
  selectedFolderName?: string;
  mainView: ApiMockMainView;
  setMainView: (view: ApiMockMainView) => void;
  routesDrawerOpen: boolean;
  setRoutesDrawerOpen: (open: boolean) => void;
  transactions: ApiMockTransactionV1[];
  conflictFindings: ApiMockConflictFindingV1[];
  conflictIds: string[];
  conflictStats?: ConflictStats;
  runtimeTabRequest?: ApiMockDockTab;
  onRuntimeTabConsumed: () => void;
  runtimeRunning: boolean;
  dirty: boolean;
  scenarioState: ScenarioStateSnapshot | null;
  consoleLines: ApiMockConsoleLine[];
  onCreateRoute: (folderId?: string) => void;
  onConfirmDeleteRoute: (route: ApiMockServerDefinitionV1['routes'][0]) => void;
  onUpdateRoute: (routeId: string, patch: Partial<ApiMockServerDefinitionV1['routes'][0]>) => void;
  onAddFolder: () => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveRoute: (routeId: string, folderId: string | undefined) => void;
  onAnalyzeConflicts: () => void;
  onSetSimulateOpen: (open: boolean) => void;
  onSimulateSample?: (sample: ApiMockSimulationSampleV1) => void;
  onOpenConflictInspector: () => void;
  onOpenRuntime: (tab?: ApiMockDockTab) => void;
  onResetState: () => void;
  onClearTransactions: () => void;
  onClearConsole: () => void;
  onAcknowledgeConflict: (finding: ApiMockConflictFindingV1) => void;
  onAdjustPriority: (routeId: string, delta: number) => void;
  onOpenInRequests: (tx: ApiMockTransactionV1) => void;
  onCreateRouteFromTransaction: (tx: ApiMockTransactionV1) => string | void;
  onSaveSampleFromTransaction?: (tx: ApiMockTransactionV1) => void;
  onCopyTransaction: (tx: ApiMockTransactionV1) => void;
  onUpdateSample?: (sample: ApiMockSimulationSampleV1) => void;
  onDeleteSample?: (sampleId: string) => void;
  onTrySampleInRequests?: (sample: ApiMockSimulationSampleV1) => void;
  onSimulateWitness: (finding: ApiMockConflictFindingV1) => void;
  onApplyActiveServer: () => void;
  onUpdateServer: (patch: Partial<ApiMockServerDefinitionV1>) => void;
}

export function ApiMockStudioMainPanel({
  activeServer,
  selectedRouteId,
  setSelectedRouteId,
  selectedRoute,
  selectedFolderName,
  mainView,
  setMainView,
  routesDrawerOpen,
  setRoutesDrawerOpen,
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
  onCreateRoute,
  onConfirmDeleteRoute,
  onUpdateRoute,
  onAddFolder,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveRoute,
  onAnalyzeConflicts,
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
  onApplyActiveServer,
  onUpdateServer,
}: Props) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const { width: explorerWidth, dividerProps } = useSplitPaneResize({
    storageKey: EXPLORER_SPLIT_STORAGE_KEY,
    defaultWidth: EXPLORER_DEFAULT_WIDTH,
    minWidth: EXPLORER_MIN_WIDTH,
    minOppositeWidth: EXPLORER_MIN_EDITOR_WIDTH,
    maxWidthRatio: 0.55,
    containerRef: workspaceRef,
    label: 'Resize rules panel',
  });

  useEffect(() => {
    if (!routesDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target;
      if (target instanceof Element && target.closest('dialog, .modal, [role="dialog"], .cs-menu, .am-folder-rename')) return;
      if (document.querySelector('.cs-menu, [data-testid="api-mock-route-filter-panel"]')) return;
      setRoutesDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [routesDrawerOpen, setRoutesDrawerOpen]);

  if (mainView === 'studio') {
    return (
      <>
        {routesDrawerOpen && (
          <button
            type="button"
            className="am-routes-backdrop"
            aria-label="Close routes drawer"
            data-testid="api-mock-routes-backdrop"
            onClick={() => setRoutesDrawerOpen(false)}
          />
        )}
        <div
          ref={workspaceRef}
          className={`api-mock-workspace${routesDrawerOpen ? ' routes-drawer-open' : ''}`}
          id={API_MOCK_WORKSPACE_PANEL_ID}
          role="tabpanel"
          aria-labelledby={`api-mock-tabhdr-${activeServer.id}`}
          style={{ '--am-explorer-w': `${explorerWidth}px` } as CSSProperties}
        >
          <ApiMockRouteExplorer
            routes={activeServer.routes}
            folders={activeServer.folders}
            selectedRouteId={selectedRouteId}
            onSelect={id => { setSelectedRouteId(id); setRoutesDrawerOpen(false); }}
            onCreate={onCreateRoute}
            onDelete={id => {
              const route = activeServer.routes.find(r => r.id === id);
              if (route) onConfirmDeleteRoute(route);
            }}
            onToggle={(id, enabled) => onUpdateRoute(id, { enabled })}
            onAddFolder={onAddFolder}
            onToggleFolder={onToggleFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onMoveRoute={onMoveRoute}
            conflictRouteIds={conflictIds}
            onAnalyze={() => {
              setMainView('conflicts');
              onAnalyzeConflicts();
            }}
            drawerOpen={routesDrawerOpen}
            onCloseDrawer={() => setRoutesDrawerOpen(false)}
            running={runtimeRunning}
          />
          <div
            className="am-explorer-splitter"
            data-testid="api-mock-explorer-splitter"
            {...dividerProps}
          />
          <div className="api-mock-editor">
            {selectedRoute ? (
              <ApiMockRouteEditor
                route={selectedRoute}
                onUpdate={patch => onUpdateRoute(selectedRoute.id, patch)}
                hasConflict={conflictIds.includes(selectedRoute.id)}
                conflictPeer={conflictPeerLabel(conflictFindings, selectedRoute.id, activeServer.routes)}
                matchCount={transactions.filter(t => t.matchedRouteId === selectedRoute.id).length}
                sequencePosition={scenarioState?.sequencePositions?.[selectedRoute.id]}
                onSimulate={sample => {
                  if (sample) onSimulateSample?.(sample);
                  else onSetSimulateOpen(true);
                }}
                onReviewConflicts={onOpenConflictInspector}
                folderName={selectedFolderName}
                folders={activeServer.folders}
                samples={activeServer.samples}
                onUpdateSample={onUpdateSample}
                onDeleteSample={onDeleteSample}
                onTrySampleInRequests={onTrySampleInRequests}
                variables={activeServer.variables}
                timeoutHoldMaxMs={activeServer.settings.limits.longRunningMaxMs}
              />
            ) : (
              <div className="api-mock-no-selection" data-testid="api-mock-no-route">
                <h3>
                  {activeServer.routes.length === 0
                    ? (runtimeRunning ? 'Listening — no rules yet' : 'No rules yet')
                    : 'No rule selected'}
                </h3>
                <p>
                  {activeServer.routes.length === 0
                    ? (runtimeRunning
                      ? 'This listener is running with no rules. Every request to this address — GET, POST, or any other method — is unmatched and returns 404 until you add a rule.'
                      : 'This mock server has no rules yet. Create one to define how it answers requests. You can still Start the listener — until a rule exists, every request returns 404.')
                    : 'Pick a rule from the panel on the left to edit its matching, responses, and behavior.'}
                </p>
                <button className="am-btn primary" onClick={() => onCreateRoute()} data-testid="api-mock-no-route-create">
                  + New rule
                </button>
              </div>
            )}
          </div>
        </div>
        <ApiMockLiveStrip
          transactionCount={transactions.length}
          conflictCount={conflictFindings.length || conflictIds.length}
          variableCount={activeServer.variables.length}
          running={runtimeRunning}
          onOpenRuntime={onOpenRuntime}
          onOpenConflicts={onOpenConflictInspector}
        />
      </>
    );
  }

  if (mainView === 'runtime') {
    return (
      <div className="api-mock-runtime-page" data-testid="api-mock-runtime-page">
        <ApiMockDock
          variant="page"
          routes={activeServer.routes}
          conflictCount={conflictFindings.length || conflictIds.length}
          conflictFindings={conflictFindings}
          focusConflictRouteId={selectedRouteId}
          requestedTab={runtimeTabRequest}
          onRequestedTabConsumed={onRuntimeTabConsumed}
          onSelectRoute={id => { setSelectedRouteId(id); setMainView('studio'); }}
          onSimulateWitness={onSimulateWitness}
          transactions={transactions}
          running={runtimeRunning}
          variables={activeServer.variables}
          onVariablesChange={variables => onUpdateServer({ variables })}
          liveState={scenarioState}
          onResetState={onResetState}
          onClearTransactions={onClearTransactions}
          consoleLines={consoleLines}
          onClearConsole={onClearConsole}
          onOpenConflicts={onOpenConflictInspector}
          onAcknowledgeConflict={onAcknowledgeConflict}
          onAdjustPriority={onAdjustPriority}
          onOpenInRequests={onOpenInRequests}
          onCreateRouteFromTransaction={onCreateRouteFromTransaction}
          onSaveSampleFromTransaction={onSaveSampleFromTransaction}
          onCopyTransaction={onCopyTransaction}
          settings={activeServer.settings}
          conflictStats={conflictStats}
          serverAddress={`${mockClientOrigin(activeServer.host, activeServer.port, Boolean(activeServer.settings.tls?.enabled))}${activeServer.basePath || ''}`}
          server={activeServer}
          onServerPatch={onUpdateServer}
        />
      </div>
    );
  }

  return (
    <div className="api-mock-conflicts-page" data-testid="api-mock-conflicts-page">
      <div className="am-runtime-header">
        <div>
          <div className="am-page-title">Conflict Inspector</div>
          <div className="am-page-subtitle">
            {(conflictFindings.length || conflictIds.length)} finding{(conflictFindings.length || conflictIds.length) === 1 ? '' : 's'}
            {conflictStats ? ` · ${conflictStats.analyzedRules} rules · ${conflictStats.durationMs} ms` : ''}
          </div>
        </div>
        <span className="am-spacer" />
        <button type="button" className="am-btn" onClick={onAnalyzeConflicts} data-testid="api-mock-conflicts-analyze">
          Re-analyze
        </button>
      </div>
      <div className="am-conflicts-page-body">
        <ApiMockConflictInspector
          findings={conflictFindings}
          routes={activeServer.routes}
          focusRouteId={selectedRouteId}
          onSelectRoute={id => { setSelectedRouteId(id); setMainView('studio'); }}
          onSimulateWitness={onSimulateWitness}
          onAcknowledge={onAcknowledgeConflict}
          onAdjustPriority={onAdjustPriority}
          settings={activeServer.settings}
          stats={conflictStats}
          onAnalyze={onAnalyzeConflicts}
          onOpenStudio={() => setMainView('studio')}
          onApply={onApplyActiveServer}
          dirty={dirty}
          serverHost={activeServer.host}
          serverPort={activeServer.port}
        />
      </div>
    </div>
  );
}
