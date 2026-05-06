/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTestExecution } from './useTestExecution';
import type { Scenario, TestConfig, RequestResult } from '../../../shared/types';

// Mock dependencies
vi.mock('../../../engine/executor', () => ({
  runTest: vi.fn(),
}));

vi.mock('../../../engine/workerBridge', () => ({
  runTestInWorker: vi.fn(),
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
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

import { runTest } from '../../../engine/executor';
import { runTestInWorker } from '../../../engine/workerBridge';
import { computeMetrics } from '../../../engine/metrics';
import { saveTestRun, forceSaveTestRun } from '../../../shared/utils/storage';
import { supportsWorkers } from '../../../shared/utils/platform';

const mockRunTest = vi.mocked(runTest);
const mockRunTestInWorker = vi.mocked(runTestInWorker);
const mockComputeMetrics = vi.mocked(computeMetrics);
const mockSaveTestRun = vi.mocked(saveTestRun);
const mockForceSaveTestRun = vi.mocked(forceSaveTestRun);
const mockSupportsWorkers = vi.mocked(supportsWorkers);

function createMockScenario(id = 'sc-1'): Scenario {
  return {
    id,
    name: 'Test Scenario',
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
  };
}

function createMockConfig(): TestConfig {
  return {
    executionMode: 'sequential',
    totalTransactions: 10,
    concurrentUsers: 1,
    thinkTimeMs: 0,
    errorPolicy: 'continue',
  };
}

function createMockResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: 'result-1',
    scenarioId: 'sc-1',
    scenarioName: 'Test Scenario',
    url: 'https://api.example.com/test',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

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
        return results;
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

    it('uses runTestInWorker when workers are supported', async () => {
      mockSupportsWorkers.mockReturnValue(true);
      mockRunTestInWorker.mockResolvedValue([createMockResult()]);

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(mockRunTestInWorker).toHaveBeenCalled();
      expect(mockRunTest).not.toHaveBeenCalled();
    });

    it('uses runTest when workers are not supported', async () => {
      mockSupportsWorkers.mockReturnValue(false);
      mockRunTest.mockResolvedValue([createMockResult()]);

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
      mockRunTest.mockResolvedValue([createMockResult()]);

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(config, scenarios);
      });

      expect(mockRunTest).toHaveBeenCalledWith(
        config,
        scenarios,
        expect.any(Function),
        expect.any(Object),
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
      mockRunTest.mockResolvedValue([createMockResult()]);

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(config, scenarios, undefined, workflow);
      });

      expect(mockRunTest).toHaveBeenCalledWith(
        config,
        scenarios,
        expect.any(Function),
        expect.any(Object),
        workflow
      );
    });

    it('saves test run on completion', async () => {
      const results = [createMockResult()];
      mockRunTest.mockResolvedValue(results);

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
      mockRunTest.mockResolvedValue([createMockResult()]);

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
      mockRunTest.mockResolvedValue([createMockResult()]);

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      expect(result.current.finalRun).not.toBeNull();
      expect(result.current.finalRun?.id).toBe('test-uuid');
    });

    it('sets pendingRun on quota error', async () => {
      mockRunTest.mockResolvedValue([createMockResult()]);
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

    it('sets total to -1 for load-profile mode', async () => {
      const config = { ...createMockConfig(), executionMode: 'load-profile' as const };
      mockRunTest.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return [];
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
  });

  describe('abort', () => {
    it('aborts the running test', async () => {
      let abortSignal: AbortSignal | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, _onProgress, signal) => {
        abortSignal = signal;
        await new Promise((r) => setTimeout(r, 1000));
        return [];
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
      mockRunTest.mockResolvedValue([createMockResult()]);
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
      mockRunTest.mockResolvedValue([createMockResult()]);
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
      mockRunTest.mockResolvedValue([createMockResult()]);
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
        return [];
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
      mockRunTest.mockResolvedValue(manyResults);

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
      mockRunTest.mockResolvedValue(allResults);

      const { result } = renderHook(() => useTestExecution());

      await act(async () => {
        await result.current.execute(createMockConfig(), [createMockScenario()]);
      });

      const failedInLive = result.current.liveResults.filter((r) => !r.passed);
      expect(failedInLive.length).toBe(100);
    });
  });

  describe('incremental summary computation', () => {
    it('computes live summary during execution', async () => {
      let progressCallback: ((c: number, t: number, r: RequestResult[]) => void) | undefined;
      mockRunTest.mockImplementation(async (_config, _scenarios, onProgress) => {
        progressCallback = onProgress;
        await new Promise((r) => setTimeout(r, 2000));
        return [];
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
        return [];
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
        return [];
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
  });
});
