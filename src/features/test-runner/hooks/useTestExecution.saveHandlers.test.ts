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
  mockForceSaveTestRun,
} from './__test-utils__/useTestExecutionTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

describe('useTestExecution - Save Handlers', () => {
  registerUseTestExecutionTestLifecycle();

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
});
