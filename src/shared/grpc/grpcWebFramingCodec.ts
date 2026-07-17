/**
 * gRPC-Web framing codec — Phase 10C.
 *
 * Implements length-prefixed frame encode/decode for binary and text content types.
 * @see https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-WEB.md
 */
import {
  GRPC_WEB_CONTENT_TYPES,
  type GrpcWebContentType,
} from './grpcWebTransportContracts';

export const GRPC_WEB_FRAME_HEADER_SIZE = 5;

/** Data frame — payload is serialized protobuf message bytes. */
export const GRPC_WEB_FRAME_FLAG_DATA = 0x00;

/** Trailer frame — payload is HTTP/1-style `key: value\\r\\n` trailer block. */
export const GRPC_WEB_FRAME_FLAG_TRAILER = 0x80;

export interface GrpcWebFrame {
  flags: number;
  payload: Uint8Array;
}

export function isGrpcWebTrailerFrame(frame: GrpcWebFrame): boolean {
  return (frame.flags & GRPC_WEB_FRAME_FLAG_TRAILER) !== 0;
}

export function encodeGrpcWebFrame(flags: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(GRPC_WEB_FRAME_HEADER_SIZE + payload.length);
  frame[0] = flags & 0xff;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  view.setUint32(1, payload.length, false);
  frame.set(payload, GRPC_WEB_FRAME_HEADER_SIZE);
  return frame;
}

export function encodeGrpcWebDataFrame(payload: Uint8Array): Uint8Array {
  return encodeGrpcWebFrame(GRPC_WEB_FRAME_FLAG_DATA, payload);
}

export function encodeGrpcWebTrailerFrame(trailerBlock: Uint8Array): Uint8Array {
  return encodeGrpcWebFrame(GRPC_WEB_FRAME_FLAG_TRAILER, trailerBlock);
}

export function concatGrpcWebFrames(frames: readonly Uint8Array[]): Uint8Array {
  const total = frames.reduce((sum, frame) => sum + frame.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const frame of frames) {
    merged.set(frame, offset);
    offset += frame.length;
  }
  return merged;
}

export function decodeGrpcWebFrames(body: Uint8Array): GrpcWebFrame[] {
  const frames: GrpcWebFrame[] = [];
  let offset = 0;
  while (offset < body.length) {
    if (offset + GRPC_WEB_FRAME_HEADER_SIZE > body.length) {
      throw new Error('Incomplete gRPC-Web frame header');
    }
    const flags = body[offset]!;
    const view = new DataView(body.buffer, body.byteOffset + offset, body.byteLength - offset);
    const length = view.getUint32(1, false);
    offset += GRPC_WEB_FRAME_HEADER_SIZE;
    if (offset + length > body.length) {
      throw new Error(`Incomplete gRPC-Web frame payload (expected ${length} bytes)`);
    }
    const payload = body.slice(offset, offset + length);
    offset += length;
    frames.push({ flags, payload });
  }
  return frames;
}

export function splitGrpcWebResponseFrames(frames: readonly GrpcWebFrame[]): {
  dataFrames: GrpcWebFrame[];
  trailerFrames: GrpcWebFrame[];
} {
  const dataFrames: GrpcWebFrame[] = [];
  const trailerFrames: GrpcWebFrame[] = [];
  for (const frame of frames) {
    if (isGrpcWebTrailerFrame(frame)) {
      trailerFrames.push(frame);
    } else {
      dataFrames.push(frame);
    }
  }
  return { dataFrames, trailerFrames };
}

export function encodeGrpcWebTextBody(binaryBody: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < binaryBody.length; index += 1) {
    binary += String.fromCharCode(binaryBody[index]!);
  }
  return btoa(binary);
}

export function decodeGrpcWebTextBody(textBody: string): Uint8Array {
  const trimmed = textBody.trim();
  if (!trimmed) {
    return new Uint8Array(0);
  }
  const binary = atob(trimmed);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeGrpcWebRequestBody(
  messageBytes: Uint8Array,
  contentType: GrpcWebContentType = GRPC_WEB_CONTENT_TYPES.BINARY,
): { body: BodyInit; contentType: GrpcWebContentType } {
  const binary = encodeGrpcWebDataFrame(messageBytes);
  if (contentType === GRPC_WEB_CONTENT_TYPES.TEXT) {
    return {
      body: encodeGrpcWebTextBody(binary),
      contentType: GRPC_WEB_CONTENT_TYPES.TEXT,
    };
  }
  return {
    body: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as BodyInit,
    contentType: GRPC_WEB_CONTENT_TYPES.BINARY,
  };
}

export function decodeGrpcWebResponseBody(
  rawBody: Uint8Array | string,
  contentType: string,
): GrpcWebFrame[] {
  const normalized = contentType.toLowerCase();
  const bytes = typeof rawBody === 'string'
    ? (
      normalized.includes('grpc-web-text')
        ? decodeGrpcWebTextBody(rawBody)
        : stringToUint8Array(rawBody)
    )
    : (
      normalized.includes('grpc-web-text')
        ? decodeGrpcWebTextBody(uint8ArrayToAscii(rawBody))
        : rawBody
    );
  return decodeGrpcWebFrames(bytes);
}

export function isGrpcWebTextContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes('grpc-web-text');
}

function stringToUint8Array(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function uint8ArrayToAscii(bytes: Uint8Array): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]!);
  }
  return text;
}

export function resetGrpcWebFramingCodecForTests(): void {
  // Stateless module — symmetry hook for test suites.
}
