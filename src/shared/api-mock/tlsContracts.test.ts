import { describe, it, expect } from 'vitest';
import {
  containsPrivateKey, redactPemForTrace, extractSubjectCN,
  validateCertPem, validateKeyPem, TLS_DEFAULTS,
} from './tlsContracts';

const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALfRL5KlG6MBMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnNl
cnZlcjAeFw0yNjA4MTEwMDAwMDBaFw0yNzA4MTEwMDAwMDBaMBExDzANBgNVBAMM
BnNlcnZlcjBcMA0GCSqGSIb3DQEBAQUAAwsAMEgCQQC7o4r4s5XP2F3WJJkD3UYK
-----END CERTIFICATE-----`;

const SAMPLE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIBogIBAAJBALujivizlc/YXdYkmQPdRgopBa1TrGnZCOb3LzO5OqP6HJjJ1I=
-----END RSA PRIVATE KEY-----`;

describe('TLS contracts', () => {
  it('TLS_DEFAULTS has expected shape', () => {
    expect(TLS_DEFAULTS.enabled).toBe(false);
    expect(TLS_DEFAULTS.certSource).toBe('generated');
    expect(TLS_DEFAULTS.clientAuth).toBe('none');
  });

  it('containsPrivateKey detects key material', () => {
    expect(containsPrivateKey(SAMPLE_KEY)).toBe(true);
    expect(containsPrivateKey(SAMPLE_CERT)).toBe(false);
    expect(containsPrivateKey('')).toBe(false);
  });

  it('redactPemForTrace replaces content', () => {
    const redacted = redactPemForTrace(SAMPLE_CERT);
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).toContain('-----BEGIN CERTIFICATE-----');
    expect(redacted).not.toContain('MIIBkTCB');
  });

  it('extractSubjectCN extracts CN', () => {
    const pem = 'subject= CN = mock.localhost\nissuer= CN = mock-ca';
    expect(extractSubjectCN(pem)).toBe('mock.localhost');
  });

  it('extractSubjectCN returns undefined for missing CN', () => {
    expect(extractSubjectCN(SAMPLE_CERT)).toBeUndefined();
  });

  it('validateCertPem passes for valid PEM', () => {
    const result = validateCertPem(SAMPLE_CERT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validateCertPem fails for empty', () => {
    expect(validateCertPem(''). valid).toBe(false);
    expect(validateCertPem(undefined).valid).toBe(false);
  });

  it('validateCertPem fails for missing markers', () => {
    expect(validateCertPem('just text').valid).toBe(false);
  });

  it('validateKeyPem passes for valid key', () => {
    expect(validateKeyPem(SAMPLE_KEY).valid).toBe(true);
  });

  it('validateKeyPem fails for empty', () => {
    expect(validateKeyPem('').valid).toBe(false);
    expect(validateKeyPem(undefined).valid).toBe(false);
  });

  it('validateKeyPem fails for missing marker', () => {
    expect(validateKeyPem('not a key').valid).toBe(false);
  });
});
