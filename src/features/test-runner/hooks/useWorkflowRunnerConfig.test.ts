/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkflowRunnerConfig } from './useWorkflowRunnerConfig';

vi.mock('../../../shared/utils/storage', () => ({
  saveRunnerConfig: vi.fn().mockResolvedValue(undefined),
  loadRunnerConfig: vi.fn().mockResolvedValue(null),
}));

import { loadRunnerConfig, saveRunnerConfig } from '../../../shared/utils/storage';
const mockLoad = vi.mocked(loadRunnerConfig);
const mockSave = vi.mocked(saveRunnerConfig);

describe('useWorkflowRunnerConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default values', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    expect(result.current.concurrency).toBe(1);
    expect(result.current.totalTransactions).toBe(1);
    expect(result.current.executionMode).toBe('batch');
    expect(result.current.timeoutSec).toBe(10);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.errorPolicy).toBe('continue');
  });

  it('allows updating concurrency', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setConcurrency(5);
    });
    
    expect(result.current.concurrency).toBe(5);
  });

  it('allows updating totalTransactions', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setTotalTransactions(100);
    });
    
    expect(result.current.totalTransactions).toBe(100);
  });

  it('allows updating execution mode', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setExecutionMode('load-profile');
    });
    
    expect(result.current.executionMode).toBe('load-profile');
  });

  it('allows updating load profile', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setLoadProfile((prev) => ({ ...prev, durationSec: 120 }));
    });
    
    expect(result.current.loadProfile.durationSec).toBe(120);
  });

  it('allows updating think time', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setThinkTime({ mode: 'constant', constantMs: 500 });
    });
    
    expect(result.current.thinkTime.mode).toBe('constant');
  });

  it('allows updating error policy', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setErrorPolicy('stop-first');
    });
    
    expect(result.current.errorPolicy).toBe('stop-first');
  });

  it('allows updating timeout', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setTimeoutSec(30);
    });
    
    expect(result.current.timeoutSec).toBe(30);
  });

  it('allows updating retry config', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    
    await waitFor(() => expect(result.current.configLoaded).toBe(true));
    
    act(() => {
      result.current.setRetryCount(3);
      result.current.setRetryDelayMs(2000);
    });
    
    expect(result.current.retryCount).toBe(3);
    expect(result.current.retryDelayMs).toBe(2000);
  });

  it('restores saved config from storage on mount', async () => {
    mockLoad.mockResolvedValueOnce({
      concurrency: 8,
      totalTransactions: 200,
      executionMode: 'load-profile',
      loadProfile: { durationSec: 60, stages: [] },
      thinkTime: { mode: 'constant', constantMs: 250 },
      timeoutSec: 30,
      retryCount: 2,
      retryDelayMs: 500,
      errorPolicy: 'stop-first',
      maxErrors: 5,
      maxErrorRate: 25,
      selectedWorkflowId: 'wf-saved',
    });

    const { result } = renderHook(() => useWorkflowRunnerConfig());
    await waitFor(() => expect(result.current.configLoaded).toBe(true));

    expect(result.current.concurrency).toBe(8);
    expect(result.current.totalTransactions).toBe(200);
    expect(result.current.executionMode).toBe('load-profile');
    expect(result.current.loadProfile.durationSec).toBe(60);
    expect(result.current.thinkTime.mode).toBe('constant');
    expect(result.current.timeoutSec).toBe(30);
    expect(result.current.retryCount).toBe(2);
    expect(result.current.retryDelayMs).toBe(500);
    expect(result.current.errorPolicy).toBe('stop-first');
    expect(result.current.maxErrors).toBe(5);
    expect(result.current.maxErrorRate).toBe(25);
    expect(result.current.selectedWorkflowId).toBe('wf-saved');
  });

  it('auto-saves config when state changes', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    await waitFor(() => expect(result.current.configLoaded).toBe(true));

    mockSave.mockClear();
    act(() => { result.current.setConcurrency(10); });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ concurrency: 10 }),
        '_workflow_runner',
      );
    });
  });

  it('allows updating maxErrors and maxErrorRate', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    await waitFor(() => expect(result.current.configLoaded).toBe(true));

    act(() => {
      result.current.setMaxErrors(20);
      result.current.setMaxErrorRate(75);
    });

    expect(result.current.maxErrors).toBe(20);
    expect(result.current.maxErrorRate).toBe(75);
  });

  it('allows updating selectedWorkflowId', async () => {
    const { result } = renderHook(() => useWorkflowRunnerConfig());
    await waitFor(() => expect(result.current.configLoaded).toBe(true));

    act(() => { result.current.setSelectedWorkflowId('wf-new'); });
    expect(result.current.selectedWorkflowId).toBe('wf-new');
  });
});
