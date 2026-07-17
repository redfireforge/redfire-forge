/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { resetGrpcStudioHintsForTests, useGrpcStudioHints } from './useGrpcStudioHints';

describe('useGrpcStudioHints coverage gaps', () => {
  beforeEach(() => {
    resetGrpcStudioHintsForTests();
  });

  it('dismiss is idempotent for the same hint id', () => {
    const { result } = renderHook(() => useGrpcStudioHints());
    act(() => {
      result.current.dismiss('spring_health_actuator');
      result.current.dismiss('spring_health_actuator');
    });
    expect(result.current.isDismissed('spring_health_actuator')).toBe(true);
    expect(result.current.isDismissed('spring_permission_denied')).toBe(false);
  });

  it('resetGrpcStudioHintsForTests is safe when localStorage is unavailable', async () => {
    const original = globalThis.localStorage;
    // @ts-expect-error simulate non-browser runtime
    delete globalThis.localStorage;
    expect(() => resetGrpcStudioHintsForTests()).not.toThrow();
    globalThis.localStorage = original;
  });
});
