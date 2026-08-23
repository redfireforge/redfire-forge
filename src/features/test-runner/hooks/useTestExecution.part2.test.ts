/**
 * @vitest-environment jsdom
 */
import {
  createMockScenario,
  createMockConfig,
  createMockResult,
  registerUseTestExecutionTestLifecycle,
  mockRunTest,
  mockSaveTestRun,
} from './__test-utils__/useTestExecutionTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestExecution } from './useTestExecution';
import type { RequestResult } from '@shared/types';

vi.mock('@engine/core/executor', async () => {
  const { mockRunTest } = await import('./__test-utils__/useTestExecutionTestSetup');
  return { runTest: mockRunTest };
});
vi.mock('@engine/core/workerBridge', async () => {
  const { mockRunTestInWorker } = await import('./__test-utils__/useTestExecutionTestSetup');
  return { runTestMultiWorker: mockRunTestInWorker };
});
vi.mock('@engine/core/metrics', async () => {
  const { mockComputeMetrics } = await import('./__test-utils__/useTestExecutionTestSetup');
  return { computeMetrics: mockComputeMetrics };
});
vi.mock('@shared/utils/storage', async () => {
  const { mockSaveTestRun, mockForceSaveTestRun } = await import(
    './__test-utils__/useTestExecutionTestSetup'
  );
  return { saveTestRun: mockSaveTestRun, forceSaveTestRun: mockForceSaveTestRun };
});
vi.mock('@shared/utils/platform', async () => {
  const { mockSupportsWorkers } = await import('./__test-utils__/useTestExecutionTestSetup');
  return { supportsWorkers: mockSupportsWorkers, isTauri: vi.fn(() => false) };
});
vi.mock('../utils/rustBridge', async () => {
  const { mockIsRustAvailable, mockCanUseRust, mockRunTestViaRust } = await import(
    './__test-utils__/useTestExecutionTestSetup'
  );
  return {
    isRustExecutorAvailable: mockIsRustAvailable,
    canUseRustExecutor: mockCanUseRust,
    runTestViaRust: mockRunTestViaRust,
  };
});
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

