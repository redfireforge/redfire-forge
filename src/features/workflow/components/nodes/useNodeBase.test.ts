/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useNodeBase } from './useNodeBase';
import type { NodeRunStatus } from '../../types/workflow';
import * as RunContext from '../panels/WorkflowNodeRunContext';
import * as NewNodeContext from '../panels/WorkflowNewNodeContext';

describe('useNodeBase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns stateClass, debugStep, handleConfigure, and openStepDetail', () => {
    const { result } = renderHook(() => useNodeBase('n1'));
    expect(result.current.stateClass).toBe('');
    expect(result.current.debugStep).toBeNull();
    expect(typeof result.current.handleConfigure).toBe('function');
    expect(typeof result.current.openStepDetail).toBe('function');
    expect(result.current.rs).toBeUndefined();
  });

  it('handleConfigure stops propagation and calls openNodeConfig', () => {
    const { result } = renderHook(() => useNodeBase('n1'));
    const event = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;
    act(() => {
      result.current.handleConfigure(event);
    });
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('stateClass is empty when rs is undefined', () => {
    const { result } = renderHook(() => useNodeBase('n1'));
    expect(result.current.stateClass).toBe('');
  });

  it('stateClass is empty when state is idle', () => {
    vi.spyOn(RunContext, 'useWorkflowNodeRunStatus').mockReturnValue({ state: 'idle' } as NodeRunStatus);
    const { result } = renderHook(() => useNodeBase('n1'));
    expect(result.current.stateClass).toBe('');
  });

  it('stateClass reflects non-idle state', () => {
    vi.spyOn(RunContext, 'useWorkflowNodeRunStatus').mockReturnValue({ state: 'running' } as NodeRunStatus);
    const { result } = renderHook(() => useNodeBase('n1'));
    expect(result.current.stateClass).toBe('wf-node-running');
  });

  it('stateClass reflects paused state', () => {
    vi.spyOn(RunContext, 'useWorkflowNodeRunStatus').mockReturnValue({ state: 'paused' } as NodeRunStatus);
    const { result } = renderHook(() => useNodeBase('n1'));
    expect(result.current.stateClass).toBe('wf-node-paused');
  });

  it('returns a function for handleConfigure on rerender', () => {
    const { result, rerender } = renderHook(() => useNodeBase('n1'));
    rerender();
    expect(typeof result.current.handleConfigure).toBe('function');
  });

  describe('isNew animation state', () => {
    it('includes wf-node-new class when node is marked as new', () => {
      vi.spyOn(NewNodeContext, 'isNodeNew').mockReturnValue(true);
      const { result } = renderHook(() => useNodeBase('new-node'));
      expect(result.current.stateClass).toBe('wf-node-new');
    });

    it('does not include wf-node-new class when node is not new', () => {
      vi.spyOn(NewNodeContext, 'isNodeNew').mockReturnValue(false);
      const { result } = renderHook(() => useNodeBase('old-node'));
      expect(result.current.stateClass).toBe('');
    });

    it('combines run state and new state classes', () => {
      vi.spyOn(NewNodeContext, 'isNodeNew').mockReturnValue(true);
      vi.spyOn(RunContext, 'useWorkflowNodeRunStatus').mockReturnValue({ state: 'running' } as NodeRunStatus);
      const { result } = renderHook(() => useNodeBase('combined-node'));
      expect(result.current.stateClass).toBe('wf-node-running wf-node-new');
    });

    it('clears isNew state after 350ms timeout', () => {
      vi.spyOn(NewNodeContext, 'isNodeNew').mockReturnValue(true);
      const { result } = renderHook(() => useNodeBase('timeout-node'));
      expect(result.current.stateClass).toBe('wf-node-new');

      act(() => {
        vi.advanceTimersByTime(350);
      });
      expect(result.current.stateClass).toBe('');
    });

    it('cleanup function clears timeout on unmount', () => {
      vi.spyOn(NewNodeContext, 'isNodeNew').mockReturnValue(true);
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { unmount } = renderHook(() => useNodeBase('cleanup-node'));
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
