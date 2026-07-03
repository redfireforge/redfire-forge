/**
 * Phase 10C — grpcWebFramingCodec coverage gaps.
 */
import { describe, expect, it } from 'vitest';
import {
  concatGrpcWebFrames,
  decodeGrpcWebFrames,
  decodeGrpcWebResponseBody,
  decodeGrpcWebTextBody,
  encodeGrpcWebFrame,
  encodeGrpcWebRequestBody,
  encodeGrpcWebDataFrame,
  encodeGrpcWebTextBody,
  encodeGrpcWebTrailerFrame,
  GRPC_WEB_FRAME_FLAG_TRAILER,
  isGrpcWebTextContentType,
  isGrpcWebTrailerFrame,
  resetGrpcWebFramingCodecForTests,
} from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';

describe('grpcWebFramingCodec coverage gaps', () => {
  it('isGrpcWebTrailerFrame detects trailer flag', () => {
    const trailerPayload = new TextEncoder().encode('grpc-status: 0\r\n');
    const trailerFrame = encodeGrpcWebTrailerFrame(trailerPayload);
    const [decoded] = decodeGrpcWebFrames(trailerFrame);

    expect(isGrpcWebTrailerFrame({ flags: GRPC_WEB_FRAME_FLAG_TRAILER, payload: new Uint8Array() }))
      .toBe(true);
    expect(isGrpcWebTrailerFrame({ flags: 0, payload: new Uint8Array() })).toBe(false);
    expect(decoded).toBeDefined();
    expect(isGrpcWebTrailerFrame(decoded!)).toBe(true);
  });

  it('decodeGrpcWebFrames rejects incomplete frame header', () => {
    expect(() => decodeGrpcWebFrames(new Uint8Array([0, 0, 0]))).toThrow(/Incomplete gRPC-Web frame header/);
  });

  it('decodeGrpcWebFrames rejects incomplete frame payload', () => {
    const broken = encodeGrpcWebFrame(0, new Uint8Array([1, 2, 3])).slice(0, 6);
    expect(() => decodeGrpcWebFrames(broken)).toThrow(/Incomplete gRPC-Web frame payload/);
  });

  it('decodeGrpcWebTextBody returns empty buffer for blank text', () => {
    expect(decodeGrpcWebTextBody('')).toEqual(new Uint8Array(0));
    expect(decodeGrpcWebTextBody('  \n  ')).toEqual(new Uint8Array(0));
  });

  it('decodeGrpcWebResponseBody decodes string bodies for binary content type', () => {
    const payload = new Uint8Array([0x0a, 0x02, 0x68, 0x69]);
    const binaryFrame = encodeGrpcWebDataFrame(payload);
    let rawString = '';
    for (let index = 0; index < binaryFrame.length; index += 1) {
      rawString += String.fromCharCode(binaryFrame[index]!);
    }

    const frames = decodeGrpcWebResponseBody(rawString, GRPC_WEB_CONTENT_TYPES.BINARY);
    expect(frames).toHaveLength(1);
    expect(Array.from(frames[0]!.payload)).toEqual(Array.from(payload));
  });

  it('concatGrpcWebFrames merges multiple frames in order', () => {
    const a = encodeGrpcWebDataFrame(new Uint8Array([1]));
    const b = encodeGrpcWebDataFrame(new Uint8Array([2, 3]));
    const merged = concatGrpcWebFrames([a, b]);
    const frames = decodeGrpcWebFrames(merged);
    expect(frames).toHaveLength(2);
    expect(Array.from(frames[0]!.payload)).toEqual([1]);
    expect(Array.from(frames[1]!.payload)).toEqual([2, 3]);
  });

  it('encodeGrpcWebRequestBody returns text body for grpc-web-text content type', () => {
    const encoded = encodeGrpcWebRequestBody(new Uint8Array([0x01, 0x02]), GRPC_WEB_CONTENT_TYPES.TEXT);
    expect(typeof encoded.body).toBe('string');
    expect(encoded.contentType).toBe(GRPC_WEB_CONTENT_TYPES.TEXT);
  });

  it('encodeGrpcWebRequestBody returns binary body for grpc-web binary content type', () => {
    const encoded = encodeGrpcWebRequestBody(new Uint8Array([0x01, 0x02]), GRPC_WEB_CONTENT_TYPES.BINARY);
    expect(encoded.body).toBeInstanceOf(ArrayBuffer);
    expect(encoded.contentType).toBe(GRPC_WEB_CONTENT_TYPES.BINARY);
  });

  it('isGrpcWebTextContentType matches grpc-web-text case-insensitively', () => {
    expect(isGrpcWebTextContentType(GRPC_WEB_CONTENT_TYPES.TEXT)).toBe(true);
    expect(isGrpcWebTextContentType('application/GRPC-WEB-TEXT+PROTO')).toBe(true);
    expect(isGrpcWebTextContentType(GRPC_WEB_CONTENT_TYPES.BINARY)).toBe(false);
    expect(isGrpcWebTextContentType('application/json')).toBe(false);
  });

  it('resetGrpcWebFramingCodecForTests is a no-op symmetry hook', () => {
    expect(() => resetGrpcWebFramingCodecForTests()).not.toThrow();
  });

  it('encodeGrpcWebTrailerFrame wraps trailer block with trailer flag', () => {
    const trailerBlock = new TextEncoder().encode('grpc-status: 0\r\ngrpc-message: ok\r\n');
    const frame = encodeGrpcWebTrailerFrame(trailerBlock);
    const [decoded] = decodeGrpcWebFrames(frame);

    expect(decoded?.flags).toBe(GRPC_WEB_FRAME_FLAG_TRAILER);
    expect(new TextDecoder().decode(decoded?.payload ?? new Uint8Array())).toContain('grpc-status: 0');
  });

  it('decodeGrpcWebResponseBody decodes Uint8Array bodies for text content type', () => {
    const payload = new Uint8Array([0x0a, 0x02, 0x68, 0x69]);
    const binaryFrame = encodeGrpcWebDataFrame(payload);
    const textBody = encodeGrpcWebTextBody(binaryFrame);

    const frames = decodeGrpcWebResponseBody(
      new TextEncoder().encode(textBody),
      GRPC_WEB_CONTENT_TYPES.TEXT,
    );
    expect(frames).toHaveLength(1);
    expect(Array.from(frames[0]!.payload)).toEqual(Array.from(payload));
  });
});
