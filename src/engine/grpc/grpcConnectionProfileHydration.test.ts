/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import {
  GRPC_PROFILE_STORAGE_KEYS,
  loadGrpcConnectionProfilesFromStorage,
  parseGrpcConnectionProfiles,
} from './grpcConnectionProfileHydration';

describe('parseGrpcConnectionProfiles', () => {
  it('parses valid profiles and filters malformed entries', () => {
    const parsed = parseGrpcConnectionProfiles(JSON.stringify([
      {
        id: 'profile-a',
        name: 'Staging',
        target: 'staging.example.com:50051',
        tlsMode: 'tls',
      },
      {
        id: '',
        name: 'Invalid',
        target: 'missing-id',
      },
    ]));

    expect(parsed).toEqual([
      {
        id: 'profile-a',
        name: 'Staging',
        target: 'staging.example.com:50051',
        tlsMode: 'tls',
        variables: undefined,
      },
    ]);
  });

  it('returns empty array for invalid JSON payloads', () => {
    expect(parseGrpcConnectionProfiles('{bad-json')).toEqual([]);
  });
});

describe('loadGrpcConnectionProfilesFromStorage', () => {
  it('loads from first matching key with valid profile array', () => {
    const byKey = new Map<string, string | null>([
      [GRPC_PROFILE_STORAGE_KEYS[0], null],
      [GRPC_PROFILE_STORAGE_KEYS[1], JSON.stringify([
        {
          id: 'profile-b',
          name: 'Prod',
          target: 'prod.example.com:443',
          tlsMode: 'mtls',
        },
      ])],
    ]);

    const loaded = loadGrpcConnectionProfilesFromStorage((key) => byKey.get(key) ?? null);

    expect(loaded).toEqual([
      {
        id: 'profile-b',
        name: 'Prod',
        target: 'prod.example.com:443',
        tlsMode: 'mtls',
        variables: undefined,
      },
    ]);
  });

  it('returns empty array when raw is nullish or non-array JSON', () => {
    expect(parseGrpcConnectionProfiles(null)).toEqual([]);
    expect(parseGrpcConnectionProfiles(undefined)).toEqual([]);
    expect(parseGrpcConnectionProfiles(JSON.stringify({ not: 'array' }))).toEqual([]);
  });

  it('normalizes mtls profiles and string variables only', () => {
    const parsed = parseGrpcConnectionProfiles(JSON.stringify([
      {
        id: 'profile-mtls',
        name: 'Mutual TLS',
        target: 'secure.example.com:443',
        tlsMode: 'mtls',
        variables: { token: 'abc', count: 3 },
      },
      {
        id: 'profile-bad-tls',
        name: 'Bad TLS',
        target: 'host:443',
        tlsMode: 'custom',
      },
    ]));
    expect(parsed).toEqual([
      {
        id: 'profile-mtls',
        name: 'Mutual TLS',
        target: 'secure.example.com:443',
        tlsMode: 'mtls',
        variables: { token: 'abc' },
      },
      {
        id: 'profile-bad-tls',
        name: 'Bad TLS',
        target: 'host:443',
        tlsMode: 'disabled',
        variables: undefined,
      },
    ]);
  });

  it('filters malformed profile entries missing required fields', () => {
    expect(parseGrpcConnectionProfiles(JSON.stringify([
      null,
      { id: 'x', name: 1, target: 'host:443' },
      { id: 'ok', name: 'OK', target: 'host:443', tlsMode: 'tls' },
    ]))).toEqual([
      {
        id: 'ok',
        name: 'OK',
        target: 'host:443',
        tlsMode: 'tls',
        variables: undefined,
      },
    ]);
  });

  it('loadGrpcConnectionProfilesFromStorage reads third legacy key and handles storage errors', () => {
    const byKey = new Map<string, string | null>([
      [GRPC_PROFILE_STORAGE_KEYS[0], '[]'],
      [GRPC_PROFILE_STORAGE_KEYS[1], '[]'],
      [GRPC_PROFILE_STORAGE_KEYS[2], JSON.stringify([
        { id: 'legacy', name: 'Legacy', target: 'legacy:443', tlsMode: 'tls' },
      ])],
    ]);
    expect(loadGrpcConnectionProfilesFromStorage((key) => byKey.get(key) ?? null)).toEqual([
      {
        id: 'legacy',
        name: 'Legacy',
        target: 'legacy:443',
        tlsMode: 'tls',
        variables: undefined,
      },
    ]);
  });

  it('loadGrpcConnectionProfilesFromStorage uses browser localStorage when no reader is injected', () => {
    localStorage.setItem(
      GRPC_PROFILE_STORAGE_KEYS[0],
      JSON.stringify([{ id: 'browser', name: 'Browser', target: 'browser:443', tlsMode: 'tls' }]),
    );
    expect(loadGrpcConnectionProfilesFromStorage()).toEqual([
      {
        id: 'browser',
        name: 'Browser',
        target: 'browser:443',
        tlsMode: 'tls',
        variables: undefined,
      },
    ]);
    localStorage.clear();
  });

  it('loadGrpcConnectionProfilesFromStorage returns empty array when localStorage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadGrpcConnectionProfilesFromStorage()).toEqual([]);
    getItem.mockRestore();
  });
});
