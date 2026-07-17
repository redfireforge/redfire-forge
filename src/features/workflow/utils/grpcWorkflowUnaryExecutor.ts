/**
 * Phase 6C — unary workflow executor with retry semantics.
 */
import type { GrpcCallRequest } from '../../../shared/grpc/contracts';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import type { GrpcTransportErrorDetails } from '../../../shared/grpc/grpcTransportErrors';
import { cancelGrpcUnary } from '../../../shared/grpc/grpcTransportFacade';
import type { GrpcWorkflowExecuteSnapshot } from '../types/workflow/grpcWorkflowSnapshot';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';
import { cloneGrpcWorkflowExecuteSnapshot } from './grpcWorkflowSnapshotBuilder';
import { grpcWorkflowSnapshotToUnaryRequest } from './grpcWorkflowTransportAdapter';
import {
  grpcWorkflowRetryDelayMs,
  resolveGrpcWorkflowRetryPolicy,
  shouldRetryGrpcWorkflowUnaryAttempt,
  sleepGrpcWorkflowBackoff,
} from './grpcWorkflowRetryPolicy';

export interface GrpcUnaryInvokeResult {
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  trailers: Record<string, string>;
  body?: Record<string, unknown>;
  durationMs: number;
  errorDetail?: string;
}

export interface GrpcWorkflowUnaryExecutionOutcome {
  stepResult: GrpcWorkflowStepResult;
  attempts: number;
}

/** Wrap unary invoke so workflow abort cancels the in-flight server call. */
export function wrapUnaryInvokeWithAbort(
  invokeUnary: (request: GrpcCallRequest, tabId: string) => Promise<GrpcUnaryInvokeResult>,
  abortSignal?: AbortSignal,
): (request: GrpcCallRequest, tabId: string) => Promise<GrpcUnaryInvokeResult> {
  if (!abortSignal) return invokeUnary;

  return (request, tabId) => {
    if (abortSignal.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    return new Promise<GrpcUnaryInvokeResult>((resolve, reject) => {
      let settled = false;
      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        void cancelGrpcUnary(request.requestId, tabId).catch(() => undefined);
        reject(new DOMException('Aborted', 'AbortError'));
      };

      abortSignal.addEventListener('abort', onAbort, { once: true });
      invokeUnary(request, tabId).then(
        (result) => {
          if (settled) return;
          settled = true;
          abortSignal.removeEventListener('abort', onAbort);
          resolve(result);
        },
        (error) => {
          if (settled) return;
          settled = true;
          abortSignal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  };
}

export async function executeGrpcWorkflowUnary(
  snapshot: GrpcWorkflowExecuteSnapshot,
  deps: {
    invokeUnary: (request: GrpcCallRequest, tabId: string) => Promise<GrpcUnaryInvokeResult>;
    abortSignal?: AbortSignal;
  },
): Promise<GrpcWorkflowUnaryExecutionOutcome> {
  const policy = resolveGrpcWorkflowRetryPolicy(snapshot.retry);
  const frozenSnapshot = cloneGrpcWorkflowExecuteSnapshot(snapshot);
  const startedAt = performance.now();

  let lastError: unknown;
  let lastResult: GrpcUnaryInvokeResult | undefined;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    if (deps.abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const request = grpcWorkflowSnapshotToUnaryRequest(frozenSnapshot);
    try {
      lastResult = await deps.invokeUnary(request, frozenSnapshot.execute.tabId);
      lastError = undefined;
      if (lastResult.status === 0) {
        return {
          attempts: attempt,
          stepResult: {
            nodeId: snapshot.nodeId,
            callType: 'unary',
            status: 'success',
            grpcStatus: lastResult.status,
            grpcStatusMessage: lastResult.statusMessage,
            durationMs: Math.round(performance.now() - startedAt),
            body: lastResult.body,
            trailers: lastResult.trailers,
          },
        };
      }

      const canRetry = attempt < policy.maxAttempts
        && shouldRetryGrpcWorkflowUnaryAttempt(undefined, lastResult.status, policy.retryOnStatuses);
      if (!canRetry) break;
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
      const canRetry = attempt < policy.maxAttempts
        && shouldRetryGrpcWorkflowUnaryAttempt(error, lastResult?.status, policy.retryOnStatuses);
      if (!canRetry) break;
    }

    if (attempt < policy.maxAttempts) {
      await sleepGrpcWorkflowBackoff(grpcWorkflowRetryDelayMs(policy.backoffMs), deps.abortSignal);
    }
  }

  const durationMs = Math.round(performance.now() - startedAt);
  if (lastResult) {
    return {
      attempts: attemptsUsed,
      stepResult: {
        nodeId: snapshot.nodeId,
        callType: 'unary',
        status: 'failed',
        grpcStatus: lastResult.status,
        grpcStatusMessage: lastResult.statusMessage,
        durationMs,
        body: lastResult.body,
        trailers: lastResult.trailers,
        errorDetail: lastResult.errorDetail ?? lastResult.statusMessage,
      },
    };
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unary call failed');
  return {
    attempts: attemptsUsed || 1,
    stepResult: {
      nodeId: snapshot.nodeId,
      callType: 'unary',
      status: 'failed',
      durationMs,
      errorDetail: message,
    },
  };
}
