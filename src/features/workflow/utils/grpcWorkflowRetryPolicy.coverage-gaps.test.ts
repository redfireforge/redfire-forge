import { describe, expect, it, vi } from 'vitest';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import {
  grpcWorkflowRetryDelayMs,
  isRetryableGrpcWorkflowStatus,
  isRetryableGrpcWorkflowTransportError,
  resolveGrpcWorkflowRetryPolicy,
  shouldRetryGrpcWorkflowUnaryAttempt,
  sleepGrpcWorkflowBackoff,
} from './grpcWorkflowRetryPolicy';

describe('grpcWorkflowRetryPolicy coverage gaps', () => {
  it('resolveGrpcWorkflowRetryPolicy floors negative values and uses defaults for empty status list', () => {
    expect(resolveGrpcWorkflowRetryPolicy({
      maxAttempts: 0,
      backoffMs: -5,
      retryOnStatuses: [],
    })).toEqual({
      maxAttempts: 1,
      backoffMs: 0,
      retryOnStatuses: [4, 14],
    });
  });

  it('isRetryableGrpcWorkflowStatus checks membership', () => {
    expect(isRetryableGrpcWorkflowStatus(14, [14])).toBe(true);
    expect(isRetryableGrpcWorkflowStatus(3, [14])).toBe(false);
  });

  it('isRetryableGrpcWorkflowTransportError only accepts retryable GrpcApiClientError', () => {
    expect(isRetryableGrpcWorkflowTransportError(new Error('nope'))).toBe(false);
    expect(isRetryableGrpcWorkflowTransportError(new GrpcApiClientError('x', 'y', { retryable: false }))).toBe(false);
    expect(isRetryableGrpcWorkflowTransportError(new GrpcApiClientError('x', 'y', { retryable: true }))).toBe(true);
  });

  it('shouldRetryGrpcWorkflowUnaryAttempt returns false for non-retryable errors without status', () => {
    expect(shouldRetryGrpcWorkflowUnaryAttempt(new Error('fail'), undefined, [14])).toBe(false);
  });

  it('grpcWorkflowRetryDelayMs clamps negative values to zero', () => {
    expect(grpcWorkflowRetryDelayMs(-10)).toBe(0);
    expect(grpcWorkflowRetryDelayMs(25)).toBe(25);
  });

  it('sleepGrpcWorkflowBackoff resolves immediately for zero delay', async () => {
    await expect(sleepGrpcWorkflowBackoff(0)).resolves.toBeUndefined();
  });

  it('sleepGrpcWorkflowBackoff rejects when abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleepGrpcWorkflowBackoff(50, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('sleepGrpcWorkflowBackoff resolves after delay', async () => {
    vi.useFakeTimers();
    const pending = sleepGrpcWorkflowBackoff(50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('sleepGrpcWorkflowBackoff rejects when abort fires during wait', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = sleepGrpcWorkflowBackoff(1000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    vi.useRealTimers();
  });
});
