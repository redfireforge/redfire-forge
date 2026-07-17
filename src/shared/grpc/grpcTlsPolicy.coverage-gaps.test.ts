import { describe, expect, it } from 'vitest';
import {
  normalizeGrpcTlsConfig,
  prepareGrpcTarget,
  validateGrpcTlsConfigContract,
} from './grpcTlsPolicy';

const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;

const VALID_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC
-----END PRIVATE KEY-----`;

describe('grpcTlsPolicy coverage gaps', () => {
  it('normalizeGrpcTlsConfig retains client cert and key material', () => {
    expect(normalizeGrpcTlsConfig({
      clientCertPem: VALID_CERT,
      clientKeyPem: VALID_KEY,
    }, 'mtls')).toEqual({
      clientCertPem: VALID_CERT,
      clientKeyPem: VALID_KEY,
    });
  });

  it('normalizeGrpcTlsConfig returns undefined when all fields strip empty', () => {
    expect(normalizeGrpcTlsConfig({ serverCaPem: '  ' }, 'tls')).toBeUndefined();
  });

  it('validateGrpcTlsConfigContract accepts empty tls config for tls and disabled modes', () => {
    expect(validateGrpcTlsConfigContract('tls', undefined)).toEqual([]);
    expect(validateGrpcTlsConfigContract('disabled', undefined)).toEqual([]);
  });

  it('validateGrpcTlsConfigContract accepts full mtls configuration', () => {
    expect(validateGrpcTlsConfigContract('mtls', {
      serverCaPem: VALID_CERT,
      clientCertPem: VALID_CERT,
      clientKeyPem: VALID_KEY,
    })).toEqual([]);
  });

  it('validateGrpcTlsConfigContract skips optional empty pem fields', () => {
    expect(validateGrpcTlsConfigContract('tls', {
      serverCaPem: '',
      clientCertPem: undefined,
      clientKeyPem: '   ',
    })).toEqual([]);
  });

  it('prepareGrpcTarget applies default tls mode and keeps invalid tlsConfig when issues exist', () => {
    const prepared = prepareGrpcTarget({
      address: 'localhost:50051',
      tlsConfig: { serverCaPem: 'not-pem' },
    });
    expect(prepared.target.tlsMode).toBe('disabled');
    expect(prepared.issues).toHaveLength(1);
    expect(prepared.target.tlsConfig?.serverCaPem).toBe('not-pem');
  });

  it('prepareGrpcTarget returns normalized mtls config when validation passes', () => {
    const prepared = prepareGrpcTarget({
      address: 'localhost:50051',
      tlsMode: 'mtls',
      tlsConfig: {
        serverCaPem: VALID_CERT,
        clientCertPem: VALID_CERT,
        clientKeyPem: VALID_KEY,
      },
    });
    expect(prepared.issues).toEqual([]);
    expect(prepared.target.tlsConfig?.clientKeyPem).toBe(VALID_KEY);
  });
});
