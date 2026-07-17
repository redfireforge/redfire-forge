import { useCallback, useEffect, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  requestGrpcAdvancedOperationCancellation,
} from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import {
  buildGrpcAdvancedFeatureSourceMetadata,
  type GrpcAdvancedFeatureSourceMetadata,
} from '../../../shared/grpc/grpcAdvancedFeatureExport';
import type { GrpcCallType } from '../../../shared/grpc/contracts';
import {
  createInitialGrpcTabAdvancedFeaturesUiState,
  type GrpcTabAdvancedFeaturesUiState,
  type GrpcTabLoadTestRunHistoryEntry,
} from '../grpcStudioAdvancedTypes';
import {
  applyGrpcLoadTestRequestTemplate,
  finalizeGrpcLoadTestRun,
  resetAdvancedOpToIdle,
  resolveLoadTestRunOperationTransition,
  startGrpcStudioLoadTestRun,
  nextLoadTestRunGeneration,
  isGrpcAdvancedOperationInFlight,
  transitionAdvancedOpToCancelled,
  transitionAdvancedOpToFailed,
  transitionAdvancedOpToRunning,
  shouldApplyLoadTestRunResult,
  validateLoadTestPreconditions,
} from '../utils/grpcStudioAdvancedCommands';
import { computeLoadTestProgressPercent } from '../utils/grpcStudioAdvancedModel';
import { resolveGrpcStudioTabTransportMode } from '../grpcStudioTypes';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import type { GrpcLoadTestSchedulerRun } from '../../../shared/grpc/grpcLoadTestSchedulerCore';
import { captureGrpcRpcStatsFromLoadTestSummary } from '../utils/grpcStudioRpcStatsCapture';
import {
  GRPC_LOAD_TEST_HISTORY_LIMIT,
  readPersistedLoadTestHistoryByTab,
  writePersistedLoadTestHistoryByTab,
} from './grpcAdvancedLoadTestHistoryStorage';
import type { StudioSlice } from './useGrpcStudioAdvancedFeaturesTypes';

interface GrpcLoadTestMethodOption {
  key: string;
  service: string;
  method: string;
  callType: GrpcCallType;
  label: string;
}

export interface UseGrpcStudioAdvancedLoadTestActionsOptions {
  studio: StudioSlice;
  activeTabId: string;
  activeLoadTestConfig: GrpcTabAdvancedFeaturesUiState['loadTest']['config'];
  envName?: string;
  liveTabIdsRef: MutableRefObject<Set<string>>;
  getTabState: (tabId: string) => GrpcTabAdvancedFeaturesUiState;
  patchTabState: (
    tabId: string,
    patch: Partial<GrpcTabAdvancedFeaturesUiState> | ((prev: GrpcTabAdvancedFeaturesUiState) => GrpcTabAdvancedFeaturesUiState),
    options?: { allowClosedTab?: boolean },
  ) => void;
  clearLoadTestPoll: (tabId: string) => void;
  loadTestRunsRef: MutableRefObject<Map<string, GrpcLoadTestSchedulerRun>>;
  loadTestPollsRef: MutableRefObject<Map<string, ReturnType<typeof setInterval>>>;
  loadTestGenerationRef: MutableRefObject<Map<string, number>>;
  loadTestExportSourceRef: MutableRefObject<Map<string, GrpcAdvancedFeatureSourceMetadata>>;
}

