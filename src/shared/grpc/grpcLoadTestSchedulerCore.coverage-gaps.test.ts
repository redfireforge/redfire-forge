import { describe, expect, it, vi } from 'vitest';
import { captureGrpcLoadTestExecuteSnapshot } from './grpcAdvancedFeatureContracts';
import { startGrpcLoadTestSchedulerRun } from './grpcLoadTestSchedulerCore';
import type { GrpcTabExecuteSnapshot } from './contracts';

function makeExecuteSnapshot(overrides: Partial<GrpcTabExecuteSnapshot> = {}): GrpcTabExecuteSnapshot {
  return {
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
    ...overrides,
  };
}

function makeSnapshot(overrides: {
  totalCalls?: number;
  durationMs?: number;
  concurrency?: number;
  warmupCalls?: number;
  requestRateRps?: number;
} = {}) {
  const config: {
    concurrency: number;
    warmupCalls: number;
    totalCalls?: number;
    durationMs?: number;
    requestRateRps?: number;
  } = {
    concurrency: overrides.concurrency ?? 2,
    warmupCalls: overrides.warmupCalls ?? 0,
  };
  if (overrides.totalCalls != null) {
    config.totalCalls = overrides.totalCalls;
  }
  if (overrides.durationMs != null) {
    config.durationMs = overrides.durationMs;
  }
  if (overrides.requestRateRps != null) {
    config.requestRateRps = overrides.requestRateRps;
  }

  return captureGrpcLoadTestExecuteSnapshot({
    runId: 'run-core-gap',
    executeSnapshot: makeExecuteSnapshot(),
    config,
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

  it('throttles launch pacing when requestRateRps is configured', async () => {
    const snapshot = makeSnapshot({
      concurrency: 4,
      totalCalls: 4,
      requestRateRps: 2,
    });

    const startedAt = Date.now();
    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async () => ({ ok: true, statusCode: 0, durationMs: 1 }),
    });

    const report = await run.completion;
    const elapsedMs = Date.now() - startedAt;
    expect(report.stopReason).toBe('completed_total_calls');
    expect(report.counts.completed).toBe(4);
    expect(elapsedMs).toBeGreaterThanOrEqual(1200);
  });

  it('stops with completed_duration when duration limit is reached via nowMs', async () => {
    let now = 0;
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ durationMs: 1_000, concurrency: 2 }),
      nowMs: () => now,
      executeAttempt: async () => {
        now += 400;
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_duration');
    expect(report.counts.scheduled).toBeGreaterThan(0);
  });

  it('runs duration-only config without totalCalls until deadline', async () => {
    let now = 0;
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ durationMs: 1_000, concurrency: 2 }),
      nowMs: () => now,
      executeAttempt: async () => {
        now += 200;
        return { ok: true, durationMs: 1 };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_duration');
    expect(report.counts.scheduled).toBeGreaterThan(0);
    expect(report.counts.completed).toBeGreaterThan(0);
  });

  it('aborts in-flight attempts when wall-clock duration timer fires', async () => {
    vi.useFakeTimers();
    try {
      const abortObserved: boolean[] = [];
      const run = startGrpcLoadTestSchedulerRun({
        snapshot: makeSnapshot({ durationMs: 1_000, concurrency: 3 }),
        executeAttempt: async ({ signal }) => {
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              abortObserved.push(true);
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
          return { ok: true };
        },
      });

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_000);

      const report = await run.completion;
      expect(report.stopReason).toBe('completed_duration');
      expect(abortObserved.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks warmup calls and tracks warmup counts', async () => {
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 8, concurrency: 2, warmupCalls: 3 }),
      executeAttempt: async ({ warmup }) => ({
        ok: !warmup,
        statusCode: warmup ? 14 : 0,
        errorMessage: warmup ? 'warmup-fail' : undefined,
        durationMs: 1,
      }),
    });

    const report = await run.completion;
    expect(report.counts.warmupScheduled).toBe(3);
    expect(report.counts.warmupCompleted).toBe(3);
    expect(report.attempts.filter((attempt) => attempt.warmup)).toHaveLength(3);
    expect(report.counts.failed).toBe(3);
    expect(report.counts.succeeded).toBe(5);
  });

  it('records Error and non-Error throw failures without stopping the run', async () => {
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 6, concurrency: 2 }),
      executeAttempt: async ({ attemptNumber, warmup }) => {
        if (attemptNumber === 2) {
          throw new Error('executor boom');
        }
        if (attemptNumber === 4) {
          throw 'plain-string-failure';
        }
        return { ok: true, durationMs: warmup ? 2 : 1 };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_total_calls');
    expect(report.counts.failed).toBe(2);
    expect(report.attempts.find((attempt) => attempt.attemptNumber === 2)?.errorMessage)
      .toBe('executor boom');
    expect(report.attempts.find((attempt) => attempt.attemptNumber === 4)?.errorMessage)
      .toBe('plain-string-failure');
  });

  it('derives attempt duration from wall time when outcome omits durationMs', async () => {
    let now = 0;
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 2, concurrency: 1 }),
      nowMs: () => now,
      executeAttempt: async () => {
        now += 50;
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.attempts[0]?.durationMs).toBe(50);
  });

  it('exposes running state via getState while attempts are in flight', async () => {
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 4, concurrency: 2 }),
      executeAttempt: async ({ signal }) => {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 30);
          signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
        });
        return { ok: true, durationMs: 30 };
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const mid = run.getState();
    expect(mid.operation.status).toBe('running');
    expect(mid.startedAt).toBeTruthy();
    expect(mid.completedAt).toBeUndefined();
    expect(mid.counts.scheduled).toBeGreaterThan(0);
    expect(mid.liveMetrics).toBeTruthy();
    expect(mid.liveMetrics?.measuredAttemptsPerSecond).toBeGreaterThanOrEqual(0);

    const report = await run.completion;
    const end = run.getState();
    expect(report.stopReason).toBe('completed_total_calls');
    expect(end.operation.status).toBe('completed');
    expect(end.completedAt).toBeTruthy();
    expect(end.stopReason).toBe('completed_total_calls');
    expect(end.liveMetrics?.measuredAttempts).toBeGreaterThan(0);
  });

  it('cancel takes precedence over pending wall-clock duration timer', async () => {
    vi.useFakeTimers();
    try {
      const run = startGrpcLoadTestSchedulerRun({
        snapshot: makeSnapshot({ durationMs: 5_000, concurrency: 2 }),
        executeAttempt: async ({ signal }) => {
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
          return { ok: true };
        },
      });

      await Promise.resolve();
      run.cancel();

      const report = await run.completion;
      expect(report.stopReason).toBe('cancelled');

      await vi.advanceTimersByTimeAsync(5_000);
      expect(run.getState().stopReason).toBe('cancelled');
      expect(run.getState().operation.status).toBe('cancelled');
    } finally {
      vi.useRealTimers();
    }
  });

  it('double cancel is idempotent and does not change terminal outcome', async () => {
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ durationMs: 30_000, concurrency: 1 }),
      executeAttempt: async ({ signal }) => {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        return { ok: true };
      },
    });

    await Promise.resolve();
    run.cancel();
    run.cancel();

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
  });

  it('records warmup attempt failures from thrown errors', async () => {
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ totalCalls: 4, concurrency: 1, warmupCalls: 2 }),
      executeAttempt: async ({ warmup }) => {
        if (warmup) {
          throw new Error('warmup exploded');
        }
        return { ok: true, durationMs: 1 };
      },
    });

    const report = await run.completion;
    expect(report.counts.warmupScheduled).toBe(2);
    expect(report.counts.warmupCompleted).toBe(2);
    expect(report.counts.failed).toBe(2);
    expect(report.attempts.filter((attempt) => attempt.warmup && !attempt.ok)).toHaveLength(2);
  });

  it('detects duration elapsed via wall clock when nowMs stays fixed', async () => {
    vi.useFakeTimers();
    try {
      const fixedNow = 1_000_000;
      const run = startGrpcLoadTestSchedulerRun({
        snapshot: makeSnapshot({ durationMs: 1_000, concurrency: 1 }),
        nowMs: () => fixedNow,
        executeAttempt: async ({ signal }) => {
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
          return { ok: true };
        },
      });

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_000);

      const report = await run.completion;
      expect(report.stopReason).toBe('completed_duration');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops with completed_duration after attempts drain when nowMs passes deadline', async () => {
    let now = 0;
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ durationMs: 1_000, concurrency: 1 }),
      nowMs: () => now,
      executeAttempt: async () => {
        now += 10;
        return { ok: true, durationMs: 10 };
      },
    });

    now = 2_000;
    const report = await run.completion;
    expect(report.stopReason).toBe('completed_duration');
  });

  it('external abort signal cancels run and updates getState', async () => {
    const controller = new AbortController();
    const run = startGrpcLoadTestSchedulerRun({
      snapshot: makeSnapshot({ durationMs: 30_000, concurrency: 2 }),
      signal: controller.signal,
      executeAttempt: async ({ signal }) => {
        await new Promise<void>((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 60_000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        return { ok: true };
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    expect(run.getState().operation.cancellationRequested).toBe(true);

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
    expect(run.getState().operation.status).toBe('cancelled');
  });
});
