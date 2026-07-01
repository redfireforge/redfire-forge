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
} from '../../../shared/grpc/contractFixtures';
import { captureGrpcLoadTestExecuteSnapshot } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { buildGrpcLoadTestRunSummaryExport } from '../../../shared/grpc/grpcLoadTestMetrics';
import type { GrpcLoadTestSchedulerRun } from '../../../shared/grpc/grpcLoadTestSchedulerCore';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  resetGrpcTabCounterForTests,
} from '../grpcStudioTypes';
import {
  createFreshAdvancedRuntimeForTests,
  useGrpcStudioAdvancedFeatures,
} from './useGrpcStudioAdvancedFeatures';
import * as advancedCommands from '../utils/grpcStudioAdvancedCommands';
import * as advancedFeatureExport from '../../../shared/grpc/grpcAdvancedFeatureExport';
import * as mockListenerClient from '../utils/grpcMockListenerClient';

const startLoadTestMock = vi.fn();
const finalizeLoadTestMock = vi.fn();

vi.mock('../utils/grpcStudioAdvancedCommands', async (importOriginal) => {
  const actual = await importOriginal<typeof advancedCommands>();
  return {
    ...actual,
    startGrpcStudioLoadTestRun: (...args: unknown[]) => startLoadTestMock(...args),
    finalizeGrpcLoadTestRun: (...args: unknown[]) => finalizeLoadTestMock(...args),
  };
});

vi.mock('../utils/grpcMockListenerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/grpcMockListenerClient')>();
  return {
    ...actual,
    supportsGrpcMockNetworkListener: vi.fn(() => false),
    startGrpcMockNetworkListener: vi.fn(),
    stopGrpcMockNetworkListener: vi.fn().mockResolvedValue(undefined),
    commitGrpcMockNetworkListener: vi.fn(),
    exportGrpcDescriptorProtoset: vi.fn(),
  };
});

function makeStudioSlice(overrides: Record<string, unknown> = {}) {
  resetGrpcTabCounterForTests();
  const tab = createGrpcStudioTab({
    target: 'localhost:50051',
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    title: 'Echo tab',
    ...overrides,
  });
  const prepareExecuteSnapshot = vi.fn(() => ({
    tabId: tab.id,
    requestId: 'req-1',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: { message: 'hello' },
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    transportMode: 'express' as const,
  }));
  return {
    activeTab: tab,
    activeTabId: tab.id,
    activeTabDescriptor: {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      driftState: 'none' as const,
    },
    tabs: [tab],
    prepareExecuteSnapshot,
    profiles: [{ id: 'conn-1', name: 'Local', target: 'localhost:50051', tlsMode: 'disabled' as const }],
    ...overrides,
  };
}

