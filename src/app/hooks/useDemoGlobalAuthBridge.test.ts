/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { GlobalAuthProfile } from '../../shared/types';
import { saveGlobalAuthProfiles } from '../../shared/utils/storage';
import { useDemoGlobalAuthBridge } from './useDemoGlobalAuthBridge';

vi.mock('../../shared/utils/storage', () => ({
  saveGlobalAuthProfiles: vi.fn(() => Promise.resolve()),
}));

const profile = (id: string, name: string): GlobalAuthProfile => ({
  id,
  name,
  auth: { type: 'bearer', token: 't' },
});

describe('useDemoGlobalAuthBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    vi.clearAllMocks();
  });

  it('exposes __demoUpsertGlobalAuthProfile on window', () => {
    const setProfiles = vi.fn();
    renderHook(() => useDemoGlobalAuthBridge(setProfiles));
    expect((window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile).toBeTypeOf('function');
  });

  it('appends profile when id is new and persists to storage', () => {
    let state: GlobalAuthProfile[] = [];
    const setProfiles = vi.fn((updater: React.SetStateAction<GlobalAuthProfile[]>) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });
    renderHook(() => useDemoGlobalAuthBridge(setProfiles));

    const fn = (window as unknown as Record<string, (p: GlobalAuthProfile) => void>)
      .__demoUpsertGlobalAuthProfile;
    fn(profile('p1', 'Demo'));

    expect(state).toEqual([profile('p1', 'Demo')]);
    expect(saveGlobalAuthProfiles).toHaveBeenCalledWith([profile('p1', 'Demo')]);
  });

  it('replaces profile when id already exists', () => {
    let state: GlobalAuthProfile[] = [profile('p1', 'Old')];
    const setProfiles = vi.fn((updater: React.SetStateAction<GlobalAuthProfile[]>) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });
    renderHook(() => useDemoGlobalAuthBridge(setProfiles));

    const fn = (window as unknown as Record<string, (p: GlobalAuthProfile) => void>)
      .__demoUpsertGlobalAuthProfile;
    fn(profile('p1', 'Updated'));

    expect(state).toEqual([profile('p1', 'Updated')]);
    expect(saveGlobalAuthProfiles).toHaveBeenCalledWith([profile('p1', 'Updated')]);
  });

  it('cleans up on unmount', () => {
    const setProfiles = vi.fn();
    const { unmount } = renderHook(() => useDemoGlobalAuthBridge(setProfiles));
    expect((window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile).toBeUndefined();
  });
});
