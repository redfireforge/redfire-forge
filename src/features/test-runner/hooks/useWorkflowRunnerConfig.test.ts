/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkflowRunnerConfig } from './useWorkflowRunnerConfig';

vi.mock('../../../shared/utils/storage', () => ({
  saveRunnerConfig: vi.fn().mockResolvedValue(undefined),
  loadRunnerConfig: vi.fn().mockResolvedValue(null),
}));

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
});