export function useGrpcStudioAdvancedLoadTestActions(options: UseGrpcStudioAdvancedLoadTestActionsOptions) {
  const {
    studio,
    activeTabId,
    activeLoadTestConfig,
    envName,
    liveTabIdsRef,
    getTabState,
    patchTabState,
    clearLoadTestPoll,
    loadTestRunsRef,
    loadTestPollsRef,
    loadTestGenerationRef,
    loadTestExportSourceRef,
  } = options;

  const loadTestMethodOptions = useMemo<GrpcLoadTestMethodOption[]>(() => {
    const descriptor = studio.activeTabDescriptor.descriptor;
    if (!descriptor) {
      return [];
    }
    return descriptor.services.flatMap((service) => service.methods
      .filter((method) => method.callType === 'unary' || method.callType === 'server_streaming')
      .map((method) => ({
        key: `${service.fullName}/${method.name}`,
        service: service.fullName,
        method: method.name,
        callType: method.callType,
        label: `${service.fullName} / ${method.name}`,
      })));
  }, [studio.activeTabDescriptor.descriptor]);

  const resolvedLoadTestMethod = useMemo(() => {
    const descriptor = studio.activeTabDescriptor.descriptor;
    const overrideService = activeLoadTestConfig.methodOverrideService?.trim();
    const overrideMethod = activeLoadTestConfig.methodOverrideMethod?.trim();
    const usingOverride = Boolean(overrideService && overrideMethod);
    const service = usingOverride ? overrideService : studio.activeTab.service;
    const method = usingOverride ? overrideMethod : studio.activeTab.method;
    const resolvedMethod = descriptor && service && method
      ? findGrpcMethod(descriptor, service, method)
      : undefined;

    return {
      service,
      method,
      usingOverride,
      resolvedMethod,
      callType: resolvedMethod?.callType,
      label: service && method ? `${service} / ${method}` : undefined,
      methodResolved: service != null && method != null ? resolvedMethod != null : undefined,
    };
  }, [
    activeLoadTestConfig.methodOverrideMethod,
    activeLoadTestConfig.methodOverrideService,
    studio.activeTab.method,
    studio.activeTab.service,
    studio.activeTabDescriptor.descriptor,
  ]);

  const loadTestValidationError = useMemo(() => {
    if (!resolvedLoadTestMethod.service || !resolvedLoadTestMethod.method) {
      return 'Select a unary or server-streaming RPC method before starting a load test.';
    }
    const descriptor = studio.activeTabDescriptor.descriptor;
    if (descriptor == null) {
      return 'Load a descriptor before starting a load test.';
    }
    return validateLoadTestPreconditions(resolvedLoadTestMethod.callType, activeLoadTestConfig, {
      methodResolved: resolvedLoadTestMethod.methodResolved,
      transportMode: studio.activeTab.transportMode ?? resolveGrpcStudioTabTransportMode(studio.activeTab),
    });
  }, [
    studio.activeTab,
    studio.activeTabDescriptor.descriptor,
    activeLoadTestConfig,
    resolvedLoadTestMethod,
  ]);

  const activeLoadTestCallType = resolvedLoadTestMethod.callType;

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
    const config = current.loadTest.config;
    let executeSnapshot;
    const methodOverrides = config.methodOverrideService && config.methodOverrideMethod
      ? {
        service: config.methodOverrideService,
        method: config.methodOverrideMethod,
      }
      : undefined;
    try {
      executeSnapshot = studio.prepareExecuteSnapshot(tabId, requestId, methodOverrides);
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

    try {
      executeSnapshot = applyGrpcLoadTestRequestTemplate(executeSnapshot, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request template';
      patchTabState(tabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          loadTest: transitionAdvancedOpToFailed(prev.runtime.loadTest, message),
        },
      }));
      return;
    }

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
        live: {
          counts: run.getState().counts,
          progressPercent: 0,
          metrics: run.getState().liveMetrics,
        },
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
            metrics: schedulerState.liveMetrics,
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
          const nextRunHistory = [
            {
              summary,
              source: exportSource,
            },
            ...(prev.loadTest.runHistory ?? []).filter((entry) => entry.summary.runId !== summary.runId),
          ].slice(0, GRPC_LOAD_TEST_HISTORY_LIMIT);
          return {
            ...prev,
            loadTest: {
              ...prev.loadTest,
              lastSummary: summary,
              lastExportSource: exportSource ?? prev.loadTest.lastExportSource,
              live: undefined,
              runHistory: nextRunHistory,
              selectedRunId: summary.runId,
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
    liveTabIdsRef,
    loadTestRunsRef,
    loadTestPollsRef,
    loadTestGenerationRef,
    loadTestExportSourceRef,
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
  }, [activeTabId, patchTabState, loadTestRunsRef]);

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
      loadTest: { ...prev.loadTest, live: undefined },
      runtime: {
        ...prev.runtime,
        loadTest: resetAdvancedOpToIdle(prev.runtime.loadTest),
      },
    }));
  }, [activeTabId, getTabState, patchTabState, loadTestGenerationRef]);

  return {
    loadTestMethodOptions,
    resolvedLoadTestMethod,
    loadTestValidationError,
    activeLoadTestCallType,
    startLoadTest,
    cancelLoadTest,
    resetLoadTestStatus,
  };
}

