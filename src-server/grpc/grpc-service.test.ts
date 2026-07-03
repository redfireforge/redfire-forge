/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GRPC_ERROR_CODES,
} from '../../src/shared/grpc/contracts.js';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIBE_REQUEST,
  FIXTURE_ECHO_PROTO,
  FIXTURE_REFLECT_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { clearGrpcCallRegistry } from '../grpc/callRegistry.js';
import { clearDynamicProtoCodecCache } from '../grpc/dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from '../grpc/descriptorStore.js';
import { clearDescriptorCacheManager } from '../grpc/descriptorCacheManager.js';
import { clearDescriptorRootCache } from '../grpc/descriptorRootCache.js';
import { DescriptorLoader, DescriptorLoaderError } from './descriptorLoader.js';
import { GrpcService } from '../grpc/grpc-service.js';
import type { GrpcClientPort } from '../grpc/grpcClient.js';
import { parseProtoFiles } from '../grpc/protoDescriptorParser.js';
import { createMockGrpcClientPort } from './grpc-service.testHelpers.js';

describe('GrpcService', () => {
  let mockClient: GrpcClientPort;
  let service: GrpcService;

  beforeEach(() => {
    clearGrpcCallRegistry();
    clearGrpcDescriptorStore();
    clearDescriptorCacheManager();
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    mockClient = createMockGrpcClientPort();
    service = new GrpcService(mockClient);
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  describe('status', () => {
    it('returns reachable result for host:port', async () => {
      const envelope = await service.status({
        address: 'localhost:50051',
        tlsMode: 'disabled',
      });

      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.reachable).toBe(true);
        expect(envelope.data.latencyMs).toBe(5);
      }
    });

    it('returns validation error for missing address', async () => {
      const envelope = await service.status({ address: '' });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
      }
    });

    it('probes reachability even when tlsMode is tls (TCP-only in Phase 1B)', async () => {
      const envelope = await service.status({
        address: 'localhost:50051',
        tlsMode: 'tls',
      });
      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.tlsMode).toBe('tls');
        expect(envelope.data.reachable).toBe(true);
      }
      expect(mockClient.probeReachability).toHaveBeenCalled();
    });

    it('returns unreachable for in-process targets', async () => {
      mockClient.probeReachability = vi.fn(async () => ({
        reachable: false,
        errorMessage: 'in-process targets are not dialable from the Node server (Phase 1B)',
      }));

      const envelope = await service.status({
        address: 'in-process:test-server',
        tlsMode: 'disabled',
      });

      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.reachable).toBe(false);
        expect(envelope.data.address).toBe('in-process:test-server');
      }
    });
  });

  describe('reflect/describe', () => {
    it('returns descriptor from describe proto_files source', async () => {
      const describeService = new GrpcService(mockClient, new DescriptorLoader());
      const envelope = await describeService.describe(FIXTURE_DESCRIBE_REQUEST);
      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.services[0]?.fullName).toBe('echo.EchoService');
        expect(envelope.data.key).toMatch(/^proto_files:/);
        expect(envelope.data.sourceFingerprint?.contentSha256).toBe(envelope.data.contentSha256);
      }
    });

    it('returns reflection descriptor when loader succeeds', async () => {
      const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
      const reflectService = new GrpcService(mockClient, new DescriptorLoader({
        fetchReflectionRoot: vi.fn(async () => ({
          root,
          reflectionVersion: 'v1',
          serviceNames: ['echo.EchoService'],
        })),
      }));
      const envelope = await reflectService.reflect(FIXTURE_REFLECT_REQUEST);
      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.source).toBe('reflection');
        expect(envelope.data.sourceFingerprint).toMatchObject({
          source: 'reflection',
          sourceRef: 'localhost:50051',
          contentSha256: envelope.data.contentSha256,
          reflectionVersion: 'v1',
        });
        expect(envelope.data.services[0]?.methods.map((m) => m.name).sort()).toEqual([
          'BidiStream',
          'ClientStream',
          'Echo',
          'ServerStream',
        ]);
      }
    });

    it('returns invalid_target when loader rejects malformed reflection target', async () => {
      const reflectService = new GrpcService(mockClient, {
        loadFromReflection: vi.fn(async () => {
          throw new DescriptorLoaderError(
            'Target must be host:port or in-process:<name>',
            'invalid_target',
          );
        }),
        loadFromDescribe: vi.fn(),
      } as unknown as DescriptorLoader);

      const envelope = await reflectService.reflect(FIXTURE_REFLECT_REQUEST);
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
      }
    });

    it('returns reflection_failed when loader cannot reflect', async () => {
      const reflectService = new GrpcService(mockClient, new DescriptorLoader({
        fetchReflectionRoot: vi.fn(async () => {
          throw new Error('UNIMPLEMENTED');
        }),
      }));
      const envelope = await reflectService.reflect(FIXTURE_REFLECT_REQUEST);
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REFLECTION_FAILED);
      }
    });

    it('returns unreachable for in-process reflect targets', async () => {
      const envelope = await service.reflect({
        target: { address: 'in-process:test-server', tlsMode: 'disabled' },
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
      }
    });

    it('reflect proceeds with TLS target and calls loader (Phase 4F)', async () => {
      const loadFromReflection = vi.fn(async () => FIXTURE_DESCRIPTOR);
      const reflectService = new GrpcService(mockClient, {
        loadFromReflection,
      } as unknown as DescriptorLoader);

      const envelope = await reflectService.reflect({
        target: { address: 'localhost:50051', tlsMode: 'tls' },
      });

      expect(envelope.ok).toBe(true);
      expect(loadFromReflection).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ tlsMode: 'tls' }),
        }),
      );
    });

    it('reflect returns tlsFailure details when TLS dial fails (Phase 4F)', async () => {
      const reflectService = new GrpcService(mockClient, new DescriptorLoader({
        fetchReflectionRoot: vi.fn(async () => {
          throw new Error('self signed certificate in certificate chain');
        }),
      }));
      const envelope = await reflectService.reflect({
        target: { address: 'localhost:50051', tlsMode: 'tls' },
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
        expect(envelope.error.message).toMatch(/not trusted/i);
        expect((envelope.error.details as { tlsFailure?: string })?.tlsFailure).toBe('unknown_ca');
      }
    });

    it('rejects incomplete mtls config on reflect before transport check (Phase 4A)', async () => {
      const envelope = await service.reflect({
        target: { address: 'localhost:50051', tlsMode: 'mtls' },
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      }
    });

    it('returns describe_failed for malformed proto content', async () => {
      const envelope = await service.describe({
        source: 'proto_files',
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{ path: 'broken.proto', content: 'this is not valid proto' }],
        }],
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.DESCRIBE_FAILED);
      }
    });

    it('returns describe_failed when user proto path collides with bundled WKT path', async () => {
      const envelope = await service.describe({
        source: 'proto_files',
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{
            path: 'google/protobuf/timestamp.proto',
            content: 'syntax = "proto3"; package google.protobuf; message Timestamp { int64 seconds = 1; }',
          }],
        }],
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.DESCRIBE_FAILED);
        expect(envelope.error.message).toMatch(/duplicate name|timestamp\.proto/i);
      }
    });

    it('returns import_resolution_failed for unresolved proto imports', async () => {
      const envelope = await service.describe({
        source: 'proto_files',
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{
            path: 'broken.proto',
            content: `syntax = "proto3";
package broken;
import "missing/vendor.proto";
message Empty {}
service Broken { rpc Ping(Empty) returns (Empty); }`,
          }],
        }],
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED);
        expect(envelope.error.message).toContain('missing/vendor.proto');
      }
    });

    it('returns invalid_descriptor when proto source has no services', async () => {
      const envelope = await service.describe({
        source: 'proto_files',
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{
            path: 'messages.proto',
            content: 'syntax = "proto3"; message OnlyMessage { string id = 1; }',
          }],
        }],
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      }
    });

    it('returns describe_failed when url_proto fetch target is blocked by SSRF policy', async () => {
      const envelope = await service.describe({
        source: 'url_proto',
        url: 'https://192.168.0.10/private/echo.proto',
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.DESCRIBE_FAILED);
        expect(envelope.error.message).toMatch(/private network/i);
      }
    });
  });

  describe('exportProtoset', () => {
    it('returns protoset bytes when descriptor root is cached', async () => {
      const describeEnvelope = await service.describe({
        source: 'proto_files',
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
        }],
      });
      expect(describeEnvelope.ok).toBe(true);
      if (!describeEnvelope.ok) return;

      const envelope = await service.exportProtoset({
        requestId: 'export-1',
        descriptorKey: describeEnvelope.data.key,
      });
      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.protosetBase64.length).toBeGreaterThan(0);
        expect(envelope.data.fileName).toMatch(/\.pb$/);
      }
    });

    it('returns invalid_descriptor when root cache is missing', async () => {
      const envelope = await service.exportProtoset({
        descriptorKey: 'missing-key',
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      }
    });

    it('exports protoset after describe cache hit restores root cache', async () => {
      const describeRequest = {
        source: 'proto_files' as const,
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
        }],
      };
      const first = await service.describe(describeRequest);
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      clearDescriptorRootCache();

      const second = await service.describe(describeRequest);
      expect(second.ok).toBe(true);
      if (!second.ok) return;

      const exportEnvelope = await service.exportProtoset({
        descriptorKey: second.data.key,
      });
      expect(exportEnvelope.ok).toBe(true);
      if (exportEnvelope.ok) {
        expect(exportEnvelope.data.protosetBase64.length).toBeGreaterThan(0);
      }
    });
  });

  describe('lookupDescriptor', () => {
    it('returns descriptor JSON when key exists in store', async () => {
      const describeEnvelope = await service.describe({
        source: 'proto_files',
        protoRoots: [{
          id: 'root-default',
          mountPath: 'root',
          files: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
        }],
      });
      expect(describeEnvelope.ok).toBe(true);
      if (!describeEnvelope.ok) return;

      const envelope = await service.lookupDescriptor({
        requestId: 'lookup-1',
        descriptorKey: describeEnvelope.data.key,
      });
      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.key).toBe(describeEnvelope.data.key);
        expect(envelope.op).toBe('lookup_descriptor');
      }
    });

    it('returns invalid_descriptor when key is missing', async () => {
      const envelope = await service.lookupDescriptor({
        descriptorKey: 'missing-key',
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      }
    });
  });
});
