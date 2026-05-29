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
import { renderHook, act } from '@testing-library/react';
import { useTestExecution } from './useTestExecution';
import { RequestResult } from '../../../shared/types';

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

describe('useTestExecution - Progress Tracking', () => {
  registerUseTestExecutionTestLifecycle();

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
