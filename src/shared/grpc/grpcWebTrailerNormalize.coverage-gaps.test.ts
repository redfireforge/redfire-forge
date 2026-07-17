/**
 * Phase 10C — grpcWebTrailerNormalize coverage gaps.
 */
import { describe, expect, it } from 'vitest';
import {
  concatGrpcWebFrames,
  encodeGrpcWebDataFrame,
  encodeGrpcWebTrailerFrame,
} from './grpcWebFramingCodec';
import {
  normalizeGrpcWebUnaryResponse,
  resetGrpcWebTrailerNormalizeForTests,
} from './grpcWebTrailerNormalize';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';

function makeHeaders(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe('grpcWebTrailerNormalize coverage gaps', () => {
  it('parseGrpcStatus maps invalid grpc-status to UNKNOWN (2)', () => {
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status': 'not-a-number',
      }),
      body: new Uint8Array(0),
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });

    expect(normalized.status).toBe(2);
    expect(normalized.statusMessage).toMatch(/Invalid grpc-status/);
  });

  it('defaults empty grpc-status to OK', () => {
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status': '',
      }),
      body: new Uint8Array(0),
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });

    expect(normalized.status).toBe(0);
    expect(normalized.statusMessage).toBe('OK');
  });

  it('mergeTrailerSources includes grpc-bin headers from HTTP headers', () => {
    const trailerBlock = new TextEncoder().encode('grpc-status: 0\r\n');
    const body = concatGrpcWebFrames([
      encodeGrpcWebDataFrame(new Uint8Array([1])),
      encodeGrpcWebTrailerFrame(trailerBlock),
    ]);

    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status-bin': 'deadbeef',
        'x-custom-bin': 'ignored',
      }),
      body,
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });

    expect(normalized.trailers['grpc-status-bin']).toBe('deadbeef');
    expect(normalized.trailers['x-custom-bin']).toBe('ignored');
  });

  it('parseTrailerBlock skips malformed trailer lines without colon', () => {
    const trailerBlock = new TextEncoder().encode(
      'grpc-status: 0\r\nmalformed-line-without-colon\r\ngrpc-message: ok\r\n',
    );
    const body = concatGrpcWebFrames([
      encodeGrpcWebDataFrame(new Uint8Array([2])),
      encodeGrpcWebTrailerFrame(trailerBlock),
    ]);

    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': GRPC_WEB_CONTENT_TYPES.BINARY }),
      body,
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });

    expect(normalized.status).toBe(0);
    expect(normalized.statusMessage).toBe('ok');
  });

  it('resetGrpcWebTrailerNormalizeForTests is a no-op symmetry hook', () => {
    expect(() => resetGrpcWebTrailerNormalizeForTests()).not.toThrow();
  });
});
