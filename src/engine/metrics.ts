import type { RequestResult, TestSummary } from '@shared/types';
import { percentile, round2 } from '@shared/utils/percentiles';

export function computeMetrics(results: RequestResult[], totalDurationMs: number): TestSummary {
  const activeResults = results.filter(r => !r.cancelled);
  const times = activeResults.map((r) => r.responseTimeMs).sort((a, b) => a - b);
  const total = activeResults.length;

  if (total === 0) {
    return {
      tps: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      p999ResponseTime: 0,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: results.length,
      successfulRequests: 0,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs,
      cancelledRequests: results.length - total,
    };
  }

  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / total;
  const tps = totalDurationMs > 0 ? (total / totalDurationMs) * 1000 : 0;

  const errorsByStatus: Record<number, number> = {};
  let failedRequests = 0;
  let failedValidations = 0;

  for (const r of activeResults) {
    const isHttp = (r.transportType ?? 'http') === 'http';
    if (isHttp && (r.httpStatus >= 400 || r.httpStatus === 0)) {
      failedRequests++;
      errorsByStatus[r.httpStatus] = (errorsByStatus[r.httpStatus] || 0) + 1;
    } else if (!isHttp && !r.passed) {
      failedRequests++;
    }
    if (!r.passed && r.failureDetails.length > 0) {
      failedValidations++;
    }
  }

  const errorRate = (failedRequests / total) * 100;

  return {
    tps: round2(tps),
    avgResponseTime: round2(avg),
    minResponseTime: round2(times[0]),
    maxResponseTime: round2(times[total - 1]),
    p50ResponseTime: round2(percentile(times, 0.50)),
    p95ResponseTime: round2(percentile(times, 0.95)),
    p99ResponseTime: round2(percentile(times, 0.99)),
    p999ResponseTime: round2(percentile(times, 0.999)),
    errorRate: round2(errorRate),
    errorsByStatus,
    totalRequests: results.length,
    successfulRequests: total - failedRequests,
    failedRequests,
    failedValidations,
    totalDurationMs: Math.round(totalDurationMs),
    cancelledRequests: results.length - total,
  };
}
