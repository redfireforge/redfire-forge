import { describe, it, expect } from 'vitest';
import {
  computeHistogramBins,
  computeOverlayHistogram,
  computeDistributionStats,
} from './responseTimeHistogram';

describe('computeHistogramBins', () => {
  it('returns empty array for empty input', () => {
    expect(computeHistogramBins([])).toEqual([]);
  });

  it('returns a single bin when all values are the same', () => {
    const bins = computeHistogramBins([50, 50, 50, 50]);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(4);
    expect(bins[0].percent).toBe(100);
  });

  it('distributes values into bins', () => {
    const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const bins = computeHistogramBins(times, 5);
    expect(bins).toHaveLength(5);
    // All bins should have count > 0 for uniform distribution
    const totalCount = bins.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(10);
  });

  it('percentages sum to approximately 100', () => {
    const times = Array.from({ length: 100 }, (_, i) => i * 10);
    const bins = computeHistogramBins(times, 10);
    const totalPercent = bins.reduce((s, b) => s + b.percent, 0);
    expect(totalPercent).toBeCloseTo(100, 0);
  });

  it('caps outliers into the last bin by default (P99)', () => {
    // 999 values between 10-100, plus 1 extreme outlier at 10000
    const times = Array.from({ length: 999 }, (_, i) => 10 + (i % 91)).concat([10000]);
    const bins = computeHistogramBins(times, 10, 99);
    // The last bin should contain the outlier
    const lastBin = bins[bins.length - 1];
    expect(lastBin.count).toBeGreaterThanOrEqual(1);
    // The bin ranges shouldn't extend to 10000
    expect(lastBin.max).toBeLessThan(500);
  });

  it('respects custom bin count', () => {
    const times = [10, 20, 30, 40, 50];
    const bins = computeHistogramBins(times, 3);
    expect(bins).toHaveLength(3);
  });

  it('handles binCount < 1 gracefully', () => {
    const bins = computeHistogramBins([10, 20, 30], 0);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(3);
  });
});

describe('computeOverlayHistogram', () => {
  it('returns empty for both empty inputs', () => {
    const result = computeOverlayHistogram([], []);
    expect(result.bins).toHaveLength(0);
    expect(result.baseline).toHaveLength(0);
    expect(result.current).toHaveLength(0);
  });

  it('handles one empty and one populated input', () => {
    const result = computeOverlayHistogram([10, 20, 30], [], 5);
    expect(result.bins).toHaveLength(5);
    expect(result.baseline.reduce((s, c) => s + c, 0)).toBe(3);
    expect(result.current.reduce((s, c) => s + c, 0)).toBe(0);
  });

  it('returns a single shared bin when one side is empty and all values are identical', () => {
    const o = computeOverlayHistogram([], [42, 42, 42], 8);
    expect(o.bins).toHaveLength(1);
    expect(o.baseline[0]).toBe(0);
    expect(o.current[0]).toBe(3);
    expect(o.baselinePercent[0]).toBe(0);
    expect(o.currentPercent[0]).toBe(100);
  });

  it('handles empty current with identical baseline values in single-bin overlay', () => {
    const o = computeOverlayHistogram([7, 7, 7], [], 5);
    expect(o.bins).toHaveLength(1);
    expect(o.baseline[0]).toBe(3);
    expect(o.current[0]).toBe(0);
    expect(o.baselinePercent[0]).toBe(100);
    expect(o.currentPercent[0]).toBe(0);
  });

  it('uses shared bin boundaries for both datasets', () => {
    const result = computeOverlayHistogram([10, 20, 30], [50, 60, 70], 10);
    expect(result.bins).toHaveLength(10);
    // First bin min should be 10 (min of both)
    expect(result.bins[0].min).toBe(10);
    // Last bin max should cover up to 70 (max of both)
    expect(result.bins[result.bins.length - 1].max).toBeGreaterThanOrEqual(70);
  });

  it('percentages are relative to each dataset total', () => {
    const result = computeOverlayHistogram([50, 50, 50], [50, 50, 50, 50, 50], 5);
    const baselinePercentSum = result.baselinePercent.reduce((s, p) => s + p, 0);
    const currentPercentSum = result.currentPercent.reduce((s, p) => s + p, 0);
    expect(baselinePercentSum).toBeCloseTo(100, 0);
    expect(currentPercentSum).toBeCloseTo(100, 0);
  });

  it('handles identical values in both sets (single bin)', () => {
    const result = computeOverlayHistogram([100, 100], [100, 100, 100]);
    expect(result.bins).toHaveLength(1);
    expect(result.baseline[0]).toBe(2);
    expect(result.current[0]).toBe(3);
  });

  it('bins outlier response times into the shared last bin', () => {
    const baseline = Array.from({ length: 200 }, (_, i) => i + 1);
    const current = [5000];
    const o = computeOverlayHistogram(baseline, current, 12, 99);
    expect(o.baseline.reduce((s, n) => s + n, 0)).toBe(baseline.length);
    expect(o.current.reduce((s, n) => s + n, 0)).toBe(current.length);
    expect(o.baseline[o.baseline.length - 1] + o.current[o.current.length - 1]).toBeGreaterThan(0);
  });

  it('places baseline samples above shared P99 cap into the last bin', () => {
    const baseline = [...Array.from({ length: 200 }, (_, i) => i + 1), 10000];
    const current = [150];
    const o = computeOverlayHistogram(baseline, current, 12, 99);
    expect(o.baseline.reduce((s, n) => s + n, 0)).toBe(baseline.length);
    expect(o.baseline[o.baseline.length - 1]).toBeGreaterThan(0);
  });
});

describe('computeDistributionStats', () => {
  it('returns null for empty input', () => {
    expect(computeDistributionStats([])).toBeNull();
  });

  it('computes correct stats for simple input', () => {
    const times = [10, 20, 30, 40, 50];
    const stats = computeDistributionStats(times)!;
    expect(stats.count).toBe(5);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.mean).toBe(30);
    expect(stats.median).toBe(30);
  });

  it('computes standard deviation correctly', () => {
    // All same → stdDev = 0
    const stats = computeDistributionStats([50, 50, 50, 50])!;
    expect(stats.stdDev).toBe(0);
  });

  it('computes percentiles correctly', () => {
    const times = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const stats = computeDistributionStats(times)!;
    expect(stats.p90).toBe(91);
    expect(stats.p95).toBe(96);
    expect(stats.p99).toBe(100);
  });

  it('handles single value', () => {
    const stats = computeDistributionStats([42])!;
    expect(stats.count).toBe(1);
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.mean).toBe(42);
    expect(stats.median).toBe(42);
    expect(stats.stdDev).toBe(0);
    expect(stats.p95).toBe(42);
  });
});
