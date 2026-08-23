/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketProfiles } from './useWebSocketProfiles';
import * as wsStorage from '@shared/websocket/websocketStorage';
import type { WsConnectionProfile } from '@shared/websocket/types';

vi.mock('../../shared/websocket/websocketStorage', () => ({
  loadWsProfiles: vi.fn(),
  saveWsProfiles: vi.fn(),
}));

const mockLoad = vi.mocked(wsStorage.loadWsProfiles);
const mockSave = vi.mocked(wsStorage.saveWsProfiles);

function makeProfile(overrides?: Partial<WsConnectionProfile>): WsConnectionProfile {
  return {
    id: 'p1',
    name: 'Test Profile',
    url: 'wss://example.com/ws',
    headers: [],
    queryParams: [],
    subprotocols: '',
    autoReconnect: false,
    maxReconnectAttempts: 5,
    reconnectIntervalMs: 3000,
    maxMessages: 1000,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetAllMocks();
  mockLoad.mockResolvedValue([]);
  mockSave.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWebSocketProfiles', () => {
  it('starts in loading state then completes', async () => {
    const existing = [makeProfile()];
    mockLoad.mockResolvedValue(existing);

    const { result } = renderHook(() => useWebSocketProfiles());
    expect(result.current.loading).toBe(true);

    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].name).toBe('Test Profile');
  });

  it('handles load error', async () => {
    mockLoad.mockRejectedValue(new Error('disk fail'));

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('disk fail');
  });

  it('saves a new profile', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.saveProfile({
        name: 'New',
        url: 'wss://new.com',
        headers: [],
        queryParams: [],
        subprotocols: '',
        autoReconnect: false,
        maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000,
        maxMessages: 1000,
      });
    });

    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].name).toBe('New');
    expect(result.current.profiles[0].id).toBeTruthy();
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('updates an existing profile', async () => {
    const existing = makeProfile({ id: 'p1', name: 'Old' });
    mockLoad.mockResolvedValue([existing]);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.updateProfile('p1', { name: 'Updated' });
    });

    expect(result.current.profiles[0].name).toBe('Updated');
    expect(mockSave).toHaveBeenCalled();
  });

  it('does nothing when updating non-existent id', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.updateProfile('non-existent', { name: 'x' });
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('deletes a profile', async () => {
    const existing = [makeProfile({ id: 'p1' }), makeProfile({ id: 'p2', name: 'Keep' })];
    mockLoad.mockResolvedValue(existing);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});
    expect(result.current.profiles).toHaveLength(2);

    await act(async () => {
      await result.current.deleteProfile('p1');
    });

    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0].id).toBe('p2');
  });

  it('duplicates a profile with (copy) suffix', async () => {
    const existing = makeProfile({ id: 'p1', name: 'Original' });
    mockLoad.mockResolvedValue([existing]);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.duplicateProfile('p1');
    });

    expect(result.current.profiles).toHaveLength(2);
    expect(result.current.profiles[1].name).toBe('Original (copy)');
    expect(result.current.profiles[1].id).not.toBe('p1');
  });

  it('does nothing when duplicating non-existent id', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.duplicateProfile('ghost');
    });

    expect(result.current.profiles).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('imports valid profiles from JSON', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([
      { name: 'Imported', url: 'wss://imported.com' },
      { name: 'Also', url: 'wss://also.com', headers: [{ key: 'X', value: 'Y', enabled: true }] },
    ]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(2);
    expect(importResult.errors).toHaveLength(0);
    expect(result.current.profiles).toHaveLength(2);
  });

  it('reports errors for invalid import items', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([
      { name: 'Good', url: 'wss://good.com' },
      { name: 'No URL' },
      42,
    ]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(1);
    expect(importResult.errors).toHaveLength(2);
  });

  it('returns error for invalid JSON import', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles('not json');
    });

    expect(importResult.imported).toBe(0);
    expect(importResult.errors).toEqual(['Invalid JSON']);
  });

  it('returns error for non-array JSON import', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles('{"not":"array"}');
    });

    expect(importResult.imported).toBe(0);
    expect(importResult.errors).toEqual(['Expected a JSON array of profiles']);
  });

  it('exports profiles as formatted JSON', async () => {
    const profiles = [makeProfile({ id: 'x', name: 'Export Me' })];
    mockLoad.mockResolvedValue(profiles);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = result.current.exportProfiles();
    expect(JSON.parse(json)).toHaveLength(1);
    expect(JSON.parse(json)[0].name).toBe('Export Me');
  });

  it('loads profile as draft', async () => {
    const profiles = [makeProfile({
      id: 'p1',
      url: 'wss://test.com',
      headers: [{ key: 'Auth', value: 'Bearer x', enabled: true }],
    })];
    mockLoad.mockResolvedValue(profiles);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const draft = result.current.loadProfileAsDraft('p1');
    expect(draft).not.toBeNull();
    expect(draft!.url).toBe('wss://test.com');
    expect(draft!.headers).toHaveLength(1);
    expect(draft!.headers[0].key).toBe('Auth');
  });

  it('returns null for non-existent profile draft', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const draft = result.current.loadProfileAsDraft('ghost');
    expect(draft).toBeNull();
  });

  it('sanitizes malformed KV entries during import', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([{
      name: 'Sanitize Test',
      url: 'wss://test.com',
      headers: [
        { key: 123, value: null, enabled: 'yes' },
        { key: 'Good', value: 'Val', enabled: true },
        'not-an-object',
      ],
      queryParams: [{ key: 'q' }],
    }]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(1);
    const profile = result.current.profiles[0];
    expect(profile.headers).toHaveLength(2);
    expect(profile.headers[0].key).toBe('123');
    expect(profile.headers[0].value).toBe('');
    expect(profile.headers[0].enabled).toBe(true);
    expect(profile.headers[1].key).toBe('Good');
    expect(profile.queryParams).toHaveLength(1);
    expect(profile.queryParams[0].enabled).toBe(true);
  });

  it('rejects invalid protocolMode and defaults to auto', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([{
      name: 'Bad Protocol',
      url: 'wss://test.com',
      protocolMode: 'invalid-protocol',
    }]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(1);
    expect(result.current.profiles[0].protocolMode).toBe('auto');
  });

  it('preserves valid protocolMode values', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([
      { name: 'STOMP Profile', url: 'wss://stomp.com', protocolMode: 'stomp' },
      { name: 'GraphQL Profile', url: 'wss://gql.com', protocolMode: 'graphql-ws' },
    ]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(2);
    const profiles = result.current.profiles;
    const stompProfile = profiles.find(p => p.name === 'STOMP Profile');
    const gqlProfile = profiles.find(p => p.name === 'GraphQL Profile');
    expect(stompProfile?.protocolMode).toBe('stomp');
    expect(gqlProfile?.protocolMode).toBe('graphql-ws');
  });

  it('handles load error gracefully', async () => {
    mockLoad.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('disk full');
    expect(result.current.profiles).toEqual([]);
  });

  it('handles save error during persist', async () => {
    mockLoad.mockResolvedValue([]);
    mockSave.mockRejectedValue(new Error('write failed'));
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.saveProfile({
        name: 'Fail',
        url: 'wss://fail.com',
        headers: [],
        queryParams: [],
        subprotocols: '',
        autoReconnect: false,
        maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000,
        maxMessages: 1000,
      });
    });

    expect(result.current.error).toBe('write failed');
  });

  it('importProfiles clamps numeric fields within valid range', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([{
      name: 'Clamped',
      url: 'wss://clamp.com',
      maxReconnectAttempts: 999,
      reconnectIntervalMs: 1,
      maxMessages: 0,
    }]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(1);
    const p = result.current.profiles[0];
    expect(p.maxReconnectAttempts).toBe(50);
    expect(p.reconnectIntervalMs).toBe(500);
    expect(p.maxMessages).toBe(100);
  });

  it('importProfiles handles tlsConfig sanitization', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([{
      name: 'TLS Profile',
      url: 'wss://tls.com',
      tlsConfig: {
        rejectUnauthorized: false,
        caCert: 'my-ca-cert',
        extraField: 'ignored',
      },
    }]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(1);
    const p = result.current.profiles[0];
    expect(p.tlsConfig).toEqual({ rejectUnauthorized: false, caCert: 'my-ca-cert' });
  });

  it('importProfiles returns undefined tlsConfig for empty/invalid input', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([
      { name: 'No TLS', url: 'wss://a.com', tlsConfig: null },
      { name: 'Empty TLS', url: 'wss://b.com', tlsConfig: {} },
    ]);

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles(json);
    });

    expect(importResult.imported).toBe(2);
    expect(result.current.profiles[0].tlsConfig).toBeUndefined();
    expect(result.current.profiles[1].tlsConfig).toBeUndefined();
  });

  it('exportProfiles strips sensitive TLS fields', async () => {
    mockLoad.mockResolvedValue([makeProfile({
      id: 'tls1',
      name: 'TLS Export',
      url: 'wss://tls.com',
      tlsConfig: {
        rejectUnauthorized: false,
        caCert: 'ca-cert-data',
        clientKey: 'secret-key',
        clientCert: 'cert-data',
      },
    })]);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const exported = JSON.parse(result.current.exportProfiles());
    expect(exported).toHaveLength(1);
    expect(exported[0].tlsConfig).toEqual({ rejectUnauthorized: false, caCert: 'ca-cert-data' });
    expect(exported[0].tlsConfig.clientKey).toBeUndefined();
    expect(exported[0].tlsConfig.clientCert).toBeUndefined();
  });

  it('exportProfiles omits tlsConfig when only sensitive fields exist', async () => {
    mockLoad.mockResolvedValue([makeProfile({
      id: 'tls2',
      name: 'Only Secret',
      url: 'wss://x.com',
      tlsConfig: {
        clientKey: 'secret',
        clientCert: 'cert',
      },
    })]);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const exported = JSON.parse(result.current.exportProfiles());
    expect(exported[0].tlsConfig).toBeUndefined();
  });

  it('duplicates headers, queryParams, and tlsConfig deeply', async () => {
    const existing = makeProfile({
      id: 'p1',
      name: 'Rich',
      headers: [{ key: 'H', value: 'V', enabled: true }],
      queryParams: [{ key: 'Q', value: '1', enabled: true }],
      tlsConfig: { rejectUnauthorized: true, caCert: 'ca' },
    });
    mockLoad.mockResolvedValue([existing]);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.duplicateProfile('p1');
    });

    const copy = result.current.profiles[1];
    expect(copy.headers).toEqual(existing.headers);
    expect(copy.headers).not.toBe(existing.headers);
    expect(copy.queryParams).toEqual(existing.queryParams);
    expect(copy.tlsConfig).toEqual(existing.tlsConfig);
    expect(copy.tlsConfig).not.toBe(existing.tlsConfig);
  });

  it('importProfiles preserves subprotocols, autoReconnect, and notes', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([{
      name: 'Full',
      url: 'wss://full.com',
      subprotocols: 'graphql-ws',
      autoReconnect: true,
      notes: 'dev only',
      backoffMultiplier: 1,
    }]);

    await act(async () => {
      await result.current.importProfiles(json);
    });

    const p = result.current.profiles[0];
    expect(p.subprotocols).toBe('graphql-ws');
    expect(p.autoReconnect).toBe(true);
    expect(p.notes).toBe('dev only');
    expect(p.backoffMultiplier).toBe(1);
  });

  it('exportProfiles keeps tlsConfig when only rejectUnauthorized is set', async () => {
    mockLoad.mockResolvedValue([makeProfile({
      id: 'tls3',
      tlsConfig: { rejectUnauthorized: true },
    })]);

    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const exported = JSON.parse(result.current.exportProfiles());
    expect(exported[0].tlsConfig).toEqual({ rejectUnauthorized: true });
  });

  it('handles non-Error load failure', async () => {
    mockLoad.mockRejectedValue('disk unavailable');
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    expect(result.current.error).toBe('disk unavailable');
  });

  it('handles non-Error save failure during persist', async () => {
    mockSave.mockRejectedValue('write denied');
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      await result.current.saveProfile({
        name: 'Fail',
        url: 'wss://fail.com',
        headers: [],
        queryParams: [],
        subprotocols: '',
        autoReconnect: false,
        maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000,
        maxMessages: 1000,
      });
    });

    expect(result.current.error).toBe('write denied');
  });

  it('does not update state after unmount during initial load', async () => {
    let resolveLoad!: (profiles: WsConnectionProfile[]) => void;
    mockLoad.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));

    const { result, unmount } = renderHook(() => useWebSocketProfiles());
    expect(result.current.loading).toBe(true);
    unmount();

    await act(async () => {
      resolveLoad([makeProfile()]);
    });
  });

  it('does not set error after unmount when persist fails', async () => {
    mockSave.mockRejectedValue(new Error('write failed'));
    const { result, unmount } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    await act(async () => {
      void result.current.saveProfile({
        name: 'Fail',
        url: 'wss://fail.com',
        headers: [],
        queryParams: [],
        subprotocols: '',
        autoReconnect: false,
        maxReconnectAttempts: 5,
        reconnectIntervalMs: 3000,
        maxMessages: 1000,
      });
      unmount();
    });
  });

  it('importProfiles with only invalid items does not persist', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    let importResult: { imported: number; errors: string[] } = { imported: 0, errors: [] };
    await act(async () => {
      importResult = await result.current.importProfiles('[42, null, "bad"]');
    });

    expect(importResult.imported).toBe(0);
    expect(importResult.errors.length).toBeGreaterThan(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('importProfiles handles valid backoffMultiplier values', async () => {
    const { result } = renderHook(() => useWebSocketProfiles());
    await act(async () => {});

    const json = JSON.stringify([
      { name: 'Backoff2', url: 'wss://a.com', backoffMultiplier: 2 },
      { name: 'Backoff1.5', url: 'wss://b.com', backoffMultiplier: 1.5 },
      { name: 'BadBackoff', url: 'wss://c.com', backoffMultiplier: 3 },
    ]);

    await act(async () => {
      await result.current.importProfiles(json);
    });

    const profiles = result.current.profiles;
    expect(profiles[0].backoffMultiplier).toBe(2);
    expect(profiles[1].backoffMultiplier).toBe(1.5);
    expect(profiles[2].backoffMultiplier).toBeUndefined();
  });
});
