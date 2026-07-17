/**
 * Phase 9D — canonical env token validation tests.
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcCanonicalEnvTokensValid,
  deriveGrpcPortEnvValue,
  extractGrpcPortFromHostPort,
  validateGrpcCanonicalEnvTokens,
  validateGrpcCanonicalEnvTokensForTarget,
  validateGrpcCanonicalEnvTokensForConnection,
  resolveGrpcConnectionTargetTemplate,
} from './grpcCanonicalEnvValidation';

describe('grpcCanonicalEnvValidation (Phase 9D)', () => {
  it('extracts port from host:port addresses', () => {
    expect(extractGrpcPortFromHostPort('localhost:50051')).toBe('50051');
    expect(extractGrpcPortFromHostPort('[::1]:9090')).toBe('9090');
    expect(deriveGrpcPortEnvValue('grpc.example.com:443')).toBe('443');
  });

  it('rejects grpcHost values with URL schemes', () => {
    const issues = validateGrpcCanonicalEnvTokens({
      grpcHost: 'http://localhost:50051',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('grpcHost');
    expect(issues[0]?.message).toContain('host:port');
  });

  it('rejects invalid grpcPort env values', () => {
    const issues = validateGrpcCanonicalEnvTokens({
      grpcPort: '70000',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('grpcPort');
  });

  it('validateGrpcCanonicalEnvTokensForTarget validates referenced grpcPort', () => {
    const issues = validateGrpcCanonicalEnvTokensForTarget(
      { grpcPort: '70000', grpcHost: 'localhost:50051' },
      'orders.example.com:{{grpcPort}}',
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('grpcPort');
  });

  it('rejects grpcHost values without host:port format', () => {
    const issues = validateGrpcCanonicalEnvTokens({
      grpcHost: 'localhost',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('grpcHost');
  });

  it('accepts valid canonical env pair', () => {
    expect(validateGrpcCanonicalEnvTokens({
      grpcHost: 'localhost:50051',
      grpcPort: '50051',
    })).toEqual([]);
  });

  it('assertGrpcCanonicalEnvTokensValid throws on invalid grpcHost', () => {
    expect(() => assertGrpcCanonicalEnvTokensValid({
      grpcHost: 'grpc://bad:50051',
    })).toThrow(/host:port/);
  });

  it('validateGrpcCanonicalEnvTokensForTarget skips unreferenced invalid env values', () => {
    const issues = validateGrpcCanonicalEnvTokensForTarget(
      { grpcHost: 'http://bad:50051' },
      'localhost:50051',
    );
    expect(issues).toEqual([]);
  });

  it('validateGrpcCanonicalEnvTokensForTarget validates referenced grpcHost', () => {
    const issues = validateGrpcCanonicalEnvTokensForTarget(
      { grpcHost: 'http://bad:50051' },
      '{{grpcHost}}',
    );
    expect(issues).toHaveLength(1);
  });

  it('validateGrpcCanonicalEnvTokensForConnection uses profile target when scenario target is empty', () => {
    const issues = validateGrpcCanonicalEnvTokensForConnection(
      { grpcHost: 'http://bad:50051' },
      { target: '', connectionId: 'profile-1' },
      [{
        id: 'profile-1',
        name: 'Orders',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
      }],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('grpcHost');
  });

  it('resolveGrpcConnectionTargetTemplate follows tab → profile → page precedence', () => {
    expect(resolveGrpcConnectionTargetTemplate(
      { target: '', connectionId: 'p1' },
      [{ id: 'p1', name: 'P', target: '{{grpcHost}}', tlsMode: 'disabled' }],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    )).toBe('{{grpcHost}}');
  });

  it('skips tokens not present in env map', () => {
    expect(validateGrpcCanonicalEnvTokens({ greeting: 'hello' })).toEqual([]);
  });
});
