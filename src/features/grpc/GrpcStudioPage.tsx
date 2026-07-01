import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { GlobalAuthProfile, Microservice } from '../../shared/types';
import { buildEnvVarMap } from '../../shared/utils/envVarUtils';
import { getRowStatus } from '../environments/utils/protocolEndpointUtils';
import { ProtocolEndpointPreview } from '../../shared/components/ProtocolEndpointPreview';
import { computeGrpcStudioTargetPreview, resolveGrpcStudioEndpointPreviewDraft } from '../../shared/grpc/grpcStudioTargetPreview';
import { mergeGrpcTabInterpolationEnv } from '../../shared/grpc/grpcInterpolationPrecedence';
import { GrpcExplorerPane } from './components/GrpcExplorerPane';
import { GrpcConnectionBar } from './components/GrpcConnectionBar';
import { GrpcProtoManageModal, type ProtoModalTab } from './components/GrpcProtoManageModal';
import { GrpcTabBar } from './components/GrpcTabBar';
import { GrpcTargetPanel } from './components/GrpcTargetPanel';
import { GrpcTlsPanel } from './components/GrpcTlsPanel';
import { GrpcStudioSubNav } from './components/GrpcStudioSubNav';
import { GrpcCollectionsPanel } from './components/GrpcCollectionsPanel';
import { GrpcHistoryPanel } from './components/GrpcHistoryPanel';
import { GrpcAdvancedFeaturesShell } from './components/GrpcAdvancedFeaturesShell';
import { GrpcSaveRequestModal } from './components/GrpcSaveRequestModal';
import { GrpcGrpcurlImportModal } from './components/GrpcGrpcurlImportModal';
import {
  GrpcConnectionSettingsDrawer,
  type GrpcConnectionSettingsNav,
} from './components/GrpcConnectionSettingsDrawer';
import { createDefaultProtoIngestState, isGrpcLifecycleInFlight, canChangeGrpcTabTransportMode, resolveGrpcStudioTabTransportMode } from './grpcStudioTypes';
import { useGrpcStudio } from './hooks/useGrpcStudio';
import { useGrpcTls } from './hooks/useGrpcTls';
import { useGrpcCollections } from './hooks/useGrpcCollections';
import { useGrpcCallHistory } from './hooks/useGrpcCallHistory';
import { useGrpcStudioAdvancedFeatures } from './hooks/useGrpcStudioAdvancedFeatures';
import {
  useGrpcStudioReplayActions,
  type GrpcStudioPanelView,
} from './hooks/useGrpcStudioReplayActions';
import {
  buildGrpcurlInvokeCommandFromSavedRequest,
  buildGrpcurlInvokeCommandFromSnapshot,
  resolveGrpcurlExportContextForTabRequest,
} from './utils/grpcGrpcurl';
import { resolveUnaryResultForSavedRequestComparison } from './utils/grpcResponseSnapshot';
import { isGrpcReplayExecutable, resolveGrpcReplayBinding } from './utils/grpcReplayBinding';
import type { GrpcSavedRequest } from '../../shared/grpc/grpcSavedRequest';
import type { GrpcCallHistoryEntryV1 } from '../../shared/grpc/grpcPersistenceSchema';
import { findGrpcMethod } from './utils/grpcExplorerUtils';
import { validateGrpcTargetAddress } from '../../shared/grpc/targetValidation';
import { normalizeGrpcTlsConfig } from '../../shared/grpc/grpcTlsPolicy';
import { sanitizeGrpcErrorMessage } from '../../shared/grpc/grpcRedaction';
import { isGrpcStreamLifecycleInFlight } from '../../shared/grpc/streamLifecycle';
import { resolveGrpcTabConnection } from './utils/resolveGrpcTabConnection';
import {
  clearTabAuthSecretField,
  clearTabTlsSecretField,
  unmaskSecretField,
} from './utils/grpcTabSecretVault';
import type { GrpcAuthSecretFieldKey, GrpcTlsSecretFieldKey } from './utils/grpcSecretFieldUi';
import { withoutTlsMaskFields } from './utils/grpcSecretFieldUi';
import { previewGrpcAuthMerge } from './utils/grpcAuthPreview';
import {
  descriptorHasHealthService,
  descriptorHasHealthWatch,
  executeGrpcHealthProbe,
  GRPC_HEALTH_SERVICE_FULL_NAME,
  GRPC_HEALTH_WATCH_METHOD,
} from './utils/grpcHealthProbe';
import '../../styles/grpc-studio.css';
import '../../styles/websocket-studio.css';

