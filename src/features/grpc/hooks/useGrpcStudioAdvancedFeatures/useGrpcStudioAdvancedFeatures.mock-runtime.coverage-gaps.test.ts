/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  FIXTURE_DESCRIPTOR,
} from '@shared/grpc/contractFixtures';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
} from '../../grpcStudioTypes';
import {useGrpcStudioAdvancedFeatures,
} from '../useGrpcStudioAdvancedFeatures';
import * as advancedCommands from '../../utils/grpcStudioAdvancedCommands';
import * as advancedFeatureExport from '@shared/grpc/grpcAdvancedFeatureExport';
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

describe('useGrpcStudioAdvancedFeatures coverage gaps — load test polling and mock', () => {
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
});
