import { describe, it, expect } from 'vitest';
import { validateTlsMaterial } from './apiMockTls';

const CERT = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
const KEY = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----';

describe('validateTlsMaterial', () => {
  it('accepts a matching PEM certificate and key', () => {
    expect(validateTlsMaterial(CERT, KEY)).toEqual({ ok: true });
  });

  it('accepts RSA and EC key headers', () => {
    expect(validateTlsMaterial(CERT, '-----BEGIN RSA PRIVATE KEY-----\nx\n-----END RSA PRIVATE KEY-----').ok).toBe(true);
    expect(validateTlsMaterial(CERT, '-----BEGIN EC PRIVATE KEY-----\nx\n-----END EC PRIVATE KEY-----').ok).toBe(true);
  });

  it('rejects empty material', () => {
    expect(validateTlsMaterial('', KEY).ok).toBe(false);
    expect(validateTlsMaterial(CERT, '  ').ok).toBe(false);
  });

  it('rejects a certificate that is not PEM', () => {
    const res = validateTlsMaterial('not a cert', KEY);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/CERTIFICATE/);
  });

  it('rejects a key that is not PEM', () => {
    const res = validateTlsMaterial(CERT, 'nope');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/PRIVATE KEY/);
  });
});

describe('generateClientCredentials', () => {
  it('issues a clientAuth certificate signed by the returned CA', async () => {
    const { generateClientCredentials } = await import('./apiMockTls');
    const creds = await generateClientCredentials('acme-client');

    expect(creds.commonName).toBe('acme-client');
    expect(creds.caCertPem).toContain('BEGIN CERTIFICATE');
    expect(creds.clientCertPem).toContain('BEGIN CERTIFICATE');
    expect(creds.clientKeyPem).toMatch(/BEGIN (?:RSA |EC )?PRIVATE KEY/);
    // The client bundle must not smuggle the CA private key.
    expect(creds.clientCertPem).not.toContain('PRIVATE KEY');
  }, 30_000);

  it('falls back to a default common name', async () => {
    const { generateClientCredentials } = await import('./apiMockTls');
    const creds = await generateClientCredentials('   ');
    expect(creds.commonName).toBe('api-mock-client');
  }, 30_000);
});
