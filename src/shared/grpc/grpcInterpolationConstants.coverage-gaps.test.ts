import { describe, expect, it } from 'vitest';
import {
  GRPC_CANONICAL_ENV_TOKENS,
  GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY,
  GRPC_INTERPOLATION_ALLOWED_CONTEXTS,
  GRPC_INTERPOLATION_ERROR_CODES,
  GRPC_INTERPOLATION_VAR_NAME_PATTERN,
  GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS,
  isGrpcInterpolationAllowedContext,
  isGrpcStructuralInterpolationForbiddenField,
} from './grpcInterpolationConstants';

describe('grpcInterpolationConstants coverage gaps', () => {
  it('exports harness error categories and variable name pattern', () => {
    expect(GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN]).toBe('serialization');
    expect(GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[GRPC_INTERPOLATION_ERROR_CODES.VALIDATION]).toBe('validation');
    expect(GRPC_INTERPOLATION_VAR_NAME_PATTERN.test('valid_name_1')).toBe(true);
    expect(GRPC_INTERPOLATION_VAR_NAME_PATTERN.test('1invalid')).toBe(false);
  });

  it('identifies structural forbidden fields', () => {
    expect(isGrpcStructuralInterpolationForbiddenField('service')).toBe(true);
    expect(isGrpcStructuralInterpolationForbiddenField('descriptorKey')).toBe(true);
    expect(isGrpcStructuralInterpolationForbiddenField('grpcTrailer')).toBe(true);
    expect(isGrpcStructuralInterpolationForbiddenField('customField')).toBe(false);
  });

  it('identifies allowed interpolation contexts', () => {
    expect(isGrpcInterpolationAllowedContext('metadata_value')).toBe(true);
    expect(isGrpcInterpolationAllowedContext('target')).toBe(true);
    expect(isGrpcInterpolationAllowedContext('not-a-context')).toBe(false);
  });

  it('exports canonical env tokens and error codes', () => {
    expect(GRPC_CANONICAL_ENV_TOKENS).toEqual(['grpcHost', 'grpcPort']);
    expect(GRPC_INTERPOLATION_ERROR_CODES.CYCLE).toBe('grpc.interpolation.cycle');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('target');
    expect(GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS).toContain('callType');
  });
});
