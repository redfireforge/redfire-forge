import { describe, it, expect } from 'vitest';
import { clampPollingIntervalSeconds } from './pollingIntervalUtils';

describe('clampPollingIntervalSeconds', () => {
  it('clamps below minimum to 10', () => {
    expect(clampPollingIntervalSeconds(5)).toBe(10);
  });

  it('clamps above maximum to 3600', () => {
    expect(clampPollingIntervalSeconds(9999)).toBe(3600);
  });

  it('rounds fractional values', () => {
    expect(clampPollingIntervalSeconds(30.6)).toBe(31);
  });

  it('returns minimum for non-finite values', () => {
    expect(clampPollingIntervalSeconds(Number.NaN)).toBe(10);
  });

  it('treats negative infinity and exact in-range integers correctly', () => {
    expect(clampPollingIntervalSeconds(Number.NEGATIVE_INFINITY)).toBe(10);
    expect(clampPollingIntervalSeconds(120)).toBe(120);
  });
});
