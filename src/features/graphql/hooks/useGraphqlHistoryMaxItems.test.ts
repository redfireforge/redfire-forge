/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlHistoryMaxItems } from './useGraphqlHistoryMaxItems';

describe('useGraphqlHistoryMaxItems', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to 100 when storage is empty', () => {
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    expect(result.current.historyMaxItems).toBe(100);
  });

  it('reads persisted value within bounds', () => {
    localStorage.setItem('gql_history_max_items', '250');
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    expect(result.current.historyMaxItems).toBe(250);
  });

  it('persists changes on update', () => {
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    act(() => result.current.handleHistoryMaxItemsChange(75));
    expect(result.current.historyMaxItems).toBe(75);
    expect(localStorage.getItem('gql_history_max_items')).toBe('75');
  });

  it('clamps stored value to minimum 10', () => {
    localStorage.setItem('gql_history_max_items', '3');
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    expect(result.current.historyMaxItems).toBe(10);
  });

  it('clamps stored value to maximum 500', () => {
    localStorage.setItem('gql_history_max_items', '999');
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    expect(result.current.historyMaxItems).toBe(500);
  });

  it('swallows localStorage.setItem errors silently', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    expect(() => act(() => result.current.handleHistoryMaxItemsChange(200))).not.toThrow();
    spy.mockRestore();
  });

  it('swallows localStorage.getItem errors and defaults to 100', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    expect(result.current.historyMaxItems).toBe(100);
    spy.mockRestore();
  });

  it('falls back to 100 when stored value is not a valid number', () => {
    localStorage.setItem('gql_history_max_items', 'not-a-number');
    const { result } = renderHook(() => useGraphqlHistoryMaxItems());
    expect(result.current.historyMaxItems).toBe(100);
  });
});
