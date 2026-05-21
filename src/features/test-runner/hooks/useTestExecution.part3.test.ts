/**
 * @vitest-environment jsdom
 */
import {
  createMockScenario,
  createMockConfig,
  createMockResult,
  registerUseTestExecutionTestLifecycle,
  mockRunTest,
} from './__test-utils__/useTestExecutionTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTestExecution } from './useTestExecution';
import type { RequestResult } from '../../../shared/types';

vi.mock('../../../engine/executor', async () => {
  const { mockRunTest } = await import('./__test-utils__/useTestExecutionTestSetup');
  return { runTest: mockRunTest };
});
vi.mock('../../../engine/workerBridge', async () => {
  const { mockRunTestInWorker } = await import('./__test-utils__/useTestExecutionTestSetup');
  return { runTestMultiWorker: mockRunTestInWorker };
});
vi.mock('../../../engine/metrics', async () => {
  const { mockComputeMetrics } = await import('./__test-utils__/useTestExecutionTestSetup');
  return { computeMetrics: mockComputeMetrics };
});
vi.mock('../../../shared/utils/storage', async () => {
  const { mockSaveTestRun, mockForceSaveTestRun } = await import(
    './__test-utils__/useTestExecutionTestSetup'
  );
  return { saveTestRun: mockSaveTestRun, forceSaveTestRun: mockForceSaveTestRun };
});
vi.mock('../../../shared/utils/platform', async () => {
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

  describe('throttling behavior', () => {
    it('throttles progress updates', async () => {
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
        await vi.advanceTimersByTimeAsync(10);
      });

      // Rapid-fire progress updates
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          progressCallback?.(i, 10, [createMockResult({ id: `r-${i}` })]);
          await vi.advanceTimersByTimeAsync(50); // Less than PROGRESS_THROTTLE_MS
        });
      }

      // State updates should be throttled
      expect(result.current.completed).toBeLessThan(10);

      // Wait for throttle to flush
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
    });

    it('flushes immediately when throttle window exceeded', async () => {
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
        await vi.advanceTimersByTimeAsync(10);
      });

      // First update
      await act(async () => {
        progressCallback?.(1, 10, [createMockResult()]);
        await vi.advanceTimersByTimeAsync(600); // Exceed throttle
      });

      expect(result.current.completed).toBe(1);

      // Second update after throttle window
      await act(async () => {
        progressCallback?.(2, 10, [createMockResult(), createMockResult({ id: 'r2' })]);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.completed).toBe(2);
    });

    it('clears scheduled flush timer when progress arrives after throttle window with pending timeout', async () => {
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
        await vi.advanceTimersByTimeAsync(10);
      });

      await act(async () => {
        progressCallback?.(1, 10, [createMockResult({ id: 't1' })]);
        await vi.advanceTimersByTimeAsync(50);
      });

      await act(async () => {
        progressCallback?.(2, 10, [createMockResult({ id: 't2' }), createMockResult({ id: 't3' })]);
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.completed).toBe(2);
    });
  });

  describe('profile meta live summary', () => {
    it('uses avgIterationTimeMs from progress profileMeta for live summary', async () => {
      let progressCallback: ((
        c: number,
        t: number,
        r: RequestResult[],
        meta?: import('../../../engine/executor').ProgressMeta,
      ) => void) | undefined;
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
        progressCallback?.(1, 10, [createMockResult()], {
          elapsedMs: 100,
          targetConcurrency: 1,
          currentInFlight: 1,
          durationMs: 0,
          avgIterationTimeMs: 42.5,
        });
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.liveSummary?.avgIterationTime).toBe(42.5);
    });

    it('keeps previous avgIterationTime when newer profileMeta omits avgIterationTimeMs', async () => {
      let progressCallback: ((
        c: number,
        t: number,
        r: RequestResult[],
        meta?: import('../../../engine/executor').ProgressMeta,
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
        progressCallback?.(
          1,
          10,
          [createMockResult()],
          {
            elapsedMs: 80,
            targetConcurrency: 1,
            currentInFlight: 1,
            durationMs: 0,
            avgIterationTimeMs: 33.3,
          },
        );
        await vi.advanceTimersByTimeAsync(600);
      });

      await act(async () => {
        progressCallback?.(
          2,
          10,
          [createMockResult(), createMockResult({ id: 'r2-meta' })],
          {
            elapsedMs: 200,
            targetConcurrency: 1,
            currentInFlight: 1,
            durationMs: 0,
          },
        );
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.liveSummary?.avgIterationTime).toBe(33.3);
    });
  });

  describe('deferred flush timer clearing', () => {
    it('noop second throttle flush when pending was already drained', async () => {
      let progressCb!: (
        c: number,
        t: number,
        r: RequestResult[],
        m?: import('../../../engine/executor').ProgressMeta,
      ) => void;
      let finishRun!: (v: { results: RequestResult[] }) => void;

      const scheduledThrottleFlushes: (() => void)[] = [];
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler: TimerHandler) => {
        if (typeof handler === 'function') scheduledThrottleFlushes.push(handler as () => void);
        return scheduledThrottleFlushes.length as unknown as ReturnType<typeof setTimeout>;
      });

      mockRunTest.mockImplementation((_a, _b, onProgress) => {
        progressCb = onProgress;
        return new Promise<{ results: RequestResult[] }>((resolve) => {
          finishRun = resolve;
        });
      });

      const { result } = renderHook(() => useTestExecution());

      try {
        act(() => {
          void result.current.execute(createMockConfig(), [createMockScenario()]);
        });

        await act(async () => {
          await Promise.resolve();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
          progressCb(1, 10, [createMockResult({ id: 'noop-flush-a' })]);
        });

        expect(scheduledThrottleFlushes.length).toBeGreaterThan(0);

        const throttleFlushCb = scheduledThrottleFlushes.at(-1)!;

        await act(async () => {
          throttleFlushCb();
          throttleFlushCb();
        });
      } finally {
        setTimeoutSpy.mockRestore();
        await act(async () => {
          finishRun({ results: [createMockResult({ id: 'noop-flush-final' })] });
        });
      }

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });
    });

    it('execute onProgress clears pending setTimeout when sinceLast reaches throttle', async () => {
      let progressCb!: (
        c: number,
        t: number,
        r: RequestResult[],
        m?: import('../../../engine/executor').ProgressMeta,
      ) => void;
      let finishRun!: (v: { results: RequestResult[] }) => void;

      mockRunTest.mockImplementation((_a, _b, onProgress) => {
        progressCb = onProgress;
        return new Promise<{ results: RequestResult[] }>((resolve) => {
          finishRun = resolve;
        });
      });

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((_h: unknown) => {
        return 42 as unknown as ReturnType<typeof setTimeout>;
      });
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});

      const { result } = renderHook(() => useTestExecution());

      try {
        act(() => {
          void result.current.execute(createMockConfig(), [createMockScenario()]);
        });

        await act(async () => {
          await Promise.resolve();
        });

        await act(async () => {
          progressCb(1, 10, [createMockResult({ id: 'th1' })]);
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });

        await act(async () => {
          progressCb(2, 10, [createMockResult({ id: 'th1' }), createMockResult({ id: 'th2' })]);
        });

        expect(clearTimeoutSpy).toHaveBeenCalled();
      } finally {
        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
        await act(async () => {
          finishRun({ results: [createMockResult()] });
        });
      }

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });
    });

    it('execute clears pending throttle timer when starting a new run over a hung test', async () => {
      let progressCb!: (
        c: number,
        t: number,
        r: RequestResult[],
        m?: import('../../../engine/executor').ProgressMeta,
      ) => void;
      let invoke = 0;
      mockRunTest.mockImplementation((_a, _b, onProgress) => {
        progressCb = onProgress;
        invoke += 1;
        if (invoke === 1) {
          return new Promise(() => {
            /* never resolves */
          });
        }
        return Promise.resolve({ results: [createMockResult()] });
      });

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((_h: unknown) => {
        return 7 as unknown as ReturnType<typeof setTimeout>;
      });
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      const { result } = renderHook(() => useTestExecution());

      try {
        act(() => {
          void result.current.execute(createMockConfig(), [createMockScenario()]);
        });

        await act(async () => {
          await Promise.resolve();
        });

        await act(async () => {
          progressCb(1, 10, [createMockResult({ id: 'stale-1' })]);
        });

        const clearsAfterProgress = clearTimeoutSpy.mock.calls.length;

        await act(async () => {
          await result.current.execute(createMockConfig(), [createMockScenario()]);
        });

        expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(clearsAfterProgress);
        expect(result.current.isRunning).toBe(false);
      } finally {
        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
        mockRunTest.mockReset();
      }
    });
  });
});
