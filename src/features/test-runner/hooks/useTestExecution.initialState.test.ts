/**
 * @vitest-environment jsdom
 */
import {
  registerUseTestExecutionTestLifecycle,
} from './__test-utils__/useTestExecutionTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTestExecution } from './useTestExecution';

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

describe('useTestExecution - Initial State', () => {
  registerUseTestExecutionTestLifecycle();

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
