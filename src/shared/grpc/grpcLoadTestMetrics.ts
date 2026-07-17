/**
 * Phase 11C - Load-test metrics pipeline and export.
 *
 * Builds a reproducible summary from Phase 11B scheduler reports, excluding warm-up
 * attempts from latency and throughput metrics while preserving them in the raw counts.
 */

import type {
  GrpcLoadTestConfig,
  GrpcLoadTestExecutionAttempt,
  GrpcLoadTestRunCounts,
  GrpcLoadTestRunReport,
  GrpcLoadTestStopReason,
} from './grpcAdvancedFeatureContracts';
import { computePercentiles, round2 } from '../utils/percentiles';

export interface GrpcLoadTestSummaryLatencyMetrics {
  samples: number;
  warmupSamples: number;
  measuredSamples: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  p999Ms: number;
}

export interface GrpcLoadTestSummaryThroughputMetrics {
  allAttemptsPerSecond: number;
  measuredAttemptsPerSecond: number;
  warmupAttemptsPerSecond: number;
  succeededAttemptsPerSecond: number;
  failedAttemptsPerSecond: number;
}

export interface GrpcLoadTestSummaryStatusDistribution {
  totalAttempts: number;
  warmupAttempts: number;
  measuredAttempts: number;
  succeededAttempts: number;
  failedAttempts: number;
  byStatusCode: Record<string, number>;
}

export interface GrpcLoadTestRunMetrics {
  latency: GrpcLoadTestSummaryLatencyMetrics;
  throughput: GrpcLoadTestSummaryThroughputMetrics;
  statusDistribution: GrpcLoadTestSummaryStatusDistribution;
}

export interface GrpcLoadTestRunSummaryExport {
  schemaVersion: 1;
  kind: 'grpc_load_test_summary';
  runId: string;
  exportedAt: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stopReason: GrpcLoadTestStopReason;
  resolvedEnvName?: string;
  config: GrpcLoadTestConfig;
  counts: GrpcLoadTestRunCounts;
  metrics: GrpcLoadTestRunMetrics;
  attempts: GrpcLoadTestExecutionAttempt[];
}

export interface GrpcLoadTestRunSummaryInput {
  snapshot: {
    runId: string;
    config: GrpcLoadTestConfig;
    resolvedEnvName?: string;
  };
  report: GrpcLoadTestRunReport;
  exportedAt?: string;
}

interface GrpcLoadTestRunSummaryRow {
  runId: string;
  exportedAt: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stopReason: GrpcLoadTestStopReason;
  resolvedEnvName: string;
  concurrency: number;
  totalCalls: string;
  durationLimitMs: string;
  rampUpMs: string;
  warmupCalls: string;
  scheduled: number;
  completed: number;
  succeeded: number;
  failed: number;
  warmupScheduled: number;
  warmupCompleted: number;
  peakInFlight: number;
  totalAttempts: number;
  warmupAttempts: number;
  measuredAttempts: number;
  latencySamples: number;
  latencyMinMs: number;
  latencyMaxMs: number;
  latencyMeanMs: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  latencyP999Ms: number;
  allAttemptsPerSecond: number;
  measuredAttemptsPerSecond: number;
  warmupAttemptsPerSecond: number;
  succeededAttemptsPerSecond: number;
  failedAttemptsPerSecond: number;
  statusCode: string;
  attemptNumber: string;
  warmup: string;
  attemptStartedAt: string;
  attemptFinishedAt: string;
  attemptDurationMs: string;
  attemptOk: string;
  attemptStatusCode: string;
  attemptErrorMessage: string;
  sourceService: string;
  sourceMethod: string;
  sourceDescriptorKey: string;
  sourceTargetTemplate: string;
  sourceTransportMode: string;
}

function isWarmupAttempt(attempt: GrpcLoadTestExecutionAttempt): boolean {
  return Boolean(attempt.warmup);
}

function formatNumberOrBlank(value: number | undefined): string {
  return value == null ? '' : String(value);
}

function sanitizeDurationMs(durationMs: number): number {
  if (!Number.isFinite(durationMs)) {
    return 0;
  }
  return Math.max(0, durationMs);
}

