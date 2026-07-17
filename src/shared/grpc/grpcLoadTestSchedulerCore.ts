/**
 * Phase 11B - Load-test scheduler core.
 *
 * Bounded by:
 * - validated config limits from Phase 11A contracts
 * - fixed concurrency cap
 * - totalCalls and/or durationMs stop conditions
 * - explicit cancellation support
 */

import {
  assertGrpcLoadTestRunSnapshot,
  createInitialGrpcAdvancedOperationState,
  requestGrpcAdvancedOperationCancellation,
  transitionGrpcAdvancedOperationState,
  type GrpcAdvancedOperationState,
  type GrpcLoadTestExecuteSnapshot,
  type GrpcLoadTestExecutionAttempt,
  type GrpcLoadTestRunCounts,
  type GrpcLoadTestRunReport,
  type GrpcLoadTestStopReason,
} from './grpcAdvancedFeatureContracts';
import type { GrpcCallType } from './contracts';

export interface GrpcLoadTestAttemptContext {
  runId: string;
  attemptNumber: number;
  warmup: boolean;
  executeSnapshot: GrpcLoadTestExecuteSnapshot['executeSnapshot'];
  signal: AbortSignal;
  startedAt: string;
}

export interface GrpcLoadTestAttemptOutcome {
  ok: boolean;
  durationMs?: number;
  statusCode?: number;
  errorMessage?: string;
}

export interface GrpcLoadTestSchedulerParams {
  snapshot: GrpcLoadTestExecuteSnapshot;
  executeAttempt: (
    ctx: GrpcLoadTestAttemptContext,
  ) => Promise<GrpcLoadTestAttemptOutcome> | GrpcLoadTestAttemptOutcome;
  signal?: AbortSignal;
  nowMs?: () => number;
  /** Defaults to unary-only validation for Phase 11B scheduler entrypoint. */
  allowedCallTypes?: readonly GrpcCallType[];
}

export interface GrpcLoadTestSchedulerState {
  operation: GrpcAdvancedOperationState;
  startedAt?: string;
  completedAt?: string;
  stopReason?: GrpcLoadTestStopReason;
  counts: GrpcLoadTestRunCounts;
  liveMetrics?: {
    measuredAttempts: number;
    measuredAttemptsPerSecond: number;
    successRatePercent: number;
    errorRatePercent: number;
    p50Ms: number;
  };
}

export interface GrpcLoadTestSchedulerRun {
  runId: string;
  snapshot: GrpcLoadTestExecuteSnapshot;
  completion: Promise<GrpcLoadTestRunReport>;
  cancel: () => void;
  getState: () => GrpcLoadTestSchedulerState;
}

function createInitialCounts(): GrpcLoadTestRunCounts {
  return {
    scheduled: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    warmupScheduled: 0,
    warmupCompleted: 0,
    peakInFlight: 0,
  };
}

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isAbortLike(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'AbortError' || /abort|cancel/i.test(error.message);
}

