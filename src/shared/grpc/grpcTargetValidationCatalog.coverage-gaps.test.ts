/**
 * Coverage gaps — grpcTargetValidationCatalog.ts (Phase 9D).
 */
import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import {
  buildGrpcTargetValidationFailure,
  buildUnresolvedGrpcTargetFailure,
  formatGrpcTargetValidationError,
} from './grpcTargetValidationCatalog';

describe('grpcTargetValidationCatalog coverage gaps', () => {
  it('buildGrpcTargetValidationFailure covers empty, port, env, and default kinds', () => {
    expect(buildGrpcTargetValidationFailure('empty').reason).toContain('required');
    expect(buildGrpcTargetValidationFailure('missing_grpc_host').code)
      .toBe(GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN);
    expect(buildGrpcTargetValidationFailure('missing_grpc_port').reason).toContain('grpcPort');
    expect(buildGrpcTargetValidationFailure('invalid_port').reason).toContain('65535');
    expect(buildGrpcTargetValidationFailure('invalid_grpc_host_env').hint).toContain('Environment Manager');
    expect(buildGrpcTargetValidationFailure('invalid_grpc_port_env').reason).toContain('numeric port');
    expect(buildGrpcTargetValidationFailure('invalid_format').kind).toBe('invalid_format');
  });

  it('buildUnresolvedGrpcTargetFailure handles generic unresolved tokens', () => {
    const failure = buildUnresolvedGrpcTargetFailure('{{customToken}}');
    expect(failure.reason).toContain('customToken');
    expect(failure.hint).toContain('missing variable');
  });

  it('buildUnresolvedGrpcTargetFailure uses env-manager hint for grpcHost and grpcPort', () => {
    const hostFailure = buildGrpcTargetValidationFailure('unresolved_token', { tokenName: 'grpcHost' });
    expect(hostFailure.hint).toContain('Environment Manager');

    const portFailure = buildGrpcTargetValidationFailure('unresolved_token', { tokenName: 'grpcPort' });
    expect(portFailure.hint).toContain('Environment Manager');
  });

  it('buildUnresolvedGrpcTargetFailure falls back when token name is missing', () => {
    const failure = buildGrpcTargetValidationFailure('unresolved_token');
    expect(failure.reason).toBe('Resolve environment variables before connecting');
  });

  it('formatGrpcTargetValidationError returns reason only when hint is absent', () => {
    expect(formatGrpcTargetValidationError({ reason: 'Bad target' })).toBe('Bad target');
  });
});
