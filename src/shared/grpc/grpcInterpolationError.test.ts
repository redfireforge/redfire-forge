import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import {
  GrpcInterpolationError,
  isGrpcInterpolationHarnessSerializationError,
  resolveGrpcInterpolationHarnessPreTransportCategory,
} from './grpcInterpolationError';

describe('grpcInterpolationError (Phase 9E)', () => {
  it('GrpcInterpolationError carries interpolation error code', () => {
    const error = new GrpcInterpolationError({
      field: 'interpolationEnv',
      code: GRPC_INTERPOLATION_ERROR_CODES.CYCLE,
      message: 'Circular variable reference: a → b → a',
    });
    expect(error.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.CYCLE);
    expect(error.name).toBe('GrpcInterpolationError');
  });

  it('classifies GrpcInterpolationError CYCLE as harness serialization', () => {
    const error = new GrpcInterpolationError({
      field: 'interpolationEnv',
      code: GRPC_INTERPOLATION_ERROR_CODES.CYCLE,
      message: 'Circular variable reference: a → b → a',
    });
    expect(isGrpcInterpolationHarnessSerializationError(error)).toBe(true);
  });

  it('classifies INVALID_TARGET GrpcInterpolationError as harness serialization pre-transport', () => {
    const error = new GrpcInterpolationError({
      field: 'target',
      code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
      message: 'Invalid target',
    });
    expect(isGrpcInterpolationHarnessSerializationError(error)).toBe(true);
    expect(resolveGrpcInterpolationHarnessPreTransportCategory(error)).toBe('serialization');
  });

  it('classifies legacy unresolved template message as serialization', () => {
    expect(isGrpcInterpolationHarnessSerializationError(
      new Error('target contains unresolved template variables: {{missing}}'),
    )).toBe(true);
  });

  it('maps grpcHost target validation plain Error to serialization', () => {
    expect(resolveGrpcInterpolationHarnessPreTransportCategory(
      new Error('Resolve grpcHost in Environment Manager before executing'),
    )).toBe('serialization');
  });
});
