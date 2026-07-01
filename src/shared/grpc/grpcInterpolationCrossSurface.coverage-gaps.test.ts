/**
 * Coverage gaps — grpcInterpolationCrossSurface.ts (Phase 9H).
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcInterpolationExecuteParity,
  grpcExecuteSnapshotToInterpolationComparable,
  type GrpcInterpolationExecuteComparable,
} from './grpcInterpolationCrossSurface';

const BASE: GrpcInterpolationExecuteComparable = {
  targetAddress: 'localhost:50051',
  body: { message: 'hello' },
  metadata: { 'x-env': 'dev' },
  authBearer: 'token-abc',
};

describe('grpcInterpolationCrossSurface coverage gaps', () => {
  it('assertGrpcInterpolationExecuteParity throws on target mismatch', () => {
    expect(() => assertGrpcInterpolationExecuteParity(
      'studio',
      BASE,
      'harness',
      { ...BASE, targetAddress: 'other:50051' },
    )).toThrow(/target localhost:50051 !== other:50051/);
  });

  it('assertGrpcInterpolationExecuteParity throws on body mismatch', () => {
    expect(() => assertGrpcInterpolationExecuteParity(
      'studio',
      BASE,
      'harness',
      { ...BASE, body: { message: 'different' } },
    )).toThrow(/body .* !==/);
  });

  it('assertGrpcInterpolationExecuteParity throws on metadata mismatch', () => {
    expect(() => assertGrpcInterpolationExecuteParity(
      'studio',
      BASE,
      'harness',
      { ...BASE, metadata: { 'x-env': 'prod' } },
    )).toThrow(/metadata .* !==/);
  });

  it('assertGrpcInterpolationExecuteParity throws on bearer token mismatch', () => {
    expect(() => assertGrpcInterpolationExecuteParity(
      'studio',
      BASE,
      'harness',
      { ...BASE, authBearer: 'other-token' },
    )).toThrow(/bearer token-abc !== other-token/);
  });

  it('grpcExecuteSnapshotToInterpolationComparable handles missing metadata and non-bearer auth', () => {
    const comparable = grpcExecuteSnapshotToInterpolationComparable({
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      body: { message: 'hello' },
      auth: { type: 'none' },
    });
    expect(comparable.metadata).toEqual({});
    expect(comparable.authBearer).toBeUndefined();
  });
});
