/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoWorkflowBridge } from './useDemoWorkflowBridge';

describe('useDemoWorkflowBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('exposes __wfDeleteByName on window', () => {
    const remove = vi.fn();
    renderHook(() => useDemoWorkflowBridge([{ id: '1', name: 'WF1' }], remove));
    expect((window as unknown as Record<string, unknown>).__wfDeleteByName).toBeTypeOf('function');
  });

  it('deletes workflow by name', () => {
    const remove = vi.fn();
    renderHook(() => useDemoWorkflowBridge([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }], remove));
    const fn = (window as unknown as Record<string, (name: string) => void>).__wfDeleteByName;
    fn('Beta');
    expect(remove).toHaveBeenCalledWith('b');
  });

  it('does nothing when workflow name not found', () => {
    const remove = vi.fn();
    renderHook(() => useDemoWorkflowBridge([{ id: 'a', name: 'Alpha' }], remove));
    const fn = (window as unknown as Record<string, (name: string) => void>).__wfDeleteByName;
    fn('NonExistent');
    expect(remove).not.toHaveBeenCalled();
  });

  it('cleans up on unmount', () => {
    const remove = vi.fn();
    const { unmount } = renderHook(() => useDemoWorkflowBridge([], remove));
    expect((window as unknown as Record<string, unknown>).__wfDeleteByName).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfDeleteByName).toBeUndefined();
  });
});
