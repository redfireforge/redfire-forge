/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetDemoWorkflowRunState, useDemoWorkflowRunBridge } from './useDemoWorkflowRunBridge';

describe('useDemoWorkflowRunBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfResetRunState;
  });

  it('exposes __wfResetRunState and clears run status + console', () => {
    const handleResetRunStatus = vi.fn();
    const clearConsole = vi.fn();
    renderHook(() => useDemoWorkflowRunBridge(handleResetRunStatus, clearConsole));

    const reset = (window as unknown as Record<string, () => boolean>).__wfResetRunState;
    expect(reset()).toBe(true);
    expect(handleResetRunStatus).toHaveBeenCalledTimes(1);
    expect(clearConsole).toHaveBeenCalledTimes(1);
  });

  it('resetDemoWorkflowRunState delegates to bridge', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfResetRunState = spy;
    expect(resetDemoWorkflowRunState()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('resetDemoWorkflowRunState returns false when bridge absent', () => {
    expect(resetDemoWorkflowRunState()).toBe(false);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useDemoWorkflowRunBridge(vi.fn(), vi.fn()));
    expect((window as unknown as Record<string, unknown>).__wfResetRunState).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfResetRunState).toBeUndefined();
  });
});
