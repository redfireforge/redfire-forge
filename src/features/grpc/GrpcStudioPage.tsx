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
import { useGrpcStudioPersistence } from './hooks/useGrpcStudioPersistence';
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
import {
  useGrpcSavedRequestRunTracking,
  useGrpcSelectedSavedRequest,
  useGrpcStudioSaveSnapshot,
} from './hooks/useGrpcStudioPageCollections';
import type { GrpcSavedRequest } from '../../shared/grpc/grpcSavedRequest';
import type { GrpcCallHistoryEntryV1 } from '../../shared/grpc/grpcPersistenceSchema';
import { findGrpcMethod } from './utils/grpcExplorerUtils';
import { buildLegacyGrpcEnvVarMap as buildLegacyGrpcEnvVarMapImpl } from './utils/grpcStudioPageEnv';
import {
  buildGrpcTlsConfigTabPatch,
  buildGrpcTlsModeTabPatch,
  buildGrpcTlsStateRestoreTabPatch,
} from './utils/grpcStudioTlsTabPatches';
import { sanitizeGrpcErrorMessage } from '../../shared/grpc/grpcRedaction';
import { isGrpcStreamLifecycleInFlight } from '../../shared/grpc/streamLifecycle';
import { postGrpcDescriptorLookup } from '../../shared/grpc/grpcApiClient';
import { resolveGrpcTabConnection } from './utils/resolveGrpcTabConnection';
import {
  clearTabAuthSecretField,
  clearTabTlsSecretField,
  unmaskSecretField,
} from './utils/grpcTabSecretVault';
import type { GrpcAuthSecretFieldKey, GrpcTlsSecretFieldKey } from './utils/grpcSecretFieldUi';
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

type GrpcStudioDensityMode = 'compact' | 'comfortable';
const GRPC_STUDIO_DENSITY_STORAGE_KEY = 'grpc-studio-density-mode';

/** @deprecated Import from `./utils/grpcStudioPageEnv` — re-exported for tests. */
// eslint-disable-next-line react-refresh/only-export-components
export const buildLegacyGrpcEnvVarMap = buildLegacyGrpcEnvVarMapImpl;

