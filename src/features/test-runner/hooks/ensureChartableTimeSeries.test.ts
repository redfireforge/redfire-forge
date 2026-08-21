/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { capResults, ensureChartableTimeSeries } from './useTestExecutionHelpers';
import type { TimeSeriesPoint } from './useTestExecution';

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

  it('uses the duration fallback when rounded seconds become 0', () => {
    const out = ensureChartableTimeSeries([], summary, 0);
    expect(out).toHaveLength(2);
    expect(out[1].elapsedSec).toBe(1);
  });
});

describe('capResults', () => {
  it('keeps all results when below the cap', () => {
    const input = [
      { id: 'a', passed: true },
      { id: 'b', passed: false },
    ] as unknown as import('../../../shared/types').RequestResult[];

    expect(capResults(input)).toEqual(input);
  });

  it('samples passing results when failed results consume most of the cap', () => {
    const failed = Array.from({ length: 499 }, (_, i) => ({ id: `f-${i}`, passed: false }));
    const passed = Array.from({ length: 8 }, (_, i) => ({ id: `p-${i}`, passed: true }));
    const input = [...failed, ...passed] as unknown as import('../../../shared/types').RequestResult[];

    const out = capResults(input);
    expect(out.length).toBe(500);
    expect(out.filter(r => !r.passed)).toHaveLength(499);
    expect(out.filter(r => r.passed)).toHaveLength(1);
  });
});
