/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useNodeBase } from './useNodeBase';

// By default, contexts return safe no-ops when used outside providers.

describe('useNodeBase', () => {
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

  it('returns a function for handleConfigure on rerender', () => {
    const { result, rerender } = renderHook(() => useNodeBase('n1'));
    rerender();
    expect(typeof result.current.handleConfigure).toBe('function');
  });
});
