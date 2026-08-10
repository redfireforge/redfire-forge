/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStartupEffects } from './useAppStartupEffects';

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
  DEMO_HUB_ENABLED: false,
}));

const show = vi.fn();

function createWb(overrides: Partial<{ loaded: boolean; data: { environments?: { id: string; name: string }[] }; reconcileEnvironmentKeys: (envs: { id: string; name: string }[]) => string[] }> = {}) {
  return {
    loaded: true,
    data: { environments: [] },
    reconcileEnvironmentKeys: vi.fn(() => []),
    ...overrides,
  };
}

describe('useAppStartupEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles legacy environments once settings envs are available', async () => {
    const wb = createWb({ data: { environments: [{ id: 'legacy-1', name: 'Legacy' }] }, reconcileEnvironmentKeys: vi.fn(() => ['Legacy']) });
    const setTheme = vi.fn();
    const setActiveTab = vi.fn();

    const { rerender } = renderHook((props: { loading: boolean; environments: { id: string; name: string }[]; activeTab: 'requests' | 'demo-hub' }) => {
      useAppStartupEffects({
        loading: props.loading,
        wb: wb as never,
        environments: props.environments,
        toast: { show } as never,
        initialTheme: 'light',
        setTheme,
        activeTab: props.activeTab,
        setActiveTab,
      });
    }, { initialProps: { loading: true, environments: [], activeTab: 'requests' } });

    rerender({ loading: false, environments: [], activeTab: 'requests' });
    rerender({ loading: false, environments: [{ id: 'env-1', name: 'Legacy' }], activeTab: 'requests' });

    expect((wb.reconcileEnvironmentKeys as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(show).toHaveBeenCalledWith('info', 'Environments updated', expect.stringContaining('Dropped 1 unmatched'));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('skips reconciliation when no legacy environments exist and redirects demo hub tabs', async () => {
    const wb = createWb({ data: { environments: [] } });
    const setTheme = vi.fn();
    const setActiveTab = vi.fn();

    renderHook(() => {
      useAppStartupEffects({
        loading: false,
        wb: wb as never,
        environments: [{ id: 'env-1', name: 'Dev' }],
        toast: { show } as never,
        initialTheme: 'dark',
        setTheme,
        activeTab: 'demo-hub',
        setActiveTab,
      });
    });

    expect((wb.reconcileEnvironmentKeys as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(setActiveTab).toHaveBeenCalledWith('requests');
  });

  it('treats missing legacy environments as an empty migration state', async () => {
    const wb = createWb({ data: {} as { environments?: { id: string; name: string }[] } });

    renderHook(() => {
      useAppStartupEffects({
        loading: false,
        wb: wb as never,
        environments: [{ id: 'env-1', name: 'Dev' }],
        toast: { show } as never,
        initialTheme: 'light',
        setTheme: vi.fn(),
        activeTab: 'requests',
        setActiveTab: vi.fn(),
      });
    });

    expect((wb.reconcileEnvironmentKeys as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('registers the storage-full handler and restores the last protocols tab', async () => {
    readKey.mockResolvedValueOnce('protocols');

    renderHook(() => {
      useAppStartupEffects({
        loading: false,
        wb: createWb() as never,
        environments: [],
        toast: { show } as never,
        initialTheme: 'light',
        setTheme: vi.fn(),
        activeTab: 'requests',
        setActiveTab: vi.fn(),
      });
    });

    expect(onStorageFull).toHaveBeenCalled();
    expect(cleanupStaleStorageKeys).toHaveBeenCalled();
    expect(ensureBrowserLargeDataMigrated).toHaveBeenCalled();
    await act(async () => Promise.resolve());
    expect(setLastProtocolsTab).toHaveBeenCalledWith('protocols');
  });
});