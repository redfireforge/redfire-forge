import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR_CONTENT_SHA,
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

describe('grpcNativeTauriTransport', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('routes grpc_unary invoke with request payload', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'unary',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 12,
        transportUsed: 'tauri',
        requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    const request = toGrpcTauriUnaryRequest(
      FIXTURE_UNARY_CALL_REQUEST,
      'tab-1',
      {
        descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
        protosetBase64: 'abc',
        contentSha256: FIXTURE_DESCRIPTOR_CONTENT_SHA,
      },
    );

    const result = await invokeGrpcUnaryNative(request);
    expect(invokeMock).toHaveBeenCalledWith('grpc_unary', { request });
    expect(result.transportUsed).toBe('tauri');
    expect(mapGrpcTauriUnaryResultToCallResult(result).body).toEqual({ message: 'hello' });
  });

  it('throws GrpcNativeTauriTransportError on error envelope', async () => {
    invokeMock.mockResolvedValue({
      ok: false,
      op: 'unary',
      error: {
        code: 'GRPC_TAURI_CHANNEL_BUILD',
        message: 'channel failed',
        retryable: true,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    await expect(
      invokeGrpcUnaryNative(
        toGrpcTauriUnaryRequest(FIXTURE_UNARY_CALL_REQUEST, 'tab-1', {
          descriptorKey: 'k',
          protosetBase64: 'abc',
          contentSha256: 'deadbeef',
        }),
      ),
    ).rejects.toMatchObject({
      name: 'GrpcNativeTauriTransportError',
      code: 'GRPC_TAURI_CHANNEL_BUILD',
    });
  });

  it('maps cancel result to GrpcCancelCallResult shape', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      op: 'call_cancel',
      data: {
        requestId: 'req-1',
        cancelled: true,
      },
      meta: { timestamp: '2026-06-30T00:00:00.000Z', schemaVersion: GRPC_TAURI_SCHEMA_VERSION },
    });

    const result = await invokeGrpcCallCancelNative(
      toGrpcTauriCallCancelRequest('req-1', 'tab-1'),
    );

    expect(invokeMock).toHaveBeenCalledWith('grpc_call_cancel', {
      request: {
        schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
        requestId: 'req-1',
        tabId: 'tab-1',
      },
    });
    expect(mapGrpcTauriCancelResultToCallCancel(result)).toEqual({
      requestId: 'req-1',
      cancelled: true,
      alreadyCompleted: undefined,
    });
  });

  it('wraps invoke IPC failures', async () => {
    invokeMock.mockRejectedValue(new Error('IPC down'));
    await expect(
      invokeGrpcCallCancelNative(toGrpcTauriCallCancelRequest('req-1', 'tab-1')),
    ).rejects.toBeInstanceOf(GrpcNativeTauriTransportError);
  });
});
