/**
 * Phase 9D — target validation catalog tests.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import {
  buildGrpcTargetValidationFailure,
  buildUnresolvedGrpcTargetFailure,
  formatGrpcTargetValidationError,
  grpcTargetHasIllegalScheme,
} from './grpcTargetValidationCatalog';

describe('grpcTargetValidationCatalog (Phase 9D)', () => {
  it('detects illegal URL schemes', () => {
    expect(grpcTargetHasIllegalScheme('http://localhost:50051')).toBe(true);
    expect(grpcTargetHasIllegalScheme('https://localhost:50051')).toBe(true);
    expect(grpcTargetHasIllegalScheme('grpc://localhost:50051')).toBe(true);
    expect(grpcTargetHasIllegalScheme('grpcs://localhost:50051')).toBe(true);
    expect(grpcTargetHasIllegalScheme('dns:///localhost:50051')).toBe(true);
    expect(grpcTargetHasIllegalScheme('localhost:50051')).toBe(false);
  });

  it('maps missing grpcHost token to MISSING_TOKEN with env-manager hint', () => {
    const failure = buildUnresolvedGrpcTargetFailure('{{grpcHost}}');
    expect(failure.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN);
    expect(failure.reason).toContain('grpcHost');
    expect(failure.hint).toContain('Environment Manager');
  });

  it('maps missing grpcPort token to MISSING_TOKEN', () => {
    const failure = buildUnresolvedGrpcTargetFailure('orders.example.com:{{grpcPort}}');
    expect(failure.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN);
    expect(failure.reason).toContain('grpcPort');
  });

  it('formatGrpcTargetValidationError appends remediation hint', () => {
    const failure = buildGrpcTargetValidationFailure('illegal_scheme');
    expect(formatGrpcTargetValidationError(failure)).toContain('—');
    expect(formatGrpcTargetValidationError(failure)).toContain('http://');
  });
});
