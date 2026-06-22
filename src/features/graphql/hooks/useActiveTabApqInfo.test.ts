/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useActiveTabApqInfo } from './useActiveTabApqInfo';
import type { TabExecutionSnapshot } from './useGqlTabResponseCache';

describe('useActiveTabApqInfo', () => {
  it('returns cached apqInfo for active tab when another tab is executing', () => {
    const executingTabIdRef = { current: 'tab-2' };
    const cache = new Map<string, TabExecutionSnapshot>([
      ['tab-1', {
        status: 'success',
        response: null,
        apqInfo: { hash: 'cached', cacheHit: true, unsupported: false },
      }],
    ]);

    const { result } = renderHook(() =>
      useActiveTabApqInfo('tab-1', executingTabIdRef, { hash: 'live', cacheHit: false, unsupported: false }, cache, 'success'),
    );

    expect(result.current?.hash).toBe('cached');
  });

  it('returns live apqInfo when active tab owns execution', () => {
    const executingTabIdRef = { current: 'tab-1' };
    const live = { hash: 'live', cacheHit: false, unsupported: false };

    const { result } = renderHook(() =>
      useActiveTabApqInfo('tab-1', executingTabIdRef, live, new Map(), 'loading'),
    );

    expect(result.current).toBe(live);
  });
});
