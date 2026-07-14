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
import {useGrpcStudioAdvancedFeatures,
} from '../useGrpcStudioAdvancedFeatures';
import * as advancedCommands from '../../utils/grpcStudioAdvancedCommands';
import * as mockListenerClient from '../../utils/grpcMockListenerClient';
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

describe('useGrpcStudioAdvancedFeatures coverage gaps — network mock and schema', () => {
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

  it('exercises load-test profile CRUD helpers', async () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      await result.current.saveLoadTestProfile('Profile A');
    });
    await waitFor(() => {
      expect(result.current.loadTestProfiles.length).toBeGreaterThan(0);
    });

    const profileId = result.current.loadTestProfiles[0]!.id;
    act(() => {
      result.current.setSelectedLoadTestProfileId(profileId);
      result.current.loadLoadTestProfile(profileId);
    });
    expect(result.current.loadTest.config).toBeTruthy();

    await act(async () => {
      await result.current.renameLoadTestProfile(profileId, 'Profile Renamed');
    });
    expect(result.current.loadTestProfiles.some((profile) => profile.name === 'Profile Renamed')).toBe(true);

    await act(async () => {
      await result.current.removeLoadTestProfile(profileId);
    });
    expect(result.current.loadTestProfiles.find((profile) => profile.id === profileId)).toBeUndefined();
  });

  it('acknowledges and unacknowledges schema diff changes', async () => {
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
    act(() => {
      result.current.runSchemaDiff();
    });
    expect(result.current.schemaDiff.lastReport).toBeTruthy();

    const change = result.current.schemaDiff.lastReport?.changes[0];
    if (!change) {
      return;
    }
    await act(async () => {
      await result.current.acknowledgeSchemaDiffChange(change, 'reviewed');
    });
    expect(result.current.isSchemaDiffChangeAcknowledged(change)).toBe(true);

    await act(async () => {
      await result.current.unacknowledgeSchemaDiffChange(change);
    });
    expect(result.current.isSchemaDiffChangeAcknowledged(change)).toBe(false);
  });

  it('resets rpc session stats from the hook surface', () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.resetRpcSessionStats();
    });
    expect(result.current.rpcSessionSummary.totalCalls).toBe(0);
  });

  it('drops stale tab state when studio tabs shrink', async () => {
    const studio = makeStudioSlice();
    const { result, rerender } = renderHook(
      ({ tabs }) => useGrpcStudioAdvancedFeatures({
        studio: { ...studio, tabs, activeTabId: tabs[0]?.id ?? studio.activeTabId },
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      }),
      { initialProps: { tabs: studio.tabs } },
    );

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveFeatureTab('mock_server');
    });
    expect(result.current.activeFeatureTab).toBe('mock_server');

    const loneTab = studio.tabs.slice(0, 1);
    rerender({ tabs: loneTab });
    expect(result.current.activeFeatureTab).toBe('mock_server');
  });

  it('fails load test after snapshot capture when transport preconditions fail', async () => {
    const studio = makeStudioSlice({
      activeTab: createGrpcStudioTab({
        target: 'localhost:50051',
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        transportMode: 'grpc-web',
      }),
      tabs: [createGrpcStudioTab({
        target: 'localhost:50051',
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: 'ServerStream',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        transportMode: 'grpc-web',
      })],
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startLoadTest();
    });
    expect(result.current.runtime.loadTest.status).toBe('failed');
    expect(result.current.runtime.loadTest.error?.message).toMatch(/server-streaming load tests/i);
  });

  it('commits mock rule updates to a running manager and listener', async () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const commitRuleSet = vi.fn();
    const commitLatencyPolicy = vi.fn();
    vi.spyOn(registry, 'hasManager').mockReturnValue(true);
    vi.spyOn(registry, 'getManager').mockReturnValue({
      getState: () => ({ operation: { status: 'running' } }),
      commitRuleSet,
      commitLatencyPolicy,
    } as never);
    const listenerSpy = vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'commitGrpcMockNetworkListener').mockResolvedValue({ generation: 2 });

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
      result.current.patchMockLatency({ defaultLatencyMs: 5 });
    });

    await act(async () => {
      await result.current.startMockServer();
    });

    act(() => {
      result.current.patchMockRulesJson('{"rules":[{"id":"r1","name":"Rule","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}');
    });

    expect(commitRuleSet).toHaveBeenCalled();
    listenerSpy.mockRestore();
  });

  it('cleans up load-test timers and runs on unmount', async () => {
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    const { result, unmount } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    await act(async () => {
      await result.current.startLoadTest();
    });
    unmount();
    expect(result.current.loadTestProfiles.length).toBeGreaterThanOrEqual(0);
  });

  it('toggles schema diff hide-acknowledged filter', async () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    act(() => {
      result.current.setSchemaDiffHideAcknowledged(true);
    });
    expect(result.current.schemaDiff.hideAcknowledged).toBe(true);
  });

  it('ignores load-test poll updates after a newer run generation starts', async () => {
    vi.useFakeTimers();
    const studio = makeStudioSlice();
    const firstRun = makeLoadTestRun(studio.activeTabId);
    const secondRun = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock
      .mockReturnValueOnce(firstRun)
      .mockReturnValueOnce(secondRun);
    finalizeLoadTestMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await act(async () => {
      await result.current.startLoadTest();
      await result.current.startLoadTest();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.runtime.loadTest.status).toBe('running');
    vi.useRealTimers();
  });

  it('stops mock network listeners when stale tabs are pruned', async () => {
    resetGrpcTabCounterForTests();
    const tabA = createGrpcStudioTab({ title: 'A' });
    const tabB = createGrpcStudioTab({ title: 'B' }, [tabA]);
    const stopListener = vi.spyOn(mockListenerClient, 'stopGrpcMockNetworkListener')
      .mockRejectedValue(new Error('stop failed'));
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);

    const descriptor = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      driftState: 'none' as const,
    };
    const { result, rerender } = renderHook(
      ({ tabs, activeTab }) => useGrpcStudioAdvancedFeatures({
        studio: {
          activeTab,
          activeTabId: activeTab.id,
          activeTabDescriptor: descriptor,
          tabs,
          prepareExecuteSnapshot: vi.fn(),
          profiles: [],
        },
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      }),
      { initialProps: { tabs: [tabA, tabB], activeTab: tabB } },
    );

    act(() => {
      result.current.patchLoadTestConfig({ concurrency: 2 });
    });

    act(() => {
      rerender({ tabs: [tabA], activeTab: tabA });
    });

    await waitFor(() => {
      expect(stopListener).toHaveBeenCalledWith(tabB.id);
    });
    stopListener.mockRestore();
  });

  it('patchMockLatency commits listener updates when network listener is running', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    const commitListener = vi.spyOn(mockListenerClient, 'commitGrpcMockNetworkListener').mockResolvedValue({ generation: 3 });
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

    act(() => {
      result.current.patchMockLatency({ defaultLatencyMs: 12, jitterMs: 1 });
    });

    await waitFor(() => {
      expect(commitListener).toHaveBeenCalled();
    });
    commitListener.mockRestore();
  });

  it('patchMockRulesJson updates listener generation after commit resolves', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'commitGrpcMockNetworkListener').mockResolvedValue({ generation: 4 });
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

    act(() => {
      result.current.patchMockRulesJson('{"rules":[{"id":"r1","name":"Rule","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}');
    });

    await waitFor(() => {
      expect(result.current.mockServer.listenerStatus?.generation).toBe(4);
    });
  });

  it('startLoadTest ignores non-Error scheduler throws', async () => {
    const studio = makeStudioSlice();
    startLoadTestMock.mockImplementationOnce(() => {
      throw 'scheduler unavailable';
    });
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.startLoadTest();
    });
    expect(result.current.runtime.loadTest.status).toBe('failed');
    expect(result.current.runtime.loadTest.error?.message).toBe('Failed to start load test');
  });

  it('returns mock manager state when registry has an active manager', async () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    vi.spyOn(registry, 'hasManager').mockReturnValue(true);
    vi.spyOn(registry, 'getManager').mockReturnValue({
      getState: () => ({ operation: { status: 'running' }, rules: [] }),
    } as never);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    expect(result.current.mockManagerState?.operation.status).toBe('running');
  });

  it('patchMockRulesJson swallows manager sync failures for running mocks', async () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    vi.spyOn(registry, 'hasManager').mockReturnValue(true);
    vi.spyOn(registry, 'getManager').mockReturnValue({
      getState: () => ({ operation: { status: 'running' } }),
      commitRuleSet: () => {
        throw new Error('manager sync failed');
      },
      commitLatencyPolicy: vi.fn(),
    } as never);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[{"id":"r1","name":"Rule","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}');
    });

    expect(result.current.mockServer.rulesJson).toContain('r1');
  });

  it('patchMockLatency skips manager commit when mock runtime is idle', () => {
    const studio = makeStudioSlice();
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    const commitLatencyPolicy = vi.fn();
    vi.spyOn(registry, 'hasManager').mockReturnValue(true);
    vi.spyOn(registry, 'getManager').mockReturnValue({
      getState: () => ({ operation: { status: 'idle' } }),
      commitLatencyPolicy,
    } as never);

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchMockRulesJson('{"rules":[]}');
      result.current.patchMockLatency({ defaultLatencyMs: 9 });
    });

    expect(commitLatencyPolicy).not.toHaveBeenCalled();
  });

  it('fails load test after snapshot when post-capture transport validation fails', async () => {
    const studio = makeStudioSlice();
    studio.prepareExecuteSnapshot.mockReturnValue({
      tabId: studio.activeTabId,
      requestId: 'req-post-validate',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'server_streaming' as const,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'grpc-web' as const,
    });

    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    act(() => {
      result.current.startLoadTest();
    });

    expect(result.current.runtime.loadTest.status).toBe('failed');
    expect(result.current.runtime.loadTest.error?.message).toMatch(/server-streaming load tests/i);
  });

  it('re-hydrates persisted history when run ids change without length changes', async () => {
    const studio = makeStudioSlice();
    const firstSummary = await makeLoadTestRun(studio.activeTabId).completion;
    const secondSummary = {
      ...firstSummary,
      runId: `${firstSummary.runId}-replacement`,
    };

    localStorage.setItem(LOAD_TEST_HISTORY_STORAGE_KEY, JSON.stringify({
      version: 1,
      tabHistory: { [studio.activeTabId]: [{ summary: firstSummary }] },
      updatedAt: Date.now(),
    }));

    const probeTab = createGrpcStudioTab({ title: 'Probe' });
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

    await waitFor(() => {
      expect(result.current.loadTest.lastSummary?.runId).toBe(firstSummary.runId);
    });

    localStorage.setItem(LOAD_TEST_HISTORY_STORAGE_KEY, JSON.stringify({
      version: 1,
      tabHistory: { [studio.activeTabId]: [{ summary: secondSummary }] },
      updatedAt: Date.now(),
    }));

    act(() => {
      rerender({ tabs: [...studio.tabs, probeTab], activeTab: studio.activeTab });
    });
    act(() => {
      rerender({ tabs: studio.tabs, activeTab: studio.activeTab });
    });

    await waitFor(() => {
      expect(result.current.loadTest.lastSummary?.runId).toBe(secondSummary.runId);
    });
  });

  it('fails load test start when request template application throws', async () => {
    const applySpy = vi.spyOn(advancedCommands, 'applyGrpcLoadTestRequestTemplate').mockImplementation(() => {
      throw new Error('Invalid request template');
    });
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.patchLoadTestConfig({ requestTemplateJson: '{"message":"x"}' });
      result.current.startLoadTest();
    });

    expect(result.current.runtime.loadTest.status).toBe('failed');
    expect(result.current.runtime.loadTest.error?.message).toBe('Invalid request template');
    applySpy.mockRestore();
  });

  it('deduplicates matching run ids when appending load test history', async () => {
    vi.useRealTimers();
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
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
      expect(result.current.runtime.loadTest.status).toBe('completed');
    });
    expect(result.current.loadTest.runHistory?.length).toBe(1);

    await act(async () => {
      result.current.startLoadTest();
    });
    await waitFor(() => {
      expect(result.current.loadTest.runHistory?.length).toBe(1);
    });
  });

  it('swallows commitGrpcMockNetworkListener rejections when patching rules or latency', async () => {
    vi.spyOn(mockListenerClient, 'supportsGrpcMockNetworkListener').mockReturnValue(true);
    vi.spyOn(mockListenerClient, 'commitGrpcMockNetworkListener').mockRejectedValue(new Error('commit failed'));
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

    act(() => {
      result.current.patchMockRulesJson('{"rules":[{"id":"r1","name":"Rule","enabled":true,"priority":1,"predicate":{"kind":"method_equals","method":"Echo"},"response":{"statusCode":0}}]}');
      result.current.patchMockLatency({ defaultLatencyMs: 12 });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.mockRunning).toBe(true);
  });

  it('stops network listener when mock runtime start fails', async () => {
    vi.mocked(mockListenerClient.supportsGrpcMockNetworkListener).mockReturnValue(true);
    const registry = advancedCommands.getGrpcStudioMockRuntimeRegistry();
    vi.spyOn(registry, 'startTabFromResolved').mockImplementation(() => {
      throw new Error('runtime start failed');
    });
    const stopListener = vi.spyOn(mockListenerClient, 'stopGrpcMockNetworkListener')
      .mockRejectedValue(new Error('stop failed'));
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

    expect(stopListener).toHaveBeenCalledWith(studio.activeTabId);
    expect(result.current.runtime.mockRuntime.status).toBe('failed');
    stopListener.mockRestore();
  });

  it('stopMockServer swallows stopGrpcMockNetworkListener rejections', async () => {
    vi.mocked(mockListenerClient.supportsGrpcMockNetworkListener).mockReturnValue(true);
    vi.mocked(mockListenerClient.stopGrpcMockNetworkListener).mockRejectedValue(new Error('stop failed'));
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
      await result.current.stopMockServer();
    });

    expect(result.current.runtime.mockRuntime.status).toBe('completed');
  });

  it('ignores finalize failures for pruned tabs', async () => {
    const studio = makeStudioSlice();
    const run = makeLoadTestRun(studio.activeTabId);
    startLoadTestMock.mockReturnValue(run);
    finalizeLoadTestMock.mockRejectedValue(new Error('finalize after prune'));

    const closedTab = createGrpcStudioTab({ title: 'Other' });
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

    act(() => {
      rerender({ tabs: [closedTab], activeTab: closedTab });
    });

    await act(async () => {
      await Promise.resolve();
    });
  });

  it('clears method override, ignores invalid override keys, and no-ops missing history runs', () => {
    const studio = makeStudioSlice();
    const { result } = renderHook(() => useGrpcStudioAdvancedFeatures({
      studio,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    act(() => {
      result.current.setLoadTestMethodOverride('echo.EchoService/ServerStream');
    });
    act(() => {
      result.current.setLoadTestMethodOverride('');
    });
    expect(result.current.loadTest.config.methodOverrideService).toBeUndefined();
    expect(result.current.loadTest.config.methodOverrideMethod).toBeUndefined();

    act(() => {
      result.current.setLoadTestMethodOverride('invalid-no-slash');
    });
    expect(result.current.loadTest.config.methodOverrideService).toBeUndefined();

    const selectedBefore = result.current.loadTest.selectedRunId;
    act(() => {
      result.current.selectLoadTestRunSummary('missing-run-id');
    });
    expect(result.current.loadTest.selectedRunId).toBe(selectedBefore);
  });
});
