/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
});
