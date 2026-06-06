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

const mockPublishRunResults = vi.fn().mockResolvedValue({ status: 'published', retryCount: 0, durationMs: 5 });

vi.mock('../../../shared/kafka/kafkaResultsPublisher', () => ({
  publishRunResults: (...args: unknown[]) => mockPublishRunResults(...args),
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

// ── Phase 8B: publishRunResults integration ──────────────────────────────────

describe('useTestExecution - Kafka publish on completion', () => {
  registerUseTestExecutionTestLifecycle();

  beforeEach(() => {
    mockPublishRunResults.mockClear();
  });

  const enabledConfig = { enabled: true, clusterId: 'c1', topic: 'redfireforge.results.summary' };
  const disabledConfig = { enabled: false, clusterId: 'c1', topic: 'redfireforge.results.summary' };

  it('calls publishRunResults after successful save in execute() when enabled', async () => {
    mockRunTest.mockResolvedValue({ results: [createMockResult()] });
    mockSaveTestRun.mockResolvedValue({ ok: true, quotaError: false });

    const { result } = renderHook(() => useTestExecution(enabledConfig));

    await act(async () => {
      await result.current.execute(createMockConfig(), [createMockScenario()]);
    });

    expect(mockPublishRunResults).toHaveBeenCalledTimes(1);
    expect(mockPublishRunResults).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-uuid' }),
      enabledConfig,
    );
  });

  it('does not call publishRunResults when enabled is false', async () => {
    mockRunTest.mockResolvedValue({ results: [createMockResult()] });
    mockSaveTestRun.mockResolvedValue({ ok: true, quotaError: false });

    const { result } = renderHook(() => useTestExecution(disabledConfig));

    await act(async () => {
      await result.current.execute(createMockConfig(), [createMockScenario()]);
    });

    expect(mockPublishRunResults).not.toHaveBeenCalled();
  });

  it('does not call publishRunResults when no publishConfig is provided', async () => {
    mockRunTest.mockResolvedValue({ results: [createMockResult()] });
    mockSaveTestRun.mockResolvedValue({ ok: true, quotaError: false });

    const { result } = renderHook(() => useTestExecution());

    await act(async () => {
      await result.current.execute(createMockConfig(), [createMockScenario()]);
    });

    expect(mockPublishRunResults).not.toHaveBeenCalled();
  });

  it('does not call publishRunResults when saveTestRun returns quotaError', async () => {
    mockRunTest.mockResolvedValue({ results: [createMockResult()] });
    mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });

    const { result } = renderHook(() => useTestExecution(enabledConfig));

    await act(async () => {
      await result.current.execute(createMockConfig(), [createMockScenario()]);
    });

    expect(mockPublishRunResults).not.toHaveBeenCalled();
  });

  it('publish failure does not change finalRun or error state', async () => {
    mockRunTest.mockResolvedValue({ results: [createMockResult()] });
    mockSaveTestRun.mockResolvedValue({ ok: true, quotaError: false });
    mockPublishRunResults.mockResolvedValueOnce({ status: 'failed', retryCount: 3, durationMs: 100, errorCode: 'KAFKA_TIMEOUT' });

    const { result } = renderHook(() => useTestExecution(enabledConfig));

    await act(async () => {
      await result.current.execute(createMockConfig(), [createMockScenario()]);
    });

    expect(result.current.finalRun).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('calls publishRunResults after forceSaveTestRun succeeds in confirmSavePendingRun()', async () => {
    mockRunTest.mockResolvedValue({ results: [createMockResult()] });
    mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });
    mockForceSaveTestRun.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useTestExecution(enabledConfig));

    await act(async () => {
      await result.current.execute(createMockConfig(), [createMockScenario()]);
    });

    expect(result.current.pendingRun).not.toBeNull();
    expect(mockPublishRunResults).not.toHaveBeenCalled(); // not called at quota-exceeded site

    await act(async () => {
      await result.current.confirmSavePendingRun();
    });

    expect(mockPublishRunResults).toHaveBeenCalledTimes(1);
    expect(result.current.finalRun).not.toBeNull();
    expect(result.current.pendingRun).toBeNull();
  });

  it('does not call publishRunResults when forceSaveTestRun fails', async () => {
    mockRunTest.mockResolvedValue({ results: [createMockResult()] });
    mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });
    mockForceSaveTestRun.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useTestExecution(enabledConfig));

    await act(async () => {
      await result.current.execute(createMockConfig(), [createMockScenario()]);
    });

    await act(async () => {
      await result.current.confirmSavePendingRun();
    });

    expect(mockPublishRunResults).not.toHaveBeenCalled();
    expect(result.current.error).toContain('Storage is full');
  });

  it('calls publishRunResults after complete() in startExternalExecution() when enabled', async () => {
    // Verify the third save site (complete() callback inside startExternalExecution)
    // also triggers publish when publishConfig is enabled and save succeeds.
    mockSaveTestRun.mockResolvedValue({ ok: true, quotaError: false });

    const { result } = renderHook(() => useTestExecution(enabledConfig));

    let callbacks: ReturnType<typeof result.current.startExternalExecution>;
    act(() => {
      callbacks = result.current.startExternalExecution(1);
    });

    await act(async () => {
      callbacks!.reportProgress([createMockResult()], 1);
      await vi.advanceTimersByTimeAsync(600);
    });

    await act(async () => {
      await callbacks!.complete(createMockConfig());
    });

    expect(mockPublishRunResults).toHaveBeenCalledTimes(1);
    expect(mockPublishRunResults).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-uuid' }),
      enabledConfig,
    );
  });

  it('does not call publishRunResults from startExternalExecution() when saveTestRun returns quotaError', async () => {
    mockSaveTestRun.mockResolvedValue({ ok: false, quotaError: true });

    const { result } = renderHook(() => useTestExecution(enabledConfig));

    let callbacks: ReturnType<typeof result.current.startExternalExecution>;
    act(() => {
      callbacks = result.current.startExternalExecution(1);
    });

    await act(async () => {
      callbacks!.reportProgress([createMockResult()], 1);
      await vi.advanceTimersByTimeAsync(600);
    });

    await act(async () => {
      await callbacks!.complete(createMockConfig());
    });

    expect(mockPublishRunResults).not.toHaveBeenCalled();
    expect(result.current.pendingRun).not.toBeNull();
  });
});
