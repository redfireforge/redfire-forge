/**
 * Phase 6C — gRPC workflow unary retry policy helpers.
 */
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import type { GrpcTransportErrorDetails } from '../../../shared/grpc/grpcTransportErrors';
import type { GrpcWorkflowRetryPolicy } from '../types/workflow/node-grpc';

/** Default retryable gRPC status codes when retry.retryOnStatuses is omitted. */
export const DEFAULT_GRPC_WORKFLOW_RETRY_ON_STATUSES = [4, 14] as const;

export interface ResolvedGrpcWorkflowRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  retryOnStatuses: number[];
}

export function resolveGrpcWorkflowRetryPolicy(
  retry?: GrpcWorkflowRetryPolicy,
): ResolvedGrpcWorkflowRetryPolicy {
  if (!retry) {
    return { maxAttempts: 1, backoffMs: 0, retryOnStatuses: [...DEFAULT_GRPC_WORKFLOW_RETRY_ON_STATUSES] };
  }
  const maxAttempts = Math.max(1, Math.floor(retry.maxAttempts));
  const backoffMs = Math.max(0, Math.floor(retry.backoffMs));
  const retryOnStatuses = retry.retryOnStatuses?.length
    ? [...retry.retryOnStatuses]
    : [...DEFAULT_GRPC_WORKFLOW_RETRY_ON_STATUSES];
  return { maxAttempts, backoffMs, retryOnStatuses };
}

export function isRetryableGrpcWorkflowStatus(
  status: number,
  retryOnStatuses: readonly number[],
): boolean {
  return retryOnStatuses.includes(status);
}

export function isRetryableGrpcWorkflowTransportError(error: unknown): boolean {
  if (error instanceof GrpcApiClientError) {
    return error.retryable;
  }
  return false;
}

export function shouldRetryGrpcWorkflowUnaryAttempt(
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
    && isRetryableGrpcWorkflowStatus(resolvedStatus, retryOnStatuses)
  ) {
    return true;
  }
  return isRetryableGrpcWorkflowTransportError(error);
}

export function grpcWorkflowRetryDelayMs(backoffMs: number): number {
  return Math.max(0, backoffMs);
}

export async function sleepGrpcWorkflowBackoff(
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
