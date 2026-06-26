/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoGqlModalLockBridge } from './useDemoGqlModalLockBridge';

describe('useDemoGqlModalLockBridge', () => {
  it('closes env modal when env becomes locked', () => {
    const setEnvModalOpen = vi.fn();
    const setProfileModalOpen = vi.fn();

    renderHook(() => useDemoGqlModalLockBridge({
      envModalOpen: true,
      profileModalOpen: false,
      setEnvModalOpen,
      setProfileModalOpen,
    }));

    act(() => {
      (window as unknown as Record<string, unknown>).__demoSetGqlModalLock?.({
        envAllowed: false,
        profileAllowed: false,
      });
    });

    expect(setEnvModalOpen).toHaveBeenCalledWith(false);
  });

  it('defaults to allowing both modals', () => {
    const { result } = renderHook(() => useDemoGqlModalLockBridge({
      envModalOpen: false,
      profileModalOpen: false,
      setEnvModalOpen: vi.fn(),
      setProfileModalOpen: vi.fn(),
    }));

    expect(result.current).toEqual({ envAllowed: true, profileAllowed: true });
  });
});
