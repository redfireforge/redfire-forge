import { describe, expect, it } from 'vitest';
import { formatGrpcTimeoutHeaderValue } from './grpcCallSettingsUtils';

describe('formatGrpcTimeoutHeaderValue', () => {
  it('formats whole seconds as S', () => {
    expect(formatGrpcTimeoutHeaderValue(30_000)).toBe('30S');
  });

  it('formats whole minutes as M', () => {
    expect(formatGrpcTimeoutHeaderValue(120_000)).toBe('2M');
  });

  it('formats sub-second as m (milliseconds)', () => {
    expect(formatGrpcTimeoutHeaderValue(500)).toBe('500m');
  });

  it('returns dash for invalid values', () => {
    expect(formatGrpcTimeoutHeaderValue(0)).toBe('—');
    expect(formatGrpcTimeoutHeaderValue(Number.NaN)).toBe('—');
  });

  it('formats whole hours as H', () => {
    expect(formatGrpcTimeoutHeaderValue(3_600_000)).toBe('1H');
    expect(formatGrpcTimeoutHeaderValue(7_200_000)).toBe('2H');
  });

  it('formats fractional seconds above 1s as milliseconds suffix', () => {
    expect(formatGrpcTimeoutHeaderValue(1500)).toBe('1500m');
  });
});
