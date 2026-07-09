/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetDemoWorkflowRunState, useDemoWorkflowRunBridge } from './useDemoWorkflowRunBridge';

describe('useDemoWorkflowRunBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfResetRunState;
    delete (window as unknown as Record<string, unknown>).__wfQuickTest;
  });

  it('exposes __wfResetRunState and clears run status + console', () => {
    const handleResetRunStatus = vi.fn();
    const clearConsole = vi.fn();
    const quickTest = vi.fn();
    renderHook(() => useDemoWorkflowRunBridge(handleResetRunStatus, clearConsole, quickTest));

    const reset = (window as unknown as Record<string, () => boolean>).__wfResetRunState;
    expect(reset()).toBe(true);
    expect(handleResetRunStatus).toHaveBeenCalledTimes(1);
    expect(clearConsole).toHaveBeenCalledTimes(1);

    const bridgeQuickTest = (window as unknown as Record<string, () => void>).__wfQuickTest;
    bridgeQuickTest();
    expect(quickTest).toHaveBeenCalledTimes(1);
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
    const { unmount } = renderHook(() => useDemoWorkflowRunBridge(vi.fn(), vi.fn(), vi.fn()));
    expect((window as unknown as Record<string, unknown>).__wfResetRunState).toBeDefined();
    expect((window as unknown as Record<string, unknown>).__wfQuickTest).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfResetRunState).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__wfQuickTest).toBeUndefined();
  });

  it('uses latest callbacks after rerender', () => {
    const resetV1 = vi.fn();
    const clearV1 = vi.fn();
    const quickV1 = vi.fn();
    const resetV2 = vi.fn();
    const clearV2 = vi.fn();
    const quickV2 = vi.fn();

    const { rerender } = renderHook(
      ({ reset, clear, quick }) => useDemoWorkflowRunBridge(reset, clear, quick),
      { initialProps: { reset: resetV1, clear: clearV1, quick: quickV1 } },
    );

    rerender({ reset: resetV2, clear: clearV2, quick: quickV2 });
    expect(resetDemoWorkflowRunState()).toBe(true);

    const bridgeQuickTest = (window as unknown as Record<string, () => void>).__wfQuickTest;
    bridgeQuickTest();

    expect(resetV1).not.toHaveBeenCalled();
    expect(clearV1).not.toHaveBeenCalled();
    expect(quickV1).not.toHaveBeenCalled();
    expect(resetV2).toHaveBeenCalledTimes(1);
    expect(clearV2).toHaveBeenCalledTimes(1);
    expect(quickV2).toHaveBeenCalledTimes(1);
  });
});
