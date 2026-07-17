/**
 * Phase 11B - Load-test scheduler core acceptance tests.
 *
 * Validates:
 *   11B-A Validation and safe bounds enforcement
 *   11B-B Bounded concurrency, deterministic scheduling, and stress bounds
 *   11B-C Duration/total-calls stop conditions
 *   11B-D Cancellation and lifecycle completion semantics
 */
import { describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

import {
  captureGrpcLoadTestExecuteSnapshot,
  GrpcLoadTestConfigValidationError,
} from './grpcAdvancedFeatureContracts';
import type { GrpcTabExecuteSnapshot } from './contracts';
import { startGrpcLoadTestSchedulerRun } from './grpcLoadTestSchedulerCore';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function makeUnaryExecuteSnapshot(overrides: Partial<GrpcTabExecuteSnapshot> = {}): GrpcTabExecuteSnapshot {
  return {
    tabId: 'tab-load-1',
    requestId: 'req-load-1',
    capturedAt: '2026-06-30T00:00:00.000Z',
    callType: 'unary',
    target: { address: 'localhost:8080', tlsMode: 'disabled' },
    service: 'demo.EchoService',
    method: 'Echo',
    body: { message: 'hello' },
    metadata: { 'x-run': 'phase11b' },
    timeoutMs: 10_000,
    descriptorKey: 'descriptor-11b',
    ...overrides,
  };
}

describe('Phase 11B-A - validation and safety bounds', () => {
  it('start throws GrpcLoadTestConfigValidationError for invalid config', () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-invalid-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 5 },
    });

    // Force invalid config after capture to verify scheduler gate.
    snapshot.config.concurrency = 0;

    expect(() =>
      startGrpcLoadTestSchedulerRun({
        snapshot,
        executeAttempt: async () => ({ ok: true }),
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });

  it('start throws for non-unary call type', () => {
    const snapshot = {
      runId: 'run-invalid-2',
      capturedAt: '2026-06-30T00:00:00.000Z',
      executeSnapshot: makeUnaryExecuteSnapshot({ callType: 'server_streaming' }),
      config: { concurrency: 2, totalCalls: 5 },
    };

    expect(() =>
      startGrpcLoadTestSchedulerRun({
        snapshot,
        executeAttempt: async () => ({ ok: true }),
      }),
    ).toThrow(GrpcLoadTestConfigValidationError);
  });
});

describe('Phase 11B-B - bounded concurrency, scheduling, and stress', () => {
  it('never exceeds configured concurrency', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-concurrency-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 3, totalCalls: 12 },
    });

    let inFlight = 0;
    let peak = 0;
    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.counts.scheduled).toBe(12);
    expect(report.counts.completed).toBe(12);
    expect(report.counts.peakInFlight).toBeLessThanOrEqual(3);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('schedules attempt numbers deterministically', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-order-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 4, totalCalls: 15 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ attemptNumber }) => ({
        ok: true,
        durationMs: 1 + (attemptNumber % 3),
      }),
    });

    const report = await run.completion;
    const attemptNumbers = report.attempts.map((attempt) => attempt.attemptNumber);
    expect(attemptNumbers).toEqual([...Array(15)].map((_, index) => index + 1));
  });

  it('marks warmup calls using configured warmupCalls prefix', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-warmup-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 8, warmupCalls: 3 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async () => ({ ok: true }),
    });

    const report = await run.completion;
    expect(report.counts.warmupScheduled).toBe(3);
    expect(report.counts.warmupCompleted).toBe(3);
    expect(report.attempts.filter((attempt) => attempt.warmup)).toHaveLength(3);
  });

  it('maintains concurrency cap under high totalCalls volume', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-stress-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 8, totalCalls: 160 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async () => ({ ok: true, durationMs: 0 }),
    });

    const report = await run.completion;
    expect(report.counts.scheduled).toBe(160);
    expect(report.counts.completed).toBe(160);
    expect(report.counts.peakInFlight).toBeLessThanOrEqual(8);
  });

  it('passes an isolated executeSnapshot clone to each attempt', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-snapshot-isolation-1',
      executeSnapshot: makeUnaryExecuteSnapshot({ body: { message: 'original' } }),
      config: { concurrency: 2, totalCalls: 3 },
    });

    const seenBodies: unknown[] = [];
    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ executeSnapshot }) => {
        seenBodies.push(executeSnapshot.body);
        executeSnapshot.body = { message: 'mutated' };
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.counts.scheduled).toBe(3);
    expect(seenBodies).toHaveLength(3);
    expect(new Set(seenBodies).size).toBe(3);
    expect(snapshot.executeSnapshot.body).toEqual({ message: 'original' });
  });
});

