import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiMockTls coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('node:child_process');
    vi.doUnmock('node:fs/promises');
  });

  async function importTlsWithExecFile(
    impl: (...args: unknown[]) => void,
  ) {
    vi.doMock('node:child_process', () => ({
      execFile: vi.fn(impl),
    }));
    return import('./apiMockTls');
  }

  it('generateSelfSigned builds SAN lists for DNS and IP hosts', async () => {
    const { generateSelfSigned } = await import('./apiMockTls');
    const pair = await generateSelfSigned(['localhost', '127.0.0.1', '::1', 'mock.local']);
    expect(pair.certPem).toContain('BEGIN CERTIFICATE');
    expect(pair.keyPem).toMatch(/BEGIN (?:RSA |EC )?PRIVATE KEY/);
  }, 30_000);

  it('generateSelfSigned falls back to localhost SAN when hosts are empty', async () => {
    const { generateSelfSigned } = await import('./apiMockTls');
    const pair = await generateSelfSigned([]);
    expect(pair.certPem).toContain('BEGIN CERTIFICATE');
  }, 30_000);

  it('generateSelfSigned maps missing openssl to a helpful error', async () => {
    const { generateSelfSigned } = await importTlsWithExecFile((_cmd, _args, cb) => {
      const err = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
      (cb as (error: Error | null) => void)(err);
    });

    await expect(generateSelfSigned()).rejects.toThrow(/openssl was not found on PATH/i);
  });

  it('generateSelfSigned wraps other openssl failures', async () => {
    const { generateSelfSigned } = await importTlsWithExecFile((_cmd, _args, cb) => {
      (cb as (error: Error | null) => void)(new Error('openssl blew up'));
    });

    await expect(generateSelfSigned()).rejects.toThrow(/Could not generate a self-signed certificate: openssl blew up/);
  });

  it('generateSelfSigned wraps non-Error failures', async () => {
    const { generateSelfSigned } = await importTlsWithExecFile((_cmd, _args, cb) => {
      (cb as (error: unknown) => void)('raw failure');
    });

    await expect(generateSelfSigned()).rejects.toThrow(/Could not generate a self-signed certificate: raw failure/);
  });

  it('generateClientCredentials maps missing openssl to a helpful error', async () => {
    const { generateClientCredentials } = await importTlsWithExecFile((_cmd, _args, cb) => {
      const err = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
      (cb as (error: Error | null) => void)(err);
    });

    await expect(generateClientCredentials()).rejects.toThrow(/openssl was not found on PATH/i);
  });

  it('generateClientCredentials wraps other openssl failures', async () => {
    const { generateClientCredentials } = await importTlsWithExecFile((_cmd, _args, cb) => {
      (cb as (error: Error | null) => void)(new Error('signing failed'));
    });

    await expect(generateClientCredentials()).rejects.toThrow(/Could not issue a client certificate: signing failed/);
  });

  it('generateClientCredentials wraps non-Error failures', async () => {
    const { generateClientCredentials } = await importTlsWithExecFile((_cmd, _args, cb) => {
      (cb as (error: unknown) => void)('broken');
    });

    await expect(generateClientCredentials()).rejects.toThrow(/Could not issue a client certificate: broken/);
  });

  it('generateSelfSigned ignores temp directory cleanup failures', async () => {
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>();
      return {
        ...actual,
        rm: vi.fn(async () => { throw new Error('cleanup failed'); }),
      };
    });

    const { generateSelfSigned } = await import('./apiMockTls');
    const pair = await generateSelfSigned(['127.0.0.1']);
    expect(pair.certPem).toContain('BEGIN CERTIFICATE');
  }, 30_000);

  it('generateClientCredentials ignores temp directory cleanup failures', async () => {
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>();
      return {
        ...actual,
        rm: vi.fn(async () => { throw new Error('cleanup failed'); }),
      };
    });

    const { generateClientCredentials } = await import('./apiMockTls');
    const creds = await generateClientCredentials('cleanup-client');
    expect(creds.clientCertPem).toContain('BEGIN CERTIFICATE');
  }, 30_000);
});
