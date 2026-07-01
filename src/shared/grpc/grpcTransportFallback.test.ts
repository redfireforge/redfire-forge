import { beforeEach, describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { GrpcNativeTauriStreamTransportError } from './grpcNativeTauriStreamTransport';
import { GrpcNativeTauriTransportError } from './grpcNativeTauriTransport';
import {
  bindGrpcStreamTransportForTab,
  clearGrpcStreamTransportBinding,
  getGrpcStreamTransportBinding,
  grpcApiErrorToExpressFallbackBody,
  hasGrpcStreamTransportBinding,
  isGrpcExpressFallbackOffered,
  isGrpcNativePreflightFailure,
  resetGrpcStreamTransportBindingsForTests,
  withGrpcExpressFallbackOffer,
} from './grpcTransportFallback';

describe('grpcTransportFallback (Phase 7F)', () => {
  beforeEach(() => {
    resetGrpcStreamTransportBindingsForTests();
  });

  it('detects native transport preflight failures', () => {
    expect(isGrpcNativePreflightFailure(
      new GrpcNativeTauriTransportError('call', 'invoke failed'),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcNativeTauriStreamTransportError('stream_start', 'invoke failed'),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'unreachable', {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
      }),
    )).toBe(true);
    expect(isGrpcNativePreflightFailure(
      new GrpcApiClientError('call', 'cancelled', {
        code: GRPC_ERROR_CODES.CANCELLED,
      }),
    )).toBe(false);
  });

  it('offers express fallback on native preflight API errors', () => {
    const body = grpcApiErrorToExpressFallbackBody(
      new GrpcApiClientError('call', 'native invoke failed', {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
      }),
    );
    expect(isGrpcExpressFallbackOffered(body)).toBe(true);
    expect(body.details).toMatchObject({
      expressFallbackOffered: true,
      transportAttempted: 'tauri',
    });
  });

  it('withGrpcExpressFallbackOffer sets retryable metadata', () => {
    const body = withGrpcExpressFallbackOffer(
      { code: 'X', message: 'failed' },
      'native invoke failed',
    );
    expect(body.retryable).toBe(true);
    expect(body.details).toMatchObject({
      expressFallbackOffered: true,
      fallbackReason: 'native invoke failed',
    });
  });

  it('binds and clears stream transport per tab', () => {
    bindGrpcStreamTransportForTab('tab-1', 'tauri');
    expect(hasGrpcStreamTransportBinding('tab-1')).toBe(true);
    expect(getGrpcStreamTransportBinding('tab-1')).toBe('tauri');
    clearGrpcStreamTransportBinding('tab-1');
    expect(hasGrpcStreamTransportBinding('tab-1')).toBe(false);
  });
});
