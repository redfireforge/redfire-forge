import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { GrpcNativeTauriTransportError } from './grpcNativeTauriTransport';
import { GRPC_TAURI_ERROR_CODES } from './grpcTauriContracts';
import {
  mapTauriErrorCodeToExpress,
  toGrpcApiClientErrorFromDescriptorPrepare,
  toGrpcApiClientErrorFromNative,
  toGrpcApiClientErrorFromUnaryResult,
} from './grpcTauriErrorMapping';

describe('grpcTauriErrorMapping', () => {
  it('maps cancel not-found to GRPC_REQUEST_NOT_FOUND', () => {
    expect(mapTauriErrorCodeToExpress(GRPC_TAURI_ERROR_CODES.REQUEST_NOT_FOUND)).toBe(
      GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
    );
  });

  it('maps tab ownership errors to GRPC_INVALID_REQUEST', () => {
    expect(mapTauriErrorCodeToExpress(GRPC_TAURI_ERROR_CODES.INVALID_REQUEST)).toBe(
      GRPC_ERROR_CODES.INVALID_REQUEST,
    );
    expect(mapTauriErrorCodeToExpress(GRPC_TAURI_ERROR_CODES.STREAM_OWNERSHIP)).toBe(
      GRPC_ERROR_CODES.INVALID_REQUEST,
    );
  });

  it('maps descriptor pool decode failures to GRPC_INVALID_DESCRIPTOR', () => {
    expect(
      mapTauriErrorCodeToExpress(
        GRPC_TAURI_ERROR_CODES.INVALID_REQUEST,
        'Failed to build descriptor pool: corrupt FileDescriptorSet',
      ),
    ).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
  });

  it('maps descriptor integrity code to GRPC_INVALID_DESCRIPTOR', () => {
    expect(
      mapTauriErrorCodeToExpress(GRPC_TAURI_ERROR_CODES.DESCRIPTOR_INTEGRITY),
    ).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
  });

  it('maps missing target address to GRPC_INVALID_TARGET', () => {
    expect(
      mapTauriErrorCodeToExpress(
        GRPC_TAURI_ERROR_CODES.INVALID_REQUEST,
        'target.address is required',
      ),
    ).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
  });

  it('maps invalid protoset base64 to GRPC_INVALID_DESCRIPTOR', () => {
    expect(
      mapTauriErrorCodeToExpress(
        GRPC_TAURI_ERROR_CODES.INVALID_REQUEST,
        'Invalid protosetBase64: Invalid symbol',
      ),
    ).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
  });

  it('falls back to CALL_FAILED for unknown tauri codes', () => {
    expect(mapTauriErrorCodeToExpress('unknown-code')).toBe(GRPC_ERROR_CODES.CALL_FAILED);
  });

  it('toGrpcApiClientErrorFromDescriptorPrepare maps export failures to INVALID_REQUEST', () => {
    const mapped = toGrpcApiClientErrorFromDescriptorPrepare('stream_start', new Error('network down'));
    expect(mapped).toBeInstanceOf(GrpcApiClientError);
    expect(mapped.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    expect(mapped.op).toBe('stream_start');
  });

  it('toGrpcApiClientErrorFromDescriptorPrepare maps validation failures to INVALID_DESCRIPTOR', () => {
    const mapped = toGrpcApiClientErrorFromDescriptorPrepare(
      'call',
      new Error('contentSha256 must be a full 64-character SHA-256 hex digest'),
    );
    expect(mapped.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
  });

  it('toGrpcApiClientErrorFromDescriptorPrepare passes through existing client errors', () => {
    const original = new GrpcApiClientError('call', 'already wrapped', {
      code: GRPC_ERROR_CODES.CALL_FAILED,
      retryable: true,
    });
    expect(toGrpcApiClientErrorFromDescriptorPrepare('call', original)).toBe(original);
  });

  it('wraps native transport errors as GrpcApiClientError', () => {
    const native = new GrpcNativeTauriTransportError('cancel', 'tabId does not match the registered call', {
      code: GRPC_TAURI_ERROR_CODES.INVALID_REQUEST,
    });
    const mapped = toGrpcApiClientErrorFromNative('cancel', native);
    expect(mapped.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    expect(mapped.op).toBe('cancel');
  });

  it('wraps native transport fallback codes as CALL_FAILED', () => {
    const mapped = toGrpcApiClientErrorFromNative('call', {
      message: 'boom',
      code: 'not-mapped',
      retryable: false,
    });
    expect(mapped.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
  });

  it('maps non-zero unary results to GrpcApiClientError with grpcStatus in details', () => {
    const mapped = toGrpcApiClientErrorFromUnaryResult({
      status: 14,
      statusMessage: 'UNAVAILABLE',
      errorDetail: 'upstream down',
      trailers: { 'grpc-status-details-bin': 'abc' },
    });
    expect(mapped).toBeInstanceOf(GrpcApiClientError);
    expect(mapped.details?.grpcStatus).toBe(14);
    expect(mapped.details?.trailers).toEqual({ 'grpc-status-details-bin': 'abc' });
    expect(mapped.retryable).toBe(false);
  });

  it('uses statusMessage as grpcDetails when unary errorDetail is missing', () => {
    const mapped = toGrpcApiClientErrorFromUnaryResult({
      status: 13,
      statusMessage: 'INTERNAL',
      trailers: {},
    });
    expect(mapped).toBeInstanceOf(GrpcApiClientError);
    expect(mapped.details?.grpcStatus).toBe(13);
  });
});
