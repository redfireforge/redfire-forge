/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  clearGrpcRpcSessionStatsForTests,
  createEmptyGrpcRpcSessionStats,
  createGrpcRpcSessionStatsAccumulator,
  getGrpcRpcSessionStats,
  getGrpcRpcSessionSummary,
  listGrpcRpcMethodRows,
  pruneGrpcRpcSessionStatsForTabs,
  recordGrpcRpcStatsEvent,
  recordGrpcRpcStatsEvents,
  resetGrpcRpcSessionStats,
  rollupGrpcRpcSessionStats,
  summarizeGrpcRpcSessionStats,
  applyGrpcRpcStatsEvent,
} from './grpcRpcSessionStats';

describe('grpcRpcSessionStats coverage gaps', () => {
  beforeEach(() => {
    clearGrpcRpcSessionStatsForTests();
  });

  it('createEmptyGrpcRpcSessionStats honors resetAt', () => {
    const stats = createEmptyGrpcRpcSessionStats('tab-empty', '2026-07-01T00:00:00.000Z');
    expect(stats.windowResetAt).toBe('2026-07-01T00:00:00.000Z');
    expect(stats.byMethodKey).toEqual({});
  });

  it('recordGrpcRpcStatsEvents is a no-op for empty batches', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    recordGrpcRpcStatsEvents([]);
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it('pruneGrpcRpcSessionStatsForTabs removes closed tabs', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-keep',
      service: 'svc',
      method: 'Keep',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    recordGrpcRpcStatsEvent({
      tabId: 'tab-drop',
      service: 'svc',
      method: 'Drop',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });

    pruneGrpcRpcSessionStatsForTabs(new Set(['tab-keep']));

    expect(getGrpcRpcSessionStats('tab-keep').byMethodKey['svc/Keep']?.calls).toBe(1);
    expect(getGrpcRpcSessionStats('tab-drop').byMethodKey).toEqual({});
  });

  it('listGrpcRpcMethodRows sorts method keys alphabetically', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-sort',
      service: 'z.ZService',
      method: 'Zed',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    recordGrpcRpcStatsEvent({
      tabId: 'tab-sort',
      service: 'a.AService',
      method: 'Alpha',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 20,
      recordedAt: '2026-07-01T00:00:01.000Z',
      source: 'unary',
    });

    const rows = listGrpcRpcMethodRows(getGrpcRpcSessionStats('tab-sort'));
    expect(rows.map((row) => `${row.service}/${row.method}`)).toEqual([
      'a.AService/Alpha',
      'z.ZService/Zed',
    ]);
  });

  it('summarizeGrpcRpcSessionStats rolls up from stats without live accumulator', () => {
    const rolledUp = {
      tabId: 'tab-rollup',
      windowStartedAt: '2026-07-01T00:00:00.000Z',
      byMethodKey: {
        'svc/M': {
          service: 'svc',
          method: 'M',
          callType: 'unary' as const,
          calls: 2,
          errors: 1,
          statusDistribution: { '0': 1, '14': 1 },
          latencyMs: { p50: 10, p95: 20, p99: 20, avg: 15, min: 10, max: 20 },
        },
      },
    };

    const summary = summarizeGrpcRpcSessionStats(rolledUp);
    expect(summary.totalCalls).toBe(2);
    expect(summary.totalErrors).toBe(1);
    expect(summary.successRatePercent).toBe(50);
    expect(summary.avgLatencyMs).toBe(15);
    expect(summary.p95LatencyMs).toBe(20);
  });

  it('getGrpcRpcSessionSummary returns zeros for unknown tab', () => {
    expect(getGrpcRpcSessionSummary('missing-tab')).toEqual({
      totalCalls: 0,
      totalErrors: 0,
      successRatePercent: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
    });
  });

  it('getGrpcRpcSessionSummary uses live accumulator samples across methods', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-live-summary',
      service: 'svc',
      method: 'Fast',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    recordGrpcRpcStatsEvent({
      tabId: 'tab-live-summary',
      service: 'svc',
      method: 'Slow',
      callType: 'unary',
      grpcStatus: 14,
      durationMs: 100,
      recordedAt: '2026-07-01T00:00:01.000Z',
      source: 'unary',
    });

    const summary = getGrpcRpcSessionSummary('tab-live-summary');
    expect(summary.totalCalls).toBe(2);
    expect(summary.totalErrors).toBe(1);
    expect(summary.p95LatencyMs).toBeGreaterThan(summary.avgLatencyMs);
  });

  it('applyGrpcRpcStatsEvent increments existing status distribution keys', () => {
    const accumulator = createGrpcRpcSessionStatsAccumulator('tab-apply');
    applyGrpcRpcStatsEvent(accumulator, {
      tabId: 'tab-apply',
      service: 'svc',
      method: 'M',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    applyGrpcRpcStatsEvent(accumulator, {
      tabId: 'tab-apply',
      service: 'svc',
      method: 'M',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: 20,
      recordedAt: '2026-07-01T00:00:01.000Z',
      source: 'unary',
    });
    const row = rollupGrpcRpcSessionStats(accumulator).byMethodKey['svc/M'];
    expect(row.statusDistribution['0']).toBe(2);
    expect(row.calls).toBe(2);
  });

  it('summarizeGrpcRpcSessionStats rolls up empty stats without a live accumulator', () => {
    clearGrpcRpcSessionStatsForTests();
    const summary = summarizeGrpcRpcSessionStats(createEmptyGrpcRpcSessionStats('orphan-tab'));
    expect(summary.totalCalls).toBe(0);
    expect(summary.successRatePercent).toBe(0);
    expect(summary.avgLatencyMs).toBe(0);
  });

  it('rollupGrpcRpcSessionStats returns zero latency when a method has no samples', () => {
    const accumulator = createGrpcRpcSessionStatsAccumulator('tab-empty-samples');
    accumulator.byMethodKey['svc/M'] = {
      service: 'svc',
      method: 'M',
      callType: 'unary',
      calls: 0,
      errors: 0,
      statusDistribution: {},
      durationSamples: [],
    };
    const row = rollupGrpcRpcSessionStats(accumulator).byMethodKey['svc/M'];
    expect(row.latencyMs).toEqual({
      p50: 0,
      p95: 0,
      p99: 0,
      avg: 0,
      min: 0,
      max: 0,
    });
  });

  it('getGrpcRpcSessionSummary returns zeros for a reset empty session', () => {
    resetGrpcRpcSessionStats('tab-reset-empty');
    expect(getGrpcRpcSessionSummary('tab-reset-empty')).toEqual({
      totalCalls: 0,
      totalErrors: 0,
      successRatePercent: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
    });
  });

  it('clamps negative durations to zero when recording events', () => {
    recordGrpcRpcStatsEvent({
      tabId: 'tab-negative-duration',
      service: 'svc',
      method: 'M',
      callType: 'unary',
      grpcStatus: 0,
      durationMs: -25,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary',
    });
    const row = getGrpcRpcSessionStats('tab-negative-duration').byMethodKey['svc/M'];
    expect(row.latencyMs.min).toBe(0);
  });

  it('recordGrpcRpcStatsEvents swallows per-event aggregation failures', () => {
    const event = {
      tabId: 'tab-bad',
      service: 'svc',
      method: 'M',
      callType: 'unary' as const,
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary' as const,
    };
    const setSpy = vi.spyOn(Map.prototype, 'set').mockImplementationOnce(() => {
      throw new Error('map set failed');
    });
    expect(() => recordGrpcRpcStatsEvents([event])).not.toThrow();
    setSpy.mockRestore();
  });

  it('recordGrpcRpcStatsEvent skips dispatch when window is unavailable', () => {
    const event = {
      tabId: 'tab-no-window',
      service: 'svc',
      method: 'M',
      callType: 'unary' as const,
      grpcStatus: 0,
      durationMs: 10,
      recordedAt: '2026-07-01T00:00:00.000Z',
      source: 'unary' as const,
    };
    const originalWindow = globalThis.window;
    // @ts-expect-error test-only window removal
    delete globalThis.window;
    expect(() => recordGrpcRpcStatsEvent(event)).not.toThrow();
    globalThis.window = originalWindow;
    expect(getGrpcRpcSessionStats('tab-no-window').byMethodKey['svc/M']?.calls).toBe(1);
  });
});
