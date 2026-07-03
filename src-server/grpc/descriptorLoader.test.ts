/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import protobuf from 'protobufjs';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIBE_REQUEST,
  FIXTURE_ECHO_PROTO,
  FIXTURE_REFLECT_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { clearGrpcDescriptorStore, getGrpcDescriptor } from './descriptorStore.js';
import { clearDescriptorCacheManager } from './descriptorCacheManager.js';
import { getDescriptorRootCache } from './descriptorRootCache.js';
import {
  DescriptorLoader,
  DescriptorLoaderError,
  descriptorsHaveEquivalentSignatures,
} from './descriptorLoader.js';
import { encodeProtoMessage } from './dynamicProtoCodec.js';
import { parseProtoFiles, encodeRootAsProtosetBase64 } from './protoDescriptorParser.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';
import type { ReflectionClientPort } from './reflectionClient.js';

function createMockReflectionClient(root: protobuf.Root): ReflectionClientPort {
  return {
    fetchReflectionRoot: vi.fn(async () => ({
      root,
      reflectionVersion: 'v1',
      serviceNames: ['echo.EchoService'],
    })),
  };
}

describe('descriptorLoader', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
    clearDescriptorCacheManager();
  });

  it('loads describe proto_files into descriptor store', async () => {
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    expect(descriptor.source).toBe('proto_files');
    expect(descriptor.key).toMatch(/^proto_files:/);
    expect(descriptor.key.endsWith(descriptor.contentSha256 ?? '')).toBe(true);
    expect(descriptor.sourceFingerprint).toMatchObject({
      source: 'proto_files',
      contentSha256: descriptor.contentSha256,
    });
    expect(descriptor.sourceFingerprint?.resolvedAt).toBeTruthy();
    expect(getGrpcDescriptor(descriptor.key)).toEqual(descriptor);
    expect(descriptor.services[0]?.methods.map((m) => m.name).sort()).toEqual([
      'BidiStream',
      'ClientStream',
      'Echo',
      'ServerStream',
    ]);
  });

  it('loads protoset describe source with equivalent signatures', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    const loader = new DescriptorLoader();
    const protoDescriptor = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    clearGrpcDescriptorStore();
    clearDescriptorCacheManager();
    const protosetDescriptor = await loader.loadFromDescribe({
      source: 'protoset',
      protosetBase64,
    });
    expect(protosetDescriptor.sourceFingerprint).toMatchObject({
      source: 'protoset',
      contentSha256: protosetDescriptor.contentSha256,
    });
    expect(protosetDescriptor.sourceFingerprint?.sourceRef).toBeTruthy();
    expect(descriptorsHaveEquivalentSignatures(protoDescriptor, protosetDescriptor)).toBe(true);
  });

  it('reuses descriptor cache for identical proto_files describe requests', async () => {
    const loader = new DescriptorLoader();
    const first = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    const second = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    expect(second.key).toBe(first.key);
    expect(second).toEqual(first);
  });

  it('loads describe proto_files from protoRoots payload', async () => {
    const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const apiProto = `syntax = "proto3";
package api;
import "common.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe({
      source: 'proto_files',
      protoRoots: [
        {
          id: 'shared-root',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: commonProto }],
        },
        {
          id: 'api-root',
          mountPath: 'api',
          files: [{ path: 'service.proto', content: apiProto }],
        },
      ],
    });
    expect(descriptor.source).toBe('proto_files');
    expect(descriptor.services[0]?.fullName).toBe('api.ApiService');
  });

  it('does not reuse proto_files cache when importPaths differ', async () => {
    const apiProto = `syntax = "proto3";
package api;
import "pkg/types.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;
    const vendorTypes = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
    const otherTypes = `syntax = "proto3";
package common;
message Shared { string id = 1; string extra = 2; }`;

    const loader = new DescriptorLoader();
    const baseFiles = [
      { path: 'api/service.proto', content: apiProto },
    ];
    const withVendor = await loader.loadFromDescribe({
      source: 'proto_files',
      protoFiles: [
        ...baseFiles,
        { path: 'vendor/pkg/types.proto', content: vendorTypes },
      ],
      importPaths: ['vendor'],
    });
    clearGrpcDescriptorStore();
    const withOther = await loader.loadFromDescribe({
      source: 'proto_files',
      protoFiles: [
        ...baseFiles,
        { path: 'other/pkg/types.proto', content: otherTypes },
      ],
      importPaths: ['other'],
    });
    expect(withOther.key).not.toBe(withVendor.key);
    expect(withVendor.contentSha256).not.toBe(withOther.contentSha256);
  });

  it('loads reflection descriptors via client port', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const loader = new DescriptorLoader(createMockReflectionClient(root));
    const descriptor = await loader.loadFromReflection(FIXTURE_REFLECT_REQUEST);
    expect(descriptor.source).toBe('reflection');
    expect(descriptor.key).toMatch(/^reflection:localhost:50051:/);
    expect(descriptor.key.endsWith(descriptor.contentSha256 ?? '')).toBe(true);
    expect(descriptor.sourceFingerprint).toMatchObject({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: descriptor.contentSha256,
      reflectionVersion: 'v1',
    });
    expect(descriptor.sourceFingerprint?.resolvedAt).toBeTruthy();
    expect(descriptorsHaveEquivalentSignatures(descriptor, FIXTURE_DESCRIPTOR)).toBe(true);
  });

  it('always re-fetches reflection from target so schema drift can detect server changes', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const client = createMockReflectionClient(root);
    const loader = new DescriptorLoader(client);
    const first = await loader.loadFromReflection(FIXTURE_REFLECT_REQUEST);
    const second = await loader.loadFromReflection(FIXTURE_REFLECT_REQUEST);
    expect(client.fetchReflectionRoot).toHaveBeenCalledTimes(2);
    expect(second.key).toBe(first.key);
    expect(getGrpcDescriptor(second.key)).toBeDefined();
    expect(getDescriptorRootCache(second.key)).toBeDefined();
  });

  it('rejects in-process reflection targets', async () => {
    const loader = new DescriptorLoader(createMockReflectionClient(parseProtoFiles([
      { path: 'echo.proto', content: FIXTURE_ECHO_PROTO },
    ])));
    await expect(loader.loadFromReflection({
      target: { address: 'in-process:test', tlsMode: 'disabled' },
    })).rejects.toMatchObject({ code: 'unreachable' });
  });

  it('rejects invalid reflection targets with invalid_target code', async () => {
    const loader = new DescriptorLoader(createMockReflectionClient(parseProtoFiles([
      { path: 'echo.proto', content: FIXTURE_ECHO_PROTO },
    ])));
    await expect(loader.loadFromReflection({
      target: { address: 'not-a-target', tlsMode: 'disabled' },
    })).rejects.toMatchObject({
      code: 'invalid_target',
      message: expect.stringContaining('host:port'),
    });
  });

  it('maps reflection client unreachable errors', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:50051');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST)).rejects.toMatchObject({
      code: 'unreachable',
    });
  });

  it('maps reflection unavailable errors', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('UNIMPLEMENTED: reflection not enabled');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST)).rejects.toMatchObject({
      code: 'reflection_failed',
      message: expect.stringContaining('Server reflection is not enabled'),
    });
  });

  it('preserves no matching services message without mislabeling reflection disabled', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('No matching services found via reflection (requested: missing.Service)');
      }),
    });
    await expect(loader.loadFromReflection({
      ...FIXTURE_REFLECT_REQUEST,
      serviceNames: ['missing.Service'],
    })).rejects.toMatchObject({
      code: 'reflection_failed',
      message: 'No matching services found via reflection (requested: missing.Service)',
    });
  });

  it('returns invalid_descriptor when proto source has no services', async () => {
    const loader = new DescriptorLoader();
    let caught: DescriptorLoaderError | undefined;
    try {
      await loader.loadFromDescribe({
        source: 'proto_files',
        protoFiles: [{
          path: 'messages.proto',
          content: 'syntax = "proto3"; message OnlyMessage { string id = 1; }',
        }],
      });
    } catch (error) {
      caught = error as DescriptorLoaderError;
    }
    expect(caught).toBeInstanceOf(DescriptorLoaderError);
    expect(caught?.code).toBe('invalid_descriptor');
  });

  it('maps TLS dial failures from reflection to unreachable with friendly message (Phase 4F)', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('self signed certificate in certificate chain');
      }),
    });
    await expect(loader.loadFromReflection({
      ...FIXTURE_REFLECT_REQUEST,
      target: { address: 'localhost:50051', tlsMode: 'tls' },
    })).rejects.toMatchObject({
      code: 'unreachable',
      message: expect.stringMatching(/not trusted/i),
      transportDetails: { tlsFailure: 'unknown_ca' },
    });
  });

  it('registers descriptors compatible with dynamicProtoCodec', async () => {
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    const encoded = encodeProtoMessage(descriptor, 'echo.EchoRequest', { message: 'codec-check' });
    expect(encoded.length).toBeGreaterThan(0);
  });
});

describe('descriptorLoader normalization parity', () => {
  it('matches fixture signatures from parsed echo proto root', () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const normalized = normalizeRootToDescriptor(root, 'proto_files', 'tmp');
    expect(descriptorsHaveEquivalentSignatures(normalized, FIXTURE_DESCRIPTOR)).toBe(true);
  });
});
