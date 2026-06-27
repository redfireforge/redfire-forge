/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGqlTabExecutionRegistry } from './useGqlTabExecutionRegistry';
import type { GqlTabExecutionHandle } from '../types/gqlTabExecution';

function makeHandle(overrides: Partial<GqlTabExecutionHandle> = {}): GqlTabExecutionHandle {
  return {
    execute: vi.fn(),
    cancel: vi.fn(),
    resolveDedupChoice: vi.fn(),
    applyResult: vi.fn(),
    getState: () => ({
      status: 'idle',
      response: null,
      apqInfo: null,
      isDuplicate: false,
      duplicateSourceTabId: null,
    }),
    ...overrides,
  };
}

describe('useGqlTabExecutionRegistry', () => {
  it('returns null for unregistered tab', () => {
    const { result } = renderHook(() => useGqlTabExecutionRegistry());
    expect(result.current.getHandle('missing')).toBeNull();
  });

  it('register bumps version only when handle identity changes', () => {
    const { result } = renderHook(() => useGqlTabExecutionRegistry());
    const handleA = makeHandle();
    const handleB = makeHandle();
    const versionBefore = result.current.version;

    act(() => {
      result.current.register('tab-1', handleA);
    });
    expect(result.current.version).toBe(versionBefore + 1);

    act(() => {
      result.current.register('tab-1', handleA);
    });
    expect(result.current.version).toBe(versionBefore + 1);

    act(() => {
      result.current.register('tab-1', handleB);
    });
    expect(result.current.version).toBe(versionBefore + 2);
  });

  it('register + getHandle returns the handle', () => {
    const { result } = renderHook(() => useGqlTabExecutionRegistry());
    const handle = makeHandle();

    act(() => {
      result.current.register('tab-1', handle);
    });

    expect(result.current.getHandle('tab-1')).toBe(handle);
  });

  it('unregister removes handle and bumps version', () => {
    const { result } = renderHook(() => useGqlTabExecutionRegistry());
    const handle = makeHandle();
    const versionBefore = result.current.version;

    act(() => {
      result.current.register('tab-1', handle);
      result.current.unregister('tab-1');
    });

    expect(result.current.getHandle('tab-1')).toBeNull();
    expect(result.current.version).toBeGreaterThan(versionBefore);
  });

  it('notifyStateChange bumps version', () => {
    const { result } = renderHook(() => useGqlTabExecutionRegistry());
    const versionBefore = result.current.version;

    act(() => {
      result.current.notifyStateChange();
    });

    expect(result.current.version).toBe(versionBefore + 1);
  });

  it('unregister is no-op when tab was never registered', () => {
    const { result } = renderHook(() => useGqlTabExecutionRegistry());
    const versionBefore = result.current.version;

    act(() => {
      result.current.unregister('never-registered');
    });

    expect(result.current.version).toBe(versionBefore);
  });
});
