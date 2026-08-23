/**
 * Phase 8C — unary harness executor with retry semantics.
 */
import type { GrpcCallRequest } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import type { GrpcTransportErrorDetails } from './grpcTransportErrors';
import type { GrpcHarnessCallOutcome, GrpcHarnessExecuteSnapshot } from '../types/grpc-harness-snapshot';
import { wrapUnaryInvokeWithAbort, type GrpcUnaryInvokeResult } from '@workflow/utils/grpcWorkflowUnaryExecutor';
import { grpcHarnessSnapshotToUnaryRequest } from './grpcHarnessTransportAdapter';
import {
  canStartNextGrpcHarnessAttempt,
  completeGrpcHarnessAttempt,
  createGrpcHarnessExecutionSession,
  grpcHarnessRetryDelayMs,
  resolveGrpcHarnessRetryPolicy,
  shouldRetryGrpcHarnessAttempt,
  sleepGrpcHarnessBackoff,
  startGrpcHarnessAttempt,
} from './grpcHarnessAttemptLifecycle';

export interface GrpcHarnessUnaryExecutionDeps {
  invokeUnary: (request: GrpcCallRequest, tabId: string) => Promise<GrpcUnaryInvokeResult>;
  abortSignal?: AbortSignal;
}

function unaryOutcomeFromResult(
  result: GrpcUnaryInvokeResult,
  attempts: number,
  startedAt: number,
): GrpcHarnessCallOutcome {
  const passed = result.status === 0;
  return {
    callType: 'unary',
    passed,
    grpcStatus: result.status,
    grpcStatusMessage: result.statusMessage,
    durationMs: Math.round(performance.now() - startedAt),
    body: result.body,
    trailers: result.trailers,
    attempts,
    errorDetail: passed ? undefined : (result.errorDetail ?? result.statusMessage),
    errorCategory: passed ? undefined : 'internal',
  };
}

function unaryOutcomeFromTransportError(
  error: unknown,
  lastResult: GrpcUnaryInvokeResult | undefined,
  attempts: number,
  startedAt: number,
): GrpcHarnessCallOutcome {
  const durationMs = Math.round(performance.now() - startedAt);
  if (lastResult) {
    return {
      callType: 'unary',
      passed: false,
      grpcStatus: lastResult.status,
      grpcStatusMessage: lastResult.statusMessage,
      durationMs,
      body: lastResult.body,
      trailers: lastResult.trailers,
      attempts,
      errorDetail: lastResult.errorDetail ?? lastResult.statusMessage,
      errorCategory: 'internal',
    };
  }
  const message = error instanceof Error ? error.message : String(error ?? 'Unary call failed');
  return {
    callType: 'unary',
    passed: false,
    durationMs,
    attempts: attempts || 1,
    errorDetail: message,
    errorCategory: error instanceof GrpcApiClientError && error.retryable ? 'network' : 'internal',
  };
}

/** Execute a frozen unary harness snapshot with scenario retry policy. */
export async function executeGrpcHarnessUnary(
  snapshot: GrpcHarnessExecuteSnapshot,
  deps: GrpcHarnessUnaryExecutionDeps,
): Promise<GrpcHarnessCallOutcome> {
  const policy = resolveGrpcHarnessRetryPolicy(snapshot.retry);
  const session = createGrpcHarnessExecutionSession(snapshot, `harness-unary:${snapshot.scenarioId}`);
  const invokeUnary = wrapUnaryInvokeWithAbort(deps.invokeUnary, deps.abortSignal);
  const startedAt = performance.now();

  let lastError: unknown;
  let lastResult: GrpcUnaryInvokeResult | undefined;
  let attemptsUsed = 0;

  while (canStartNextGrpcHarnessAttempt(session)) {
    if (deps.abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const attempt = startGrpcHarnessAttempt(session);
    attemptsUsed = attempt.attemptNumber;
    const request = grpcHarnessSnapshotToUnaryRequest(attempt.snapshot);

    try {
      lastResult = await invokeUnary(request, attempt.snapshot.execute.tabId);
      lastError = undefined;

      if (lastResult.status === 0) {
        completeGrpcHarnessAttempt(session, attempt.attemptNumber, 'succeeded');
        return unaryOutcomeFromResult(lastResult, attemptsUsed, startedAt);
      }

      const canRetry = attempt.attemptNumber < policy.maxAttempts
        && shouldRetryGrpcHarnessAttempt(undefined, lastResult.status, policy.retryOnStatuses);
      completeGrpcHarnessAttempt(session, attempt.attemptNumber, 'failed', {
        errorMessage: lastResult.statusMessage,
      });
      if (!canRetry) {
        return unaryOutcomeFromResult(lastResult, attemptsUsed, startedAt);
      }
    } catch (error) {
      lastError = error;
      if (error instanceof GrpcApiClientError) {
        const details = error.details as GrpcTransportErrorDetails | undefined;
        if (typeof details?.grpcStatus === 'number') {
          lastResult = {
            status: details.grpcStatus,
            statusMessage: typeof details.statusMessage === 'string'
              ? details.statusMessage
              : error.message,
            headers: {},
            trailers: details.trailers ?? {},
            durationMs: Math.round(performance.now() - startedAt),
            errorDetail: error.message,
          };
        } else {
          lastResult = undefined;
        }
      } else {
        lastResult = undefined;
      }

      const canRetry = attempt.attemptNumber < policy.maxAttempts
        && shouldRetryGrpcHarnessAttempt(error, lastResult?.status, policy.retryOnStatuses);
      completeGrpcHarnessAttempt(session, attempt.attemptNumber, 'failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (!canRetry) {
        return unaryOutcomeFromTransportError(error, lastResult, attemptsUsed, startedAt);
      }
    }

    if (attempt.attemptNumber < policy.maxAttempts) {
      await sleepGrpcHarnessBackoff(grpcHarnessRetryDelayMs(policy.backoffMs), deps.abortSignal);
    }
  }

  return unaryOutcomeFromTransportError(lastError, lastResult, attemptsUsed, startedAt);
}
