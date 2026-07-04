/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __percentileGrpcRoutePerformanceForTests,
  __seedGrpcRoutePerformanceBucketForTests,
  getGrpcRoutePerformanceSnapshot,
  recordGrpcRoutePerformance,
  resetGrpcRoutePerformanceTelemetry,
} from './grpcRoutePerformanceTelemetry.js';

describe('grpcRoutePerformanceTelemetry', () => {
  beforeEach(() => {
    resetGrpcRoutePerformanceTelemetry();
  });

  it('records route durations and computes aggregate stats', () => {
    recordGrpcRoutePerformance({ routeId: 'call', durationMs: 10, statusCode: 200 });
    recordGrpcRoutePerformance({ routeId: 'call', durationMs: 30, statusCode: 200 });
    recordGrpcRoutePerformance({ routeId: 'call', durationMs: 20, statusCode: 500 });

    const snapshot = getGrpcRoutePerformanceSnapshot();
    expect(snapshot.totalRequests).toBe(3);
    expect(snapshot.totalErrors).toBe(1);
    expect(snapshot.recordedRouteCount).toBe(1);
    expect(snapshot.routes).toEqual([
      expect.objectContaining({
        routeId: 'call',
        count: 3,
        errors: 1,
        avgMs: 20,
        p95Ms: 30,
        minMs: 10,
        maxMs: 30,
        errorRate: 0.33,
      }),
    ]);
  });

  it('tracks multiple routes and resets cleanly', () => {
    recordGrpcRoutePerformance({ routeId: 'describe', durationMs: 5, statusCode: 200 });
    recordGrpcRoutePerformance({ routeId: 'status', durationMs: 2, statusCode: 200 });

    const beforeReset = getGrpcRoutePerformanceSnapshot();
    expect(beforeReset.recordedRouteCount).toBe(2);

    resetGrpcRoutePerformanceTelemetry();

    const afterReset = getGrpcRoutePerformanceSnapshot();
    expect(afterReset).toEqual({
      totalRequests: 0,
      totalErrors: 0,
      recordedRouteCount: 0,
      lastUpdatedAt: null,
      routes: [],
    });
  });

  it('handles single-sample percentile and keeps route order sorted by routeId', () => {
    recordGrpcRoutePerformance({ routeId: 'status', durationMs: 7, statusCode: 200 });
    recordGrpcRoutePerformance({ routeId: 'call', durationMs: 11, statusCode: 200 });

    const snapshot = getGrpcRoutePerformanceSnapshot();
    expect(snapshot.routes.map((route) => route.routeId)).toEqual(['call', 'status']);
    expect(snapshot.routes[0]).toEqual(
      expect.objectContaining({
        routeId: 'call',
        count: 1,
        p95Ms: 11,
        minMs: 11,
        maxMs: 11,
      }),
    );
  });

  it('normalizes invalid durations to zero and counts errors for status >= 400', () => {
    recordGrpcRoutePerformance({ routeId: 'describe', durationMs: Number.NaN, statusCode: 418 });
    recordGrpcRoutePerformance({ routeId: 'describe', durationMs: -5, statusCode: 500 });

    const snapshot = getGrpcRoutePerformanceSnapshot();
    expect(snapshot.totalRequests).toBe(2);
    expect(snapshot.totalErrors).toBe(2);
    expect(snapshot.routes[0]).toEqual(
      expect.objectContaining({
        routeId: 'describe',
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        p95Ms: 0,
        errorRate: 1,
      }),
    );
  });

  it('handles seeded empty buckets with null timestamps for edge-case snapshots', () => {
    __seedGrpcRoutePerformanceBucketForTests({
      routeId: 'status',
      durationsMs: [],
      errors: 0,
      lastStatusCode: null,
      lastUpdatedAt: null,
    });

    const snapshot = getGrpcRoutePerformanceSnapshot();
    expect(snapshot.totalRequests).toBe(0);
    expect(snapshot.totalErrors).toBe(0);
    expect(snapshot.lastUpdatedAt).toBeNull();
    expect(snapshot.routes).toEqual([
      expect.objectContaining({
        routeId: 'status',
        count: 0,
        avgMs: 0,
        p95Ms: 0,
        minMs: 0,
        maxMs: 0,
        errorRate: 0,
      }),
    ]);
  });

  it('covers percentile edge cases and seeded-bucket provided-value paths', () => {
    expect(__percentileGrpcRoutePerformanceForTests([], 95)).toBe(0);
    expect(__percentileGrpcRoutePerformanceForTests([7], 95)).toBe(7);
    expect(__percentileGrpcRoutePerformanceForTests([10, 20, 30], -10)).toBe(10);
    expect(__percentileGrpcRoutePerformanceForTests([10, 20, 30], 500)).toBe(30);

    __seedGrpcRoutePerformanceBucketForTests({
      routeId: 'describe',
      durationsMs: [undefined as unknown as number],
      errors: 2,
      lastStatusCode: 418,
      lastUpdatedAt: 123,
    });

    const snapshot = getGrpcRoutePerformanceSnapshot();
    expect(snapshot.lastUpdatedAt).toBe(123);
    expect(snapshot.routes[0]).toEqual(
      expect.objectContaining({
        routeId: 'describe',
        errors: 2,
        minMs: 0,
        maxMs: 0,
      }),
    );
  });
});
