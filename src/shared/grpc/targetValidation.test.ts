import { describe, expect, it } from 'vitest';
import {
  validateGrpcTargetAddress,
  validateResolvedGrpcTargetAddress,
  isValidGrpcTargetAddress,
  grpcTargetValidationMessage,
  withGrpcTargetValidationMessage,
} from './targetValidation';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';

describe('targetValidation (Phase 1A + 9D)', () => {
  it('accepts host:port targets including Spring Boot default port', () => {
    expect(validateGrpcTargetAddress('localhost:50051')).toEqual({
      valid: true,
      kind: 'host_port',
      normalized: 'localhost:50051',
    });
    expect(validateGrpcTargetAddress('localhost:9090').valid).toBe(true);
    expect(validateGrpcTargetAddress('127.0.0.1:9090').valid).toBe(true);
    expect(validateGrpcTargetAddress('[::1]:50051').valid).toBe(true);
  });

  it('accepts in-process Spring targets', () => {
    expect(validateGrpcTargetAddress('in-process:test-server')).toEqual({
      valid: true,
      kind: 'in_process',
      normalized: 'in-process:test-server',
    });
  });

  it('rejects invalid ports and malformed addresses', () => {
    expect(validateGrpcTargetAddress('localhost:0').valid).toBe(false);
    expect(validateGrpcTargetAddress('localhost:70000').valid).toBe(false);
    expect(validateGrpcTargetAddress('not-an-address').valid).toBe(false);
    expect(isValidGrpcTargetAddress('')).toBe(false);
  });

  it('rejects unresolved env tokens at connect time', () => {
    const unresolved = validateResolvedGrpcTargetAddress('{{grpcHost}}');
    expect(unresolved.valid).toBe(false);
    if (!unresolved.valid) {
      expect(unresolved.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN);
      expect(unresolved.reason).toContain('grpcHost');
    }
    expect(validateResolvedGrpcTargetAddress('localhost:50051').valid).toBe(true);
  });

  it('rejects illegal URL schemes (Phase 9D)', () => {
    for (const target of [
      'http://localhost:50051',
      'https://localhost:50051',
      'grpc://localhost:50051',
      'grpcs://localhost:50051',
      'dns:///localhost:50051',
    ]) {
      const result = validateGrpcTargetAddress(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.kind).toBe('illegal_scheme');
      }
    }
  });

  it('withGrpcTargetValidationMessage includes remediation hint in reason', () => {
    const formatted = withGrpcTargetValidationMessage(
      validateResolvedGrpcTargetAddress('{{grpcHost}}'),
    );
    expect(formatted.valid).toBe(false);
    if (!formatted.valid) {
      expect(formatted.reason).toContain('—');
      expect(formatted.hint).toBeTruthy();
    }
  });

  it('trims surrounding whitespace before validation', () => {
    expect(validateGrpcTargetAddress('  localhost:50051  ').valid).toBe(true);
  });

  it('grpcTargetValidationMessage returns empty string for valid result', () => {
    expect(grpcTargetValidationMessage({ valid: true })).toBe('');
  });
});
