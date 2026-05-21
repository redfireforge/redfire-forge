/**
 * Compute a single percentile from a pre-sorted array.
 * Returns the element at the given percentile index, clamped to array bounds.
 * Falls back to the last element (max) if the indexed value is nullish.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0,
    p >= 0.999 ? Math.ceil(sorted.length * p) - 1 : Math.floor(sorted.length * p),
  ));
  return sorted[idx] ?? sorted[sorted.length - 1];
}

export interface PercentileSummary {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
}

/**
 * Compute common percentiles from a pre-sorted ascending array.
 * Caller must sort before calling.
 */
export function computePercentiles(sorted: number[]): PercentileSummary {
  if (sorted.length === 0) {
    return { min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0, p999: 0 };
  }
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[n - 1],
    mean: sum / n,
    p50: percentile(sorted, 0.50),
    p90: percentile(sorted, 0.90),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    p999: percentile(sorted, 0.999),
  };
}

/** Round a number to 2 decimal places. */
export function round2(val: number): number {
  return Math.round(val * 100) / 100;
}
