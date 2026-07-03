/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
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
});
