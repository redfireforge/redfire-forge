import '../../../styles/grpc-studio.css';
import '../../../styles/websocket-studio.css';
import '../../../styles/mock-server-shared.css';
import { useRef, useState } from 'react';
import { GrpcTabBar } from '../components/GrpcTabBar';
import { useGrpcStudio } from '../hooks/useGrpcStudio';
import { useGrpcStudioPersistence } from '../hooks/useGrpcStudioPersistence';
import { useGrpcCollections } from '../hooks/useGrpcCollections';
import { useGrpcCallHistory } from '../hooks/useGrpcCallHistory';
import { useGrpcStudioAdvancedFeatures } from '../hooks/useGrpcStudioAdvancedFeatures';
import {
  useGrpcStudioReplayActions,
  type GrpcStudioPanelView,
} from '../hooks/useGrpcStudioReplayActions';
import {
  useGrpcSavedRequestRunTracking,
  useGrpcSelectedSavedRequest,
  useGrpcStudioSaveSnapshot,
} from '../hooks/useGrpcStudioPageCollections';
import { GrpcStudioPageConnectionChrome } from './GrpcStudioPageConnectionChrome';
import { GrpcStudioPageHeader } from './GrpcStudioPageHeader';
import { GrpcStudioPageOverlays } from './GrpcStudioPageOverlays';
import { GrpcStudioPagePanels } from './GrpcStudioPagePanels';
import type { GrpcStudioPageProps } from './grpcStudioPageTypes';
import { useGrpcStudioPageConnectionState } from './useGrpcStudioPageConnectionState';
import { useGrpcStudioPageConsole } from './useGrpcStudioPageConsole';
import { useGrpcStudioPageDemoBridges } from './useGrpcStudioPageDemoBridges';
import { useGrpcStudioPageDensity } from './useGrpcStudioPageDensity';
import { useGrpcStudioPageEnvContext } from './useGrpcStudioPageEnvContext';
import { useGrpcStudioPageHistoryActions } from './useGrpcStudioPageHistoryActions';

export type { GrpcStudioPageProps } from './grpcStudioPageTypes';

