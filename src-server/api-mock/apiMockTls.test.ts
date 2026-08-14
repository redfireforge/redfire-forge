import { describe, it, expect } from 'vitest';
import { peerCertificateAttrs, validateTlsMaterial } from './apiMockTls';

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

describe('peerCertificateAttrs', () => {
  it('returns empty attrs when the socket is not TLS', () => {
    expect(peerCertificateAttrs(null)).toEqual({});
    expect(peerCertificateAttrs({})).toEqual({});
  });

  it('extracts CN and fingerprint without PEM material', async () => {
    const { peerCertificateAttrs } = await import('./apiMockTls');
    const attrs = peerCertificateAttrs({
      getPeerCertificate: () => ({
        subject: { CN: 'integration-client' },
        fingerprint256: 'AA:BB:CC:DD',
      }),
    });
    expect(attrs).toEqual({
      clientCertSubject: 'CN=integration-client',
      clientCertFingerprint: 'aabbccdd',
    });
    expect(JSON.stringify(attrs)).not.toContain('BEGIN');
  });

  it('uses the first non-empty CN when Node presents an array', () => {
    expect(peerCertificateAttrs({
      getPeerCertificate: () => ({
        subject: { CN: ['', '  ', 'multi-cn-client'] },
      }),
    })).toEqual({ clientCertSubject: 'CN=multi-cn-client' });
  });

  it('falls back to a DNS SAN when CN is absent', () => {
    expect(peerCertificateAttrs({
      getPeerCertificate: () => ({
        subject: {},
        subjectaltname: 'IP Address:127.0.0.1, DNS:api.example.test, DNS:localhost',
      }),
    })).toEqual({ clientCertSubject: 'CN=api.example.test' });
  });

  it('ignores empty certs and extractor failures', async () => {
    const { peerCertificateAttrs } = await import('./apiMockTls');
    expect(peerCertificateAttrs({ getPeerCertificate: () => ({}) })).toEqual({});
    expect(peerCertificateAttrs({ getPeerCertificate: () => null as never })).toEqual({});
    expect(peerCertificateAttrs({
      getPeerCertificate: () => { throw new Error('not tls'); },
    })).toEqual({});
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
