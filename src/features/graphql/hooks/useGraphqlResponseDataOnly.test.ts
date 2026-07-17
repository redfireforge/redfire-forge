/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  GQL_RV_DATA_ONLY_STORAGE_KEY,
  useGraphqlResponseDataOnly,
} from './useGraphqlResponseDataOnly';

describe('useGraphqlResponseDataOnly', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to false when storage is empty', () => {
    const { result } = renderHook(() => useGraphqlResponseDataOnly());
    expect(result.current.dataOnly).toBe(false);
  });

  it('reads persisted true from localStorage', () => {
    localStorage.setItem(GQL_RV_DATA_ONLY_STORAGE_KEY, 'true');
    const { result } = renderHook(() => useGraphqlResponseDataOnly());
    expect(result.current.dataOnly).toBe(true);
  });

  it('persists toggle changes', () => {
    const { result } = renderHook(() => useGraphqlResponseDataOnly());
    act(() => result.current.setDataOnly(true));
    expect(result.current.dataOnly).toBe(true);
    expect(localStorage.getItem(GQL_RV_DATA_ONLY_STORAGE_KEY)).toBe('true');
  });
});
