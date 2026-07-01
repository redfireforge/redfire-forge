/**
 * Coverage gaps — grpcLoadTestMetrics.ts (Phase 11C).
 */
import { describe, expect, it } from 'vitest';
import type { GrpcLoadTestRunReport } from './grpcAdvancedFeatureContracts';
import {
  buildGrpcLoadTestRunSummaryExport,
  serializeGrpcLoadTestRunSummaryCsv,
} from './grpcLoadTestMetrics';

function makeMinimalReport(attempts: GrpcLoadTestRunReport['attempts']): GrpcLoadTestRunReport {
  return {
    runId: 'run-gap',
    startedAt: '2026-07-01T00:00:00.000Z',
    completedAt: '2026-07-01T00:00:10.000Z',
    durationMs: 10_000,
    stopReason: 'completed_total_calls',
    counts: {
      scheduled: attempts.length,
      completed: attempts.length,
      succeeded: attempts.filter((attempt) => attempt.ok).length,
      failed: attempts.filter((attempt) => !attempt.ok).length,
      warmupScheduled: 0,
      warmupCompleted: 0,
      peakInFlight: 1,
    },
    attempts,
  };
}

describe('grpcLoadTestMetrics coverage gaps', () => {
  it('maps successful attempts without statusCode to bucket 0', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: {
        runId: 'run-gap',
        config: { concurrency: 1, totalCalls: 1 },
      },
      report: makeMinimalReport([
        {
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.100Z',
          durationMs: 100,
          ok: true,
          statusCode: undefined,
        },
      ]),
      exportedAt: '2026-07-01T00:00:11.000Z',
    });

    expect(summary.metrics.statusDistribution.byStatusCode).toEqual({ '0': 1 });
  });

  it('sorts status distribution keys with unknown last and numeric ascending', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: {
        runId: 'run-gap',
        config: { concurrency: 4, totalCalls: 4 },
      },
      report: makeMinimalReport([
        {
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.100Z',
          durationMs: 100,
          ok: false,
          statusCode: undefined,
        },
        {
          attemptNumber: 2,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.200Z',
          durationMs: 200,
          ok: true,
          statusCode: 0,
        },
        {
          attemptNumber: 3,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.300Z',
          durationMs: 300,
          ok: false,
          statusCode: 14,
        },
      ]),
      exportedAt: '2026-07-01T00:00:11.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv).toContain('0|14|unknown');
  });

  it('escapeCsv quotes fields containing commas, quotes, and line breaks', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: {
        runId: 'run-gap',
        config: { concurrency: 1, totalCalls: 1 },
        resolvedEnvName: 'local,env',
      },
      report: makeMinimalReport([
        {
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.100Z',
          durationMs: 100,
          ok: false,
          statusCode: 14,
          errorMessage: 'fail "hard"\r\nretry',
        },
      ]),
      exportedAt: '2026-07-01T00:00:11.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv).toContain('"local,env"');
    expect(csv).toContain('"fail ""hard""\r\nretry"');
  });

  it('sorts non-numeric status keys lexicographically after numeric buckets', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: {
        runId: 'run-gap',
        config: { concurrency: 3, totalCalls: 3 },
      },
      report: makeMinimalReport([
        {
          attemptNumber: 1,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.100Z',
          durationMs: 100,
          ok: false,
          statusCode: 14,
        },
        {
          attemptNumber: 2,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.200Z',
          durationMs: 200,
          ok: false,
          statusCode: 'custom' as unknown as number,
        },
        {
          attemptNumber: 3,
          warmup: false,
          startedAt: '2026-07-01T00:00:00.000Z',
          finishedAt: '2026-07-01T00:00:00.300Z',
          durationMs: 300,
          ok: false,
          statusCode: 'alpha' as unknown as number,
        },
      ]),
      exportedAt: '2026-07-01T00:00:11.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv).toContain('14|alpha|custom');
  });
});
