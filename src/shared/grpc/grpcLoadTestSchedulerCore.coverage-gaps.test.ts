import { describe, expect, it } from 'vitest';
import { captureGrpcLoadTestExecuteSnapshot } from './grpcAdvancedFeatureContracts';
import { startGrpcLoadTestSchedulerRun } from './grpcLoadTestSchedulerCore';

function makeSnapshot(overrides: { totalCalls?: number; concurrency?: number } = {}) {
  return captureGrpcLoadTestExecuteSnapshot({
    runId: 'run-core-gap',
    executeSnapshot: {
      tabId: 'tab-core-gap',
      requestId: 'req-core-gap',
      capturedAt: '2026-07-02T00:00:00.000Z',
      callType: 'unary',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'core-gap' },
      metadata: {},
      timeoutMs: 10_000,
      descriptorKey: 'desc-core-gap',
    },
    config: {
      concurrency: overrides.concurrency ?? 2,
      totalCalls: overrides.totalCalls ?? 5,
      warmupCalls: 0,
    },
  });
}

describe('grpcLoadTestSchedulerCore coverage gaps', () => {
  it('continues scheduling after failed attempts until totalCalls is reached', async () => {
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 5, concurrency: 2 }),
      executeAttempt: async ({ attemptNumber }) => ({
        ok: attemptNumber % 2 === 1,
        statusCode: attemptNumber % 2 === 1 ? 0 : 14,
        errorMessage: attemptNumber % 2 === 1 ? undefined : 'UNAVAILABLE',
        durationMs: 2,
      }),
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_total_calls');
    expect(report.counts.scheduled).toBe(5);
    expect(report.counts.completed).toBe(5);
    expect(report.counts.succeeded).toBe(3);
    expect(report.counts.failed).toBe(2);
  });

  it('reports cancelled and aborts in-flight attempts when cancel is requested', async () => {
    const activeSignals: AbortSignal[] = [];
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 20, concurrency: 3 }),
      executeAttempt: async ({ signal }) => {
        activeSignals.push(signal);
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          ok: !signal.aborted,
          statusCode: signal.aborted ? 1 : 0,
          errorMessage: signal.aborted ? 'Cancelled' : undefined,
          durationMs: 40,
        };
      },
    });

    run.cancel();
    const report = await run.completion;

    expect(report.stopReason).toBe('cancelled');
    expect(activeSignals.length).toBeGreaterThan(0);
    expect(activeSignals.some((signal) => signal.aborted)).toBe(true);
  });

  it('honors pre-aborted upstream signal without scheduling attempts', async () => {
    const upstream = new AbortController();
    upstream.abort();
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 10, concurrency: 2 }),
      executeAttempt: async () => ({ ok: true, statusCode: 0, durationMs: 1 }),
      signal: upstream.signal,
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
    expect(report.counts.scheduled).toBe(0);
    expect(report.counts.completed).toBe(0);
  });
});
