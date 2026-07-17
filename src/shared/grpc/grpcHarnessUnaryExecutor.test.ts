/**
 * Phase 8C — unary harness executor tests.
 */
import { describe, expect, it, vi } from 'vitest';
import { GrpcApiClientError } from './grpcApiClient';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { makeScenario as _makeScenario } from '../../test-utils/factories';
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
    id: 'grpc-1',
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
  return buildGrpcHarnessExecuteSnapshot(
    { scenario, requestId: 'req-unary' },
    CONTEXT,
  );
}

describe('executeGrpcHarnessUnary (Phase 8C)', () => {
  it('returns passed outcome on grpc status 0', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'hello' },
      durationMs: 12,
    }));
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.passed).toBe(true);
    expect(outcome.attempts).toBe(1);
    expect(outcome.grpcStatus).toBe(0);
    expect(invokeUnary).toHaveBeenCalledTimes(1);
  });

  it('retries retryable status codes then succeeds', async () => {
    const invokeUnary = vi
      .fn()
      .mockResolvedValueOnce({
        status: 14,
        statusMessage: 'UNAVAILABLE',
        headers: {},
        trailers: {},
        durationMs: 5,
      })
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 6,
      });
    const outcome = await executeGrpcHarnessUnary(
      makeUnarySnapshot({ maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] }),
      { invokeUnary },
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.attempts).toBe(2);
    expect(invokeUnary).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable grpc status', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      durationMs: 4,
    }));
    const outcome = await executeGrpcHarnessUnary(
      makeUnarySnapshot({ maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] }),
      { invokeUnary },
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.attempts).toBe(1);
    expect(invokeUnary).toHaveBeenCalledTimes(1);
  });

  it('aborts when abortSignal is already set', async () => {
    const invokeUnary = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      executeGrpcHarnessUnary(makeUnarySnapshot(), {
        invokeUnary,
        abortSignal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(invokeUnary).not.toHaveBeenCalled();
  });

  it('maps thrown GrpcApiClientError to failed outcome', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'INVALID_ARGUMENT', {
        details: { grpcStatus: 3, statusMessage: 'INVALID_ARGUMENT' },
      });
    });
    const outcome = await executeGrpcHarnessUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.passed).toBe(false);
    expect(outcome.grpcStatus).toBe(3);
  });
});
