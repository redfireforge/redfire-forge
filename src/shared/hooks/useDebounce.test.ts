/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update before delay expires', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    vi.advanceTimersByTime(100);
    expect(result.current).toBe('a');
    vi.useRealTimers();
  });

  it('updates after delay expires', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('b');
    vi.useRealTimers();
  });

  it('resets timer on rapid changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    vi.advanceTimersByTime(200);
    rerender({ value: 'c' });
    vi.advanceTimersByTime(200);
    // Only 200ms since last change — should still be 'a'
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
    vi.useRealTimers();
  });

  it('handles zero delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('b');
    vi.useRealTimers();
  });
});
