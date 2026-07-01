import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { captureGrpcLoadTestExecuteSnapshot, type GrpcLoadTestRunReport } from './grpcAdvancedFeatureContracts';
import { buildGrpcLoadTestRunSummaryExport, serializeGrpcLoadTestRunSummaryCsv, serializeGrpcLoadTestRunSummaryJson } from './grpcLoadTestMetrics';
import { startGrpcLoadTestSchedulerRun } from './grpcLoadTestSchedulerCore';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function makeSnapshot() {
  return captureGrpcLoadTestExecuteSnapshot({
    runId: 'run-11c',
    executeSnapshot: {
      tabId: 'tab-11c',
      requestId: 'req-11c',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: {},
      timeoutMs: 10_000,
      descriptorKey: 'descriptor-11c',
    },
    config: {
      concurrency: 4,
      totalCalls: 4,
      warmupCalls: 2,
    },
    resolvedEnvName: 'local',
    capturedAt: '2026-07-01T00:00:01.000Z',
  });
}

function makeReport(): GrpcLoadTestRunReport {
  return {
    runId: 'run-11c',
    startedAt: '2026-07-01T00:00:02.000Z',
    completedAt: '2026-07-01T00:00:12.000Z',
    durationMs: 10_000,
    stopReason: 'completed_total_calls',
    counts: {
      scheduled: 4,
      completed: 4,
      succeeded: 3,
      failed: 1,
      warmupScheduled: 2,
      warmupCompleted: 2,
      peakInFlight: 2,
    },
    attempts: [
      {
        attemptNumber: 1,
        warmup: true,
        startedAt: '2026-07-01T00:00:02.000Z',
        finishedAt: '2026-07-01T00:00:02.010Z',
        durationMs: 10,
        ok: true,
        statusCode: 0,
      },
      {
        attemptNumber: 2,
        warmup: true,
        startedAt: '2026-07-01T00:00:02.000Z',
        finishedAt: '2026-07-01T00:00:02.020Z',
        durationMs: 20,
        ok: true,
        statusCode: 0,
      },
      {
        attemptNumber: 3,
        warmup: false,
        startedAt: '2026-07-01T00:00:02.000Z',
        finishedAt: '2026-07-01T00:00:02.100Z',
        durationMs: 100,
        ok: true,
        statusCode: 0,
      },
      {
        attemptNumber: 4,
        warmup: false,
        startedAt: '2026-07-01T00:00:02.000Z',
        finishedAt: '2026-07-01T00:00:02.200Z',
        durationMs: 200,
        ok: false,
        statusCode: 14,
        errorMessage: 'UNAVAILABLE',
      },
    ],
  };
}

