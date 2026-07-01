import { describe, expect, it, vi } from 'vitest';
import {
  createGrpcSecretVault,
  extractAuthVaultValues,
  extractTlsVaultValues,
  inferGrpcTlsModeFromVaultValues,
  mergeAuthConfigWithVaultValues,
  mergeTlsConfigWithVaultValues,
  resolveGrpcSecretStorageClassForScope,
  resolveGrpcVaultOwnerId,
  tlsConfigMissingVaultPemFields,
} from './grpcSecretVault';

const VALID_PEM = `-----BEGIN CERTIFICATE-----
CA
-----END CERTIFICATE-----`;

describe('grpcSecretVault coverage gaps', () => {
  it('resolveGrpcVaultOwnerId normalizes invalid targets with raw fallback', () => {
    expect(resolveGrpcVaultOwnerId({ id: 'tab-1', target: '!!!' })).toBe('target:!!!');
  });

  it('resolveGrpcSecretStorageClassForScope covers bsr_token scope', () => {
    expect(resolveGrpcSecretStorageClassForScope('bsr_token', 'desktop')).toBe('encrypted_local');
  });

  it('inferGrpcTlsModeFromVaultValues detects tls and mtls', () => {
    expect(inferGrpcTlsModeFromVaultValues({ serverCaPem: VALID_PEM })).toBe('tls');
    expect(inferGrpcTlsModeFromVaultValues({
      clientCertPem: VALID_PEM,
      clientKeyPem: 'key',
    })).toBe('mtls');
    expect(inferGrpcTlsModeFromVaultValues({})).toBeUndefined();
  });

  it('tlsConfigMissingVaultPemFields detects missing inline PEM', () => {
    expect(tlsConfigMissingVaultPemFields(undefined, { serverCaPem: VALID_PEM })).toBe(true);
    expect(tlsConfigMissingVaultPemFields({ serverCaPem: VALID_PEM }, { serverCaPem: VALID_PEM })).toBe(false);
    expect(tlsConfigMissingVaultPemFields({ serverCaPem: ' ' }, { serverCaPem: VALID_PEM })).toBe(true);
  });

  it('extractAuthVaultValues covers basic, api_key, oauth2, and empty branches', () => {
    expect(extractAuthVaultValues({ type: 'basic', basicPassword: 'pw' })).toEqual({ basicPassword: 'pw' });
    expect(extractAuthVaultValues({ type: 'api_key', apiKeyValue: 'k' })).toEqual({ apiKeyValue: 'k' });
    expect(extractAuthVaultValues({
      type: 'oauth2',
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 'sec' },
    })).toEqual({ 'oauth2.clientSecret': 'sec' });
    expect(extractAuthVaultValues({ type: 'none' })).toEqual({});
    expect(extractAuthVaultValues({ type: 'basic', basicPassword: '  ' })).toEqual({});
  });

  it('mergeAuthConfigWithVaultValues hydrates each auth type from vault', () => {
    expect(mergeAuthConfigWithVaultValues(
      { type: 'basic', basicUsername: 'u', basicPassword: '' },
      { basicPassword: 'vault-pass' },
    )).toEqual({ type: 'basic', basicUsername: 'u', basicPassword: 'vault-pass' });

    expect(mergeAuthConfigWithVaultValues(
      { type: 'api_key', apiKeyName: 'x-key', apiKeyValue: '' },
      { apiKeyValue: 'vault-key' },
    )).toEqual({ type: 'api_key', apiKeyName: 'x-key', apiKeyValue: 'vault-key' });

    expect(mergeAuthConfigWithVaultValues(
      { type: 'oauth2', oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: '' } },
      { 'oauth2.clientSecret': 'vault-secret' },
    )).toEqual({
      type: 'oauth2',
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 'vault-secret' },
    });
  });

  it('mergeAuthConfigWithVaultValues returns auth unchanged when vault empty or oauth2 missing', () => {
    const auth = { type: 'oauth2' as const, oauth2: undefined };
    expect(mergeAuthConfigWithVaultValues(auth, { 'oauth2.clientSecret': 'sec' })).toBe(auth);
    expect(mergeAuthConfigWithVaultValues(
      { type: 'bearer', bearerToken: 'live' },
      {},
    )).toEqual({ type: 'bearer', bearerToken: 'live' });
  });

  it('mergeTlsConfigWithVaultValues returns undefined when merged config is empty', () => {
    expect(mergeTlsConfigWithVaultValues(undefined, {})).toBeUndefined();
    expect(extractTlsVaultValues(undefined)).toEqual({});
  });

  it('vault write with empty values deletes memory and persisted record', async () => {
    const removeKey = vi.fn().mockResolvedValue(undefined);
    const writeKey = vi.fn().mockResolvedValue(undefined);
    const readKey = vi.fn().mockResolvedValue(null);
    const vault = createGrpcSecretVault({
      platform: 'web',
      storage: { readKey, writeKey, removeKey },
    });

    await vault.write('tls_pem', 'owner-1', { serverCaPem: VALID_PEM });
    await vault.write('tls_pem', 'owner-1', { serverCaPem: '   ' });
    expect(await vault.read('tls_pem', 'owner-1')).toBeNull();
    expect(removeKey).toHaveBeenCalled();
  });

  it('vault read hydrates memory from persisted blob', async () => {
    const record = {
      values: { serverCaPem: VALID_PEM },
      storageClass: 'encrypted_local' as const,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const readKey = vi.fn().mockResolvedValue(JSON.stringify({ 'tls_pem:owner-2': record }));
    const writeKey = vi.fn().mockResolvedValue(undefined);
    const removeKey = vi.fn().mockResolvedValue(undefined);
    const vault = createGrpcSecretVault({
      platform: 'web',
      storage: { readKey, writeKey, removeKey },
    });

    const loaded = await vault.read('tls_pem', 'owner-2');
    expect(loaded?.values.serverCaPem).toBe(VALID_PEM);
    expect(await vault.read('tls_pem', 'owner-2')).toBe(loaded);
  });

  it('parsePersistedVaultBlob tolerates invalid JSON via read path', async () => {
    const readKey = vi.fn().mockResolvedValue('not-json');
    const vault = createGrpcSecretVault({
      platform: 'web',
      storage: {
        readKey,
        writeKey: vi.fn(),
        removeKey: vi.fn(),
      },
    });
    expect(await vault.read('tls_pem', 'owner-3')).toBeNull();
  });

  it('delete, deleteOwner, and copyOwner manage scoped records', async () => {
    const writeKey = vi.fn().mockResolvedValue(undefined);
    const removeKey = vi.fn().mockResolvedValue(undefined);
    const persisted: Record<string, string> = {};
    const readKey = vi.fn().mockImplementation(async (key: string) => persisted[key] ?? null);
    const vault = createGrpcSecretVault({
      platform: 'desktop',
      storage: { readKey, writeKey, removeKey },
    });

    await vault.write('auth_credentials', 'owner-a', { bearerToken: 'token-a' });
    await vault.write('tls_pem', 'owner-a', { serverCaPem: VALID_PEM });
    await vault.copyOwner('owner-a', 'owner-b');
    expect(await vault.read('auth_credentials', 'owner-b')).not.toBeNull();
    await vault.delete('tls_pem', 'owner-a');
    expect(await vault.read('tls_pem', 'owner-a')).toBeNull();
    await vault.deleteOwner('owner-b');
    expect(await vault.read('auth_credentials', 'owner-b')).toBeNull();
  });

  it('mergeAuthConfigWithVaultValues returns same reference when inline secret already set', () => {
    const basic = { type: 'basic' as const, basicUsername: 'u', basicPassword: 'live' };
    expect(mergeAuthConfigWithVaultValues(basic, { basicPassword: 'vault' })).toBe(basic);

    const apiKey = { type: 'api_key' as const, apiKeyName: 'x-key', apiKeyValue: 'live' };
    expect(mergeAuthConfigWithVaultValues(apiKey, { apiKeyValue: 'vault' })).toBe(apiKey);

    const oauth = {
      type: 'oauth2' as const,
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 'live' },
    };
    expect(mergeAuthConfigWithVaultValues(oauth, { 'oauth2.clientSecret': 'vault' })).toBe(oauth);
  });

  it('mergeTlsConfigWithVaultValues keeps serverNameOverride without PEM values', () => {
    expect(mergeTlsConfigWithVaultValues(
      { serverNameOverride: 'grpc.local' },
      {},
    )).toEqual({ serverNameOverride: 'grpc.local' });
  });

  it('extractAuthVaultValues returns empty for bearer without token', () => {
    expect(extractAuthVaultValues({ type: 'bearer', bearerToken: '  ' })).toEqual({});
  });

  it('vault read returns cached memory record without re-reading storage', async () => {
    const readKey = vi.fn().mockResolvedValue(null);
    const vault = createGrpcSecretVault({
      platform: 'web',
      storage: {
        readKey,
        writeKey: vi.fn(),
        removeKey: vi.fn(),
      },
    });
    await vault.write('tls_pem', 'owner-cache', { serverCaPem: VALID_PEM });
    readKey.mockClear();
    expect(await vault.read('tls_pem', 'owner-cache')).not.toBeNull();
    expect(readKey).not.toHaveBeenCalled();
  });

  it('web auth credentials stay in memory without persistence', async () => {
    const writeKey = vi.fn().mockResolvedValue(undefined);
    const vault = createGrpcSecretVault({
      platform: 'web',
      storage: {
        readKey: vi.fn().mockResolvedValue(null),
        writeKey,
        removeKey: vi.fn(),
      },
    });
    await vault.write('auth_credentials', 'owner-web', { bearerToken: 'secret' });
    expect(writeKey).not.toHaveBeenCalled();
    expect(await vault.read('auth_credentials', 'owner-web')).not.toBeNull();
  });

  it('extractTlsVaultValues captures client cert and key PEMs', () => {
    expect(extractTlsVaultValues({
      clientCertPem: VALID_PEM,
      clientKeyPem: 'key-pem',
    })).toEqual({
      clientCertPem: VALID_PEM,
      clientKeyPem: 'key-pem',
    });
  });

  it('mergeAuthConfigWithVaultValues returns auth when vault secret is blank', () => {
    const auth = { type: 'basic' as const, basicUsername: 'u', basicPassword: '' };
    expect(mergeAuthConfigWithVaultValues(auth, { basicPassword: '   ' })).toBe(auth);
  });

  it('extractAuthVaultValues and mergeAuth handle unknown auth types', () => {
    const unknown = { type: 'unknown' } as never;
    expect(extractAuthVaultValues(unknown)).toEqual({});
    expect(mergeAuthConfigWithVaultValues(unknown, { bearerToken: 'x' })).toBe(unknown);
  });

  it('mergeTlsConfigWithVaultValues drops config when vault PEM is whitespace-only', () => {
    expect(mergeTlsConfigWithVaultValues(
      { serverCaPem: VALID_PEM },
      { serverCaPem: '   ' },
    )).toBeUndefined();
  });

  it('persists auth credentials on desktop platform', async () => {
    const writeKey = vi.fn().mockResolvedValue(undefined);
    const readKey = vi.fn().mockResolvedValue(null);
    const removeKey = vi.fn().mockResolvedValue(undefined);
    const vault = createGrpcSecretVault({
      platform: 'desktop',
      storage: { readKey, writeKey, removeKey },
    });
    await vault.write('auth_credentials', 'owner-desktop', { bearerToken: 'secret' });
    expect(writeKey).toHaveBeenCalled();
  });

  it('read ignores unknown vault scopes without storage key', async () => {
    const vault = createGrpcSecretVault({ platform: 'web' });
    expect(await vault.read('invalid-scope' as 'tls_pem', 'owner-x')).toBeNull();
  });

  it('inferGrpcTlsModeFromVaultValues returns tls when only client cert is present', () => {
    expect(inferGrpcTlsModeFromVaultValues({ clientCertPem: VALID_PEM })).toBe('tls');
  });

  it('parsePersistedVaultBlob treats non-object JSON as empty via read path', async () => {
    const readKey = vi.fn().mockResolvedValue('null');
    const vault = createGrpcSecretVault({
      platform: 'web',
      storage: { readKey, writeKey: vi.fn(), removeKey: vi.fn() },
    });
    expect(await vault.read('tls_pem', 'owner-null')).toBeNull();
  });

  it('tlsConfigMissingVaultPemFields ignores blank vault entries', () => {
    expect(tlsConfigMissingVaultPemFields({ serverCaPem: VALID_PEM }, { serverCaPem: '   ' })).toBe(false);
  });

  it('mergeTlsConfigWithVaultValues keeps serverNameOverride without PEM material', () => {
    expect(mergeTlsConfigWithVaultValues({ serverNameOverride: 'grpc.local' }, {}))
      .toEqual({ serverNameOverride: 'grpc.local' });
  });
});
