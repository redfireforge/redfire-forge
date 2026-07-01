/**
 * Phase 8E — trailer normalization tests.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeGrpcHarnessTrailers,
  resolveGrpcHarnessTrailerValue,
} from './grpcHarnessTrailerNormalize';

describe('grpcHarnessTrailerNormalize (Phase 8E)', () => {
  it('normalizes trailer keys to lowercase', () => {
    expect(normalizeGrpcHarnessTrailers({
      'X-Trace': 'abc',
      'grpc-status': '0',
    })).toEqual({
      'x-trace': 'abc',
      'grpc-status': '0',
    });
  });

  it('last duplicate wins when mixed-case variants appear', () => {
    expect(normalizeGrpcHarnessTrailers({
      'X-Trace': 'first',
      'x-trace': 'second',
    })).toEqual({ 'x-trace': 'second' });
  });

  it('resolves trailer values case-insensitively', () => {
    const trailers = { 'x-request-id': 'req-1' };
    expect(resolveGrpcHarnessTrailerValue(trailers, 'X-Request-Id')).toBe('req-1');
    expect(resolveGrpcHarnessTrailerValue(trailers, 'missing')).toBeUndefined();
  });

  it('resolves empty trailer values without treating them as missing', () => {
    expect(resolveGrpcHarnessTrailerValue({ 'grpc-status': '' }, 'GRPC-STATUS')).toBe('');
  });

  it('returns undefined for undefined trailer maps', () => {
    expect(resolveGrpcHarnessTrailerValue(undefined, 'x-trace')).toBeUndefined();
    expect(normalizeGrpcHarnessTrailers(undefined)).toBeUndefined();
  });

  it('returns undefined for empty trailer names', () => {
    expect(resolveGrpcHarnessTrailerValue({ 'x-trace': '1' }, '   ')).toBeUndefined();
  });
});
