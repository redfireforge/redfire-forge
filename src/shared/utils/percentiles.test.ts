import { describe, it, expect } from 'vitest';
import { percentile, computePercentiles, round2 } from './percentiles';

describe('percentile', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it('returns the only element for single-element array', () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.99)).toBe(42);
  });

  it('returns correct percentiles for sorted array', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 0.5)).toBe(60);
    expect(percentile(sorted, 0.9)).toBe(100);
    expect(percentile(sorted, 0.0)).toBe(10);
  });

  it('returns max for 1.0 percentile', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 1.0)).toBe(5);
  });

  it('falls back to max when indexed value is nullish', () => {
    const sorted = [null, null, null, 100] as unknown as number[];
    expect(percentile(sorted, 0.5)).toBe(100);
  });

  it('handles p999 with ceil logic', () => {
    const sorted = Array.from({ length: 1000 }, (_, i) => i + 1);
    expect(percentile(sorted, 0.999)).toBe(999);
  });
});

describe('computePercentiles', () => {
  it('returns zeroed result for empty array', () => {
    const result = computePercentiles([]);
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
    expect(result.mean).toBe(0);
    expect(result.p50).toBe(0);
  });

  it('computes correct percentiles for a range', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
    const result = computePercentiles(sorted);
    expect(result.min).toBe(10);
    expect(result.max).toBe(1000);
    expect(result.mean).toBe(505);
    expect(result.p50).toBe(510);
    expect(result.p95).toBe(960);
    expect(result.p99).toBe(1000);
  });

  it('handles single element', () => {
    const result = computePercentiles([77]);
    expect(result.min).toBe(77);
    expect(result.max).toBe(77);
    expect(result.mean).toBe(77);
    expect(result.p50).toBe(77);
    expect(result.p95).toBe(77);
  });
});

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.236)).toBe(1.24);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(100)).toBe(100);
    expect(round2(0)).toBe(0);
    expect(round2(3.14159)).toBe(3.14);
  });
});
