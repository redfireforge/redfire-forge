/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { resetGrpcStudioHintsForTests, useGrpcStudioHints } from './useGrpcStudioHints';

describe('useGrpcStudioHints (Phase 4G)', () => {
  beforeEach(() => {
    resetGrpcStudioHintsForTests();
  });

  it('starts with no dismissed hints', () => {
    const { result } = renderHook(() => useGrpcStudioHints());
    expect(result.current.isDismissed('spring_health_actuator')).toBe(false);
  });

  it('dismisses and persists a hint', () => {
    const { result } = renderHook(() => useGrpcStudioHints());
    act(() => {
      result.current.dismiss('spring_permission_denied');
    });
    expect(result.current.isDismissed('spring_permission_denied')).toBe(true);

    const { result: reloaded } = renderHook(() => useGrpcStudioHints());
    expect(reloaded.current.isDismissed('spring_permission_denied')).toBe(true);
  });
});
