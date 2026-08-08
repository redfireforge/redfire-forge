/**
 * @vitest-environment jsdom
 *
 * Tests for useGraphqlConnectionSettings hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  TLS_CERTS_STORAGE_KEY: 'gql_tls_certs_v1',
  loadTlsCerts: vi.fn(async () => ({})),
  saveTlsCerts: vi.fn(async () => {}),
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
    updateProfile: vi.fn(),
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

vi.mock('../utils/gqlDemoWorkspace', () => ({
  GQL_PAGE_AUTH_RELOAD_EVENT: 'gql-page-auth-reload',
  GQL_PAGE_ENDPOINT_RELOAD_EVENT: 'gql-page-endpoint-reload',
  loadDemoSession: vi.fn(async () => null),
}));

import { useGraphqlConnectionSettings } from './useGraphqlConnectionSettings';
import { readKey, writeKey } from '../../../shared/utils/storage';
import { loadAuth, loadTlsCerts, saveTlsCerts } from '../utils/tabPersistence';
import { GQL_PAGE_AUTH_RELOAD_EVENT, loadDemoSession } from '../utils/gqlDemoWorkspace';

async function flushHookEffects(): Promise<void> {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('useGraphqlConnectionSettings', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.mocked(writeKey).mockResolvedValue(undefined);
    vi.mocked(readKey).mockResolvedValue(null);
    vi.mocked(loadTlsCerts).mockResolvedValue({});
    vi.mocked(loadDemoSession).mockResolvedValue(null);
  });

  it('initializes endpoint from resolvedBaseUrl after storage hydrate', async () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://api.example.com/graphql'),
    );
    expect(result.current.endpoint).toBe('');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.endpoint).toBe('https://api.example.com/graphql');
  });

  it('initializes endpoint as empty string when no resolvedBaseUrl', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.endpoint).toBe('');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.endpoint).toBe('');
  });

  it('initializes historyConnectionId from resolvedBaseUrl after hydrate', async () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://api.example.com'),
    );
    expect(result.current.historyConnectionId).toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.historyConnectionId).toBe('https://api.example.com');
  });

  it('initializes historyConnectionId as null when no resolvedBaseUrl', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    expect(result.current.historyConnectionId).toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.historyConnectionId).toBeNull();
  });

  it('handleSkipTlsVerifyChange updates state and persists', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.skipTlsVerify).toBe(false);
    act(() => result.current.handleSkipTlsVerifyChange(true));
    expect(result.current.skipTlsVerify).toBe(true);
    expect(writeKey).toHaveBeenCalledWith('gql_tls_skip_v1', 'true');
  });

  it('handlePollingChange updates state and persists', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.pollingEnabled).toBe(false);
    act(() => result.current.handlePollingChange(true, 60));
    expect(result.current.pollingEnabled).toBe(true);
    expect(result.current.pollingIntervalSeconds).toBe(60);
    expect(writeKey).toHaveBeenCalledWith(
      'gql_polling_v1',
      JSON.stringify({ enabled: true, intervalSeconds: 60 }),
    );
  });

  it('handlePollingChange clamps interval to 10–3600 seconds (Phase 6F)', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    act(() => result.current.handlePollingChange(true, 5));
    expect(result.current.pollingIntervalSeconds).toBe(10);
    expect(writeKey).toHaveBeenCalledWith(
      'gql_polling_v1',
      JSON.stringify({ enabled: true, intervalSeconds: 10 }),
    );
  });

  it('pollingIntervalMs returns 0 when polling disabled', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.pollingIntervalMs).toBe(0);
  });

  it('pollingIntervalMs returns ms value when polling enabled', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    act(() => result.current.handlePollingChange(true, 30));
    expect(result.current.pollingIntervalMs).toBe(30000);
  });

  it('handleAuthChange updates auth state', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.auth).toBeNull();
    act(() => result.current.handleAuthChange({ type: 'bearer', token: 'mytoken' }));
    expect(result.current.auth).toEqual({ type: 'bearer', token: 'mytoken' });
  });

  it('handleTlsCertsChange updates CA, client cert, and key', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    act(() => result.current.handleTlsCertsChange({
      caCert: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
      clientCert: '-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----',
      clientKey: '-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----',
    }));
    expect(result.current.tlsCaCert).toContain('BEGIN CERTIFICATE');
    expect(result.current.tlsClientCert).toContain('CLIENT');
    expect(result.current.tlsClientKey).toContain('BEGIN PRIVATE KEY');
    expect(saveTlsCerts).toHaveBeenCalled();
  });

  it('handleTlsCertsChange clears cert fields when empty strings passed', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    act(() => result.current.handleTlsCertsChange({ caCert: 'ca-pem' }));
    act(() => result.current.handleTlsCertsChange({ caCert: '' }));
    expect(result.current.tlsCaCert).toBeUndefined();

    act(() => result.current.handleTlsCertsChange({
      clientCert: 'client-pem',
      clientKey: 'key-pem',
    }));
    act(() => result.current.handleTlsCertsChange({ clientCert: '', clientKey: '' }));
    expect(result.current.tlsClientCert).toBeUndefined();
    expect(result.current.tlsClientKey).toBeUndefined();
  });

  it('setEndpoint updates endpoint and persists', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    vi.mocked(writeKey).mockClear();
    act(() => result.current.setEndpoint('https://new-endpoint.com'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.endpoint).toBe('https://new-endpoint.com');
    expect(writeKey).toHaveBeenCalledWith('gql_endpoint_v1', 'https://new-endpoint.com');
  });

  it('does not persist {{graphqlUrl}} to page storage while a demo session is active', async () => {
    vi.mocked(loadDemoSession).mockResolvedValue({
      lessonId: 'gql-variables',
      priorActiveTabId: 'user-1',
      demoTabId: 'demo-1',
    });
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    vi.mocked(writeKey).mockClear();
    act(() => result.current.setEndpoint('{{graphqlUrl}}'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.endpoint).toBe('{{graphqlUrl}}');
    expect(writeKey).not.toHaveBeenCalledWith('gql_endpoint_v1', '{{graphqlUrl}}');
  });

  it('does not overwrite a restored user endpoint with stale {{graphqlUrl}} after demo teardown', async () => {
    vi.mocked(loadDemoSession).mockResolvedValue(null);
    vi.mocked(readKey).mockImplementation(async (key: string) => {
      if (key === 'gql_endpoint_v1') return 'https://user-custom.example.com/graphql';
      return null;
    });
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    vi.mocked(writeKey).mockClear();
    act(() => result.current.setEndpoint('{{graphqlUrl}}'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(writeKey).not.toHaveBeenCalledWith('gql_endpoint_v1', '{{graphqlUrl}}');
  });

  it('setEndpoint syncs historyConnectionId', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    act(() => result.current.setEndpoint('https://new-endpoint.com'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.historyConnectionId).toBe('https://new-endpoint.com');
  });

  it('setEndpoint sets historyConnectionId to null for empty string', async () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://initial.com'),
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    act(() => result.current.setEndpoint(''));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.historyConnectionId).toBeNull();
  });

  it('profileModalOpen starts as false', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.profileModalOpen).toBe(false);
  });

  it('setProfileModalOpen updates profileModalOpen', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    act(() => result.current.setProfileModalOpen(true));
    expect(result.current.profileModalOpen).toBe(true);
  });

  it('envModalOpen starts as false', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.envModalOpen).toBe(false);
  });

  it('setEnvModalOpen updates envModalOpen', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    act(() => result.current.setEnvModalOpen(true));
    expect(result.current.envModalOpen).toBe(true);
  });

  it('returns recentEndpoints, pushRecentEndpoint, removeRecentEndpoint from hook', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.recentEndpoints).toEqual([]);
    expect(typeof result.current.pushRecentEndpoint).toBe('function');
    expect(typeof result.current.removeRecentEndpoint).toBe('function');
  });

  it('returns profiles from useGraphqlConnectionProfiles', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.profiles).toEqual([]);
    expect(typeof result.current.saveProfile).toBe('function');
    expect(typeof result.current.deleteProfile).toBe('function');
  });

  it('returns environments from useGraphqlEnvironments', async () => {
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    expect(result.current.environments).toEqual([]);
    expect(result.current.activeEnvironment).toBeNull();
    expect(typeof result.current.createEnvironment).toBe('function');
  });

  it('prevBaseUrlRef is mutable', async () => {
    const { result } = renderHook(() =>
      useGraphqlConnectionSettings('https://initial.com'),
    );
    await flushHookEffects();
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

    it('does not write empty endpoint to storage before hydrate completes', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_endpoint_v1') return 'https://saved-endpoint.com';
        return null;
      });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      const writesBeforeHydrate = vi.mocked(writeKey).mock.calls.filter(
        (c) => c[0] === 'gql_endpoint_v1',
      );
      expect(writesBeforeHydrate).toHaveLength(0);
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

    it('reloads auth from storage on GQL_PAGE_AUTH_RELOAD_EVENT', async () => {
      vi.mocked(loadAuth)
        .mockResolvedValueOnce({ type: 'bearer', token: 'initial' })
        .mockResolvedValueOnce({ type: 'inherit', globalProfileId: 'prof-1' });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.auth).toEqual({ type: 'bearer', token: 'initial' });

      act(() => result.current.handleAuthChange({ type: 'bearer', token: 'lesson-pollution' }));
      expect(result.current.auth).toEqual({ type: 'bearer', token: 'lesson-pollution' });

      await act(async () => {
        window.dispatchEvent(new CustomEvent(GQL_PAGE_AUTH_RELOAD_EVENT));
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(result.current.auth).toEqual({ type: 'inherit', globalProfileId: 'prof-1' });
    });

    it('reloads endpoint from storage on GQL_PAGE_ENDPOINT_RELOAD_EVENT', async () => {
      const { GQL_PAGE_ENDPOINT_RELOAD_EVENT: endpointEvent } = await import('../utils/gqlDemoWorkspace');
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_endpoint_v1') return 'https://restored.example.com/graphql';
        return null;
      });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

      act(() => result.current.setEndpoint('https://lesson-pollution.example.com/graphql'));
      await act(async () => {
        window.dispatchEvent(new CustomEvent(endpointEvent));
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(result.current.endpoint).toBe('https://restored.example.com/graphql');
    });

    it('ignores endpoint reload when storage returns null', async () => {
      const { GQL_PAGE_ENDPOINT_RELOAD_EVENT: endpointEvent } = await import('../utils/gqlDemoWorkspace');
      const { result } = renderHook(() => useGraphqlConnectionSettings('https://initial.example.com/graphql'));
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      vi.mocked(readKey).mockResolvedValue(null);

      await act(async () => {
        window.dispatchEvent(new CustomEvent(endpointEvent));
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(result.current.endpoint).toBe('https://initial.example.com/graphql');
    });

    it('restores TLS certs from loadTlsCerts when saved', async () => {
      vi.mocked(loadTlsCerts).mockResolvedValue({
        caCert: '-----BEGIN CERTIFICATE-----\nRESTORED\n-----END CERTIFICATE-----',
        clientCert: 'client-pem',
        clientKey: 'key-pem',
      });
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.tlsCaCert).toContain('RESTORED');
      expect(result.current.tlsClientCert).toBe('client-pem');
      expect(result.current.tlsClientKey).toBe('key-pem');
    });

    it('handles loadTlsCerts throwing silently on mount', async () => {
      vi.mocked(loadTlsCerts).mockRejectedValue(new Error('storage error'));
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.tlsCaCert).toBeUndefined();
    });

    it('handles loadAuth rejection on auth reload event silently', async () => {
      vi.mocked(loadAuth)
        .mockResolvedValueOnce({ type: 'bearer', token: 'initial' })
        .mockRejectedValueOnce(new Error('auth reload failed'));
      const { result } = renderHook(() => useGraphqlConnectionSettings());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(result.current.auth).toEqual({ type: 'bearer', token: 'initial' });

      await act(async () => {
        window.dispatchEvent(new CustomEvent(GQL_PAGE_AUTH_RELOAD_EVENT));
        await new Promise((r) => setTimeout(r, 0));
      });
      // Keep prior auth when reload fails.
      expect(result.current.auth).toEqual({ type: 'bearer', token: 'initial' });
    });

    it('handles endpoint reload readKey rejection silently', async () => {
      const { GQL_PAGE_ENDPOINT_RELOAD_EVENT: endpointEvent } = await import('../utils/gqlDemoWorkspace');
      const { result } = renderHook(() => useGraphqlConnectionSettings('https://initial.example.com/graphql'));
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      vi.mocked(readKey).mockRejectedValue(new Error('endpoint reload failed'));

      await act(async () => {
        window.dispatchEvent(new CustomEvent(endpointEvent));
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(result.current.endpoint).toBe('https://initial.example.com/graphql');
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
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    vi.mocked(writeKey).mockImplementation(async () => { throw new Error('quota'); });
    await act(async () => {
      result.current.setEndpoint('https://new.test');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.endpoint).toBe('https://new.test');
  });

  it('handles saveTlsCerts rejection in handleTlsCertsChange silently', async () => {
    vi.mocked(saveTlsCerts).mockRejectedValue(new Error('tls cert save failed'));
    const { result } = renderHook(() => useGraphqlConnectionSettings());
    await flushHookEffects();
    await act(async () => {
      result.current.handleTlsCertsChange({ caCert: 'ca-pem' });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.tlsCaCert).toBe('ca-pem');
  });

  it('resolvedBaseUrl change that keeps manually-set endpoint (L85 return cur + L82 catch)', async () => {
    // When writeKey rejects AND endpoint was manually changed to bypass prev check
    vi.mocked(writeKey).mockRejectedValue(new Error('quota'));
    const { result, rerender } = renderHook(
      ({ url }) => useGraphqlConnectionSettings(url),
      { initialProps: { url: 'https://base-a.com' } },
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
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

  it('L82: empty endpoint gets overwritten by resolvedBaseUrl after hydrate and writeKey rejection is silenced', async () => {
    // To trigger line 82's writeKey, cur must be '' at the time the effect fires.
    // Start with no resolvedBaseUrl so endpoint initialises to ''.
    vi.mocked(writeKey).mockRejectedValue(new Error('quota'));
    const { result, rerender } = renderHook(
      ({ url }: { url?: string }) => useGraphqlConnectionSettings(url),
      { initialProps: { url: undefined } },
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
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