describe('Phase 11C-A - warmup exclusion and percentile metrics', () => {
  it('excludes warm-up attempts from latency metrics and throughput calculations', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report: makeReport(),
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.kind).toBe('grpc_load_test_summary');
    expect(summary.metrics.latency.samples).toBe(2);
    expect(summary.metrics.latency.warmupSamples).toBe(2);
    expect(summary.metrics.latency.measuredSamples).toBe(2);
    expect(summary.metrics.latency.minMs).toBe(100);
    expect(summary.metrics.latency.maxMs).toBe(200);
    expect(summary.metrics.latency.meanMs).toBe(150);
    expect(summary.metrics.latency.p50Ms).toBe(200);
    expect(summary.metrics.latency.p95Ms).toBe(200);
    expect(summary.metrics.throughput.allAttemptsPerSecond).toBe(0.4);
    expect(summary.metrics.throughput.measuredAttemptsPerSecond).toBe(0.2);
    expect(summary.metrics.throughput.warmupAttemptsPerSecond).toBe(0.2);
    expect(summary.metrics.throughput.succeededAttemptsPerSecond).toBe(0.1);
    expect(summary.metrics.throughput.failedAttemptsPerSecond).toBe(0.1);
    expect(
      summary.metrics.throughput.warmupAttemptsPerSecond
      + summary.metrics.throughput.measuredAttemptsPerSecond,
    ).toBe(summary.metrics.throughput.allAttemptsPerSecond);
    expect(
      summary.metrics.throughput.succeededAttemptsPerSecond
      + summary.metrics.throughput.failedAttemptsPerSecond,
    ).toBe(summary.metrics.throughput.measuredAttemptsPerSecond);
    expect(summary.metrics.statusDistribution.totalAttempts).toBe(4);
    expect(summary.metrics.statusDistribution.warmupAttempts).toBe(2);
    expect(summary.metrics.statusDistribution.measuredAttempts).toBe(2);
    expect(summary.metrics.statusDistribution.succeededAttempts).toBe(1);
    expect(summary.metrics.statusDistribution.failedAttempts).toBe(1);
    expect(summary.metrics.statusDistribution.byStatusCode).toEqual({ '0': 1, '14': 1 });
    expect(summary.counts.succeeded).toBe(3);
    expect(summary.counts.failed).toBe(1);
  });

  it('excludes failed warm-up attempts from measured status distribution', () => {
    const report = makeReport();
    report.attempts[0] = {
      ...report.attempts[0]!,
      ok: false,
      statusCode: 14,
      errorMessage: 'warmup failed',
    };
    report.counts.succeeded = 2;
    report.counts.failed = 2;

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.metrics.statusDistribution.succeededAttempts).toBe(1);
    expect(summary.metrics.statusDistribution.failedAttempts).toBe(1);
    expect(summary.metrics.statusDistribution.byStatusCode).toEqual({ '0': 1, '14': 1 });
    expect(summary.counts.failed).toBe(2);
  });

  it('maps failed attempts without status codes to unknown in measured distribution', () => {
    const report = makeReport();
    report.attempts[3] = {
      ...report.attempts[3]!,
      ok: false,
      statusCode: undefined,
      errorMessage: 'network reset',
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.metrics.statusDistribution.byStatusCode).toEqual({ '0': 1, 'unknown': 1 });
  });

  it('maps inconsistent failed ok=false statusCode=0 attempts to unknown', () => {
    const report = makeReport();
    report.attempts[3] = {
      ...report.attempts[3]!,
      ok: false,
      statusCode: 0,
      errorMessage: 'inconsistent failure',
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.metrics.statusDistribution.byStatusCode).toEqual({ '0': 1, 'unknown': 1 });
  });

  it('returns zeroed measured metrics for warmup-only runs', () => {
    const report: GrpcLoadTestRunReport = {
      runId: 'run-warmup-only',
      startedAt: '2026-07-01T00:00:02.000Z',
      completedAt: '2026-07-01T00:00:12.000Z',
      durationMs: 10_000,
      stopReason: 'completed_total_calls',
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 2,
        failed: 0,
        warmupScheduled: 2,
        warmupCompleted: 2,
        peakInFlight: 1,
      },
      attempts: [
        {
          attemptNumber: 1,
          warmup: true,
          startedAt: '2026-07-01T00:00:02.000Z',
          finishedAt: '2026-07-01T00:00:02.010Z',
          durationMs: 10,
          ok: true,
          statusCode: 0,
        },
        {
          attemptNumber: 2,
          warmup: true,
          startedAt: '2026-07-01T00:00:02.000Z',
          finishedAt: '2026-07-01T00:00:02.020Z',
          durationMs: 20,
          ok: true,
          statusCode: 0,
        },
      ],
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.metrics.latency.samples).toBe(0);
    expect(summary.metrics.latency.measuredSamples).toBe(0);
    expect(summary.metrics.latency.warmupSamples).toBe(2);
    expect(summary.metrics.throughput.measuredAttemptsPerSecond).toBe(0);
    expect(summary.metrics.throughput.succeededAttemptsPerSecond).toBe(0);
    expect(summary.metrics.statusDistribution.measuredAttempts).toBe(0);
    expect(summary.metrics.statusDistribution.byStatusCode).toEqual({});
  });

  it('clamps negative attempt durations before percentile aggregation', () => {
    const report = makeReport();
    report.attempts[3] = {
      ...report.attempts[3]!,
      durationMs: -50,
      ok: true,
      statusCode: 0,
      errorMessage: undefined,
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.metrics.latency.minMs).toBe(0);
    expect(summary.metrics.latency.maxMs).toBe(100);
  });

  it('treats non-finite attempt durations as zero before percentile aggregation', () => {
    const report = makeReport();
    report.attempts[3] = {
      ...report.attempts[3]!,
      durationMs: Number.NaN,
      ok: true,
      statusCode: 0,
      errorMessage: undefined,
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.metrics.latency.minMs).toBe(0);
    expect(summary.metrics.latency.maxMs).toBe(100);
    expect(summary.metrics.latency.meanMs).toBe(50);
  });

  it('returns zero throughput rates when report durationMs is zero', () => {
    const report = makeReport();
    report.durationMs = 0;

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summary.metrics.throughput.allAttemptsPerSecond).toBe(0);
    expect(summary.metrics.throughput.measuredAttemptsPerSecond).toBe(0);
    expect(summary.metrics.throughput.warmupAttemptsPerSecond).toBe(0);
    expect(summary.metrics.throughput.succeededAttemptsPerSecond).toBe(0);
    expect(summary.metrics.throughput.failedAttemptsPerSecond).toBe(0);
  });

  it('computes percentiles from measured attempts using shared nearest-rank engine', () => {
    const durations = Array.from({ length: 20 }, (_, index) => index + 1);
    const report: GrpcLoadTestRunReport = {
      runId: 'run-percentiles',
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: '2026-07-01T00:00:10.000Z',
      durationMs: 10_000,
      stopReason: 'completed_total_calls',
      counts: {
        scheduled: 20,
        completed: 20,
        succeeded: 20,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 4,
      },
      attempts: durations.map((durationMs, index) => ({
        attemptNumber: index + 1,
        warmup: false,
        startedAt: '2026-07-01T00:00:00.000Z',
        finishedAt: '2026-07-01T00:00:00.100Z',
        durationMs,
        ok: true,
        statusCode: 0,
      })),
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-percentiles',
        executeSnapshot: makeSnapshot().executeSnapshot,
        config: { concurrency: 4, totalCalls: 20 },
      }),
      report,
      exportedAt: '2026-07-01T00:00:11.000Z',
    });

    expect(summary.metrics.latency.samples).toBe(20);
    expect(summary.metrics.latency.minMs).toBe(1);
    expect(summary.metrics.latency.maxMs).toBe(20);
    expect(summary.metrics.latency.meanMs).toBe(10.5);
    expect(summary.metrics.latency.p50Ms).toBe(11);
    expect(summary.metrics.latency.p95Ms).toBe(20);
    expect(summary.metrics.latency.p99Ms).toBe(20);
    expect(summary.metrics.latency.p999Ms).toBe(20);
  });
});

