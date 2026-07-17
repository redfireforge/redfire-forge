/**
 * Phase 8E — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { evaluateGrpcHarnessAssertions } from './grpcHarnessAssertEngine';
import {
  GRPC_INT64_MAX,
  GRPC_INT64_MIN,
  GRPC_UINT64_MAX,
  compareGrpcHarnessNumericValues,
} from './grpcHarnessNumericCompare';
import { resolveGrpcHarnessTrailerValue } from './grpcHarnessTrailerNormalize';

describe('Phase 8E acceptance checklist', () => {
  it('exports numeric boundary constants and compare helper', () => {
    expect(GRPC_INT64_MAX).toBe(9223372036854775807n);
    expect(GRPC_INT64_MIN).toBe(-9223372036854775808n);
    expect(GRPC_UINT64_MAX).toBe(18446744073709551615n);
    expect(typeof compareGrpcHarnessNumericValues).toBe('function');
  });

  it('assert engine imports trailer normalize helper', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcHarnessAssertEngine.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('resolveGrpcHarnessTrailerValue');
    expect(source).not.toMatch(/function resolveTrailerValue/);
    expect(source).not.toContain('normalizeGrpcHarnessTrailers');
  });

  it('exports trailer normalize helper', async () => {
    const trailer = await import('./grpcHarnessTrailerNormalize');
    expect(typeof trailer.normalizeGrpcHarnessTrailers).toBe('function');
    expect(typeof trailer.resolveGrpcHarnessTrailerValue).toBe('function');
  });

  it('grpcTrailer assertions resolve mixed-case trailer maps', () => {
    const outcome = {
      callType: 'unary' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      body: {},
      trailers: { 'X-Custom-Trailer': 'value' },
      attempts: 1,
    };
    expect(resolveGrpcHarnessTrailerValue(outcome.trailers, 'x-custom-trailer')).toBe('value');
    const assertOutcome = evaluateGrpcHarnessAssertions(outcome, [{
      grpcTrailer: 'X-CUSTOM-TRAILER',
      equals: 'value',
    }]);
    expect(assertOutcome.passed).toBe(true);
  });

  it('grpcNumericField compares int64 string boundaries', () => {
    const outcome = {
      callType: 'unary' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      body: { id: String(GRPC_INT64_MAX) },
      attempts: 1,
    };
    const assertOutcome = evaluateGrpcHarnessAssertions(outcome, [{
      grpcNumericField: '$.id',
      operator: '==',
      value: String(GRPC_INT64_MAX),
    }]);
    expect(assertOutcome.passed).toBe(true);
  });

  it('grpcNumericField compares uint64 string boundaries', () => {
    const outcome = {
      callType: 'unary' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      body: { id: String(GRPC_UINT64_MAX) },
      attempts: 1,
    };
    const assertOutcome = evaluateGrpcHarnessAssertions(outcome, [{
      grpcNumericField: '$.id',
      operator: '==',
      value: String(GRPC_UINT64_MAX),
    }]);
    expect(assertOutcome.passed).toBe(true);
  });
});
