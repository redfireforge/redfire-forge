/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIBE_REQUEST,
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
import * as dynamicProtoCodec from './dynamicProtoCodec.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';
import { setDescriptorRootCache, clearDescriptorRootCache } from './descriptorRootCache.js';
import { descriptorLoader } from './descriptorLoader.js';
import { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';
import { getGrpcCallEntry } from './callRegistry.js';

class TestGrpcMetadata {
  private values: Record<string, string> = {};

  set(key: string, value: string): void {
    this.values[key] = value;
  }

  getMap(): Record<string, string> {
    return { ...this.values };
  }
}

const grpc = {
  Metadata: TestGrpcMetadata,
  status: {
    CANCELLED: 1,
    PERMISSION_DENIED: 7,
    DEADLINE_EXCEEDED: 4,
    INTERNAL: 13,
    UNAVAILABLE: 14,
  },
} as const;

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
      protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'a.proto', content: 'syntax = "proto3";' }] }],
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
      protoRoots: [{
        id: 'root-default',
        mountPath: 'root',
        files: [{ path: 'a.proto', content: 'syntax = "proto3"; message X { string id = 1; } service S { rpc F(X) returns (X); }' }],
      }],
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

describe('GrpcService call/cancel (picked test files only)', () => {
  beforeEach(() => {
    clearGrpcCallRegistry();
    clearGrpcDescriptorStore();
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  it('returns generic transport error when invoke throws without grpcStatus', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const service = new GrpcService(mockClient);
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-generic-transport',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
    }
  });

  it('maps gRPC CANCELLED status to cancelled envelope', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      throw Object.assign(new Error('Cancelled'), {
        grpcStatus: grpc.status.CANCELLED,
        grpcDetails: 'Cancelled',
      });
    });
    const service = new GrpcService(mockClient);
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-grpc-cancelled',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
    }
  });

  it('cancel returns not found for blank requestId', () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = service.cancel('   ');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    }
  });

  it('cancel returns alreadyCompleted after successful call', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-done-cancel',
    });
    const envelope = service.cancel('req-done-cancel');
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.alreadyCompleted).toBe(true);
      expect(envelope.data.cancelled).toBe(false);
    }
  });

  it('cancel returns tab mismatch for wrong tabId', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(() => new Promise(() => {}));
    const service = new GrpcService(mockClient);
    service.call({ ...FIXTURE_UNARY_CALL_REQUEST, requestId: 'req-tab-mismatch' }, 'owner-tab');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const envelope = service.cancel('req-tab-mismatch', 'other-tab');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
    service.cancel('req-tab-mismatch', 'owner-tab');
  });

  it('cancel succeeds for in-flight call', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Call cancelled')));
    }));
    const service = new GrpcService(mockClient);
    const callPromise = service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-cancel-success',
    }, 'tab-cancel');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const cancelEnvelope = service.cancel('req-cancel-success', 'tab-cancel');
    expect(cancelEnvelope.ok).toBe(true);
    if (cancelEnvelope.ok) {
      expect(cancelEnvelope.data.cancelled).toBe(true);
    }
    const callEnvelope = await callPromise;
    expect(callEnvelope.ok).toBe(false);
  });

  it('returns successful unary call with timing breakdown', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async ({ decodeResponse }) => ({
      status: 0,
      statusMessage: 'OK',
      headers: { 'x-test': '1' },
      trailers: { 'grpc-status': '0' },
      body: decodeResponse(Buffer.from([])),
      timingBreakdown: { connectMs: 3 },
    }));
    const service = new GrpcService(mockClient);
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-success-timing',
    });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.timingBreakdown?.connectMs).toBe(3);
      expect(envelope.data.timingBreakdown?.protoSerializationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('maps descriptor loader error codes for reflect and describe', async () => {
    const cases = [
      ['unreachable', GRPC_ERROR_CODES.UNREACHABLE],
      ['invalid_descriptor', GRPC_ERROR_CODES.INVALID_DESCRIPTOR],
      ['import_resolution_failed', GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED],
      ['describe_failed', GRPC_ERROR_CODES.DESCRIBE_FAILED],
      ['reflection_failed', GRPC_ERROR_CODES.REFLECTION_FAILED],
    ] as const;
    for (const [code, expected] of cases) {
      const loader = {
        loadFromReflection: vi.fn(async () => {
          throw new DescriptorLoaderError(`fail-${code}`, code);
        }),
        loadFromDescribe: vi.fn(async () => {
          throw new DescriptorLoaderError(`fail-${code}`, code);
        }),
      };
      const service = new GrpcService(createMockGrpcClientPort(), loader as never);
      const reflectEnvelope = await service.reflect({
        target: { address: 'localhost:50051' },
        requestId: `req-${code}`,
      });
      const describeEnvelope = await service.describe({
        source: 'proto_files',
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{ path: 'a.proto', content: 'syntax = "proto3"; message X { string id = 1; } service S { rpc F(X) returns (X); }' }],
        }],
      });
      expect(reflectEnvelope.ok).toBe(false);
      expect(describeEnvelope.ok).toBe(false);
      if (!reflectEnvelope.ok && !describeEnvelope.ok) {
        expect(reflectEnvelope.error.code).toBe(expected);
        expect(describeEnvelope.error.code).toBe(expected);
        if (code === 'unreachable') {
          expect(reflectEnvelope.error.retryable).toBe(true);
        }
      }
    }
  });

  it('rejects duplicate active requestId and in-process call targets', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Call cancelled')));
    }));
    const service = new GrpcService(mockClient);

    const inProcess = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-in-process',
      target: { address: 'in-process:test-server', tlsMode: 'disabled' },
    });
    expect(inProcess.ok).toBe(false);
    if (!inProcess.ok) {
      expect(inProcess.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    }

    const first = service.call({ ...FIXTURE_UNARY_CALL_REQUEST, requestId: 'dup-req' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const duplicate = await service.call({ ...FIXTURE_UNARY_CALL_REQUEST, requestId: 'dup-req' });
    expect(duplicate.ok).toBe(false);
    service.cancel('dup-req');
    await first;
  });

  it('lookupDescriptor returns missing descriptor error', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.lookupDescriptor({ descriptorKey: 'missing-key' });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
  });

  it('exportProtoset returns missing descriptor when key is unknown', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.exportProtoset({ descriptorKey: 'missing-key' });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.message).toContain('Descriptor not found');
    }
  });
});