describe('Phase 11B-C - duration and total-calls stop conditions', () => {
  it('stops with completed_total_calls when totalCalls is reached', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-total-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 9 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async () => ({ ok: true }),
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_total_calls');
    expect(report.counts.scheduled).toBe(9);
    expect(report.counts.completed).toBe(9);
  });

  it('stops with completed_duration when duration limit is reached', async () => {
    let now = 0;
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-duration-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, durationMs: 1_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
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

  it('tracks success and failure counts from executor outcomes', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-outcomes-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 10 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ attemptNumber }) => ({
        ok: attemptNumber % 2 === 0,
        statusCode: attemptNumber % 2 === 0 ? 0 : 14,
        errorMessage: attemptNumber % 2 === 0 ? undefined : 'UNAVAILABLE',
      }),
    });

    const report = await run.completion;
    expect(report.counts.succeeded).toBe(5);
    expect(report.counts.failed).toBe(5);
  });

  it('prefers completed_total_calls when totalCalls is reached before duration', async () => {
    let now = 0;
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-stop-precedence-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 4, durationMs: 10_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      nowMs: () => now,
      executeAttempt: async () => {
        now += 100;
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_total_calls');
    expect(report.counts.scheduled).toBe(4);
  });

  it('prefers completed_duration when deadline elapses before totalCalls', async () => {
    let now = 0;
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-stop-precedence-2',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 100, durationMs: 1_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      nowMs: () => now,
      executeAttempt: async () => {
        now += 250;
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_duration');
    expect(report.counts.scheduled).toBeLessThan(100);
    expect(report.counts.scheduled).toBeGreaterThan(0);
  });

  it('continues scheduling after non-abort executor throws', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-throws-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, totalCalls: 9 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ attemptNumber }) => {
        if (attemptNumber % 3 === 0) {
          throw new Error('executor boom');
        }
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_total_calls');
    expect(report.counts.scheduled).toBe(9);
    expect(report.counts.completed).toBe(9);
    expect(report.counts.failed).toBe(3);
    expect(report.counts.succeeded).toBe(6);
  });

  it('records string throw failures without stopping the run', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-throws-2',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 3 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ attemptNumber }) => {
        if (attemptNumber === 2) {
          throw 'plain-string-failure';
        }
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('completed_total_calls');
    expect(report.counts.failed).toBe(1);
    expect(report.attempts.find((attempt) => attempt.attemptNumber === 2)?.errorMessage)
      .toBe('plain-string-failure');
  });

  it('aborts in-flight attempts when duration limit is reached', async () => {
    vi.useFakeTimers();
    try {
      const snapshot = captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-duration-abort-1',
        executeSnapshot: makeUnaryExecuteSnapshot(),
        config: { concurrency: 3, durationMs: 1_000 },
      });

      const abortObserved: boolean[] = [];
      const run = startGrpcLoadTestSchedulerRun({
        snapshot,
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
});

describe('Phase 11B-D - cancellation and lifecycle semantics', () => {
  it('cancel() stops active run with cancelled stopReason', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-cancel-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 4, durationMs: 30_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ signal }) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 200);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
        return { ok: true };
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    run.cancel();

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
    expect(report.counts.scheduled).toBeGreaterThan(0);
  });

  it('external abort signal cancels run', async () => {
    const controller = new AbortController();
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-cancel-2',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, durationMs: 30_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      signal: controller.signal,
      executeAttempt: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { ok: true };
      },
    });

    controller.abort();
    expect(run.getState().operation.cancellationRequested).toBe(true);

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
  });

  it('cancel() marks operation cancellationRequested before terminal transition', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-cancel-3',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, durationMs: 30_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async ({ signal }) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
        return { ok: true };
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    run.cancel();

    const mid = run.getState();
    expect(mid.operation.status).toBe('running');
    expect(mid.operation.cancellationRequested).toBe(true);

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');

    const end = run.getState();
    expect(end.operation.status).toBe('cancelled');
    expect(end.operation.cancellationRequested).toBe(false);
  });

  it('external abort signal unblocks scheduler while attempts wait on abort', async () => {
    const controller = new AbortController();
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-cancel-4',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, durationMs: 30_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      signal: controller.signal,
      executeAttempt: async ({ signal }) => {
        await new Promise<void>((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('attempt timed out')), 60_000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        return { ok: true };
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
    expect(run.getState().operation.status).toBe('cancelled');
  });

  it('cancel takes precedence over pending wall-clock duration timer', async () => {
    vi.useFakeTimers();
    try {
      const snapshot = captureGrpcLoadTestExecuteSnapshot({
        runId: 'run-cancel-precedence-1',
        executeSnapshot: makeUnaryExecuteSnapshot(),
        config: { concurrency: 2, durationMs: 5_000 },
      });

      const run = startGrpcLoadTestSchedulerRun({
        snapshot,
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
      expect(run.getState().operation.status).toBe('cancelled');
      expect(run.getState().stopReason).toBe('cancelled');
    } finally {
      vi.useRealTimers();
    }
  });

  it('already-aborted upstream signal cancels run without hanging', async () => {
    const controller = new AbortController();
    controller.abort();

    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-cancel-5',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 2, durationMs: 30_000 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      signal: controller.signal,
      executeAttempt: async () => {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return { ok: true };
      },
    });

    const report = await run.completion;
    expect(report.stopReason).toBe('cancelled');
    expect(report.counts.scheduled).toBe(0);
  });

  it('state transitions to running and terminal states', async () => {
    const snapshot = captureGrpcLoadTestExecuteSnapshot({
      runId: 'run-state-1',
      executeSnapshot: makeUnaryExecuteSnapshot(),
      config: { concurrency: 1, totalCalls: 2 },
    });

    const run = startGrpcLoadTestSchedulerRun({
      snapshot,
      executeAttempt: async () => ({ ok: true }),
    });

    const mid = run.getState();
    expect(mid.operation.status === 'running' || mid.operation.status === 'completed').toBe(true);

    await run.completion;
    const end = run.getState();
    expect(end.operation.status).toBe('completed');
  });
});