function escapeCsv(value: string | number | boolean | undefined): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function countAttemptOutcomes(attempts: GrpcLoadTestExecutionAttempt[]): { succeeded: number; failed: number } {
  let succeeded = 0;
  let failed = 0;
  for (const attempt of attempts) {
    if (attempt.ok) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }
  return { succeeded, failed };
}

function resolveStatusCodeBucket(attempt: GrpcLoadTestExecutionAttempt): string {
  if (attempt.statusCode == null) {
    return attempt.ok ? '0' : 'unknown';
  }
  if (!attempt.ok && attempt.statusCode === 0) {
    return 'unknown';
  }
  return String(attempt.statusCode);
}

function buildStatusCodeDistribution(attempts: GrpcLoadTestExecutionAttempt[]): Record<string, number> {
  const byStatusCode: Record<string, number> = {};
  for (const attempt of attempts) {
    const key = resolveStatusCodeBucket(attempt);
    byStatusCode[key] = (byStatusCode[key] ?? 0) + 1;
  }
  return byStatusCode;
}

function formatStatusCodeDistributionKeys(byStatusCode: Record<string, number>): string {
  return Object.keys(byStatusCode).sort((left, right) => {
    if (left === 'unknown') return 1;
    if (right === 'unknown') return -1;
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
      return leftNumber - rightNumber;
    }
    return left.localeCompare(right);
  }).join('|');
}

function buildLatencyMetrics(attempts: GrpcLoadTestExecutionAttempt[]): GrpcLoadTestSummaryLatencyMetrics {
  const durations = attempts
    .map((attempt) => sanitizeDurationMs(attempt.durationMs))
    .sort((a, b) => a - b);
  if (durations.length === 0) {
    return {
      samples: 0,
      warmupSamples: 0,
      measuredSamples: 0,
      minMs: 0,
      maxMs: 0,
      meanMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      p999Ms: 0,
    };
  }

  const percentiles = computePercentiles(durations);
  return {
    samples: durations.length,
    warmupSamples: 0,
    measuredSamples: durations.length,
    minMs: round2(percentiles.min),
    maxMs: round2(percentiles.max),
    meanMs: round2(percentiles.mean),
    p50Ms: round2(percentiles.p50),
    p95Ms: round2(percentiles.p95),
    p99Ms: round2(percentiles.p99),
    p999Ms: round2(percentiles.p999),
  };
}

function buildThroughputMetrics(
  report: GrpcLoadTestRunReport,
  measuredCount: number,
  warmupCount: number,
  measuredOutcomes: { succeeded: number; failed: number },
): GrpcLoadTestSummaryThroughputMetrics {
  const durationSeconds = report.durationMs > 0 ? report.durationMs / 1000 : 0;
  const perSecond = (count: number): number => (durationSeconds > 0 ? round2(count / durationSeconds) : 0);

  return {
    allAttemptsPerSecond: perSecond(report.counts.completed),
    measuredAttemptsPerSecond: perSecond(measuredCount),
    warmupAttemptsPerSecond: perSecond(warmupCount),
    succeededAttemptsPerSecond: perSecond(measuredOutcomes.succeeded),
    failedAttemptsPerSecond: perSecond(measuredOutcomes.failed),
  };
}

