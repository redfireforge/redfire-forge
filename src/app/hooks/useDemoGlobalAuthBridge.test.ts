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
    delete (window as unknown as Record<string, unknown>).__demoPurgeGlobalAuthProfiles;
    resetAllMocks();
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

  it('removes duplicate name when upserting canonical demo profile', () => {
    let state: GlobalAuthProfile[] = [profile('duplicate-id', 'Lesson 6 Bearer')];
    const setProfiles = vi.fn((updater: React.SetStateAction<GlobalAuthProfile[]>) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });
    renderHook(() => useDemoGlobalAuthBridge(setProfiles));

    const fn = (window as unknown as Record<string, (p: GlobalAuthProfile) => void>)
      .__demoUpsertGlobalAuthProfile;
    fn(profile('lesson6-gql-profile', 'Lesson 6 Bearer'));

    expect(state).toEqual([profile('lesson6-gql-profile', 'Lesson 6 Bearer')]);
  });

  it('purges profiles by name and id via bridge', () => {
    let state: GlobalAuthProfile[] = [
      profile('lesson6-gql-profile', 'Lesson 6 Bearer'),
      profile('duplicate-id', 'Lesson 6 Bearer'),
      profile('keep', 'Prod OAuth'),
    ];
    const setProfiles = vi.fn((updater: React.SetStateAction<GlobalAuthProfile[]>) => {
      state = typeof updater === 'function' ? updater(state) : updater;
    });
    renderHook(() => useDemoGlobalAuthBridge(setProfiles));

    const fn = (window as unknown as Record<string, (names: string[], ids: string[]) => void>)
      .__demoPurgeGlobalAuthProfiles;
    fn(['Lesson 6 Bearer'], ['lesson6-gql-profile']);

    expect(state).toEqual([profile('keep', 'Prod OAuth')]);
  });

  it('cleans up on unmount', () => {
    const setProfiles = vi.fn();
    const { unmount } = renderHook(() => useDemoGlobalAuthBridge(setProfiles));
    expect((window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile).toBeUndefined();
  });
});
