/**
 * Phase 10C — grpcWebProtoCodec coverage gaps.
 */
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_ECHO_PROTO } from './contractFixtures';
import {
  base64ToUint8Array,
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

describe('grpcWebProtoCodec coverage gaps', () => {
  beforeEach(() => {
    clearGrpcWebProtoCodecCacheForTests();
  });

  it('base64ToUint8Array returns empty buffer for blank input', () => {
    expect(base64ToUint8Array('')).toEqual(new Uint8Array(0));
    expect(base64ToUint8Array('   \n\t  ')).toEqual(new Uint8Array(0));
  });

  it('loadProtobufRootFromProtosetBase64 rejects empty protoset', () => {
    expect(() => loadProtobufRootFromProtosetBase64('')).toThrow(/empty buffer/);
    expect(() => loadProtobufRootFromProtosetBase64('   ')).toThrow(/empty buffer/);
  });

  it('loadProtobufRootFromProtosetBase64 rejects invalid protoset decode', () => {
    const garbage = btoa('not-a-valid-file-descriptor-set');
    expect(() => loadProtobufRootFromProtosetBase64(garbage)).toThrow(/Failed to decode protoset/);
  });

  it('loadProtobufRootFromProtosetBase64 rejects protoset with no file descriptors', () => {
    const decodeSpy = vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockReturnValue({ file: [] });
    try {
      expect(() => loadProtobufRootFromProtosetBase64(btoa('stub'))).toThrow(/no file descriptors/);
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it('lookupMessageType fails when type is not in protoset', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    expect(() => encodeGrpcWebProtoMessage(protosetBase64, 'missing.MessageType', { x: 1 }))
      .toThrow(/Type missing\.MessageType not found/);
  });

  it('lookupService fails when service is not in protoset', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);
    expect(() => resolveGrpcWebMethodTypes(root, 'missing.Service', 'Echo'))
      .toThrow(/Service missing\.Service not found/);
  });

  it('resolveGrpcWebMethodTypes fails when method is not on service', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);
    expect(() => resolveGrpcWebMethodTypes(root, 'echo.EchoService', 'MissingMethod'))
      .toThrow(/Method MissingMethod not found on service echo\.EchoService/);
  });

  it('resolveGrpcWebMethodTypes resolves via methodsArray when methods map entry is absent', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);
    const service = root.lookupService('echo.EchoService');
    delete service.methods.Echo;

    const types = resolveGrpcWebMethodTypes(root, 'echo.EchoService', 'Echo');
    expect(types.requestTypeName).toBe('echo.EchoRequest');
    expect(types.responseTypeName).toBe('echo.EchoResponse');
  });

  it('encodeGrpcWebProtoMessage rejects invalid request body', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    expect(() => encodeGrpcWebProtoMessage(protosetBase64, 'echo.EchoRequest', { message: 42 }))
      .toThrow(/Invalid request body for echo\.EchoRequest/);
  });

  it('lookup succeeds with dot-prefixed type and service names', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);

    const types = resolveGrpcWebMethodTypes(root, '.echo.EchoService', 'Echo');
    expect(types.requestTypeName).toBe('echo.EchoRequest');

    encodeGrpcWebProtoMessage(protosetBase64, '.echo.EchoRequest', { message: 'dot-prefix' });
    const responseBytes = encodeGrpcWebProtoMessage(
      protosetBase64,
      '.echo.EchoResponse',
      { message: 'echo: dot-prefix' },
    );
    const decoded = decodeGrpcWebProtoMessage(protosetBase64, '.echo.EchoResponse', responseBytes);
    expect(decoded.message).toBe('echo: dot-prefix');
  });

  it('loadProtobufRootFromProtosetBase64 returns cached root on repeat load', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const first = loadProtobufRootFromProtosetBase64(protosetBase64);
    const second = loadProtobufRootFromProtosetBase64(protosetBase64);
    expect(second).toBe(first);
  });

  it('loadProtobufRootFromProtosetBase64 wraps fromDescriptor failures', () => {
    const decodeSpy = vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockReturnValue({
      file: [null],
    });
    try {
      expect(() => loadProtobufRootFromProtosetBase64(btoa('stub'))).toThrow(
        /Failed to load protoset descriptor:/,
      );
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it('loadProtobufRootFromProtosetBase64 wraps non-Error decode failures', () => {
    const decodeSpy = vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockImplementation(() => {
      throw 'raw decode failure';
    });
    try {
      expect(() => loadProtobufRootFromProtosetBase64(btoa('stub'))).toThrow(
        /Failed to decode protoset: raw decode failure/,
      );
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it('lookup succeeds with short unqualified type and service names', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);

    const types = resolveGrpcWebMethodTypes(root, 'EchoService', 'Echo');
    expect(types.requestTypeName).toBe('echo.EchoRequest');

    const bytes = encodeGrpcWebProtoMessage(protosetBase64, 'EchoRequest', { message: 'short-name' });
    const decoded = decodeGrpcWebProtoMessage(protosetBase64, 'EchoResponse', bytes);
    expect(decoded.message).toBe('short-name');
  });

  it('lookupMessageType and lookupService fall back to short-name candidates', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);

    const types = resolveGrpcWebMethodTypes(root, 'prefix.echo.EchoService', 'Echo');
    expect(types.requestTypeName).toBe('echo.EchoRequest');

    const bytes = encodeGrpcWebProtoMessage(
      protosetBase64,
      'prefix.echo.EchoRequest',
      { message: 'fallback lookup' },
    );
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('loadProtobufRootFromProtosetBase64 wraps non-Error fromDescriptor failures', async () => {
    vi.spyOn(protobuf.Root as unknown as {
      fromDescriptor: (set: unknown) => protobuf.Root;
    }, 'fromDescriptor').mockImplementation(() => {
      throw 'raw descriptor failure';
    });
    vi.resetModules();
    const codec = await import('./grpcWebProtoCodec');
    const decodeSpy = vi.spyOn(descriptor.FileDescriptorSet, 'decode').mockReturnValue({
      file: [{ name: 'stub.proto' }],
    });
    try {
      expect(() => codec.loadProtobufRootFromProtosetBase64(btoa('stub'))).toThrow(
        /Failed to load protoset descriptor: raw descriptor failure/,
      );
    } finally {
      decodeSpy.mockRestore();
      vi.restoreAllMocks();
      vi.resetModules();
      await import('./grpcWebProtoCodec');
    }
  });

  it('resolveGrpcWebMethodTypes strips leading dot from resolved full names when absent', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);
    const service = root.lookupService('echo.EchoService');
    const methodDef = service.methods.Echo ?? service.methodsArray.find((entry) => entry.name === 'Echo');
    expect(methodDef?.resolvedRequestType?.fullName).toBeDefined();
    Object.defineProperty(methodDef!.resolvedRequestType!, 'fullName', { value: 'echo.EchoRequest' });
    Object.defineProperty(methodDef!.resolvedResponseType!, 'fullName', { value: 'echo.EchoResponse' });

    const types = resolveGrpcWebMethodTypes(root, 'echo.EchoService', 'Echo');
    expect(types.requestTypeName).toBe('echo.EchoRequest');
    expect(types.responseTypeName).toBe('echo.EchoResponse');
  });

  it('loadProtobufRootFromProtosetBase64 trims cache keys for cache hits', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const first = loadProtobufRootFromProtosetBase64(`  ${protosetBase64}  `);
    const second = loadProtobufRootFromProtosetBase64(protosetBase64);
    expect(second).toBe(first);
  });

  it('resolveGrpcWebMethodTypes rejects methods missing resolved message types', () => {
    const protosetBase64 = buildEchoProtosetBase64();
    const root = loadProtobufRootFromProtosetBase64(protosetBase64);
    const service = root.lookupService('echo.EchoService');
    const methodDef = service.methods.Echo ?? service.methodsArray.find((entry) => entry.name === 'Echo');
    expect(methodDef).toBeDefined();
    Object.defineProperty(methodDef!, 'resolvedRequestType', { value: undefined });

    expect(() => resolveGrpcWebMethodTypes(root, 'echo.EchoService', 'Echo'))
      .toThrow(/missing resolved message types/);
  });
});
