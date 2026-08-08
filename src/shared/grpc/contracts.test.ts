import { describe, expect, it } from 'vitest';
import {
  createGrpcErrorEnvelope,
  createGrpcSuccessEnvelope,
  defaultGrpcTlsMode,
  grpcErrorCategoryForCode,
  grpcTargetToStatusRequest,
  GRPC_ERROR_CODES,
  GRPC_STREAM_HEARTBEAT_INTERVAL_MS,
  GRPC_STREAM_MESSAGE_CAP,
  GRPC_STREAM_RECONNECT_MAX_ATTEMPTS,
  GRPC_STREAM_RECONNECT_BACKOFF_MS,
  GRPC_STREAM_SSE_DISCONNECT_GRACE_MS,
  isPhase1UnaryCallRequest,
  isPhase2StreamStartRequest,
  isStreamingCallType,
  mapGrpcErrorCodeToHttpStatus,
  normalizeGrpcMetadata,
  type GrpcCallRequest,
} from './contracts';
import {
  FIXTURE_CALL_FAILED_ENVELOPE,
  FIXTURE_CANCELLED_ENVELOPE,
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
  FIXTURE_DESCRIBE_FAILED_ENVELOPE,
  FIXTURE_DESCRIBE_SUCCESS_ENVELOPE,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_REFLECTION_FAILED_ENVELOPE,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
  FIXTURE_REQUEST_NOT_FOUND_ENVELOPE,
  FIXTURE_STATUS_SUCCESS_ENVELOPE,
  FIXTURE_STATUS_UNREACHABLE_ENVELOPE,
  FIXTURE_TARGET,
  FIXTURE_SERVER_STREAM_START_REQUEST,
  FIXTURE_STREAM_END_EVENT,
  FIXTURE_STREAM_START_SUCCESS_ENVELOPE,
  FIXTURE_STREAM_VALIDATION_ERROR_ENVELOPE,
  FIXTURE_UNARY_CALL_REQUEST,
  FIXTURE_UNREACHABLE_ERROR_ENVELOPE,
  FIXTURE_VALIDATION_ERROR_ENVELOPE,
} from './contractFixtures';

