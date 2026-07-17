/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGrpcTls } from './useGrpcTls';

const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;

describe('useGrpcTls (Phase 4B / 4G)', () => {
  it('returns valid for disabled mode without TLS material', () => {
    const { result } = renderHook(() => useGrpcTls('disabled', undefined));
    expect(result.current.valid).toBe(true);
    expect(result.current.issues).toEqual([]);
  });

  it('flags invalid mtls config without transport block shim', () => {
    const { result } = renderHook(() => useGrpcTls('mtls', { serverCaPem: VALID_CERT }));
    expect(result.current.valid).toBe(false);
    expect(result.current.issues.length).toBeGreaterThan(0);
    expect('transportBlocked' in result.current).toBe(false);
  });

  it('defaults undefined tlsMode to disabled', () => {
    const { result } = renderHook(() => useGrpcTls(undefined, undefined));
    expect(result.current.valid).toBe(true);
    expect(result.current.issues).toEqual([]);
  });

  it('validates tls mode with server CA and custom address', () => {
    const { result } = renderHook(() => useGrpcTls(
      'tls',
      { serverCaPem: VALID_CERT, serverNameOverride: 'grpc.local' },
      'grpc.example.com:443',
    ));
    expect(result.current.valid).toBe(true);
    expect(result.current.normalizedTlsConfig?.serverCaPem).toBe(VALID_CERT);
  });

  it('validates complete mtls configuration', () => {
    const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC
-----END PRIVATE KEY-----`;
    const { result } = renderHook(() => useGrpcTls('mtls', {
      serverCaPem: VALID_CERT,
      clientCertPem: VALID_CERT,
      clientKeyPem: key,
    }));
    expect(result.current.valid).toBe(true);
  });
});
