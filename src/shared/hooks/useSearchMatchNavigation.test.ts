/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchMatchNavigation } from './useSearchMatchNavigation';

describe('useSearchMatchNavigation', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useSearchMatchNavigation(0));
    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentMatchIndex).toBe(0);
  });

  it('setSearchQuery updates query and resets index', () => {
    const { result } = renderHook(() => useSearchMatchNavigation(5));
    act(() => result.current.goNext());
    expect(result.current.currentMatchIndex).toBe(1);

    act(() => result.current.setSearchQuery('foo'));
    expect(result.current.searchQuery).toBe('foo');
    expect(result.current.currentMatchIndex).toBe(0);
  });

  it('goNext wraps around', () => {
    const { result } = renderHook(() => useSearchMatchNavigation(3));
    act(() => result.current.goNext());
    expect(result.current.currentMatchIndex).toBe(1);
    act(() => result.current.goNext());
    expect(result.current.currentMatchIndex).toBe(2);
    act(() => result.current.goNext());
    expect(result.current.currentMatchIndex).toBe(0);
  });

  it('goPrev wraps around', () => {
    const { result } = renderHook(() => useSearchMatchNavigation(3));
    act(() => result.current.goPrev());
    expect(result.current.currentMatchIndex).toBe(2);
    act(() => result.current.goPrev());
    expect(result.current.currentMatchIndex).toBe(1);
    act(() => result.current.goPrev());
    expect(result.current.currentMatchIndex).toBe(0);
  });

  it('goNext/goPrev do nothing when matchCount is 0', () => {
    const { result } = renderHook(() => useSearchMatchNavigation(0));
    act(() => result.current.goNext());
    expect(result.current.currentMatchIndex).toBe(0);
    act(() => result.current.goPrev());
    expect(result.current.currentMatchIndex).toBe(0);
  });

  it('clear resets query and index', () => {
    const { result } = renderHook(() => useSearchMatchNavigation(5));
    act(() => {
      result.current.setSearchQuery('test');
      result.current.goNext();
    });
    act(() => result.current.clear());
    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentMatchIndex).toBe(0);
  });

  it('clamps index when matchCount shrinks', () => {
    const { result, rerender } = renderHook(
      ({ count }) => useSearchMatchNavigation(count),
      { initialProps: { count: 5 } },
    );
    act(() => {
      result.current.goNext();
      result.current.goNext();
      result.current.goNext();
    });
    expect(result.current.currentMatchIndex).toBe(3);

    rerender({ count: 2 });
    expect(result.current.currentMatchIndex).toBe(1);
  });

  it('does not clamp when index is within range after shrink', () => {
    const { result, rerender } = renderHook(
      ({ count }) => useSearchMatchNavigation(count),
      { initialProps: { count: 10 } },
    );
    act(() => result.current.goNext());
    expect(result.current.currentMatchIndex).toBe(1);

    rerender({ count: 5 });
    expect(result.current.currentMatchIndex).toBe(1);
  });

  it('setCurrentMatchIndex is exposed for external use', () => {
    const { result } = renderHook(() => useSearchMatchNavigation(10));
    act(() => result.current.setCurrentMatchIndex(7));
    expect(result.current.currentMatchIndex).toBe(7);
  });
});
