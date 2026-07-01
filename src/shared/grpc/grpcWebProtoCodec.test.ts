/**
 * Phase 10C — browser protoset proto codec unit tests.
 */
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { FIXTURE_ECHO_PROTO } from './contractFixtures';
import {
  clearGrpcWebProtoCodecCacheForTests,
  decodeGrpcWebProtoMessage,
  encodeGrpcWebProtoMessage,
  loadProtobufRootFromProtosetBase64,
  resolveGrpcWebMethodTypes,
} from './grpcWebProtoCodec';

function buildEchoProtosetBase64(): string {
  const root = new protobuf.Root();
  protobuf.parse(FIXTURE_ECHO_PROTO, root, { keepCase: true, alternateCommentMode: true });
  root.resolveAll();
  const fileDescriptorSet = root.toDescriptor('proto3');
  const bytes = descriptor.FileDescriptorSet.encode(fileDescriptorSet).finish();
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

describe('grpcWebProtoCodec (Phase 10C)', () => {
  beforeEach(() => {
    clearGrpcWebProtoCodecCacheForTests();
  });

  it('loads protoset and resolves Echo method types', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);
    const types = resolveGrpcWebMethodTypes(root, 'echo.EchoService', 'Echo');
    expect(types.requestTypeName).toBe('echo.EchoRequest');
    expect(types.responseTypeName).toBe('echo.EchoResponse');
  });

  it('encodes and decodes EchoRequest/EchoResponse round-trip', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const requestBytes = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoRequest',
      { message: 'hello grpc-web' },
    );
    expect(requestBytes.length).toBeGreaterThan(0);

    const responseBytes = encodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      { message: 'echo: hello grpc-web' },
    );
    const decoded = decodeGrpcWebProtoMessage(
      protosetBase64,
      'echo.EchoResponse',
      responseBytes,
    );
    expect(decoded.message).toBe('echo: hello grpc-web');
  });
});
