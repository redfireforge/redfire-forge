import { describe, expect, it, vi } from 'vitest';
import { buildLegacyGrpcEnvVarMap } from './grpcStudioPageEnv';

vi.mock('../../../shared/grpc/targetValidation', () => ({
  validateGrpcTargetAddress: (value: string) => ({ valid: value === 'localhost:50051' }),
}));

describe('grpcStudioPageEnv', () => {
  it('maps grpcHost only for valid non-http targets', () => {
    expect(buildLegacyGrpcEnvVarMap('localhost:50051')).toEqual({ grpcHost: 'localhost:50051' });
    expect(buildLegacyGrpcEnvVarMap('https://example.com')).toEqual({});
    expect(buildLegacyGrpcEnvVarMap('invalid target')).toEqual({});
  });

  it('includes envName and svcName when provided', () => {
    expect(buildLegacyGrpcEnvVarMap('localhost:50051', 'prod', 'orders')).toEqual({
      grpcHost: 'localhost:50051',
      envName: 'prod',
      svcName: 'orders',
    });
  });

  it('ignores blank resolvedBaseUrl after trim', () => {
    expect(buildLegacyGrpcEnvVarMap('   ', 'dev', 'svc')).toEqual({ envName: 'dev', svcName: 'svc' });
  });
});