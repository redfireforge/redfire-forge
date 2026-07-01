/**
 * Phase 10C — gRPC-Web framing codec unit tests.
 */
import { describe, expect, it } from 'vitest';
import {
  concatGrpcWebFrames,
  decodeGrpcWebFrames,
  decodeGrpcWebResponseBody,
  decodeGrpcWebTextBody,
  encodeGrpcWebDataFrame,
  encodeGrpcWebRequestBody,
  encodeGrpcWebTextBody,
  encodeGrpcWebTrailerFrame,
  GRPC_WEB_FRAME_FLAG_TRAILER,
  splitGrpcWebResponseFrames,
} from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';

describe('grpcWebFramingCodec (Phase 10C)', () => {
  it('round-trips a data frame through binary encode/decode', () => {
    const payload = new Uint8Array([0x0a, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    const frame = encodeGrpcWebDataFrame(payload);
    const [decoded] = decodeGrpcWebFrames(frame);
    expect(decoded?.flags).toBe(0);
    expect(Array.from(decoded?.payload ?? [])).toEqual(Array.from(payload));
  });

  it('decodes multiple data frames and a trailer frame', () => {
    const data = encodeGrpcWebDataFrame(new Uint8Array([1, 2, 3]));
    const trailerText = new TextEncoder().encode('grpc-status: 0\r\ngrpc-message: ok\r\n');
    const trailer = encodeGrpcWebTrailerFrame(trailerText);
    const body = concatGrpcWebFrames([data, trailer]);
    const frames = decodeGrpcWebFrames(body);
    const split = splitGrpcWebResponseFrames(frames);
    expect(split.dataFrames).toHaveLength(1);
    expect(split.trailerFrames).toHaveLength(1);
    expect(split.trailerFrames[0]?.flags & GRPC_WEB_FRAME_FLAG_TRAILER).toBeTruthy();
  });

  it('binary and text bodies decode to identical frames', () => {
    const payload = new Uint8Array([0x0a, 0x03, 0x66, 0x6f, 0x6f]);
    const binaryBody = encodeGrpcWebDataFrame(payload);
    const textBody = encodeGrpcWebTextBody(binaryBody);

    const fromBinary = decodeGrpcWebResponseBody(
      binaryBody,
      GRPC_WEB_CONTENT_TYPES.BINARY,
    );
    const fromText = decodeGrpcWebResponseBody(
      textBody,
      GRPC_WEB_CONTENT_TYPES.TEXT,
    );

    expect(fromBinary).toHaveLength(1);
    expect(fromText).toHaveLength(1);
    expect(Array.from(fromBinary[0]!.payload)).toEqual(Array.from(fromText[0]!.payload));
  });

  it('encodeGrpcWebRequestBody returns binary body by default', () => {
    const message = new Uint8Array([9, 8, 7]);
    const encoded = encodeGrpcWebRequestBody(message);
    expect(encoded.contentType).toBe(GRPC_WEB_CONTENT_TYPES.BINARY);
    expect(typeof encoded.body).not.toBe('string');
  });

  it('encodeGrpcWebRequestBody supports text content type', () => {
    const message = new Uint8Array([1, 2]);
    const encoded = encodeGrpcWebRequestBody(message, GRPC_WEB_CONTENT_TYPES.TEXT);
    expect(encoded.contentType).toBe(GRPC_WEB_CONTENT_TYPES.TEXT);
    expect(typeof encoded.body).toBe('string');
    const roundTrip = decodeGrpcWebTextBody(encoded.body as string);
    expect(Array.from(decodeGrpcWebFrames(roundTrip)[0]!.payload)).toEqual([1, 2]);
  });

  it('rejects truncated frame payloads', () => {
    const truncated = new Uint8Array([0, 0, 0, 0, 10, 1]);
    expect(() => decodeGrpcWebFrames(truncated)).toThrow(/Incomplete gRPC-Web frame payload/);
  });
});