describe('Phase 11C-B - JSON and CSV export stability', () => {
  it('serializes stable JSON with run metadata and raw attempts', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report: makeReport(),
      exportedAt: '2026-07-01T00:00:13.000Z',
    });
    const json = serializeGrpcLoadTestRunSummaryJson(summary);
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.kind).toBe('grpc_load_test_summary');
    expect(parsed.exportedAt).toBe('2026-07-01T00:00:13.000Z');
    expect(parsed.resolvedEnvName).toBe('local');
    expect(parsed.config.concurrency).toBe(4);
    expect(parsed.counts.warmupCompleted).toBe(2);
    expect(parsed.metrics.latency.samples).toBe(2);
    expect(parsed.attempts).toHaveLength(4);
    expect(json).toMatchSnapshot();
  });

  it('round-trips JSON without losing summary fields', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report: makeReport(),
      exportedAt: '2026-07-01T00:00:13.000Z',
    });
    const reparsed = JSON.parse(serializeGrpcLoadTestRunSummaryJson(summary)) as typeof summary;

    expect(reparsed.runId).toBe(summary.runId);
    expect(reparsed.metrics).toEqual(summary.metrics);
    expect(reparsed.counts).toEqual(summary.counts);
    expect(reparsed.attempts).toEqual(summary.attempts);
  });

  it('defaults exportedAt when omitted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T12:34:56.789Z'));

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report: makeReport(),
    });

    expect(summary.exportedAt).toBe('2026-07-01T12:34:56.789Z');
    vi.useRealTimers();
  });

  it('isolates export output from later input mutation via structuredClone', () => {
    const snapshot = makeSnapshot();
    const report = makeReport();
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot,
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    snapshot.config.concurrency = 99;
    report.attempts[0]!.durationMs = 9_999;

    expect(summary.config.concurrency).toBe(4);
    expect(summary.attempts[0]!.durationMs).toBe(10);

    const summaryAgain = buildGrpcLoadTestRunSummaryExport({
      snapshot,
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    expect(summaryAgain.config.concurrency).toBe(99);
    expect(summaryAgain.attempts[0]!.durationMs).toBe(9_999);
  });

  it('serializes CSV with Phase 11H source-metadata columns when summary includes sourceMetadata', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report: makeReport(),
      exportedAt: '2026-07-01T00:00:13.000Z',
    });
    const withSource = {
      ...summary,
      sourceMetadata: {
        schemaVersion: 1 as const,
        exportedFrom: 'grpc_studio_advanced' as const,
        tabId: 'tab-1',
        service: 'echo.EchoService',
        method: 'Echo',
        callType: 'unary' as const,
        descriptorKey: 'reflection:localhost:50051',
        targetTemplate: 'localhost:50051',
        transportMode: 'native' as const,
      },
    };
    const csv = serializeGrpcLoadTestRunSummaryCsv(withSource);
    const header = csv.split('\n')[0]!;

    expect(header).toContain('sourceService');
    expect(header).toContain('sourceMethod');
    expect(header).toContain('sourceDescriptorKey');
    expect(header).toContain('sourceTargetTemplate');
    expect(header).toContain('sourceTransportMode');
    expect(csv).toContain('echo.EchoService');
    expect(csv).toContain('reflection:localhost:50051');
    expect(csv).toContain('localhost:50051');
  });

  it('serializes CSV with reproducible metadata and per-attempt rows', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report: makeReport(),
      exportedAt: '2026-07-01T00:00:13.000Z',
    });
    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('runId,exportedAt,startedAt,completedAt,durationMs,stopReason');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toContain('run-11c');
    expect(lines[1]).toContain('2');
    expect(lines[1]).toContain('100');
    expect(lines[4]).toContain('200');
    expect(csv).toMatchSnapshot();
  });

  it('escapes commas and quotes in CSV attempt error messages', () => {
    const report = makeReport();
    report.attempts[3] = {
      ...report.attempts[3]!,
      errorMessage: 'UNAVAILABLE, retry "later"',
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv).toContain('"UNAVAILABLE, retry ""later"""');
  });

  it('escapes newlines in CSV attempt error messages', () => {
    const report = makeReport();
    report.attempts[3] = {
      ...report.attempts[3]!,
      errorMessage: 'line1\nline2',
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv).toContain('"line1\nline2"');
  });

  it('escapes carriage returns in CSV attempt error messages', () => {
    const report = makeReport();
    report.attempts[3] = {
      ...report.attempts[3]!,
      errorMessage: 'line1\rline2',
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv).toContain('"line1\rline2"');
  });

  it('uses deterministic status-code ordering in CSV distribution column', () => {
    const report = makeReport();
    report.attempts[2] = {
      ...report.attempts[2]!,
      statusCode: 14,
    };
    report.attempts[3] = {
      ...report.attempts[3]!,
      ok: true,
      statusCode: 0,
      errorMessage: undefined,
    };

    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report,
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv).toContain('0|14');
    expect(csv).not.toContain('14|0');
  });

  it('preserves empty-attempt exports with a summary row', () => {
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: makeSnapshot(),
      report: {
        ...makeReport(),
        attempts: [],
        counts: {
          scheduled: 0,
          completed: 0,
          succeeded: 0,
          failed: 0,
          warmupScheduled: 0,
          warmupCompleted: 0,
          peakInFlight: 0,
        },
      },
      exportedAt: '2026-07-01T00:00:13.000Z',
    });

    const csv = serializeGrpcLoadTestRunSummaryCsv(summary);
    expect(csv.split('\n')).toHaveLength(2);
    expect(summary.metrics.latency.samples).toBe(0);
    expect(summary.metrics.throughput.allAttemptsPerSecond).toBe(0);
  });
});

