/**
 * Coverage gaps — grpcHarnessUnaryExecutor.ts (Phase 8C retry semantics).
 */
import { describe, expect, it, vi } from 'vitest';
import { GrpcApiClientError } from './grpcApiClient';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import type { Scenario } from '../types';
import { buildGrpcHarnessExecuteSnapshot } from './grpcHarnessSnapshotBuilder';
import { executeGrpcHarnessUnary } from './grpcHarnessUnaryExecutor';

const CONTEXT = {
  resolveTemplate: (value: string) => value,
  profiles: [],
  pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
};

function makeUnarySnapshot(retry?: { maxAttempts: number; backoffMs: number; retryOnStatuses?: number[] }) {
  const scenario = _makeScenario({
    id: 'grpc-unary-gap',
    name: 'Echo',
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
  return buildGrpcHarnessExecuteSnapshot({ scenario, requestId: 'req-unary-gap' }, CONTEXT);
}

describe('grpcHarnessUnaryExecutor coverage gaps', () => {
  it('retries retryable GrpcApiClientError transport failures', async () => {
    const invokeUnary = vi
      .fn()
      .mockRejectedValueOnce(new GrpcApiClientError('call', 'UNAVAILABLE', {
        retryable: true,
        details: { grpcStatus: 14, statusMessage: 'UNAVAILABLE' },
      }))
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 6,
      });
    const outcome = await executeGrpcHarnessUnary(
      makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] }),
      { invokeUnary },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(invokeUnary).toHaveBeenCalledTimes(2);
  });

  it('maps non-retryable GrpcApiClientError without grpcStatus details', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'network down', { retryable: false });
    });
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.passed).toBe(false);
    expect(outcome.errorCategory).toBe('internal');
    expect(outcome.errorDetail).toContain('network down');
  });

  it('maps retryable transport error to network category when retries exhausted', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'UNAVAILABLE', { retryable: true });
    });
    const outcome = await executeGrpcHarnessUnary(
      makeUnarySnapshot({ maxAttempts: 1, backoffMs: 0 }),
      { invokeUnary },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.errorCategory).toBe('network');
  });

  it('returns failed unary outcome with grpc status payload from transport error details', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'INVALID_ARGUMENT', {
        retryable: false,
        details: {
          grpcStatus: 3,
          statusMessage: 'INVALID_ARGUMENT',
          trailers: { 'grpc-status': '3' },
        },
      });
    });
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.grpcStatus).toBe(3);
    expect(outcome.trailers).toEqual({ 'grpc-status': '3' });
  });

  it('includes errorDetail on failed grpc status responses', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      durationMs: 4,
      errorDetail: 'bad request payload',
    }));
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.passed).toBe(false);
    expect(outcome.errorDetail).toBe('bad request payload');
  });

  it('uses error.message when grpc transport details omit statusMessage', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'fallback message', {
        retryable: false,
        details: { grpcStatus: 13 },
      });
    });
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.grpcStatusMessage).toBe('fallback message');
  });

  it('retries after failed grpc status when policy allows', async () => {
    const invokeUnary = vi
      .fn()
      .mockResolvedValueOnce({
        status: 14,
        statusMessage: 'UNAVAILABLE',
        headers: {},
        trailers: {},
        durationMs: 3,
      })
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { ok: true },
        durationMs: 4,
      });
    const outcome = await executeGrpcHarnessUnary(
      makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] }),
      { invokeUnary },
    );
    expect(outcome.passed).toBe(true);
    expect(invokeUnary).toHaveBeenCalledTimes(2);
  });

  it('returns unaryOutcomeFromTransportError using lastResult payload', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'INVALID_ARGUMENT', {
        retryable: false,
        details: {
          grpcStatus: 3,
          statusMessage: 'INVALID_ARGUMENT',
          trailers: { 'grpc-status': '3' },
        },
      });
    });
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.grpcStatus).toBe(3);
    expect(outcome.errorDetail).toBe('INVALID_ARGUMENT');
    expect(outcome.trailers).toEqual({ 'grpc-status': '3' });
  });

  it('handles non-Error throw values in transport failure path', async () => {
    const invokeUnary = vi.fn(async () => {
      throw 'plain failure';
    });
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.errorDetail).toBe('plain failure');
    expect(outcome.errorCategory).toBe('internal');
  });
});
