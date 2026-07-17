/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { captureGrpcLoadTestExecuteSnapshot } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { FIXTURE_DESCRIPTOR_KEY } from '../../../shared/grpc/contractFixtures';
import { buildGrpcLoadTestRunSummaryExport } from '../../../shared/grpc/grpcLoadTestMetrics';
import * as rpcSessionStats from '../../../shared/grpc/grpcRpcSessionStats';
import { captureGrpcRpcStatsFromLoadTestSummary, buildGrpcRpcStatsEventFromOutcome, captureGrpcRpcStatsFromOutcome, captureGrpcRpcStatsFromStreamTerminal } from './grpcStudioRpcStatsCapture';
import {
  clearGrpcRpcSessionStatsForTests,
  getGrpcRpcSessionStats,
  GRPC_RPC_STATS_UPDATED_EVENT,
} from '../../../shared/grpc/grpcRpcSessionStats';

describe('grpcStudioRpcStatsCapture', () => {
  it('folds non-warmup load-test attempts into session stats', () => {
    clearGrpcRpcSessionStatsForTests();
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-stats',
        executeSnapshot: {
          tabId: 'tab-load',
          requestId: 'req-load',
          capturedAt: '2026-07-01T00:00:00.000Z',
          callType: 'unary',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: 'echo.EchoService',
          method: 'Echo',
          body: {},
          metadata: {},
          timeoutMs: 30_000,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        },
        config: { concurrency: 2, totalCalls: 3 },
      }),
      report: {
        runId: 'run-stats',
        startedAt: '2026-07-01T00:00:00.000Z',
        completedAt: '2026-07-01T00:00:02.000Z',
        durationMs: 2000,
        stopReason: 'completed_total_calls',
        counts: {
          scheduled: 3,
          completed: 3,
          succeeded: 2,
          failed: 1,
          warmupScheduled: 1,
          warmupCompleted: 1,
          peakInFlight: 2,
        },
        attempts: [
          {
            attemptNumber: 1,
            warmup: true,
            startedAt: '2026-07-01T00:00:00.000Z',
            finishedAt: '2026-07-01T00:00:00.100Z',
            durationMs: 100,
            ok: true,
            statusCode: 0,
          },
          {
            attemptNumber: 2,
            warmup: false,
            startedAt: '2026-07-01T00:00:00.200Z',
            finishedAt: '2026-07-01T00:00:00.300Z',
            durationMs: 100,
            ok: true,
            statusCode: 0,
          },
          {
            attemptNumber: 3,
            warmup: false,
            startedAt: '2026-07-01T00:00:00.400Z',
            finishedAt: '2026-07-01T00:00:00.550Z',
            durationMs: 150,
            ok: false,
            statusCode: 14,
          },
        ],
      },
    });

    captureGrpcRpcStatsFromLoadTestSummary('tab-load', summary, {
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
    });

    const row = getGrpcRpcSessionStats('tab-load').byMethodKey['echo.EchoService/Echo'];
    expect(row.calls).toBe(2);
    expect(row.errors).toBe(1);
    expect(row.statusDistribution['0']).toBe(1);
    expect(row.statusDistribution['14']).toBe(1);
  });

  it('derives stream terminal duration from startedAt/endedAt when result duration is zero', () => {
    const event = buildGrpcRpcStatsEventFromOutcome({
      snapshot: {
        tabId: 'tab-stream',
        requestId: 'req-stream',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'server_streaming',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'EchoStream',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      result: {
        callType: 'server_streaming',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 0,
      },
      source: 'stream_terminal',
      streamTiming: {
        startedAt: '2026-07-01T00:00:00.000Z',
        endedAt: '2026-07-01T00:00:02.500Z',
      },
    });

    expect(event.durationMs).toBe(2500);
  });

  it('maps grpcStatus from error details when result is absent', () => {
    const event = buildGrpcRpcStatsEventFromOutcome({
      snapshot: {
        tabId: 'tab-err',
        requestId: 'req-err',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      error: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'UNAVAILABLE',
        details: { grpcStatus: 14 },
      },
      source: 'unary',
    });

    expect(event.grpcStatus).toBe(14);
  });

  it('treats failed load-test attempts with statusCode=0 as unknown errors', () => {
    clearGrpcRpcSessionStatsForTests();
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-fail',
        executeSnapshot: {
          tabId: 'tab-load',
          requestId: 'req-load',
          capturedAt: '2026-07-01T00:00:00.000Z',
          callType: 'unary',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: 'echo.EchoService',
          method: 'Echo',
          body: {},
          metadata: {},
          timeoutMs: 30_000,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        },
        config: { concurrency: 1, totalCalls: 1 },
      }),
      report: {
        runId: 'run-fail',
        startedAt: '2026-07-01T00:00:00.000Z',
        completedAt: '2026-07-01T00:00:01.000Z',
        durationMs: 1000,
        stopReason: 'completed_total_calls',
        counts: {
          scheduled: 1,
          completed: 1,
          succeeded: 0,
          failed: 1,
          warmupScheduled: 0,
          warmupCompleted: 0,
          peakInFlight: 1,
        },
        attempts: [
          {
            attemptNumber: 1,
            warmup: false,
            startedAt: '2026-07-01T00:00:00.000Z',
            finishedAt: '2026-07-01T00:00:01.000Z',
            durationMs: 100,
            ok: false,
            statusCode: 0,
          },
        ],
      },
    });

    captureGrpcRpcStatsFromLoadTestSummary('tab-load', summary, {
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
    });

    const row = getGrpcRpcSessionStats('tab-load').byMethodKey['echo.EchoService/Echo'];
    expect(row.errors).toBe(1);
    expect(row.statusDistribution['2']).toBe(1);
  });

  it('batches load-test folds into one stats update dispatch per tab', () => {
    clearGrpcRpcSessionStatsForTests();
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const summary = buildGrpcLoadTestRunSummaryExport({
      snapshot: captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-batch',
        executeSnapshot: {
          tabId: 'tab-batch',
          requestId: 'req-batch',
          capturedAt: '2026-07-01T00:00:00.000Z',
          callType: 'unary',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: 'echo.EchoService',
          method: 'Echo',
          body: {},
          metadata: {},
          timeoutMs: 30_000,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        },
        config: { concurrency: 5, totalCalls: 20 },
      }),
      report: {
        runId: 'run-batch',
        startedAt: '2026-07-01T00:00:00.000Z',
        completedAt: '2026-07-01T00:00:05.000Z',
        durationMs: 5000,
        stopReason: 'completed_total_calls',
        counts: {
          scheduled: 20,
          completed: 20,
          succeeded: 20,
          failed: 0,
          warmupScheduled: 0,
          warmupCompleted: 0,
          peakInFlight: 5,
        },
        attempts: Array.from({ length: 20 }, (_, index) => ({
          attemptNumber: index + 1,
          warmup: false,
          startedAt: `2026-07-01T00:00:00.${String(index).padStart(3, '0')}Z`,
          finishedAt: `2026-07-01T00:00:01.${String(index).padStart(3, '0')}Z`,
          durationMs: 10 + index,
          ok: true,
          statusCode: 0,
        })),
      },
    });

    captureGrpcRpcStatsFromLoadTestSummary('tab-batch', summary, {
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
    });

    const statsDispatches = dispatch.mock.calls.filter(
      ([event]) => event instanceof CustomEvent && event.type === GRPC_RPC_STATS_UPDATED_EVENT,
    );
    expect(statsDispatches).toHaveLength(1);
    expect(getGrpcRpcSessionStats('tab-batch').byMethodKey['echo.EchoService/Echo'].calls).toBe(20);
    dispatch.mockRestore();
  });

  it('captureGrpcRpcStatsFromOutcome swallows recorder failures', () => {
    const recordSpy = vi.spyOn(rpcSessionStats, 'recordGrpcRpcStatsEvent').mockImplementation(() => {
      throw new Error('stats unavailable');
    });

    expect(() => captureGrpcRpcStatsFromOutcome({
      snapshot: {
        tabId: 'tab-swallow',
        requestId: 'req-swallow',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      result: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 12,
      },
    })).not.toThrow();
    recordSpy.mockRestore();
  });

  it('captureGrpcRpcStatsFromStreamTerminal no-ops without lastExecuteSnapshot', () => {
    expect(() => captureGrpcRpcStatsFromStreamTerminal({})).not.toThrow();
  });

  it('captureGrpcRpcStatsFromStreamTerminal uses tab stream timing', () => {
    clearGrpcRpcSessionStatsForTests();
    captureGrpcRpcStatsFromStreamTerminal({
      lastExecuteSnapshot: {
        tabId: 'tab-stream-cap',
        requestId: 'req-stream-cap',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'server_streaming',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'EchoStream',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      streamStartedAt: '2026-07-01T00:00:00.000Z',
      streamEndedAt: '2026-07-01T00:00:01.000Z',
      target: '{{grpcHost}}',
    });
    const row = getGrpcRpcSessionStats('tab-stream-cap').byMethodKey['echo.EchoService/EchoStream'];
    expect(row.calls).toBe(1);
    expect(row.latencyMs.max).toBeGreaterThan(0);
  });

  it('defaults grpcStatus to unknown when error details omit grpcStatus', () => {
    const event = buildGrpcRpcStatsEventFromOutcome({
      snapshot: {
        tabId: 'tab-default-status',
        requestId: 'req-default-status',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      error: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'boom',
        details: { reason: 'network' },
      },
      source: 'unary',
    });
    expect(event.grpcStatus).toBe(2);
  });

  it('captureGrpcRpcStatsFromLoadTestSummary swallows batch recorder failures', () => {
    const batchSpy = vi.spyOn(rpcSessionStats, 'recordGrpcRpcStatsEvents').mockImplementation(() => {
      throw new Error('batch unavailable');
    });
    expect(() => captureGrpcRpcStatsFromLoadTestSummary('tab-swallow-batch', {
      attempts: [{
        attemptNumber: 1,
        warmup: false,
        startedAt: '2026-07-01T00:00:00.000Z',
        finishedAt: '2026-07-01T00:00:00.100Z',
        durationMs: 100,
        ok: true,
        statusCode: 0,
      }],
    } as never, {
      service: 'echo.EchoService',
      method: 'Echo',
      callType: 'unary',
    })).not.toThrow();
    batchSpy.mockRestore();
  });

  it('captureGrpcRpcStatsFromStreamTerminal honors override error and result', () => {
    clearGrpcRpcSessionStatsForTests();
    captureGrpcRpcStatsFromStreamTerminal({
      lastExecuteSnapshot: {
        tabId: 'tab-overrides',
        requestId: 'req-overrides',
        capturedAt: '2026-07-01T00:00:00.000Z',
        callType: 'server_streaming',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'EchoStream',
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      streamError: {
        code: 'GRPC_STREAM_FAILED',
        category: 'call_failed',
        message: 'tab error',
        details: { grpcStatus: 13 },
      },
    }, {
      result: {
        callType: 'server_streaming',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 42,
      },
    });
    const row = getGrpcRpcSessionStats('tab-overrides').byMethodKey['echo.EchoService/EchoStream'];
    expect(row.calls).toBe(1);
    expect(row.latencyMs.max).toBe(42);
  });
});
