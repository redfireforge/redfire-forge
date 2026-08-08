/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoGqlAuthBridge } from './useDemoGqlAuthBridge';

describe('useDemoGqlAuthBridge', () => {
  afterEach(() => {
    delete (window as unknown as { __demoClearActiveTabAuth?: unknown }).__demoClearActiveTabAuth;
  });

  it('exposes __demoClearActiveTabAuth and clears on call', () => {
    const clearActiveTabAuth = vi.fn();
    const { unmount } = renderHook(() => useDemoGqlAuthBridge({ clearActiveTabAuth }));
    const w = window as unknown as { __demoClearActiveTabAuth?: () => boolean };
    expect(w.__demoClearActiveTabAuth?.()).toBe(true);
    expect(clearActiveTabAuth).toHaveBeenCalledTimes(1);
    unmount();
    expect(w.__demoClearActiveTabAuth).toBeUndefined();
  });
});
