/**
 * Coverage gaps — grpcNativeTauriTransport.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import {
  GrpcNativeTauriTransportError,
  invokeGrpcCallCancelNative,
  invokeGrpcUnaryNative,
  mapGrpcTauriCancelResultToCallCancel,
  mapGrpcTauriUnaryResultToCallResult,
  toGrpcTauriCallCancelRequest,
  toGrpcTauriUnaryRequest,
} from './grpcNativeTauriTransport';
import { GRPC_TAURI_SCHEMA_VERSION } from './grpcTauriContracts';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe('grpcNativeTauriTransport coverage gaps', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('wraps unary invoke IPC failures with retryable transport error', async () => {
    invokeMock.mockRejectedValue(new Error('IPC down'));
    await expect(
      invokeGrpcUnaryNative(toGrpcTauriUnaryRequest(
        FIXTURE_UNARY_CALL_REQUEST,
        'tab-1',
        {
          descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
          protosetBase64: 'abc',
          contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
        },
      )),
    ).rejects.toMatchObject({
      name: 'GrpcNativeTauriTransportError',
      op: 'unary',
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  });

  it('wraps non-Error invoke failures as strings', async () => {
    invokeMock.mockRejectedValue('ipc string failure');
    await expect(
      invokeGrpcCallCancelNative(toGrpcTauriCallCancelRequest('req-1', 'tab-1')),
    ).rejects.toMatchObject({
      name: 'GrpcNativeTauriTransportError',
      message: 'ipc string failure',
    });
  });

  it('uses default error code and retryable=false on envelope errors', async () => {
    invokeMock.mockResolvedValue({
      ok: false,
      op: 'call_cancel',
      error: { message: 'cancel failed' },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    await expect(
      invokeGrpcCallCancelNative(toGrpcTauriCallCancelRequest('req-1', 'tab-1')),
    ).rejects.toMatchObject({
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: false,
    });
  });

  it('mapGrpcTauriUnaryResultToCallResult preserves errorDetail', () => {
    expect(mapGrpcTauriUnaryResultToCallResult({
      callType: 'unary',
      status: 3,
      statusMessage: 'INVALID_ARGUMENT',
      headers: { h: '1' },
      trailers: { t: '2' },
      body: { message: 'bad' },
      durationMs: 4,
      errorDetail: 'detail text',
      transportUsed: 'tauri',
      requestId: 'req-1',
    })).toMatchObject({
      status: 3,
      errorDetail: 'detail text',
      body: { message: 'bad' },
    });
  });

  it('mapGrpcTauriCancelResultToCallCancel preserves alreadyCompleted', () => {
    expect(mapGrpcTauriCancelResultToCallCancel({
      requestId: 'req-1',
      cancelled: false,
      alreadyCompleted: true,
    })).toEqual({
      requestId: 'req-1',
      cancelled: false,
      alreadyCompleted: true,
    });
  });

  it('GrpcNativeTauriTransportError exposes op and custom code', () => {
    const error = new GrpcNativeTauriTransportError('unary', 'boom', {
      code: 'CUSTOM',
      retryable: true,
    });
    expect(error.name).toBe('GrpcNativeTauriTransportError');
    expect(error.op).toBe('unary');
    expect(error.code).toBe('CUSTOM');
    expect(error.retryable).toBe(true);
  });

  it('GrpcNativeTauriTransportError defaults code and retryable when options omitted', () => {
    const error = new GrpcNativeTauriTransportError('call_cancel', 'cancel failed');
    expect(error.code).toBe('GRPC_TAURI_INVOKE_ERROR');
    expect(error.retryable).toBe(false);
  });

  it('wraps unary invoke non-Error IPC failures as strings', async () => {
    invokeMock.mockRejectedValue('unary ipc string failure');
    await expect(
      invokeGrpcUnaryNative(toGrpcTauriUnaryRequest(
        FIXTURE_UNARY_CALL_REQUEST,
        'tab-1',
        {
          descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
          protosetBase64: 'abc',
          contentSha256: FIXTURE_TAURI_PROTOSET_CONTENT_SHA256,
        },
      )),
    ).rejects.toMatchObject({ message: 'unary ipc string failure' });
  });
});
