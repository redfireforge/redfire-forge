/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppStartupEffects } from './useAppStartupEffects';
import type { UseRequestsReturn } from '../../features/requests/hooks/useRequests';
import type { Tab } from '../utils/appTabUtils';
import { readKey } from '../../shared/utils/storage';
import { setLastProtocolsTab } from '../utils/appTabUtils';

let storageFullListener: ((key: string) => void) | null = null;

vi.mock('../../shared/utils/storage', () => ({
  onStorageFull: vi.fn((listener: (key: string) => void) => {
    storageFullListener = listener;
    return vi.fn();
  }),
  cleanupStaleStorageKeys: vi.fn(),
  ensureBrowserLargeDataMigrated: vi.fn(async () => undefined),
  readKey: vi.fn(async () => 'graphql-studio'),
}));

vi.mock('../../config/features', () => ({
  DEMO_HUB_ENABLED: false,
}));

vi.mock('../utils/appTabUtils', async () => {
  const actual = await vi.importActual<typeof import('../utils/appTabUtils')>('../utils/appTabUtils');
  return {
    ...actual,
    setLastProtocolsTab: vi.fn(),
  };
});

function makeWb(overrides: Partial<UseRequestsReturn> = {}): UseRequestsReturn {
  return {
    loaded: true,
    data: {
      collections: [],
      environments: [],
      ...overrides.data,
    },
    reconcileEnvironmentKeys: vi.fn(() => ['Legacy']),
  } as unknown as UseRequestsReturn;
}

describe('useAppStartupEffects', () => {
  beforeEach(() => {
    storageFullListener = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    storageFullListener = null;
  });

  it('reconciles legacy env keys once settings envs are available', async () => {
    const wb = makeWb({
      data: {
        collections: [],
        environments: [{ id: 'legacy-dev', name: 'Dev' }],
      },
    });
    const toast = { show: vi.fn() } as any;
    const setTheme = vi.fn();
    const setActiveTab = vi.fn();

    renderHook(() => useAppStartupEffects({
      loading: false,
      wb,
      environments: [{ id: 'env-dev', name: 'Dev' }],
      toast,
      initialTheme: 'dark',
      setTheme,
      activeTab: 'requests' as Tab,
      setActiveTab,
    }));

    await act(async () => { await Promise.resolve(); });

    expect((wb.reconcileEnvironmentKeys as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith([
      { id: 'env-dev', name: 'Dev' },
    ]);
    expect(toast.show).toHaveBeenCalledWith(
      'info',
      'Environments updated',
      expect.stringContaining('Dropped 1 unmatched'),
    );
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('marks empty legacy env state as reconciled without calling the reconciler', async () => {
    const wb = makeWb({
      data: {
        collections: [],
        environments: [],
      },
    });
    const toast = { show: vi.fn() } as any;

    const { rerender } = renderHook(({ activeTab }) => useAppStartupEffects({
      loading: false,
      wb,
      environments: [{ id: 'env-dev', name: 'Dev' }],
      toast,
      initialTheme: 'light',
      setTheme: vi.fn(),
      activeTab,
      setActiveTab: vi.fn(),
    }), { initialProps: { activeTab: 'requests' as Tab } });

    await act(async () => { await Promise.resolve(); });
    expect((wb.reconcileEnvironmentKeys as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();

    rerender({ activeTab: 'requests' as Tab });
    await act(async () => { await Promise.resolve(); });
    expect((wb.reconcileEnvironmentKeys as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('redirects away from demo-hub when the feature is disabled', async () => {
    const wb = makeWb();
    const setActiveTab = vi.fn();

    renderHook(() => useAppStartupEffects({
      loading: false,
      wb,
      environments: [],
      toast: { show: vi.fn() } as any,
      initialTheme: 'light',
      setTheme: vi.fn(),
      activeTab: 'demo-hub' as Tab,
      setActiveTab,
    }));

    await act(async () => { await Promise.resolve(); });
    expect(setActiveTab).toHaveBeenCalledWith('requests');
  });

  it('registers storage full handling and restores the last protocols tab', async () => {
    const wb = makeWb();
    const toast = { show: vi.fn() } as any;

    renderHook(() => useAppStartupEffects({
      loading: false,
      wb,
      environments: [],
      toast,
      initialTheme: 'dark',
      setTheme: vi.fn(),
      activeTab: 'requests' as Tab,
      setActiveTab: vi.fn(),
    }));

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(storageFullListener).not.toBeNull();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(10_000).mockReturnValueOnce(12_000);

    storageFullListener?.('rf-test-key');
    storageFullListener?.('rf-test-key');

    expect(toast.show).toHaveBeenCalledTimes(1);
    expect(toast.show).toHaveBeenCalledWith(
      'error',
      'Storage Full',
      expect.stringContaining('rf-test-key'),
    );
    expect(readKey).toHaveBeenCalled();
    expect(setLastProtocolsTab).toHaveBeenCalledWith('graphql-studio');
    nowSpy.mockRestore();
  });
});