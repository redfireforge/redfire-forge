import type { UseGrpcStudioAdvancedFeaturesReturn } from '../../hooks/useGrpcStudioAdvancedFeatures';

export type GrpcLoadTestSummary = NonNullable<UseGrpcStudioAdvancedFeaturesReturn['loadTest']['lastSummary']>;

export function parsePositiveInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseNonNegativeInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parsePositiveSecondsToMs(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) : undefined;
}

export function parseNonNegativeSecondsToMs(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 1000) : undefined;
}

export function presentMsAsSeconds(valueMs?: number): string {
  if (valueMs == null) return '';
  return String(valueMs / 1000);
}

export function safeFilePart(value: string | undefined, fallback: string): string {
  const normalized = (value ?? '').trim().replace(/[^a-z0-9._-]+/gi, '-');
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, 64);
}

export function downloadTextFile(text: string, fileName: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function formatStopReason(stopReason: string): string {
  return stopReason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function toPercentString(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function toSignedNumber(value: number, suffix = ''): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

export function statusCodeSort(left: string, right: string): number {
  if (left === 'unknown') return 1;
  if (right === 'unknown') return -1;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

export function buildStatusBreakdown(summary: GrpcLoadTestSummary) {
  const entries = Object.entries(summary.metrics.statusDistribution.byStatusCode)
    .map(([statusCode, count]) => ({
      statusCode,
      count,
      ratio: summary.metrics.statusDistribution.measuredAttempts > 0
        ? count / summary.metrics.statusDistribution.measuredAttempts
        : 0,
    }))
    .sort((left, right) => right.count - left.count);
  return entries;
}

export function buildLatencyHistogram(summary: GrpcLoadTestSummary) {
  const durations = summary.attempts
    .filter((attempt) => !attempt.warmup)
    .map((attempt) => attempt.durationMs)
    .filter((durationMs) => Number.isFinite(durationMs) && durationMs >= 0)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return [];
  }

  const minMs = durations[0];
  const maxMs = durations[durations.length - 1];
  if (maxMs === minMs) {
    return [{ label: `${minMs.toFixed(0)}ms`, count: durations.length, ratio: 1 }];
  }

  const bucketCount = 8;
  const bucketWidth = Math.max(1, Math.ceil((maxMs - minMs) / bucketCount));
  const counts = new Array(bucketCount).fill(0);
  for (const duration of durations) {
    const index = Math.min(bucketCount - 1, Math.floor((duration - minMs) / bucketWidth));
    counts[index] += 1;
  }

  const maxCount = Math.max(...counts, 1);
  return counts.map((count, index) => {
    const start = minMs + (index * bucketWidth);
    const end = index === bucketCount - 1 ? maxMs : start + bucketWidth;
    return {
      label: `${Math.round(start)}-${Math.round(end)}ms`,
      count,
      ratio: count / maxCount,
    };
  });
}

export function buildThroughputTimeline(summary: GrpcLoadTestSummary) {
  const startedMs = Date.parse(summary.startedAt);
  if (!Number.isFinite(startedMs)) {
    return [];
  }

  const buckets = new Map<number, { succeeded: number; failed: number }>();
  for (const attempt of summary.attempts) {
    if (attempt.warmup) {
      continue;
    }
    const finishedMs = Date.parse(attempt.finishedAt);
    if (!Number.isFinite(finishedMs)) {
      continue;
    }
    const second = Math.max(0, Math.floor((finishedMs - startedMs) / 1000));
    const bucket = buckets.get(second) ?? { succeeded: 0, failed: 0 };
    if (attempt.ok) {
      bucket.succeeded += 1;
    } else {
      bucket.failed += 1;
    }
    buckets.set(second, bucket);
  }

  const sortedSeconds = [...buckets.keys()].sort((a, b) => a - b);
  const maxTotal = Math.max(...sortedSeconds.map((second) => {
    const bucket = buckets.get(second);
    return (bucket?.succeeded ?? 0) + (bucket?.failed ?? 0);
  }), 1);

  return sortedSeconds.map((second) => {
    const bucket = buckets.get(second) ?? { succeeded: 0, failed: 0 };
    const total = bucket.succeeded + bucket.failed;
    return {
      second,
      succeeded: bucket.succeeded,
      failed: bucket.failed,
      total,
      ratio: total / maxTotal,
    };
  });
}

export function buildCompareDeltas(summary: GrpcLoadTestSummary, compareSummary: GrpcLoadTestSummary) {
  const currentErrorRate = summary.metrics.statusDistribution.measuredAttempts > 0
    ? (summary.metrics.statusDistribution.failedAttempts / summary.metrics.statusDistribution.measuredAttempts) * 100
    : 0;
  const baselineErrorRate = compareSummary.metrics.statusDistribution.measuredAttempts > 0
    ? (compareSummary.metrics.statusDistribution.failedAttempts
      / compareSummary.metrics.statusDistribution.measuredAttempts) * 100
    : 0;
  return {
    throughputDelta: summary.metrics.throughput.measuredAttemptsPerSecond
      - compareSummary.metrics.throughput.measuredAttemptsPerSecond,
    p50Delta: summary.metrics.latency.p50Ms - compareSummary.metrics.latency.p50Ms,
    p95Delta: summary.metrics.latency.p95Ms - compareSummary.metrics.latency.p95Ms,
    errorRateDelta: currentErrorRate - baselineErrorRate,
  };
}

export function buildCompareDetailRows(summary: GrpcLoadTestSummary, compareSummary: GrpcLoadTestSummary) {
  const currentMeasured = summary.metrics.statusDistribution.measuredAttempts;
  const baselineMeasured = compareSummary.metrics.statusDistribution.measuredAttempts;
  const currentErrorRate = currentMeasured > 0
    ? (summary.metrics.statusDistribution.failedAttempts / currentMeasured) * 100
    : 0;
  const baselineErrorRate = baselineMeasured > 0
    ? (compareSummary.metrics.statusDistribution.failedAttempts / baselineMeasured) * 100
    : 0;
  const currentSuccessRate = 100 - currentErrorRate;
  const baselineSuccessRate = 100 - baselineErrorRate;

  return [
    {
      label: 'Throughput (RPS)',
      baseline: compareSummary.metrics.throughput.measuredAttemptsPerSecond.toFixed(2),
      current: summary.metrics.throughput.measuredAttemptsPerSecond.toFixed(2),
      delta: toSignedNumber(
        summary.metrics.throughput.measuredAttemptsPerSecond
          - compareSummary.metrics.throughput.measuredAttemptsPerSecond,
      ),
      improved: summary.metrics.throughput.measuredAttemptsPerSecond
        >= compareSummary.metrics.throughput.measuredAttemptsPerSecond,
    },
    {
      label: 'Success rate',
      baseline: toPercentString(baselineSuccessRate),
      current: toPercentString(currentSuccessRate),
      delta: toSignedNumber(currentSuccessRate - baselineSuccessRate, '%'),
      improved: currentSuccessRate >= baselineSuccessRate,
    },
    {
      label: 'Error rate',
      baseline: toPercentString(baselineErrorRate),
      current: toPercentString(currentErrorRate),
      delta: toSignedNumber(currentErrorRate - baselineErrorRate, '%'),
      improved: currentErrorRate <= baselineErrorRate,
    },
    {
      label: 'p50 latency (ms)',
      baseline: compareSummary.metrics.latency.p50Ms.toFixed(2),
      current: summary.metrics.latency.p50Ms.toFixed(2),
      delta: toSignedNumber(summary.metrics.latency.p50Ms - compareSummary.metrics.latency.p50Ms),
      improved: summary.metrics.latency.p50Ms <= compareSummary.metrics.latency.p50Ms,
    },
    {
      label: 'p95 latency (ms)',
      baseline: compareSummary.metrics.latency.p95Ms.toFixed(2),
      current: summary.metrics.latency.p95Ms.toFixed(2),
      delta: toSignedNumber(summary.metrics.latency.p95Ms - compareSummary.metrics.latency.p95Ms),
      improved: summary.metrics.latency.p95Ms <= compareSummary.metrics.latency.p95Ms,
    },
    {
      label: 'p99 latency (ms)',
      baseline: compareSummary.metrics.latency.p99Ms.toFixed(2),
      current: summary.metrics.latency.p99Ms.toFixed(2),
      delta: toSignedNumber(summary.metrics.latency.p99Ms - compareSummary.metrics.latency.p99Ms),
      improved: summary.metrics.latency.p99Ms <= compareSummary.metrics.latency.p99Ms,
    },
    {
      label: 'Measured attempts',
      baseline: String(baselineMeasured),
      current: String(currentMeasured),
      delta: toSignedNumber(currentMeasured - baselineMeasured),
      improved: currentMeasured >= baselineMeasured,
    },
  ];
}

export function buildCompareStatusComposition(summary: GrpcLoadTestSummary, compareSummary: GrpcLoadTestSummary) {
  const currentByCode = summary.metrics.statusDistribution.byStatusCode;
  const baselineByCode = compareSummary.metrics.statusDistribution.byStatusCode;
  const allCodes = [...new Set([
    ...Object.keys(currentByCode),
    ...Object.keys(baselineByCode),
  ])].sort(statusCodeSort);

  return allCodes.map((statusCode) => {
    const currentCount = currentByCode[statusCode] ?? 0;
    const baselineCount = baselineByCode[statusCode] ?? 0;
    const currentPct = summary.metrics.statusDistribution.measuredAttempts > 0
      ? (currentCount / summary.metrics.statusDistribution.measuredAttempts) * 100
      : 0;
    const baselinePct = compareSummary.metrics.statusDistribution.measuredAttempts > 0
      ? (baselineCount / compareSummary.metrics.statusDistribution.measuredAttempts) * 100
      : 0;
    return {
      statusCode,
      baselineCount,
      currentCount,
      deltaCount: currentCount - baselineCount,
      baselinePct,
      currentPct,
      deltaPct: currentPct - baselinePct,
    };
  });
}
