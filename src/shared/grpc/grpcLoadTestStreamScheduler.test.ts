import { describe, expect, it, vi } from 'vitest';
import type { GrpcTabExecuteSnapshot } from './contracts';
import {
  captureGrpcLoadTestStreamExecuteSnapshot,
  GrpcLoadTestConfigValidationError,
} from './grpcAdvancedFeatureContracts';
import {
  createGrpcLoadTestStreamExecuteAttempt,
  resolveGrpcLoadTestStreamCollectConfig,
  startGrpcLoadTestStreamSchedulerRun,
} from './grpcLoadTestStreamScheduler';

function makeStreamExecuteSnapshot(
  overrides: Partial<GrpcTabExecuteSnapshot> = {},
): GrpcTabExecuteSnapshot {
  return {
    tabId: 'tab-stream-lt',
    requestId: 'req-stream-lt',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'server_streaming',
    target: { address: 'localhost:8080', tlsMode: 'disabled' },
    service: 'demo.StreamService',
    method: 'Watch',
    body: {},
    metadata: {},
    timeoutMs: 10_000,
    descriptorKey: 'descriptor-stream-lt',
    ...overrides,
  };
}

describe('grpcLoadTestStreamScheduler (Phase 11O)', () => {
  it('resolveGrpcLoadTestStreamCollectConfig defaults to harness window cap', () => {
    expect(resolveGrpcLoadTestStreamCollectConfig({ concurrency: 2, totalCalls: 5 }))
      .toEqual({ maxMessages: 10 });
    expect(resolveGrpcLoadTestStreamCollectConfig({
      concurrency: 2,
      totalCalls: 5,
      maxMessagesPerStream: 25,
    })).toEqual({ maxMessages: 25 });
  });

  it('captureGrpcLoadTestStreamExecuteSnapshot rejects unary snapshots', () => {
    expect(() => captureGrpcLoadTestStreamExecuteSnapshot({
      runId: 'run-1',
      executeSnapshot: makeStreamExecuteSnapshot({ callType: 'unary' }),
      config: { concurrency: 1, totalCalls: 2 },
    })).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('runs bounded concurrent stream attempts', async () => {
    const collectServerStream = vi.fn(async () => ({
      messages: [{ seq: 1 }],
      durationMs: 12,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: {},
      stopReason: 'stream_end' as const,
    }));
    const snapshot = captureGrpcLoadTestStreamExecuteSnapshot({
      runId: 'stream-run-1',
      executeSnapshot: makeStreamExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 4, warmupCalls: 0 },
    });
    const run = startGrpcLoadTestStreamSchedulerRun({
      snapshot,
      collectServerStream,
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
    });
    const report = await run.completion;
    expect(report.counts.completed).toBe(4);
    expect(report.counts.succeeded).toBe(4);
    expect(collectServerStream).toHaveBeenCalledTimes(4);
    expect(collectServerStream.mock.calls[0]?.[2]).toEqual({ maxMessages: 10 });
  });

  it('createGrpcLoadTestStreamExecuteAttempt marks transport errors as failed', async () => {
    const executeAttempt = createGrpcLoadTestStreamExecuteAttempt({
      collectServerStream: async () => ({
        messages: [],
        durationMs: 5,
        grpcStatus: 14,
        grpcStatusMessage: 'UNAVAILABLE',
        trailers: {},
        stopReason: 'transport_error',
        errorDetail: 'Stream transport failed',
      }),
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
      collectConfig: { maxMessages: 3 },
    });
    const outcome = await executeAttempt({
      runId: 'run-1',
      attemptNumber: 1,
      warmup: false,
      executeSnapshot: makeStreamExecuteSnapshot(),
      signal: new AbortController().signal,
      startedAt: new Date().toISOString(),
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.errorMessage).toMatch(/transport failed/i);
  });

  it('counts partial stream failures in run report', async () => {
    let call = 0;
    const collectServerStream = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          messages: [{ seq: 1 }],
          durationMs: 8,
          grpcStatus: 0,
          grpcStatusMessage: 'OK',
          trailers: {},
          stopReason: 'stream_end' as const,
        };
      }
      return {
        messages: [],
        durationMs: 5,
        grpcStatus: 14,
        grpcStatusMessage: 'UNAVAILABLE',
        trailers: {},
        stopReason: 'transport_error' as const,
        errorDetail: 'Stream transport failed',
      };
    });
    const snapshot = captureGrpcLoadTestStreamExecuteSnapshot({
      runId: 'stream-partial',
      executeSnapshot: makeStreamExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 2, warmupCalls: 0 },
    });
    const run = startGrpcLoadTestStreamSchedulerRun({
      snapshot,
      collectServerStream,
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
    });
    const report = await run.completion;
    expect(report.counts.succeeded).toBe(1);
    expect(report.counts.failed).toBe(1);
  });

  it('cancels in-flight stream attempts cooperatively', async () => {
    const activeSignals: AbortSignal[] = [];
    const collectServerStream = vi.fn(async (_req, _tabId, _collect, options) => {
      if (options?.abortSignal) {
        activeSignals.push(options.abortSignal);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        messages: [],
        durationMs: 50,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        trailers: {},
        stopReason: 'cancelled' as const,
      };
    });
    const snapshot = captureGrpcLoadTestStreamExecuteSnapshot({
      runId: 'stream-cancel',
      executeSnapshot: makeStreamExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 10 },
    });
    const run = startGrpcLoadTestStreamSchedulerRun({
      snapshot,
      collectServerStream,
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
    });
    run.cancel();
    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
    expect(activeSignals.some((signal) => signal.aborted)).toBe(true);
  });

  it('captureAndStartGrpcLoadTestStreamSchedulerRun wires execute attempt', async () => {
    const collectServerStream = vi.fn(async () => ({
      messages: [{ seq: 1 }],
      durationMs: 8,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: {},
      stopReason: 'max_messages' as const,
    }));
    const { captureAndStartGrpcLoadTestStreamSchedulerRun } = await import('./grpcLoadTestStreamScheduler');
    const run = captureAndStartGrpcLoadTestStreamSchedulerRun({
      runId: 'stream-capture-run',
      executeSnapshot: makeStreamExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 1 },
      collectServerStream,
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
    });
    const report = await run.completion;
    expect(report.counts.succeeded).toBe(1);
  });

  it('createGrpcLoadTestStreamExecuteAttempt handles AbortError and generic errors', async () => {
    const executeSnapshot = makeStreamExecuteSnapshot();
    const buildStreamStartRequest = (snap: typeof executeSnapshot, attemptNumber: number) => ({
      callType: 'server_streaming' as const,
      requestId: `${snap.requestId}-lt-${attemptNumber}`,
      target: snap.target,
      service: snap.service,
      method: snap.method,
      body: snap.body,
      metadata: snap.metadata,
      timeoutMs: snap.timeoutMs,
      descriptorKey: snap.descriptorKey,
    });

    const abortAttempt = createGrpcLoadTestStreamExecuteAttempt({
      collectServerStream: async () => {
        throw new DOMException('Aborted', 'AbortError');
      },
      buildStreamStartRequest,
      collectConfig: { maxMessages: 1 },
    });
    const abortOutcome = await abortAttempt({
      runId: 'run-abort',
      attemptNumber: 1,
      warmup: false,
      executeSnapshot,
      signal: new AbortController().signal,
      startedAt: new Date().toISOString(),
    });
    expect(abortOutcome.ok).toBe(false);
    expect(abortOutcome.errorMessage).toBe('Cancelled');

    const genericAttempt = createGrpcLoadTestStreamExecuteAttempt({
      collectServerStream: async () => { throw 'boom'; },
      buildStreamStartRequest,
      collectConfig: { maxMessages: 1 },
    });
    const genericOutcome = await genericAttempt({
      runId: 'run-generic',
      attemptNumber: 1,
      warmup: false,
      executeSnapshot,
      signal: new AbortController().signal,
      startedAt: new Date().toISOString(),
    });
    expect(genericOutcome.ok).toBe(false);
    expect(genericOutcome.errorMessage).toBe('boom');
  });

  it('marks grpc non-zero status without errorDetail as failed attempt', async () => {
    const executeAttempt = createGrpcLoadTestStreamExecuteAttempt({
      collectServerStream: async () => ({
        messages: [],
        durationMs: 5,
        grpcStatus: 13,
        grpcStatusMessage: 'INTERNAL',
        trailers: {},
        stopReason: 'stream_end',
      }),
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
      collectConfig: { maxMessages: 3 },
    });
    const outcome = await executeAttempt({
      runId: 'run-1',
      attemptNumber: 1,
      warmup: false,
      executeSnapshot: makeStreamExecuteSnapshot(),
      signal: new AbortController().signal,
      startedAt: new Date().toISOString(),
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.errorMessage).toBe('INTERNAL');
  });

  it('treats max_duration and until_expression stop reasons as successful attempts', async () => {
    const buildAttempt = (stopReason: 'max_duration' | 'until_expression') =>
      createGrpcLoadTestStreamExecuteAttempt({
        collectServerStream: async () => ({
          messages: [{ seq: 1 }],
          durationMs: 100,
          grpcStatus: 0,
          grpcStatusMessage: 'OK',
          trailers: {},
          stopReason,
        }),
        buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
          callType: 'server_streaming',
          requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
          target: executeSnapshot.target,
          service: executeSnapshot.service,
          method: executeSnapshot.method,
          body: executeSnapshot.body,
          metadata: executeSnapshot.metadata,
          timeoutMs: executeSnapshot.timeoutMs,
          descriptorKey: executeSnapshot.descriptorKey,
        }),
        collectConfig: { maxMessages: 3 },
      });

    for (const stopReason of ['max_duration', 'until_expression'] as const) {
      const outcome = await buildAttempt(stopReason)({
        runId: 'run-ok',
        attemptNumber: 1,
        warmup: false,
        executeSnapshot: makeStreamExecuteSnapshot(),
        signal: new AbortController().signal,
        startedAt: new Date().toISOString(),
      });
      expect(outcome.ok).toBe(true);
      expect(outcome.errorMessage).toBeUndefined();
    }
  });

  it('returns generic stop reason when grpc status is zero but stop reason is not success', async () => {
    const executeAttempt = createGrpcLoadTestStreamExecuteAttempt({
      collectServerStream: async () => ({
        messages: [],
        durationMs: 5,
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        trailers: {},
        stopReason: 'cancelled',
      }),
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
      collectConfig: { maxMessages: 3 },
    });
    const outcome = await executeAttempt({
      runId: 'run-stop',
      attemptNumber: 1,
      warmup: false,
      executeSnapshot: makeStreamExecuteSnapshot(),
      signal: new AbortController().signal,
      startedAt: new Date().toISOString(),
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.errorMessage).toBe('Stream stopped: cancelled');
  });

  it('createGrpcLoadTestStreamExecuteAttempt derives duration when result omits durationMs', async () => {
    const executeAttempt = createGrpcLoadTestStreamExecuteAttempt({
      collectServerStream: async () => ({
        messages: [{ seq: 1 }],
        grpcStatus: 0,
        grpcStatusMessage: 'OK',
        trailers: {},
        stopReason: 'stream_end',
      }),
      buildStreamStartRequest: (executeSnapshot, attemptNumber) => ({
        callType: 'server_streaming',
        requestId: `${executeSnapshot.requestId}-lt-${attemptNumber}`,
        target: executeSnapshot.target,
        service: executeSnapshot.service,
        method: executeSnapshot.method,
        body: executeSnapshot.body,
        metadata: executeSnapshot.metadata,
        timeoutMs: executeSnapshot.timeoutMs,
        descriptorKey: executeSnapshot.descriptorKey,
      }),
      collectConfig: { maxMessages: 3 },
    });
    const outcome = await executeAttempt({
      runId: 'run-duration-fallback',
      attemptNumber: 1,
      warmup: false,
      executeSnapshot: makeStreamExecuteSnapshot(),
      signal: new AbortController().signal,
      startedAt: new Date().toISOString(),
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
  });
});
