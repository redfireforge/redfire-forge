/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../../shared/grpc/contractFixtures';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  resetGrpcTabCounterForTests,
} from '../../grpcStudioTypes';
import {
  createFreshAdvancedRuntimeForTests,
  useGrpcStudioAdvancedFeatures,
} from '../useGrpcStudioAdvancedFeatures';
import * as advancedCommands from '../../utils/grpcStudioAdvancedCommands';
import * as advancedFeatureExport from '../../../../shared/grpc/grpcAdvancedFeatureExport';
import {
  finalizeLoadTestMock,
  flushReactEffects,
  LOAD_TEST_HISTORY_STORAGE_KEY,
  makeLoadTestRun,
  makeStudioSlice,
  setupAdvancedFeaturesCoverageGapsBeforeEach,
  startLoadTestMock,
} from './useGrpcStudioAdvancedFeaturesCoverageGaps.testHelpers';

vi.mock('../../utils/grpcStudioAdvancedCommands', async (importOriginal) => {
  const actual = await importOriginal<typeof advancedCommands>();
  return {
    ...actual,
    startGrpcStudioLoadTestRun: (...args: unknown[]) => startLoadTestMock(...args),
    finalizeGrpcLoadTestRun: (...args: unknown[]) => finalizeLoadTestMock(...args),
  };
});

vi.mock('../../utils/grpcMockListenerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/grpcMockListenerClient')>();
  return {
    ...actual,
    supportsGrpcMockNetworkListener: vi.fn(() => false),
    startGrpcMockNetworkListener: vi.fn(),
    stopGrpcMockNetworkListener: vi.fn().mockResolvedValue(undefined),
    commitGrpcMockNetworkListener: vi.fn(),
    exportGrpcDescriptorProtoset: vi.fn(),
  };
});

