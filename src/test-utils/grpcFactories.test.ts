import { describe, expect, it } from 'vitest';
import { makeGrpcSavedRequest, GRPC_TEST_TIMESTAMP } from './grpcFactories';

describe('grpcFactories', () => {
  it('makeGrpcSavedRequest builds a valid default saved request', () => {
    const saved = makeGrpcSavedRequest('sr-42');
    expect(saved.id).toBe('sr-42');
    expect(saved.createdAt).toBe(GRPC_TEST_TIMESTAMP);
    expect(saved.name).toBe('echo.EchoService/Echo');
    expect(saved.callType).toBe('unary');
    expect(saved.service).toBe('echo.EchoService');
    expect(saved.method).toBe('Echo');
    expect(saved.timeoutMs).toBe(30_000);
  });

  it('makeGrpcSavedRequest accepts overrides', () => {
    const saved = makeGrpcSavedRequest('sr-x', {
      name: 'Custom',
      service: 'alpha.Service',
      method: 'Beta',
      callType: 'server_streaming',
      body: { message: 'hi' },
    });
    expect(saved.name).toBe('Custom');
    expect(saved.service).toBe('alpha.Service');
    expect(saved.method).toBe('Beta');
    expect(saved.callType).toBe('server_streaming');
    expect(saved.body).toEqual({ message: 'hi' });
  });
});
