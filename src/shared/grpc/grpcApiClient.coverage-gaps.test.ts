import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
  FIXTURE_HAPPY_CALL_ENVELOPE,
} from './contractFixtures';
import {
  deleteGrpcCall,
  getGrpcStatus,
  GrpcApiClientError,
  postGrpcCall,
  postGrpcExportProtoset,
  postGrpcReflect,
  setGrpcClientTransport,
} from './grpcApiClient';
import { httpFetch } from '../utils/httpClient';

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

describe('grpcApiClient coverage gaps', () => {
  beforeEach(() => {
    setGrpcClientTransport(null);
    vi.mocked(httpFetch).mockReset();
  });

  it('GrpcApiClientError defaults and toErrorBody include optional fields', () => {
    const detailed = new GrpcApiClientError('call', 'Access denied', {
      code: 'GRPC_CALL_FAILED',
      retryable: true,
      category: 'call_failed',
      details: { grpcStatus: 7 },
    });
    expect(detailed.code).toBe('GRPC_CALL_FAILED');
    expect(detailed.retryable).toBe(true);
    expect(detailed.toErrorBody()).toEqual({
      code: 'GRPC_CALL_FAILED',
      category: 'call_failed',
      message: 'Access denied',
      retryable: true,
      details: { grpcStatus: 7 },
    });

    const minimal = new GrpcApiClientError('reflect', 'failed');
    expect(minimal.code).toBe('GRPC_CLIENT_ERROR');
    expect(minimal.retryable).toBe(false);
    expect(minimal.toErrorBody()).toEqual({
      code: 'GRPC_CLIENT_ERROR',
      category: expect.any(String),
      message: 'failed',
      retryable: false,
    });
  });

  it('uses fallback code and message when failure envelope fields are blank', async () => {
    setGrpcClientTransport(async () => ({
      ok: false as const,
      op: 'reflect' as const,
      error: { code: '  ', message: '  ' },
    }));

    await expect(postGrpcReflect({
      requestId: 'req-blank-error',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    })).rejects.toMatchObject({
      code: 'GRPC_CLIENT_ERROR',
      message: 'gRPC reflect failed (GRPC_CLIENT_ERROR)',
    });
  });

  it('deleteGrpcCall omits tabId query when not provided', async () => {
    const transport = vi.fn(async () => FIXTURE_CANCEL_SUCCESS_ENVELOPE);
    setGrpcClientTransport(transport);

    await deleteGrpcCall('req-no-tab');

    expect(transport).toHaveBeenCalledWith(
      'cancel',
      '/api/grpc/call/req-no-tab',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('postGrpcCall omits tabId query when not provided', async () => {
    const transport = vi.fn(async () => FIXTURE_HAPPY_CALL_ENVELOPE);
    setGrpcClientTransport(transport);

    await postGrpcCall({
      callType: 'unary',
      requestId: 'req-no-tab',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      descriptorKey: 'fixture-echo-v1',
    });

    expect(transport).toHaveBeenCalledWith(
      'call',
      '/api/grpc/call',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('postGrpcExportProtoset dispatches export_protoset op', async () => {
    const transport = vi.fn(async () => ({
      ok: true as const,
      op: 'export_protoset' as const,
      data: { protosetBase64: 'abc', fileName: 'schema.pb' },
    }));
    setGrpcClientTransport(transport);

    const result = await postGrpcExportProtoset({
      requestId: 'req-export',
      descriptorKey: 'desc-1',
    });

    expect(result.data.fileName).toBe('schema.pb');
    expect(transport).toHaveBeenCalledWith(
      'export_protoset',
      '/api/grpc/export-protoset',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('getGrpcStatus uses httpFetch GET without Content-Type body', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        op: 'status',
        data: { reachable: true, latencyMs: 4 },
      }),
      status: 200,
    });

    await getGrpcStatus({ address: 'localhost:50051' });

    expect(httpFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/grpc/status?address=localhost%3A50051'),
      'GET',
      { Accept: 'application/json' },
      undefined,
    );
  });

  it('transport override propagates failure envelopes', async () => {
    setGrpcClientTransport(async () => ({
      ok: false as const,
      op: 'reflect' as const,
      error: {
        code: 'REFLECTION_FAILED',
        message: 'upstream unavailable',
        retryable: true,
      },
    }));

    await expect(postGrpcReflect({
      requestId: 'req-transport-fail',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    })).rejects.toMatchObject({
      code: 'REFLECTION_FAILED',
      retryable: true,
    });
  });
});
