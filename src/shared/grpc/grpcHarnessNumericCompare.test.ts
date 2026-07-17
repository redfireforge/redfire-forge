/**
 * Phase 8D/8E — numeric compare tests.
 */
import { describe, expect, it } from 'vitest';
import {
  compareGrpcHarnessNumericValues,
  GRPC_INT64_MAX,
  GRPC_INT64_MIN,
  GRPC_UINT64_MAX,
  isUnsafeGrpcHarnessIntegerNumber,
} from './grpcHarnessNumericCompare';

describe('compareGrpcHarnessNumericValues (Phase 8D/8E)', () => {
  it('compares large int64 strings via BigInt without precision loss', () => {
    const result = compareGrpcHarnessNumericValues(
      '9223372036854775807',
      '==',
      '9223372036854775807',
    );
    expect(result.ok).toBe(true);
  });

  it('detects inequality for adjacent int64 string values', () => {
    const result = compareGrpcHarnessNumericValues(
      '9223372036854775807',
      '!=',
      '9223372036854775806',
    );
    expect(result.ok).toBe(true);
  });

  it('compares int64 min and max boundaries', () => {
    expect(compareGrpcHarnessNumericValues(String(GRPC_INT64_MIN), '==', String(GRPC_INT64_MIN)).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(String(GRPC_INT64_MAX), '==', String(GRPC_INT64_MAX)).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(String(GRPC_INT64_MIN), '<', String(GRPC_INT64_MAX)).ok).toBe(true);
  });

  it('compares uint64 max boundary as digit strings', () => {
    expect(compareGrpcHarnessNumericValues(String(GRPC_UINT64_MAX), '==', String(GRPC_UINT64_MAX)).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(
      '18446744073709551614',
      '<',
      String(GRPC_UINT64_MAX),
    ).ok).toBe(true);
  });

  it('compares safe integer number and string forms', () => {
    expect(compareGrpcHarnessNumericValues(42, '==', '42').ok).toBe(true);
    expect(compareGrpcHarnessNumericValues('  42  ', '>=', 40).ok).toBe(true);
  });

  it('compares standard numbers', () => {
    expect(compareGrpcHarnessNumericValues(42, '>=', 40).ok).toBe(true);
    expect(compareGrpcHarnessNumericValues(42, '<', 40).ok).toBe(false);
  });

  it('flags unsafe IEEE integer numbers', () => {
    const unsafe = Number('9223372036854775807');
    expect(isUnsafeGrpcHarnessIntegerNumber(unsafe)).toBe(true);
    expect(Number.isSafeInteger(unsafe)).toBe(false);
  });
});
