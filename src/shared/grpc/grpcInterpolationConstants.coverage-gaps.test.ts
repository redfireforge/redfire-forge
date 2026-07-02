import { describe, expect, it } from 'vitest';
import {
  GRPC_CANONICAL_ENV_TOKENS,
  GRPC_INTERPOLATION_ALLOWED_CONTEXTS,
  GRPC_INTERPOLATION_ERROR_CODES,
  GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS,
  isGrpcInterpolationAllowedContext,
  isGrpcStructuralInterpolationForbiddenField,
} from './grpcInterpolationConstants';

describe('grpcInterpolationConstants coverage gaps', () => {
  it('identifies structural forbidden fields', () => {
    expect(isGrpcStructuralInterpolationForbiddenField('service')).toBe(true);
    expect(isGrpcStructuralInterpolationForbiddenField('descriptorKey')).toBe(true);
    expect(isGrpcStructuralInterpolationForbiddenField('customField')).toBe(false);
  });

  it('identifies allowed interpolation contexts', () => {
    expect(isGrpcInterpolationAllowedContext('metadata_value')).toBe(true);
    expect(isGrpcInterpolationAllowedContext('not-a-context')).toBe(false);
  });

  it('exports canonical env tokens and error codes', () => {
    expect(GRPC_CANONICAL_ENV_TOKENS).toEqual(['grpcHost', 'grpcPort']);
    expect(GRPC_INTERPOLATION_ERROR_CODES.CYCLE).toBe('grpc.interpolation.cycle');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('target');
    expect(GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS).toContain('callType');
  });
});