function buildSummaryRow(_input: GrpcLoadTestRunSummaryInput, summary: GrpcLoadTestRunSummaryExport): GrpcLoadTestRunSummaryRow[] {
  const metrics = summary.metrics;
  const statusCodeDistribution = formatStatusCodeDistributionKeys(metrics.statusDistribution.byStatusCode);
  const sourceMetadata = 'sourceMetadata' in summary
    ? (summary as GrpcLoadTestRunSummaryExport & {
        sourceMetadata?: {
          service: string;
          method: string;
          descriptorKey: string;
          targetTemplate: string;
          transportMode?: string;
        };
      }).sourceMetadata
    : undefined;
  const baseRow = {
    runId: summary.runId,
    exportedAt: summary.exportedAt,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
    durationMs: summary.durationMs,
    stopReason: summary.stopReason,
    resolvedEnvName: summary.resolvedEnvName ?? '',
    concurrency: summary.config.concurrency,
    totalCalls: formatNumberOrBlank(summary.config.totalCalls),
    durationLimitMs: formatNumberOrBlank(summary.config.durationMs),
    rampUpMs: formatNumberOrBlank(summary.config.rampUpMs),
    warmupCalls: formatNumberOrBlank(summary.config.warmupCalls),
    scheduled: summary.counts.scheduled,
    completed: summary.counts.completed,
    succeeded: summary.counts.succeeded,
    failed: summary.counts.failed,
    warmupScheduled: summary.counts.warmupScheduled,
    warmupCompleted: summary.counts.warmupCompleted,
    peakInFlight: summary.counts.peakInFlight,
    totalAttempts: summary.attempts.length,
    warmupAttempts: metrics.statusDistribution.warmupAttempts,
    measuredAttempts: metrics.statusDistribution.measuredAttempts,
    latencySamples: metrics.latency.samples,
    latencyMinMs: metrics.latency.minMs,
    latencyMaxMs: metrics.latency.maxMs,
    latencyMeanMs: metrics.latency.meanMs,
    latencyP50Ms: metrics.latency.p50Ms,
    latencyP95Ms: metrics.latency.p95Ms,
    latencyP99Ms: metrics.latency.p99Ms,
    latencyP999Ms: metrics.latency.p999Ms,
    allAttemptsPerSecond: metrics.throughput.allAttemptsPerSecond,
    measuredAttemptsPerSecond: metrics.throughput.measuredAttemptsPerSecond,
    warmupAttemptsPerSecond: metrics.throughput.warmupAttemptsPerSecond,
    succeededAttemptsPerSecond: metrics.throughput.succeededAttemptsPerSecond,
    failedAttemptsPerSecond: metrics.throughput.failedAttemptsPerSecond,
    sourceService: sourceMetadata?.service ?? '',
    sourceMethod: sourceMetadata?.method ?? '',
    sourceDescriptorKey: sourceMetadata?.descriptorKey ?? '',
    sourceTargetTemplate: sourceMetadata?.targetTemplate ?? '',
    sourceTransportMode: sourceMetadata?.transportMode ?? '',
  };

  if (summary.attempts.length === 0) {
    return [{
      ...baseRow,
      statusCode: '',
      attemptNumber: '',
      warmup: '',
      attemptStartedAt: '',
      attemptFinishedAt: '',
      attemptDurationMs: '',
      attemptOk: '',
      attemptStatusCode: '',
      attemptErrorMessage: '',
    }];
  }

  return summary.attempts.map((attempt) => ({
    ...baseRow,
    statusCode: statusCodeDistribution,
    attemptNumber: String(attempt.attemptNumber),
    warmup: String(attempt.warmup),
    attemptStartedAt: attempt.startedAt,
    attemptFinishedAt: attempt.finishedAt,
    attemptDurationMs: String(attempt.durationMs),
    attemptOk: String(attempt.ok),
    attemptStatusCode: formatNumberOrBlank(attempt.statusCode),
    attemptErrorMessage: attempt.errorMessage ?? '',
  }));
}

export function buildGrpcLoadTestRunSummaryExport(
  input: GrpcLoadTestRunSummaryInput,
): GrpcLoadTestRunSummaryExport {
  const measuredAttempts = input.report.attempts.filter((attempt) => !isWarmupAttempt(attempt));
  const warmupAttempts = input.report.attempts.filter(isWarmupAttempt);
  const measuredOutcomes = countAttemptOutcomes(measuredAttempts);

  const summary: GrpcLoadTestRunSummaryExport = {
    schemaVersion: 1,
    kind: 'grpc_load_test_summary',
    runId: input.snapshot.runId,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    startedAt: input.report.startedAt,
    completedAt: input.report.completedAt,
    durationMs: input.report.durationMs,
    stopReason: input.report.stopReason,
    resolvedEnvName: input.snapshot.resolvedEnvName,
    config: structuredClone(input.snapshot.config),
    counts: structuredClone(input.report.counts),
    metrics: {
      latency: {
        ...buildLatencyMetrics(measuredAttempts),
        warmupSamples: warmupAttempts.length,
        measuredSamples: measuredAttempts.length,
      },
      throughput: buildThroughputMetrics(
        input.report,
        measuredAttempts.length,
        warmupAttempts.length,
        measuredOutcomes,
      ),
      statusDistribution: {
        totalAttempts: input.report.attempts.length,
        warmupAttempts: warmupAttempts.length,
        measuredAttempts: measuredAttempts.length,
        succeededAttempts: measuredOutcomes.succeeded,
        failedAttempts: measuredOutcomes.failed,
        byStatusCode: buildStatusCodeDistribution(measuredAttempts),
      },
    },
    attempts: structuredClone(input.report.attempts),
  };

  return summary;
}

