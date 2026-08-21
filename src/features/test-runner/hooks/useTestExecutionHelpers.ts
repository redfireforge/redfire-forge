import type { RequestResult, TestSummary } from '../../../shared/types';
import type { TimeSeriesPoint } from './useTestExecution';

const MAX_LIVE_RESULTS = 500;

export function capResults(results: RequestResult[]): RequestResult[] {
  if (results.length <= MAX_LIVE_RESULTS) return results;
  const failed = results.filter(r => !r.passed);
  const passed = results.filter(r => r.passed);
  const passedBudget = Math.max(0, MAX_LIVE_RESULTS - failed.length);
  const step = passed.length > passedBudget ? Math.ceil(passed.length / passedBudget) : 1;
  const sampled: RequestResult[] = [];
  for (let i = 0; i < passed.length && sampled.length < passedBudget; i += step) {
    sampled.push(passed[i]);
  }
  return [...failed, ...sampled];
}

/**
 * LiveCharts needs >=2 samples. Short demo runs often finish in <1s and only
 * get 0-1 per-second snapshots - synthesize start/end points from the summary.
 */
export function ensureChartableTimeSeries(
  series: TimeSeriesPoint[],
  summary: Pick<TestSummary, 'avgResponseTime' | 'tps' | 'errorRate'>,
  durationMs: number,
): TimeSeriesPoint[] {
  if (series.length >= 2) return series;

  const endSec = Math.max(1, Math.round(durationMs / 1000) || 1);
  const endPoint: TimeSeriesPoint = {
    elapsedSec: endSec,
    avgResponseTime: summary.avgResponseTime,
    tps: summary.tps,
    errorRate: summary.errorRate,
    concurrency: series[series.length - 1]?.concurrency ?? 0,
  };

  if (series.length === 1) {
    const first = series[0];
    return [
      first,
      {
        ...endPoint,
        elapsedSec: Math.max(first.elapsedSec + 1, endSec),
      },
    ];
  }

  return [
    {
      elapsedSec: 0,
      avgResponseTime: summary.avgResponseTime,
      tps: 0,
      errorRate: 0,
      concurrency: 0,
    },
    endPoint,
  ];
}