export function useGrpcStudioAdvancedLoadTestHistoryEffects(options: {
  studioTabIds: string[];
  studioTabs: StudioSlice['tabs'];
  tabStateById: Record<string, GrpcTabAdvancedFeaturesUiState>;
  setTabStateById: Dispatch<SetStateAction<Record<string, GrpcTabAdvancedFeaturesUiState>>>;
}) {
  const { studioTabIds, studioTabs, tabStateById, setTabStateById } = options;

  useEffect(() => {
    const persistedByTab = readPersistedLoadTestHistoryByTab();
    if (Object.keys(persistedByTab).length === 0) {
      return;
    }
    setTabStateById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const tabId of studioTabIds) {
        const persistedHistory = persistedByTab[tabId];
        if (!Array.isArray(persistedHistory) || persistedHistory.length === 0) {
          continue;
        }
        const current = next[tabId] ?? createInitialGrpcTabAdvancedFeaturesUiState();
        const boundedHistory = persistedHistory.slice(0, GRPC_LOAD_TEST_HISTORY_LIMIT);
        const selectedRunId = current.loadTest.selectedRunId
          ?? boundedHistory[0]?.summary?.runId;
        const selectedEntry = boundedHistory.find((entry) => entry.summary.runId === selectedRunId)
          ?? boundedHistory[0];
        const currentRunHistory = current.loadTest.runHistory ?? [];
        const historyChanged = currentRunHistory.length !== boundedHistory.length
          || currentRunHistory.some((entry, index) => (
            entry.summary.runId !== boundedHistory[index]?.summary.runId
          ));
        const nextSelectedRunId = selectedEntry?.summary.runId;
        const selectedRunChanged = current.loadTest.selectedRunId !== nextSelectedRunId;
        const summaryChanged = current.loadTest.lastSummary?.runId !== selectedEntry?.summary.runId;
        const sourceChanged = current.loadTest.lastExportSource?.capturedAt !== selectedEntry?.source?.capturedAt
          || current.loadTest.lastExportSource?.tabId !== selectedEntry?.source?.tabId;
        if (!historyChanged && !selectedRunChanged && !summaryChanged && !sourceChanged) {
          continue;
        }
        changed = true;
        next[tabId] = {
          ...current,
          loadTest: {
            ...current.loadTest,
            runHistory: boundedHistory,
            selectedRunId: selectedEntry?.summary.runId,
            lastSummary: selectedEntry?.summary,
            lastExportSource: selectedEntry?.source,
          },
        };
      }
      return changed ? next : prev;
    });
  }, [studioTabIds, setTabStateById]);

  useEffect(() => {
    const liveTabIds = new Set(studioTabs.map((tab) => tab.id));
    const persistedByTab: Record<string, GrpcTabLoadTestRunHistoryEntry[]> = {};
    for (const tabId of Object.keys(tabStateById)) {
      if (!liveTabIds.has(tabId)) {
        continue;
      }
      const runHistory = tabStateById[tabId]?.loadTest.runHistory;
      if (Array.isArray(runHistory) && runHistory.length > 0) {
        persistedByTab[tabId] = runHistory.slice(0, GRPC_LOAD_TEST_HISTORY_LIMIT);
      }
    }
    writePersistedLoadTestHistoryByTab(persistedByTab);
  }, [tabStateById, studioTabs]);
}
