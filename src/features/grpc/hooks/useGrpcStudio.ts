import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { isGrpcExpressFallbackOffered } from '../../../shared/grpc/grpcTransportFallback';
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
  createDismissSchemaDriftHandler,
  createDuplicateTabHandler,
  createPruneSchemaDriftBodyHandler,
  createRebindSchemaDriftMethodHandler,
  createRenameTabHandler,
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

export interface UseGrpcStudioOptions {
  envVarMap?: Record<string, string>;
  workspaceDefaults?: Record<string, string>;
  pageDefaults: GrpcTabConnectionPageDefaults;
  profiles?: GrpcConnectionProfile[];
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
    pageDefaults,
    maxTabs,
  ]);

  const addTab = useMemo(() => createAddTabHandler(runtimeCtx, core), [runtimeCtx, core]);
  const selectTab = useMemo(() => createSelectTabHandler(core), [core]);
  const renameTab = useMemo(() => createRenameTabHandler(runtimeCtx), [runtimeCtx]);
  const closeTab = useMemo(() => createCloseTabHandler(runtimeCtx, core), [runtimeCtx, core]);
  const duplicateTab = useMemo(() => createDuplicateTabHandler(runtimeCtx, core), [runtimeCtx, core]);
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
    const tab = core.session.tabs.find((entry) => entry.id === core.activeTabId);
    if (tab && tabAwaitingStreamEvents(tab)) {
      attachStreamEventsForTab(core.activeTabId);
    }
  }, [core.activeTabId, attachStreamEventsForTab, core.session.tabs]);

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
    void executeUnaryCall(tabId);
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
    void startStreamCall(tabId);
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
      acc.push(createGrpcStudioTab(persistedTab, acc));
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
