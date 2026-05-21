import { describe, it, expect } from 'vitest';
import { computeMetrics } from './metrics';
import { makeResult } from '../test-utils/factories';

describe('computeMetrics', () => {
  it('returns all zeros for empty results', () => {
    const summary = computeMetrics([], 5000);
    expect(summary).toEqual({
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
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs: 5000,
      cancelledRequests: 0,
    });
  });

  it('aggregates a single successful result', () => {
    const summary = computeMetrics([makeResult({ responseTimeMs: 250 })], 1000);
    expect(summary.totalRequests).toBe(1);
    expect(summary.tps).toBe(1);
    expect(summary.avgResponseTime).toBe(250);
    expect(summary.minResponseTime).toBe(250);
    expect(summary.maxResponseTime).toBe(250);
    expect(summary.p95ResponseTime).toBe(250);
    expect(summary.p99ResponseTime).toBe(250);
    expect(summary.errorRate).toBe(0);
    expect(summary.failedRequests).toBe(0);
    expect(summary.successfulRequests).toBe(1);
    expect(summary.failedValidations).toBe(0);
    expect(summary.totalDurationMs).toBe(1000);
  });

  it('computes TPS as (count / durationMs) * 1000', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult({ id: String(i), responseTimeMs: 50 }),
    );
    const summary = computeMetrics(results, 2000);
    expect(summary.tps).toBe(5);
  });

  it('uses zero TPS when totalDurationMs is 0', () => {
    const results = [makeResult({ responseTimeMs: 10 }), makeResult({ id: '2', responseTimeMs: 20 })];
    const summary = computeMetrics(results, 0);
    expect(summary.tps).toBe(0);
    expect(summary.avgResponseTime).toBe(15);
    expect(summary.totalDurationMs).toBe(0);
  });

  it('rounds totalDurationMs for non-empty results', () => {
    const summary = computeMetrics([makeResult()], 1999.7);
    expect(summary.totalDurationMs).toBe(2000);
  });

  it('counts mixed pass/fail HTTP outcomes, errorRate, and errorsByStatus', () => {
    const results = [
      makeResult({ id: '1', httpStatus: 200, passed: true }),
      makeResult({ id: '2', httpStatus: 500, passed: false }),
      makeResult({ id: '3', httpStatus: 0, passed: false }),
      makeResult({ id: '4', httpStatus: 404, passed: true }),
    ];
    const summary = computeMetrics(results, 4000);
    expect(summary.failedRequests).toBe(3);
    expect(summary.successfulRequests).toBe(1);
    expect(summary.errorRate).toBe(75);
    expect(summary.errorsByStatus).toEqual({ 500: 1, 0: 1, 404: 1 });
    expect(summary.failedValidations).toBe(0);
  });

  it('counts validation failures on HTTP 200 when passed is false with failureDetails', () => {
    const results = [
      makeResult({
        id: '1',
        httpStatus: 200,
        passed: false,
        failureDetails: [{ path: '$.a', expected: '1', actual: '2' }],
      }),
      makeResult({ id: '2', httpStatus: 200, passed: false, failureDetails: [] }),
    ];
    const summary = computeMetrics(results, 1000);
    expect(summary.failedRequests).toBe(0);
    expect(summary.failedValidations).toBe(1);
  });

  it('uses floor(n*0.95) and floor(n*0.99) indices on sorted times for percentiles', () => {
    const results = Array.from({ length: 100 }, (_, i) =>
      makeResult({ id: String(i), responseTimeMs: i + 1 }),
    );
    const summary = computeMetrics(results, 10_000);
    expect(summary.p95ResponseTime).toBe(96);
    expect(summary.p99ResponseTime).toBe(100);
  });

  it('sorts times before min/max/percentiles regardless of result order', () => {
    const summary = computeMetrics(
      [
        makeResult({ id: 'a', responseTimeMs: 300 }),
        makeResult({ id: 'b', responseTimeMs: 100 }),
        makeResult({ id: 'c', responseTimeMs: 200 }),
      ],
      1000,
    );
    expect(summary.minResponseTime).toBe(100);
    expect(summary.maxResponseTime).toBe(300);
    expect(summary.avgResponseTime).toBe(200);
    expect(summary.p95ResponseTime).toBe(300);
    expect(summary.p99ResponseTime).toBe(300);
  });

  it('handles single result where p95/p99 may fall back', () => {
    const summary = computeMetrics(
      [
        {
          url: 'http://api/1',
          method: 'GET',
          httpStatus: 200,
          responseTimeMs: 150,
          passed: true,
          failureDetails: [],
          requestSentAt: 0,
          responseBody: '',
          responseHeaders: {},
        },
      ],
      500,
    );
    expect(summary.p95ResponseTime).toBe(150);
    expect(summary.p99ResponseTime).toBe(150);
    expect(summary.totalRequests).toBe(1);
  });

  it('handles failed validation results', () => {
    const summary = computeMetrics(
      [
        {
          url: 'http://api/1',
          method: 'GET',
          httpStatus: 200,
          responseTimeMs: 100,
          passed: false,
          failureDetails: [{ path: '$.id', expected: '1', actual: '2' }],
          requestSentAt: 0,
          responseBody: '',
          responseHeaders: {},
        },
      ],
      500,
    );
    expect(summary.failedValidations).toBe(1);
  });

  it('counts status 0 as failed request', () => {
    const results = [makeResult({ httpStatus: 0 })];
    const summary = computeMetrics(results, 1000);
    expect(summary.failedRequests).toBe(1);
    expect(summary.errorsByStatus).toEqual({ 0: 1 });
  });

  it('handles large numbers of requests for percentiles', () => {
    const results = Array.from({ length: 1000 }, (_, i) =>
      makeResult({ id: String(i), responseTimeMs: i + 1 }),
    );
    const summary = computeMetrics(results, 60000);
    expect(summary.p95ResponseTime).toBe(951);
    expect(summary.p99ResponseTime).toBe(991);
    expect(summary.p999ResponseTime).toBe(999);
    expect(summary.totalRequests).toBe(1000);
  });

  it('handles all failed requests for 100% error rate', () => {
    const results = [
      makeResult({ id: '1', httpStatus: 500 }),
      makeResult({ id: '2', httpStatus: 503 }),
    ];
    const summary = computeMetrics(results, 1000);
    expect(summary.errorRate).toBe(100);
    expect(summary.successfulRequests).toBe(0);
  });

  it('does not count passed=false without failureDetails as validation failure', () => {
    const results = [
      makeResult({ id: '1', httpStatus: 200, passed: false, failureDetails: [] }),
    ];
    const summary = computeMetrics(results, 1000);
    expect(summary.failedValidations).toBe(0);
  });

  it('handles small result sets where percentile indices may exceed array bounds', () => {
    // With 2 results, Math.floor(2 * 0.95) = 1 and Math.floor(2 * 0.99) = 1
    // Both indices exist, so no fallback needed
    const results = [
      makeResult({ id: '1', responseTimeMs: 50 }),
      makeResult({ id: '2', responseTimeMs: 150 }),
    ];
    const summary = computeMetrics(results, 1000);
    expect(summary.p50ResponseTime).toBe(150);
    expect(summary.p95ResponseTime).toBe(150);
    expect(summary.p99ResponseTime).toBe(150);
    expect(summary.minResponseTime).toBe(50);
    expect(summary.maxResponseTime).toBe(150);
  });

  it('p50/p95/p99 fallback to max when array index yields undefined', () => {
    // Test single result - all indices point to same value
    const results = [makeResult({ id: '1', responseTimeMs: 100 })];
    const summary = computeMetrics(results, 1000);
    // With 1 result, floor(1*0.50)=0, floor(1*0.95)=0, floor(1*0.99)=0
    // All point to index 0 which exists, so max fallback not triggered
    expect(summary.p50ResponseTime).toBe(100);
    expect(summary.p95ResponseTime).toBe(100);
    expect(summary.p99ResponseTime).toBe(100);
  });

  it('errorRate returns 0 when total is 0 (empty array case)', () => {
    const summary = computeMetrics([], 1000);
    expect(summary.errorRate).toBe(0);
    expect(summary.totalRequests).toBe(0);
  });

  it('falls back to max for percentiles when sorted time at index is nullish', () => {
    const results = [
      ...Array.from({ length: 100 }, (_, i) =>
        makeResult({ id: `n${i}`, responseTimeMs: null as unknown as number }),
      ),
      makeResult({ id: 'ok', responseTimeMs: 1000 }),
    ];
    const summary = computeMetrics(results, 2000);
    expect(summary.maxResponseTime).toBe(1000);
    expect(summary.p50ResponseTime).toBe(1000);
    expect(summary.p95ResponseTime).toBe(1000);
    expect(summary.p99ResponseTime).toBe(1000);
    expect(summary.minResponseTime).toBe(0);
  });

  it('increments errorsByStatus when the same failing status appears twice', () => {
    const results = [
      makeResult({ id: '1', httpStatus: 503 }),
      makeResult({ id: '2', httpStatus: 503 }),
    ];
    const summary = computeMetrics(results, 1000);
    expect(summary.errorsByStatus).toEqual({ 503: 2 });
  });

  it('does not treat HTTP 399 as a failed request', () => {
    const summary = computeMetrics([makeResult({ httpStatus: 399 })], 1000);
    expect(summary.failedRequests).toBe(0);
    expect(summary.errorRate).toBe(0);
  });
});
