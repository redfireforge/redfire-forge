/**
 * Phase 8B — gRPC harness attempt lifecycle tests.
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import {
  canStartNextGrpcHarnessAttempt,
  completeGrpcHarnessAttempt,
  createGrpcHarnessExecutionSession,
  DEFAULT_GRPC_HARNESS_RETRY_ON_STATUSES,
  getActiveGrpcHarnessAttempt,
  grpcHarnessSessionHasAttemptsRemaining,
  isRetryableGrpcHarnessStatus,
  resolveGrpcHarnessRetryPolicy,
  shouldRetryGrpcHarnessAttempt,
  sleepGrpcHarnessBackoff,
  startGrpcHarnessAttempt,
} from './grpcHarnessAttemptLifecycle';
import { GrpcApiClientError } from './grpcApiClient';
import { buildGrpcHarnessExecuteSnapshot } from './grpcHarnessSnapshotBuilder';

const PAGE_DEFAULTS = { target: 'localhost:50051', tlsMode: 'disabled' as const };

function makeUnarySnapshot(retry?: { maxAttempts: number; backoffMs: number }) {
  const scenario = _makeScenario({
    id: 'grpc-retry',
    name: 'Retry test',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
      retry,
    },
  }) as Scenario;

  return buildGrpcHarnessExecuteSnapshot(
    { scenario, requestId: 'req-retry', capturedAt: '2026-06-29T00:00:00.000Z' },
    {
      resolveTemplate: (value) => value,
      profiles: [],
      pageDefaults: PAGE_DEFAULTS,
    },
  );
}

describe('grpcHarnessAttemptLifecycle (Phase 8B)', () => {
  it('defaults to single attempt when retry is absent', () => {
    const policy = resolveGrpcHarnessRetryPolicy(undefined);
    expect(policy.maxAttempts).toBe(1);
    expect(policy.backoffMs).toBe(0);
  });

  it('resolves retry policy from snapshot config', () => {
    const policy = resolveGrpcHarnessRetryPolicy({
      maxAttempts: 3,
      backoffMs: 250,
      retryOnStatuses: [14],
    });
    expect(policy.maxAttempts).toBe(3);
    expect(policy.backoffMs).toBe(250);
    expect(policy.retryOnStatuses).toEqual([14]);
  });

  it('clones snapshot per attempt without mutating canonical session snapshot', () => {
    const snapshot = makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0 });
    const session = createGrpcHarnessExecutionSession(snapshot, 'session-1');
    const attempt1 = startGrpcHarnessAttempt(session, '2026-06-29T00:00:00.000Z');
    attempt1.snapshot.execute.body.message = 'mutated';

    expect(session.canonicalSnapshot.execute.body).toEqual({ message: 'hello' });

    completeGrpcHarnessAttempt(session, 1, 'failed', {
      finishedAt: '2026-06-29T00:00:01.000Z',
      errorMessage: 'UNAVAILABLE',
    });

    expect(canStartNextGrpcHarnessAttempt(session)).toBe(true);
    expect(grpcHarnessSessionHasAttemptsRemaining(session)).toBe(true);

    const attempt2 = startGrpcHarnessAttempt(session, '2026-06-29T00:00:02.000Z');
    expect(attempt2.attemptNumber).toBe(2);
    expect(attempt2.snapshot.execute.body).toEqual({ message: 'hello' });
    expect(session.attempts).toHaveLength(2);
  });

  it('blocks new attempts after maxAttempts exhausted', () => {
    const snapshot = makeUnarySnapshot({ maxAttempts: 1, backoffMs: 0 });
    const session = createGrpcHarnessExecutionSession(snapshot, 'session-2');
    startGrpcHarnessAttempt(session);
    completeGrpcHarnessAttempt(session, 1, 'failed', { errorMessage: 'fail' });

    expect(canStartNextGrpcHarnessAttempt(session)).toBe(false);
    expect(grpcHarnessSessionHasAttemptsRemaining(session)).toBe(false);
    expect(() => startGrpcHarnessAttempt(session)).toThrow('Cannot start another');
  });

  it('does not start another attempt after success even when maxAttempts > 1', () => {
    const snapshot = makeUnarySnapshot({ maxAttempts: 3, backoffMs: 0 });
    const session = createGrpcHarnessExecutionSession(snapshot, 'session-3');
    startGrpcHarnessAttempt(session);
    completeGrpcHarnessAttempt(session, 1, 'succeeded');

    expect(canStartNextGrpcHarnessAttempt(session)).toBe(false);
    expect(grpcHarnessSessionHasAttemptsRemaining(session)).toBe(false);
    expect(() => startGrpcHarnessAttempt(session)).toThrow('Cannot start another');
  });

  it('reports no attempts remaining while an attempt is in flight', () => {
    const snapshot = makeUnarySnapshot({ maxAttempts: 3, backoffMs: 0 });
    const session = createGrpcHarnessExecutionSession(snapshot, 'session-4');
    startGrpcHarnessAttempt(session);

    expect(canStartNextGrpcHarnessAttempt(session)).toBe(false);
    expect(grpcHarnessSessionHasAttemptsRemaining(session)).toBe(false);
  });

  it('evaluates retry eligibility from gRPC status and transport errors', () => {
    expect(shouldRetryGrpcHarnessAttempt(null, 14, [4, 14])).toBe(true);
    expect(shouldRetryGrpcHarnessAttempt(null, 3, [4, 14])).toBe(false);
    expect(shouldRetryGrpcHarnessAttempt(
      new GrpcApiClientError('call', 'unavailable', { retryable: true }),
      undefined,
      [4, 14],
    )).toBe(true);
    expect(isRetryableGrpcHarnessStatus(4, [4, 14])).toBe(true);
  });

  it('allows a new attempt after aborted failure when budget remains', () => {
    const snapshot = makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0 });
    const session = createGrpcHarnessExecutionSession(snapshot, 'session-abort');
    startGrpcHarnessAttempt(session);
    completeGrpcHarnessAttempt(session, 1, 'aborted', { errorMessage: 'user cancelled' });

    expect(canStartNextGrpcHarnessAttempt(session)).toBe(true);
    const attempt2 = startGrpcHarnessAttempt(session);
    expect(attempt2.attemptNumber).toBe(2);
  });

  it('retries DEADLINE_EXCEEDED (4) with default retry status list', () => {
    expect(shouldRetryGrpcHarnessAttempt(undefined, 4, [...DEFAULT_GRPC_HARNESS_RETRY_ON_STATUSES])).toBe(true);
  });

  it('retries when grpcStatus is only present on thrown GrpcApiClientError details', () => {
    const err = new GrpcApiClientError('call', 'UNAVAILABLE', {
      retryable: false,
      details: { grpcStatus: 14, statusMessage: 'UNAVAILABLE' },
    });
    expect(shouldRetryGrpcHarnessAttempt(err, undefined, [14])).toBe(true);
    expect(shouldRetryGrpcHarnessAttempt(err, undefined, [4])).toBe(false);
  });

  it('getActiveGrpcHarnessAttempt returns the in-flight attempt', () => {
    const snapshot = makeUnarySnapshot();
    const session = createGrpcHarnessExecutionSession(snapshot, 'session-active');
    expect(getActiveGrpcHarnessAttempt(session)).toBeUndefined();

    const attempt = startGrpcHarnessAttempt(session);
    expect(getActiveGrpcHarnessAttempt(session)).toBe(attempt);

    completeGrpcHarnessAttempt(session, 1, 'succeeded');
    expect(getActiveGrpcHarnessAttempt(session)).toBeUndefined();
  });

  it('sleepGrpcHarnessBackoff resolves immediately for zero delay', async () => {
    await expect(sleepGrpcHarnessBackoff(0)).resolves.toBeUndefined();
  });

  it('sleepGrpcHarnessBackoff rejects when abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleepGrpcHarnessBackoff(50, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('sleepGrpcHarnessBackoff resolves after delay', async () => {
    vi.useFakeTimers();
    const pending = sleepGrpcHarnessBackoff(50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('sleepGrpcHarnessBackoff rejects when abort fires during wait', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = sleepGrpcHarnessBackoff(1000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    vi.useRealTimers();
  });

  it('createGrpcHarnessExecutionSession isolates canonical snapshot from input mutation', () => {
    const snapshot = makeUnarySnapshot();
    const session = createGrpcHarnessExecutionSession(snapshot, 'session-clone');
    snapshot.execute.body.message = 'mutated-input';

    expect(session.canonicalSnapshot.execute.body).toEqual({ message: 'hello' });
  });

  it('completeGrpcHarnessAttempt rejects unknown attempt numbers', () => {
    const session = createGrpcHarnessExecutionSession(makeUnarySnapshot(), 'session-err');
    expect(() => completeGrpcHarnessAttempt(session, 99, 'failed')).toThrow('attempt 99 not found');
  });

  it('completeGrpcHarnessAttempt rejects completing a non-in-flight attempt', () => {
    const session = createGrpcHarnessExecutionSession(makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0 }), 'session-err2');
    startGrpcHarnessAttempt(session);
    completeGrpcHarnessAttempt(session, 1, 'failed');
    expect(() => completeGrpcHarnessAttempt(session, 1, 'failed')).toThrow('is not in flight');
  });
});
