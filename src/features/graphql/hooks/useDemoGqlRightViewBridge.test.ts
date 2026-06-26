/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useDemoGqlRightViewBridge } from './useDemoGqlRightViewBridge';

describe('useDemoGqlRightViewBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoSetGqlRightView;
  });

  it('mounts __demoSetGqlRightView and forwards to setRightView', () => {
    const setRightView = vi.fn();
    const { unmount } = renderHook(() => useDemoGqlRightViewBridge({ setRightView }));

    const w = window as unknown as { __demoSetGqlRightView?: (view: 'response' | 'schema') => void };
    expect(typeof w.__demoSetGqlRightView).toBe('function');

    w.__demoSetGqlRightView?.('schema');
    expect(setRightView).toHaveBeenCalledWith('schema');

    unmount();
    expect(w.__demoSetGqlRightView).toBeUndefined();
  });
});