describe('useGrpcStudioAdvancedFeatures coverage gaps — load test core', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    consoleErrorSpy = setupAdvancedFeaturesCoverageGapsBeforeEach();
    startLoadTestMock.mockReset();
    finalizeLoadTestMock.mockReset();
    finalizeLoadTestMock.mockImplementation(() => new Promise(() => {}));
    advancedCommands.resetGrpcStudioMockRuntimeRegistryForTests();
    localStorage.removeItem(LOAD_TEST_HISTORY_STORAGE_KEY);
  });

  afterEach(async () => {
    await flushReactEffects();
    consoleErrorSpy?.mockRestore();
    vi.useRealTimers();
    advancedCommands.resetGrpcStudioMockRuntimeRegistryForTests();
    localStorage.removeItem(LOAD_TEST_HISTORY_STORAGE_KEY);
  });

  it('restores persisted load-test history for the active tab', async () => {
    const studio = makeStudioSlice();
    const persistedSummary = await makeLoadTestRun(studio.activeTabId).completion;
    localStorage.setItem(LOAD_TEST_HISTORY_STORAGE_KEY, JSON.stringify({
      version: 1,
      tabHistory: {
        [studio.activeTabId]: [{ summary: persistedSummary }],
      },
      updatedAt: Date.now(),
    }));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTest.lastSummary?.runId).toBe(persistedSummary.runId);
    });
    expect(result.current.loadTest.runHistory?.length).toBe(1);
    expect(result.current.loadTest.selectedRunId).toBe(persistedSummary.runId);
  });

  it('clears export source when selecting a run-history entry without source metadata', async () => {
    const studio = makeStudioSlice();
    const summaryWithSource = await makeLoadTestRun(studio.activeTabId).completion;
    const summaryWithoutSource = {
      ...summaryWithSource,
      runId: `${summaryWithSource.runId}-no-source`,
    };

    const sourceMetadata = advancedFeatureExport.buildGrpcAdvancedFeatureSourceMetadata({
      tabId: studio.activeTabId,
      requestId: 'req-source',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'express',
    });

    localStorage.setItem(LOAD_TEST_HISTORY_STORAGE_KEY, JSON.stringify({
      version: 1,
      tabHistory: {
        [studio.activeTabId]: [
          { summary: summaryWithSource, source: sourceMetadata },
          { summary: summaryWithoutSource },
        ],
      },
      updatedAt: Date.now(),
    }));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTest.lastExportSource?.service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    });

    act(() => {
      result.current.selectLoadTestRunSummary(summaryWithoutSource.runId);
    });

    expect(result.current.loadTest.selectedRunId).toBe(summaryWithoutSource.runId);
    expect(result.current.loadTest.lastExportSource).toBeUndefined();
    expect(result.current.exportLoadTestJson()).toBeUndefined();
    expect(result.current.exportLoadTestCsv()).toBeUndefined();
  });

  it('exposes tab labels and switches advanced feature tabs', () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      envName: 'local',
    }));

    expect(result.current.activeTabLabel).toBe('Echo tab');
    expect(result.current.activeRpcLabel).toContain('echo.EchoService');

    act(() => {
      result.current.setActiveFeatureTab('schema_diff');
    });
    expect(result.current.activeFeatureTab).toBe('schema_diff');
  });

  it('reports load test validation errors when RPC or descriptor is missing', () => {
    const studio = makeStudioSlice({
      activeTab: createGrpcStudioTab({ service: undefined, method: undefined }),
      tabs: [createGrpcStudioTab({ service: undefined, method: undefined })],
      activeTabDescriptor: createEmptyTabDescriptorState(),
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    expect(result.current.loadTestValidationError).toMatch(/Select a unary or server-streaming RPC/i);
  });

  it('starts, polls, completes, and exports load test summary', async () => {
    vi.useRealTimers();
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => run.completion);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    act(() => {
      result.current.patchLoadTestConfig({ concurrency: 2, totalCalls: 10, rampUpMs: 0, warmupCalls: 0 });
    });

    await act(async () => {
      result.current.startLoadTest();
    });

    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('completed');
      expect(result.current.loadTest.lastSummary?.kind).toBe('grpc_load_test_summary');
    });
    expect(result.current.exportLoadTestJson()).toContain('grpc_load_test_summary');
    expect(result.current.exportLoadTestCsv()).toContain('measuredAttemptsPerSecond');

    act(() => {
      result.current.resetLoadTestStatus();
    });
    expect(result.current.runtime.loadTest.status).toBe('idle');
    expect(result.current.loadTest.lastSummary?.kind).toBe('grpc_load_test_summary');
    expect(result.current.loadTest.lastExportSource?.service).toBe('echo.EchoService');
    expect(result.current.loadTest.runHistory?.length).toBeGreaterThan(0);
  });

  it('applies method override when starting load test', async () => {
    vi.useRealTimers();
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => run.completion);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestMethodOptions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.setLoadTestMethodOverride('echo.EchoService/ServerStream');
    });

    await waitFor(() => {
      expect(result.current.selectedLoadTestMethodKey).toBe('echo.EchoService/ServerStream');
    });

    act(() => {
      result.current.startLoadTest();
    });

    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('completed');
    });
    expect(studio.prepareExecuteSnapshot).toHaveBeenCalledWith(
      studio.activeTabId,
      expect.stringMatching(/^load-req-/),
      expect.objectContaining({ service: 'echo.EchoService', method: 'ServerStream' }),
    );
  });

  it('fails load test start when validation fails or snapshot throws', async () => {
    const studio = makeStudioSlice({
      activeTab: createGrpcStudioTab({ service: undefined, method: undefined }),
      tabs: [createGrpcStudioTab({ service: undefined, method: undefined })],
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.startLoadTest();
    });
    expect(result.current.runtime.loadTest.status).toBe('failed');

    const studioWithThrow = makeStudioSlice();
    studioWithThrow.prepareExecuteSnapshot.mockImplementation(() => {
      throw new Error('snapshot failed');
    });
    const { result: thrown } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio: studioWithThrow,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    act(() => {
      thrown.current.startLoadTest();
    });
    expect(thrown.current.runtime.loadTest.error?.message).toBe('snapshot failed');

    const studioDispatchFail = makeStudioSlice();
    startLoadTestMock.mockImplementationOnce(() => {
      throw new Error('Server-streaming load tests require Express proxy or native transport.');
    });
    const { result: dispatchFail } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio: studioDispatchFail,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    act(() => {
      dispatchFail.current.startLoadTest();
    });
    expect(dispatchFail.current.runtime.loadTest.status).toBe('failed');
    expect(dispatchFail.current.runtime.loadTest.error?.message)
      .toMatch(/Express proxy or native transport/i);
  });

  it('cancels an in-flight load test run', async () => {
    vi.useFakeTimers();
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId, 'cancelled');
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => run.completion);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      result.current.startLoadTest();
      result.current.cancelLoadTest();
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(run.cancel).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('parses mock rules, starts/stops mock runtime, and resets defaults', async () => {
    const studio = makeStudioSlice({ activeTab: createGrpcStudioTab({ connectionId: 'conn-1' }) });
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const startSpy = vi.spyOn(registry, 'startTabFromResolved');
    const stopSpy = vi.spyOn(registry, 'stopTab');

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{');
    });
    expect(result.current.mockServer.parseError).toBeTruthy();

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
      result.current.patchMockLatency({ defaultLatencyMs: 10, jitterMs: 2 });
    });

    act(() => {
      result.current.startMockServer();
    });
    expect(startSpy).toHaveBeenCalled();
    expect(result.current.mockRunning).toBe(true);

    act(() => {
      result.current.stopMockServer();
      result.current.resetMockStatus();
      result.current.resetMockRulesToDefault();
    });
    expect(stopSpy).toHaveBeenCalled();
    expect(result.current.mockServer.rulesJson).toContain('"rules"');

    startSpy.mockRestore();
    stopSpy.mockRestore();
  });

  it('fails mock start for invalid JSON and registry errors', () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const startSpy = vi.spyOn(registry, 'startTabFromResolved').mockImplementation(() => {
      throw new Error('registry boom');
    });

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{');
    });
    act(() => {
      result.current.startMockServer();
    });
    expect(result.current.runtime.mockRuntime.status).toBe('failed');

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
    });
    act(() => {
      result.current.startMockServer();
    });
    expect(result.current.runtime.mockRuntime.error?.message).toBe('registry boom');

    startSpy.mockRestore();
  });

  it('captures schema baseline, compares, filters, exports, and clears', async () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    act(() => {
      result.current.captureSchemaBaseline();
    });
    expect(result.current.schemaDiff.baselineDescriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);

    act(() => {
      result.current.runSchemaDiff();
      result.current.setSchemaDiffSeverityFilter('breaking');
    });
    expect(result.current.schemaDiff.lastReport).toBeTruthy();
    expect(result.current.exportSchemaDiffJson()).toContain(FIXTURE_DESCRIPTOR.key);
    expect(result.current.exportSchemaDiffMarkdown()).toContain('#');

    act(() => {
      result.current.clearSchemaBaseline();
    });
    expect(result.current.schemaDiff.baselineDescriptor).toBeUndefined();
  });

  it('fails schema baseline and diff when descriptor is missing', () => {
    const studio = makeStudioSlice({
      activeTabDescriptor: createEmptyTabDescriptorState(),
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.captureSchemaBaseline();
      result.current.runSchemaDiff();
    });
    expect(result.current.runtime.schemaDiff.status).toBe('failed');
  });

  it('prunes stale tab state when tabs are removed', async () => {
    resetGrpcTabCounterForTests();
    const tabA = createGrpcStudioTab({ title: 'A' });
    const tabB = createGrpcStudioTab({ title: 'B' }, [tabA]);
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const removeSpy = vi.spyOn(registry, 'remove');
    const descriptor = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      driftState: 'none' as const,
    };
    const prepareExecuteSnapshot = vi.fn();
    const studioBase = {
      activeTabDescriptor: descriptor,
      prepareExecuteSnapshot,
      profiles: [] as const,
    };
    const { result, rerender } = renderHook(
      ({ tabs, activeTab }) => useGrpcStudioAdvancedFeatures({
        studio: {
          ...studioBase,
          tabs,
          activeTab,
          activeTabId: activeTab.id,
        },
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      }),
      { initialProps: { tabs: [tabA, tabB], activeTab: tabB } },
    );

    act(() => {
      result.current.patchLoadTestConfig({ concurrency: 4 });
    });

    act(() => {
      rerender({ tabs: [tabA], activeTab: tabA });
    });

    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith(tabB.id);
    });
    removeSpy.mockRestore();
  });

  it('createFreshAdvancedRuntimeForTests returns idle runtime', () => {
    const runtime = createFreshAdvancedRuntimeForTests();
    expect(runtime.loadTest.status).toBe('idle');
    expect(runtime.mockRuntime.status).toBe('idle');
  });

  it('returns undefined export helpers when artifacts are absent', () => {
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio: makeStudioSlice(),
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    expect(result.current.exportLoadTestJson()).toBeUndefined();
    expect(result.current.exportLoadTestCsv()).toBeUndefined();
    expect(result.current.exportSchemaDiffJson()).toBeUndefined();
    expect(result.current.exportSchemaDiffMarkdown()).toBeUndefined();
  });

  it('ignores duplicate load test start while already running', async () => {
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      result.current.startLoadTest();
    });
    act(() => {
      result.current.startLoadTest();
    });
    expect(startLoadTestMock).toHaveBeenCalledTimes(1);
  });

  it('marks load test cancelled when finalize fails after cancellation request', async () => {
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockRejectedValue(new Error('scheduler exploded'));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      result.current.startLoadTest();
      result.current.cancelLoadTest();
    });

    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('cancelled');
    });
  });

  it('fails load test finalize errors without cancellation as failed', async () => {
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockRejectedValue(new Error('scheduler exploded'));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      result.current.startLoadTest();
    });

    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('failed');
      expect(result.current.runtime.loadTest.error?.message).toBe('scheduler exploded');
    });
  });

  it('preserves prior load test export artifacts when a subsequent run fails', async () => {
    vi.useRealTimers();
    const studio = makeStudioSlice();
    const firstRun = makeLoadTestRun(studio.activeTabId);
    const secondRun = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock
      .mockReturnValueOnce(firstRun)
      .mockReturnValueOnce(secondRun);
    finalizeLoadTestMock
      .mockImplementationOnce(() => firstRun.completion)
      .mockRejectedValueOnce(new Error('scheduler exploded'));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    await act(async () => {
      result.current.startLoadTest();
    });
    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('completed');
    });
    expect(result.current.exportLoadTestJson()).toContain('grpc_load_test_summary');

    await act(async () => {
      result.current.startLoadTest();
    });
    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('failed');
    });
    expect(result.current.loadTest.lastSummary?.kind).toBe('grpc_load_test_summary');
    expect(result.current.loadTest.lastExportSource?.service).toBe(FIXTURE_UNARY_CALL_REQUEST.service);
    expect(result.current.exportLoadTestJson()).toContain('grpc_load_test_summary');
  });

  it('ignores duplicate mock start while runtime is already running', () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const startSpy = vi.spyOn(registry, 'startTabFromResolved');
    const stopSpy = vi.spyOn(registry, 'stopTab');
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
    });
    act(() => {
      result.current.startMockServer();
    });
    act(() => {
      result.current.startMockServer();
    });
    expect(startSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.stopMockServer();
    });
    expect(stopSpy).toHaveBeenCalledTimes(1);
    startSpy.mockRestore();
    stopSpy.mockRestore();
  });

  it('omits activeRpcLabel when the active tab has no RPC selected', () => {
    const studio = makeStudioSlice({
      activeTab: createGrpcStudioTab({ service: undefined, method: undefined }),
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    expect(result.current.activeRpcLabel).toBeUndefined();
  });

  it('clears schema baseline and resets schema diff runtime status', () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.captureSchemaBaseline();
      result.current.clearSchemaBaseline();
    });
    expect(result.current.schemaDiff.baselineDescriptor).toBeUndefined();
    expect(result.current.runtime.schemaDiff.status).toBe('idle');
  });

  it('patchMockLatency keeps prior override when rules JSON is invalid', () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{');
      result.current.patchMockLatency({ defaultLatencyMs: 15 });
    });
    expect(result.current.mockServer.parseError).toBeTruthy();
    expect(result.current.mockServer.mockConfigOverride).toBeUndefined();
  });

  it('fails load test start when snapshot throws a non-Error value', () => {
    const studio = makeStudioSlice();
    studio.prepareExecuteSnapshot.mockImplementation(() => {
      throw 'snapshot string failure';
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.startLoadTest();
    });
    expect(result.current.runtime.loadTest.error?.message).toBe('Failed to capture execute snapshot');
  });

});