function makeLoadTestRun(tabId: string, stopReason: 'completed_total_calls' | 'cancelled' = 'completed_total_calls'): GrpcLoadTestSchedulerRun {
  const snapshot = captureGrpcLoadTestExecuteSnapshot({
    runId: `load-${tabId}`,
    executeSnapshot: {
      tabId,
      requestId: 'req-1',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    config: { concurrency: 1, totalCalls: 1 },
  });
  const summary = buildGrpcLoadTestRunSummaryExport({
    snapshot,
    report: {
      runId: snapshot.runId,
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      stopReason,
      counts: {
        scheduled: 1,
        completed: 1,
        succeeded: 1,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      attempts: [],
    },
  });
  return {
    runId: snapshot.runId,
    snapshot,
    cancel: vi.fn(),
    getState: () => ({
      counts: {
        scheduled: 1,
        completed: 1,
        succeeded: 1,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      stopReason: undefined,
      inFlight: 0,
    }),
    completion: Promise.resolve(summary as never),
  };
}

async function flushReactEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useGrpcStudioAdvancedFeatures coverage gaps', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    const originalError = console.error;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const text = args.map((value) => {
        if (typeof value === 'string') return value;
        if (value instanceof Error) return value.message;
        return String(value);
      }).join(' ');
      if (text.includes('not wrapped in act')) {
        return;
      }
      originalError(...(args as Parameters<typeof console.error>));
    });

    startLoadTestMock.mockReset();
    finalizeLoadTestMock.mockReset();
    advancedCommands.resetGrpcStudioMockRuntimeRegistryForTests();
  });

  afterEach(async () => {
    await flushReactEffects();
    consoleErrorSpy?.mockRestore();
    vi.useRealTimers();
    advancedCommands.resetGrpcStudioMockRuntimeRegistryForTests();
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
    expect(result.current.loadTest.lastSummary).toBeUndefined();
    expect(result.current.loadTest.lastExportSource).toBeUndefined();
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

  it('stops polling when the tab is removed from the studio', async () => {
    vi.useFakeTimers();
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => new Promise(() => {}));

    const { result, rerender } = renderHook(
      ({ tabs, activeTab }) => useGrpcStudioAdvancedFeatures({
        studio: {
          ...studio,
          tabs,
          activeTab,
          activeTabId: activeTab.id,
        },
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      }),
      { initialProps: { tabs: studio.tabs, activeTab: studio.activeTab } },
    );

    await act(async () => {
      result.current.startLoadTest();
    });

    const closedTab = createGrpcStudioTab({ title: 'Other' });
    act(() => {
      rerender({ tabs: [closedTab], activeTab: closedTab });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();
  });

  it('ignores stale load test finalize after hook unmount clears generation', async () => {
    let resolveFinalize: (value: unknown) => void = () => {};
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(
      () => new Promise((resolve) => {
        resolveFinalize = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      result.current.startLoadTest();
    });

    unmount();

    await act(async () => {
      resolveFinalize(await run.completion);
    });
  });

  it('ignores resetLoadTestStatus while a load test is still running', async () => {
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
      result.current.resetLoadTestStatus();
    });
    expect(result.current.runtime.loadTest.status).toBe('running');
  });

  it('fails mock start when registry throws a non-Error value', () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const startSpy = vi.spyOn(registry, 'startTabFromResolved').mockImplementation(() => {
      throw 'registry string failure';
    });

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
      result.current.startMockServer();
    });
    expect(result.current.runtime.mockRuntime.error?.message).toBe('Failed to start mock runtime');
    startSpy.mockRestore();
  });

  it('stopMockServer leaves runtime unchanged when mock is not running', () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.stopMockServer();
    });
    expect(result.current.runtime.mockRuntime.status).toBe('idle');
  });

  it('ignores resetMockStatus while mock runtime is running', () => {
    const studio = makeStudioSlice({ activeTab: createGrpcStudioTab({ connectionId: 'conn-1' }) });
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const startSpy = vi.spyOn(registry, 'startTabFromResolved');
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
    expect(startSpy).toHaveBeenCalled();
    expect(result.current.runtime.mockRuntime.status).toBe('running');

    act(() => {
      result.current.resetMockStatus();
    });
    expect(result.current.runtime.mockRuntime.status).toBe('running');
    startSpy.mockRestore();
  });

  it('returns undefined mockManagerState when manager lookup throws', () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const hasSpy = vi.spyOn(registry, 'hasManager').mockReturnValue(true);
    const getSpy = vi.spyOn(registry, 'getManager').mockImplementation(() => {
      throw new Error('manager unavailable');
    });

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
      result.current.startMockServer();
    });
    expect(result.current.mockManagerState).toBeUndefined();

    hasSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('marks load test cancelled when finalize resolves with cancelled stop reason', async () => {
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
    });

    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('cancelled');
    });
  });

  it('fails load test finalize errors with non-Error rejection values', async () => {
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockRejectedValue('scheduler string failure');

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      result.current.startLoadTest();
    });

    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('failed');
      expect(result.current.runtime.loadTest.error?.message).toBe('Load test failed');
    });
  });

  it('resets mock runtime status after mock server has stopped', () => {
    const studio = makeStudioSlice({ activeTab: createGrpcStudioTab({ connectionId: 'conn-1' }) });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
      result.current.startMockServer();
      result.current.stopMockServer();
      result.current.resetMockStatus();
    });
    expect(result.current.runtime.mockRuntime.status).toBe('idle');
  });

  it('updates live load test metrics while the scheduler poll timer runs', async () => {
    vi.useFakeTimers();
    const studio = makeStudioSlice();
    let completed = 0;
    const run = {
      ...makeLoadTestRun(studio.activeTabId),
      getState: vi.fn(() => {
        completed += 1;
        return {
          counts: {
            scheduled: 10,
            completed,
            succeeded: completed,
            failed: 0,
            warmupScheduled: 0,
            warmupCompleted: 0,
            peakInFlight: 1,
          },
          stopReason: undefined,
          inFlight: 0,
        };
      }),
    };
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      result.current.startLoadTest();
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.loadTest.live?.counts.completed).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('fails schema diff when candidate descriptor is missing', () => {
    const studio = makeStudioSlice();
    const loadedDescriptor = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      driftState: 'none' as const,
    };
    const { result, rerender } = renderHook(
      ({ activeTabDescriptor }) => useGrpcStudioAdvancedFeatures({
        studio: { ...studio, activeTabDescriptor },
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      }),
      { initialProps: { activeTabDescriptor: loadedDescriptor } },
    );

    act(() => {
      result.current.captureSchemaBaseline();
    });
    act(() => {
      rerender({ activeTabDescriptor: createEmptyTabDescriptorState() });
    });
    act(() => {
      result.current.runSchemaDiff();
    });
    expect(result.current.runtime.schemaDiff.error?.message).toMatch(/candidate descriptor/i);
  });

  it('returns undefined mockManagerState before mock server is started', () => {
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio: makeStudioSlice(),
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    expect(result.current.mockManagerState).toBeUndefined();
  });

  it('omits activeRpcLabel when service or method is missing', () => {
    const studio = makeStudioSlice({
      activeTab: createGrpcStudioTab({ service: undefined, method: undefined }),
      tabs: [createGrpcStudioTab({ service: undefined, method: undefined })],
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    expect(result.current.activeRpcLabel).toBeUndefined();
  });

  it('records load test json export failures with Error messages', async () => {
    const serializeSpy = vi.spyOn(advancedFeatureExport, 'serializeGrpcLoadTestRunSummaryExportSafeJson')
      .mockImplementation(() => {
        throw new Error('export blocked');
      });
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => run.completion);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      await result.current.startLoadTest();
    });
    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('completed');
    });

    act(() => {
      expect(result.current.exportLoadTestJson()).toBeUndefined();
    });
    expect(result.current.advancedExportError).toBe('export blocked');

    act(() => {
      result.current.clearAdvancedExportError();
    });
    expect(result.current.advancedExportError).toBeUndefined();
    serializeSpy.mockRestore();
  });

  it('records generic export safety message for non-Error load test export failures', async () => {
    const serializeSpy = vi.spyOn(advancedFeatureExport, 'serializeGrpcLoadTestRunSummaryExportSafeCsv')
      .mockImplementation(() => {
        throw 'unsafe export';
      });
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockImplementation(() => run.completion);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      await result.current.startLoadTest();
    });
    await waitFor(() => {
      expect(result.current.runtime.loadTest.status).toBe('completed');
    });

    act(() => {
      expect(result.current.exportLoadTestCsv()).toBeUndefined();
    });
    expect(result.current.advancedExportError).toBe('Export blocked for safety');
    serializeSpy.mockRestore();
  });

  it('starts network mock listener when companion server is supported', async () => {
    vi.mocked(mockListenerClient.supportsGrpcMockNetworkListener).mockReturnValue(true);
    vi.mocked(mockListenerClient.exportGrpcDescriptorProtoset).mockResolvedValue({
      protosetBase64: 'dGVzdA==',
    });
    vi.mocked(mockListenerClient.startGrpcMockNetworkListener).mockResolvedValue({
      running: true,
      generation: 2,
      port: 9400,
    });

    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
    });
    await act(async () => {
      await result.current.startMockServer();
    });
    expect(mockListenerClient.startGrpcMockNetworkListener).toHaveBeenCalled();
    expect(result.current.mockServer.listenerStatus?.running).toBe(true);
    expect(result.current.mockRunning).toBe(true);

    await act(async () => {
      await result.current.stopMockServer();
    });
    expect(mockListenerClient.stopGrpcMockNetworkListener).toHaveBeenCalled();
  });

  it('fails mock start when network listener is required but descriptor is missing', async () => {
    vi.mocked(mockListenerClient.supportsGrpcMockNetworkListener).mockReturnValue(true);
    const studio = makeStudioSlice({
      activeTabDescriptor: createEmptyTabDescriptorState(),
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
    });
    await act(async () => {
      await result.current.startMockServer();
    });
    expect(result.current.runtime.mockRuntime.status).toBe('failed');
    expect(result.current.runtime.mockRuntime.error?.message).toContain('descriptor');
  });

  it('continues mock start when protoset export fails but listener succeeds', async () => {
    vi.mocked(mockListenerClient.supportsGrpcMockNetworkListener).mockReturnValue(true);
    vi.mocked(mockListenerClient.exportGrpcDescriptorProtoset).mockRejectedValue(new Error('export failed'));
    vi.mocked(mockListenerClient.startGrpcMockNetworkListener).mockResolvedValue({
      running: true,
      generation: 1,
      port: 9401,
    });

    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
    });
    await act(async () => {
      await result.current.startMockServer();
    });
    expect(result.current.mockRunning).toBe(true);
  });

  it('patchMockExposeNetwork toggles network exposure flag', () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockExposeNetwork(false);
    });
    expect(result.current.mockServer.exposeNetworkEndpoint).toBe(false);
  });
});
