/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVariableInsertModal } from './useVariableInsertModal';

describe('useVariableInsertModal', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useVariableInsertModal());
    expect(result.current.variableInsertOpen).toBe(false);
    expect(result.current.variableInsertShortRef).toBe(false);
    expect(result.current.variableInsertInitialSearch).toBe('');
  });

  it('opens the modal via requestVariableInsert', () => {
    const { result } = renderHook(() => useVariableInsertModal());
    const apply = vi.fn();
    act(() => result.current.requestVariableInsert(apply));
    expect(result.current.variableInsertOpen).toBe(true);
    expect(result.current.variableInsertShortRef).toBe(false);
    expect(result.current.variableInsertInitialSearch).toBe('');
  });

  it('passes shortRef and initialSearch', () => {
    const { result } = renderHook(() => useVariableInsertModal());
    act(() => result.current.requestVariableInsert(vi.fn(), true, 'token'));
    expect(result.current.variableInsertShortRef).toBe(true);
    expect(result.current.variableInsertInitialSearch).toBe('token');
  });

  it('handleVariableInsertPicked calls the apply callback and closes', () => {
    const { result } = renderHook(() => useVariableInsertModal());
    const apply = vi.fn();
    act(() => result.current.requestVariableInsert(apply));
    act(() => result.current.handleVariableInsertPicked('{{myVar}}'));
    expect(apply).toHaveBeenCalledWith('{{myVar}}');
    expect(result.current.variableInsertOpen).toBe(false);
  });

  it('closeVariableInsert closes without calling apply', () => {
    const { result } = renderHook(() => useVariableInsertModal());
    const apply = vi.fn();
    act(() => result.current.requestVariableInsert(apply));
    act(() => result.current.closeVariableInsert());
    expect(result.current.variableInsertOpen).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });

  it('handleVariableInsertPicked invokes default ref noop when apply was never set', () => {
    const { result } = renderHook(() => useVariableInsertModal());
    act(() => result.current.handleVariableInsertPicked('{{orphan}}'));
    expect(result.current.variableInsertOpen).toBe(false);
  });

  it('subsequent requestVariableInsert replaces the apply callback', () => {
    const { result } = renderHook(() => useVariableInsertModal());
    const apply1 = vi.fn();
    const apply2 = vi.fn();
    act(() => result.current.requestVariableInsert(apply1));
    act(() => result.current.requestVariableInsert(apply2, false, 'second'));
    act(() => result.current.handleVariableInsertPicked('val'));
    expect(apply1).not.toHaveBeenCalled();
    expect(apply2).toHaveBeenCalledWith('val');
  });

  it('returns stable callback references', () => {
    const { result, rerender } = renderHook(() => useVariableInsertModal());
    const first = result.current;
    rerender();
    expect(result.current.requestVariableInsert).toBe(first.requestVariableInsert);
    expect(result.current.handleVariableInsertPicked).toBe(first.handleVariableInsertPicked);
    expect(result.current.closeVariableInsert).toBe(first.closeVariableInsert);
  });
});
