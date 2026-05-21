/**
 * Response time histogram bin computation utilities.
 * Used for distribution visualization and baseline overlay comparison.
 */
import { computePercentiles, round2 } from '../../../shared/utils/percentiles';

export interface HistogramBin {
  /** Lower bound of the bin (inclusive) */
  min: number;
  /** Upper bound of the bin (exclusive, except last bin which is inclusive) */
  max: number;
  /** Number of requests in this bin */
  count: number;
  /** Percentage of total requests */
  percent: number;
}

export interface OverlayHistogram {
  bins: { min: number; max: number }[];
  baseline: number[];  // counts per bin
  current: number[];   // counts per bin
  baselinePercent: number[];
  currentPercent: number[];
}

const DEFAULT_BIN_COUNT = 30;

/**
 * Compute histogram bins from an array of response times.
 * Uses equal-width binning from min to a capped max (P99 by default to avoid outlier stretch).
 */
export function computeHistogramBins(
  times: number[],
  binCount: number = DEFAULT_BIN_COUNT,
  capAtPercentile: number = 99,
): HistogramBin[] {
  if (times.length === 0) return [];
  if (binCount < 1) binCount = 1;

  const sorted = [...times].sort((a, b) => a - b);
  const total = sorted.length;
  const minTime = sorted[0];
  const capIdx = Math.min(total - 1, Math.floor(total * (capAtPercentile / 100)));
  const maxTime = sorted[capIdx];

  // If all values are the same, return a single bin
  if (maxTime === minTime) {
    return [{ min: minTime, max: minTime, count: total, percent: 100 }];
  }

  const binWidth = (maxTime - minTime) / binCount;
  const bins: HistogramBin[] = [];

  for (let i = 0; i < binCount; i++) {
    bins.push({
      min: Math.round((minTime + i * binWidth) * 100) / 100,
      max: Math.round((minTime + (i + 1) * binWidth) * 100) / 100,
      count: 0,
      percent: 0,
    });
  }

  // Fill bins
  for (const t of sorted) {
    if (t > maxTime) {
      // Outliers beyond cap go into the last bin
      bins[binCount - 1].count++;
    } else {
      const idx = Math.min(binCount - 1, Math.floor((t - minTime) / binWidth));
      bins[idx].count++;
    }
  }

  // Compute percentages
  for (const bin of bins) {
    bin.percent = Math.round((bin.count / total) * 10000) / 100;
  }

  return bins;
}

/**
 * Compute overlay histogram for comparing two runs.
 * Uses shared bin boundaries (min of both mins, max of both P99 caps).
 */
export function computeOverlayHistogram(
  baselineTimes: number[],
  currentTimes: number[],
  binCount: number = DEFAULT_BIN_COUNT,
  capAtPercentile: number = 99,
): OverlayHistogram {
  if (baselineTimes.length === 0 && currentTimes.length === 0) {
    return { bins: [], baseline: [], current: [], baselinePercent: [], currentPercent: [] };
  }

  const sortedBaseline = [...baselineTimes].sort((a, b) => a - b);
  const sortedCurrent = [...currentTimes].sort((a, b) => a - b);

  // Compute shared range
  const getCapMax = (sorted: number[]) => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * (capAtPercentile / 100)));
    return sorted[idx];
  };

  const allMin = Math.min(
    sortedBaseline.length > 0 ? sortedBaseline[0] : Infinity,
    sortedCurrent.length > 0 ? sortedCurrent[0] : Infinity,
  );
  const allMax = Math.max(
    getCapMax(sortedBaseline),
    getCapMax(sortedCurrent),
  );

  if (allMax === allMin) {
    return {
      bins: [{ min: allMin, max: allMin }],
      baseline: [sortedBaseline.length],
      current: [sortedCurrent.length],
      baselinePercent: [sortedBaseline.length > 0 ? 100 : 0],
      currentPercent: [sortedCurrent.length > 0 ? 100 : 0],
    };
  }

  const binWidth = (allMax - allMin) / binCount;
  const bins: { min: number; max: number }[] = [];
  const baseline: number[] = [];
  const current: number[] = [];

  for (let i = 0; i < binCount; i++) {
    bins.push({
      min: Math.round((allMin + i * binWidth) * 100) / 100,
      max: Math.round((allMin + (i + 1) * binWidth) * 100) / 100,
    });
    baseline.push(0);
    current.push(0);
  }

  const fillBins = (sorted: number[], counts: number[]) => {
    for (const t of sorted) {
      if (t > allMax) {
        counts[binCount - 1]++;
      } else {
        const idx = Math.min(binCount - 1, Math.floor((t - allMin) / binWidth));
        counts[idx]++;
      }
    }
  };

  fillBins(sortedBaseline, baseline);
  fillBins(sortedCurrent, current);

  const baselineTotal = sortedBaseline.length || 1;
  const currentTotal = sortedCurrent.length || 1;
  const baselinePercent = baseline.map(c => Math.round((c / baselineTotal) * 10000) / 100);
  const currentPercent = current.map(c => Math.round((c / currentTotal) * 10000) / 100);

  return { bins, baseline, current, baselinePercent, currentPercent };
}

/**
 * Compute summary stats for display alongside histogram.
 */
export function computeDistributionStats(times: number[]): {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
} | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const n = sorted.length;
  const { min, max, mean, p50: median, p90, p95, p99, p999 } = computePercentiles(sorted);
  const variance = sorted.reduce((acc, t) => acc + (t - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    count: n,
    min,
    max,
    mean: round2(mean),
    median,
    stdDev: round2(stdDev),
    p90,
    p95,
    p99,
    p999,
  };
}