export function GrpcStudioPage({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
  workspaceDefaultsOverride,
  globalAuthProfiles = [],
}: GrpcStudioPageProps) {
  const { densityMode, setDensityMode } = useGrpcStudioPageDensity();

  const {
    envVarMap,
    workspaceDefaults,
    pageDefaults,
    endpointProtocolStatus,
    defaultAuthProfileId,
  } = useGrpcStudioPageEnvContext({
    resolvedBaseUrl,
    envName,
    svcName,
    selectedSvc,
    selectedEnvId,
    workspaceDefaultsOverride,
  });

  const studio = useGrpcStudio({
    envVarMap,
    workspaceDefaults,
    pageDefaults,
    globalAuthProfiles,
    defaultAuthProfileId,
  });

  const hasRestoredSessionRef = useRef(false);
  useGrpcStudioPersistence({ tabs: studio.tabs, activeTabId: studio.activeTabId, tabDescriptors: studio.tabDescriptors }, (persisted) => {
    if (hasRestoredSessionRef.current) return;
    hasRestoredSessionRef.current = true;
    studio.restorePersistedSession(persisted);
  });

  const collections = useGrpcCollections();
  const callHistory = useGrpcCallHistory();
  const [panelView, setPanelView] = useState<GrpcStudioPanelView>('studio');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savedReplaySourceByTabId, setSavedReplaySourceByTabId] = useState<Record<string, { collectionId: string; savedId: string }>>({});

  const replayActions = useGrpcStudioReplayActions({
    studio,
    envVarMap,
    profiles: studio.profiles,
    pageDefaults,
    onNavigate: setPanelView,
  });

  const advancedFeatures = useGrpcStudioAdvancedFeatures({
    studio,
    envName,
    pageDefaults,
    enabled: panelView === 'advanced',
  });

  useGrpcStudioPageDemoBridges(studio, advancedFeatures);

  const { consoleEvents, clearConsoleEvents } = useGrpcStudioPageConsole(studio, consoleOpen);

  const resolveSaveSnapshot = useGrpcStudioSaveSnapshot(studio, envVarMap);

  const {
    lastUnaryResultForSelected,
    openInStudioStatusForSelected,
    runLoadTestStatusForSelected,
    compareSchemaStatusForSelected,
  } = useGrpcSelectedSavedRequest(
    collections,
    selectedSavedId,
    studio,
    envVarMap,
    pageDefaults,
  );

  const historyActions = useGrpcStudioPageHistoryActions({
    studio,
    envVarMap,
    workspaceDefaults,
    pageDefaults,
    collections,
    callHistory,
    advancedFeatures,
    replayActions,
    onNavigate: setPanelView,
  });

  useGrpcSavedRequestRunTracking({
    studio,
    collections,
    savedReplaySourceByTabId,
  });

  const connection = useGrpcStudioPageConnectionState({
    studio,
    envVarMap,
    workspaceDefaults,
    pageDefaults,
    globalAuthProfiles,
    defaultAuthProfileId,
  });

  const connectionChrome = (
    <GrpcStudioPageConnectionChrome
      studio={studio}
      envVarMap={envVarMap}
      workspaceDefaults={workspaceDefaults}
      pageDefaults={pageDefaults}
      connection={connection}
      onSaveRequestClick={() => setSaveModalOpen(true)}
      onImportGrpcurlClick={() => setImportModalOpen(true)}
    />
  );

  return (
    <div
      className={`grpc-studio grpc-studio--density-${densityMode}`}
      data-testid="grpc-studio-page"
    >
      <GrpcStudioPageHeader
        panelView={panelView}
        historyCount={callHistory.entries.length}
        onSelectPanelView={setPanelView}
        endpointPreviewDraft={connection.endpointPreviewDraft}
        tabInterpolationEnv={connection.tabInterpolationEnv}
        endpointProtocolStatus={endpointProtocolStatus}
        densityMode={densityMode}
        onDensityModeChange={setDensityMode}
      />

      {panelView === 'studio' && (
        <GrpcTabBar
          tabs={studio.tabs}
          activeTabId={studio.activeTabId}
          canAddTab={studio.canAddTab}
          maxTabs={studio.maxTabs}
          tabCallTypes={connection.tabCallTypes}
          tabCallCounts={connection.tabCallCounts}
          onSelect={studio.selectTab}
          onAdd={studio.addTab}
          onClose={studio.closeTab}
          onDuplicate={studio.duplicateTab}
          onRename={studio.renameTab}
        />
      )}

      {panelView !== 'studio' && (
        <div className="grpc-studio-page-connection-chrome" data-testid="grpc-connection-chrome">
          {connectionChrome}
        </div>
      )}

      <div className="grpc-studio-body">
        <GrpcStudioPagePanels
          panelView={panelView}
          studio={studio}
          collections={collections}
          callHistory={callHistory}
          advancedFeatures={advancedFeatures}
          replayActions={replayActions}
          connection={connection}
          historyActions={historyActions}
          envVarMap={envVarMap}
          pageDefaults={pageDefaults}
          globalAuthProfiles={globalAuthProfiles}
          defaultAuthProfileId={defaultAuthProfileId}
          connectionChrome={connectionChrome}
          selectedSavedId={selectedSavedId}
          onSelectSavedId={setSelectedSavedId}
          onSavedReplaySource={(tabId, source) => {
            setSavedReplaySourceByTabId((prev) => ({ ...prev, [tabId]: source }));
          }}
          lastUnaryResultForSelected={lastUnaryResultForSelected}
          openInStudioStatusForSelected={openInStudioStatusForSelected}
          compareSchemaStatusForSelected={compareSchemaStatusForSelected}
          runLoadTestStatusForSelected={runLoadTestStatusForSelected}
        />

        <GrpcStudioPageOverlays
          studio={studio}
          collections={collections}
          replayActions={replayActions}
          connection={connection}
          consoleOpen={consoleOpen}
          onConsoleOpenChange={setConsoleOpen}
          consoleEvents={consoleEvents}
          onClearConsoleEvents={clearConsoleEvents}
          saveModalOpen={saveModalOpen}
          onSaveModalOpenChange={setSaveModalOpen}
          importModalOpen={importModalOpen}
          onImportModalOpenChange={setImportModalOpen}
          resolveSaveSnapshot={resolveSaveSnapshot}
          onSaveComplete={(savedId) => {
            setSelectedSavedId(savedId);
            setPanelView('collections');
          }}
        />
      </div>
    </div>
  );
}
