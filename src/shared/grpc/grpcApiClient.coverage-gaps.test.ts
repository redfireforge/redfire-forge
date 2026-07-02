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

  it('getGrpcK8sPortForwardStatus requests scoped status endpoint', async () => {
    const { getGrpcK8sPortForwardStatus } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        data: { scopeId: 'tab-1', active: false },
      }),
      status: 200,
    });

    const status = await getGrpcK8sPortForwardStatus('tab-1');
    expect(status.scopeId).toBe('tab-1');
    expect(httpFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/grpc/k8s-port-forward/status?scopeId=tab-1'),
      'GET',
      { Accept: 'application/json' },
      undefined,
    );
  });

  it('postGrpcK8sPortForwardStart posts scoped config payload', async () => {
    const { postGrpcK8sPortForwardStart } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        data: { scopeId: 'tab-1', active: true, pid: 42 },
      }),
      status: 200,
    });

    const state = await postGrpcK8sPortForwardStart('tab-1', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    });
    expect(state.pid).toBe(42);
    expect(httpFetch).toHaveBeenCalledWith(
      '/api/grpc/k8s-port-forward/start',
      'POST',
      expect.objectContaining({ 'Content-Type': 'application/json' }),
      expect.stringContaining('echo'),
    );
  });

  it('getGrpcK8sPortForwardLogs includes afterSeq when provided', async () => {
    const { getGrpcK8sPortForwardLogs } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        data: { scopeId: 'tab-1', lines: [], latestSeq: 3 },
      }),
      status: 200,
    });

    await getGrpcK8sPortForwardLogs('tab-1', 2);
    expect(httpFetch).toHaveBeenCalledWith(
      expect.stringContaining('afterSeq=2'),
      'GET',
      { Accept: 'application/json' },
    );
  });

  it('postGrpcK8sPortForwardStop posts scoped stop payload', async () => {
    const { postGrpcK8sPortForwardStop } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        data: { scopeId: 'tab-1', active: false },
      }),
      status: 200,
    });

    const state = await postGrpcK8sPortForwardStop('tab-1');
    expect(state.active).toBe(false);
    expect(httpFetch).toHaveBeenCalledWith(
      '/api/grpc/k8s-port-forward/stop',
      'POST',
      expect.objectContaining({ 'Content-Type': 'application/json' }),
      JSON.stringify({ scopeId: 'tab-1' }),
    );
  });

  it('postGrpcK8sPortForwardClearLogs clears scoped kubectl logs', async () => {
    const { postGrpcK8sPortForwardClearLogs } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        data: { scopeId: 'tab-1', latestSeq: 9 },
      }),
      status: 200,
    });

    const cleared = await postGrpcK8sPortForwardClearLogs('tab-1');
    expect(cleared.latestSeq).toBe(9);
  });

  it('omits afterSeq query when value is not finite', async () => {
    const { getGrpcK8sPortForwardLogs } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({
        ok: true,
        data: { scopeId: 'tab-1', lines: [], latestSeq: 0 },
      }),
      status: 200,
    });

    await getGrpcK8sPortForwardLogs('tab-1', Number.NaN);
    expect(httpFetch).toHaveBeenCalledWith(
      expect.not.stringContaining('afterSeq'),
      'GET',
      { Accept: 'application/json' },
    );
  });

  it('maps K8s automation network errors', async () => {
    const { getGrpcK8sPortForwardStatus } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({ body: '', status: 0, error: 'offline' });
    await expect(getGrpcK8sPortForwardStatus('tab-1')).rejects.toMatchObject({
      code: 'GRPC_NETWORK_ERROR',
      retryable: true,
    });
  });

  it('maps K8s automation non-JSON responses', async () => {
    const { postGrpcK8sPortForwardStart } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({ body: '<html>', status: 200 });
    await expect(postGrpcK8sPortForwardStart('tab-1', {
      namespace: 'default',
      targetType: 'service',
      name: 'echo',
      remotePort: 50051,
      localPort: 50051,
      context: '',
    })).rejects.toMatchObject({ code: 'GRPC_INVALID_ENVELOPE' });
  });

  it('maps invalid K8s automation envelopes', async () => {
    const { getGrpcK8sPortForwardStatus } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({ body: '{}', status: 200 });
    await expect(getGrpcK8sPortForwardStatus('tab-1')).rejects.toMatchObject({
      code: 'GRPC_INVALID_ENVELOPE',
    });
  });

  it('maps failed K8s automation ok:false responses', async () => {
    const { postGrpcK8sPortForwardStop } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({ ok: false, error: 'scope missing' }),
      status: 200,
    });
    await expect(postGrpcK8sPortForwardStop('tab-1')).rejects.toMatchObject({
      code: 'GRPC_K8S_AUTOMATION_FAILED',
      message: 'scope missing',
    });
  });

  it('maps K8s logs network, invalid envelope, and failed responses', async () => {
    const { getGrpcK8sPortForwardLogs } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({ body: '', status: 0, error: 'offline' });
    await expect(getGrpcK8sPortForwardLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_NETWORK_ERROR',
    });

    vi.mocked(httpFetch).mockResolvedValueOnce({ body: 'not-json', status: 200 });
    await expect(getGrpcK8sPortForwardLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_INVALID_ENVELOPE',
    });

    vi.mocked(httpFetch).mockResolvedValueOnce({ body: JSON.stringify({ ok: true }), status: 200 });
    await expect(getGrpcK8sPortForwardLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_K8S_AUTOMATION_FAILED',
    });

    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({ ok: false, error: 'logs unavailable' }),
      status: 200,
    });
    await expect(getGrpcK8sPortForwardLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_K8S_AUTOMATION_FAILED',
    });
  });

  it('maps K8s log clear network, invalid envelope, and failed responses', async () => {
    const { postGrpcK8sPortForwardClearLogs } = await import('./grpcApiClient');
    vi.mocked(httpFetch).mockResolvedValueOnce({ body: '', status: 0, error: 'offline' });
    await expect(postGrpcK8sPortForwardClearLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_NETWORK_ERROR',
    });

    vi.mocked(httpFetch).mockResolvedValueOnce({ body: 'not-json', status: 200 });
    await expect(postGrpcK8sPortForwardClearLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_INVALID_ENVELOPE',
    });

    vi.mocked(httpFetch).mockResolvedValueOnce({ body: JSON.stringify({ ok: true }), status: 200 });
    await expect(postGrpcK8sPortForwardClearLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_K8S_AUTOMATION_FAILED',
    });

    vi.mocked(httpFetch).mockResolvedValueOnce({
      body: JSON.stringify({ ok: false }),
      status: 200,
    });
    await expect(postGrpcK8sPortForwardClearLogs('tab-1')).rejects.toMatchObject({
      code: 'GRPC_K8S_AUTOMATION_FAILED',
      message: 'gRPC K8s log clear failed',
    });
  });
});
