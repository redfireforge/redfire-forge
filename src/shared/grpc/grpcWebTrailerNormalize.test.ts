/**
 * Phase 10C — gRPC-Web trailer normalization unit tests.
 */
import { describe, expect, it } from 'vitest';
import {
  concatGrpcWebFrames,
  encodeGrpcWebDataFrame,
  encodeGrpcWebTextBody,
  encodeGrpcWebTrailerFrame,
} from './grpcWebFramingCodec';
import { normalizeGrpcWebUnaryResponse } from './grpcWebTrailerNormalize';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';

function makeHeaders(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe('grpcWebTrailerNormalize (Phase 10C)', () => {
  it('reads grpc-status from HTTP headers (Envoy-style unary)', () => {
    const payload = new Uint8Array([0x0a, 0x02, 0x68, 0x69]);
    const body = encodeGrpcWebDataFrame(payload);
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status': '0',
        'grpc-message': '',
      }),
      body,
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });
    expect(normalized.status).toBe(0);
    expect(normalized.statusMessage).toBe('OK');
    expect(Array.from(normalized.dataPayloads[0] ?? [])).toEqual(Array.from(payload));
  });

  it('reads grpc-status from in-body trailer frame', () => {
    const payload = new Uint8Array([0x0a, 0x02, 0x68, 0x69]);
    const trailerBlock = new TextEncoder().encode('grpc-status: 7\r\ngrpc-message: permission%20denied\r\n');
    const body = concatGrpcWebFrames([
      encodeGrpcWebDataFrame(payload),
      encodeGrpcWebTrailerFrame(trailerBlock),
    ]);
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': GRPC_WEB_CONTENT_TYPES.BINARY }),
      body,
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });
    expect(normalized.status).toBe(7);
    expect(normalized.statusMessage).toBe('permission denied');
  });

  it('produces equivalent canonical status from binary and text bodies', () => {
    const payload = new Uint8Array([0x0a, 0x03, 0x62, 0x61, 0x72]);
    const trailerBlock = new TextEncoder().encode('grpc-status: 0\r\ngrpc-message: ok\r\n');
    const binaryBody = concatGrpcWebFrames([
      encodeGrpcWebDataFrame(payload),
      encodeGrpcWebTrailerFrame(trailerBlock),
    ]);
    const textBody = encodeGrpcWebTextBody(binaryBody);

    const fromBinary = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': GRPC_WEB_CONTENT_TYPES.BINARY }),
      body: binaryBody,
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });
    const fromText = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': GRPC_WEB_CONTENT_TYPES.TEXT }),
      body: textBody,
      contentType: GRPC_WEB_CONTENT_TYPES.TEXT,
    });

    expect(fromBinary.status).toBe(fromText.status);
    expect(fromBinary.statusMessage).toBe(fromText.statusMessage);
    expect(Array.from(fromBinary.dataPayloads[0] ?? [])).toEqual(Array.from(fromText.dataPayloads[0] ?? []));
  });

  it('falls back to raw grpc-message when percent-encoding is malformed', () => {
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
        'grpc-status': '13',
        'grpc-message': 'bad%ZZencoding',
      }),
      body: new Uint8Array(0),
      contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
    });
    expect(normalized.status).toBe(13);
    expect(normalized.statusMessage).toBe('bad%ZZencoding');
  });
});
