import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GlobalAuthProfile } from '@shared/types';
import type { GrpcConnectionProfile, GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import {
  canChangeGrpcTabTransportMode,
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  normalizeProtoIngestState,
  type GrpcStudioTransportMode,
} from '../grpcStudioTypes';
import {
  syncGrpcStudioTabTransport,
} from '../utils/grpcStudioTransportSync';
import { isGrpcExpressFallbackOffered } from '@shared/grpc/grpcTransportFallback';
import {
  GRPC_DEMO_PLAINTEXT_TARGET,
  isKnownEncryptedLoopbackGrpcTarget,
} from '@shared/grpc/grpcTlsPolicy';
import { mountGrpcStudioNativeTransport, registerGrpcStudioAppLifecycle } from './grpcStudioTabLifecycle';
import {
  detachStreamEventsForTab,
} from './grpcStreamSessionHelpers';
import {
  createDescribeFromIngestHandler,
  createExportProtosetHandler,
  createPatchTabProtoIngestHandler,
  createReflectTabHandler,
} from './grpcStudioDescriptorLoad';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import {
  createAddTabHandler,
  createAbortTabInFlightCallsHandler,
  createCloseTabHandler,
  createCloseOtherTabsHandler,
  createCloseTabsToRightHandler,
  createDismissSchemaDriftHandler,
  createDuplicateTabHandler,
  createPruneSchemaDriftBodyHandler,
  createRebindSchemaDriftMethodHandler,
  createRenameTabHandler,
  createReorderTabHandler,
  createResolveTabConnectionHandler,
  createSelectMethodHandler,
  createSelectTabHandler,
  createToggleServiceExpandedHandler,
} from './grpcStudioTabCommands';
import {
  createConnectTargetHandler,
  createDisconnectTargetHandler,
  createToggleTargetConnectionHandler,
} from './grpcStudioTargetConnection';
import {
  createCancelUnaryCallHandler,
  createExecuteUnaryCallHandler,
  createPrepareExecuteSnapshotHandler,
} from './grpcStudioUnaryCommands';
import { tabAwaitingStreamEvents, useGrpcStreamSession } from './useGrpcStreamSession';
import { useGrpcStudioSessionCore } from './useGrpcStudioSessionCore';
import { hydrateActiveTabSecretsFromVault, buildVaultHydrationEffectKey } from '../utils/grpcTabSecretVault';
import type { GrpcStudioPersistedSession } from './useGrpcStudioPersistence';

export const GRPC_STUDIO_MAX_TABS = 8;

const EMPTY_ENV_VAR_MAP: Record<string, string> = {};
const EMPTY_GRPC_PROFILES: GrpcConnectionProfile[] = [];
const EMPTY_GLOBAL_AUTH_PROFILES: GlobalAuthProfile[] = [];

function isLoopbackTargetAddress(rawTarget: string | undefined): boolean {
  const value = rawTarget?.trim().toLowerCase();
  if (!value) return false;
  const withoutScheme = value.replace(/^[a-z]+:\/\//, '');
  if (withoutScheme.startsWith('[')) {
    const endIndex = withoutScheme.indexOf(']');
    return endIndex > 0 && withoutScheme.slice(1, endIndex) === '::1';
  }
  const host = withoutScheme.split(':')[0] ?? '';
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export interface UseGrpcStudioOptions {
  envVarMap?: Record<string, string>;
  workspaceDefaults?: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  profiles?: GrpcConnectionProfile[];
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
  maxTabs?: number;
  /** Phase 1G wires DELETE /api/grpc/call/:requestId; 1D invokes on tab close / cancel. */
  onCancelInFlight?: (tabId: string, requestId: string) => void;
}

export function useGrpcStudio(options: UseGrpcStudioOptions) {
  const {
    envVarMap = EMPTY_ENV_VAR_MAP,
    workspaceDefaults,
    pageDefaults,
    profiles = EMPTY_GRPC_PROFILES,
    globalAuthProfiles = EMPTY_GLOBAL_AUTH_PROFILES,
    defaultAuthProfileId = null,
    maxTabs = GRPC_STUDIO_MAX_TABS,
    onCancelInFlight,
  } = options;

  const fireCancelInFlight = useCallback((tabId: string, requestId: string) => {
    onCancelInFlight?.(tabId, requestId);
  }, [onCancelInFlight]);

  const core = useGrpcStudioSessionCore({
    envVarMap,
    workspaceDefaults,
    profiles,
    pageDefaults,
    fireCancelInFlight,
  });

  const runtimeCtx = useMemo((): GrpcStudioRuntimeContext => ({
    sessionRef: core.sessionRef,
    tabsRef: core.tabsRef,
    setSession: core.setSession,
    commitSession: core.commitSession,
    descriptorLoadGenerationRef: core.descriptorLoadGenerationRef,
    callGenerationRef: core.callGenerationRef,
    streamGenerationRef: core.streamGenerationRef,
    streamDisposeRef: core.streamDisposeRef,
    inFlightCallRef: core.inFlightCallRef,
    tabConnectionFingerprintRef: core.tabConnectionFingerprintRef,
    fireCancelInFlight,
    envVarMap,
    workspaceDefaults,
    profiles,
    globalAuthProfiles,
    defaultAuthProfileId,
    pageDefaults,
    maxTabs,
    updateTab: core.updateTab,
    patchTabDescriptor: core.patchTabDescriptor,
  }), [
    core.sessionRef,
    core.tabsRef,
    core.setSession,
    core.commitSession,
    core.descriptorLoadGenerationRef,
    core.callGenerationRef,
    core.streamGenerationRef,
    core.streamDisposeRef,
    core.inFlightCallRef,
    core.tabConnectionFingerprintRef,
    core.updateTab,
    core.patchTabDescriptor,
    fireCancelInFlight,
    envVarMap,
    workspaceDefaults,
    profiles,
    globalAuthProfiles,
    defaultAuthProfileId,
    pageDefaults,
    maxTabs,
  ]);

  const addTab = useMemo(() => createAddTabHandler(runtimeCtx, core), [runtimeCtx, core]);
  const selectTab = useMemo(() => createSelectTabHandler(core), [core]);
  const renameTab = useMemo(() => createRenameTabHandler(runtimeCtx), [runtimeCtx]);
  const closeTab = useMemo(() => createCloseTabHandler(runtimeCtx, core), [runtimeCtx, core]);
  const duplicateTab = useMemo(() => createDuplicateTabHandler(runtimeCtx, core), [runtimeCtx, core]);
  const reorderTabs = useMemo(() => createReorderTabHandler(core), [core]);
  const closeOtherTabs = useMemo(() => createCloseOtherTabsHandler(core, closeTab), [core, closeTab]);
  const closeTabsToRight = useMemo(() => createCloseTabsToRightHandler(core, closeTab), [core, closeTab]);
  const toggleServiceExpanded = useMemo(() => createToggleServiceExpandedHandler(core), [core]);
  const selectMethod = useMemo(() => createSelectMethodHandler(runtimeCtx, core), [runtimeCtx, core]);
  const abortTabInFlightCalls = useMemo(
    () => createAbortTabInFlightCallsHandler(runtimeCtx, core),
    [runtimeCtx, core],
  );
  const reflectTab = useMemo(() => createReflectTabHandler(runtimeCtx), [runtimeCtx]);
  const patchTabProtoIngest = useMemo(() => createPatchTabProtoIngestHandler(runtimeCtx), [runtimeCtx]);
  const describeFromIngest = useMemo(() => createDescribeFromIngestHandler(runtimeCtx), [runtimeCtx]);
  const exportProtoset = useMemo(() => createExportProtosetHandler(runtimeCtx), [runtimeCtx]);
  const resolveTabConnection = useMemo(() => createResolveTabConnectionHandler(runtimeCtx), [runtimeCtx]);

  const connectTarget = useMemo(
    () => createConnectTargetHandler(runtimeCtx, core),
    [runtimeCtx, core],
  );
  const disconnectTarget = useMemo(
    () => createDisconnectTargetHandler(core),
    [core],
  );
  const toggleTargetConnection = useMemo(
    () => createToggleTargetConnectionHandler(core, connectTarget, disconnectTarget),
    [core, connectTarget, disconnectTarget],
  );

  const dismissSchemaDrift = useMemo(() => createDismissSchemaDriftHandler(runtimeCtx), [runtimeCtx]);
  const pruneSchemaDriftBody = useMemo(() => createPruneSchemaDriftBodyHandler(runtimeCtx), [runtimeCtx]);
  const rebindSchemaDriftMethod = useMemo(
    () => createRebindSchemaDriftMethodHandler(runtimeCtx, core),
    [runtimeCtx, core],
  );

  const prepareExecuteSnapshot = useMemo(
    () => createPrepareExecuteSnapshotHandler(runtimeCtx, core),
    [runtimeCtx, core],
  );

  const cancelUnaryCall = useMemo(
    () => createCancelUnaryCallHandler(runtimeCtx, core, onCancelInFlight),
    [runtimeCtx, core, onCancelInFlight],
  );

  const cancelInFlightForTab = useCallback((tabId: string) => {
    void cancelUnaryCall(tabId);
  }, [cancelUnaryCall]);

  const executeUnaryCall = useMemo(
    () => createExecuteUnaryCallHandler(runtimeCtx, core, prepareExecuteSnapshot),
    [runtimeCtx, core, prepareExecuteSnapshot],
  );

  const {
    attachStreamEventsForTab,
    startStreamCall,
    cancelStreamCall,
    sendStreamMessageCall,
    enqueueStreamMessage,
    removePendingStreamMessage,
    sendAllPendingStreamMessages,
    endStreamCall,
    clearStreamLog,
  } = useGrpcStreamSession({
    sessionRef: core.sessionRef,
    streamGenerationRef: core.streamGenerationRef,
    streamDisposeRef: core.streamDisposeRef,
    callGenerationRef: core.callGenerationRef,
    inFlightCallRef: core.inFlightCallRef,
    commitSession: core.commitSession,
    setSession: core.setSession,
    updateTab: core.updateTab,
    prepareExecuteSnapshot,
    onCancelInFlight: fireCancelInFlight,
  });

  useEffect(() => {
    return mountGrpcStudioNativeTransport();
  }, []);

  useEffect(() => {
    return registerGrpcStudioAppLifecycle({
      getTabIds: () => core.tabsRef.current.map((tab) => tab.id),
      detachStreamEvents: (tabId) => detachStreamEventsForTab(core.streamDisposeRef, tabId),
    });
  }, [core.tabsRef, core.streamDisposeRef]);

  useEffect(() => {
    const tab = core.tabsRef.current.find((entry) => entry.id === core.activeTab.id);
    if (tab && tabAwaitingStreamEvents(tab)) {
      attachStreamEventsForTab(core.activeTab.id);
    }
  }, [core.activeTab, attachStreamEventsForTab, core.tabsRef]);

  const hydratedVaultOwnersRef = useRef(new Set<string>());

  const vaultHydrationKey = useMemo(
    () => buildVaultHydrationEffectKey(core.activeTab, core.activeTabDescriptor),
    [core.activeTab, core.activeTabDescriptor],
  );

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }
    void hydrateActiveTabSecretsFromVault(
      core.activeTab,
      core.activeTabDescriptor,
      core.updateTab,
      hydratedVaultOwnersRef.current,
    );
  }, [vaultHydrationKey, core.activeTab, core.activeTabDescriptor, core.updateTab]);

  // Re-sync the transport registry whenever tab state changes. Depending on
  // tabsRef alone never re-ran after restore/updateTab — leftover grpc-web
  // registrations then produced browser-direct calls to plaintext :50051
  // (net::ERR_INVALID_HTTP_RESPONSE) during Demo Hub lesson setup.
  useEffect(() => {
    for (const tab of core.tabs) {
      if (canChangeGrpcTabTransportMode(tab)) {
        syncGrpcStudioTabTransport(tab);
      }
    }
  }, [core.tabs]);

  const setTabTransportMode = useCallback((tabId: string, mode: GrpcStudioTransportMode) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || !canChangeGrpcTabTransportMode(tab)) {
      return;
    }
    core.updateTab(tabId, { transportMode: mode });
    syncGrpcStudioTabTransport({ ...tab, transportMode: mode });
  }, [core]);

  const retryUnaryWithExpress = useCallback((tabId: string) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || !isGrpcExpressFallbackOffered(tab.lastError)) {
      return;
    }
    core.updateTab(tabId, {
      transportMode: 'express',
      lifecycle: 'idle',
    });
    syncGrpcStudioTabTransport({ ...tab, transportMode: 'express' });
    // core.updateTab schedules a React state update — sessionRef.current is not
    // guaranteed to reflect 'express' synchronously (batching). Pass the mode as
    // an explicit override so the retried call itself always dispatches via
    // Express regardless of when the state update commits.
    void executeUnaryCall(tabId, { transportMode: 'express' });
  }, [core, executeUnaryCall]);

  const retryStreamWithExpress = useCallback((tabId: string) => {
    const tab = core.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab || !isGrpcExpressFallbackOffered(tab.streamError)) {
      return;
    }
    core.updateTab(tabId, {
      transportMode: 'express',
      streamError: undefined,
    });
    syncGrpcStudioTabTransport({ ...tab, transportMode: 'express' });
    // Same React-batching hazard as retryUnaryWithExpress — force the mode via override.
    void startStreamCall(tabId, { transportMode: 'express' });
  }, [core, startStreamCall]);

  const canAddTab = core.tabs.length < maxTabs;

  const restorePersistedSession = useCallback((persisted: GrpcStudioPersistedSession) => {
    const persistedTabs = Array.isArray(persisted.tabs)
      ? persisted.tabs.slice(0, maxTabs)
      : [];
    if (persistedTabs.length === 0) {
      return;
    }

    const restoredTabs = persistedTabs.reduce<typeof core.tabs>((acc, persistedTab) => {
      const stickyEncryptedMode = persistedTab.tlsMode === 'tls' || persistedTab.tlsMode === 'mtls';
      const loopback = isLoopbackTargetAddress(persistedTab.target);
      const onEncryptedDemoPort = isKnownEncryptedLoopbackGrpcTarget(persistedTab.target ?? '');
      // Leftover GRPC-5 tabs keep :50443/:50444 — plaintext Reflect → HTTP 503.
      // Also clear sticky TLS/mTLS on loopback plaintext ports.
      const shouldResetToPlaintext = !persistedTab.connectionId
        && loopback
        && (stickyEncryptedMode || onEncryptedDemoPort);
      // Browser-direct modes against plaintext :50051 fail with
      // net::ERR_INVALID_HTTP_RESPONSE — restore Express for local fixtures.
      const stickyBrowserDirect = persistedTab.transportMode === 'grpc-web'
        || persistedTab.transportMode === 'spring-servlet';
      const shouldResetTransport = loopback && stickyBrowserDirect;
      const normalizedPersistedTab = (shouldResetToPlaintext || shouldResetTransport)
        ? {
          ...persistedTab,
          ...(shouldResetToPlaintext
            ? {
              // Explicit disabled — undefined falls through to profile/page TLS.
              tlsMode: 'disabled' as const,
              tlsConfig: undefined,
              // Remap TLS/mTLS demo ports back to the plaintext echo fixture.
              ...(onEncryptedDemoPort ? { target: GRPC_DEMO_PLAINTEXT_TARGET } : {}),
            }
            : {}),
          ...(shouldResetTransport ? { transportMode: 'express' as const } : {}),
        }
        : persistedTab;
      const tab = createGrpcStudioTab(normalizedPersistedTab, acc);
      // Keep the module-level transport registry in sync — invokeGrpcUnary falls
      // back to resolveGrpcTransportForTab(tabId) when snapshot mode is omitted.
      syncGrpcStudioTabTransport(tab);
      acc.push(tab);
      return acc;
    }, []);

    const persistedTabDescriptors = (persisted.tabDescriptors && typeof persisted.tabDescriptors === 'object')
      ? persisted.tabDescriptors
      : {};

    const restoredTabDescriptors = Object.fromEntries(
      restoredTabs.map((tab) => {
        const rawPersistedDescriptor = persistedTabDescriptors[tab.id];
        const persistedDescriptor = (rawPersistedDescriptor && typeof rawPersistedDescriptor === 'object')
          ? rawPersistedDescriptor
          : undefined;
        const descriptorSnapshot = persisted.descriptorSnapshots?.[tab.id];
        const snapshotDescriptor = descriptorSnapshot?.descriptor;
        const snapshotLastKnownGood = descriptorSnapshot?.lastKnownGoodDescriptor ?? snapshotDescriptor;
        return [
          tab.id,
          {
            ...createEmptyTabDescriptorState(),
            ...(persistedDescriptor
              ? {
                sourceSelection: persistedDescriptor.sourceSelection,
                expandedServiceIds: persistedDescriptor.expandedServiceIds,
                protoIngest: persistedDescriptor.protoIngest
                  ? normalizeProtoIngestState(persistedDescriptor.protoIngest)
                  : undefined,
              }
              : {}),
            ...(snapshotDescriptor
              ? {
                loadState: 'loaded' as const,
                descriptor: snapshotDescriptor,
                lastKnownGoodDescriptor: snapshotLastKnownGood,
                sourceFingerprint: descriptorSnapshot?.sourceFingerprint,
              }
              : {}),
          },
        ];
      }),
    );

    const restoredActiveTabId = restoredTabs.some((tab) => tab.id === persisted.activeTabId)
      ? persisted.activeTabId
      : restoredTabs[0]!.id;

    core.setSession(() => core.commitSession({
      tabs: restoredTabs,
      activeTabId: restoredActiveTabId,
      tabDescriptors: restoredTabDescriptors,
    }));
  }, [core, maxTabs]);

  return {
    tabs: core.tabs,
    activeTabId: core.activeTabId,
    activeTab: core.activeTab,
    activeTabDescriptor: core.activeTabDescriptor,
    tabDescriptors: core.tabDescriptors,
    profiles,
    canAddTab,
    maxTabs,
    restorePersistedSession,
    addTab,
    closeTab,
    duplicateTab,
    reorderTabs,
    closeOtherTabs,
    closeTabsToRight,
    selectTab,
    renameTab,
    updateTab: core.updateTab,
    resolveTabConnection,
    connectTarget,
    disconnectTarget,
    toggleTargetConnection,
    prepareExecuteSnapshot,
    executeUnaryCall,
    startStreamCall,
    cancelStreamCall,
    sendStreamMessageCall,
    enqueueStreamMessage,
    removePendingStreamMessage,
    sendAllPendingStreamMessages,
    endStreamCall,
    clearStreamLog,
    cancelUnaryCall,
    cancelInFlightForTab,
    getTabDescriptor: core.getTabDescriptor,
    reflectTab,
    describeFromIngest,
    exportProtoset,
    patchTabProtoIngest,
    selectMethod,
    abortTabInFlightCalls,
    toggleServiceExpanded,
    dismissSchemaDrift,
    pruneSchemaDriftBody,
    rebindSchemaDriftMethod,
    patchTabDescriptor: core.patchTabDescriptor,
    setTabTransportMode,
    retryUnaryWithExpress,
    retryStreamWithExpress,
  };
}

export type UseGrpcStudioReturn = ReturnType<typeof useGrpcStudio>;
