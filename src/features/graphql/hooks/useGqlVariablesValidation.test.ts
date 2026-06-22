/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGqlVariablesValidation } from './useGqlVariablesValidation';

describe('useGqlVariablesValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts empty variables', () => {
    const { result } = renderHook(() => useGqlVariablesValidation('', 'tab-1'));
    expect(result.current).toBeNull();
  });

  it('accepts empty object variables', () => {
    const { result } = renderHook(() => useGqlVariablesValidation('{}', 'tab-1'));
    expect(result.current).toBeNull();
  });

  it('clears prior error immediately when switching to a valid tab', () => {
    const { result, rerender } = renderHook(
      ({ vars, tabId }) => useGqlVariablesValidation(vars, tabId),
      { initialProps: { vars: '{bad', tabId: 'tab-1' } },
    );
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ vars: '{}', tabId: 'tab-2' });
    expect(result.current).toBeNull();
  });

  it('accepts valid non-empty object variables', () => {
    const { result, rerender } = renderHook(
      ({ vars, tabId }) => useGqlVariablesValidation(vars, tabId),
      { initialProps: { vars: '{"id":"1"}', tabId: 'tab-1' } },
    );
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ vars: '{"id":"1"}', tabId: 'tab-1' });
    expect(result.current).toBeNull();
  });

  it('treats whitespace-only variables as empty', () => {
    const { result, rerender } = renderHook(
      ({ vars, tabId }) => useGqlVariablesValidation(vars, tabId),
      { initialProps: { vars: '   ', tabId: 'tab-1' } },
    );
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ vars: '   ', tabId: 'tab-1' });
    expect(result.current).toBeNull();
  });

  it('flags null JSON values after debounce', () => {
    const { result, rerender } = renderHook(
      ({ vars, tabId }) => useGqlVariablesValidation(vars, tabId),
      { initialProps: { vars: 'null', tabId: 'tab-1' } },
    );
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ vars: 'null', tabId: 'tab-1' });
    expect(result.current).toContain('JSON object');
  });

  it('flags array JSON values', () => {
    const { result, rerender } = renderHook(
      ({ vars, tabId }) => useGqlVariablesValidation(vars, tabId),
      { initialProps: { vars: '[1]', tabId: 'tab-1' } },
    );
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ vars: '[1]', tabId: 'tab-1' });
    expect(result.current).toContain('JSON object');
  });

  it('flags invalid JSON after debounce', () => {
    const { result, rerender } = renderHook(
      ({ vars, tabId }) => useGqlVariablesValidation(vars, tabId),
      { initialProps: { vars: '{bad', tabId: 'tab-1' } },
    );
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ vars: '{bad', tabId: 'tab-1' });
    expect(result.current).toBe('Invalid JSON');
  });

  it('validates immediately on tab switch', () => {
    const { result, rerender } = renderHook(
      ({ vars, tabId }) => useGqlVariablesValidation(vars, tabId),
      { initialProps: { vars: '[1,2]', tabId: 'tab-1' } },
    );
    rerender({ vars: '[1,2]', tabId: 'tab-2' });
    expect(result.current).toBe('Variables must be a JSON object — e.g. {"id": "1"}');
  });
});
