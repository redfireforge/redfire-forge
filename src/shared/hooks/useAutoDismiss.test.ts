/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoDismiss } from './useAutoDismiss';

describe('useAutoDismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call setValue when value is false', () => {
    const setValue = vi.fn();
    renderHook(() => useAutoDismiss(false, setValue));
    vi.advanceTimersByTime(6000);
    expect(setValue).not.toHaveBeenCalled();
  });

  it('calls setValue(false) after default 6s when value is true', () => {
    const setValue = vi.fn();
    renderHook(() => useAutoDismiss(true, setValue));
    vi.advanceTimersByTime(5999);
    expect(setValue).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setValue).toHaveBeenCalledWith(false);
  });

  it('respects custom ms delay', () => {
    const setValue = vi.fn();
    renderHook(() => useAutoDismiss(true, setValue, 2000));
    vi.advanceTimersByTime(1999);
    expect(setValue).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setValue).toHaveBeenCalledWith(false);
  });

  it('clears timer on unmount', () => {
    const setValue = vi.fn();
    const { unmount } = renderHook(() => useAutoDismiss(true, setValue));
    unmount();
    vi.advanceTimersByTime(6000);
    expect(setValue).not.toHaveBeenCalled();
  });

  it('resets timer when value toggles back to true', () => {
    const setValue = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useAutoDismiss(value, setValue),
      { initialProps: { value: true } },
    );
    vi.advanceTimersByTime(3000);
    rerender({ value: false });
    rerender({ value: true });
    vi.advanceTimersByTime(3000);
    expect(setValue).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(setValue).toHaveBeenCalledWith(false);
  });

  it('works with React state setter via act', () => {
    let visible = true;
    const setValue = vi.fn((v: false) => { visible = v; });
    renderHook(() => useAutoDismiss(visible, setValue));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(setValue).toHaveBeenCalledWith(false);
  });
});
