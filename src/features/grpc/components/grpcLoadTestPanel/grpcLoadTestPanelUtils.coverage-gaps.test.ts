/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeLoadTestSummary } from '../../test-helpers/grpcAdvancedPanel.testHelpers';
import {
  buildCompareDeltas,
  buildCompareDetailRows,
  buildCompareStatusComposition,
  buildLatencyHistogram,
  buildStatusBreakdown,
  buildThroughputTimeline,
  downloadTextFile,
  parseNonNegativeInt,
  parseNonNegativeSecondsToMs,
  parsePositiveInt,
  parsePositiveSecondsToMs,
  presentMsAsSeconds,
  safeFilePart,
  statusCodeSort,
  toSignedNumber,
} from './grpcLoadTestPanelUtils';

describe('grpcLoadTestPanelUtils coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses numeric inputs and rejects invalid values', () => {
    expect(parsePositiveInt('')).toBeUndefined();
    expect(parsePositiveInt('  ')).toBeUndefined();
    expect(parsePositiveInt('0')).toBeUndefined();
    expect(parsePositiveInt('2.5')).toBeUndefined();
    expect(parsePositiveInt('4')).toBe(4);

    expect(parseNonNegativeInt('')).toBeUndefined();
    expect(parseNonNegativeInt('abc')).toBeUndefined();
    expect(parseNonNegativeInt('0')).toBe(0);

    expect(parsePositiveSecondsToMs('0')).toBeUndefined();
    expect(parsePositiveSecondsToMs('NaN')).toBeUndefined();
    expect(parsePositiveSecondsToMs('1.5')).toBe(1500);

    expect(parseNonNegativeSecondsToMs('-1')).toBeUndefined();
    expect(parseNonNegativeSecondsToMs('0')).toBe(0);
  });

  it('formats presentation helpers and file parts', () => {
    expect(presentMsAsSeconds(undefined)).toBe('');
    expect(presentMsAsSeconds(2500)).toBe('2.5');
    expect(safeFilePart(undefined, 'fallback')).toBe('fallback');
    expect(safeFilePart('   ', 'fallback')).toBe('fallback');
    expect(safeFilePart('My Run #1', 'fallback')).toBe('My-Run-1');
    expect(toSignedNumber(-3.2, 'ms')).toBe('-3.20ms');
    expect(toSignedNumber(2, '%')).toBe('+2.00%');
  });

  it('downloads text via a temporary anchor', async () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const link = { click, href: '', download: '' } as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadTextFile('payload', 'export.json', 'application/json');
    expect(click).toHaveBeenCalled();
    expect(link.download).toBe('export.json');

    await vi.runAllTimersAsync();
    expect(revoke).toHaveBeenCalledWith('blob:mock');
    vi.useRealTimers();
  });

  it('sorts status codes with unknown and non-numeric fallbacks', () => {
    expect(statusCodeSort('unknown', '5')).toBe(1);
    expect(statusCodeSort('5', 'unknown')).toBe(-1);
    expect(statusCodeSort('grpc', 'http')).toBe('grpc'.localeCompare('http'));
    expect(statusCodeSort('12', '3')).toBe(9);
  });

  it('builds status breakdown with zero measured attempts', () => {
    const summary = makeLoadTestSummary();
    summary.metrics.statusDistribution.measuredAttempts = 0;
    summary.metrics.statusDistribution.byStatusCode = { '0': 2 };
    const rows = buildStatusBreakdown(summary);
    expect(rows[0]?.ratio).toBe(0);
  });

  it('builds latency histogram for uniform durations', () => {
    const summary = makeLoadTestSummary();
    summary.attempts = [
      {
        attemptNumber: 1,
        warmup: false,
        startedAt: '2026-07-01T00:00:00.000Z',
        finishedAt: '2026-07-01T00:00:00.050Z',
        durationMs: 50,
        ok: true,
      },
      {
        attemptNumber: 2,
        warmup: false,
        startedAt: '2026-07-01T00:00:01.000Z',
        finishedAt: '2026-07-01T00:00:01.050Z',
        durationMs: 50,
        ok: true,
      },
    ];
    expect(buildLatencyHistogram(summary)).toEqual([
      { label: '50ms', count: 2, ratio: 1 },
    ]);
    expect(buildLatencyHistogram({ ...summary, attempts: [] })).toEqual([]);
  });

  it('skips invalid throughput timeline timestamps', () => {
    const summary = makeLoadTestSummary();
    summary.startedAt = 'not-a-date';
    expect(buildThroughputTimeline(summary)).toEqual([]);

    summary.startedAt = '2026-07-01T00:00:00.000Z';
    summary.attempts = [
      {
        attemptNumber: 1,
        warmup: false,
        startedAt: '2026-07-01T00:00:00.000Z',
        finishedAt: 'invalid',
        durationMs: 10,
        ok: true,
      },
      {
        attemptNumber: 2,
        warmup: true,
        startedAt: '2026-07-01T00:00:01.000Z',
        finishedAt: '2026-07-01T00:00:01.100Z',
        durationMs: 100,
        ok: true,
      },
      {
        attemptNumber: 3,
        warmup: false,
        startedAt: '2026-07-01T00:00:02.000Z',
        finishedAt: '2026-07-01T00:00:02.200Z',
        durationMs: 200,
        ok: false,
      },
    ];
    const timeline = buildThroughputTimeline(summary);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ second: 2, failed: 1, succeeded: 0 });
  });

  it('builds compare helpers with zero measured attempts', () => {
    const current = makeLoadTestSummary();
    const baseline = makeLoadTestSummary();
    current.metrics.statusDistribution.measuredAttempts = 0;
    baseline.metrics.statusDistribution.measuredAttempts = 0;
    current.metrics.statusDistribution.byStatusCode = {};
    baseline.metrics.statusDistribution.byStatusCode = { '14': 1 };

    expect(buildCompareDeltas(current, baseline).errorRateDelta).toBe(0);
    expect(buildCompareDetailRows(current, baseline).some((row) => row.label === 'Success rate')).toBe(true);

    const composition = buildCompareStatusComposition(current, baseline);
    expect(composition.find((row) => row.statusCode === '14')?.currentPct).toBe(0);
    expect(composition.find((row) => row.statusCode === '14')?.baselinePct).toBe(0);
  });
});
