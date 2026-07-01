/**
 * Coverage gaps — grpcWorkflowUnaryExecutor.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
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

describe('grpcWorkflowUnaryExecutor coverage gaps', () => {
  it('wrapUnaryInvokeWithAbort passes through when abortSignal is omitted', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
    }));
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary);
    await wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
    expect(invokeUnary).toHaveBeenCalled();
  });

  it('wrapUnaryInvokeWithAbort rejects immediately when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const wrapped = wrapUnaryInvokeWithAbort(vi.fn(), controller.signal);
    await expect(wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('wrapUnaryInvokeWithAbort resolves when invoke completes before abort', async () => {
    const controller = new AbortController();
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { ok: true },
      durationMs: 1,
    }));
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary, controller.signal);
    await expect(wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1')).resolves.toMatchObject({ status: 0 });
  });

  it('wrapUnaryInvokeWithAbort rejects invoke errors and removes abort listener', async () => {
    const controller = new AbortController();
    const invokeUnary = vi.fn(async () => {
      throw new Error('invoke failed');
    });
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary, controller.signal);
    await expect(wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1')).rejects.toThrow('invoke failed');
  });

  it('returns failed step result when last invoke throws without grpcStatus details', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'transport down', { retryable: false });
    });
    const outcome = await executeGrpcWorkflowUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.stepResult.status).toBe('failed');
    expect(outcome.stepResult.grpcStatus).toBeUndefined();
    expect(outcome.stepResult.errorDetail).toBe('transport down');
  });

  it('returns failed step result for generic thrown errors', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new Error('boom');
    });
    const outcome = await executeGrpcWorkflowUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.stepResult.status).toBe('failed');
    expect(outcome.stepResult.errorDetail).toBe('boom');
  });

  it('uses statusMessage fallback when GrpcApiClientError lacks statusMessage detail', async () => {
    const invokeUnary = vi.fn(async () => {
      throw new GrpcApiClientError('call', 'RPC failed', {
        details: { grpcStatus: 13 },
      });
    });
    const outcome = await executeGrpcWorkflowUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.stepResult.grpcStatusMessage).toBe('RPC failed');
  });

  it('returns failed step result when lastError is a non-Error value', async () => {
    const invokeUnary = vi.fn(async () => {
      throw 'plain failure';
    });
    const outcome = await executeGrpcWorkflowUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.stepResult.errorDetail).toBe('plain failure');
  });

  it('ignores abort listener after invoke resolves successfully', async () => {
    const controller = new AbortController();
    const invokeUnary = vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { ok: true },
      durationMs: 1,
    }));
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary, controller.signal);
    await wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
    controller.abort();
    expect(invokeUnary).toHaveBeenCalledTimes(1);
  });

  it('onAbort returns early when invoke already settled', async () => {
    const controller = new AbortController();
    const cancelSpy = vi.spyOn(
      await import('../../../shared/grpc/grpcTransportFacade'),
      'cancelGrpcUnary',
    ).mockResolvedValue({
      ok: true,
      op: 'cancel',
      data: { requestId: FIXTURE_UNARY_CALL_REQUEST.requestId, cancelled: true },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', requestId: FIXTURE_UNARY_CALL_REQUEST.requestId },
    });
    const wrapped = wrapUnaryInvokeWithAbort(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
    }), controller.signal);
    await wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
    controller.abort();
    expect(cancelSpy).not.toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  it('sleeps between retry attempts when backoff is configured', async () => {
    const invokeUnary = vi
      .fn()
      .mockResolvedValueOnce({
        status: 14,
        statusMessage: 'UNAVAILABLE',
        headers: {},
        trailers: {},
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 2,
      });
    const snapshot = makeUnarySnapshot({ maxAttempts: 2, backoffMs: 1, retryOnStatuses: [14] });
    const outcome = await executeGrpcWorkflowUnary(snapshot, { invokeUnary });
    expect(outcome.attempts).toBe(2);
    expect(outcome.stepResult.status).toBe('success');
  });

  it('ignores late invoke resolution after abort already settled', async () => {
    const controller = new AbortController();
    let resolveInvoke!: (value: {
      status: number;
      statusMessage: string;
      headers: Record<string, string>;
      trailers: Record<string, string>;
      durationMs: number;
    }) => void;
    const invokeUnary = vi.fn(
      () => new Promise((resolve) => {
        resolveInvoke = resolve;
      }),
    );
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary, controller.signal);
    const pending = wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    resolveInvoke({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      durationMs: 1,
    });
  });

  it('wrapUnaryInvokeWithAbort rejects invoke errors when abort has not fired', async () => {
    const controller = new AbortController();
    const wrapped = wrapUnaryInvokeWithAbort(
      vi.fn(async () => {
        throw new Error('invoke failed');
      }),
      controller.signal,
    );
    await expect(wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1')).rejects.toThrow('invoke failed');
  });

  it('uses statusMessage when failed unary result has no errorDetail', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: {},
      trailers: {},
      durationMs: 4,
    }));
    const outcome = await executeGrpcWorkflowUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.stepResult.errorDetail).toBe('INVALID_ARGUMENT');
  });

  it('returns default failure message when lastError is nullish', async () => {
    const invokeUnary = vi.fn(async () => {
      throw null;
    });
    const outcome = await executeGrpcWorkflowUnary(makeUnarySnapshot(), { invokeUnary });
    expect(outcome.stepResult.errorDetail).toBe('Unary call failed');
  });

  it('ignores invoke rejection after abort has already settled the wrapper', async () => {
    const controller = new AbortController();
    const invokeUnary = vi.fn(
      () => new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('late fail')), 30);
      }),
    );
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary, controller.signal);
    const pending = wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
    setTimeout(() => controller.abort(), 5);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('swallows cancelGrpcUnary failures during abort handling', async () => {
    const cancelSpy = vi.spyOn(
      await import('../../../shared/grpc/grpcTransportFacade'),
      'cancelGrpcUnary',
    ).mockRejectedValue(new Error('cancel failed'));
    const controller = new AbortController();
    const invokeUnary = vi.fn(() => new Promise<never>(() => {}));
    const wrapped = wrapUnaryInvokeWithAbort(invokeUnary, controller.signal);
    const pending = wrapped(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
