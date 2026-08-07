/**
 * Phase 4A — TLS contract validation tests.
 */
import { describe, expect, it } from 'vitest';
import {
  createGrpcTlsTransportBlockedError,
  isGrpcTlsTransportBlocked,
  isKnownEncryptedLoopbackGrpcTarget,
  looksLikePem,
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

describe('grpcTlsPolicy (Phase 4A)', () => {
  it('detects PEM blocks', () => {
    expect(looksLikePem(VALID_CERT)).toBe(true);
    expect(looksLikePem('not-a-pem')).toBe(false);
  });

  it('requires client cert and key for mtls', () => {
    const issues = validateGrpcTlsConfigContract('mtls', {
      serverCaPem: VALID_CERT,
    });
    expect(issues.map((issue) => issue.field).sort()).toEqual([
      'tlsConfig.clientCertPem',
      'tlsConfig.clientKeyPem',
    ]);
  });

  it('rejects any TLS material when tlsMode is disabled', () => {
    const clientIssues = validateGrpcTlsConfigContract('disabled', {
      clientCertPem: VALID_CERT,
      clientKeyPem: VALID_KEY,
    });
    expect(clientIssues[0]?.message).toMatch(/requires tls or mtls/i);

    const caIssues = validateGrpcTlsConfigContract('disabled', {
      serverCaPem: VALID_CERT,
    });
    expect(caIssues[0]?.field).toBe('tlsConfig');

    const overrideIssues = validateGrpcTlsConfigContract('disabled', {
      serverNameOverride: 'grpc.example.com',
    });
    expect(overrideIssues).toHaveLength(1);
  });

  it('does not block TLS transport after Phase 4F', () => {
    expect(isGrpcTlsTransportBlocked('disabled')).toBe(false);
    expect(isGrpcTlsTransportBlocked('tls')).toBe(false);
    expect(isGrpcTlsTransportBlocked('mtls')).toBe(false);
    expect(isGrpcTlsTransportBlocked(undefined)).toBe(false);
    expect(createGrpcTlsTransportBlockedError().code).toBe('GRPC_INVALID_TARGET');
  });

  it('accepts valid tls config and strips serverNameOverride when disabled', () => {
    const issues = validateGrpcTlsConfigContract('tls', {
      serverCaPem: VALID_CERT,
      serverNameOverride: 'grpc.example.com',
    });
    expect(issues).toEqual([]);

    const normalized = normalizeGrpcTlsConfig({
      serverCaPem: VALID_CERT,
      serverNameOverride: 'grpc.example.com',
    }, 'tls');
    expect(normalized?.serverNameOverride).toBe('grpc.example.com');

    const stripped = normalizeGrpcTlsConfig({
      serverNameOverride: 'ignored.example.com',
    }, 'disabled');
    expect(stripped?.serverNameOverride).toBeUndefined();
  });

  it('rejects malformed PEM payloads', () => {
    const issues = validateGrpcTlsConfigContract('tls', {
      serverCaPem: 'plain-text-not-pem',
    });
    expect(issues[0]?.field).toBe('tlsConfig.serverCaPem');
  });

  it('prepareGrpcTarget validates and normalizes TLS for execute snapshots (Phase 4B)', () => {
    const invalid = prepareGrpcTarget({
      address: 'localhost:50443',
      tlsMode: 'mtls',
      tlsConfig: { serverCaPem: VALID_CERT },
    });
    expect(invalid.issues.length).toBeGreaterThan(0);
    expect(invalid.target.tlsConfig?.clientCertPem).toBeUndefined();

    const valid = prepareGrpcTarget({
      address: 'localhost:50443',
      tlsMode: 'tls',
      tlsConfig: {
        serverCaPem: `  ${VALID_CERT}  `,
        serverNameOverride: ' grpc.example.com ',
      },
    });
    expect(valid.issues).toEqual([]);
    expect(valid.target.tlsConfig?.serverCaPem).toBe(VALID_CERT);
    expect(valid.target.tlsConfig?.serverNameOverride).toBe('grpc.example.com');
  });

  it('prepareGrpcTarget coerces sticky TLS/mTLS on plaintext echo ports to disabled', () => {
    const prepared = prepareGrpcTarget({
      address: 'localhost:50051',
      tlsMode: 'mtls',
      tlsConfig: { serverCaPem: VALID_CERT, clientCertPem: VALID_CERT, clientKeyPem: VALID_CERT },
    });
    expect(prepared.issues).toEqual([]);
    expect(prepared.target.tlsMode).toBe('disabled');
    expect(prepared.target.tlsConfig).toBeUndefined();
  });

  it('detects known encrypted loopback demo ports used by TLS/mTLS fixtures', () => {
    expect(isKnownEncryptedLoopbackGrpcTarget('localhost:50443')).toBe(true);
    expect(isKnownEncryptedLoopbackGrpcTarget('127.0.0.1:50444')).toBe(true);
    expect(isKnownEncryptedLoopbackGrpcTarget('localhost:50051')).toBe(false);
  });
});
