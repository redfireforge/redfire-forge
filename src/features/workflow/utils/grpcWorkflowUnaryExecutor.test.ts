import { describe, expect, it, vi } from 'vitest';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import * as grpcTransportFacade from '@shared/grpc/grpcTransportFacade';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import { buildGrpcWorkflowExecuteSnapshot } from './grpcWorkflowSnapshotBuilder';
import { executeGrpcWorkflowUnary, wrapUnaryInvokeWithAbort } from './grpcWorkflowUnaryExecutor';

const context = {
  resolveTemplate: (value: string) => value,
  profiles: [],
  pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
};

function makeUnarySnapshot(retry?: { maxAttempts: number; backoffMs: number; retryOnStatuses?: number[] }) {
  return buildGrpcWorkflowExecuteSnapshot(
    {
      nodeId: 'grpc-unary',
      requestId: 'req-unary',
      data: {
        label: 'Echo',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        callType: 'unary' as const,
        body: { message: 'hello' },
        retry,
      },
    },
    context,
  );
}

describe('executeGrpcWorkflowUnary', () => {
  it('returns success on grpc status 0', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'hello' },
      durationMs: 12,
    }));
    const snapshot = makeUnarySnapshot();
    const outcome = await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(outcome.attempts).toBe(1);
    expect(outcome.stepResult.status).toBe('success');
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
    const snapshot = makeUnarySnapshot({ maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] });
    const outcome = await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(outcome.attempts).toBe(2);
    expect(outcome.stepResult.status).toBe('success');
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
    const snapshot = makeUnarySnapshot({ maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] });
    const outcome = await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(outcome.attempts).toBe(1);
    expect(outcome.stepResult.status).toBe('failed');
    expect(invokeUnary).toHaveBeenCalledTimes(1);
  });

  it('captures grpcStatus from thrown GrpcApiClientError for failed step result', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'INVALID_ARGUMENT', {
        details: { grpcStatus: 3, statusMessage: 'INVALID_ARGUMENT' },
      });
    });
    const snapshot = makeUnarySnapshot();
    const outcome = await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(outcome.stepResult.status).toBe('failed');
    expect(outcome.stepResult.grpcStatus).toBe(3);
    expect(outcome.stepResult.grpcStatusMessage).toBe('INVALID_ARGUMENT');
  });

  it('retries when invokeUnary throws retryable grpc status error', async () => {
    const invokeUnary = vi
      .fn()
      .mockRejectedValueOnce(new GrpcApiClientError('call', 'UNAVAILABLE', {
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
    const snapshot = makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] });
    const outcome = await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(outcome.attempts).toBe(2);
    expect(outcome.stepResult.status).toBe('success');
  });

  it('retries retryable transport errors', async () => {
    const invokeUnary = vi
      .fn()
      .mockRejectedValueOnce(new GrpcApiClientError('call', 'unavailable', { retryable: true }))
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 6,
      });
    const snapshot = makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0 });
    const outcome = await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(outcome.attempts).toBe(2);
    expect(outcome.stepResult.status).toBe('success');
  });

  it('reuses identical frozen transport payload across retry attempts', async () => {
    const payloads: string[] = [];
    const invokeUnary = vi.fn(async (request) => {
      payloads.push(JSON.stringify(request));
      if (payloads.length === 1) {
        return {
          status: 14,
          statusMessage: 'UNAVAILABLE',
          headers: {},
          trailers: {},
          durationMs: 1,
        };
      }
      return {
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 2,
      };
    });
    const snapshot = makeUnarySnapshot({ maxAttempts: 2, backoffMs: 0, retryOnStatuses: [14] });
    await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toBe(payloads[1]);
  });

  it('throws AbortError when abortSignal is already aborted', async () => {
    const snapshot = makeUnarySnapshot({ maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] });
    const controller = new AbortController();
    controller.abort();
    await expect(executeGrpcWorkflowUnary(snapshot, {
      invokeUnary: vi.fn(),
      abortSignal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws AbortError during retry backoff sleep', async () => {
    const controller = new AbortController();
    const invokeUnary = vi.fn(async () => ({
      status: 14,
      statusMessage: 'UNAVAILABLE',
      headers: {},
      trailers: {},
      durationMs: 1,
    }));
    const snapshot = makeUnarySnapshot({ maxAttempts: 3, backoffMs: 50, retryOnStatuses: [14] });
    const pending = executeGrpcWorkflowUnary(snapshot, {
      invokeUnary,
      abortSignal: controller.signal,
    });
    await new Promise((r) => setTimeout(r, 5));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(invokeUnary).toHaveBeenCalledTimes(1);
  });
});

describe('wrapUnaryInvokeWithAbort', () => {
  it('cancels in-flight unary when abortSignal fires', async () => {
    const cancelSpy = vi.spyOn(grpcTransportFacade, 'cancelGrpcUnary').mockResolvedValue({
      ok: true,
      op: 'cancel',
      data: { requestId: FIXTURE_UNARY_CALL_REQUEST.requestId, cancelled: true },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });
    const controller = new AbortController();
    const invokeUnary = vi.fn((_request, _tabId) => new Promise<never>(() => {}));
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary, controller.signal);

    const pending = wrapped(FIXTURE_UNARY_CALL_REQUEST, 'workflow:node-1');
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelSpy).toHaveBeenCalledWith(FIXTURE_UNARY_CALL_REQUEST.requestId, 'workflow:node-1');
    cancelSpy.mockRestore();
  });
});