describe('Phase 11C-C - scheduler integration', () => {
  it('builds summary export from a real scheduler report', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-11c-integration',
      executeSnapshot: makeSnapshot().executeSnapshot,
      config: { concurrency: 2, totalCalls: 6, warmupCalls: 2 },
      resolvedEnvName: 'integration',
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ attemptNumber, warmup }) => ({
        ok: attemptNumber % 4 !== 0,
        durationMs: warmup ? 5 : 10 + attemptNumber,
        statusCode: attemptNumber % 4 === 0 ? 14 : 0,
        errorMessage: attemptNumber % 4 === 0 ? 'UNAVAILABLE' : undefined,
      }),
    });

    const report = await run.completion;
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot,
      report,
      exportedAt: '2026-07-01T00:01:00.000Z',
    });

    const measuredAttempts = report.attempts.filter((attempt) => !attempt.warmup);
    const warmupAttempts = report.attempts.filter((attempt) => attempt.warmup);

    expect(summary.runId).toBe('run-11c-integration');
    expect(summary.counts.completed).toBe(6);
    expect(summary.metrics.latency.warmupSamples).toBe(warmupAttempts.length);
    expect(summary.metrics.latency.samples).toBe(measuredAttempts.length);
    expect(summary.metrics.latency.minMs).toBe(
      Math.min(...measuredAttempts.map((attempt) => Math.max(0, attempt.durationMs))),
    );
    expect(summary.metrics.latency.minMs).toBeGreaterThan(
      Math.min(...warmupAttempts.map((attempt) => attempt.durationMs)),
    );
    expect(summary.metrics.statusDistribution.measuredAttempts).toBe(measuredAttempts.length);
    expect(summary.metrics.statusDistribution.warmupAttempts).toBe(warmupAttempts.length);
    expect(summary.metrics.statusDistribution.succeededAttempts).toBe(
      measuredAttempts.filter((attempt) => attempt.ok).length,
    );
    expect(summary.metrics.statusDistribution.failedAttempts).toBe(
      measuredAttempts.filter((attempt) => !attempt.ok).length,
    );
    expect(
      summary.metrics.throughput.succeededAttemptsPerSecond
      + summary.metrics.throughput.failedAttemptsPerSecond,
    ).toBe(summary.metrics.throughput.measuredAttemptsPerSecond);
    expect(summary.attempts).toHaveLength(6);
  });
});

describe('Phase 11C-D - source-scan traceability', () => {
  it('metrics module exports summary builder and serializers', () => {
    const src = readSrc('src/shared/grpc/grpcLoadTestMetrics.ts');
    expect(src.includes('buildGrpcLoadTestRunSummaryExport')).toBe(true);
    expect(src.includes('serializeGrpcLoadTestRunSummaryJson')).toBe(true);
    expect(src.includes('serializeGrpcLoadTestRunSummaryCsv')).toBe(true);
  });

  it('metrics module excludes warmup from measured latency and throughput rates', () => {
    const src = readSrc('src/shared/grpc/grpcLoadTestMetrics.ts');
    expect(src.includes('isWarmupAttempt')).toBe(true);
    expect(src.includes('buildLatencyMetrics(measuredAttempts)')).toBe(true);
    expect(src.includes('countAttemptOutcomes')).toBe(true);
    expect(src.includes('formatStatusCodeDistributionKeys')).toBe(true);
    expect(src.includes('resolveStatusCodeBucket')).toBe(true);
    expect(src.includes('sanitizeDurationMs')).toBe(true);
  });
});
