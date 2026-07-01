import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import {
  createInitialGrpcAdvancedFeatureRuntimeState,
  requestGrpcAdvancedOperationCancellation,
  type GrpcLoadTestConfig,
} from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import {
  buildGrpcAdvancedFeatureSourceMetadata,
  type GrpcAdvancedFeatureSourceMetadata,
  serializeGrpcLoadTestRunSummaryExportSafeCsv,
  serializeGrpcLoadTestRunSummaryExportSafeJson,
  serializeGrpcSchemaDiffReportExportSafeJson,
  serializeGrpcSchemaDiffReportExportSafeMarkdown,
} from '../../../shared/grpc/grpcAdvancedFeatureExport';
import type { GrpcMockConfigSource } from '../../../shared/grpc/grpcMockConfigResolution';
import type { GrpcMockLatencyPolicy } from '../../../shared/grpc/grpcMockLatencySimulation';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import type { UseGrpcStudioReturn } from './useGrpcStudio';
import {
  createInitialGrpcTabAdvancedFeaturesUiState,
  GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON,
  type GrpcAdvancedFeatureTab,
  type GrpcSchemaDiffSeverityFilter,
  type GrpcTabAdvancedFeaturesUiState,
} from '../grpcStudioAdvancedTypes';
import {
  buildMockConfigSourceFromEditor,
  computeGrpcStudioSchemaDiffReport,
  finalizeGrpcLoadTestRun,
  getGrpcStudioMockRuntimeRegistry,
  resetAdvancedOpToIdle,
  resolveGrpcStudioMockConfig,
  shouldApplyLoadTestRunResult,
  startGrpcStudioLoadTestRun,
  nextLoadTestRunGeneration,
  isGrpcAdvancedOperationInFlight,
  transitionAdvancedOpQuickComplete,
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
import type { GrpcLoadTestSchedulerRun } from '../../../shared/grpc/grpcLoadTestSchedulerCore';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';

type StudioSlice = Pick<
  UseGrpcStudioReturn,
  | 'activeTab'
  | 'activeTabDescriptor'
  | 'activeTabId'
  | 'tabs'
  | 'prepareExecuteSnapshot'
  | 'profiles'
>;

export interface UseGrpcStudioAdvancedFeaturesOptions {
  studio: StudioSlice;
  envName?: string;
  pageDefaults: GrpcTabConnectionPageDefaults;
}

function workspaceMockDefault(): GrpcMockConfigSource {
  return { ruleSet: { rules: [] } };
}

export function useGrpcStudioAdvancedFeatures(options: UseGrpcStudioAdvancedFeaturesOptions) {
  const { studio, envName } = options;
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
    const parsed = parseGrpcMockRuleSetJson(rulesJson);
    patchTabState(activeTabId, (prev) => {
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
  }, [activeTabId, patchTabState]);

  const patchMockLatency = useCallback((patch: Partial<GrpcMockLatencyPolicy>) => {
    patchTabState(activeTabId, (prev) => {
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
  }, [activeTabId, patchTabState]);

  const setSchemaDiffSeverityFilter = useCallback((filter: GrpcSchemaDiffSeverityFilter) => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: { ...prev.schemaDiff, severityFilter: filter },
    }));
  }, [activeTabId, patchTabState]);

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
      return 'Select a unary RPC method on the active tab before starting a load test.';
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
    });
  }, [
    studio.activeTab,
    studio.activeTabDescriptor.descriptor,
    activeState.loadTest.config,
  ]);

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
    const sourceMetadata = buildGrpcAdvancedFeatureSourceMetadata(executeSnapshot, {
      connectionId: studio.activeTab.connectionId,
    });
    loadTestExportSourceRef.current.set(tabId, sourceMetadata);
    loadTestRunsRef.current.get(tabId)?.cancel();
    clearLoadTestPoll(tabId);
    const runGeneration = nextLoadTestRunGeneration(loadTestGenerationRef.current.get(tabId));
    loadTestGenerationRef.current.set(tabId, runGeneration);

    const run = startGrpcStudioLoadTestRun({
      tabId,
      executeSnapshot,
      config,
      resolvedEnvName: envName,
    });
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
        patchTabState(tabId, (prev) => {
          const nextLoadTestOp = summary.stopReason === 'cancelled'
            ? transitionAdvancedOpToCancelled(prev.runtime.loadTest)
            : transitionAdvancedOpToCompleted(prev.runtime.loadTest);
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

  const startMockServer = useCallback(() => {
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
      patchTabState(tabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToRunning(prev.runtime.mockRuntime, `mock-${tabId}`),
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start mock runtime';
      patchTabState(tabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          mockRuntime: transitionAdvancedOpToFailed(prev.runtime.mockRuntime, message),
        },
      }));
    }
  }, [activeTabId, getTabState, patchTabState, studio.activeTab.connectionId, studio.profiles]);

  const stopMockServer = useCallback(() => {
    const tabId = activeTabId;
    mockRegistryRef.current.stopTab(tabId);
    patchTabState(tabId, (prev) => ({
      ...prev,
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

  const captureSchemaBaseline = useCallback(() => {
    const descriptor = studio.activeTabDescriptor.descriptor;
    if (descriptor == null) {
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(
            prev.runtime.schemaDiff,
            'Load a descriptor on the active tab before capturing a baseline.',
          ),
        },
      }));
      return;
    }
    const cloned = structuredClone(descriptor) as GrpcDescriptor;
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: {
        ...prev.schemaDiff,
        baselineDescriptor: cloned,
        baselineCapturedAt: new Date().toISOString(),
        lastReport: undefined,
      },
      runtime: {
        ...prev.runtime,
        schemaDiff: transitionAdvancedOpQuickComplete(prev.runtime.schemaDiff),
      },
    }));
  }, [activeTabId, patchTabState, studio.activeTabDescriptor.descriptor]);

  const runSchemaDiff = useCallback(() => {
    const tabState = getTabState(activeTabId);
    const baseline = tabState.schemaDiff.baselineDescriptor;
    const candidate = studio.activeTabDescriptor.descriptor;
    if (baseline == null) {
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(prev.runtime.schemaDiff, 'Capture a baseline before comparing.'),
        },
      }));
      return;
    }
    if (candidate == null) {
      patchTabState(activeTabId, (prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          schemaDiff: transitionAdvancedOpToFailed(prev.runtime.schemaDiff, 'Load a candidate descriptor on the active tab.'),
        },
      }));
      return;
    }
    const report = computeGrpcStudioSchemaDiffReport({ baseline, candidate });
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: { ...prev.schemaDiff, lastReport: report },
      runtime: {
        ...prev.runtime,
        schemaDiff: transitionAdvancedOpQuickComplete(prev.runtime.schemaDiff),
      },
    }));
  }, [activeTabId, getTabState, patchTabState, studio.activeTabDescriptor.descriptor]);

  const clearSchemaBaseline = useCallback(() => {
    patchTabState(activeTabId, (prev) => ({
      ...prev,
      schemaDiff: {
        ...prev.schemaDiff,
        baselineDescriptor: undefined,
        baselineCapturedAt: undefined,
        lastReport: undefined,
      },
      runtime: {
        ...prev.runtime,
        schemaDiff: resetAdvancedOpToIdle(prev.runtime.schemaDiff),
      },
    }));
  }, [activeTabId, patchTabState]);

  const exportLoadTestJson = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const summary = activeState.loadTest.lastSummary;
      const sourceMetadata = activeState.loadTest.lastExportSource;
      if (!summary || !sourceMetadata) {
        return undefined;
      }
      return serializeGrpcLoadTestRunSummaryExportSafeJson(summary, sourceMetadata);
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.loadTest.lastSummary, activeState.loadTest.lastExportSource]);

  const exportLoadTestCsv = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const summary = activeState.loadTest.lastSummary;
      const sourceMetadata = activeState.loadTest.lastExportSource;
      if (!summary || !sourceMetadata) {
        return undefined;
      }
      return serializeGrpcLoadTestRunSummaryExportSafeCsv(summary, sourceMetadata);
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.loadTest.lastSummary, activeState.loadTest.lastExportSource]);

  const exportSchemaDiffJson = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const report = activeState.schemaDiff.lastReport;
      if (!report) {
        return undefined;
      }
      return serializeGrpcSchemaDiffReportExportSafeJson(report, {
        baselineCapturedAt: activeState.schemaDiff.baselineCapturedAt,
      });
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.schemaDiff.lastReport, activeState.schemaDiff.baselineCapturedAt]);

  const exportSchemaDiffMarkdown = useCallback((): string | undefined => {
    try {
      setAdvancedExportError(undefined);
      const report = activeState.schemaDiff.lastReport;
      if (!report) {
        return undefined;
      }
      return serializeGrpcSchemaDiffReportExportSafeMarkdown(report, {
        baselineCapturedAt: activeState.schemaDiff.baselineCapturedAt,
      });
    } catch (error) {
      setAdvancedExportError(error instanceof Error ? error.message : 'Export blocked for safety');
      return undefined;
    }
  }, [activeState.schemaDiff.lastReport, activeState.schemaDiff.baselineCapturedAt]);

  const clearAdvancedExportError = useCallback(() => {
    setAdvancedExportError(undefined);
  }, []);

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
    activeRpcLabel: studio.activeTab.service && studio.activeTab.method
      ? `${studio.activeTab.service} / ${studio.activeTab.method}`
      : undefined,
    setActiveFeatureTab,
    patchLoadTestConfig,
    patchMockRulesJson,
    patchMockLatency,
    setSchemaDiffSeverityFilter,
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
    advancedExportError,
    clearAdvancedExportError,
    resetMockRulesToDefault: () => patchMockRulesJson(GRPC_MOCK_WORKSPACE_DEFAULT_RULES_JSON),
  };
}

export type UseGrpcStudioAdvancedFeaturesReturn = ReturnType<typeof useGrpcStudioAdvancedFeatures>;

export function createFreshAdvancedRuntimeForTests(): GrpcTabAdvancedFeaturesUiState['runtime'] {
  return createInitialGrpcAdvancedFeatureRuntimeState();
}
