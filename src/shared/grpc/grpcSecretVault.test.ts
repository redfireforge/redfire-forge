/**
 * Phase 4E — secret vault adapter tests.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  GRPC_AUTH_SECRETS_STORAGE_KEY,
  GRPC_TLS_STORAGE_KEY,
} from './contracts';
import {
  createGrpcSecretVault,
  extractAuthVaultValues,
  extractTlsVaultValues,
  mergeAuthConfigWithVaultValues,
  mergeTlsConfigWithVaultValues,
  resolveGrpcVaultOwnerId,
  resolveGrpcSecretStorageClassForScope,
} from './grpcSecretVault';

const VALID_PEM = `-----BEGIN CERTIFICATE-----
SECRET-CA
-----END CERTIFICATE-----`;

describe('grpcSecretVault (Phase 4E)', () => {
  it('prefers connectionId as vault owner key, then target, then tab id', () => {
    expect(resolveGrpcVaultOwnerId({ id: 'tab-1', connectionId: 'profile-a' })).toBe('profile-a');
    expect(resolveGrpcVaultOwnerId({ id: 'tab-1', target: 'localhost:50051' })).toBe('target:localhost:50051');
    expect(resolveGrpcVaultOwnerId({ id: 'tab-1' })).toBe('tab-1');
  });

  it('resolves storage classes per platform and scope', () => {
    expect(resolveGrpcSecretStorageClassForScope('auth_credentials', 'web')).toBe('session_memory');
    expect(resolveGrpcSecretStorageClassForScope('auth_credentials', 'desktop')).toBe('encrypted_local');
    expect(resolveGrpcSecretStorageClassForScope('tls_pem', 'web')).toBe('encrypted_local');
  });

  it('extracts and merges TLS vault values', () => {
    const values = extractTlsVaultValues({
      serverCaPem: VALID_PEM,
      serverNameOverride: 'grpc.local',
    });
    expect(values.serverCaPem).toContain('SECRET-CA');
    const merged = mergeTlsConfigWithVaultValues(
      { serverNameOverride: 'grpc.local' },
      values,
    );
    expect(merged?.serverCaPem).toBe(VALID_PEM);
    expect(merged?.serverNameOverride).toBe('grpc.local');
  });

  it('extracts and merges auth vault values', () => {
    const values = extractAuthVaultValues({
      type: 'bearer',
      bearerToken: 'raw-token-value',
    });
    expect(values.bearerToken).toBe('raw-token-value');
    const merged = mergeAuthConfigWithVaultValues(
      { type: 'bearer', bearerToken: '' },
      values,
    );
    expect(merged?.bearerToken).toBe('raw-token-value');
  });

  it('mergeAuthConfigWithVaultValues returns same reference when tab already has the token', () => {
    const auth = { type: 'bearer' as const, bearerToken: 'existing' };
    const merged = mergeAuthConfigWithVaultValues(auth, { bearerToken: 'vault-token' });
    expect(merged).toBe(auth);
  });

  it('persists TLS on web and auth only on desktop', async () => {
    const writeKey = vi.fn().mockResolvedValue(undefined);
    const readKey = vi.fn().mockResolvedValue(null);
    const removeKey = vi.fn().mockResolvedValue(undefined);
    const webVault = createGrpcSecretVault({
      platform: 'web',
      storage: { readKey, writeKey, removeKey },
    });

    await webVault.write('tls_pem', 'tab-1', { serverCaPem: VALID_PEM });
    expect(writeKey).toHaveBeenCalledWith(
      GRPC_TLS_STORAGE_KEY,
      expect.stringContaining('tls_pem:tab-1'),
    );

    writeKey.mockClear();
    await webVault.write('auth_credentials', 'tab-1', { bearerToken: 'secret' });
    expect(writeKey).not.toHaveBeenCalled();

    const desktopVault = createGrpcSecretVault({
      platform: 'desktop',
      storage: { readKey, writeKey, removeKey },
    });
    await desktopVault.write('auth_credentials', 'tab-1', { bearerToken: 'secret' });
    expect(writeKey).toHaveBeenCalledWith(
      GRPC_AUTH_SECRETS_STORAGE_KEY,
      expect.stringContaining('auth_credentials:tab-1'),
    );
  });

  it('round-trips memory vault read/write/delete/copy', async () => {
    const vault = createGrpcSecretVault({ platform: 'web' });
    await vault.write('tls_pem', 'src', { serverCaPem: VALID_PEM });
    const record = await vault.read('tls_pem', 'src');
    expect(record?.values.serverCaPem).toBe(VALID_PEM);

    await vault.copyOwner('src', 'dst');
    expect(await vault.read('tls_pem', 'dst')).toEqual(record);

    await vault.deleteOwner('src');
    expect(await vault.read('tls_pem', 'src')).toBeNull();
    expect(await vault.read('tls_pem', 'dst')).not.toBeNull();
  });

  it('preserves auth and BSR entries in shared auth storage blob on desktop', async () => {
    let stored: string | null = null;
    const storage = {
      readKey: vi.fn(async () => stored),
      writeKey: vi.fn(async (_key: string, value: string) => {
        stored = value;
      }),
      removeKey: vi.fn(async () => {
        stored = null;
      }),
    };
    const vault = createGrpcSecretVault({ platform: 'desktop', storage });

    await vault.write('auth_credentials', 'owner-1', { bearerToken: 'tok' });
    await vault.write('bsr_token', 'owner-1', { bsrToken: 'bsr-secret' });

    const auth = await vault.read('auth_credentials', 'owner-1');
    const bsr = await vault.read('bsr_token', 'owner-1');
    expect(auth?.values.bearerToken).toBe('tok');
    expect(bsr?.values.bsrToken).toBe('bsr-secret');

    const blob = JSON.parse(stored!) as Record<string, unknown>;
    expect(Object.keys(blob)).toEqual(
      expect.arrayContaining(['auth_credentials:owner-1', 'bsr_token:owner-1']),
    );
  });
});
