import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GrpcApiClientError } from './grpcApiClient';
import { buildGrpcNodeOperations, resetBuildGrpcNodeOperationsForTests } from './buildGrpcNodeOperations';
import * as grpcTransportFacade from './grpcTransportFacade';
import { isTauri } from '../utils/platform';

const invokeGrpcUnaryMock = vi.fn();
const retainGrpcNativeTransportMock = vi.fn();

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => true),
  isNode: vi.fn(() => false),
}));

vi.mock('./grpcTransportFacade', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./grpcTransportFacade')>();
  return {
    ...actual,
    invokeGrpcUnary: (...args: unknown[]) => invokeGrpcUnaryMock(...args),
    retainGrpcNativeTransport: (...args: unknown[]) => retainGrpcNativeTransportMock(...args),
  };
});

describe('buildGrpcNodeOperations', () => {
  beforeEach(() => {
    resetAllMocks();
    grpcTransportFacade.resetGrpcNativeTransportRefCountForTests();
    grpcTransportFacade.setGrpcTransportMode(null);
    resetBuildGrpcNodeOperationsForTests();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  it('retains native transport only when selectGrpcTransport resolves to tauri', () => {
    grpcTransportFacade.setGrpcTransportMode('express');
    buildGrpcNodeOperations();
    expect(retainGrpcNativeTransportMock).not.toHaveBeenCalled();

    grpcTransportFacade.setGrpcTransportMode(null);
    buildGrpcNodeOperations();
    expect(retainGrpcNativeTransportMock).toHaveBeenCalledTimes(1);
  });

  it('does not retain native transport on web builds', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    buildGrpcNodeOperations();
    expect(retainGrpcNativeTransportMock).not.toHaveBeenCalled();
  });
  it('maps invokeGrpcUnary result into invokeUnary shape', async () => {
    invokeGrpcUnaryMock.mockResolvedValueOnce({
      ok: true,
      op: 'call',
      data: {
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'ok' },
        durationMs: 10,
      },
    });
    const ops = buildGrpcNodeOperations();
    const result = await ops.invokeUnary({
      requestId: 'req-1',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      descriptorKey: 'dk',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
    }, 'workflow:node-1');
    expect(result.status).toBe(0);
    expect(result.body).toEqual({ message: 'ok' });
  });

  it('propagates GrpcApiClientError from invokeGrpcUnary', async () => {
    invokeGrpcUnaryMock.mockRejectedValueOnce(new GrpcApiClientError('call', 'INVALID_ARGUMENT', {
      details: { grpcStatus: 3 },
    }));
    const ops = buildGrpcNodeOperations();
    await expect(ops.invokeUnary({
      requestId: 'req-1',
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
      descriptorKey: 'dk',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
    }, 'workflow:node-1')).rejects.toMatchObject({
      op: 'call',
      details: { grpcStatus: 3 },
    });
  });

  it('exposes Phase 11N resolveDescriptor and resolveLoadTestProfile', () => {
    const ops = buildGrpcNodeOperations();
    expect(typeof ops.resolveDescriptor).toBe('function');
    expect(typeof ops.resolveLoadTestProfile).toBe('function');
  });
});