describe('grpc contracts (Phase 1A)', () => {
  it('creates stable success envelope shape', () => {
    const envelope = createGrpcSuccessEnvelope('status', { reachable: true }, { requestId: 'req-1' });

    expect(envelope.ok).toBe(true);
    expect(envelope.op).toBe('status');
    expect(envelope.data.reachable).toBe(true);
    expect(envelope.meta.requestId).toBe('req-1');
    expect(typeof envelope.meta.timestamp).toBe('string');
  });

  it('creates stable error envelope with inferred category', () => {
    const envelope = createGrpcErrorEnvelope('reflect', {
      code: GRPC_ERROR_CODES.REFLECTION_FAILED,
      message: 'reflection unavailable',
    });

    expect(envelope.ok).toBe(false);
    expect(envelope.error.category).toBe('reflection_failed');
    expect(envelope.error.code).toBe('GRPC_REFLECTION_FAILED');
  });

  it('preserves explicit error categories when creating error envelopes', () => {
    const envelope = createGrpcErrorEnvelope('call', {
      code: GRPC_ERROR_CODES.CALL_FAILED,
      category: 'unreachable',
      message: 'override',
    });
    expect(envelope.error.category).toBe('unreachable');
  });

  it('maps error codes to HTTP status', () => {
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.INVALID_TARGET,
        category: 'validation',
        message: 'bad target',
      }),
    ).toBe(400);
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
        message: 'down',
      }),
    ).toBe(503);
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.CANCELLED,
        category: 'cancelled',
        message: 'cancelled',
      }),
    ).toBe(409);
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.CALL_FAILED,
        category: 'call_failed',
        message: 'auth denied',
        details: { authFailure: 'auth_denied', grpcStatus: 16 },
      }),
    ).toBe(401);
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.CALL_FAILED,
        category: 'call_failed',
        message: 'boom',
      }),
    ).toBe(500);
  });

  it('maps cancel tabId mismatch to HTTP 409 while keeping GRPC_INVALID_REQUEST', () => {
    expect(
      mapGrpcErrorCodeToHttpStatus(
        {
          code: GRPC_ERROR_CODES.INVALID_REQUEST,
          category: 'validation',
          message: 'tabId does not match the registered call',
        },
        'cancel',
      ),
    ).toBe(409);
  });

  it('maps Phase 3 descriptor phase error codes', () => {
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.SOURCE_UNAVAILABLE,
        category: 'source_unavailable',
        message: 'bsr unreachable',
      }),
    ).toBe(503);
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED,
        category: 'import_resolution_failed',
        message: 'missing import',
      }),
    ).toBe(422);
    expect(
      mapGrpcErrorCodeToHttpStatus({
        code: GRPC_ERROR_CODES.SCHEMA_DRIFT,
        category: 'schema_drift',
        message: 'method removed',
      }),
    ).toBe(409);
    expect(grpcErrorCategoryForCode(GRPC_ERROR_CODES.CACHE_STALE)).toBe('cache_stale');
    expect(grpcErrorCategoryForCode('GRPC_CUSTOM_SOURCE_UNAVAILABLE')).toBe('source_unavailable');
    expect(grpcErrorCategoryForCode('GRPC_CUSTOM_SCHEMA_DRIFT')).toBe('schema_drift');
  });

  it('maps stream control tabId mismatch to HTTP 409', () => {
    const error = {
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation' as const,
      message: 'tabId does not match the registered stream',
    };
    expect(mapGrpcErrorCodeToHttpStatus(error, 'stream_send')).toBe(409);
    expect(mapGrpcErrorCodeToHttpStatus(error, 'stream_end')).toBe(409);
    expect(mapGrpcErrorCodeToHttpStatus(error, 'stream_cancel')).toBe(409);
  });

  it('maps stream protocol conflicts to HTTP 409', () => {
    const sendConflict = {
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation' as const,
      message: 'send is not valid for server-streaming RPCs',
    };
    expect(mapGrpcErrorCodeToHttpStatus(sendConflict, 'stream_send')).toBe(409);
    const duplicate = {
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation' as const,
      message: 'requestId req-1 is already in use by an active stream',
    };
    expect(mapGrpcErrorCodeToHttpStatus(duplicate, 'stream_start')).toBe(409);
    const afterEof = {
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation' as const,
      message: 'send is not valid after client stream EOF',
    };
    expect(mapGrpcErrorCodeToHttpStatus(afterEof, 'stream_send')).toBe(409);
  });

  it('maps all Phase 1 error codes to HTTP status', () => {
    const cases: Array<[string, number]> = [
      [GRPC_ERROR_CODES.INVALID_REQUEST, 400],
      [GRPC_ERROR_CODES.INVALID_TARGET, 400],
      [GRPC_ERROR_CODES.INVALID_DESCRIPTOR, 400],
      [GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY, 400],
      [GRPC_ERROR_CODES.UNREACHABLE, 503],
      [GRPC_ERROR_CODES.REFLECTION_FAILED, 502],
      [GRPC_ERROR_CODES.DESCRIBE_FAILED, 422],
      [GRPC_ERROR_CODES.CALL_FAILED, 500],
      [GRPC_ERROR_CODES.CANCELLED, 409],
      [GRPC_ERROR_CODES.REQUEST_NOT_FOUND, 404],
    ];

    for (const [code, status] of cases) {
      expect(
        mapGrpcErrorCodeToHttpStatus({
          code,
          category: grpcErrorCategoryForCode(code),
          message: 'test',
        }),
      ).toBe(status);
    }
  });

  it('normalizes metadata keys to lowercase and drops empty keys', () => {
    expect(
      normalizeGrpcMetadata({
        'X-Request-Id': 'abc',
        Authorization: 'Bearer x',
        '': 'ignored',
        '  ': 'ignored',
      }),
    ).toEqual({
      'x-request-id': 'abc',
      authorization: 'Bearer x',
    });
  });

  it('normalizes duplicate metadata keys with last value winning', () => {
    expect(
      normalizeGrpcMetadata({
        'X-Trace': 'first',
        'x-trace': 'second',
      }),
    ).toEqual({ 'x-trace': 'second' });
  });

  it('builds status request from GrpcTarget', () => {
    expect(grpcTargetToStatusRequest(FIXTURE_TARGET)).toEqual({
      address: 'localhost:50051',
      tlsMode: 'disabled',
      timeoutMs: 5_000,
    });
    expect(
      grpcTargetToStatusRequest({
        address: '  localhost:50051  ',
        tlsMode: 'disabled',
      }).address,
    ).toBe('localhost:50051');
    expect(defaultGrpcTlsMode()).toBe('disabled');
  });

  it('infers categories for unknown codes', () => {
    expect(grpcErrorCategoryForCode('GRPC_INVALID_FOO')).toBe('validation');
    expect(grpcErrorCategoryForCode('GRPC_SOMETHING_NOT_FOUND')).toBe('not_found');
    expect(grpcErrorCategoryForCode('GRPC_CACHE_STALE_UNKNOWN')).toBe('cache_stale');
    expect(grpcErrorCategoryForCode('WHATEVER')).toBe('call_failed');
  });

  it('maps unknown error codes to HTTP 500 by default', () => {
    expect(mapGrpcErrorCodeToHttpStatus({
      code: 'GRPC_UNKNOWN_CUSTOM',
      category: 'call_failed',
      message: 'unknown',
    })).toBe(500);
  });

  it('normalizes undefined metadata to an empty object', () => {
    expect(normalizeGrpcMetadata(undefined)).toEqual({});
  });

  it('accepts Phase 1 unary call requests only', () => {
    const unary: GrpcCallRequest = { ...FIXTURE_UNARY_CALL_REQUEST, callType: 'unary' };
    const streaming: GrpcCallRequest = { ...FIXTURE_UNARY_CALL_REQUEST, callType: 'server_streaming' };

    expect(isPhase1UnaryCallRequest(unary)).toBe(true);
    expect(isPhase1UnaryCallRequest(streaming)).toBe(false);
  });

  it('exports Phase 2 stream tuning constants (Phase 2A)', () => {
    expect(GRPC_STREAM_MESSAGE_CAP).toBe(10_000);
    expect(GRPC_STREAM_HEARTBEAT_INTERVAL_MS).toBe(15_000);
    expect(GRPC_STREAM_SSE_DISCONNECT_GRACE_MS).toBe(60_000);
    expect(GRPC_STREAM_RECONNECT_MAX_ATTEMPTS).toBe(3);
    expect(GRPC_STREAM_RECONNECT_BACKOFF_MS).toEqual([1_000, 2_000, 4_000]);
  });

  it('identifies streaming call types and stream start requests (Phase 2A)', () => {
    expect(isStreamingCallType('server_streaming')).toBe(true);
    expect(isStreamingCallType('unary')).toBe(false);
    expect(isPhase2StreamStartRequest(FIXTURE_SERVER_STREAM_START_REQUEST)).toBe(true);
    expect(isPhase2StreamStartRequest(FIXTURE_UNARY_CALL_REQUEST)).toBe(false);
    expect(FIXTURE_STREAM_START_SUCCESS_ENVELOPE.ok).toBe(true);
    if (FIXTURE_STREAM_START_SUCCESS_ENVELOPE.ok) {
      expect(FIXTURE_STREAM_START_SUCCESS_ENVELOPE.op).toBe('stream_start');
    }
    expect(FIXTURE_STREAM_END_EVENT.type).toBe('grpc-end');
    expect(FIXTURE_STREAM_END_EVENT.data?.message).toBe('one,two,three');
    expect(FIXTURE_STREAM_VALIDATION_ERROR_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_STREAM_VALIDATION_ERROR_ENVELOPE.ok) {
      expect(FIXTURE_STREAM_VALIDATION_ERROR_ENVELOPE.op).toBe('stream_start');
      expect(FIXTURE_STREAM_VALIDATION_ERROR_ENVELOPE.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('maps stream_cancel tabId mismatch to HTTP 409', () => {
    expect(mapGrpcErrorCodeToHttpStatus({
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      category: 'validation',
      message: 'tabId does not match the registered stream',
    }, 'stream_cancel')).toBe(409);
  });

  it('happy-path fixture envelope is well-formed', () => {
    expect(FIXTURE_HAPPY_CALL_ENVELOPE.ok).toBe(true);
    if (FIXTURE_HAPPY_CALL_ENVELOPE.ok) {
      expect(FIXTURE_HAPPY_CALL_ENVELOPE.data.status).toBe(0);
      expect(FIXTURE_HAPPY_CALL_ENVELOPE.meta.requestId).toBe(FIXTURE_UNARY_CALL_REQUEST.requestId);
    }
  });

  it('failure-path fixture envelopes cover taxonomy categories', () => {
    expect(FIXTURE_VALIDATION_ERROR_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_VALIDATION_ERROR_ENVELOPE.ok) {
      expect(FIXTURE_VALIDATION_ERROR_ENVELOPE.error.category).toBe('validation');
      expect(FIXTURE_VALIDATION_ERROR_ENVELOPE.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
      expect(FIXTURE_VALIDATION_ERROR_ENVELOPE.error.message).toContain(
        'Target must be host:port or in-process:<name>',
      );
    }

    expect(FIXTURE_UNREACHABLE_ERROR_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_UNREACHABLE_ERROR_ENVELOPE.ok) {
      expect(FIXTURE_UNREACHABLE_ERROR_ENVELOPE.error.category).toBe('unreachable');
      expect(FIXTURE_UNREACHABLE_ERROR_ENVELOPE.error.retryable).toBe(true);
    }

    expect(FIXTURE_REFLECTION_FAILED_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_REFLECTION_FAILED_ENVELOPE.ok) {
      expect(FIXTURE_REFLECTION_FAILED_ENVELOPE.error.category).toBe('reflection_failed');
    }

    expect(FIXTURE_CANCELLED_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_CANCELLED_ENVELOPE.ok) {
      expect(FIXTURE_CANCELLED_ENVELOPE.error.category).toBe('cancelled');
    }

    expect(FIXTURE_DESCRIBE_FAILED_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_DESCRIBE_FAILED_ENVELOPE.ok) {
      expect(FIXTURE_DESCRIBE_FAILED_ENVELOPE.error.category).toBe('describe_failed');
    }

    expect(FIXTURE_CALL_FAILED_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_CALL_FAILED_ENVELOPE.ok) {
      expect(FIXTURE_CALL_FAILED_ENVELOPE.error.category).toBe('call_failed');
    }

    expect(FIXTURE_REQUEST_NOT_FOUND_ENVELOPE.ok).toBe(false);
    if (!FIXTURE_REQUEST_NOT_FOUND_ENVELOPE.ok) {
      expect(FIXTURE_REQUEST_NOT_FOUND_ENVELOPE.error.category).toBe('not_found');
    }

    expect(FIXTURE_CANCEL_SUCCESS_ENVELOPE.ok).toBe(true);
    if (FIXTURE_CANCEL_SUCCESS_ENVELOPE.ok) {
      expect(FIXTURE_CANCEL_SUCCESS_ENVELOPE.data.cancelled).toBe(true);
    }

    expect(FIXTURE_REFLECT_SUCCESS_ENVELOPE.ok).toBe(true);
    expect(FIXTURE_DESCRIBE_SUCCESS_ENVELOPE.ok).toBe(true);
    expect(FIXTURE_STATUS_SUCCESS_ENVELOPE.ok).toBe(true);
    if (FIXTURE_STATUS_UNREACHABLE_ENVELOPE.ok) {
      expect(FIXTURE_STATUS_UNREACHABLE_ENVELOPE.data.reachable).toBe(false);
    }
  });
});
