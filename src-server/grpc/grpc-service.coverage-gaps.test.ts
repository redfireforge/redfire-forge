/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import { clearGrpcCallRegistry, markGrpcCallCancelled } from './callRegistry.js';
import { clearDynamicProtoCodecCache } from './dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import { GrpcService } from './grpc-service.js';
import { DescriptorLoaderError } from './descriptorLoader.js';
import { createMockGrpcClientPort } from './grpc-service.testHelpers.js';
import { encodeRootAsProtosetBase64, parseProtoFiles } from './protoDescriptorParser.js';
import * as protoDescriptorParser from './protoDescriptorParser.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';
import { setDescriptorRootCache, clearDescriptorRootCache } from './descriptorRootCache.js';

describe('GrpcService coverage gaps', () => {
  beforeEach(() => {
    clearGrpcCallRegistry();
    clearGrpcDescriptorStore();
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  it('returns method-not-found when service/method pair is absent', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-missing-method',
      method: 'MissingMethod',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      expect(envelope.error.message).toContain('not found in descriptor');
    }
  });

  it('maps grpc transport errors with metadata trailers', async () => {
    const metadata = new grpc.Metadata();
    metadata.set('x-error-id', 'abc');
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      throw Object.assign(new Error('7 PERMISSION_DENIED'), {
        grpcStatus: grpc.status.PERMISSION_DENIED,
        grpcDetails: 'Access denied',
        grpcMetadata: metadata,
      });
    });
    const service = new GrpcService(mockClient);
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-grpc-meta',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect((envelope.error.details as { trailers?: Record<string, string> })?.trailers)
        .toEqual({ 'x-error-id': 'a' });
    }
  });

  it('returns export encode failure when protoset encoding throws', async () => {
    const root = parseProtoFiles([{
      path: 'echo.proto',
      content: 'syntax = "proto3"; package echo; message EchoRequest { string message = 1; } service EchoService { rpc Echo(EchoRequest) returns (EchoRequest); }',
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'export-fail-test');
    setGrpcDescriptor(descriptor);
    setDescriptorRootCache(descriptor.key, root);

    vi.spyOn(protoDescriptorParser, 'encodeRootAsProtosetBase64')
      .mockImplementation(() => { throw new Error('encode boom'); });

    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.exportProtoset({ descriptorKey: descriptor.key });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.message).toContain('Failed to encode protoset');
    }
    vi.restoreAllMocks();
  });

  it('returns cancelled when invoke throws after client cancel', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      markGrpcCallCancelled('req-abort-throw');
      throw new Error('late failure');
    });
    const service = new GrpcService(mockClient);
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-abort-throw',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
    }
  });
});

describe('exportProtoset happy path uses encodeRootAsProtosetBase64', () => {
  it('exports protoset for descriptor with cached root', async () => {
    const root = parseProtoFiles([{
      path: 'echo.proto',
      content: 'syntax = "proto3"; package echo; message EchoRequest { string message = 1; } service EchoService { rpc Echo(EchoRequest) returns (EchoRequest); }',
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'export-happy');
    setGrpcDescriptor(descriptor);
    setDescriptorRootCache(descriptor.key, root);

    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.exportProtoset({ descriptorKey: descriptor.key });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.protosetBase64).toBe(encodeRootAsProtosetBase64(root));
    }
  });

  it('returns validation error for blank descriptor key', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.exportProtoset({ descriptorKey: '   ' });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.MISSING_DESCRIPTOR_KEY);
    }
  });

  it('returns missing root error when descriptor root cache is absent', async () => {
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.exportProtoset({ descriptorKey: FIXTURE_DESCRIPTOR.key });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.message).toContain('Descriptor root is not available');
    }
  });

  it('describe returns generic parse failure for unexpected loader errors', async () => {
    const loader = {
      loadFromDescribe: vi.fn(async () => { throw 'unexpected'; }),
    };
    const service = new GrpcService(createMockGrpcClientPort(), loader as never);
    const envelope = await service.describe({
      source: 'proto_files',
      protoFiles: [{ path: 'a.proto', content: 'syntax = "proto3";' }],
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.DESCRIBE_FAILED);
      expect(envelope.error.message).toContain('unexpected');
    }
  });

  it('reflect returns generic failure for unexpected non-loader errors', async () => {
    const loader = {
      loadFromReflection: vi.fn(async () => { throw 'reflect-boom'; }),
    };
    const service = new GrpcService(createMockGrpcClientPort(), loader as never);
    const envelope = await service.reflect({
      target: { address: 'localhost:50051' },
      requestId: 'req-reflect-generic',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.message).toContain('reflect-boom');
    }
  });

  it('maps unknown descriptor loader codes for describe vs reflect', async () => {
    const loader = {
      loadFromDescribe: vi.fn(async () => {
        throw new DescriptorLoaderError('source unavailable', 'source_unavailable');
      }),
      loadFromReflection: vi.fn(async () => {
        throw new DescriptorLoaderError('source unavailable', 'source_unavailable');
      }),
    };
    const service = new GrpcService(createMockGrpcClientPort(), loader as never);
    const describeEnvelope = await service.describe({
      source: 'proto_files',
      protoFiles: [{ path: 'a.proto', content: 'syntax = "proto3"; message X { string id = 1; } service S { rpc F(X) returns (X); }' }],
    });
    const reflectEnvelope = await service.reflect({
      target: { address: 'localhost:50051' },
      requestId: 'req-unknown-code',
    });
    expect(describeEnvelope.ok).toBe(false);
    expect(reflectEnvelope.ok).toBe(false);
    if (!describeEnvelope.ok && !reflectEnvelope.ok) {
      expect(describeEnvelope.error.code).toBe(GRPC_ERROR_CODES.DESCRIBE_FAILED);
      expect(reflectEnvelope.error.code).toBe(GRPC_ERROR_CODES.REFLECTION_FAILED);
    }
  });
});
