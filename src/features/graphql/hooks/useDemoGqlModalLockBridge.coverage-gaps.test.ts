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
});
