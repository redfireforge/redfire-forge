/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { ensureChartableTimeSeries, type TimeSeriesPoint } from './useTestExecution';

describe('ensureChartableTimeSeries', () => {
  const summary = { avgResponseTime: 80, tps: 12, errorRate: 0 };

  it('returns series unchanged when already chartable', () => {
    const series: TimeSeriesPoint[] = [
      { elapsedSec: 1, avgResponseTime: 50, tps: 5, errorRate: 0, concurrency: 1 },
      { elapsedSec: 2, avgResponseTime: 60, tps: 6, errorRate: 0, concurrency: 1 },
    ];
    expect(ensureChartableTimeSeries(series, summary, 2000)).toEqual(series);
  });

  it('synthesizes start+end when series is empty (sub-second runs)', () => {
    const out = ensureChartableTimeSeries([], summary, 910);
    expect(out).toHaveLength(2);
    expect(out[0].elapsedSec).toBe(0);
    expect(out[0].tps).toBe(0);
    expect(out[1].elapsedSec).toBe(1);
    expect(out[1].avgResponseTime).toBe(80);
    expect(out[1].tps).toBe(12);
  });

  it('appends an end point when only one snapshot exists', () => {
    const series: TimeSeriesPoint[] = [
      { elapsedSec: 1, avgResponseTime: 70, tps: 8, errorRate: 0, concurrency: 2 },
    ];
    const out = ensureChartableTimeSeries(series, summary, 1500);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(series[0]);
    expect(out[1].elapsedSec).toBeGreaterThanOrEqual(2);
  });
});
