import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInitialGrpcAdvancedFeatureRuntimeState,
  requestGrpcAdvancedOperationCancellation,
  type GrpcLoadTestConfig,
} from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import {
  buildGrpcAdvancedFeatureSourceMetadata,
  type GrpcAdvancedFeatureSourceMetadata,
} from '../../../shared/grpc/grpcAdvancedFeatureExport';
import type { GrpcMockConfigSource } from '../../../shared/grpc/grpcMockConfigResolution';
import type { GrpcMockLatencyPolicy } from '../../../shared/grpc/grpcMockLatencySimulation';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import {
  createInitialGrpcTabAdvancedFeaturesUiState,
  GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON,
  type GrpcAdvancedFeatureTab,
  type GrpcTabAdvancedFeaturesUiState,
} from '../grpcStudioAdvancedTypes';
import {
  buildMockConfigSourceFromEditor,
  finalizeGrpcLoadTestRun,
  getGrpcStudioMockRuntimeRegistry,
  resetAdvancedOpToIdle,
  resolveGrpcStudioMockConfig,
  shouldApplyLoadTestRunResult,
  resolveLoadTestRunOperationTransition,
  startGrpcStudioLoadTestRun,
  nextLoadTestRunGeneration,
  isGrpcAdvancedOperationInFlight,
  transitionAdvancedOpToCancelled,
  transitionAdvancedOpToCompleted,
  transitionAdvancedOpToFailed,
  transitionAdvancedOpToRunning,
  validateLoadTestPreconditions,
} from '../utils/grpcStudioAdvancedCommands';
import {
  computeLoadTestProgressPercent,
  parseGrpcMockRuleSetJson,
} from '../utils/grpcStudioAdvancedModel';
import { resolveGrpcStudioTabTransportMode } from '../grpcStudioTypes';
import {
  commitGrpcMockNetworkListener,
  exportGrpcDescriptorProtoset,
  startGrpcMockNetworkListener,
  stopGrpcMockNetworkListener,
  supportsGrpcMockNetworkListener,
} from '../utils/grpcMockListenerClient';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import type { GrpcLoadTestSchedulerRun } from '../../../shared/grpc/grpcLoadTestSchedulerCore';
import { captureGrpcRpcStatsFromLoadTestSummary } from '../utils/grpcStudioRpcStatsCapture';
import { useGrpcRpcSessionStats } from './useGrpcRpcSessionStats';
import { useGrpcAdvancedExportCallbacks } from './useGrpcAdvancedExportCallbacks';
import { useGrpcLoadTestProfilesState } from './useGrpcLoadTestProfilesState';
import { useGrpcAdvancedSchemaDiffSession } from './useGrpcAdvancedSchemaDiffSession';
import type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

export type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

export interface UseGrpcStudioAdvancedFeaturesOptions {
  studio: StudioSlice;
  envName?: string;
  pageDefaults: GrpcTabConnectionPageDefaults;
  enabled?: boolean;
}

function workspaceMockDefault(): GrpcMockConfigSource {
  return { ruleSet: { rules: [] } };
}

