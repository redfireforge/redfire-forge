/**
 * Coverage gaps — grpcMockLatencySimulation.ts (Phase 11E).
 */
import { describe, expect, it } from 'vitest';
import {
  GrpcMockLatencyPolicyValidationError,
  assertGrpcMockLatencyPolicy,
  drawGrpcMockJitterMs,
  resolveGrpcMockLatencyMs,
  validateGrpcMockLatencyPolicy,
  GRPC_MOCK_LATENCY_LIMITS,
} from './grpcMockLatencySimulation';

describe('grpcMockLatencySimulation coverage gaps', () => {
  it('GrpcMockLatencyPolicyValidationError falls back when issues array is empty', () => {
    const error = new GrpcMockLatencyPolicyValidationError([]);
    expect(error.message).toBe('Invalid mock latency policy');
    expect(error.issues).toEqual([]);
  });

  it('validateGrpcMockLatencyPolicy rejects non-integer and negative defaultLatencyMs', () => {
    expect(validateGrpcMockLatencyPolicy({ defaultLatencyMs: 1.5 })).toEqual([
      expect.objectContaining({ path: 'defaultLatencyMs' }),
    ]);
    expect(validateGrpcMockLatencyPolicy({ defaultLatencyMs: -1 })).toEqual([
      expect.objectContaining({ path: 'defaultLatencyMs' }),
    ]);
  });

  it('validateGrpcMockLatencyPolicy rejects non-integer and negative jitterMs', () => {
    expect(validateGrpcMockLatencyPolicy({ jitterMs: 2.5 })).toEqual([
      expect.objectContaining({ path: 'jitterMs' }),
    ]);
    expect(validateGrpcMockLatencyPolicy({ jitterMs: -3 })).toEqual([
      expect.objectContaining({ path: 'jitterMs' }),
    ]);
  });

  it('validateGrpcMockLatencyPolicy rejects non-integer seed', () => {
    expect(validateGrpcMockLatencyPolicy({ seed: 1.1 })).toEqual([
      expect.objectContaining({ path: 'seed', message: 'seed must be an integer when provided.' }),
    ]);
  });

  it('validateGrpcMockLatencyPolicy flags values above configured limits', () => {
    const issues = validateGrpcMockLatencyPolicy({
      defaultLatencyMs: GRPC_MOCK_LATENCY_LIMITS.maxDefaultLatencyMs + 1,
      jitterMs: GRPC_MOCK_LATENCY_LIMITS.maxJitterMs + 1,
    });
    expect(issues.some((issue) => issue.path === 'defaultLatencyMs')).toBe(true);
    expect(issues.some((issue) => issue.path === 'jitterMs')).toBe(true);
  });

  it('assertGrpcMockLatencyPolicy throws validation error with first issue message', () => {
    expect(() => assertGrpcMockLatencyPolicy({ defaultLatencyMs: -5 }))
      .toThrow(GrpcMockLatencyPolicyValidationError);
  });

  it('drawGrpcMockJitterMs returns zero without seed even when jitter is configured', () => {
    expect(drawGrpcMockJitterMs({ jitterMs: 100 }, 0)).toBe(0);
  });

  it('resolveGrpcMockLatencyMs combines base latency and deterministic jitter', () => {
    const latency = resolveGrpcMockLatencyMs({
      responseLatencyMs: 10,
      policy: { jitterMs: 20, seed: 42 },
      callSequence: 3,
    });
    expect(latency).toBeGreaterThanOrEqual(10);
    expect(latency).toBeLessThanOrEqual(30);
  });
});
