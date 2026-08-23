import { describe, expect, it } from 'vitest';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import {
  DEFAULT_GRPC_WORKFLOW_RETRY_ON_STATUSES,
  resolveGrpcWorkflowRetryPolicy,
  shouldRetryGrpcWorkflowUnaryAttempt,
} from './grpcWorkflowRetryPolicy';

describe('grpcWorkflowRetryPolicy', () => {
  it('defaults to single attempt when retry config is absent', () => {
    expect(resolveGrpcWorkflowRetryPolicy()).toEqual({
      maxAttempts: 1,
      backoffMs: 0,
      retryOnStatuses: [...DEFAULT_GRPC_WORKFLOW_RETRY_ON_STATUSES],
    });
  });

  it('honors explicit retry config', () => {
    expect(resolveGrpcWorkflowRetryPolicy({
      maxAttempts: 3,
      backoffMs: 25,
      retryOnStatuses: [14],
    })).toEqual({
      maxAttempts: 3,
      backoffMs: 25,
      retryOnStatuses: [14],
    });
  });

  it('retries configured grpc status codes', () => {
    expect(shouldRetryGrpcWorkflowUnaryAttempt(undefined, 14, [14])).toBe(true);
    expect(shouldRetryGrpcWorkflowUnaryAttempt(undefined, 3, [14])).toBe(false);
  });

  it('retries DEADLINE_EXCEEDED (4) with default retry status list', () => {
    expect(shouldRetryGrpcWorkflowUnaryAttempt(undefined, 4, [...DEFAULT_GRPC_WORKFLOW_RETRY_ON_STATUSES])).toBe(true);
  });

  it('retries retryable transport errors', () => {
    const err = new GrpcApiClientError('call', 'unavailable', { retryable: true });
    expect(shouldRetryGrpcWorkflowUnaryAttempt(err, undefined, [14])).toBe(true);
  });

  it('retries when grpcStatus is only present on thrown GrpcApiClientError details', () => {
    const err = new GrpcApiClientError('call', 'UNAVAILABLE', {
      retryable: false,
      details: { grpcStatus: 14, statusMessage: 'UNAVAILABLE' },
    });
    expect(shouldRetryGrpcWorkflowUnaryAttempt(err, undefined, [14])).toBe(true);
    expect(shouldRetryGrpcWorkflowUnaryAttempt(err, undefined, [4])).toBe(false);
  });
});