export function useGrpcStudioAdvancedFeatures(options: UseGrpcStudioAdvancedFeaturesOptions) {
  const { studio, envName, enabled = true } = options;
  const [tabStateById, setTabStateById] = useState<Record<string, GrpcTabAdvancedFeaturesUiState>>({});
  const loadTestRunsRef = useRef<Map<string, GrpcLoadTestSchedulerRun>>(new Map());
  const loadTestPollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const loadTestGenerationRef = useRef<Map<string, number>>(new Map());
  const loadTestExportSourceRef = useRef<Map<string, GrpcAdvancedFeatureSourceMetadata>>(new Map());
  const mockRegistryRef = useRef(getGrpcStudioMockRuntimeRegistry());
  const liveTabIdsRef = useRef<Set<string>>(new Set(studio.tabs.map((tab) => tab.id)));
  const [advancedExportError, setAdvancedExportError] = useState<string | undefined>();

  useEffect(() => {
    liveTabIdsRef.current = new Set(studio.tabs.map((tab) => tab.id));
  }, [studio.tabs]);

  const clearLoadTestPoll = useCallback((tabId: string) => {
    const timer = loadTestPollsRef.current.get(tabId);
    if (timer != null) {
      clearInterval(timer);
      loadTestPollsRef.current.delete(tabId);
    }
  }, []);

  const getTabState = useCallback((tabId: string): GrpcTabAdvancedFeaturesUiState => {
    return tabStateById[tabId] ?? createInitialGrpcTabAdvancedFeaturesUiState();
  }, [tabStateById]);

  const patchTabState = useCallback((
    tabId: string,
    patch: Partial<GrpcTabAdvancedFeaturesUiState> | ((prev: GrpcTabAdvancedFeaturesUiState) => GrpcTabAdvancedFeaturesUiState),
    options?: { allowClosedTab?: boolean },
  ) => {
    if (!options?.allowClosedTab && !liveTabIdsRef.current.has(tabId)) {
      return;
    }
    setTabStateById((prev) => {
      const current = prev[tabId] ?? createInitialGrpcTabAdvancedFeaturesUiState();
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      return { ...prev, [tabId]: next };
    });
  }, []);

  const activeTabId = studio.activeTabId;
  const activeState = getTabState(activeTabId);

  const {
    loadTestProfiles,
    loadTestProfilesLoading,
    loadTestProfileError,
    selectedLoadTestProfileId,
    setSelectedLoadTestProfileId,
    saveLoadTestProfile,
    loadLoadTestProfile,
    renameLoadTestProfile,
    removeLoadTestProfile,
  } = useGrpcLoadTestProfilesState(activeTabId, activeState.loadTest.config, patchTabState, enabled);

  const {
    schemaDiffAckChangeIds,
    setSchemaDiffSeverityFilter,
    setSchemaDiffHideAcknowledged,
    acknowledgeSchemaDiffChange,
    unacknowledgeSchemaDiffChange,
    isSchemaDiffChangeAcknowledged,
    captureSchemaBaseline,
    runSchemaDiff,
    clearSchemaBaseline,
  } = useGrpcAdvancedSchemaDiffSession(studio, activeTabId, getTabState, patchTabState);

  useEffect(() => {
    mockRegistryRef.current.setActiveTab(activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    const liveTabIds = new Set(studio.tabs.map((tab) => tab.id));
    setTabStateById((prev) => {
      const staleIds = Object.keys(prev).filter((tabId) => !liveTabIds.has(tabId));
      if (staleIds.length === 0) {
        return prev;
      }
      const next = { ...prev };
      for (const tabId of staleIds) {
        delete next[tabId];
        mockRegistryRef.current.remove(tabId);
        if (supportsGrpcMockNetworkListener()) {
          void stopGrpcMockNetworkListener(tabId).catch(() => undefined);
        }
        clearLoadTestPoll(tabId);
        loadTestRunsRef.current.get(tabId)?.cancel();
        loadTestRunsRef.current.delete(tabId);
        loadTestGenerationRef.current.delete(tabId);
        loadTestExportSourceRef.current.delete(tabId);
      }
      return next;
    });
  }, [studio.tabs, clearLoadTestPoll]);

  useEffect(() => () => {
    for (const timer of loadTestPollsRef.current.values()) {
      clearInterval(timer);
    }
    loadTestPollsRef.current.clear();
    for (const run of loadTestRunsRef.current.values()) {
      run.cancel();
    }
    loadTestRunsRef.current.clear();
    loadTestGenerationRef.current.clear();
    loadTestExportSourceRef.current.clear();
  }, []);

  const setActiveFeatureTab = useCallback((tab: GrpcAdvancedFeatureTab) => {
    setAdvancedExportError(undefined);
    patchTabState(activeTabId, { activeFeatureTab: tab });
  }, [activeTabId, patchTabState]);

  const patchLoadTestConfig = useCallback((patch: Partial<GrpcLoadTestConfig>) => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      loadTest: {
        ...prev.loadTest,
        config: { ...prev.loadTest.config, ...patch },
      },
    }));
  }, [activeTabId, patchTabState]);

  const patchMockRulesJson = useCallback((rulesJson: string) => {
    const tabId = activeTabId;
    const tabState = getTabState(tabId);
    const parsed = parseGrpcMockRuleSetJson(rulesJson);
    const listenerRunning = tabState.mockServer.listenerStatus?.running === true;
    patchTabState(tabId, (prev) => {
      const mockConfigOverride = parsed.ok
        ? buildMockConfigSourceFromEditor(parsed.ruleSet, prev.mockServer.latencyPolicy)
        : prev.mockServer.mockConfigOverride;
      return {
        ...prev,
        mockServer: {
          ...prev.mockServer,
          rulesJson,
          parseError: parsed.ok ? undefined : parsed.error,
          latencyPolicy: mockConfigOverride?.latencyPolicy,
          mockConfigOverride,
        },
      };
    });
    if (parsed.ok && mockRegistryRef.current.hasManager(tabId)) {
      try {
        const manager = mockRegistryRef.current.getManager(tabId);
        if (manager.getState().operation.status === 'running') {
          manager.commitRuleSet(parsed.ruleSet);
          const policy = buildMockConfigSourceFromEditor(
            parsed.ruleSet,
            tabState.mockServer.latencyPolicy,
          )?.latencyPolicy;
          if (policy != null) {
            manager.commitLatencyPolicy(policy);
          }
        }
      } catch {
        /* manager sync is best-effort when registry is inconsistent */
      }
    }
    if (parsed.ok && listenerRunning && supportsGrpcMockNetworkListener()) {
      void commitGrpcMockNetworkListener({
        tabId,
        ruleSet: parsed.ruleSet,
        latencyPolicy: tabState.mockServer.latencyPolicy,
      }).then((committed) => {
        patchTabState(tabId, (prev) => ({
          ...prev,
          mockServer: {
            ...prev.mockServer,
            listenerStatus: prev.mockServer.listenerStatus
              ? { ...prev.mockServer.listenerStatus, generation: committed.generation }
              : prev.mockServer.listenerStatus,
          },
        }));
      }).catch(() => undefined);
    }
  }, [activeTabId, getTabState, patchTabState]);

  const patchMockLatency = useCallback((patch: Partial<GrpcMockLatencyPolicy>) => {
    const tabId = activeTabId;
    patchTabState(tabId, (prev) => {
      const mergedLatency = { ...prev.mockServer.latencyPolicy, ...patch };
      const parsed = parseGrpcMockRuleSetJson(prev.mockServer.rulesJson);
      const mockConfigOverride = parsed.ok
        ? buildMockConfigSourceFromEditor(parsed.ruleSet, mergedLatency)
        : prev.mockServer.mockConfigOverride;
      return {
        ...prev,
        mockServer: {
          ...prev.mockServer,
          latencyPolicy: mockConfigOverride?.latencyPolicy,
          mockConfigOverride,
        },
      };
    });
    const tabState = getTabState(tabId);
    const parsed = parseGrpcMockRuleSetJson(tabState.mockServer.rulesJson);
    const listenerRunning = tabState.mockServer.listenerStatus?.running === true;
    const mergedLatency = { ...tabState.mockServer.latencyPolicy, ...patch };
    if (parsed.ok && mockRegistryRef.current.hasManager(tabId)) {
      try {
        const manager = mockRegistryRef.current.getManager(tabId);
        if (manager.getState().operation.status === 'running') {
          const policy = buildMockConfigSourceFromEditor(parsed.ruleSet, mergedLatency)?.latencyPolicy;
          if (policy != null) {
            manager.commitLatencyPolicy(policy);
          }
        }
      } catch {
        /* manager sync is best-effort when registry is inconsistent */
      }
    }
    if (parsed.ok && listenerRunning && supportsGrpcMockNetworkListener()) {
      const policy = buildMockConfigSourceFromEditor(parsed.ruleSet, mergedLatency)?.latencyPolicy;
      void commitGrpcMockNetworkListener({
        tabId,
        ruleSet: parsed.ruleSet,
        latencyPolicy: policy,
      }).catch(() => undefined);
    }
  }, [activeTabId, getTabState, patchTabState]);

  const resolvedMockConfig = useMemo(() => {
    const tab = studio.activeTab;
    const profile = studio.profiles.find((entry) => entry.id === tab.connectionId);
    return resolveGrpcStudioMockConfig({
      tabId: tab.id,
      connectionId: tab.connectionId,
      mockConfigOverride: activeState.mockServer.mockConfigOverride,
      profileConnectionId: profile?.id,
      profileMockConfig: undefined,
      workspaceDefault: workspaceMockDefault(),
    });
  }, [studio.activeTab, studio.profiles, activeState.mockServer.mockConfigOverride]);

  const loadTestValidationError = useMemo(() => {
    if (!studio.activeTab.service || !studio.activeTab.method) {
      return 'Select a unary or server-streaming RPC method on the active tab before starting a load test.';
    }
    const descriptor = studio.activeTabDescriptor.descriptor;
    if (descriptor == null) {
      return 'Load a descriptor before starting a load test.';
    }
    const method = findGrpcMethod(
      descriptor,
      studio.activeTab.service,
      studio.activeTab.method,
    );
    return validateLoadTestPreconditions(method?.callType, activeState.loadTest.config, {
      methodResolved: method != null,
      transportMode: studio.activeTab.transportMode ?? resolveGrpcStudioTabTransportMode(studio.activeTab),
    });
  }, [
    studio.activeTab,
    studio.activeTabDescriptor.descriptor,
    activeState.loadTest.config,
  ]);

  const activeLoadTestCallType = useMemo(() => {
    const descriptor = studio.activeTabDescriptor.descriptor;
    if (!descriptor || !studio.activeTab.service || !studio.activeTab.method) {
      return undefined;
    }
    return findGrpcMethod(descriptor, studio.activeTab.service, studio.activeTab.method)?.callType;
  }, [studio.activeTab, studio.activeTabDescriptor.descriptor]);

  const startLoadTest = useCallback(() => {
    const tabId = activeTabId;
    const current = getTabState(tabId);
    if (isGrpcAdvancedOperationInFlight(current.runtime.loadTest.status)) {
      return;
    }
    if (loadTestValidationError) {
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          loadTest: transitionAdvancedOpToFailed(prev.runtime.loadTest, loadTestValidationError),
        },
      }));
      return;
    }
    const requestId = `load-req-${Date.now()}`;
    let executeSnapshot;
    try {
      executeSnapshot = studio.prepareExecuteSnapshot(tabId, requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to capture execute snapshot';
      patchTabState(tabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          loadTest: transitionAdvancedOpToFailed(prev.runtime.loadTest, message),
        },
      }));
      return;
    }

    const config = current.loadTest.config;
    const postSnapshotValidationError = validateLoadTestPreconditions(
      executeSnapshot.callType,
      config,
      {
        transportMode: executeSnapshot.transportMode
          ?? resolveGrpcStudioTabTransportMode(studio.activeTab),
      },
    );
    if (postSnapshotValidationError) {
      patchTabState(tabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          loadTest: transitionAdvancedOpToFailed(prev.runtime.loadTest, postSnapshotValidationError),
        },
      }));
      return;
    }

    const sourceMetadata = buildGrpcAdvancedFeatureSourceMetadata(executeSnapshot, {
      connectionId: studio.activeTab.connectionId,
    });
    loadTestExportSourceRef.current.set(tabId, sourceMetadata);
    loadTestRunsRef.current.get(tabId)?.cancel();
    clearLoadTestPoll(tabId);
    const runGeneration = nextLoadTestRunGeneration(loadTestGenerationRef.current.get(tabId));
    loadTestGenerationRef.current.set(tabId, runGeneration);

    let run;
    try {
      run = startGrpcStudioLoadTestRun({
        tabId,
        executeSnapshot,
        config,
        resolvedEnvName: envName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start load test';
      patchTabState(tabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          loadTest: transitionAdvancedOpToFailed(prev.runtime.loadTest, message),
        },
      }));
      return;
    }
    loadTestRunsRef.current.set(tabId, run);
    const operationId = run.runId;
    const startedAtMs = Date.now();

    patchTabState(tabId, (prev) => ({
      ...prev,
      loadTest: {
        ...prev.loadTest,
        live: { counts: run.getState().counts, progressPercent: 0 },
      },
      runtime: {
        ...prev.runtime,
        loadTest: transitionAdvancedOpToRunning(prev.runtime.loadTest, operationId),
      },
    }));

    clearLoadTestPoll(tabId);
    const pollTimer = setInterval(() => {
      if (!liveTabIdsRef.current.has(tabId)) {
        clearLoadTestPoll(tabId);
        return;
      }
      if (!shouldApplyLoadTestRunResult(loadTestGenerationRef.current.get(tabId), runGeneration)) {
        clearLoadTestPoll(tabId);
        return;
      }
      const schedulerState = run.getState();
      const elapsedMs = Date.now() - startedAtMs;
      patchTabState(tabId, (prev) => ({
        ...prev,
        loadTest: {
          ...prev.loadTest,
          live: {
            counts: { ...schedulerState.counts },
            progressPercent: computeLoadTestProgressPercent(
              config,
              schedulerState.counts,
              elapsedMs,
            ),
          },
        },
      }));
    }, 250);
    loadTestPollsRef.current.set(tabId, pollTimer);

    void (async () => {
      try {
        const summary = await finalizeGrpcLoadTestRun(run);
        if (!liveTabIdsRef.current.has(tabId)) {
          return;
        }
        if (!shouldApplyLoadTestRunResult(loadTestGenerationRef.current.get(tabId), runGeneration)) {
          return;
        }
        clearLoadTestPoll(tabId);
        loadTestRunsRef.current.delete(tabId);
        const exportSource = loadTestExportSourceRef.current.get(tabId);
        loadTestExportSourceRef.current.delete(tabId);
        captureGrpcRpcStatsFromLoadTestSummary(tabId, summary, {
          service: executeSnapshot.service,
          method: executeSnapshot.method,
          callType: executeSnapshot.callType,
        });
        patchTabState(tabId, (prev) => {
          const nextLoadTestOp = resolveLoadTestRunOperationTransition(
            prev.runtime.loadTest,
            summary,
          );
          return {
            ...prev,
            loadTest: {
              config: prev.loadTest.config,
              lastSummary: summary,
              lastExportSource: exportSource ?? prev.loadTest.lastExportSource,
              live: undefined,
            },
            runtime: {
              ...prev.runtime,
              loadTest: nextLoadTestOp,
            },
          };
        });
      } catch (error) {
        if (!liveTabIdsRef.current.has(tabId)) {
          return;
        }
        if (!shouldApplyLoadTestRunResult(loadTestGenerationRef.current.get(tabId), runGeneration)) {
          return;
        }
        clearLoadTestPoll(tabId);
        loadTestRunsRef.current.delete(tabId);
        loadTestExportSourceRef.current.delete(tabId);
        const message = error instanceof Error ? error.message : 'Load test failed';
        patchTabState(tabId, (prev) => {
          const nextOp = prev.runtime.loadTest.cancellationRequested
            ? transitionAdvancedOpToCancelled(prev.runtime.loadTest)
            : transitionAdvancedOpToFailed(prev.runtime.loadTest, message);
          return {
            ...prev,
            loadTest: {
              ...prev.loadTest,
              live: undefined,
            },
            runtime: {
              ...prev.runtime,
              loadTest: nextOp,
            },
          };
        });
      }
    })();
  }, [
    activeTabId,
    envName,
    getTabState,
    clearLoadTestPoll,
    loadTestValidationError,
    patchTabState,
    studio,
  ]);

  const cancelLoadTest = useCallback(() => {
    const tabId = activeTabId;
    patchTabState(tabId, (prev) => ({
      ...prev,
      runtime: {
        ...prev.runtime,
        loadTest: requestGrpcAdvancedOperationCancellation(prev.runtime.loadTest),
      },
    }));
    loadTestRunsRef.current.get(tabId)?.cancel();
  }, [activeTabId, patchTabState]);

  const resetLoadTestStatus = useCallback(() => {
    const tabId = activeTabId;
    const current = getTabState(tabId);
    if (isGrpcAdvancedOperationInFlight(current.runtime.loadTest.status)) {
      return;
    }
    loadTestGenerationRef.current.set(
      tabId,
      nextLoadTestRunGeneration(loadTestGenerationRef.current.get(tabId)),
    );
    patchTabState(tabId, (prev) => ({
      ...prev,
      loadTest: { ...prev.loadTest, live: undefined, lastSummary: undefined, lastExportSource: undefined },
      runtime: {
        ...prev.runtime,
        loadTest: resetAdvancedOpToIdle(prev.runtime.loadTest),
      },
    }));
  }, [activeTabId, getTabState, patchTabState]);

  const patchMockExposeNetwork = useCallback((exposeNetworkEndpoint: boolean) => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      mockServer: { ...prev.mockServer, exposeNetworkEndpoint },
    }));
  }, [activeTabId, patchTabState]);

  const startMockServer = useCallback(async () => {
    const tabId = activeTabId;
    const tabState = getTabState(tabId);
    if (tabState.runtime.mockRuntime.status === 'running') {
      return;
    }
    const parsed = parseGrpcMockRuleSetJson(tabState.mockServer.rulesJson);
    if (!parsed.ok) {
      patchTabState(tabId, (prev) => ({
        ...prev,
        mockServer: { ...prev.mockServer, parseError: parsed.error },
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToFailed(prev.runtime.mockRuntime, parsed.error),
        },
      }));
      return;
    }
    const config = resolveGrpcStudioMockConfig({
      tabId,
      connectionId: studio.activeTab.connectionId,
      mockConfigOverride: buildMockConfigSourceFromEditor(parsed.ruleSet, tabState.mockServer.latencyPolicy),
      profileConnectionId: studio.profiles.find((entry) => entry.id === studio.activeTab.connectionId)?.id,
      profileMockConfig: undefined,
      workspaceDefault: workspaceMockDefault(),
    });
    try {
      mockRegistryRef.current.startTabFromResolved(tabId, config);
      let listenerStatus = tabState.mockServer.listenerStatus;
      const shouldExposeNetwork = tabState.mockServer.exposeNetworkEndpoint !== false
        && supportsGrpcMockNetworkListener();
      if (shouldExposeNetwork) {
        const descriptor = studio.activeTabDescriptor.descriptor;
        if (descriptor == null) {
          throw new Error('Load a descriptor on the active tab before starting the network mock listener.');
        }
        let protosetBase64: string | undefined;
        try {
          const exported = await exportGrpcDescriptorProtoset(descriptor.key);
          protosetBase64 = exported.protosetBase64;
        } catch {
          protosetBase64 = undefined;
        }
        listenerStatus = await startGrpcMockNetworkListener({
          tabId,
          connectionId: config.connectionId,
          descriptorKey: descriptor.key,
          protosetBase64,
          contentSha256: descriptor.contentSha256,
          ruleSet: parsed.ruleSet,
          latencyPolicy: tabState.mockServer.latencyPolicy,
        });
      }
      patchTabState(tabId, (prev) => ({
        ...prev,
        mockServer: {
          ...prev.mockServer,
          parseError: undefined,
          listenerStatus: listenerStatus ?? prev.mockServer.listenerStatus,
        },
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToRunning(prev.runtime.mockRuntime, `mock-${tabId}`),
        },
      }));
    } catch (error) {
      mockRegistryRef.current.stopTab(tabId);
      if (supportsGrpcMockNetworkListener()) {
        await stopGrpcMockNetworkListener(tabId).catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : 'Failed to start mock runtime';
      patchTabState(tabId, (prev) => ({
        ...prev,
        mockServer: { ...prev.mockServer, listenerStatus: undefined },
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToFailed(prev.runtime.mockRuntime, message),
        },
      }));
    }
  }, [activeTabId, getTabState, patchTabState, studio.activeTab.connectionId, studio.activeTabDescriptor.descriptor, studio.profiles]);

  const stopMockServer = useCallback(async () => {
    const tabId = activeTabId;
    if (supportsGrpcMockNetworkListener()) {
      await stopGrpcMockNetworkListener(tabId).catch(() => undefined);
    }
    mockRegistryRef.current.stopTab(tabId);
    patchTabState(tabId, (prev) => ({
      ...prev,
      mockServer: { ...prev.mockServer, listenerStatus: undefined },
      runtime: {
        ...prev.runtime,
        mockRuntime: prev.runtime.mockRuntime.status === 'running'
          ? transitionAdvancedOpToCompleted(prev.runtime.mockRuntime)
          : prev.runtime.mockRuntime,
      },
    }));
  }, [activeTabId, patchTabState]);

  const resetMockStatus = useCallback(() => {
    const tabId = activeTabId;
    const current = getTabState(tabId);
    if (current.runtime.mockRuntime.status === 'running') {
      return;
    }
    patchTabState(tabId, (prev) => ({
      ...prev,
      runtime: {
        ...prev.runtime,
        mockRuntime: resetAdvancedOpToIdle(prev.runtime.mockRuntime),
      },
    }));
  }, [activeTabId, getTabState, patchTabState]);

  const {
    exportLoadTestJson,
    exportLoadTestCsv,
    exportSchemaDiffJson,
    exportSchemaDiffMarkdown,
    exportMockRulesJson,
    clearAdvancedExportError,
  } = useGrpcAdvancedExportCallbacks(activeState, setAdvancedExportError);

  const mockManagerState = useMemo(() => {
    if (!mockRegistryRef.current.hasManager(activeTabId)) {
      return undefined;
    }
    try {
      return mockRegistryRef.current.getManager(activeTabId).getState();
    } catch {
      return undefined;
    }
  }, [activeTabId]);

  const loadTestRunning = isGrpcAdvancedOperationInFlight(activeState.runtime.loadTest.status);

  const mockRunning = activeState.runtime.mockRuntime.status === 'running';

  const liveTabIds = useMemo(
    () => new Set(studio.tabs.map((tab) => tab.id)),
    [studio.tabs],
  );
  const {
    rpcSessionStats,
    rpcSessionSummary,
    resetRpcSessionStats,
  } = useGrpcRpcSessionStats(activeTabId, liveTabIds);

  return {
    activeFeatureTab: activeState.activeFeatureTab,
    runtime: activeState.runtime,
    loadTest: activeState.loadTest,
    mockServer: activeState.mockServer,
    schemaDiff: activeState.schemaDiff,
    loadTestValidationError,
    loadTestRunning,
    mockRunning,
    resolvedMockConfig,
    mockManagerState,
    activeTabLabel: studio.activeTab.title,
    activeTabId: studio.activeTabId,
    activeRpcLabel: studio.activeTab.service && studio.activeTab.method
      ? `${studio.activeTab.service} / ${studio.activeTab.method}`
      : undefined,
    activeLoadTestCallType,
    loadTestProfiles,
    loadTestProfilesLoading,
    loadTestProfileError,
    selectedLoadTestProfileId,
    setSelectedLoadTestProfileId,
    saveLoadTestProfile,
    loadLoadTestProfile,
    renameLoadTestProfile,
    removeLoadTestProfile,
    schemaDiffAckChangeIds,
    acknowledgeSchemaDiffChange,
    unacknowledgeSchemaDiffChange,
    isSchemaDiffChangeAcknowledged,
    setActiveFeatureTab,
    patchLoadTestConfig,
    patchMockRulesJson,
    patchMockLatency,
    patchMockExposeNetwork,
    setSchemaDiffSeverityFilter,
    setSchemaDiffHideAcknowledged,
    startLoadTest,
    cancelLoadTest,
    resetLoadTestStatus,
    startMockServer,
    stopMockServer,
    resetMockStatus,
    captureSchemaBaseline,
    runSchemaDiff,
    clearSchemaBaseline,
    exportLoadTestJson,
    exportLoadTestCsv,
    exportSchemaDiffJson,
    exportSchemaDiffMarkdown,
    exportMockRulesJson,
    advancedExportError,
    clearAdvancedExportError,
    resetMockRulesToDefault: () => patchMockRulesJson(GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON),
    rpcSessionStats,
    rpcSessionSummary,
    resetRpcSessionStats,
  };
}

export type UseGrpcStudioAdvancedFeaturesReturn = ReturnType<typeof useGrpcStudioAdvancedFeatures>;

export function createFreshAdvancedRuntimeForTests(): GrpcTabAdvancedFeaturesUiState['runtime'] {
  return createInitialGrpcAdvancedFeatureRuntimeState();
}
