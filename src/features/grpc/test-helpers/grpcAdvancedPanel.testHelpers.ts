import { vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
} from '../../../shared/grpc/contractFixtures';
import { buildGrpcLoadTestRunSummaryExport } from '../../../shared/grpc/grpcLoadTestMetrics';
import { captureGrpcLoadTestExecuteSnapshot } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';

export function makeLoadTestSummary() {
  return buildGrpcLoadTestRunSummaryExport({
    snapshot: captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-ui',
      executeSnapshot: {
        tabId: 'tab-ui',
        requestId: 'req-ui',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      config: { concurrency: 2, totalCalls: 4 },
    }),
    report: {
      runId: 'run-ui',
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: '2026-07-01T00:00:02.000Z',
      durationMs: 2000,
      stopReason: 'completed_total_calls',
      counts: {
        scheduled: 4,
        completed: 4,
        succeeded: 3,
        failed: 1,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 2,
      },
      attempts: [],
    },
  });
}

export function buildAdvancedMock(
  patch: Partial<UseGrpcStudioAdvancedFeaturesReturn> = {},
): UseGrpcStudioAdvancedFeaturesReturn {
  const initial = createInitialGrpcTabAdvancedFeaturesUiState();
  return {
    activeFeatureTab: 'load_test',
    runtime: initial.runtime,
    loadTest: initial.loadTest,
    mockServer: initial.mockServer,
    schemaDiff: initial.schemaDiff,
    loadTestValidationError: undefined,
    loadTestRunning: false,
    mockRunning: false,
    resolvedMockConfig: { source: 'workspace_default', ruleSet: { rules: [] }, tabId: 'tab-ui' },
    mockManagerState: undefined,
    activeTabLabel: 'Echo tab',
    activeTabId: 'tab-ui',
    activeRpcLabel: 'echo.EchoService / Echo',
    activeLoadTestCallType: 'unary',
    loadTestMethodOptions: [
      {
        key: 'echo.EchoService/Echo',
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary',
        label: 'echo.EchoService / Echo',
      },
    ],
    selectedLoadTestMethodKey: '',
    loadTestProfiles: [],
    loadTestProfilesLoading: false,
    loadTestProfileError: undefined,
    clearLoadTestProfileError: vi.fn(),
    selectedLoadTestProfileId: '',
    setSelectedLoadTestProfileId: vi.fn(),
    saveLoadTestProfile: vi.fn().mockResolvedValue(undefined),
    loadLoadTestProfile: vi.fn(),
    renameLoadTestProfile: vi.fn().mockResolvedValue(undefined),
    removeLoadTestProfile: vi.fn().mockResolvedValue(undefined),
    schemaDiffAckChangeIds: new Set<string>(),
    acknowledgeSchemaDiffChange: vi.fn().mockResolvedValue(undefined),
    unacknowledgeSchemaDiffChange: vi.fn().mockResolvedValue(undefined),
    isSchemaDiffChangeAcknowledged: vi.fn().mockReturnValue(false),
    setActiveFeatureTab: vi.fn(),
    patchLoadTestConfig: vi.fn(),
    setLoadTestMethodOverride: vi.fn(),
    patchMockRulesJson: vi.fn(),
    patchMockLatency: vi.fn(),
    patchMockExposeNetwork: vi.fn(),
    setSchemaDiffSeverityFilter: vi.fn(),
    setSchemaDiffHideAcknowledged: vi.fn(),
    startLoadTest: vi.fn(),
    cancelLoadTest: vi.fn(),
    resetLoadTestStatus: vi.fn(),
    selectLoadTestRunSummary: vi.fn(),
    startMockServer: vi.fn(),
    stopMockServer: vi.fn(),
    resetMockStatus: vi.fn(),
    captureSchemaBaseline: vi.fn(),
    runSchemaDiff: vi.fn(),
    clearSchemaBaseline: vi.fn(),
    exportLoadTestJson: vi.fn(() => '{"kind":"grpc_load_test_summary"}'),
    exportLoadTestCsv: vi.fn(() => 'metric,value'),
    exportSchemaDiffJson: vi.fn(() => '{"changes":[]}'),
    exportSchemaDiffMarkdown: vi.fn(() => '# diff'),
    exportMockRulesJson: vi.fn(() => '{"rules":[]}'),
    advancedExportError: undefined,
    clearAdvancedExportError: vi.fn(),
    resetMockRulesToDefault: vi.fn(),
    rpcSessionStats: {
      tabId: 'tab-ui',
      windowStartedAt: '2026-07-01T00:00:00.000Z',
      byMethodKey: {},
    },
    rpcSessionSummary: {
      totalCalls: 0,
      totalErrors: 0,
      successRatePercent: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
    },
    resetRpcSessionStats: vi.fn(),
    activeDescriptor: FIXTURE_DESCRIPTOR,
    ...patch,
  } as UseGrpcStudioAdvancedFeaturesReturn;
}

export { FIXTURE_DESCRIPTOR };
