/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTestExecution } from './useTestExecution';
import { TestConfig, RequestResult } from '../../../shared/types';
import { makeScenario, makeResult, makeConfig } from '../../../test-utils/factories';

// Mock dependencies
vi.mock('../../../engine/executor', () => ({
  runTest: vi.fn(),
}));

vi.mock('../../../engine/workerBridge', () => ({
  runTestMultiWorker: vi.fn(),
}));

vi.mock('../../../engine/metrics', () => ({
  computeMetrics: vi.fn(),
}));

vi.mock('../../../shared/utils/storage', () => ({
  saveTestRun: vi.fn(),
  forceSaveTestRun: vi.fn(),
}));

vi.mock('../../../shared/utils/platform', () => ({
  supportsWorkers: vi.fn(),
  isTauri: vi.fn(() => false),
}));

vi.mock('../utils/rustBridge', () => ({
  isRustExecutorAvailable: vi.fn(async () => false),
  canUseRustExecutor: vi.fn(() => false),
  runTestViaRust: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

import { runTest } from '../../../engine/executor';
import { runTestMultiWorker } from '../../../engine/workerBridge';
import { computeMetrics } from '../../../engine/metrics';
import { saveTestRun, forceSaveTestRun } from '../../../shared/utils/storage';
import { supportsWorkers } from '../../../shared/utils/platform';

import { isRustExecutorAvailable, canUseRustExecutor, runTestViaRust } from '../utils/rustBridge';

const mockRunTest = vi.mocked(runTest);
const mockRunTestInWorker = vi.mocked(runTestMultiWorker);
const mockComputeMetrics = vi.mocked(computeMetrics);
const mockSaveTestRun = vi.mocked(saveTestRun);
const mockIsRustAvailable = vi.mocked(isRustExecutorAvailable);
const mockCanUseRust = vi.mocked(canUseRustExecutor);
const mockRunTestViaRust = vi.mocked(runTestViaRust);
const mockForceSaveTestRun = vi.mocked(forceSaveTestRun);
const mockSupportsWorkers = vi.mocked(supportsWorkers);

const createMockScenario = (id = 'sc-1') => makeScenario({ id });
const createMockConfig = (overrides: Partial<TestConfig> = {}) => makeConfig(overrides);
const createMockResult = (overrides: Partial<RequestResult> = {}) => makeResult(overrides);

function createMockSummary() {
  return {
    tps: 10,
    avgResponseTime: 100,
    minResponseTime: 50,
    maxResponseTime: 200,
    p50ResponseTime: 100,
    p95ResponseTime: 180,
    p99ResponseTime: 195,
    errorRate: 0,
    errorsByStatus: {},
    totalRequests: 10,
    successfulRequests: 10,
    failedRequests: 0,
    failedValidations: 0,
    totalDurationMs: 1000,
  };
}

describe('useTestExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSupportsWorkers.mockReturnValue(false);
    mockCanUseRust.mockReturnValue(false);
    mockIsRustAvailable.mockResolvedValue(false);
    mockComputeMetrics.mockReturnValue(createMockSummary());
    mockSaveTestRun.mockResolvedValue({ ok: true, quotaError: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useTestExecution());

      expect(result.current.isRunning).toBe(false);
      expect(result.current.completed).toBe(0);
      expect(result.current.total).toBe(0);
      expect(result.current.liveResults).toEqual([]);
      expect(result.current.liveSummary).toBeNull();
      expect(result.current.finalRun).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.pendingRun).toBeNull();
      expect(result.current.profileMeta).toBeNull();
      expect(result.current.timeSeries).toEqual([]);
    });

    it('provides execute, abort, confirmSavePendingRun, and dismissPendingRun callbacks', () => {
      const { result } = renderHook(() => useTestExecution());

      expect(typeof result.current.execute).toBe('function');
      expect(typeof result.current.abort).toBe('function');
      expect(typeof result.current.confirmSavePendingRun).toBe('function');
      expect(typeof result.current.dismissPendingRun).toBe('function');
    });
  });

  describe('execute', () => {
    it('sets isRunning to true during execution', async () => {
      const results = [createMockResult()];
      mockRunTest.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { results };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.isRunning).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });
    });

    it('uses runTestMultiWorker when workers are supported', async () => {
      mockSupportsWorkers.mockReturnValue(true);
      mockRunTestInWorker.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(mockRunTestInWorker).toHaveBeenCalled();
      expect(mockRunTest).not.toHaveBeenCalled();
    });

    it('uses runTest instead of worker when resolveSubWorkflow is provided even if workers supported', async () => {
      mockSupportsWorkers.mockReturnValue(true);
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });

      const workflow = {
        id: 'wf-resolve',
        name: 'Resolvable Workflow',
        nodes: [],
        edges: [],
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const resolveSubWorkflow = vi.fn((_id: string) => workflow);

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(
          createMockConfig(),
          [createMockScenario()],
          undefined,
          workflow,
          resolveSubWorkflow,
        );
      });

      expect(mockRunTest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(Function),
        expect.anything(),
        workflow,
        resolveSubWorkflow,
      );
      expect(mockRunTestInWorker).not.toHaveBeenCalled();
    });

    it('uses runTestViaRust when Rust executor is available', async () => {
      mockCanUseRust.mockReturnValue(true);
      mockIsRustAvailable.mockResolvedValue(true);
      mockRunTestViaRust.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(mockRunTestViaRust).toHaveBeenCalled();
      expect(mockRunTest).not.toHaveBeenCalled();
      expect(mockRunTestInWorker).not.toHaveBeenCalled();
    });

    it('uses runTest when workers are not supported', async () => {
      mockSupportsWorkers.mockReturnValue(false);
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(mockRunTest).toHaveBeenCalled();
      expect(mockRunTestInWorker).not.toHaveBeenCalled();
    });

    it('passes config and scenarios to runTest', async () => {
      const config = createMockConfig();
      const scenarios = [createMockScenario()];
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(config, scenarios);
      });

      expect(mockRunTest).toHaveBeenCalledWith(
        config,
        scenarios,
        expect.any(Function),
        expect.anything(),
        undefined,
        undefined
      );
    });

    it('passes workflow to runTest when provided', async () => {
      const config = createMockConfig();
      const scenarios = [createMockScenario()];
      const workflow = {
        id: 'wf-1',
        name: 'Test Workflow',
        nodes: [],
        edges: [],
        variables: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(config, scenarios, undefined, workflow);
      });

      expect(mockRunTest).toHaveBeenCalledWith(
        config,
        scenarios,
        expect.any(Function),
        expect.anything(),
        workflow,
        undefined
      );
    });

    it('saves test run on completion', async () => {
      const results = [createMockResult()];
      mockRunTest.mockResolvedValue({ results });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(mockSaveTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid',
          results,
        })
      );
    });

    it('includes metadata in saved test run', async () => {
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()], {
          projectName: 'My Project',
          envName: 'Production',
          svcName: 'API Service',
          baseUrl: 'https://api.example.com',
        });
      });

      expect(mockSaveTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'My Project',
          envName: 'Production',
          svcName: 'API Service',
          baseUrl: 'https://api.example.com',
        })
      );
    });

    it('sets finalRun on successful completion', async () => {
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.finalRun).not.toBeNull();
      expect(result.current.finalRun?.id).toBe('test-uuid');
    });

    it('uses workflow iterations for completed and total counters', async () => {
      mockSupportsWorkers.mockReturnValue(false);
      const workflowConfig = {
        ...createMockConfig(),
        executionMode: 'workflow' as const,
        iterations: 4,
      };
      mockRunTest.mockResolvedValue({ results: [createMockResult({ id: 'w1' })] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(workflowConfig, [createMockScenario()]);
      });

      expect(result.current.completed).toBe(4);
      expect(result.current.total).toBe(4);
    });

    it('defaults workflow completed total to 1 when iterations omitted at runtime', async () => {
      mockSupportsWorkers.mockReturnValue(false);
      mockRunTest.mockResolvedValue({ results: [createMockResult({ id: 'w3' })] });

      const { result } = renderHook(() => useTestExecution());

      const wfCfg = {
        ...createMockConfig(),
        executionMode: 'workflow' as const,
      };
      Reflect.deleteProperty(wfCfg, 'iterations');

      await act(async () => {
        await result.current.execute(wfCfg as TestConfig, [createMockScenario()]);
      });

      expect(result.current.completed).toBe(1);
      expect(result.current.total).toBe(1);
    });

    it('defaults workflow counters to 1 when iterations property is explicitly zero', async () => {
      mockSupportsWorkers.mockReturnValue(false);
      const wfZeroIter = {
        ...createMockConfig(),
        executionMode: 'workflow' as const,
        iterations: 0,
      };
      mockRunTest.mockResolvedValue({ results: [createMockResult({ id: 'w0' })] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(wfZeroIter, [createMockScenario()]);
      });

      expect(result.current.completed).toBe(1);
      expect(result.current.total).toBe(1);
    });

    it('reflects quota error using workflow iterations for totals', async () => {
      mockSupportsWorkers.mockReturnValue(false);
      const wf = {
        ...createMockConfig(),
        executionMode: 'workflow' as const,
        iterations: 9,
      };
      mockRunTest.mockResolvedValue({ results: [createMockResult({ id: 'q1' })] });
      mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(wf, [createMockScenario()]);
      });

      expect(result.current.completed).toBe(9);
      expect(result.current.total).toBe(9);
      expect(result.current.pendingRun).not.toBeNull();
    });

    it('sets pendingRun on quota error', async () => {
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });
      mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.finalRun).toBeNull();
      expect(result.current.pendingRun).not.toBeNull();
    });

    it('sets error state on exception', async () => {
      mockRunTest.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.error).toBe('Network failure');
    });

    it('clears pending throttle timer when execute throws after progress scheduled deferred flush', async () => {
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        // lastFlushRef is 0: small sinceLast schedules setTimeout flush, no immediate flush
        onProgress(1, 10, [createMockResult({ id: 'p1' })]);
        throw new Error('aborted after throttle schedule');
      });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.error).toBe('aborted after throttle schedule');
      expect(result.current.isRunning).toBe(false);
    });

    it('clears pending throttle timer on worker path when execute throws after deferred flush was scheduled', async () => {
      mockSupportsWorkers.mockReturnValue(true);
      mockRunTestInWorker.mockImplementation(async (_config, _scenarios, onProgress) => {
        onProgress(1, 10, [createMockResult({ id: 'w1' })]);
        throw new Error('worker failed after schedule');
      });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.error).toBe('worker failed after schedule');
    });

    it('clears pending throttle timer when runTest resolves before deferred flush fires', async () => {
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        onProgress(1, 10, [createMockResult({ id: 'resolved-1' })]);
        return { results: [createMockResult({ id: 'final-1' })] };
      });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.finalRun).not.toBeNull();
    });

    it('clears pending throttle timer when runTestMultiWorker resolves before deferred flush fires', async () => {
      mockSupportsWorkers.mockReturnValue(true);
      mockRunTestInWorker.mockImplementation(async (_config, _scenarios, onProgress) => {
        onProgress(1, 10, [createMockResult({ id: 'wr-1' })]);
        return { results: [createMockResult({ id: 'wr-final' })] };
      });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.finalRun).not.toBeNull();
    });

    it('sets total to -1 for load-profile mode', async () => {
      const config = { ...createMockConfig(), executionMode: 'load-profile' as const };
      mockRunTest.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(config, [createMockScenario()]);
      });

      expect(result.current.total).toBe(-1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
    });

    it('sets total to results count after load-profile run completes', async () => {
      const config = { ...createMockConfig(), executionMode: 'load-profile' as const };
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(config, [createMockScenario()]);
      });

      expect(result.current.total).toBe(1);
      expect(result.current.completed).toBe(1);
    });

    it('sets total to results count on load-profile quota error', async () => {
      const config = { ...createMockConfig(), executionMode: 'load-profile' as const };
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });
      mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(config, [createMockScenario()]);
      });

      expect(result.current.total).toBe(1);
      expect(result.current.pendingRun).not.toBeNull();
    });
  });

  describe('abort', () => {
    it('aborts the running test', async () => {
      let abortSignal: AbortSignal | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, _onProgress, signal) => {
        abortSignal = signal;
        await new Promise((r) => setTimeout(r, 1000));
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      act(() => {
        result.current.abort();
      });

      expect(abortSignal?.aborted).toBe(true);
    });

    it('uses active (non-cancelled) result count when aborted', async () => {
      const cancelledResult = createMockResult({ id: 'cancelled-1', cancelled: true });
      const activeResult = createMockResult({ id: 'active-1', passed: true });
      let resolveRun: ((v: { results: RequestResult[] }) => void) | undefined;

      mockRunTest.mockImplementation(async (_config, _scenarios, _onProgress, signal) => {
        return new Promise<{ results: RequestResult[] }>((resolve) => {
          resolveRun = resolve;
          signal.addEventListener('abort', () => {
            resolve({ results: [activeResult, cancelledResult] });
          });
        });
      });

      const { result } = renderHook(() => useTestExecution());

      act(() => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      await act(async () => {
        result.current.abort();
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(resolveRun).toBeDefined();
      expect(result.current.completed).toBe(1);
    });
  });

  describe('confirmSavePendingRun', () => {
    it('saves pending run with forceSaveTestRun', async () => {
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });
      mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });
      mockForceSaveTestRun.mockResolvedValue({ ok: true });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.pendingRun).not.toBeNull();

      await act(async () => {
        await result.current.confirmSavePendingRun();
      });

      expect(mockForceSaveTestRun).toHaveBeenCalled();
      expect(result.current.finalRun).not.toBeNull();
      expect(result.current.pendingRun).toBeNull();
    });

    it('sets error if force save fails', async () => {
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });
      mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });
      mockForceSaveTestRun.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      await act(async () => {
        await result.current.confirmSavePendingRun();
      });

      expect(result.current.error).toContain('Storage is full');
      expect(result.current.pendingRun).toBeNull();
    });

    it('does nothing when no pending run', async () => {
      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.confirmSavePendingRun();
      });

      expect(mockForceSaveTestRun).not.toHaveBeenCalled();
    });
  });

  describe('dismissPendingRun', () => {
    it('clears pending run', async () => {
      mockRunTest.mockResolvedValue({ results: [createMockResult()] });
      mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.pendingRun).not.toBeNull();

      act(() => {
        result.current.dismissPendingRun();
      });

      expect(result.current.pendingRun).toBeNull();
    });
  });

  describe('progress tracking', () => {
    it('updates completed count via onProgress callback', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        return { results: [] };
      });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        result.current.execute(createMockConfig(), [createMockScenario()]);
        await vi.advanceTimersByTimeAsync(10);
      });

      const mockResults = [createMockResult()];
      await act(async () => {
        progressCallback?.(1, 10, mockResults);
        await vi.advanceTimersByTimeAsync(600); // exceed PROGRESS_THROTTLE_MS
      });

      expect(result.current.completed).toBe(1);
    });

    it('caps live results at MAX_LIVE_RESULTS', async () => {
      const manyResults = Array.from({ length: 600 }, (_, i) =>
        createMockResult({ id: `r-${i}`, passed: true })
      );
      mockRunTest.mockResolvedValue({ results: manyResults });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.liveResults.length).toBeLessThanOrEqual(500);
    });

    it('prioritizes failed results when capping', async () => {
      const failedResults = Array.from({ length: 100 }, (_, i) =>
        createMockResult({ id: `f-${i}`, passed: false, httpStatus: 500 })
      );
      const passedResults = Array.from({ length: 500 }, (_, i) =>
        createMockResult({ id: `p-${i}`, passed: true })
      );
      const allResults = [...failedResults, ...passedResults];
      mockRunTest.mockResolvedValue({ results: allResults });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      const failedInLive = result.current.liveResults.filter((r) => !r.passed);
      expect(failedInLive.length).toBe(100);
    });

    it('caps without subsampling passes when ample budget remains for failures', async () => {
      const failedResults = Array.from({ length: 50 }, (_, i) =>
        createMockResult({ id: `cf-${i}`, passed: false, httpStatus: 500 }),
      );
      const passedResults = Array.from({ length: 40 }, (_, i) =>
        createMockResult({ id: `cp-${i}`, passed: true }),
      );
      mockRunTest.mockResolvedValue({ results: [...failedResults, ...passedResults] });

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.liveResults.length).toBe(90);
      expect(result.current.liveResults.filter((r) => !r.passed).length).toBe(50);
    });
  });

});
