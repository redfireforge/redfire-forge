import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInitialGrpcAdvancedFeatureRuntimeState,
  type GrpcLoadTestConfig,
} from '@shared/grpc/grpcAdvancedFeatureContracts';
import type { GrpcAdvancedFeatureSourceMetadata } from '@shared/grpc/grpcAdvancedFeatureExport';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import {
  createInitialGrpcTabAdvancedFeaturesUiState,
  GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON,
  type GrpcAdvancedFeatureTab,
  type GrpcTabAdvancedFeaturesUiState,
} from '../grpcStudioAdvancedTypes';
import { isGrpcAdvancedOperationInFlight } from '../utils/grpcStudioAdvancedCommands';
import type { GrpcLoadTestSchedulerRun } from '@shared/grpc/grpcLoadTestSchedulerCore';
import { stopGrpcMockNetworkListener, supportsGrpcMockNetworkListener } from '../utils/grpcMockListenerClient';
import { useGrpcRpcSessionStats } from './useGrpcRpcSessionStats';
import { useGrpcAdvancedExportCallbacks } from './useGrpcAdvancedExportCallbacks';
import { useGrpcLoadTestProfilesState } from './useGrpcLoadTestProfilesState';
import { useGrpcAdvancedSchemaDiffSession } from './useGrpcAdvancedSchemaDiffSession';
import { useGrpcStudioAdvancedMockActions } from './useGrpcStudioAdvancedMockActions';
import {
  useGrpcStudioAdvancedLoadTestActions,
  useGrpcStudioAdvancedLoadTestHistoryEffects,
} from './useGrpcStudioAdvancedLoadTestActions';
import type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

export type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

export interface UseGrpcStudioAdvancedFeaturesOptions {
  studio: StudioSlice;
  envName?: string;
  pageDefaults: GrpcTabConnectionPageDefaults;
  enabled?: boolean;
}

export function useGrpcStudioAdvancedFeatures(options: UseGrpcStudioAdvancedFeaturesOptions) {
  const { studio, envName, enabled = true } = options;
  const studioTabIds = useMemo(() => studio.tabs.map((tab) => tab.id), [studio.tabs]);
  const [tabStateById, setTabStateById] = useState<Record<string, GrpcTabAdvancedFeaturesUiState>>({});
  const loadTestRunsRef = useRef<Map<string, GrpcLoadTestSchedulerRun>>(new Map());
  const loadTestPollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const loadTestGenerationRef = useRef<Map<string, number>>(new Map());
  const loadTestExportSourceRef = useRef<Map<string, GrpcAdvancedFeatureSourceMetadata>>(new Map());
  const liveTabIdsRef = useRef<Set<string>>(new Set(studio.tabs.map((tab) => tab.id)));
  const [advancedExportError, setAdvancedExportError] = useState<string | undefined>();

  useEffect(() => {
    liveTabIdsRef.current = new Set(studioTabIds);
  }, [studioTabIds]);

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
    clearLoadTestProfileError,
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
    applySchemaDiffComparison,
  } = useGrpcAdvancedSchemaDiffSession(studio, activeTabId, getTabState, patchTabState);

  useGrpcStudioAdvancedLoadTestHistoryEffects({
    studioTabIds,
    studioTabs: studio.tabs,
    tabStateById,
    setTabStateById,
  });

  const {
    mockRegistryRef,
    patchMockRulesJson,
    patchMockLatency,
    patchMockExposeNetwork,
    startMockServer,
    stopMockServer,
    resetMockStatus,
    resolvedMockConfig,
    mockManagerState,
  } = useGrpcStudioAdvancedMockActions({
    studio,
    activeTabId,
    activeMockConfigOverride: activeState.mockServer.mockConfigOverride,
    getTabState,
    patchTabState,
  });

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
  }, [studio.tabs, clearLoadTestPoll, mockRegistryRef]);

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

  const {
    loadTestMethodOptions,
    resolvedLoadTestMethod,
    loadTestValidationError,
    activeLoadTestCallType,
    startLoadTest,
    cancelLoadTest,
    resetLoadTestStatus,
  } = useGrpcStudioAdvancedLoadTestActions({
    studio,
    activeTabId,
    activeLoadTestConfig: activeState.loadTest.config,
    envName,
    liveTabIdsRef,
    getTabState,
    patchTabState,
    clearLoadTestPoll,
    loadTestRunsRef,
    loadTestPollsRef,
    loadTestGenerationRef,
    loadTestExportSourceRef,
  });

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

  const setLoadTestMethodOverride = useCallback((methodKey: string) => {
    if (!methodKey) {
      patchLoadTestConfig({ methodOverrideService: undefined, methodOverrideMethod: undefined });
      return;
    }
    const [service, method] = methodKey.split('/');
    if (!service || !method) {
      return;
    }
    patchLoadTestConfig({
      methodOverrideService: service,
      methodOverrideMethod: method,
    });
  }, [patchLoadTestConfig]);

  const selectLoadTestRunSummary = useCallback((runId: string) => {
    const tabId = activeTabId;
    patchTabState(tabId, (prev) => {
      const runHistory = prev.loadTest.runHistory ?? [];
      const selected = runHistory.find((entry) => entry.summary.runId === runId);
      if (!selected) {
        return prev;
      }
      return {
        ...prev,
        loadTest: {
          ...prev.loadTest,
          selectedRunId: runId,
          lastSummary: selected.summary,
          lastExportSource: selected.source,
        },
      };
    });
  }, [activeTabId, patchTabState]);

  const {
    exportLoadTestJson,
    exportLoadTestCsv,
    exportSchemaDiffJson,
    exportSchemaDiffMarkdown,
    exportMockRulesJson,
    clearAdvancedExportError,
  } = useGrpcAdvancedExportCallbacks(activeState, setAdvancedExportError);

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
    activeRpcLabel: resolvedLoadTestMethod.label,
    activeLoadTestCallType,
    loadTestMethodOptions,
    selectedLoadTestMethodKey: resolvedLoadTestMethod.usingOverride
      ? `${resolvedLoadTestMethod.service}/${resolvedLoadTestMethod.method}`
      : '',
    loadTestProfiles,
    loadTestProfilesLoading,
    loadTestProfileError,
    clearLoadTestProfileError,
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
    setLoadTestMethodOverride,
    patchMockRulesJson,
    patchMockLatency,
    patchMockExposeNetwork,
    setSchemaDiffSeverityFilter,
    setSchemaDiffHideAcknowledged,
    startLoadTest,
    cancelLoadTest,
    resetLoadTestStatus,
    selectLoadTestRunSummary,
    startMockServer,
    stopMockServer,
    resetMockStatus,
    captureSchemaBaseline,
    runSchemaDiff,
    clearSchemaBaseline,
    applySchemaDiffComparison,
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
    activeDescriptor: studio.activeTabDescriptor.descriptor ?? null,
  };
}

export type UseGrpcStudioAdvancedFeaturesReturn = ReturnType<typeof useGrpcStudioAdvancedFeatures>;

export function createFreshAdvancedRuntimeForTests(): GrpcTabAdvancedFeaturesUiState['runtime'] {
  return createInitialGrpcAdvancedFeatureRuntimeState();
}
