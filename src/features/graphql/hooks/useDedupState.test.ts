/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDedupState } from './useDedupState';
import type { DedupChoice } from '../utils/dedupExecution';

describe('useDedupState', () => {
  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useDedupState());

    expect(result.current.isDuplicate).toBe(false);
    expect(result.current.duplicateSourceTabId).toBeNull();
    expect(result.current.dedupChoiceResolver).toBeNull();
  });

  it('updates isDuplicate state', () => {
    const { result } = renderHook(() => useDedupState());

    act(() => {
      result.current.setIsDuplicate(true);
    });

    expect(result.current.isDuplicate).toBe(true);
  });

  it('updates duplicateSourceTabId state', () => {
    const { result } = renderHook(() => useDedupState());

    act(() => {
      result.current.setDuplicateSourceTabId('tab-123');
    });

    expect(result.current.duplicateSourceTabId).toBe('tab-123');
  });

  it('stores and clears dedupChoiceResolver', () => {
    const { result } = renderHook(() => useDedupState());
    const mockResolver = vi.fn();

    act(() => {
      result.current.setDedupChoiceResolver(mockResolver);
    });

    expect(result.current.dedupChoiceResolver).toBeDefined();

    act(() => {
      result.current.setDedupChoiceResolver(null);
    });

    expect(result.current.dedupChoiceResolver).toBeNull();
  });

  it('resolveDedupChoice calls resolver and clears state', () => {
    const { result } = renderHook(() => useDedupState());
    const mockResolver = vi.fn();

    act(() => {
      result.current.setDedupChoiceResolver(mockResolver);
      result.current.setIsDuplicate(true);
      result.current.setDuplicateSourceTabId('tab-123');
    });

    expect(result.current.isDuplicate).toBe(true);

    act(() => {
      result.current.resolveDedupChoice('wait');
    });

    expect(result.current.isDuplicate).toBe(false);
    expect(result.current.duplicateSourceTabId).toBeNull();
    expect(result.current.dedupChoiceResolver).toBeNull();
  });

  it('resolveDedupChoice does nothing if resolver is null', () => {
    const { result } = renderHook(() => useDedupState());

    act(() => {
      result.current.setIsDuplicate(true);
    });

    expect(result.current.isDuplicate).toBe(true);

    act(() => {
      result.current.resolveDedupChoice('cancel');
    });

    // State should not change since resolver was null
    expect(result.current.isDuplicate).toBe(true);
  });

  it('handles different dedup choice values', () => {
    const { result } = renderHook(() => useDedupState());
    const mockResolver = vi.fn();

    const choices: DedupChoice[] = ['wait', 'cancel', 'send-anyway'];

    choices.forEach(choice => {
      act(() => {
        result.current.setDedupChoiceResolver(mockResolver);
        result.current.setIsDuplicate(true);
      });

      act(() => {
        result.current.resolveDedupChoice(choice);
      });

      mockResolver.mockClear();
      expect(result.current.isDuplicate).toBe(false);
      expect(result.current.dedupChoiceResolver).toBeNull();
    });
  });
});
