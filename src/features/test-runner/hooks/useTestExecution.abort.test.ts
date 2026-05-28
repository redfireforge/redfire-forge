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

describe('useTestExecution - Abort', () => {
  registerUseTestExecutionTestLifecycle();

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

  it('uses workflow iterations for total when aborted during workflow execution', async () => {
    const activeResult = createMockResult({ id: 'wf-active-1' });
    let resolveRun: ((v: { results: RequestResult[] }) => void) | undefined;

    mockRunTest.mockImplementation(async (_config, _scenarios, _onProgress, signal) => {
      return new Promise<{ results: RequestResult[] }>((resolve) => {
        resolveRun = resolve;
        signal.addEventListener('abort', () => {
          resolve({ results: [activeResult] });
        });
      });
    });

    const workflowConfig = {
      ...createMockConfig(),
      iterations: 5,
      executionMode: 'workflow' as const,
    };

    const { result } = renderHook(() => useTestExecution());

    await act(async () => {
      void result.current.execute(workflowConfig, [createMockScenario()]);
      await vi.advanceTimersByTimeAsync(10);
      result.current.abort();
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(resolveRun).toBeDefined();
    expect(result.current.completed).toBe(1);
    expect(result.current.total).toBe(5);
  });
});
