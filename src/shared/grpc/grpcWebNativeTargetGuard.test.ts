import { describe, expect, it } from 'vitest';
import {
  assertBrowserDirectTargetAllowsFetch,
  extractHostPortFromGrpcAddress,
  isNativeGrpcOnlyTargetAddress,
} from './grpcWebNativeTargetGuard';
import { extractBrowserTransportFailure } from './grpcBrowserTransportErrorMapper';

describe('grpcWebNativeTargetGuard', () => {
  it('parses host:port and bracketed IPv6 addresses', () => {
    expect(extractHostPortFromGrpcAddress('localhost:50051')).toEqual({
      host: 'localhost',
      port: '50051',
    });
    expect(extractHostPortFromGrpcAddress('[::1]:9090')).toEqual({
      host: '::1',
      port: '9090',
    });
    expect(extractHostPortFromGrpcAddress('not-a-target')).toBeNull();
  });

  it('flags native-only demo ports and allows Envoy', () => {
    expect(isNativeGrpcOnlyTargetAddress('localhost:50051')).toBe(true);
    expect(isNativeGrpcOnlyTargetAddress('127.0.0.1:9090')).toBe(true);
    expect(isNativeGrpcOnlyTargetAddress('not-a-target')).toBe(false);
    expect(isNativeGrpcOnlyTargetAddress('localhost:50055')).toBe(false);
    expect(isNativeGrpcOnlyTargetAddress('localhost:8081')).toBe(false);
  });

  it('blocks browser-direct fetch with Express-retryable protocol_mismatch', () => {
    const error = assertBrowserDirectTargetAllowsFetch('call', 'grpc-web', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    });
    expect(error).toBeTruthy();
    const details = extractBrowserTransportFailure(error!.toErrorBody());
    expect(details?.browserTransportFailure).toBe('protocol_mismatch');
    expect(details?.suggestExpressProxy).toBe(true);
    expect(
      assertBrowserDirectTargetAllowsFetch('call', 'grpc-web', {
        address: 'localhost:50055',
        tlsMode: 'disabled',
      }),
    ).toBeUndefined();

    const springError = assertBrowserDirectTargetAllowsFetch('call', 'spring-servlet', {
      address: 'localhost:50052',
      tlsMode: 'disabled',
    });
    expect(springError?.message).toContain('Spring Servlet');
  });
});