describe('GrpcService status/reflect/describe/auth coverage gaps', () => {
  function createOAuth2TokenService(fetch: (url: string, init?: RequestInit) => Promise<Response>) {
    return new GrpcOAuth2TokenService(
      { fetch },
      { resolveHostname: async () => ['93.184.216.34'] },
    );
  }

  beforeEach(() => {
    clearGrpcCallRegistry();
    clearGrpcDescriptorStore();
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  it('status returns reachable probe result', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.probeReachability = vi.fn(async () => ({
      reachable: true,
      latencyMs: 12,
    }));
    const service = new GrpcService(mockClient);
    const envelope = await service.status({ address: 'localhost:50051' });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.reachable).toBe(true);
      expect(envelope.data.address).toBe('localhost:50051');
    }
  });

  it('status returns validation error for blank address', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.status({ address: '   ' });
    expect(envelope.ok).toBe(false);
  });

  it('reflect and describe return descriptors on happy path', async () => {
    const loader = {
      loadFromReflection: vi.fn(async () => FIXTURE_DESCRIPTOR),
      loadFromDescribe: vi.fn(async () => FIXTURE_DESCRIPTOR),
    };
    const service = new GrpcService(createMockGrpcClientPort(), loader as never);
    const reflectEnvelope = await service.reflect({
      target: { address: 'localhost:50051' },
      requestId: 'req-reflect-ok',
    });
    const describeEnvelope = await service.describe({
      requestId: 'req-describe-ok',
      source: 'proto_files',
      protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: 'syntax = "proto3";' }] }],
    });
    expect(reflectEnvelope.ok).toBe(true);
    expect(describeEnvelope.ok).toBe(true);
  });

  it('lookupDescriptor returns descriptor when key exists', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.lookupDescriptor({ descriptorKey: FIXTURE_DESCRIPTOR.key });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.key).toBe(FIXTURE_DESCRIPTOR.key);
    }
  });

  it('classifies TLS and deadline failures on unary call', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      throw new Error('self signed certificate in certificate chain');
    });
    const tlsEnvelope = await new GrpcService(mockClient).call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-tls-gap',
    });
    expect(tlsEnvelope.ok).toBe(false);
    if (!tlsEnvelope.ok) {
      expect(tlsEnvelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    }

    mockClient.invokeUnary = vi.fn(async () => {
      throw Object.assign(new Error('Deadline Exceeded'), {
        grpcStatus: grpc.status.DEADLINE_EXCEEDED,
        grpcDetails: 'Deadline Exceeded',
      });
    });
    const deadlineEnvelope = await new GrpcService(mockClient).call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-deadline-gap',
    });
    expect(deadlineEnvelope.ok).toBe(false);
    if (!deadlineEnvelope.ok) {
      expect(deadlineEnvelope.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
    }
  });

  it('merges oauth2 auth metadata and rejects token acquisition failures', async () => {
    const fetchOk = vi.fn(async () => new Response(JSON.stringify({ access_token: 'oauth-access-token' }), { status: 200 }));
    const oauthService = new GrpcService(
      createMockGrpcClientPort(),
      descriptorLoader,
      createOAuth2TokenService(fetchOk),
    );
    await oauthService.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-oauth-gap',
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    }, 'tab-oauth');
    expect(fetchOk).toHaveBeenCalled();

    const fetchFail = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 }));
    const failService = new GrpcService(
      createMockGrpcClientPort(),
      descriptorLoader,
      createOAuth2TokenService(fetchFail),
    );
    const envelope = await failService.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-oauth-fail-gap',
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    }, 'tab-oauth');
    expect(envelope.ok).toBe(false);
    expect(getGrpcCallEntry('req-oauth-fail-gap')).toBeUndefined();
  });

  it('maps invalid_target loader code for reflect and describe', async () => {
    const loader = {
      loadFromReflection: vi.fn(async () => {
        throw new DescriptorLoaderError('bad target', 'invalid_target');
      }),
      loadFromDescribe: vi.fn(async () => {
        throw new DescriptorLoaderError('bad target', 'invalid_target');
      }),
    };
    const service = new GrpcService(createMockGrpcClientPort(), loader as never);
    const reflectEnvelope = await service.reflect({
      target: { address: 'localhost:50051' },
      requestId: 'req-invalid-target',
    });
    const describeEnvelope = await service.describe({
      requestId: 'req-invalid-target-describe',
      source: 'proto_files',
      protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'a.proto', content: 'syntax = "proto3";' }] }],
    });
    expect(reflectEnvelope.ok).toBe(false);
    expect(describeEnvelope.ok).toBe(false);
    if (!reflectEnvelope.ok && !describeEnvelope.ok) {
      expect(reflectEnvelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
      expect(describeEnvelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
    }
  });

  it('cancel returns not found for unknown requestId', () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = service.cancel('missing-request');
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    }
  });

  it('returns validation error for invalid request body encoding', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-invalid-body',
      body: { message: 123 },
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('returns cancelled when invoke resolves but call registry was cancelled', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      markGrpcCallCancelled('req-registry-cancelled');
      return {
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'late' },
      };
    });
    const service = new GrpcService(mockClient);
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-registry-cancelled',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
    }
  });

  it('status reports unreachable probe results', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.probeReachability = vi.fn(async () => ({
      reachable: false,
      latencyMs: 5,
      errorMessage: 'connection refused',
    }));
    const service = new GrpcService(mockClient);
    const envelope = await service.status({ address: 'localhost:59999' });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.reachable).toBe(false);
      expect(envelope.data.errorMessage).toMatch(/refused/i);
    }
  });

  it('merges bearer auth into unary metadata', async () => {
    const mockClient = createMockGrpcClientPort();
    const service = new GrpcService(mockClient);
    await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-bearer-gap',
      auth: { type: 'bearer', bearerToken: 'panel-token' },
    }, 'tab-bearer');
    expect(mockClient.invokeUnary).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          authorization: 'Bearer panel-token',
        }),
      }),
    );
  });

  it('classifies gRPC UNAVAILABLE with connect failure as unreachable', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      throw Object.assign(new Error('14 UNAVAILABLE'), {
        grpcStatus: grpc.status.UNAVAILABLE,
        grpcDetails: 'failed to connect to all addresses',
      });
    });
    const envelope = await new GrpcService(mockClient).call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-unavailable-gap',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    }
  });

  it('returns validation errors for reflect, describe, lookup, and call requests', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const reflectEnvelope = await service.reflect({
      target: { address: '   ' },
      requestId: 'req-reflect-invalid',
    });
    expect(reflectEnvelope.ok).toBe(false);

    const describeEnvelope = await service.describe({
      requestId: 'req-describe-invalid',
      source: 'proto_files',
      protoRoots: [],
    });
    expect(describeEnvelope.ok).toBe(false);

    const lookupEnvelope = await service.lookupDescriptor({
      descriptorKey: '   ',
      requestId: 'req-lookup-invalid',
    });
    expect(lookupEnvelope.ok).toBe(false);

    const callEnvelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: '   ',
    });
    expect(callEnvelope.ok).toBe(false);
  });

  it('reflect and describe map non-Error throws to generic failures', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    vi.spyOn(descriptorLoader, 'loadFromReflection').mockRejectedValue('reflect string failure');
    vi.spyOn(descriptorLoader, 'loadFromDescribe').mockRejectedValue('describe string failure');

    const reflectEnvelope = await service.reflect({
      target: { address: 'localhost:50051' },
      requestId: 'req-reflect-string',
    });
    const describeEnvelope = await service.describe({
      ...FIXTURE_DESCRIBE_REQUEST,
      requestId: 'req-describe-string',
    });

    expect(reflectEnvelope.ok).toBe(false);
    expect(describeEnvelope.ok).toBe(false);
    if (!reflectEnvelope.ok && !describeEnvelope.ok) {
      expect(reflectEnvelope.error.message).toContain('reflect string failure');
      expect(describeEnvelope.error.message).toContain('describe string failure');
    }
    vi.restoreAllMocks();
  });

  it('call dials trimmed target when address fails normalization after validation', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => ({
      responseBuffer: Buffer.from([]),
      grpcStatus: 0,
      grpcDetails: 'OK',
      grpcMetadata: {},
      durationMs: 5,
    }));
    const service = new GrpcService(mockClient);
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-trim-target',
      target: {
        ...FIXTURE_UNARY_CALL_REQUEST.target,
        address: '  localhost:50051  ',
      },
    });
    expect(envelope.ok).toBe(true);
    expect(mockClient.invokeUnary).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'localhost:50051' }),
    );
  });

  it('rejects Phase 1 unary call for streaming methods and missing descriptors', async () => {
    const service = new GrpcService(createMockGrpcClientPort());
    const streamingEnvelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-streaming',
      method: 'ServerStream',
    });
    expect(streamingEnvelope.ok).toBe(false);
    if (!streamingEnvelope.ok) {
      expect(streamingEnvelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }

    clearGrpcDescriptorStore();
    const missingDescriptorEnvelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-no-desc',
    });
    expect(missingDescriptorEnvelope.ok).toBe(false);
    if (!missingDescriptorEnvelope.ok) {
      expect(missingDescriptorEnvelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  it('maps encode failures to invalid_request when message is not schema-related', async () => {
    vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementation(() => {
      throw new Error('body field count mismatch');
    });
    const service = new GrpcService(createMockGrpcClientPort());
    const envelope = await service.call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-bad-body',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
    vi.restoreAllMocks();
  });

  it('maps encode failures to invalid_descriptor for schema-related messages', async () => {
    vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementation(() => {
      throw new Error('Invalid descriptor schema for echo.EchoRequest');
    });
    const envelope = await new GrpcService(createMockGrpcClientPort()).call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-schema-body',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
    vi.restoreAllMocks();
  });

  it('uses default call timeout when timeoutMs is omitted', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => ({
      responseBuffer: Buffer.from([]),
      grpcStatus: 0,
      grpcDetails: 'OK',
      grpcMetadata: {},
      durationMs: 5,
    }));
    const { timeoutMs: _ignored, ...requestWithoutTimeout } = FIXTURE_UNARY_CALL_REQUEST;
    await new GrpcService(mockClient).call({
      ...requestWithoutTimeout,
      requestId: 'req-default-timeout',
    });
    expect(mockClient.invokeUnary).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
  });

  it('maps grpc transport errors without metadata trailers', async () => {
    const mockClient = createMockGrpcClientPort();
    mockClient.invokeUnary = vi.fn(async () => {
      throw Object.assign(new Error('13 INTERNAL'), {
        grpcStatus: grpc.status.INTERNAL,
        grpcDetails: 'internal boom',
      });
    });
    const envelope = await new GrpcService(mockClient).call({
      ...FIXTURE_UNARY_CALL_REQUEST,
      requestId: 'req-no-meta',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
      expect((envelope.error.details as { trailers?: Record<string, string> })?.trailers).toBeUndefined();
    }
  });

  it('exportProtoset maps non-Error encode throws to invalid descriptor', async () => {
    const root = parseProtoFiles([{
      path: 'echo.proto',
      content: 'syntax = "proto3"; package echo; message EchoRequest { string message = 1; } service EchoService { rpc Echo(EchoRequest) returns (EchoRequest); }',
    }]);
    const descriptor = normalizeRootToDescriptor(root, 'proto_files', 'export-string-fail');
    setGrpcDescriptor(descriptor);
    setDescriptorRootCache(descriptor.key, root);
    vi.spyOn(protoDescriptorParser, 'encodeRootAsProtosetBase64').mockImplementation(() => {
      throw 'encode string boom';
    });
    const envelope = await new GrpcService(createMockGrpcClientPort()).exportProtoset({
      descriptorKey: descriptor.key,
      requestId: 'req-export-string',
    });
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.message).toContain('encode string boom');
    }
    vi.restoreAllMocks();
  });
});
