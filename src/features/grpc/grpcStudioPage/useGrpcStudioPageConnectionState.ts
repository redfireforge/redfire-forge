import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { GlobalAuthProfile } from '@shared/types';
import type { ProtoModalTab } from '../components/GrpcProtoManageModal';
import type { GrpcConnectionSettingsNav } from '../components/GrpcConnectionSettingsDrawer';
import { isGrpcLifecycleInFlight, createDefaultProtoIngestState, normalizeProtoIngestState } from '../grpcStudioTypes';
import { useGrpcTls } from '../hooks/useGrpcTls';
import type { UseGrpcStudioReturn } from '../hooks/useGrpcStudio';
import {
  descriptorHasHealthService,
  descriptorHasHealthWatch,
  executeGrpcHealthProbe,
  GRPC_HEALTH_SERVICE_FULL_NAME,
  GRPC_HEALTH_WATCH_METHOD,
} from '../utils/grpcHealthProbe';
import { resolveGrpcTabConnection } from '../utils/resolveGrpcTabConnection';
import {
  clearTabAuthSecretField,
  clearTabTlsSecretField,
  unmaskSecretField,
} from '../utils/grpcTabSecretVault';
import type { GrpcAuthSecretFieldKey, GrpcTlsSecretFieldKey } from '../utils/grpcSecretFieldUi';
import { resolveEffectiveGrpcAuth } from '../utils/grpcAuthProfileResolve';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import { isGrpcStreamLifecycleInFlight } from '@shared/grpc/streamLifecycle';
import { mergeGrpcTabInterpolationEnv } from '@shared/grpc/grpcInterpolationPrecedence';
import { resolveGrpcStudioEndpointPreviewDraft } from '@shared/grpc/grpcStudioTargetPreview';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';

export interface UseGrpcStudioPageConnectionStateOptions {
  studio: UseGrpcStudioReturn;
  envVarMap: Record<string, string>;
  workspaceDefaults: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  globalAuthProfiles: GlobalAuthProfile[];
  defaultAuthProfileId: string | null;
}

export function useGrpcStudioPageConnectionState({
  studio,
  envVarMap,
  workspaceDefaults,
  pageDefaults,
  globalAuthProfiles,
  defaultAuthProfileId,
}: UseGrpcStudioPageConnectionStateOptions) {
  const [protoModalOpen, setProtoModalOpen] = useState(false);
  const [protoModalInitialTab, setProtoModalInitialTab] = useState<ProtoModalTab | undefined>(undefined);
  const [exportProtosetBusy, setExportProtosetBusy] = useState(false);
  const [exportError, setExportError] = useState<string | undefined>();
  const [authTabFocusRequest, setAuthTabFocusRequest] = useState(0);
  const [tlsModalOpenRequest, setTlsModalOpenRequest] = useState(0);
  const [tlsModalCloseRequest, setTlsModalCloseRequest] = useState(0);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [settingsDrawerNav, setSettingsDrawerNav] = useState<GrpcConnectionSettingsNav>('call');
  const [settingsDrawerOpenRequest, setSettingsDrawerOpenRequest] = useState(0);
  const [tabCallCounts, setTabCallCounts] = useState<Record<string, number>>(() => Object.fromEntries(
    studio.tabs.map((tab) => [tab.id, 0]),
  ));
  const tabIdsRef = useRef(studio.tabs.map((tab) => tab.id).join('|'));
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

  const activeProtoIngest = normalizeProtoIngestState(studio.activeTabDescriptor.protoIngest);
  const activeConnection = studio.resolveTabConnection(studio.activeTab.id);
  const activeTab = studio.activeTab;
  const resolvedTlsMode = activeTab.tlsMode ?? activeConnection.tlsMode;
  const tlsState = useGrpcTls(
    resolvedTlsMode,
    activeTab.tlsConfig,
    activeConnection.targetValidation.valid
      ? activeConnection.targetValidation.normalized
      : activeConnection.target,
  );

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

  const resolvedActiveAuthState = useMemo(
    () => resolveEffectiveGrpcAuth(activeTab.auth, globalAuthProfiles, defaultAuthProfileId),
    [activeTab.auth, defaultAuthProfileId, globalAuthProfiles],
  );

  const openSettingsDrawer = useCallback((nav: GrpcConnectionSettingsNav = 'call') => {
    setProtoModalOpen(false);
    setTlsModalCloseRequest((count) => count + 1);
    setSettingsDrawerNav(nav);
    setSettingsDrawerOpenRequest((count) => count + 1);
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
    openSettingsDrawer('call');
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
      auth: resolveEffectiveGrpcAuth(tab.auth, globalAuthProfiles, defaultAuthProfileId).auth,
      compression: tab.compression,
      timeoutMs: tab.timeoutMs,
      serviceName,
    });
  }, [studio.activeTab, studio.activeTabDescriptor.descriptor?.key, activeConnection, tlsState, healthAvailable, globalAuthProfiles, defaultAuthProfileId]);

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
    const map: Record<string, import('../../../shared/grpc/contracts').GrpcCallType | undefined> = {};
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
    return descriptor.services.reduce((sum, service) => sum + (service.methods?.length ?? 0), 0);
  }, [studio.activeTabDescriptor.descriptor]);

  const openProtoModal = useCallback((initialTab?: ProtoModalTab) => {
    const tab = studio.activeTab;
    if (!studio.activeTabDescriptor.protoIngest) {
      studio.patchTabProtoIngest(tab.id, createDefaultProtoIngestState());
    }
    setProtoModalInitialTab(
      initialTab ?? (studio.activeTabDescriptor.descriptor ? 'schema_browser' : undefined),
    );
    setSettingsDrawerOpen(false);
    setProtoModalOpen(true);
  }, [studio]);

  const closeProtoModal = useCallback(() => {
    setProtoModalOpen(false);
    setProtoModalInitialTab(undefined);
  }, []);

  return {
    activeTab,
    activeConnection,
    activeProtoIngest,
    authTabFocusRequest,
    canReflect,
    connectionEditingDisabled,
    endpointPreviewDraft,
    exportError,
    exportProtosetBusy,
    handleClearAuthSecretField,
    handleClearTlsSecretField,
    handleDeadlineBadgeClick,
    handleFocusAuthTab,
    handleHealthCheck,
    handleHealthWatch,
    handleSettingsClick,
    handleTlsBadgeClick,
    handleUnmaskAuthSecretField,
    handleUnmaskTlsSecretField,
    healthAvailable,
    healthWatchAvailable,
    incrementTabCallCount,
    protoModalInitialTab,
    protoModalOpen,
    reflectionLoadedCount,
    resolvedActiveAuthState,
    resolvedTlsMode,
    rawConnectionTarget,
    setExportError,
    setExportProtosetBusy,
    setProtoModalOpen,
    setProtoModalInitialTab,
    setSettingsDrawerNav,
    setSettingsDrawerOpen,
    settingsDrawerNav,
    settingsDrawerOpen,
    settingsDrawerOpenRequest,
    tabCallCounts,
    tabCallTypes,
    tabInterpolationEnv,
    tlsModalCloseRequest,
    tlsModalOpenRequest,
    tlsState,
    openProtoModal,
    closeProtoModal,
  };
}
