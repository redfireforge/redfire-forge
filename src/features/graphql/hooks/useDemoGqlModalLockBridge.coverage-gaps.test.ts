/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../utils/gqlModalLockHost');
});

describe('useDemoGqlModalLockBridge coverage gaps', () => {
  it('closes env/profile modals when restrictive lock snapshot is observed', async () => {
    const subscribe = vi.fn(() => vi.fn());
    const restrictiveLock = { envAllowed: false, profileAllowed: false };
    const getSnapshot = vi.fn(() => restrictiveLock);

    vi.doMock('../utils/gqlModalLockHost', () => ({
      subscribeGqlModalLock: subscribe,
      getGqlModalLockSnapshot: getSnapshot,
      resetGqlModalLockHostForTests: vi.fn(),
    }));

    const { useDemoGqlModalLockBridge } = await import('./useDemoGqlModalLockBridge');

    const setEnvModalOpen = vi.fn();
    const setProfileModalOpen = vi.fn();

    renderHook(() =>
      useDemoGqlModalLockBridge({
        envModalOpen: true,
        profileModalOpen: true,
        setEnvModalOpen,
        setProfileModalOpen,
      }),
    );

    expect(subscribe).toHaveBeenCalled();
    expect(getSnapshot).toHaveBeenCalled();
    expect(setEnvModalOpen).toHaveBeenCalledWith(false);
    expect(setProfileModalOpen).toHaveBeenCalledWith(false);
  });

  it('closes only env modal when env is disallowed', async () => {
    const subscribe = vi.fn(() => vi.fn());
    const envOnlyLock = { envAllowed: false, profileAllowed: true };
    const getSnapshot = vi.fn(() => envOnlyLock);

    vi.doMock('../utils/gqlModalLockHost', () => ({
      subscribeGqlModalLock: subscribe,
      getGqlModalLockSnapshot: getSnapshot,
      resetGqlModalLockHostForTests: vi.fn(),
    }));

    const { useDemoGqlModalLockBridge } = await import('./useDemoGqlModalLockBridge');
    const setEnvModalOpen = vi.fn();
    const setProfileModalOpen = vi.fn();

    renderHook(() =>
      useDemoGqlModalLockBridge({
        envModalOpen: true,
        profileModalOpen: false,
        setEnvModalOpen,
        setProfileModalOpen,
      }),
    );

    expect(setEnvModalOpen).toHaveBeenCalledWith(false);
    expect(setProfileModalOpen).not.toHaveBeenCalled();
  });

  it('closes only profile modal when profile is disallowed', async () => {
    const subscribe = vi.fn(() => vi.fn());
    const profileOnlyLock = { envAllowed: true, profileAllowed: false };
    const getSnapshot = vi.fn(() => profileOnlyLock);

    vi.doMock('../utils/gqlModalLockHost', () => ({
      subscribeGqlModalLock: subscribe,
      getGqlModalLockSnapshot: getSnapshot,
      resetGqlModalLockHostForTests: vi.fn(),
    }));

    const { useDemoGqlModalLockBridge } = await import('./useDemoGqlModalLockBridge');
    const setEnvModalOpen = vi.fn();
    const setProfileModalOpen = vi.fn();

    renderHook(() =>
      useDemoGqlModalLockBridge({
        envModalOpen: false,
        profileModalOpen: true,
        setEnvModalOpen,
        setProfileModalOpen,
      }),
    );

    expect(setProfileModalOpen).toHaveBeenCalledWith(false);
    expect(setEnvModalOpen).not.toHaveBeenCalled();
  });

  it('unmount removes demo profile opener bridge', async () => {
    const openLock = { envAllowed: true, profileAllowed: true };
    vi.doMock('../utils/gqlModalLockHost', () => ({
      subscribeGqlModalLock: vi.fn(() => vi.fn()),
      getGqlModalLockSnapshot: vi.fn(() => openLock),
      resetGqlModalLockHostForTests: vi.fn(),
    }));

    const { useDemoGqlModalLockBridge } = await import('./useDemoGqlModalLockBridge');
    const { unmount } = renderHook(() =>
      useDemoGqlModalLockBridge({
        envModalOpen: false,
        profileModalOpen: false,
        setEnvModalOpen: vi.fn(),
        setProfileModalOpen: vi.fn(),
      }),
    );

    expect((window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal).toBeTypeOf('function');
    unmount();
    expect((window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal).toBeUndefined();
  });
});