export function startGrpcLoadTestSchedulerRun(
  params: GrpcLoadTestSchedulerParams,
): GrpcLoadTestSchedulerRun {
  const snapshot = structuredClone(params.snapshot);
  assertGrpcLoadTestRunSnapshot(snapshot, {
    allowedCallTypes: params.allowedCallTypes ?? ['unary'],
  });

  const nowMs = params.nowMs ?? (() => Date.now());
  const counts = createInitialCounts();
  const runController = new AbortController();
  const inFlight = new Map<number, AbortController>();
  const attempts: GrpcLoadTestExecutionAttempt[] = [];
  let measuredAttempts = 0;
  let measuredSucceeded = 0;
  let measuredFailed = 0;
  const measuredDurationsMs: number[] = [];

  let nextAttemptNumber = 1;
  let operation = transitionGrpcAdvancedOperationState(
    createInitialGrpcAdvancedOperationState(),
    'validating',
    { operationId: snapshot.runId, nowIso: new Date(nowMs()).toISOString() },
  );
  operation = transitionGrpcAdvancedOperationState(operation, 'running', {
    operationId: snapshot.runId,
    nowIso: new Date(nowMs()).toISOString(),
  });

  const totalCallsLimit = snapshot.config.totalCalls ?? Number.POSITIVE_INFINITY;
  const warmupLimit = snapshot.config.warmupCalls ?? 0;
  const startedAtMs = nowMs();
  const wallStartedAtMs = Date.now();
  const durationLimitMs = snapshot.config.durationMs;
  const deadlineMs = durationLimitMs == null
    ? Number.POSITIVE_INFINITY
    : startedAtMs + durationLimitMs;
  const wallDeadlineMs = durationLimitMs == null
    ? Number.POSITIVE_INFINITY
    : wallStartedAtMs + durationLimitMs;

  const startedAt = new Date(startedAtMs).toISOString();
  let completedAt: string | undefined;
  let stopReason: GrpcLoadTestStopReason | undefined;
  let wakeResolver: (() => void) | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const requestRateRps = snapshot.config.requestRateRps ?? 0;
  const launchIntervalMs = requestRateRps > 0 ? 1_000 / requestRateRps : 0;
  let nextAllowedLaunchAtMs = startedAtMs;

  const buildLiveMetrics = (atMs: number): GrpcLoadTestSchedulerState['liveMetrics'] => {
    const elapsedMs = Math.max(1, atMs - startedAtMs);
    const successRatePercent = measuredAttempts > 0
      ? (measuredSucceeded / measuredAttempts) * 100
      : 0;
    const errorRatePercent = measuredAttempts > 0
      ? (measuredFailed / measuredAttempts) * 100
      : 0;
    const sortedDurations = measuredDurationsMs.length > 0
      ? [...measuredDurationsMs].sort((a, b) => a - b)
      : [];
    const p50Ms = sortedDurations.length > 0
      ? sortedDurations[Math.floor((sortedDurations.length - 1) * 0.5)]
      : 0;

    return {
      measuredAttempts,
      measuredAttemptsPerSecond: (measuredAttempts * 1_000) / elapsedMs,
      successRatePercent,
      errorRatePercent,
      p50Ms,
    };
  };

  const hasDurationElapsed = (): boolean => (
    durationLimitMs != null
    && (nowMs() >= deadlineMs || Date.now() >= wallDeadlineMs)
  );

  const enforceDurationStop = (): void => {
    if (durationLimitMs == null || runController.signal.aborted || stopReason != null) {
      return;
    }
    stopReason = 'completed_duration';
    for (const controller of inFlight.values()) {
      controller.abort();
    }
    wake();
  };

  const wake = (): void => {
    const resolver = wakeResolver;
    wakeResolver = null;
    resolver?.();
  };

  const waitForWake = async (maxWaitMs?: number): Promise<void> => {
    await new Promise<void>((resolve) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      wakeResolver = () => {
        if (timeout != null) {
          clearTimeout(timeout);
        }
        resolve();
      };
      if (maxWaitMs != null && Number.isFinite(maxWaitMs) && maxWaitMs > 0) {
        timeout = setTimeout(() => {
          if (wakeResolver != null) {
            wakeResolver = null;
          }
          resolve();
        }, maxWaitMs);
      }
    });
  };

  const canLaunchByRate = (): boolean => {
    if (launchIntervalMs <= 0) {
      return true;
    }
    return nowMs() >= nextAllowedLaunchAtMs;
  };

  const reserveLaunchRateSlot = (): void => {
    if (launchIntervalMs <= 0) {
      return;
    }
    const now = nowMs();
    nextAllowedLaunchAtMs = Math.max(nextAllowedLaunchAtMs, now) + launchIntervalMs;
  };

  const requestRunCancellation = (): void => {
    operation = requestGrpcAdvancedOperationCancellation(operation);
    if (!runController.signal.aborted) {
      runController.abort();
      wake();
    }
  };

  const upstreamAbortListener = (): void => {
    requestRunCancellation();
  };
  params.signal?.addEventListener('abort', upstreamAbortListener, { once: true });
  if (params.signal?.aborted) {
    requestRunCancellation();
  }

  if (durationLimitMs != null) {
    const wallRemainingMs = Math.max(0, wallDeadlineMs - Date.now());
    deadlineTimer = setTimeout(() => {
      enforceDurationStop();
    }, wallRemainingMs);
  }

  const launchAttempt = (attemptNumber: number): void => {
    const warmup = attemptNumber <= warmupLimit;
    const startedMs = nowMs();
    const startedIso = new Date(startedMs).toISOString();
    const abortController = new AbortController();
    inFlight.set(attemptNumber, abortController);

    counts.scheduled += 1;
    if (warmup) {
      counts.warmupScheduled += 1;
    }
    if (inFlight.size > counts.peakInFlight) {
      counts.peakInFlight = inFlight.size;
    }

    Promise.resolve(params.executeAttempt({
      runId: snapshot.runId,
      attemptNumber,
      warmup,
      executeSnapshot: structuredClone(snapshot.executeSnapshot),
      signal: abortController.signal,
      startedAt: startedIso,
    }))
      .then((outcome): void => {
        const finishedMs = nowMs();
        const durationMs = outcome.durationMs ?? Math.max(0, finishedMs - startedMs);
        attempts.push({
          attemptNumber,
          warmup,
          startedAt: startedIso,
          finishedAt: new Date(finishedMs).toISOString(),
          durationMs,
          ok: outcome.ok,
          statusCode: outcome.statusCode,
          errorMessage: outcome.errorMessage,
        });
        counts.completed += 1;
        if (warmup) {
          counts.warmupCompleted += 1;
        }
        if (outcome.ok) {
          counts.succeeded += 1;
        } else {
          counts.failed += 1;
        }
        if (!warmup) {
          measuredAttempts += 1;
          measuredDurationsMs.push(durationMs);
          if (outcome.ok) {
            measuredSucceeded += 1;
          } else {
            measuredFailed += 1;
          }
        }
      })
      .catch((error): void => {
        const finishedMs = nowMs();
        attempts.push({
          attemptNumber,
          warmup,
          startedAt: startedIso,
          finishedAt: new Date(finishedMs).toISOString(),
          durationMs: Math.max(0, finishedMs - startedMs),
          ok: false,
          errorMessage: errorMessageFromUnknown(error),
        });
        counts.completed += 1;
        if (warmup) {
          counts.warmupCompleted += 1;
        }
        counts.failed += 1;
        if (!warmup) {
          measuredAttempts += 1;
          measuredFailed += 1;
          measuredDurationsMs.push(Math.max(0, finishedMs - startedMs));
        }

        if (!runController.signal.aborted && !isAbortLike(error)) {
          // Failures are tracked but do not stop the scheduler in Phase 11B.
        }
      })
      .finally((): void => {
        inFlight.delete(attemptNumber);
        wake();
      });
  };

  const completion = (async (): Promise<GrpcLoadTestRunReport> => {
    while (true) {
      if (runController.signal.aborted) {
        stopReason = stopReason ?? 'cancelled';
        for (const controller of inFlight.values()) {
          controller.abort();
        }
      } else if (hasDurationElapsed()) {
        enforceDurationStop();
      }

      while (
        !runController.signal.aborted
        && !hasDurationElapsed()
        && nextAttemptNumber <= totalCallsLimit
        && inFlight.size < snapshot.config.concurrency
        && canLaunchByRate()
      ) {
        reserveLaunchRateSlot();
        launchAttempt(nextAttemptNumber);
        nextAttemptNumber += 1;
      }

      if (inFlight.size === 0) {
        if (stopReason != null) {
          break;
        }
        if (nextAttemptNumber > totalCallsLimit) {
          stopReason = 'completed_total_calls';
          break;
        }
        if (hasDurationElapsed()) {
          stopReason = 'completed_duration';
          break;
        }
      }

      const rateDelayMs = launchIntervalMs > 0
        ? Math.max(0, nextAllowedLaunchAtMs - nowMs())
        : undefined;
      await waitForWake(rateDelayMs);
    }

    const endedAtMs = nowMs();
    completedAt = new Date(endedAtMs).toISOString();
    const reason = stopReason ?? 'completed_total_calls';
    operation = transitionGrpcAdvancedOperationState(
      operation,
      reason === 'cancelled' ? 'cancelled' : 'completed',
      { nowIso: completedAt },
    );

    attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);
    return {
      runId: snapshot.runId,
      startedAt,
      completedAt,
      durationMs: Math.max(0, endedAtMs - startedAtMs),
      stopReason: reason,
      counts: { ...counts },
      attempts,
    };
  })().finally(() => {
    if (deadlineTimer != null) {
      clearTimeout(deadlineTimer);
    }
    params.signal?.removeEventListener('abort', upstreamAbortListener);
  });

  return {
    runId: snapshot.runId,
    snapshot,
    completion,
    cancel: (): void => {
      requestRunCancellation();
    },
    getState: (): GrpcLoadTestSchedulerState => ({
      operation,
      startedAt,
      completedAt,
      stopReason,
      counts: { ...counts },
      liveMetrics: buildLiveMetrics(nowMs()),
    }),
  };
}