/**
 * @vitest-environment jsdom
 *
 * Tests for useGraphqlConnectionSettings hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(async () => null),
  writeKey: vi.fn(async () => {}),
  removeKey: vi.fn(async () => {}),
}));

vi.mock('../utils/tabPersistence', () => ({
  loadAuth: vi.fn(async () => null),
  saveAuth: vi.fn(),
  ENDPOINT_STORAGE_KEY: 'gql_endpoint_v1',
  ENDPOINT_BASE_STORAGE_KEY: 'gql_endpoint_base_v1',
  POLLING_STORAGE_KEY: 'gql_polling_v1',
  TLS_STORAGE_KEY: 'gql_tls_skip_v1',
}));

vi.mock('./useRecentEndpoints', () => ({
  useRecentEndpoints: () => ({
    endpoints: [],
    push: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock('./useGraphqlConnectionProfiles', () => ({
  useGraphqlConnectionProfiles: () => ({
    profiles: [],
    saveProfile: vi.fn(),
    renameProfile: vi.fn(),
    deleteProfile: vi.fn(),
  }),
}));

vi.mock('./useGraphqlEnvironments', () => ({
  useGraphqlEnvironments: () => ({
    environments: [],
    activeEnvironment: null,
    createEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    setActiveEnvironment: vi.fn(),
    updateEnvironmentName: vi.fn(),
    updateVariables: vi.fn(),
    importEnvironment: vi.fn(),
    exportEnvironment: vi.fn(),
  }),
}));

import { useGraphqlConnectionSettings } from './useGraphqlConnectionSettings';
import { readKey, writeKey } from '../../../shared/utils/storage';
import { loadAuth } from '../utils/tabPersistence';

describe('useGraphqlConnectionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes endpoint from resolvedBaseUrl', () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://api.example.com/graphql'),
    );
    expect(result.current.endpoint).toBe('https://api.example.com/graphql');
  });

  it('initializes endpoint as empty string when no resolvedBaseUrl', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.endpoint).toBe('');
  });

  it('initializes historyConnectionId from resolvedBaseUrl', () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://api.example.com'),
    );
    expect(result.current.historyConnectionId).toBe('https://api.example.com');
  });

  it('initializes historyConnectionId as null when no resolvedBaseUrl', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.historyConnectionId).toBeNull();
  });

  it('handleSkipTlsVerifyChange updates state and persists', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.skipTlsVerify).toBe(false);
    act(() => result.current.handleSkipTlsVerifyChange(true));
    expect(result.current.skipTlsVerify).toBe(true);
    expect(writeKey).toHaveBeenCalledWith('gql_tls_skip_v1', 'true');
  });

  it('handlePollingChange updates state and persists', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.pollingEnabled).toBe(false);
    act(() => result.current.handlePollingChange(true, 60));
    expect(result.current.pollingEnabled).toBe(true);
    expect(result.current.pollingIntervalSeconds).toBe(60);
    expect(writeKey).toHaveBeenCalledWith(
      'gql_polling_v1',
      JSON.stringify({ enabled: true, intervalSeconds: 60 }),
    );
  });

  it('pollingIntervalMs returns 0 when polling disabled', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.pollingIntervalMs).toBe(0);
  });

  it('pollingIntervalMs returns ms value when polling enabled', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    act(() => result.current.handlePollingChange(true, 30));
    expect(result.current.pollingIntervalMs).toBe(30000);
  });

  it('handleAuthChange updates auth state', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.auth).toBeNull();
    act(() => result.current.handleAuthChange({ type: 'bearer', token: 'mytoken' }));
    expect(result.current.auth).toEqual({ type: 'bearer', token: 'mytoken' });
  });

  it('setEndpoint updates endpoint and persists', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    act(() => result.current.setEndpoint('https://new-endpoint.com'));
    expect(result.current.endpoint).toBe('https://new-endpoint.com');
    expect(writeKey).toHaveBeenCalledWith('gql_endpoint_v1', 'https://new-endpoint.com');
  });

  it('setEndpoint syncs historyConnectionId', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    act(() => result.current.setEndpoint('https://new-endpoint.com'));
    expect(result.current.historyConnectionId).toBe('https://new-endpoint.com');
  });

  it('setEndpoint sets historyConnectionId to null for empty string', () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://initial.com'),
    );
    act(() => result.current.setEndpoint(''));
    expect(result.current.historyConnectionId).toBeNull();
  });

  it('profileModalOpen starts as false', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.profileModalOpen).toBe(false);
  });

  it('setProfileModalOpen updates profileModalOpen', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    act(() => result.current.setProfileModalOpen(true));
    expect(result.current.profileModalOpen).toBe(true);
  });

  it('envModalOpen starts as false', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.envModalOpen).toBe(false);
  });

  it('setEnvModalOpen updates envModalOpen', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    act(() => result.current.setEnvModalOpen(true));
    expect(result.current.envModalOpen).toBe(true);
  });

  it('returns recentEndpoints, pushRecentEndpoint, removeRecentEndpoint from hook', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.recentEndpoints).toEqual([]);
    expect(typeof result.current.pushRecentEndpoint).toBe('function');
    expect(typeof result.current.removeRecentEndpoint).toBe('function');
  });

  it('returns profiles from useGraphqlConnectionProfiles', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.profiles).toEqual([]);
    expect(typeof result.current.saveProfile).toBe('function');
    expect(typeof result.current.deleteProfile).toBe('function');
  });

  it('returns environments from useGraphqlEnvironments', () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.environments).toEqual([]);
    expect(result.current.activeEnvironment).toBeNull();
    expect(typeof result.current.createEnvironment).toBe('function');
  });

  it('prevBaseUrlRef is mutable', () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://initial.com'),
    );
    expect(result.current.prevBaseUrlRef).toBeDefined();
    expect(result.current.prevBaseUrlRef.current).toBe('https://initial.com');
  });

  describe('storage restore on mount', () => {
    it('restores saved endpoint from storage', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_endpoint_v1') return 'https://saved-endpoint.com';
        return null;
      });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.endpoint).toBe('https://saved-endpoint.com');
    });

    it('uses resolvedBaseUrl instead when saved endpoint matches savedBase and rbUrl is different', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_endpoint_v1') return 'https://old-base.com';
        if (key === 'gql_endpoint_base_v1') return 'https://old-base.com';
        return null;
      });
      const { result } = renderHook(() =>
        useGraphqlConnectionSettings('https://new-base.com'),
      );
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.endpoint).toBe('https://new-base.com');
    });

    it('restores skipTlsVerify from storage', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_tls_skip_v1') return 'true';
        return null;
      });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.skipTlsVerify).toBe(true);
    });

    it('restores polling settings from storage', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_polling_v1') return JSON.stringify({ enabled: true, intervalSeconds: 30 });
        return null;
      });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.pollingEnabled).toBe(true);
      expect(result.current.pollingIntervalSeconds).toBe(30);
    });

    it('does not restore polling interval if less than 10 seconds', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_polling_v1') return JSON.stringify({ enabled: true, intervalSeconds: 5 });
        return null;
      });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.pollingEnabled).toBe(true);
      // Interval below 10 is not restored
      expect(result.current.pollingIntervalSeconds).toBe(30);
    });

    it('restores auth from loadAuth when saved', async () => {
      vi.mocked(loadAuth).mockResolvedValue({ type: 'bearer', token: 'restored-token' });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.auth).toEqual({ type: 'bearer', token: 'restored-token' });
    });
  });
});

// ─── catch handler coverage: writeKey rejection ───────────────────────────────

describe('useGraphqlConnectionSettings — writeKey rejection catch handlers', () => {
  it('handles writeKey rejection in handleSkipTlsVerifyChange silently (L102 catch)', async () => {
    // Use key-specific mock so that the rejection targets only the TLS key call,
    // not the earlier writeKey calls that fire during mount.
    vi.mocked(writeKey).mockImplementation(async (key) => {
      if (key === 'gql_tls_skip_v1') throw new Error('quota');
    });
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => {
      result.current.handleSkipTlsVerifyChange(true);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.skipTlsVerify).toBe(true);
  });

  it('handles writeKey rejection in handlePollingChange silently (L108 catch)', async () => {
    vi.mocked(writeKey).mockImplementation(async (key) => {
      if (key === 'gql_polling_v1') throw new Error('quota');
    });
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => {
      result.current.handlePollingChange(true, 15);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.pollingEnabled).toBe(true);
  });

  it('handles writeKey rejection in endpoint persist effect silently (L90 catch)', async () => {
    vi.mocked(writeKey).mockImplementation(async () => { throw new Error('quota'); });
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => {
      result.current.setEndpoint('https://new.test');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.endpoint).toBe('https://new.test');
  });

  it('resolvedBaseUrl change that keeps manually-set endpoint (L85 return cur + L82 catch)', async () => {
    // When writeKey rejects AND endpoint was manually changed to bypass prev check
    vi.mocked(writeKey).mockRejectedValue(new Error('quota'));
    const { result, rerender } = renderHook(
      ({ url }) => useGraphqlConnectionSettings(url),
      { initialProps: { url: 'https://base-a.com' } },
    );
    // Manually change endpoint to something different from both '' and 'base-a'
    await act(async () => {
      result.current.setEndpoint('https://custom.com');
    });
    // Now change resolvedBaseUrl → triggers setEndpoint updater
    // cur='https://custom.com', prev='https://base-a.com' → return cur (L85)
    await act(async () => {
      rerender({ url: 'https://base-b.com' });
      await new Promise((r) => setTimeout(r, 0));
    });
    // Endpoint stays as manually-entered value
    expect(result.current.endpoint).toBe('https://custom.com');
  });

  it('L82: empty endpoint gets overwritten by resolvedBaseUrl and writeKey rejection is silenced', async () => {
    // To trigger line 82's writeKey, cur must be '' at the time the effect fires.
    // Start with no resolvedBaseUrl so endpoint initialises to ''.
    vi.mocked(writeKey).mockRejectedValue(new Error('quota'));
    const { result, rerender } = renderHook(
      ({ url }: { url?: string }) => useGraphqlConnectionSettings(url),
      { initialProps: { url: undefined } },
    );
    expect(result.current.endpoint).toBe('');
    // Now set resolvedBaseUrl → effect fires, cur==='' → L82 writeKey called and rejects → catch fires
    await act(async () => {
      rerender({ url: 'https://new-base.com' });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.endpoint).toBe('https://new-base.com');
  });

  it('does not set pollingEnabled when p.enabled is false in polling storage (L158 false branch)', async () => {
    vi.mocked(readKey).mockImplementation(async (key) => {
      if (key === 'gql_polling_v1') return JSON.stringify({ enabled: false, intervalSeconds: 30 });
      return null;
    });
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.pollingEnabled).toBe(false);
  });

  it('handles readKey throwing in the restore settings IIFE silently', async () => {
    vi.mocked(readKey).mockRejectedValue(new Error('IDB error'));
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.endpoint).toBe('');
    expect(result.current.skipTlsVerify).toBe(false);
  });
});
