/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  applyGrpcRpcStatsEvent,
  buildGrpcRpcMethodKey,
  clearGrpcRpcSessionStatsForTests,
  createGrpcRpcSessionStatsAccumulator,
  getGrpcRpcSessionStats,
  getGrpcRpcSessionSummary,
  GRPC_RPC_STATS_UPDATED_EVENT,
  isGrpcRpcStatsError,
  recordGrpcRpcStatsEvent,
  recordGrpcRpcStatsEvents,
  resetGrpcRpcSessionStats,
  rollupGrpcRpcSessionStats,
  summarizeGrpcRpcSessionStats,
} from './grpcRpcSessionStats';

describe('grpcRpcSessionStats', () => {
  beforeEach(() => {
    clearGrpcRpcSessionStatsForTests();
  });

  it('builds stable method keys', () => {
    expect(buildGrpcRpcMethodKey('echo.EchoService', 'Echo')).toBe('echo.EchoService/Echo');
  });

  it('aggregates two unary calls for the same method', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-a',
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 40,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    recordGrpcRpcStatsEvent({
      tabId: 'tab-a',
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 80,
      recordedAt: '2026-07-01T00:00:01.000Z',
      source: 'unary',
    });

    const stats = getGrpcRpcSessionStats('tab-a');
    const row = stats.byMethodKey['echo.EchoService/Echo'];
    expect(row.calls).toBe(2);
    expect(row.errors).toBe(0);
    expect(row.latencyMs.min).toBe(40);
    expect(row.latencyMs.max).toBe(80);
    expect(row.latencyMs.p50).toBeGreaterThanOrEqual(40);
    expect(row.latencyMs.p95).toBeGreaterThanOrEqual(row.latencyMs.p50);
    expect(row.latencyMs.p99).toBeGreaterThanOrEqual(row.latencyMs.p95);
  });

  it('isolates stats per tab', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-a',
      service: 'svc',
      method: 'M',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    recordGrpcRpcStatsEvent({
      tabId: 'tab-b',
      service: 'svc',
      method: 'M',
      callType: 'unary',
      grpcStatus: 14,
      durationMs: 20,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });

    expect(getGrpcRpcSessionStats('tab-a').byMethodKey['svc/M'].calls).toBe(1);
    expect(getGrpcRpcSessionStats('tab-b').byMethodKey['svc/M'].errors).toBe(1);
  });

  it('reset session clears rows without touching unrelated tabs', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-a',
      service: 'svc',
      method: 'M',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    recordGrpcRpcStatsEvent({
      tabId: 'tab-b',
      service: 'svc',
      method: 'M',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });

    resetGrpcRpcSessionStats('tab-a');
    expect(Object.keys(getGrpcRpcSessionStats('tab-a').byMethodKey)).toHaveLength(0);
    expect(getGrpcRpcSessionStats('tab-b').byMethodKey['svc/M'].calls).toBe(1);
    expect(getGrpcRpcSessionStats('tab-a').windowResetAt).toBeTruthy();
  });

  it('pure reducer path keeps percentile monotonicity', () => {
    const accumulator = createGrpcRpcSessionStatsAccumulator('tab-reducer');
    const events = [25, 50, 75, 100, 125].map((durationMs, index) => ({
      tabId: 'tab-reducer',
      service: 'svc',
      method: 'M',
      callType: 'unary' as const,
      grpcStatus: 0,
      durationMs,
      recordedAt: `2026-07-01T00:00:0${index}.000Z`,
      source: 'unary' as const,
    }));
    for (const event of events) {
      applyGrpcRpcStatsEvent(accumulator, event);
    }
    const row = rollupGrpcRpcSessionStats(accumulator).byMethodKey['svc/M'];
    expect(row.latencyMs.min).toBeLessThanOrEqual(row.latencyMs.p50);
    expect(row.latencyMs.p50).toBeLessThanOrEqual(row.latencyMs.p95);
    expect(row.latencyMs.p95).toBeLessThanOrEqual(row.latencyMs.p99);
    expect(row.latencyMs.p99).toBeLessThanOrEqual(row.latencyMs.max);
  });

  it('summarizes session success rate', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-a',
      service: 'svc',
      method: 'Ok',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    recordGrpcRpcStatsEvent({
      tabId: 'tab-a',
      service: 'svc',
      method: 'Fail',
      callType: 'unary',
      grpcStatus: 14,
      durationMs: 20,
      recordedAt: '2026-07-01T00:00:01.000Z',
      source: 'unary',
    });

    const summary = summarizeGrpcRpcSessionStats(getGrpcRpcSessionStats('tab-a'));
    expect(summary.totalCalls).toBe(2);
    expect(summary.totalErrors).toBe(1);
    expect(summary.successRatePercent).toBe(50);
    expect(isGrpcRpcStatsError(14)).toBe(true);
    expect(isGrpcRpcStatsError(0)).toBe(false);
  });

  it('getGrpcRpcSessionSummary computes global p95 across methods', () => {
    for (let i = 0; i < 10; i += 1) {
      recordGrpcRpcStatsEvent({
        tabId: 'tab-a',
        service: 'slow.Svc',
        method: 'Slow',
        callType: 'unary',
        grpcStatus: 0,
        durationMs: 200,
        recordedAt: `2026-07-01T00:00:${String(i).padStart(2, '0')}.000Z`,
        source: 'unary',
      });
    }
    recordGrpcRpcStatsEvent({
      tabId: 'tab-a',
      service: 'fast.Svc',
      method: 'Fast',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:10.000Z',
      source: 'unary',
    });

    const summary = getGrpcRpcSessionSummary('tab-a');
    expect(summary.totalCalls).toBe(11);
    expect(summary.p95LatencyMs).toBeGreaterThan(10);
    expect(summary.avgLatencyMs).toBeGreaterThan(10);
  });

  it('recordGrpcRpcStatsEvents applies all events before a single dispatch per tab', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const events = Array.from({ length: 15 }, (_, index) => ({
      tabId: 'tab-batch',
      service: 'svc',
      method: 'M',
      callType: 'unary' as const,
      grpcStatus: 0,
      durationMs: 10 + index,
      recordedAt: `2026-07-01T00:00:${String(index).padStart(2, '0')}.000Z`,
      source: 'load_test' as const,
    }));
    recordGrpcRpcStatsEvents(events);
    const statsDispatches = dispatch.mock.calls.filter(
      ([event]) => event instanceof CustomEvent && event.type === GRPC_RPC_STATS_UPDATED_EVENT,
    );
    expect(statsDispatches).toHaveLength(1);
    expect(getGrpcRpcSessionStats('tab-batch').byMethodKey['svc/M'].calls).toBe(15);
    dispatch.mockRestore();
  });

  it('recordGrpcRpcStatsEvents handles large batches without corrupting rollups', () => {
    const events = Array.from({ length: 500 }, (_, index) => ({
      tabId: 'tab-large',
      service: 'svc',
      method: 'Bulk',
      callType: 'unary' as const,
      grpcStatus: index % 17 === 0 ? 14 : 0,
      durationMs: index + 1,
      recordedAt: `2026-07-01T00:00:00.${String(index).padStart(3, '0')}Z`,
      source: 'load_test' as const,
    }));
    recordGrpcRpcStatsEvents(events);
    const row = getGrpcRpcSessionStats('tab-large').byMethodKey['svc/Bulk'];
    expect(row.calls).toBe(500);
    expect(row.errors).toBe(events.filter((event) => event.grpcStatus !== 0).length);
    expect(row.latencyMs.min).toBe(1);
    expect(row.latencyMs.max).toBe(500);
    expect(row.latencyMs.p95).toBeGreaterThan(row.latencyMs.p50);
  });
});
