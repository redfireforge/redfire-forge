/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoGqlModalLockBridge, resetGqlModalLockHostForTests } from './useDemoGqlModalLockBridge';
import { publishGqlModalLock } from '../utils/gqlModalLockHost';

describe('useDemoGqlModalLockBridge', () => {
  beforeEach(() => {
    resetGqlModalLockHostForTests();
    delete (window as unknown as Record<string, unknown>).__demoGqlModalLockState;
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal;
  });

  it('does not close env modal when demo publishes a restrictive lock', () => {
    const setEnvModalOpen = vi.fn();
    const setProfileModalOpen = vi.fn();

    renderHook(() => useDemoGqlModalLockBridge({
      envModalOpen: true,
      profileModalOpen: false,
      setEnvModalOpen,
      setProfileModalOpen,
    }));

    act(() => {
      publishGqlModalLock({ envAllowed: false, profileAllowed: false });
    });

    expect(setEnvModalOpen).not.toHaveBeenCalledWith(false);
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

  it('never disables env or profiles even when demo lock requests it', () => {
    const { result } = renderHook(() => useDemoGqlModalLockBridge({
      envModalOpen: false,
      profileModalOpen: false,
      setEnvModalOpen: vi.fn(),
      setProfileModalOpen: vi.fn(),
    }));

    act(() => {
      publishGqlModalLock({ envAllowed: false, profileAllowed: false });
    });

    expect(result.current).toEqual({ envAllowed: true, profileAllowed: true });
  });

  it('replays persisted lock state when the bridge mounts after sync', () => {
    publishGqlModalLock({ envAllowed: false, profileAllowed: false });

    const { result } = renderHook(() => useDemoGqlModalLockBridge({
      envModalOpen: false,
      profileModalOpen: false,
      setEnvModalOpen: vi.fn(),
      setProfileModalOpen: vi.fn(),
    }));

    expect(result.current).toEqual({ envAllowed: true, profileAllowed: true });
  });

  it('opens profile modal via demo bridge', () => {
    const setProfileModalOpen = vi.fn();

    renderHook(() => useDemoGqlModalLockBridge({
      envModalOpen: false,
      profileModalOpen: false,
      setEnvModalOpen: vi.fn(),
      setProfileModalOpen,
    }));

    act(() => {
      expect(
        (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal?.(),
      ).toBe(true);
    });

    expect(setProfileModalOpen).toHaveBeenCalledWith(true);
  });
});