export interface GrpcStudioPageProps {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}

/** Legacy env map when Microservice/env selectors are unavailable. */
// eslint-disable-next-line react-refresh/only-export-components
export function buildLegacyGrpcEnvVarMap(
  resolvedBaseUrl?: string,
  envName?: string,
  svcName?: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  const candidate = resolvedBaseUrl?.trim();
  if (candidate) {
    const isHttpUrl = /^https?:\/\//i.test(candidate);
    if (!isHttpUrl && validateGrpcTargetAddress(candidate).valid) {
      map.grpcHost = candidate;
    }
  }
  if (envName) map.envName = envName;
  if (svcName) map.svcName = svcName;
  return map;
}

export function GrpcStudioPage({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
}: GrpcStudioPageProps) {
  const envVarMap = useMemo(() => {
    if (selectedSvc && selectedEnvId) {
      return buildEnvVarMap(selectedSvc, selectedEnvId, 'grpc', envName);
    }
    return buildLegacyGrpcEnvVarMap(resolvedBaseUrl, envName, svcName);
  }, [selectedSvc, selectedEnvId, resolvedBaseUrl, envName, svcName]);

  const pageDefaults = useMemo(() => ({
    target: envVarMap.grpcHost ?? '',
    tlsMode: 'disabled' as const,
  }), [envVarMap.grpcHost]);

  const endpointProtocolStatus = useMemo(() => {
    if (selectedSvc && selectedEnvId) {
      return getRowStatus(selectedSvc, 'grpc', selectedEnvId);
    }
    return undefined;
  }, [selectedSvc, selectedEnvId]);

  const studio = useGrpcStudio({
    envVarMap,
    pageDefaults,
  });

  const collections = useGrpcCollections();
  const callHistory = useGrpcCallHistory();
  const [panelView, setPanelView] = useState<GrpcStudioPanelView>('studio');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

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
  });

  const captureSaveSnapshot = useCallback(() => {
    const tab = studio.activeTab;
    if (!tab.service || !tab.method) {
      return { snapshot: null, errorMessage: undefined };
    }
    try {
      return {
        snapshot: studio.prepareExecuteSnapshot(
          tab.id,
          globalThis.crypto?.randomUUID?.() ?? `save-${Date.now()}`,
        ),
        errorMessage: undefined,
        tabContext: {
          connectionId: tab.connectionId,
          rawTarget: tab.target,
          rawBody: tab.body,
          rawMetadata: tab.metadata,
          rawAuth: tab.auth,
          interpolationEnv: envVarMap,
        },
      };
    } catch (error) {
      return {
        snapshot: null,
        errorMessage: error instanceof Error ? error.message : 'Cannot prepare request snapshot',
      };
    }
  }, [studio, envVarMap]);

  const resolveSaveSnapshot = useCallback(() => captureSaveSnapshot(), [captureSaveSnapshot]);

  const selectedSavedRequest = useMemo(() => {
    if (!selectedSavedId) return null;
    for (const collection of collections.collections) {
      const saved = collection.savedRequests.find((entry) => entry.id === selectedSavedId);
      if (saved) return saved;
    }
    return null;
  }, [collections.collections, selectedSavedId]);

  const lastUnaryResultForSelected = useMemo(
    () => resolveUnaryResultForSavedRequestComparison(selectedSavedRequest, studio.activeTab),
    [selectedSavedRequest, studio.activeTab],
  );

  const openInStudioStatusForSelected = useMemo(() => {
    if (!selectedSavedRequest) {
      return { executable: true, title: 'Open in Studio' };
    }
    try {
      const binding = resolveGrpcReplayBinding({
        saved: selectedSavedRequest,
        tab: studio.activeTab,
        requestId: 'preview',
        envVarMap,
        profiles: studio.profiles,
        pageDefaults,
        currentDescriptor: studio.activeTabDescriptor.descriptor,
        tabDescriptorState: studio.activeTabDescriptor,
      });
      const executable = isGrpcReplayExecutable(binding.drift);
      return {
        executable,
        title: executable
          ? 'Open in Studio'
          : (binding.drift.message || 'Open in Studio blocked'),
      };
    } catch (error) {
      return {
        executable: false,
        title: error instanceof Error ? error.message : 'Open in Studio blocked',
      };
    }
  }, [selectedSavedRequest, studio, envVarMap, pageDefaults]);

  const grpcurlForSaved = useCallback((saved: GrpcSavedRequest) => (
    buildGrpcurlInvokeCommandFromSavedRequest(
      saved,
      resolveGrpcurlExportContextForTabRequest(studio.activeTab, saved.service, saved.method),
    )
  ), [studio.activeTab]);

  const grpcurlForHistoryEntry = useCallback((entry: GrpcCallHistoryEntryV1) => (
    buildGrpcurlInvokeCommandFromSnapshot(
      entry.record.snapshot,
      resolveGrpcurlExportContextForTabRequest(
        studio.activeTab,
        entry.record.snapshot.service,
        entry.record.snapshot.method,
      ),
    )
  ), [studio.activeTab]);

  const copyTextToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard best-effort */
    }
  }, []);

  const [protoModalOpen, setProtoModalOpen] = useState(false);
  const [protoModalInitialTab, setProtoModalInitialTab] = useState<ProtoModalTab | undefined>(undefined);
  const [exportProtosetBusy, setExportProtosetBusy] = useState(false);
  const [exportError, setExportError] = useState<string | undefined>();
  const [authTabFocusRequest, setAuthTabFocusRequest] = useState(0);
  const [tlsModalOpenRequest, setTlsModalOpenRequest] = useState(0);
  const [tlsModalCloseRequest, setTlsModalCloseRequest] = useState(0);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [settingsDrawerNav, setSettingsDrawerNav] = useState<GrpcConnectionSettingsNav>('tls');
  const previousActiveTabIdRef = useRef(studio.activeTabId);

  useEffect(() => {
    if (protoModalOpen) {
      setExportError(undefined);
    }
  }, [protoModalOpen]);

  useEffect(() => {
    if (previousActiveTabIdRef.current !== studio.activeTabId) {
      setProtoModalOpen(false);
      setSettingsDrawerOpen(false);
    }
    previousActiveTabIdRef.current = studio.activeTabId;
  }, [studio.activeTabId]);

  const activeProtoIngest = studio.activeTabDescriptor.protoIngest ?? createDefaultProtoIngestState();

  const activeConnection = studio.resolveTabConnection(studio.activeTab.id);
  const activeTab = studio.activeTab;
  const tabInterpolationEnv = useMemo(
    () => mergeGrpcTabInterpolationEnv({
      activeEnvironment: envVarMap,
      profiles: studio.profiles,
      connectionId: activeTab.connectionId,
      tabOverrides: activeTab.envVarOverrides,
    }),
    [envVarMap, studio.profiles, activeTab.connectionId, activeTab.envVarOverrides],
  );
  const rawConnectionTarget = useMemo(
    () => resolveGrpcTabConnection(activeTab, studio.profiles, pageDefaults).target,
    [activeTab, studio.profiles, pageDefaults],
  );
  const resolvedTlsMode = activeTab.tlsMode ?? activeConnection.tlsMode;
  const tlsState = useGrpcTls(
    resolvedTlsMode,
    activeTab.tlsConfig,
    activeConnection.targetValidation.valid
      ? activeConnection.targetValidation.normalized
      : activeConnection.target,
  );
  const endpointPreviewDraft = resolveGrpcStudioEndpointPreviewDraft(
    activeTab.target,
    rawConnectionTarget,
  );
  const canReflect = activeConnection.targetValidation.valid && tlsState.valid;
  const connectionEditingDisabled = isGrpcLifecycleInFlight(activeTab.lifecycle)
    || isGrpcStreamLifecycleInFlight(activeTab.streamLifecycle);

  const handleUnmaskTlsSecretField = useCallback((field: GrpcTlsSecretFieldKey) => {
    studio.updateTab(activeTab.id, {
      maskedSecretFields: unmaskSecretField(activeTab.maskedSecretFields, 'tls', field),
    });
  }, [activeTab.id, activeTab.maskedSecretFields, studio]);

  const handleClearTlsSecretField = useCallback((field: GrpcTlsSecretFieldKey) => {
    void clearTabTlsSecretField({ tab: activeTab, field }).then((patch) => {
      studio.updateTab(activeTab.id, patch);
    });
  }, [activeTab, studio]);

  const handleUnmaskAuthSecretField = useCallback((field: GrpcAuthSecretFieldKey) => {
    studio.updateTab(activeTab.id, {
      maskedSecretFields: unmaskSecretField(activeTab.maskedSecretFields, 'auth', field),
    });
  }, [activeTab.id, activeTab.maskedSecretFields, studio]);

  const handleClearAuthSecretField = useCallback((field: GrpcAuthSecretFieldKey) => {
    void clearTabAuthSecretField({ tab: activeTab, field }).then((patch) => {
      studio.updateTab(activeTab.id, patch);
    });
  }, [activeTab, studio]);

  const authPreview = useMemo(
    () => previewGrpcAuthMerge(activeTab.metadata, activeTab.auth),
    [activeTab.auth, activeTab.metadata],
  );

  const openSettingsDrawer = useCallback((nav: GrpcConnectionSettingsNav = 'tls') => {
    setProtoModalOpen(false);
    setTlsModalCloseRequest((count) => count + 1);
    setSettingsDrawerNav(nav);
    setSettingsDrawerOpen(true);
  }, []);

  const handleFocusAuthTab = useCallback(() => {
    setSettingsDrawerOpen(false);
    setAuthTabFocusRequest((count) => count + 1);
  }, []);

  const handleTlsBadgeClick = useCallback(() => {
    setSettingsDrawerOpen(false);
    setTlsModalOpenRequest((count) => count + 1);
  }, []);

  const handleDeadlineBadgeClick = useCallback(() => {
    openSettingsDrawer('call');
  }, [openSettingsDrawer]);

  const handleSettingsClick = useCallback(() => {
    openSettingsDrawer('tls');
  }, [openSettingsDrawer]);

  const healthAvailable = descriptorHasHealthService(studio.activeTabDescriptor.descriptor);
  const healthWatchAvailable = descriptorHasHealthWatch(studio.activeTabDescriptor.descriptor);

  const handleHealthCheck = useCallback(async (serviceName: string) => {
    if (!healthAvailable) {
      return { ok: false as const, error: 'Reflect services first — health.v1.Health/Check was not found.' };
    }
    if (!activeConnection.targetValidation.valid) {
      return {
        ok: false as const,
        error: activeConnection.targetValidation.reason ?? 'Invalid target address.',
      };
    }
    if (!tlsState.valid) {
      return { ok: false as const, error: 'Fix TLS configuration before running a health check.' };
    }
    const tab = studio.activeTab;
    const descriptorKey = tab.descriptorKey ?? studio.activeTabDescriptor.descriptor?.key;
    if (!descriptorKey) {
      return { ok: false as const, error: 'Reflect services first — descriptor key is required.' };
    }
    return executeGrpcHealthProbe({
      tabId: tab.id,
      descriptorKey,
      resolution: activeConnection,
      tlsConfig: tab.tlsConfig,
      metadata: tab.metadata,
      auth: tab.auth,
      compression: tab.compression,
      timeoutMs: tab.timeoutMs,
      serviceName,
    });
  }, [studio.activeTab, studio.activeTabDescriptor.descriptor?.key, activeConnection, tlsState, healthAvailable]);

  const handleHealthWatch = useCallback((serviceName: string) => {
    if (!healthWatchAvailable || !canReflect) return;
    const tab = studio.activeTab;
    const body = { service: serviceName.trim() };
    setSettingsDrawerOpen(false);
    flushSync(() => {
      studio.selectMethod(tab.id, GRPC_HEALTH_SERVICE_FULL_NAME, GRPC_HEALTH_WATCH_METHOD);
      studio.updateTab(tab.id, { body });
    });
    void studio.startStreamCall(tab.id, { body });
  }, [studio, healthWatchAvailable, canReflect]);

  const tabCallTypes = useMemo(() => {
    const map: Record<string, import('../../shared/grpc/contracts').GrpcCallType | undefined> = {};
    for (const tab of studio.tabs) {
      if (!tab.service || !tab.method) continue;
      const descriptor = studio.tabDescriptors[tab.id]?.descriptor;
      if (!descriptor) continue;
      map[tab.id] = findGrpcMethod(descriptor, tab.service, tab.method)?.callType;
    }
    return map;
  }, [studio.tabs, studio.tabDescriptors]);

  const studioConnectionChrome = (
    <>
      <GrpcConnectionBar
        target={activeTab.target}
        targetInvalid={!activeConnection.targetValidation.valid}
        tlsMode={resolvedTlsMode}
        tlsValid={tlsState.valid}
        auth={activeTab.auth}
        timeoutMs={activeTab.timeoutMs}
        targetConnection={activeTab.targetConnection}
        envName={envName}
        disabled={connectionEditingDisabled}
        onTargetChange={(value) => studio.updateTab(activeTab.id, { target: value })}
        onConnectionToggle={() => studio.toggleTargetConnection(activeTab.id)}
        onTlsBadgeClick={handleTlsBadgeClick}
        onAuthBadgeClick={handleFocusAuthTab}
        onDeadlineBadgeClick={handleDeadlineBadgeClick}
        onSettingsClick={handleSettingsClick}
        onSaveRequestClick={() => setSaveModalOpen(true)}
        onImportGrpcurlClick={() => setImportModalOpen(true)}
        saveRequestDisabled={!activeTab.service || !activeTab.method}
      />
      <GrpcTargetPanel
        target={activeTab.target}
        tlsMode={activeTab.tlsMode ?? activeConnection.tlsMode}
        fallbackTarget={
          activeTab.target.trim()
            ? ''
            : rawConnectionTarget
        }
        envVarMap={envVarMap}
        profiles={studio.profiles}
        connectionId={activeTab.connectionId}
        tabOverrides={activeTab.envVarOverrides}
        pageDefaults={pageDefaults}
      />
    </>
  );

  return (
    <div className="grpc-studio" data-testid="grpc-studio-page">
      <header className="grpc-studio-header">
        <div className="grpc-studio-header__title-group">
          <h1 className="grpc-studio-title">gRPC Studio</h1>
          <p className="grpc-studio-subtitle">Reflect services, compose requests, and invoke unary or streaming RPCs</p>
        </div>
        <ProtocolEndpointPreview
          draftUrl={endpointPreviewDraft}
          envVarMap={tabInterpolationEnv}
          protocolRowStatus={endpointProtocolStatus}
          computePreview={computeGrpcStudioTargetPreview}
          testId="grpc-endpoint-preview"
        />
      </header>

      <GrpcStudioSubNav
        activeView={panelView}
        historyCount={callHistory.entries.length}
        onSelect={setPanelView}
      />

      <div className="grpc-studio-page-connection-chrome" data-testid="grpc-connection-chrome">
        {studioConnectionChrome}
      </div>

      {panelView === 'studio' && (
        <GrpcTabBar
          tabs={studio.tabs}
          activeTabId={studio.activeTabId}
          canAddTab={studio.canAddTab}
          maxTabs={studio.maxTabs}
          tabCallTypes={tabCallTypes}
          onSelect={studio.selectTab}
          onAdd={studio.addTab}
          onClose={studio.closeTab}
          onDuplicate={studio.duplicateTab}
          onRename={studio.renameTab}
        />
      )}

      <div className="grpc-studio-body">
        {replayActions.lastActionError && (
          <p
            className="grpc-panel-action-error"
            role="alert"
            data-testid="grpc-replay-action-error"
          >
            {replayActions.lastActionError}
          </p>
        )}
        {panelView === 'collections' && (
          <GrpcCollectionsPanel
            collections={collections}
            selectedSavedId={selectedSavedId}
            onSelectSaved={(saved) => setSelectedSavedId(saved.id)}
            grpcurlForSaved={grpcurlForSaved}
            onOpenInStudio={(saved) => {
              replayActions.clearLastActionError();
              replayActions.openSavedRequestInStudio(saved);
            }}
            onCopyGrpcurl={(command) => { void copyTextToClipboard(command); }}
            lastUnaryResult={lastUnaryResultForSelected}
            openInStudioDisabled={!openInStudioStatusForSelected.executable}
            openInStudioTitle={openInStudioStatusForSelected.title}
            onSavedDeleted={(id) => {
              if (selectedSavedId === id) setSelectedSavedId(null);
            }}
          />
        )}
        {panelView === 'history' && (
          <GrpcHistoryPanel
            history={callHistory}
            studio={studio}
            envVarMap={envVarMap}
            pageDefaults={pageDefaults}
            profiles={studio.profiles}
            onReplay={(entry) => {
              replayActions.clearLastActionError();
              replayActions.replayHistoryEntry(entry);
            }}
            onCopyGrpcurl={(command) => { void copyTextToClipboard(command); }}
            grpcurlForEntry={grpcurlForHistoryEntry}
          />
        )}
        {panelView === 'advanced' && (
          <GrpcAdvancedFeaturesShell advanced={advancedFeatures} />
        )}
        {panelView === 'studio' && (() => {
          const tab = studio.activeTab;
          return (
            <div key={tab.id} className="grpc-tab-pane-wrapper">
              <GrpcExplorerPane
                tab={tab}
                tabPanelId={`grpc-tab-pane-${tab.id}`}
                descriptorState={studio.activeTabDescriptor}
                canReflect={canReflect}
                targetValid={activeConnection.targetValidation.valid}
                tlsValid={tlsState.valid}
                targetAddress={activeConnection.targetValidation.valid
                  ? activeConnection.target
                  : undefined}
                onReflect={() => { void studio.reflectTab(tab.id); }}
                onManageSchemas={() => {
                  if (!studio.activeTabDescriptor.protoIngest) {
                    studio.patchTabProtoIngest(tab.id, createDefaultProtoIngestState());
                  }
                  setProtoModalInitialTab(
                    studio.activeTabDescriptor.descriptor ? 'schema_browser' : undefined,
                  );
                  setSettingsDrawerOpen(false);
                  setProtoModalOpen(true);
                }}
                onSelectMethod={(serviceFullName, methodName) => {
                  studio.selectMethod(tab.id, serviceFullName, methodName);
                }}
                onToggleServiceExpanded={(serviceFullName) => {
                  studio.toggleServiceExpanded(tab.id, serviceFullName);
                }}
                onTabPatch={(patch) => studio.updateTab(tab.id, patch)}
                onUnmaskAuthSecretField={handleUnmaskAuthSecretField}
                onClearAuthSecretField={handleClearAuthSecretField}
                onSendUnary={(overrides) => { void studio.executeUnaryCall(tab.id, overrides); }}
                onCancelUnary={() => { void studio.cancelUnaryCall(tab.id); }}
                onStartStream={(overrides) => { void studio.startStreamCall(tab.id, overrides); }}
                onCancelStream={() => { void studio.cancelStreamCall(tab.id); }}
                onSendStreamMessage={(overrides) => { void studio.sendStreamMessageCall(tab.id, overrides); }}
                onEnqueueStreamMessage={(overrides) => {
                  studio.enqueueStreamMessage(tab.id, overrides?.body ?? tab.body);
                }}
                onRemovePendingStreamMessage={(index) => {
                  studio.removePendingStreamMessage(tab.id, index);
                }}
                onSendAllPendingStreamMessages={() => studio.sendAllPendingStreamMessages(tab.id)}
                onEndStream={() => { void studio.endStreamCall(tab.id); }}
                onClearStreamLog={() => studio.clearStreamLog(tab.id)}
                onRetryUnaryWithExpress={() => studio.retryUnaryWithExpress(tab.id)}
                onRetryStreamWithExpress={() => studio.retryStreamWithExpress(tab.id)}
                onDismissSchemaDrift={() => studio.dismissSchemaDrift(tab.id)}
                onPruneSchemaDriftBody={() => studio.pruneSchemaDriftBody(tab.id)}
                onRebindSchemaDriftMethod={(serviceFullName, methodName) => {
                  studio.rebindSchemaDriftMethod(tab.id, serviceFullName, methodName);
                }}
                authTabFocusRequest={authTabFocusRequest}
              />
            </div>
          );
        })()}
      </div>

      <GrpcSaveRequestModal
        open={saveModalOpen}
        collections={collections.collections}
        resolveSnapshot={resolveSaveSnapshot}
        onClose={() => setSaveModalOpen(false)}
        onCreateCollection={(name) => collections.addCollection(name)}
        onSave={async (collectionId, saved) => {
          await collections.saveRequest(collectionId, saved);
          setSelectedSavedId(saved.id);
          setPanelView('collections');
        }}
      />

      <GrpcGrpcurlImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={replayActions.applyGrpcurlImport}
      />

      {(() => {
        const tab = studio.activeTab;
        return (
          <GrpcTlsPanel
            key={`tls-modal-${tab.id}`}
            tlsMode={tab.tlsMode ?? activeConnection.tlsMode}
            tlsConfig={tab.tlsConfig}
            issues={tlsState.issues}
            maskedSecretFields={tab.maskedSecretFields?.tls}
            disabled={connectionEditingDisabled}
            openRequest={tlsModalOpenRequest}
            closeRequest={tlsModalCloseRequest}
            onTlsModeChange={(mode) => {
              studio.updateTab(tab.id, {
                tlsMode: mode,
                ...(mode === 'disabled'
                  ? {
                      tlsConfig: undefined,
                      maskedSecretFields: withoutTlsMaskFields(tab.maskedSecretFields),
                    }
                  : {}),
              });
            }}
            onTlsConfigChange={(patch) => {
              const mode = tab.tlsMode ?? activeConnection.tlsMode;
              studio.updateTab(tab.id, {
                tlsConfig: normalizeGrpcTlsConfig(
                  { ...tab.tlsConfig, ...patch },
                  mode,
                ),
              });
            }}
            onTlsStateRestore={({ tlsMode, tlsConfig }) => {
              studio.updateTab(tab.id, {
                tlsMode,
                tlsConfig,
                ...(tlsMode === 'disabled'
                  ? { maskedSecretFields: withoutTlsMaskFields(tab.maskedSecretFields) }
                  : {}),
              });
            }}
            onUnmaskSecretField={handleUnmaskTlsSecretField}
            onClearSecretField={handleClearTlsSecretField}
          />
        );
      })()}

      {(() => {
        const tab = studio.activeTab;
        return (
          <GrpcConnectionSettingsDrawer
            key={`settings-drawer-${tab.id}`}
            open={settingsDrawerOpen}
            activeNav={settingsDrawerNav}
            tlsMode={tab.tlsMode ?? activeConnection.tlsMode}
            tlsConfig={tab.tlsConfig}
            tlsIssues={tlsState.issues}
            auth={tab.auth}
            authPreview={authPreview}
            timeoutMs={tab.timeoutMs}
            compression={tab.compression}
            healthAvailable={healthAvailable}
            healthWatchAvailable={healthWatchAvailable}
            healthProbeReady={canReflect}
            healthBusy={connectionEditingDisabled}
            maskedSecretFields={tab.maskedSecretFields}
            disabled={connectionEditingDisabled}
            onNavChange={setSettingsDrawerNav}
            onClose={() => setSettingsDrawerOpen(false)}
            onTlsModeChange={(mode) => {
              studio.updateTab(tab.id, {
                tlsMode: mode,
                ...(mode === 'disabled'
                  ? {
                      tlsConfig: undefined,
                      maskedSecretFields: withoutTlsMaskFields(tab.maskedSecretFields),
                    }
                  : {}),
              });
            }}
            onTlsConfigChange={(patch) => {
              const mode = tab.tlsMode ?? activeConnection.tlsMode;
              studio.updateTab(tab.id, {
                tlsConfig: normalizeGrpcTlsConfig(
                  { ...tab.tlsConfig, ...patch },
                  mode,
                ),
              });
            }}
            onAuthChange={(auth) => studio.updateTab(tab.id, { auth })}
            onTimeoutMsChange={(timeoutMs) => studio.updateTab(tab.id, { timeoutMs })}
            onCompressionChange={(compression) => studio.updateTab(tab.id, { compression })}
            onHealthCheck={handleHealthCheck}
            onHealthWatch={handleHealthWatch}
            onUnmaskTlsSecretField={handleUnmaskTlsSecretField}
            onClearTlsSecretField={handleClearTlsSecretField}
            onUnmaskAuthSecretField={handleUnmaskAuthSecretField}
            onClearAuthSecretField={handleClearAuthSecretField}
            transportMode={resolveGrpcStudioTabTransportMode(tab)}
            transportChangeBlocked={!canChangeGrpcTabTransportMode(tab)}
            onTransportModeChange={(mode) => studio.setTabTransportMode(tab.id, mode)}
            callType={tabCallTypes[tab.id]}
          />
        );
      })()}

      <GrpcProtoManageModal
        open={protoModalOpen}
        ingest={activeProtoIngest}
        loadState={studio.activeTabDescriptor.loadState}
        loadError={
          protoModalOpen && studio.activeTabDescriptor.loadState === 'error'
            ? studio.activeTabDescriptor.errorMessage
            : undefined
        }
        descriptor={studio.activeTabDescriptor.descriptor}
        targetAddress={activeConnection.targetValidation.valid
          ? activeConnection.target
          : undefined}
        tlsMode={resolvedTlsMode}
        selectedService={studio.activeTab.service}
        selectedMethod={studio.activeTab.method}
        initialTab={protoModalInitialTab}
        onClose={() => {
          setProtoModalOpen(false);
          setProtoModalInitialTab(undefined);
        }}
        onIngestChange={(patch) => studio.patchTabProtoIngest(studio.activeTab.id, patch)}
        onSelectMethod={(serviceFullName, methodName) => {
          studio.selectMethod(studio.activeTab.id, serviceFullName, methodName);
        }}
        onOpenMethodInTab={(serviceFullName, methodName) => {
          studio.selectMethod(studio.activeTab.id, serviceFullName, methodName);
          setProtoModalOpen(false);
          setProtoModalInitialTab(undefined);
        }}
        onLoad={() => {
          void studio.describeFromIngest(studio.activeTab.id).then((loaded) => {
            if (loaded) setProtoModalOpen(false);
          });
        }}
        onExportProtoset={studio.activeTabDescriptor.descriptor
          ? async () => {
            setExportError(undefined);
            setExportProtosetBusy(true);
            try {
              await studio.exportProtoset(studio.activeTab.id);
            } catch (error) {
              const raw = error instanceof Error ? error.message : 'Failed to export protoset';
              setExportError(sanitizeGrpcErrorMessage(raw));
            } finally {
              setExportProtosetBusy(false);
            }
          }
          : undefined}
        exportProtosetBusy={exportProtosetBusy}
        exportError={exportError}
        grpcurlExportContext={studio.activeTab.grpcurlExportContext}
      />
    </div>
  );
}