describe('useTestExecution', () => {
  registerUseTestExecutionTestLifecycle();

  describe('incremental summary computation', () => {
    it('flush shows zeroed summary when no results tracked yet', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 2000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await act(async () => {
        progressCallback?.(0, 10, []);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.liveSummary?.totalRequests).toBe(0);
      expect(result.current.liveSummary?.tps).toBe(0);
    });

    it('uses step sampling when many passed results exceed live cap budget', async () => {
      const failed = Array.from({ length: 50 }, (_, i) =>
        createMockResult({ id: `f-${i}`, passed: false, httpStatus: 500 }),
      );
      const passed = Array.from({ length: 600 }, (_, i) =>
        createMockResult({ id: `p-${i}`, passed: true }),
      );
      mockRunTest.mockResolvedValue({ results: [...failed, ...passed] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.liveResults.length).toBeLessThanOrEqual(500);
      expect(result.current.liveResults.filter((r) => !r.passed).length).toBe(50);
    });
    it('computes live summary during execution', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 2000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const mockResults = [
        createMockResult({ responseTimeMs: 100 }),
        createMockResult({ responseTimeMs: 200 }),
      ];

      await act(async () => {
        progressCallback?.(2, 10, mockResults);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.liveSummary).not.toBeNull();
      expect(result.current.liveSummary?.totalRequests).toBe(2);
    });

    it('tracks errors in incremental summary', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 2000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const mockResults = [
        createMockResult({ httpStatus: 200 }),
        createMockResult({ httpStatus: 500 }),
        createMockResult({ httpStatus: 0 }),
      ];

      await act(async () => {
        progressCallback?.(3, 10, mockResults);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.liveSummary?.failedRequests).toBe(2);
      expect(result.current.liveSummary?.errorsByStatus[500]).toBe(1);
      expect(result.current.liveSummary?.errorsByStatus[0]).toBe(1);
    });

    it('does not count failed Kafka results as HTTP errors in incremental summary', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 2000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const mockResults = [
        createMockResult({ httpStatus: 200 }),                                          // HTTP success
        createMockResult({ httpStatus: 500 }),                                          // HTTP error — counts
        createMockResult({ httpStatus: 0, transportType: 'kafkaProduce' as const }), // Kafka fail — must NOT count
      ];

      await act(async () => {
        progressCallback?.(3, 10, mockResults);
        await vi.advanceTimersByTimeAsync(600);
      });

      // Only the HTTP 500 result should count as a failed request
      expect(result.current.liveSummary?.failedRequests).toBe(1);
      expect(result.current.liveSummary?.errorsByStatus[500]).toBe(1);
      expect(result.current.liveSummary?.errorsByStatus[0]).toBeUndefined();
    });

    it('tracks validation failures', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 2000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const mockResults = [
        createMockResult({ passed: false, failureDetails: [{ path: '$.id', expected: '1', actual: '2' }] }),
      ];

      await act(async () => {
        progressCallback?.(1, 10, mockResults);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.liveSummary?.failedValidations).toBe(1);
    });

    it('does not count validation failures without failureDetails', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 2000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await act(async () => {
        progressCallback?.(
          1,
          10,
          [createMockResult({ passed: false, failureDetails: [] })],
        );
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.liveSummary?.failedValidations).toBe(0);
    });
  });

  describe('startExternalExecution', () => {
    it('returns reportProgress, complete, fail, and abortSignal', () => {
      const { result } = renderHook(() => useTestExecution());

      let externalCallbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        externalCallbacks = result.current.startExternalExecution(10);
      });

      expect(typeof externalCallbacks!.reportProgress).toBe('function');
      expect(typeof externalCallbacks!.complete).toBe('function');
      expect(typeof externalCallbacks!.fail).toBe('function');
      expect(externalCallbacks!.abortSignal).toBeInstanceOf(AbortSignal);
    });

    it('sets isRunning to true', () => {
      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.startExternalExecution(10);
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.total).toBe(10);
    });

    it('reportProgress updates state', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10);
      });

      const mockResults = [createMockResult()];
      await act(async () => {
        callbacks!.reportProgress(mockResults, 1);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.completed).toBe(1);
      expect(result.current.liveResults.length).toBeGreaterThanOrEqual(1);
    });

    it('reportProgress deduplicates updates by request id', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10);
      });

      const one = createMockResult({ id: 'same-id', responseTimeMs: 90 });
      const two = createMockResult({ id: 'same-id', responseTimeMs: 200 });

      await act(async () => {
        callbacks!.reportProgress([one], 1);
        callbacks!.reportProgress([two], 1);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.completed).toBe(1);
    });

    it('complete saves test run and updates state', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10, { projectName: 'Test Project' });
      });

      const mockResults = [createMockResult()];
      await act(async () => {
        callbacks!.reportProgress(mockResults, 1);
        await vi.advanceTimersByTimeAsync(600);
      });

      await act(async () => {
        await callbacks!.complete(createMockConfig());
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.finalRun).not.toBeNull();
      expect(mockSaveTestRun).toHaveBeenCalled();
    });

    it('complete handles quota error', async () => {
      mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10);
      });

      await act(async () => {
        callbacks!.reportProgress([createMockResult()], 1);
        await vi.advanceTimersByTimeAsync(600);
      });

      await act(async () => {
        await callbacks!.complete(createMockConfig());
      });

      expect(result.current.pendingRun).not.toBeNull();
      expect(result.current.finalRun).toBeNull();
    });

    it('complete calculates avgIterationTime from trace', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(3);
      });

      await act(async () => {
        callbacks!.reportProgress([createMockResult()], 1);
        await vi.advanceTimersByTimeAsync(600);
      });

      const trace = {
        workflowId: 'wf-1',
        workflowName: 'Test',
        totalIterations: 3,
        totalDurationMs: 300,
        iterations: [
          { index: 0, passed: true, durationMs: 100, traversedEdges: [], stepResults: [] },
          { index: 1, passed: true, durationMs: 100, traversedEdges: [], stepResults: [] },
          { index: 2, passed: true, durationMs: 100, traversedEdges: [], stepResults: [] },
        ],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
        fullTraceCaptured: false,
      };

      await act(async () => {
        await callbacks!.complete(createMockConfig(), trace);
      });

      expect(result.current.liveSummary?.avgIterationTime).toBe(100);
    });

    it('fail sets error state', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10);
      });

      await act(async () => {
        callbacks!.fail('Something went wrong');
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.error).toBe('Something went wrong');
    });

    it('complete clears deferred progress flush timer', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10);
      });

      await act(async () => {
        callbacks!.reportProgress([createMockResult()], 1);
        await vi.advanceTimersByTimeAsync(50);
      });

      await act(async () => {
        await callbacks!.complete(createMockConfig());
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.finalRun).not.toBeNull();
    });

    it('fail clears deferred progress flush timer', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10);
      });

      await act(async () => {
        callbacks!.reportProgress([createMockResult()], 1);
        await vi.advanceTimersByTimeAsync(50);
      });

      act(() => {
        callbacks!.fail('aborted');
      });

      expect(result.current.error).toBe('aborted');
    });

    it('starting another external execution clears any pending throttle timer', async () => {
      const { result } = renderHook(() => useTestExecution());

      let firstCb: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        firstCb = result.current.startExternalExecution(4);
      });

      await act(async () => {
        firstCb!.reportProgress([createMockResult({ id: 'restart-1' })], 1);
        await vi.advanceTimersByTimeAsync(50);
      });

      await act(async () => {
        result.current.startExternalExecution(8);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.total).toBe(8);
      expect(result.current.isRunning).toBe(true);
    });

    it('external reportProgress clears pending setTimeout when immediate throttle flush runs', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((_handler: unknown) => {
        return 99 as unknown as ReturnType<typeof setTimeout>;
      });
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});

      try {
        const { result } = renderHook(() => useTestExecution());

        let callbacks: ReturnType<typeof result.current.startExternalExecution>;
        act(() => {
          callbacks = result.current.startExternalExecution(10);
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
          callbacks!.reportProgress([createMockResult({ id: 'ex1' })], 1);
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
          callbacks!.reportProgress([createMockResult({ id: 'ex1' }), createMockResult({ id: 'ex2' })], 2);
        });

        expect(clearTimeoutSpy).toHaveBeenCalled();
        expect(result.current.completed).toBe(2);
      } finally {
        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
      }
    });

    it('dedups results when reportProgress called multiple times with same results', async () => {
      const { result } = renderHook(() => useTestExecution());

      let callbacks: ReturnType<typeof result.current.startExternalExecution>;
      act(() => {
        callbacks = result.current.startExternalExecution(10);
      });

      const mockResult = createMockResult({ id: 'unique-id' });
      await act(async () => {
        callbacks!.reportProgress([mockResult], 1);
        await vi.advanceTimersByTimeAsync(600);
      });

      await act(async () => {
        callbacks!.reportProgress([mockResult, createMockResult({ id: 'new-id' })], 2);
        await vi.advanceTimersByTimeAsync(600);
      });

      // Should have 2 unique results, not 3
      expect(result.current.liveResults.length).toBe(2);
    });
  });

  describe('time series tracking', () => {
    it('omits time series point when progress has no results yet', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 5000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
        progressCallback?.(5, 10, []);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.timeSeries).toEqual([]);
    });

    it('records concurrency 0 in time series when progress has no profileMeta', async () => {
      let progressCallback: ((
        c: number,
        t: number,
        r: RequestResult[],
        meta?: import('@engine/core/executor').ProgressMeta,
      ) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 5000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await act(async () => {
        progressCallback?.(1, 10, [createMockResult()], undefined);
        await vi.advanceTimersByTimeAsync(1100);
      });

      expect(result.current.timeSeries.length).toBeGreaterThan(0);
      expect(result.current.timeSeries[0].concurrency).toBe(0);
    });

    it('builds time series data during execution', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[], meta?: import('@engine/core/executor').ProgressMeta) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 5000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Simulate results at 1 second
      const results1 = [createMockResult({ responseTimeMs: 100 })];
      await act(async () => {
        progressCallback?.(1, 10, results1, { elapsedMs: 1000, targetConcurrency: 5, currentInFlight: 3, durationMs: 0 });
        await vi.advanceTimersByTimeAsync(1100);
      });

      // Simulate results at 2 seconds
      const results2 = [...results1, createMockResult({ responseTimeMs: 150, id: 'r2' })];
      await act(async () => {
        progressCallback?.(2, 10, results2, { elapsedMs: 2000, targetConcurrency: 5, currentInFlight: 3, durationMs: 0 });
        await vi.advanceTimersByTimeAsync(600);
      });

      // Time series should have data points
      expect(result.current.timeSeries.length).toBeGreaterThan(0);
    });

    it('uses currentInFlight for concurrency when total is -1', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[], meta?: import('@engine/core/executor').ProgressMeta) => void) | undefined;
      const config = { ...createMockConfig(), executionMode: 'load-profile' as const };
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 5000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(config, [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const results = [createMockResult({ responseTimeMs: 100 })];
      await act(async () => {
        progressCallback?.(1, -1, results, { elapsedMs: 1000, targetConcurrency: 5, currentInFlight: 8, durationMs: 0 });
        await vi.advanceTimersByTimeAsync(1100);
      });

      expect(result.current.timeSeries.length).toBeGreaterThan(0);
      expect(result.current.timeSeries[0].concurrency).toBe(8);
    });

    it('includes targetRps and actualRps in time series when profileMeta provides them', async () => {
      let progressCallback: ((
        c: number,
        t: number,
        r: RequestResult[],
        meta?: import('@engine/core/executor').ProgressMeta,
      ) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 5000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await act(async () => {
        progressCallback?.(1, 10, [createMockResult()], {
          elapsedMs: 1000,
          targetConcurrency: 5,
          currentInFlight: 3,
          durationMs: 0,
          targetRps: 42.37,
          actualRps: 38.92,
        });
        await vi.advanceTimersByTimeAsync(1100);
      });

      expect(result.current.timeSeries[0].targetRps).toBe(42.4);
      expect(result.current.timeSeries[0].actualRps).toBe(38.9);
    });
  });

  describe('execution trace handling', () => {
    it('calculates avgIterationTime from execution trace', async () => {
      const trace = {
        workflowId: 'wf-1',
        workflowName: 'Test',
        totalIterations: 2,
        totalDurationMs: 200,
        iterations: [
          { index: 0, passed: true, durationMs: 80, traversedEdges: [], stepResults: [] },
          { index: 1, passed: true, durationMs: 120, traversedEdges: [], stepResults: [] },
        ],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
        fullTraceCaptured: false,
      };
      mockRunTest.mockResolvedValue({ results: [createMockResult()], trace });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      // avgIterationTime should be (80 + 120) / 2 = 100
      expect(result.current.liveSummary?.avgIterationTime).toBe(100);
    });

    it('does not set avgIterationTime when trace has no iterations', async () => {
      const trace = {
        workflowId: 'wf-1',
        workflowName: 'Test',
        totalIterations: 0,
        totalDurationMs: 0,
        iterations: [],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
        fullTraceCaptured: false,
      };
      mockRunTest.mockResolvedValue({ results: [createMockResult()], trace });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.liveSummary?.avgIterationTime).toBeUndefined();
    });

    it('stores execution trace in test run', async () => {
      const trace = {
        workflowId: 'wf-1',
        workflowName: 'Test',
        totalIterations: 1,
        totalDurationMs: 100,
        iterations: [{ index: 0, passed: true, durationMs: 100, traversedEdges: [], stepResults: [] }],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
        fullTraceCaptured: true,
      };
      mockRunTest.mockResolvedValue({ results: [createMockResult()], trace });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(mockSaveTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          executionTrace: trace,
        })
      );
    });
  });

  describe('error handling edge cases', () => {
    it('handles non-Error thrown objects', async () => {
      mockRunTest.mockRejectedValue('string error');

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.error).toBe('string error');
    });

    it('clears flush timer on error', async () => {
      mockRunTest.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.error).toBe('Test error');
    });
  });

});
