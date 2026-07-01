import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { GrpcNativeTauriTransportError } from './grpcNativeTauriTransport';
import {
  isGrpcExpressFallbackOffered,
  isGrpcNativePreflightFailure,
  withGrpcExpressFallbackOffer,
} from './grpcTransportFallback';

describe('grpcTransportFallback coverage gaps', () => {
  it('isGrpcNativePreflightFailure rejects grpc-status API errors and cancellation', () => {
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'status', {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        details: { grpcStatus: 14 },
      }),
    )).toBe(false);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'invalid descriptor', {
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      }),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'invalid request', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
      }),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'not found', {
        code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
      }),
    )).toBe(false);
    expect(isGrpcNativePreflightFailure(new Error('generic'))).toBe(false);
    expect(isGrpcNativePreflightFailure(
      new GrpcNativeTauriTransportError('unary', 'native'),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'native invoke failed', {
        code: GRPC_ERROR_CODES.CALL_FAILED,
      }),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'rpc failed', {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        details: { grpcStatus: 14 },
      }),
    )).toBe(false);
  });

  it('isGrpcExpressFallbackOffered handles missing or false details', () => {
    expect(isGrpcExpressFallbackOffered(undefined)).toBe(false);
    expect(isGrpcExpressFallbackOffered({ code: 'X', message: 'm' })).toBe(false);
    expect(isGrpcExpressFallbackOffered({
      code: 'X',
      message: 'm',
      details: { expressFallbackOffered: false },
    })).toBe(false);
    expect(isGrpcExpressFallbackOffered({
      code: 'X',
      message: 'm',
      details: { expressFallbackOffered: true },
    })).toBe(true);
  });

  it('withGrpcExpressFallbackOffer merges prior details and custom transport', () => {
    const body = withGrpcExpressFallbackOffer(
      { code: 'X', message: 'failed', details: { prior: true } },
      'reason',
      'express',
    );
    expect(body.details).toMatchObject({
      prior: true,
      expressFallbackOffered: true,
      fallbackReason: 'reason',
      transportAttempted: 'express',
    });
  });

  it('isGrpcNativePreflightFailure handles CALL_FAILED and INVALID_TARGET codes', () => {
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'call failed', {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        details: { grpcStatus: 13 },
      }),
    )).toBe(false);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'call failed', {
        code: GRPC_ERROR_CODES.CALL_FAILED,
      }),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'bad target', {
        code: GRPC_ERROR_CODES.INVALID_TARGET,
      }),
    )).toBe(true);
  });
});