export function GrpcStudioPage({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
}: GrpcStudioPageProps) {
  const [densityMode, setDensityMode] = useState<GrpcStudioDensityMode>(() => {
    try {
      const stored = window.localStorage.getItem(GRPC_STUDIO_DENSITY_STORAGE_KEY);
      return stored === 'comfortable' ? 'comfortable' : 'compact';
    } catch {
      return 'compact';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(GRPC_STUDIO_DENSITY_STORAGE_KEY, densityMode);
    } catch {
      /* persistence best-effort */
    }
  }, [densityMode]);

  const envVarMap = useMemo(() => {
    if (selectedSvc && selectedEnvId) {
      return buildEnvVarMap(selectedSvc, selectedEnvId, 'grpc', envName);
    }
    return buildLegacyGrpcEnvVarMapImpl(resolvedBaseUrl, envName, svcName);
  }, [selectedSvc, selectedEnvId, resolvedBaseUrl, envName, svcName]);

  const workspaceDefaults = useMemo(
    () => buildLegacyGrpcEnvVarMap(resolvedBaseUrl, envName, svcName),
    [resolvedBaseUrl, envName, svcName],
  );

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
    workspaceDefaults,
    pageDefaults,
  });

  // Wire up session state persistence (saves to localStorage on change, restores on mount)
  const hasRestoredSessionRef = useRef(false);
  useGrpcStudioPersistence({ tabs: studio.tabs, activeTabId: studio.activeTabId, tabDescriptors: studio.tabDescriptors }, (persisted) => {
    if (hasRestoredSessionRef.current) return; // Only restore once per mount
    hasRestoredSessionRef.current = true;
    studio.restorePersistedSession(persisted);
  });

  const collections = useGrpcCollections();
  const callHistory = useGrpcCallHistory();
  const [panelView, setPanelView] = useState<GrpcStudioPanelView>('studio');
  const [tabCallCounts, setTabCallCounts] = useState<Record<string, number>>(() => Object.fromEntries(
    studio.tabs.map((tab) => [tab.id, 0]),
  ));
  const tabIdsRef = useRef(studio.tabs.map((tab) => tab.id).join('|'));
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
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

  const activeDescriptorKey = (studio.activeTabDescriptor.descriptor?.key ?? studio.activeTab.descriptorKey ?? '').trim();

  const compareSavedRequestSchemaInAdvanced = useCallback(async (saved: GrpcSavedRequest) => {
    if (!activeDescriptorKey) {
      return;
    }
    const descriptorCache = new Map<string, Promise<import('../../shared/grpc/contracts').GrpcDescriptor>>();
    const resolveDescriptor = (descriptorKey: string) => {
      const key = descriptorKey.trim();
      if (!key) {
        return Promise.reject(new Error('Descriptor key is required'));
      }
      const cached = descriptorCache.get(key);
      if (cached) {
        return cached;
      }
      const pending = postGrpcDescriptorLookup({
        requestId: `lookup-${Date.now()}-${key}`,
        descriptorKey: key,
      }).then((envelope) => envelope.data);
      descriptorCache.set(key, pending);
      return pending;
    };

    try {
      const intent = collections.buildSavedRequestSchemaCompareIntent(saved, activeDescriptorKey);
      if (!intent.keysDiffer) {
        return;
      }
      const report = await collections.compareSavedRequestSchema(saved, activeDescriptorKey, resolveDescriptor);
      const baselineDescriptor = await resolveDescriptor(intent.baselineDescriptorKey);
      advancedFeatures.applySchemaDiffComparison({
        baselineDescriptor,
        report,
        baselineCapturedAt: saved.updatedAt,
      });
      setPanelView('advanced');
      advancedFeatures.setActiveFeatureTab('schema_diff');
    } catch {
      /* replay error banner remains source-of-truth for action failures */
    }
  }, [activeDescriptorKey, advancedFeatures, collections]);

  const openHistorySchemaDiff = useCallback(async (entry: GrpcCallHistoryEntryV1) => {
    if (!activeDescriptorKey) {
      return;
    }
    const driftIntent = collections.detectHistoryDescriptorDrift(entry, activeDescriptorKey);
    if (!driftIntent) {
      return;
    }

    const descriptorCache = new Map<string, Promise<import('../../shared/grpc/contracts').GrpcDescriptor>>();
    const resolveDescriptor = (descriptorKey: string) => {
      const key = descriptorKey.trim();
      if (!key) {
        return Promise.reject(new Error('Descriptor key is required'));
      }
      const cached = descriptorCache.get(key);
      if (cached) {
        return cached;
      }
      const pending = postGrpcDescriptorLookup({
        requestId: `lookup-${Date.now()}-${key}`,
        descriptorKey: key,
      }).then((envelope) => envelope.data);
      descriptorCache.set(key, pending);
      return pending;
    };

    try {
      const report = await collections.buildHistoryDescriptorDriftReport(entry, activeDescriptorKey, resolveDescriptor);
      if (!report) {
        return;
      }
      const baselineDescriptor = await resolveDescriptor(driftIntent.baselineDescriptorKey);
      advancedFeatures.applySchemaDiffComparison({
        baselineDescriptor,
        report,
        baselineCapturedAt: entry.capturedAt,
      });
      setPanelView('advanced');
      advancedFeatures.setActiveFeatureTab('schema_diff');
    } catch {
      /* replay error banner remains source-of-truth for action failures */
    }
  }, [activeDescriptorKey, advancedFeatures, collections]);

  useGrpcSavedRequestRunTracking({
    studio,
    collections,
    savedReplaySourceByTabId,
  });

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
  const [authTabFocusRequest] = useState(0);
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
      workspaceDefaults,
      activeEnvironment: envVarMap,
      profiles: studio.profiles,
      connectionId: activeTab.connectionId,
      tabOverrides: activeTab.envVarOverrides,
    }),
    [workspaceDefaults, envVarMap, studio.profiles, activeTab.connectionId, activeTab.envVarOverrides],
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
    openSettingsDrawer('auth');
  }, [openSettingsDrawer]);

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

  useEffect(() => {
    const tabIds = studio.tabs.map((tab) => tab.id).join('|');
    if (tabIdsRef.current === tabIds) {
      return;
    }
    tabIdsRef.current = tabIds;
    setTabCallCounts((prior) => {
      const next: Record<string, number> = {};
      for (const tab of studio.tabs) {
        next[tab.id] = prior[tab.id] ?? 0;
      }
      return next;
    });
  }, [studio.tabs]);

  const incrementTabCallCount = useCallback((tabId: string) => {
    setTabCallCounts((prior) => ({
      ...prior,
      [tabId]: (prior[tabId] ?? 0) + 1,
    }));
  }, []);

  const reflectionLoadedCount = useMemo(() => {
    const descriptor = studio.activeTabDescriptor.descriptor;
    if (!descriptor?.services) return 0;
    // Count total methods across all services
    return descriptor.services.reduce((sum, service) => sum + (service.methods?.length ?? 0), 0);
  }, [studio.activeTabDescriptor.descriptor]);

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
        reflectionLoadedCount={reflectionLoadedCount}
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
        workspaceDefaults={workspaceDefaults}
        profiles={studio.profiles}
        connectionId={activeTab.connectionId}
        tabOverrides={activeTab.envVarOverrides}
        body={activeTab.body}
        metadata={activeTab.metadata}
        auth={activeTab.auth}
        pageDefaults={pageDefaults}
      />
    </>
  );

  return (
    <div
      className={`grpc-studio grpc-studio--density-${densityMode}`}
      data-testid="grpc-studio-page"
    >
      <header className="grpc-studio-header grpc-studio-header--with-subnav">
        <div className="grpc-studio-header__left" data-testid="grpc-studio-header-left">
          <GrpcStudioSubNav
            activeView={panelView}
            historyCount={callHistory.entries.length}
            onSelect={setPanelView}
          />
        </div>
        <div className="grpc-studio-header__right" data-testid="grpc-studio-header-right">
          <ProtocolEndpointPreview
            draftUrl={endpointPreviewDraft}
            envVarMap={tabInterpolationEnv}
            protocolRowStatus={endpointProtocolStatus}
            computePreview={computeGrpcStudioTargetPreview}
            testId="grpc-endpoint-preview"
          />
          <div
            className="grpc-density-toggle"
            role="group"
            aria-label="Response layout density"
            data-testid="grpc-density-toggle"
          >
            <button
              type="button"
              className={`grpc-density-toggle__btn${densityMode === 'compact' ? ' grpc-density-toggle__btn--active' : ''}`}
              onClick={() => setDensityMode('compact')}
              data-testid="grpc-density-compact-btn"
              aria-pressed={densityMode === 'compact'}
            >
              Compact
            </button>
            <button
              type="button"
              className={`grpc-density-toggle__btn${densityMode === 'comfortable' ? ' grpc-density-toggle__btn--active' : ''}`}
              onClick={() => setDensityMode('comfortable')}
              data-testid="grpc-density-comfortable-btn"
              aria-pressed={densityMode === 'comfortable'}
            >
              Comfortable
            </button>
          </div>
        </div>
      </header>

      {panelView === 'studio' && (
        <GrpcTabBar
          tabs={studio.tabs}
          activeTabId={studio.activeTabId}
          canAddTab={studio.canAddTab}
          maxTabs={studio.maxTabs}
          tabCallTypes={tabCallTypes}
          tabCallCounts={tabCallCounts}
          onSelect={studio.selectTab}
          onAdd={studio.addTab}
          onClose={studio.closeTab}
          onDuplicate={studio.duplicateTab}
          onRename={studio.renameTab}
        />
      )}

      {panelView !== 'studio' && (
        <div className="grpc-studio-page-connection-chrome" data-testid="grpc-connection-chrome">
          {studioConnectionChrome}
        </div>
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
            onOpenInStudio={(saved, collectionId) => {
              replayActions.clearLastActionError();
              replayActions.openSavedRequestInStudio(saved);
              setSavedReplaySourceByTabId((prev) => ({
                ...prev,
                [studio.activeTab.id]: { collectionId, savedId: saved.id },
              }));
            }}
            onCompareSchema={(saved, collectionId) => {
              replayActions.clearLastActionError();
              const opened = replayActions.openSavedRequestInStudio(saved);
              if (!opened) return;
              void compareSavedRequestSchemaInAdvanced(saved);
              setSavedReplaySourceByTabId((prev) => ({
                ...prev,
                [studio.activeTab.id]: { collectionId, savedId: saved.id },
              }));
            }}
            onRunLoadTest={(saved, collectionId) => {
              replayActions.clearLastActionError();
              const opened = replayActions.openSavedRequestForLoadTest(saved);
              if (!opened) return;
              advancedFeatures.setActiveFeatureTab('load_test');
              setSavedReplaySourceByTabId((prev) => ({
                ...prev,
                [studio.activeTab.id]: { collectionId, savedId: saved.id },
              }));
            }}
            onCopyGrpcurl={(command) => { void copyTextToClipboard(command); }}
            lastUnaryResult={lastUnaryResultForSelected}
            activeTab={studio.activeTab}
            openInStudioDisabled={!openInStudioStatusForSelected.executable}
            openInStudioTitle={openInStudioStatusForSelected.title}
            compareSchemaDisabled={!compareSchemaStatusForSelected.executable}
            compareSchemaTitle={compareSchemaStatusForSelected.title}
            runLoadTestDisabled={!runLoadTestStatusForSelected.executable}
            runLoadTestTitle={runLoadTestStatusForSelected.title}
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
            onOpenDiff={(entry) => {
              replayActions.clearLastActionError();
              const replayed = replayActions.replayHistoryEntry(entry);
              if (!replayed) return;
              void openHistorySchemaDiff(entry);
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
                connectionChrome={studioConnectionChrome}
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
                onSendUnary={(overrides) => {
                  incrementTabCallCount(tab.id);
                  void studio.executeUnaryCall(tab.id, overrides);
                }}
                onCancelUnary={() => { void studio.cancelUnaryCall(tab.id); }}
                onStartStream={(overrides) => {
                  incrementTabCallCount(tab.id);
                  void studio.startStreamCall(tab.id, overrides);
                }}
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
              studio.updateTab(tab.id, buildGrpcTlsModeTabPatch({ tab, activeConnection }, mode));
            }}
            onTlsConfigChange={(patch) => {
              studio.updateTab(tab.id, buildGrpcTlsConfigTabPatch({ tab, activeConnection }, patch));
            }}
            onTlsStateRestore={({ tlsMode, tlsConfig }) => {
              studio.updateTab(tab.id, buildGrpcTlsStateRestoreTabPatch(tab, { tlsMode, tlsConfig }));
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
              studio.updateTab(tab.id, buildGrpcTlsModeTabPatch({ tab, activeConnection }, mode));
            }}
            onTlsConfigChange={(patch) => {
              studio.updateTab(tab.id, buildGrpcTlsConfigTabPatch({ tab, activeConnection }, patch));
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
            k8sPortForward={tab.k8sPortForward}
            k8sAutomationScopeId={tab.id}
            onK8sPortForwardChange={(session) => studio.updateTab(tab.id, { k8sPortForward: session })}
            onK8sApplyTarget={(target) => studio.updateTab(tab.id, { target })}
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
        onOpenMethodInTab={(serviceFullName, methodName, requestBody) => {
          studio.selectMethod(studio.activeTab.id, serviceFullName, methodName);
          studio.updateTab(studio.activeTab.id, { body: requestBody });
          setProtoModalOpen(false);
          setProtoModalInitialTab(undefined);
        }}
        onLoad={() => {
          void studio.describeFromIngest(studio.activeTab.id);
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
