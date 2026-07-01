/**
 * Phase 8B — gRPC harness attempt/retry lifecycle helpers.
 */
import { GrpcApiClientError } from './grpcApiClient';
import type { GrpcTransportErrorDetails } from './grpcTransportErrors';
import type { GrpcHarnessRetryPolicy } from '../types/grpc-harness';
import type {
  GrpcHarnessAttemptPhase,
  GrpcHarnessAttemptRecord,
  GrpcHarnessExecuteSnapshot,
  GrpcHarnessExecutionSession,
} from '../types/grpc-harness-snapshot';
import { cloneGrpcHarnessExecuteSnapshot } from './grpcHarnessSnapshotBuilder';

/** Default retryable gRPC status codes when retry.retryOnStatuses is omitted. */
export const DEFAULT_GRPC_HARNESS_RETRY_ON_STATUSES = [4, 14] as const;

export interface ResolvedGrpcHarnessRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  retryOnStatuses: number[];
}

export function resolveGrpcHarnessRetryPolicy(
  retry?: GrpcHarnessRetryPolicy,
): ResolvedGrpcHarnessRetryPolicy {
  if (!retry) {
    return {
      maxAttempts: 1,
      backoffMs: 0,
      retryOnStatuses: [...DEFAULT_GRPC_HARNESS_RETRY_ON_STATUSES],
    };
  }
  const maxAttempts = Math.max(1, Math.floor(retry.maxAttempts));
  const backoffMs = Math.max(0, Math.floor(retry.backoffMs));
  const retryOnStatuses = retry.retryOnStatuses?.length
    ? [...retry.retryOnStatuses]
    : [...DEFAULT_GRPC_HARNESS_RETRY_ON_STATUSES];
  return { maxAttempts, backoffMs, retryOnStatuses };
}

export function createGrpcHarnessExecutionSession(
  canonicalSnapshot: GrpcHarnessExecuteSnapshot,
  sessionId: string,
): GrpcHarnessExecutionSession {
  const retryPolicy = resolveGrpcHarnessRetryPolicy(canonicalSnapshot.retry);
  return {
    sessionId,
    scenarioId: canonicalSnapshot.scenarioId,
    scenarioName: canonicalSnapshot.scenarioName,
    canonicalSnapshot: cloneGrpcHarnessExecuteSnapshot(canonicalSnapshot),
    maxAttempts: retryPolicy.maxAttempts,
    backoffMs: retryPolicy.backoffMs,
    retryOnStatuses: retryPolicy.retryOnStatuses,
    attempts: [],
  };
}

export function canStartNextGrpcHarnessAttempt(
  session: GrpcHarnessExecutionSession,
): boolean {
  if (session.attempts.some((attempt) => attempt.phase === 'succeeded')) {
    return false;
  }
  if (session.attempts.some((attempt) => attempt.phase === 'in_flight')) {
    return false;
  }
  return session.attempts.length < session.maxAttempts;
}

export function startGrpcHarnessAttempt(
  session: GrpcHarnessExecutionSession,
  startedAt = new Date().toISOString(),
): GrpcHarnessAttemptRecord {
  if (!canStartNextGrpcHarnessAttempt(session)) {
    throw new Error('Cannot start another gRPC harness attempt for this session');
  }
  const attemptNumber = session.attempts.length + 1;
  const record: GrpcHarnessAttemptRecord = {
    attemptNumber,
    snapshot: cloneGrpcHarnessExecuteSnapshot(session.canonicalSnapshot),
    phase: 'in_flight',
    startedAt,
  };
  session.attempts.push(record);
  return record;
}

export function completeGrpcHarnessAttempt(
  session: GrpcHarnessExecutionSession,
  attemptNumber: number,
  phase: Extract<GrpcHarnessAttemptPhase, 'succeeded' | 'failed' | 'aborted'>,
  options?: { finishedAt?: string; errorMessage?: string },
): GrpcHarnessAttemptRecord {
  const attempt = session.attempts.find((entry) => entry.attemptNumber === attemptNumber);
  if (!attempt) {
    throw new Error(`gRPC harness attempt ${attemptNumber} not found`);
  }
  if (attempt.phase !== 'in_flight') {
    throw new Error(`gRPC harness attempt ${attemptNumber} is not in flight`);
  }
  attempt.phase = phase;
  attempt.finishedAt = options?.finishedAt ?? new Date().toISOString();
  if (options?.errorMessage) {
    attempt.errorMessage = options.errorMessage;
  }
  return attempt;
}

export function getActiveGrpcHarnessAttempt(
  session: GrpcHarnessExecutionSession,
): GrpcHarnessAttemptRecord | undefined {
  return session.attempts.find((attempt) => attempt.phase === 'in_flight');
}

export function grpcHarnessSessionHasAttemptsRemaining(
  session: GrpcHarnessExecutionSession,
): boolean {
  return canStartNextGrpcHarnessAttempt(session);
}

export function isRetryableGrpcHarnessStatus(
  status: number,
  retryOnStatuses: readonly number[],
): boolean {
  return retryOnStatuses.includes(status);
}

export function isRetryableGrpcHarnessTransportError(error: unknown): boolean {
  if (error instanceof GrpcApiClientError) {
    return error.retryable;
  }
  return false;
}

export function shouldRetryGrpcHarnessAttempt(
  error: unknown,
  grpcStatus: number | undefined,
  retryOnStatuses: readonly number[],
): boolean {
  let resolvedStatus = grpcStatus;
  if (resolvedStatus === undefined && error instanceof GrpcApiClientError) {
    const detailsStatus = (error.details as GrpcTransportErrorDetails | undefined)?.grpcStatus;
    if (typeof detailsStatus === 'number') {
      resolvedStatus = detailsStatus;
    }
  }

  if (
    resolvedStatus !== undefined
    && isRetryableGrpcHarnessStatus(resolvedStatus, retryOnStatuses)
  ) {
    return true;
  }
  return isRetryableGrpcHarnessTransportError(error);
}

export function grpcHarnessRetryDelayMs(backoffMs: number): number {
  return Math.max(0, backoffMs);
}

export async function sleepGrpcHarnessBackoff(
  backoffMs: number,
  abortSignal?: AbortSignal,
): Promise<void> {
  if (backoffMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => resolve(), backoffMs);
    abortSignal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
