/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDemoWorkflowConfigModalBridge,
  closeDemoWorkflowConfigModal,
} from './useDemoWorkflowConfigModalBridge';

describe('useDemoWorkflowConfigModalBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfCloseConfigModal;
  });

  it('exposes close on window and invokes callback', () => {
    const close = vi.fn();
    renderHook(() => useDemoWorkflowConfigModalBridge(close));
    expect((window as unknown as Record<string, unknown>).__wfCloseConfigModal).toBeTypeOf('function');
    act(() => { closeDemoWorkflowConfigModal(); });
    expect(close).toHaveBeenCalledOnce();
  });

  it('closeDemoWorkflowConfigModal is no-op when bridge is absent', () => {
    expect(() => closeDemoWorkflowConfigModal()).not.toThrow();
  });

  it('cleans up window bridge on unmount', () => {
    const { unmount } = renderHook(() => useDemoWorkflowConfigModalBridge(vi.fn()));
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfCloseConfigModal).toBeUndefined();
  });

  it('updates window callback when closeConfigModal changes', () => {
    const closeV1 = vi.fn();
    const closeV2 = vi.fn();
    const { rerender } = renderHook(
      ({ close }) => useDemoWorkflowConfigModalBridge(close),
      { initialProps: { close: closeV1 } },
    );
    act(() => { closeDemoWorkflowConfigModal(); });
    expect(closeV1).toHaveBeenCalledOnce();

    rerender({ close: closeV2 });
    act(() => { closeDemoWorkflowConfigModal(); });
    expect(closeV2).toHaveBeenCalledOnce();
    expect(closeV1).toHaveBeenCalledOnce();
  });
});