describe('Phase 11B-E - source-scan traceability', () => {
  it('scheduler module exports startGrpcLoadTestSchedulerRun', () => {
    const src = readSrc('src/shared/grpc/grpcLoadTestSchedulerCore.ts');
    expect(src.includes('startGrpcLoadTestSchedulerRun')).toBe(true);
  });

  it('scheduler module enforces run snapshot validation via assertGrpcLoadTestRunSnapshot', () => {
    const src = readSrc('src/shared/grpc/grpcLoadTestSchedulerCore.ts');
    expect(src.includes('assertGrpcLoadTestRunSnapshot')).toBe(true);
  });

  it('scheduler module wires 11A cancellation lifecycle via requestGrpcAdvancedOperationCancellation', () => {
    const src = readSrc('src/shared/grpc/grpcLoadTestSchedulerCore.ts');
    expect(src.includes('requestGrpcAdvancedOperationCancellation')).toBe(true);
  });

  it('scheduler module enforces duration deadlines while attempts are in flight', () => {
    const src = readSrc('src/shared/grpc/grpcLoadTestSchedulerCore.ts');
    expect(src.includes('setTimeout')).toBe(true);
    expect(src.includes('enforceDurationStop')).toBe(true);
    expect(src.includes('wallDeadlineMs')).toBe(true);
  });

  it('scheduler module uses cancellation-aware controllers for in-flight attempts', () => {
    const src = readSrc('src/shared/grpc/grpcLoadTestSchedulerCore.ts');
    expect(src.includes('AbortController')).toBe(true);
    expect(src.includes('controller.abort()')).toBe(true);
  });
});