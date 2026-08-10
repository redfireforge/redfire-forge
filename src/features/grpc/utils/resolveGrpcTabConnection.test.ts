import { describe, expect, it } from 'vitest';
import { resolveGrpcTabConnection, resolveGrpcTabTarget, resolutionToGrpcTarget, canConnectFromResolution } from './resolveGrpcTabConnection';

describe('resolveGrpcTabConnection (Phase 1A)', () => {
  const profiles = [
    { id: 'p1', name: 'Local Go', target: 'localhost:50051', tlsMode: 'disabled' as const },
    { id: 'p2', name: 'Spring', target: 'localhost:9090', tlsMode: 'tls' as const },
  ];

  const pageDefaults = { target: 'localhost:50051', tlsMode: 'disabled' as const };

  it('uses page defaults when tab has no overrides', () => {
    const result = resolveGrpcTabConnection({}, profiles, pageDefaults);
    expect(result.target).toBe('localhost:50051');
    expect(result.tlsMode).toBe('disabled');
  });

  it('inherits profile target when tab links a profile', () => {
    const result = resolveGrpcTabConnection({ connectionId: 'p2' }, profiles, pageDefaults);
    expect(result.target).toBe('localhost:9090');
    expect(result.tlsMode).toBe('tls');
    expect(result.profileName).toBe('Spring');
  });

  it('inherits page tls when tab has no tls override', () => {
    const result = resolveGrpcTabConnection({ connectionId: 'p1' }, profiles, pageDefaults);
    expect(result.tlsMode).toBe('disabled');
  });

  it('tab override wins over profile and page defaults', () => {
    const result = resolveGrpcTabConnection(
      { connectionId: 'p1', target: 'custom:8080', tlsMode: 'mtls' },
      profiles,
      pageDefaults,
    );
    expect(result.target).toBe('custom:8080');
    expect(result.tlsMode).toBe('mtls');
  });

  it('resolveGrpcTabTarget follows the same precedence without tls', () => {
    expect(resolveGrpcTabTarget({ connectionId: 'p2' }, profiles, 'localhost:50051')).toBe(
      'localhost:9090',
    );
    expect(resolveGrpcTabTarget({ target: 'override:1234' }, profiles, 'localhost:50051')).toBe(
      'override:1234',
    );
  });

  it('resolutionToGrpcTarget uses normalized address when valid', () => {
    const resolution = resolveGrpcTabConnection(
      { target: 'localhost:50051' },
      profiles,
      pageDefaults,
    );
    expect(resolutionToGrpcTarget(resolution)).toEqual({
      address: 'localhost:50051',
      tlsMode: 'disabled',
      tlsConfig: undefined,
    });
    expect(canConnectFromResolution(resolution)).toBe(true);
  });

  it('resolutionToGrpcTarget includes normalized tab tlsConfig (Phase 4B)', () => {
    // 50443 is the TLS-capable loopback fixture — 50051 is plaintext-only and
    // prepareGrpcTarget coerces sticky TLS to disabled for that port.
    const resolution = resolveGrpcTabConnection(
      { target: 'localhost:50443', tlsMode: 'tls' },
      profiles,
      pageDefaults,
    );
    const cert = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;
    const target = resolutionToGrpcTarget(resolution, {
      serverCaPem: `  ${cert}  `,
      serverNameOverride: ' grpc.local ',
    });
    expect(target.tlsMode).toBe('tls');
    expect(target.tlsConfig?.serverCaPem).toBe(cert);
    expect(target.tlsConfig?.serverNameOverride).toBe('grpc.local');
  });

  it('canConnectFromResolution is false for unresolved env tokens', () => {
    const resolution = resolveGrpcTabConnection(
      { target: '{{grpcHost}}' },
      profiles,
      pageDefaults,
    );
    expect(canConnectFromResolution(resolution)).toBe(false);
    expect(resolutionToGrpcTarget(resolution).address).toBe('{{grpcHost}}');
  });
});
