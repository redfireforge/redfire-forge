/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTestExecution } from './useTestExecution';
import type { TestConfig, RequestResult } from '../../../shared/types';
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

const mockRunTest = vi.mocked(runTest);
const mockRunTestInWorker = vi.mocked(runTestMultiWorker);
const mockComputeMetrics = vi.mocked(computeMetrics);
const mockSaveTestRun = vi.mocked(saveTestRun);
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
    mockSupportsWorkers.mockReturnValue(false); // Default to direct execution
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
        progressCallback?.(1, 10, [createMockResult()], undefined);
        await vi.advanceTimersByTimeAsync(1100);
      });

      expect(result.current.timeSeries.length).toBeGreaterThan(0);
      expect(result.current.timeSeries[0].concurrency).toBe(0);
    });

    it('builds time series data during execution', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[], meta?: import('../../../engine/executor').ProgressMeta) => void) | undefined;
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
      let progressCallback: ((c: number, t: number, r: RequestResult[], meta?: import('../../../engine/executor').ProgressMeta) => void) | undefined;
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
