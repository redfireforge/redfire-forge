import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_CALL_FAILED_ENVELOPE,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_REFLECTION_FAILED_ENVELOPE,
} from './contractFixtures';
import {
  deleteGrpcCall,
  getGrpcStatus,
  GrpcApiClientError,
  postGrpcCall,
  postGrpcDescribe,
  postGrpcReflect,
  setGrpcClientTransport,
} from './grpcApiClient';
import { httpFetch } from '../utils/httpClient';

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

describe('grpcApiClient (Phase 1E)', () => {
  beforeEach(() => {
    setGrpcClientTransport(null);
    vi.mocked(httpFetch).mockReset();
  });

  it('postGrpcReflect returns descriptor envelope on success', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const result = await postGrpcReflect({
      requestId: 'req-reflect-001',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    });

    expect(result.data.key).toBe(FIXTURE_REFLECT_SUCCESS_ENVELOPE.data.key);
    expect(result.data.services).toHaveLength(1);
  });

  it('postGrpcReflect throws GrpcApiClientError on failure envelope', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECTION_FAILED_ENVELOPE);

    await expect(postGrpcReflect({
      requestId: 'req-reflect-001',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('uses transport override when set', async () => {
    const transport = vi.fn(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);
    setGrpcClientTransport(transport);

    await postGrpcReflect({
      requestId: 'req-reflect-001',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    });

    expect(transport).toHaveBeenCalledWith(
      'reflect',
      '/api/grpc/reflect',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('postGrpcCall returns call result envelope on success', async () => {
    setGrpcClientTransport(async () => FIXTURE_HAPPY_CALL_ENVELOPE);

    const result = await postGrpcCall({
      callType: 'unary',
      requestId: 'req-unary-happy-001',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello grpc' },
      descriptorKey: 'fixture-echo-v1',
    }, 'grpc-tab-1');

    expect(result.data.body).toEqual({ message: 'hello grpc' });
    expect(result.data.status).toBe(0);
  });

  it('postGrpcCall throws GrpcApiClientError on failure envelope', async () => {
    setGrpcClientTransport(async () => FIXTURE_CALL_FAILED_ENVELOPE);

    await expect(postGrpcCall({
      callType: 'unary',
      requestId: 'req-unary-fail',
      target: { address: 'localhost:59999', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      descriptorKey: 'fixture-echo-v1',
    })).rejects.toBeInstanceOf(GrpcApiClientError);
  });

  it('preserves transport details on failure envelope (Phase 4G)', async () => {
    setGrpcClientTransport(async () => ({
      ok: false as const,
      op: 'call' as const,
      error: {
        code: 'GRPC_CALL_FAILED',
        category: 'call_failed',
        message: 'Access denied',
        details: { grpcStatus: 7, authFailure: 'auth_denied' },
      },
    }));

    try {
      await postGrpcCall({
        callType: 'unary',
        requestId: 'req-denied',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        descriptorKey: 'fixture-echo-v1',
      });
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(GrpcApiClientError);
      const clientError = error as GrpcApiClientError;
      expect(clientError.toErrorBody().details).toEqual({
        grpcStatus: 7,
        authFailure: 'auth_denied',
      });
    }
  });

  it('postGrpcCall includes tabId query when provided', async () => {
    const transport = vi.fn(async () => FIXTURE_HAPPY_CALL_ENVELOPE);
    setGrpcClientTransport(transport);

    await postGrpcCall({
      callType: 'unary',
      requestId: 'req-unary-happy-001',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      descriptorKey: 'fixture-echo-v1',
    }, 'tab-abc');

    expect(transport).toHaveBeenCalledWith(
      'call',
      '/api/grpc/call?tabId=tab-abc',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deleteGrpcCall returns cancel envelope on success', async () => {
    setGrpcClientTransport(async () => FIXTURE_CANCEL_SUCCESS_ENVELOPE);

    const result = await deleteGrpcCall('req-unary-happy-001', 'tab-abc');
    expect(result.data.cancelled).toBe(true);
  });

  it('deleteGrpcCall uses cancel op and tabId query', async () => {
    const transport = vi.fn(async () => FIXTURE_CANCEL_SUCCESS_ENVELOPE);
    setGrpcClientTransport(transport);

    await deleteGrpcCall('req-unary-happy-001', 'tab-abc');

    expect(transport).toHaveBeenCalledWith(
      'cancel',
      '/api/grpc/call/req-unary-happy-001?tabId=tab-abc',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('postGrpcDescribe dispatches describe op', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    const result = await postGrpcDescribe({
      requestId: 'req-describe-001',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      protoPath: '/path/to/echo.proto',
    });
    expect(result.data.services).toHaveLength(1);
  });

  it('getGrpcStatus builds query params', async () => {
    const transport = vi.fn(async () => ({
      ok: true as const,
      op: 'status' as const,
      data: { reachable: true, latencyMs: 12 },
    }));
    setGrpcClientTransport(transport);

    await getGrpcStatus({
      address: 'localhost:50051',
      tlsMode: 'disabled',
      timeoutMs: 5000,
    });

    expect(transport).toHaveBeenCalledWith(
      'status',
      expect.stringContaining('address=localhost%3A50051'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws GrpcApiClientError on network error via httpFetch path', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: '',
      error: 'network down',
      status: 0,
    });

    await expect(postGrpcReflect({
      requestId: 'req-net',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    })).rejects.toMatchObject({ code: 'GRPC_NETWORK_ERROR' });
  });

  it('throws on non-JSON httpFetch response', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: 'not json',
      status: 200,
    });

    await expect(postGrpcReflect({
      requestId: 'req-bad-json',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    })).rejects.toMatchObject({ code: 'GRPC_INVALID_ENVELOPE' });
  });

  it('throws on invalid envelope shape via httpFetch', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({ foo: 'bar' }),
      status: 200,
    });

    await expect(postGrpcReflect({
      requestId: 'req-bad-shape',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    })).rejects.toMatchObject({ code: 'GRPC_INVALID_ENVELOPE' });
  });

  it('throws on mismatched operation envelope via httpFetch', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        op: 'call',
        data: FIXTURE_HAPPY_CALL_ENVELOPE.data,
      }),
      status: 200,
    });

    await expect(postGrpcReflect({
      requestId: 'req-mismatch',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    })).rejects.toMatchObject({ code: 'GRPC_MISMATCHED_ENVELOPE' });
  });
});
