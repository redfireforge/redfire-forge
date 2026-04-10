import type { RequestResult, TestSummary } from '../types';

export function computeMetrics(results: RequestResult[], totalDurationMs: number): TestSummary {
  const times = results.map((r) => r.responseTimeMs).sort((a, b) => a - b);
  const total = results.length;

  if (total === 0) {
    return {
      tps: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs,
    };
  }

  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / total;
  const min = times[0];
  const max = times[total - 1];
  const p95 = times[Math.floor(total * 0.95)] ?? max;
  const p99 = times[Math.floor(total * 0.99)] ?? max;

  const tps = totalDurationMs > 0 ? (total / totalDurationMs) * 1000 : 0;

  const errorsByStatus: Record<number, number> = {};
  let failedRequests = 0;
  let failedValidations = 0;

  for (const r of results) {
    if (r.httpStatus >= 400 || r.httpStatus === 0) {
      failedRequests++;
      errorsByStatus[r.httpStatus] = (errorsByStatus[r.httpStatus] || 0) + 1;
    }
    if (!r.passed && r.failureDetails.length > 0) {
      failedValidations++;
    }
  }

  const errorRate = total > 0 ? (failedRequests / total) * 100 : 0;

  return {
    tps: Math.round(tps * 100) / 100,
    avgResponseTime: Math.round(avg * 100) / 100,
    minResponseTime: Math.round(min * 100) / 100,
    maxResponseTime: Math.round(max * 100) / 100,
    p95ResponseTime: Math.round(p95 * 100) / 100,
    p99ResponseTime: Math.round(p99 * 100) / 100,
    errorRate: Math.round(errorRate * 100) / 100,
    errorsByStatus,
    totalRequests: total,
    successfulRequests: total - failedRequests,
    failedRequests,
    failedValidations,
    totalDurationMs: Math.round(totalDurationMs),
  };
}
