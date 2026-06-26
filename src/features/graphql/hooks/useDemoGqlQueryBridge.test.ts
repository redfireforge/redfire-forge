/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useDemoGqlQueryBridge } from './useDemoGqlQueryBridge';

describe('useDemoGqlQueryBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoSetGqlQuery;
  });

  it('registers and unregisters __demoSetGqlQuery on window', () => {
    const setGqlQuery = vi.fn();
    const { unmount } = renderHook(() => useDemoGqlQueryBridge({ setGqlQuery }));

    const bridge = (window as unknown as Record<string, unknown>).__demoSetGqlQuery as
      | ((query: string) => void)
      | undefined;
    expect(bridge).toBeTypeOf('function');

    bridge?.('query { health }');
    expect(setGqlQuery).toHaveBeenCalledWith('query { health }');

    unmount();
    expect((window as unknown as Record<string, unknown>).__demoSetGqlQuery).toBeUndefined();
  });
});
