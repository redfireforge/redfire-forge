/**
 * Coverage gaps — grpcCanonicalEnvValidation.ts (Phase 9D).
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcCanonicalEnvTokensValidForConnection,
  assertGrpcCanonicalEnvTokensValidForTarget,
  deriveGrpcPortEnvValue,
  extractGrpcPortFromHostPort,
  findGrpcCanonicalEnvIssue,
  grpcCanonicalEnvIssueToGrpcErrorCode,
  validateGrpcCanonicalEnvTokens,
  validateGrpcCanonicalEnvTokensForTarget,
} from './grpcCanonicalEnvValidation';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';

describe('grpcCanonicalEnvValidation coverage gaps', () => {
  it('extractGrpcPortFromHostPort returns undefined for non host:port targets', () => {
    expect(extractGrpcPortFromHostPort('in-process:demo')).toBeUndefined();
    expect(extractGrpcPortFromHostPort('not-a-valid-target')).toBeUndefined();
  });

  it('deriveGrpcPortEnvValue returns undefined for blank grpcHost', () => {
    expect(deriveGrpcPortEnvValue(undefined)).toBeUndefined();
    expect(deriveGrpcPortEnvValue('   ')).toBeUndefined();
  });

  it('validateGrpcCanonicalEnvTokens flags empty grpcHost and grpcPort values', () => {
    const hostIssues = validateGrpcCanonicalEnvTokens({ grpcHost: '   ' });
    expect(hostIssues[0]?.field).toBe('grpcHost');
    expect(hostIssues[0]?.message).toContain('grpcHost');

    const portIssues = validateGrpcCanonicalEnvTokens({ grpcPort: '' });
    expect(portIssues[0]?.field).toBe('grpcPort');
    expect(portIssues[0]?.message).toContain('grpcPort');
  });

  it('validateGrpcCanonicalEnvTokens rejects non-numeric grpcPort env values', () => {
    const issues = validateGrpcCanonicalEnvTokens({ grpcPort: '50abc' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('grpcPort');
  });

  it('validateGrpcCanonicalEnvTokensForTarget ignores templates with invalid interpolation syntax', () => {
    const issues = validateGrpcCanonicalEnvTokensForTarget(
      { grpcHost: 'http://bad:50051' },
      '{{}}',
    );
    expect(issues).toEqual([]);
  });

  it('assertGrpcCanonicalEnvTokensValidForTarget throws the first issue message', () => {
    expect(() => assertGrpcCanonicalEnvTokensValidForTarget(
      { grpcHost: 'http://bad:50051' },
      '{{grpcHost}}',
    )).toThrow(/host:port/);
  });

  it('assertGrpcCanonicalEnvTokensValidForConnection throws when profile target is invalid', () => {
    expect(() => assertGrpcCanonicalEnvTokensValidForConnection(
      { grpcPort: '99999' },
      { target: 'orders.example.com:{{grpcPort}}', connectionId: '' },
      [],
      { target: 'orders.example.com:{{grpcPort}}', tlsMode: 'disabled' },
    )).toThrow(/grpcPort/);
  });

  it('findGrpcCanonicalEnvIssue returns the first matching token issue', () => {
    const issue = findGrpcCanonicalEnvIssue({ grpcPort: '0' }, 'grpcPort');
    expect(issue?.field).toBe('grpcPort');
    expect(issue?.code).toBeDefined();
  });

  it('grpcCanonicalEnvIssueToGrpcErrorCode maps issues to GRPC_INVALID_TARGET', () => {
    expect(grpcCanonicalEnvIssueToGrpcErrorCode({
      field: 'grpcHost',
      code: GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
      message: 'missing',
      context: 'target',
    })).toBe('GRPC_INVALID_TARGET');
    expect(grpcCanonicalEnvIssueToGrpcErrorCode({
      field: 'grpcPort',
      code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
      message: 'invalid',
      context: 'target',
    })).toBe('GRPC_INVALID_TARGET');
  });
});
