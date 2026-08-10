/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const onStorageFull = vi.fn(() => vi.fn());
const cleanupStaleStorageKeys = vi.fn();
const ensureBrowserLargeDataMigrated = vi.fn(() => Promise.resolve());
const readKey = vi.fn(() => Promise.resolve(null));
const setLastProtocolsTab = vi.fn();

vi.mock('../../shared/utils/storage', () => ({
  onStorageFull: (...args: unknown[]) => onStorageFull(...args),
  cleanupStaleStorageKeys: (...args: unknown[]) => cleanupStaleStorageKeys(...args),
  ensureBrowserLargeDataMigrated: (...args: unknown[]) => ensureBrowserLargeDataMigrated(...args),
  readKey: (...args: unknown[]) => readKey(...args),
}));

vi.mock('../utils/appTabUtils', () => ({
  isProtocolsTab: (tab: string) => tab === 'protocols',
  setLastProtocolsTab: (...args: unknown[]) => setLastProtocolsTab(...args),
  LAST_PROTOCOLS_TAB_STORAGE_KEY: 'last-protocols-tab',
}));

vi.mock('../../config/features', () => ({
  DEMO_HUB_ENABLED: true,
}));

const show = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('useAppStartupEffects demo cleanup', () => {
  it('keeps best-effort migration failures from surfacing', async () => {
    ensureBrowserLargeDataMigrated.mockRejectedValueOnce(new Error('migration failed'));

    vi.doMock('@redfireforge/demo-hub/demoLiveSession', () => ({
      hasRestorableDemoLiveSession: () => false,
    }));
    vi.doMock('@redfireforge/demo-hub/lessons/gql-demo-storage-cleanup', () => ({
      purgeGqlDemoEphemeralStorage: vi.fn(() => Promise.reject(new Error('purge failed'))),
    }));

    const { useAppStartupEffects } = await import('./useAppStartupEffects');

    renderHook(() => {
      useAppStartupEffects({
        loading: false,
        wb: { loaded: true, data: { environments: [] }, reconcileEnvironmentKeys: vi.fn(() => []) } as never,
        environments: [],
        toast: { show } as never,
        initialTheme: 'light',
        setTheme: vi.fn(),
        activeTab: 'requests',
        setActiveTab: vi.fn(),
      });
    });

    expect(cleanupStaleStorageKeys).toHaveBeenCalled();
    expect(ensureBrowserLargeDataMigrated).toHaveBeenCalled();
    await act(async () => Promise.resolve());
  });

  it('swallows demo-hub import failures', async () => {
    vi.doMock('@redfireforge/demo-hub/demoLiveSession', () => {
      throw new Error('demo import failed');
    });

    const { useAppStartupEffects } = await import('./useAppStartupEffects');

    renderHook(() => {
      useAppStartupEffects({
        loading: false,
        wb: { loaded: true, data: { environments: [] }, reconcileEnvironmentKeys: vi.fn(() => []) } as never,
        environments: [],
        toast: { show } as never,
        initialTheme: 'light',
        setTheme: vi.fn(),
        activeTab: 'requests',
        setActiveTab: vi.fn(),
      });
    });

    await act(async () => Promise.resolve());
    expect(cleanupStaleStorageKeys).toHaveBeenCalled();
  });
});