export function serializeGrpcLoadTestRunSummaryJson(
  summary: GrpcLoadTestRunSummaryExport,
): string {
  return JSON.stringify(summary, null, 2);
}

export function serializeGrpcLoadTestRunSummaryCsv(
  summary: GrpcLoadTestRunSummaryExport,
): string {
  const rows = buildSummaryRow(
    {
      snapshot: {
        runId: summary.runId,
        config: summary.config,
        resolvedEnvName: summary.resolvedEnvName,
      },
      report: {
        runId: summary.runId,
        startedAt: summary.startedAt,
        completedAt: summary.completedAt,
        durationMs: summary.durationMs,
        stopReason: summary.stopReason,
        counts: summary.counts,
        attempts: summary.attempts,
      },
      exportedAt: summary.exportedAt,
    },
    summary,
  );

  const header = [
    'runId',
    'exportedAt',
    'startedAt',
    'completedAt',
    'durationMs',
    'stopReason',
    'resolvedEnvName',
    'concurrency',
    'totalCalls',
    'durationLimitMs',
    'rampUpMs',
    'warmupCalls',
    'scheduled',
    'completed',
    'succeeded',
    'failed',
    'warmupScheduled',
    'warmupCompleted',
    'peakInFlight',
    'totalAttempts',
    'warmupAttempts',
    'measuredAttempts',
    'latencySamples',
    'latencyMinMs',
    'latencyMaxMs',
    'latencyMeanMs',
    'latencyP50Ms',
    'latencyP95Ms',
    'latencyP99Ms',
    'latencyP999Ms',
    'allAttemptsPerSecond',
    'measuredAttemptsPerSecond',
    'warmupAttemptsPerSecond',
    'succeededAttemptsPerSecond',
    'failedAttemptsPerSecond',
    'statusCodeDistribution',
    'attemptNumber',
    'warmup',
    'attemptStartedAt',
    'attemptFinishedAt',
    'attemptDurationMs',
    'attemptOk',
    'attemptStatusCode',
    'attemptErrorMessage',
    'sourceService',
    'sourceMethod',
    'sourceDescriptorKey',
    'sourceTargetTemplate',
    'sourceTransportMode',
  ];

  const lines = [header.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push([
      row.runId,
      row.exportedAt,
      row.startedAt,
      row.completedAt,
      row.durationMs,
      row.stopReason,
      row.resolvedEnvName,
      row.concurrency,
      row.totalCalls,
      row.durationLimitMs,
      row.rampUpMs,
      row.warmupCalls,
      row.scheduled,
      row.completed,
      row.succeeded,
      row.failed,
      row.warmupScheduled,
      row.warmupCompleted,
      row.peakInFlight,
      row.totalAttempts,
      row.warmupAttempts,
      row.measuredAttempts,
      row.latencySamples,
      row.latencyMinMs,
      row.latencyMaxMs,
      row.latencyMeanMs,
      row.latencyP50Ms,
      row.latencyP95Ms,
      row.latencyP99Ms,
      row.latencyP999Ms,
      row.allAttemptsPerSecond,
      row.measuredAttemptsPerSecond,
      row.warmupAttemptsPerSecond,
      row.succeededAttemptsPerSecond,
      row.failedAttemptsPerSecond,
      row.statusCode,
      row.attemptNumber,
      row.warmup,
      row.attemptStartedAt,
      row.attemptFinishedAt,
      row.attemptDurationMs,
      row.attemptOk,
      row.attemptStatusCode,
      row.attemptErrorMessage,
      row.sourceService,
      row.sourceMethod,
      row.sourceDescriptorKey,
      row.sourceTargetTemplate,
      row.sourceTransportMode,
    ].map(escapeCsv).join(','));
  }

  return lines.join('\n');
}
