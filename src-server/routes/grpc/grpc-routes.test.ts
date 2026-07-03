/**
 * @vitest-environment node
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrpcRouter } from './grpc-routes.js';
import {
  createGrpcErrorEnvelope,
  createGrpcSuccessEnvelope,
  GRPC_ERROR_CODES,
} from '../../../src/shared/grpc/contracts.js';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIBE_REQUEST,
  FIXTURE_UNARY_CALL_REQUEST,
  FIXTURE_UNARY_CALL_RESULT,
  FIXTURE_CLIENT_STREAM_START_REQUEST,
  FIXTURE_SERVER_STREAM_START_REQUEST,
  FIXTURE_STREAM_START_RESPONSE,
} from '../../../src/shared/grpc/contractFixtures.js';
import type { GrpcService } from '../../grpc/grpc-service.js';
import { GrpcStreamService, type GrpcStreamService as GrpcStreamServiceType } from '../../grpc/grpc-stream-service.js';
import { GrpcService as GrpcServiceImpl } from '../../grpc/grpc-service.js';
import { clearGrpcCallRegistry, tryRegisterGrpcCall } from '../../grpc/callRegistry.js';
import { clearDynamicProtoCodecCache } from '../../grpc/dynamicProtoCodec.js';
import { clearDescriptorCacheManager } from '../../grpc/descriptorCacheManager.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from '../../grpc/descriptorStore.js';
import { clearGrpcStreamRegistry } from '../../grpc/streamRegistry.js';
import type { GrpcStreamingClientFactory } from '../../grpc/grpcStreamingClient.js';
import { resetGrpcDescribeUsageTelemetry } from '../../grpc/grpcDescribeUsageTelemetry.js';
import { resetGrpcRoutePerformanceTelemetry } from '../../grpc/grpcRoutePerformanceTelemetry.js';
import type {
  GrpcK8sPortForwardManager,
  GrpcK8sPortForwardState,
} from '../../grpc/grpcK8sPortForwardManager.js';

function createMockService(): GrpcService {
  return {
    status: vi.fn(async () => createGrpcSuccessEnvelope('status', {
      reachable: true,
      address: 'localhost:50051',
      tlsMode: 'disabled',
      latencyMs: 3,
    })),
    reflect: vi.fn(async () => createGrpcSuccessEnvelope('reflect', FIXTURE_DESCRIPTOR, {
      requestId: 'req-reflect-001',
    })),
    describe: vi.fn(() => createGrpcSuccessEnvelope('describe', FIXTURE_DESCRIPTOR, {
      requestId: 'req-describe-001',
    })),
    exportProtoset: vi.fn(() => createGrpcSuccessEnvelope('export_protoset', {
      protosetBase64: 'cHJvdG8=',
      fileName: 'grpc-proto_files-deadbeef.pb',
    }, {
      requestId: 'req-export-001',
    })),
    lookupDescriptor: vi.fn(() => createGrpcSuccessEnvelope('lookup_descriptor', FIXTURE_DESCRIPTOR, {
      requestId: 'req-lookup-001',
    })),
    call: vi.fn(async () => createGrpcSuccessEnvelope('call', FIXTURE_UNARY_CALL_RESULT, {
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
    })),
    cancel: vi.fn(() => createGrpcSuccessEnvelope('cancel', {
      requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      cancelled: true,
    })),
  } as unknown as GrpcService;
}

function createMockStreamService(): GrpcStreamServiceType {
  return {
    startStream: vi.fn(() => createGrpcSuccessEnvelope('stream_start', FIXTURE_STREAM_START_RESPONSE, {
      requestId: FIXTURE_SERVER_STREAM_START_REQUEST.requestId,
    })),
    attachStreamEvents: vi.fn(() => null),
    sendStreamMessage: vi.fn(() => createGrpcSuccessEnvelope('stream_send', {
      streamId: FIXTURE_STREAM_START_RESPONSE.streamId,
      tabId: FIXTURE_STREAM_START_RESPONSE.tabId,
      sequence: 1,
    })),
    endStream: vi.fn(() => createGrpcSuccessEnvelope('stream_end', {
      streamId: FIXTURE_STREAM_START_RESPONSE.streamId,
      requestId: FIXTURE_STREAM_START_RESPONSE.requestId,
      tabId: FIXTURE_STREAM_START_RESPONSE.tabId,
      ended: true,
    })),
    cancelStream: vi.fn(() => createGrpcSuccessEnvelope('stream_cancel', {
      streamId: FIXTURE_STREAM_START_RESPONSE.streamId,
      requestId: FIXTURE_STREAM_START_RESPONSE.requestId,
      tabId: FIXTURE_STREAM_START_RESPONSE.tabId,
      cancelled: true,
    })),
  } as unknown as GrpcStreamServiceType;
}

function createMockK8sPortForwardManager(): GrpcK8sPortForwardManager {
  return {
    getStatus: vi.fn((_scopeId: string) => ({
      scopeId: 'tab-1',
      active: false,
    } satisfies GrpcK8sPortForwardState)),
    startPortForward: vi.fn(async (_scopeId: string) => ({
      scopeId: 'tab-1',
      active: true,
      pid: 999,
      target: 'localhost:50051',
      command: 'kubectl port-forward -n default svc/echo 50051:50051',
      config: {
        namespace: 'default',
        targetType: 'service',
        name: 'echo',
        remotePort: 50051,
        localPort: 50051,
        context: '',
      },
    } satisfies GrpcK8sPortForwardState)),
    stopPortForward: vi.fn(async (_scopeId: string) => ({
      scopeId: 'tab-1',
      active: false,
    } satisfies GrpcK8sPortForwardState)),
    getLogs: vi.fn((_scopeId: string, _afterSeq?: number) => ({
      scopeId: 'tab-1',
      lines: [{ seq: 1, ts: '2026-07-01T00:00:00.000Z', stream: 'system', text: 'starting...' }],
      latestSeq: 1,
    })),
    clearLogs: vi.fn((_scopeId: string) => ({
      scopeId: 'tab-1',
      latestSeq: 1,
    })),
    stopAll: vi.fn(async () => {}),
  } as unknown as GrpcK8sPortForwardManager;
}

function buildApp(
  service: GrpcService,
  streamService?: GrpcStreamServiceType,
  k8sPortForwardManager?: GrpcK8sPortForwardManager,
) {
  const app = express();
  app.use(express.json());
  app.use(createGrpcRouter({ service, streamService, k8sPortForwardManager }));
  return app;
}

describe('grpc-routes', () => {
  let mockService: GrpcService;
  let mockStreamService: GrpcStreamServiceType;
  let mockK8sPortForwardManager: GrpcK8sPortForwardManager;
  let app: express.Express;

  beforeEach(() => {
    resetGrpcDescribeUsageTelemetry();
    resetGrpcRoutePerformanceTelemetry();
    mockService = createMockService();
    mockStreamService = createMockStreamService();
    mockK8sPortForwardManager = createMockK8sPortForwardManager();
    app = buildApp(mockService, mockStreamService, mockK8sPortForwardManager);
  });

  describe('GET /api/grpc/status', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app)
        .get('/api/grpc/status')
        .query({ address: 'localhost:50051' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.op).toBe('status');
      expect(mockService.status).toHaveBeenCalledWith(
        expect.objectContaining({ address: 'localhost:50051' }),
      );
    });

    it('returns 400 when address is missing', async () => {
      mockService.status = vi.fn(async () => createGrpcErrorEnvelope('status', {
        code: GRPC_ERROR_CODES.INVALID_TARGET,
        message: 'address query parameter is required',
      }));

      const res = await request(app).get('/api/grpc/status');
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('POST /api/grpc/reflect', () => {
    it('returns 200 with descriptor envelope', async () => {
      const res = await request(app)
        .post('/api/grpc/reflect')
        .send({ target: { address: 'localhost:50051', tlsMode: 'disabled' } });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.services[0]?.fullName).toBe('echo.EchoService');
    });

    it('returns 400 when body is an array', async () => {
      const res = await request(app)
        .post('/api/grpc/reflect')
        .send([]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });
  });

  describe('POST /api/grpc/describe', () => {
    it('returns 200 with descriptor envelope', async () => {
      const res = await request(app)
        .post('/api/grpc/describe')
        .send({
          source: 'proto_files',
          protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.key).toBeDefined();
    });

    it('passes protoRoots payload through to service.describe', async () => {
      const payload = {
        source: 'proto_files',
        protoRoots: [
          {
            id: 'shared-root',
            mountPath: 'shared',
            files: [{ path: 'common.proto', content: 'syntax = "proto3"; package common;' }],
          },
          {
            id: 'api-root',
            mountPath: 'api',
            files: [{
              path: 'service.proto',
              content: 'syntax = "proto3"; package api; import "common.proto"; message Empty {} service Api { rpc Ping(Empty) returns (Empty); }',
            }],
          },
        ],
      } as const;

      const res = await request(app)
        .post('/api/grpc/describe')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mockService.describe).toHaveBeenCalledWith(expect.objectContaining({
        source: 'proto_files',
        protoRoots: payload.protoRoots,
      }));
    });

    it('adds deprecation headers for legacy protoFiles-only payloads', async () => {
      const res = await request(app)
        .post('/api/grpc/describe')
        .send({
          source: 'proto_files',
          protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";' }],
        });

      expect(res.status).toBe(200);
      expect(res.headers.warning).toContain('deprecated');
      expect(res.headers['x-redfireforge-protofiles-deprecated']).toBe('true');
    });

    it('tracks describe usage across protoRoots, legacy protoFiles, and protoset requests', async () => {
      await request(app)
        .post('/api/grpc/describe')
        .send({
          source: 'proto_files',
          protoRoots: [{
            id: 'root-1',
            mountPath: 'shared',
            files: [{ path: 'common.proto', content: 'syntax = "proto3"; package common;' }],
          }],
        });

      await request(app)
        .post('/api/grpc/describe')
        .send({
          source: 'proto_files',
          protoFiles: [{ path: 'legacy.proto', content: 'syntax = "proto3";' }],
        });

      await request(app)
        .post('/api/grpc/describe')
        .send({
          source: 'protoset',
          protosetBase64: 'cHJvdG8=',
        });

      await request(app)
        .get('/api/grpc/k8s-port-forward/status')
        .query({ scopeId: 'phase13b-test' });

      const usage = await request(app).get('/api/grpc/describe/usage');
      expect(usage.status).toBe(200);
      expect(usage.body.ok).toBe(true);
      expect(usage.body.data.total).toBe(3);
      expect(usage.body.data.protoRoots).toBe(1);
      expect(usage.body.data.protoFilesLegacy).toBe(1);
      expect(usage.body.data.protoset).toBe(1);

      const perf = await request(app).get('/api/grpc/perf/snapshot');
      expect(perf.status).toBe(200);
      expect(perf.body.ok).toBe(true);
      expect(perf.body.data.routes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ routeId: 'describe', count: 3 }),
          expect.objectContaining({ routeId: 'describe_usage', count: 1 }),
          expect.objectContaining({ routeId: 'k8s_status', count: 1 }),
        ]),
      );
    });
  });

  describe('POST /api/grpc/export-protoset', () => {
    it('returns 200 with protoset payload', async () => {
      const res = await request(app)
        .post('/api/grpc/export-protoset')
        .send({ descriptorKey: FIXTURE_DESCRIPTOR.key });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.fileName).toContain('.pb');
      expect(mockService.exportProtoset).toHaveBeenCalled();
    });
  });

  describe('POST /api/grpc/descriptor/lookup', () => {
    it('returns 200 with descriptor payload', async () => {
      const res = await request(app)
        .post('/api/grpc/descriptor/lookup')
        .send({ descriptorKey: FIXTURE_DESCRIPTOR.key });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.key).toBe(FIXTURE_DESCRIPTOR.key);
      expect(mockService.lookupDescriptor).toHaveBeenCalled();
    });
  });

  describe('POST /api/grpc/call', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app)
        .post('/api/grpc/call')
        .query({ tabId: 'tab-1' })
        .send(FIXTURE_UNARY_CALL_REQUEST);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.body).toEqual({ message: 'hello grpc' });
      expect(mockService.call).toHaveBeenCalledWith(
        FIXTURE_UNARY_CALL_REQUEST,
        'tab-1',
      );
    });

    it('maps validation error envelopes to HTTP 400', async () => {
      mockService.call = vi.fn(async () => createGrpcErrorEnvelope('call', {
        code: GRPC_ERROR_CODES.INVALID_TARGET,
        message: 'Target must be host:port or in-process:<name>',
      }));

      const res = await request(app)
        .post('/api/grpc/call')
        .send({ ...FIXTURE_UNARY_CALL_REQUEST, target: { address: 'bad', tlsMode: 'disabled' } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
    });

    it('returns 400 when call body is not a JSON object', async () => {
      const res = await request(app)
        .post('/api/grpc/call')
        .send([]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      expect(mockService.call).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/grpc/call/:requestId', () => {
    it('returns 200 when cancelled', async () => {
      const res = await request(app)
        .delete(`/api/grpc/call/${FIXTURE_UNARY_CALL_REQUEST.requestId}`)
        .query({ tabId: 'tab-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.cancelled).toBe(true);
      expect(mockService.cancel).toHaveBeenCalledWith(
        FIXTURE_UNARY_CALL_REQUEST.requestId,
        'tab-1',
      );
    });

    it('returns 404 when request is unknown', async () => {
      mockService.cancel = vi.fn(() => createGrpcErrorEnvelope('cancel', {
        code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'No in-flight call registered for requestId',
      }));

      const res = await request(app)
        .delete('/api/grpc/call/missing-id');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    });

    it('returns 409 when tabId mismatches', async () => {
      mockService.cancel = vi.fn(() => createGrpcErrorEnvelope('cancel', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: 'tabId does not match the registered call',
      }));

      const res = await request(app)
        .delete(`/api/grpc/call/${FIXTURE_UNARY_CALL_REQUEST.requestId}`)
        .query({ tabId: 'wrong-tab' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });
  });

  describe('integration with GrpcService', () => {
    beforeEach(() => {
      clearGrpcCallRegistry();
      clearGrpcDescriptorStore();
      clearDescriptorCacheManager();
      clearDynamicProtoCodecCache();
      setGrpcDescriptor(FIXTURE_DESCRIPTOR);
      app = buildApp(new GrpcServiceImpl({
        probeReachability: vi.fn(async () => ({ reachable: true, latencyMs: 2 })),
        invokeUnary: vi.fn(({ signal }) => new Promise((_resolve, reject) => {
          if (signal.aborted) {
            reject(new Error('Call cancelled'));
            return;
          }
          signal.addEventListener('abort', () => reject(new Error('Call cancelled')));
        })),
      }));
    });

    it('describe returns real descriptor via GrpcService', async () => {
      const res = await request(app)
        .post('/api/grpc/describe')
        .send(FIXTURE_DESCRIBE_REQUEST);

      expect(res.status).toBe(200);
      expect(res.body.data.services[0]?.methods.map((m: { name: string }) => m.name).sort()).toEqual([
        'BidiStream',
        'ClientStream',
        'Echo',
        'ServerStream',
      ]);
      expect(res.body.data.key).toMatch(/^proto_files:/);
    });

    it('describe returns real descriptor from protoRoots payload via GrpcService', async () => {
      const commonProto = `syntax = "proto3";
package common;
message Shared { string id = 1; }`;
      const apiProto = `syntax = "proto3";
package api;
import "common.proto";
message Request { common.Shared ref = 1; }
message Response { string ok = 1; }
service ApiService { rpc Call(Request) returns (Response); }`;

      const res = await request(app)
        .post('/api/grpc/describe')
        .send({
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

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.services[0]?.fullName).toBe('api.ApiService');
      expect(res.body.data.key).toMatch(/^proto_files:/);
    });

    it('returns 400 when describe source has no gRPC services', async () => {
      const res = await request(app)
        .post('/api/grpc/describe')
        .send({
          source: 'proto_files',
          protoFiles: [{
            path: 'messages.proto',
            content: 'syntax = "proto3"; message OnlyMessage { string id = 1; }',
          }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    });

    it('describe then call uses returned descriptorKey from store', async () => {
      app = buildApp(new GrpcServiceImpl({
        probeReachability: vi.fn(async () => ({ reachable: true, latencyMs: 2 })),
        invokeUnary: vi.fn(async ({ decodeResponse, requestBuffer }) => ({
          status: 0,
          statusMessage: 'OK',
          headers: {},
          trailers: {},
          body: decodeResponse(requestBuffer),
        })),
      }));

      const describeRes = await request(app)
        .post('/api/grpc/describe')
        .send(FIXTURE_DESCRIBE_REQUEST);

      expect(describeRes.status).toBe(200);
      const descriptorKey = describeRes.body.data.key as string;

      const callRes = await request(app)
        .post('/api/grpc/call')
        .send({
          callType: 'unary',
          requestId: 'route-describe-call-1',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'from-describe-key' },
          descriptorKey,
        });

      expect(callRes.status).toBe(200);
      expect(callRes.body.data.body).toEqual({ message: 'from-describe-key' });
    });

    it('returns 409 on cancel without tabId for tab-owned in-flight call', async () => {
      tryRegisterGrpcCall('route-tab-owned-1', 'tab-owned');

      const res = await request(app)
        .delete('/api/grpc/call/route-tab-owned-1');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });

    it('returns 503 for in-process call targets', async () => {
      const res = await request(app)
        .post('/api/grpc/call')
        .query({ tabId: 'tab-inproc' })
        .send({
          ...FIXTURE_UNARY_CALL_REQUEST,
          requestId: 'route-in-process-1',
          target: { address: 'in-process:test-server', tlsMode: 'disabled' },
        });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
    });

    it('returns 400 when reflect uses incomplete mtls config (Phase 4A)', async () => {
      const res = await request(app)
        .post('/api/grpc/reflect')
        .send({
          target: { address: 'localhost:50051', tlsMode: 'mtls' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });

    it('returns 400 when status address is missing via real GrpcService', async () => {
      const res = await request(app).get('/api/grpc/status');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
      expect(res.body.error.message).toContain('address query parameter is required');
    });

    it('returns 400 for invalid call target via real GrpcService without invoking client', async () => {
      const mockInvoke = vi.fn();
      app = buildApp(new GrpcServiceImpl({
        probeReachability: vi.fn(async () => ({ reachable: true, latencyMs: 2 })),
        invokeUnary: mockInvoke,
      }));

      const res = await request(app)
        .post('/api/grpc/call')
        .send({ ...FIXTURE_UNARY_CALL_REQUEST, target: { address: 'bad', tlsMode: 'disabled' } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_TARGET);
      expect(res.body.error.message).toContain('Target must be host:port or in-process:<name>');
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('K8s port-forward automation routes', () => {
    it('returns current status payload', async () => {
      const res = await request(app)
        .get('/api/grpc/k8s-port-forward/status')
        .query({ scopeId: 'tab-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.scopeId).toBe('tab-1');
      expect(mockK8sPortForwardManager.getStatus).toHaveBeenCalledWith('tab-1');
    });

    it('starts kubectl process for a scope', async () => {
      const res = await request(app)
        .post('/api/grpc/k8s-port-forward/start')
        .send({
          scopeId: 'tab-1',
          config: {
            namespace: 'default',
            targetType: 'service',
            name: 'echo',
            remotePort: 50051,
            localPort: 50051,
            context: '',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.active).toBe(true);
      expect(mockK8sPortForwardManager.startPortForward).toHaveBeenCalledWith(
        'tab-1',
        expect.objectContaining({ name: 'echo' }),
      );
    });

    it('returns logs payload for a scope', async () => {
      const res = await request(app)
        .get('/api/grpc/k8s-port-forward/logs')
        .query({ scopeId: 'tab-1', afterSeq: '0' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.latestSeq).toBe(1);
      expect(mockK8sPortForwardManager.getLogs).toHaveBeenCalledWith('tab-1', 0);
    });

    it('clears logs for a scope', async () => {
      const res = await request(app)
        .post('/api/grpc/k8s-port-forward/logs/clear')
        .send({ scopeId: 'tab-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.latestSeq).toBe(1);
      expect(mockK8sPortForwardManager.clearLogs).toHaveBeenCalledWith('tab-1');
    });

    it('stops kubectl process for a scope', async () => {
      const res = await request(app)
        .post('/api/grpc/k8s-port-forward/stop')
        .send({ scopeId: 'tab-1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.active).toBe(false);
      expect(mockK8sPortForwardManager.stopPortForward).toHaveBeenCalledWith('tab-1');
    });
  });

  describe('stream routes (Phase 2B–2D)', () => {
    it('POST /api/grpc/stream/start returns stream envelope', async () => {
      const res = await request(app)
        .post('/api/grpc/stream/start')
        .query({ tabId: 'tab-1' })
        .send(FIXTURE_SERVER_STREAM_START_REQUEST);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.op).toBe('stream_start');
      expect(mockStreamService.startStream).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'ServerStream' }),
        'tab-1',
      );
    });

    it('POST /api/grpc/stream/:id/send delegates to stream service', async () => {
      const res = await request(app)
        .post(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/send`)
        .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId })
        .send({ body: { message: 'one' } });

      expect(res.status).toBe(200);
      expect(res.body.op).toBe('stream_send');
      expect(mockStreamService.sendStreamMessage).toHaveBeenCalled();
    });

    it('POST /api/grpc/stream/:id/end delegates to stream service', async () => {
      const res = await request(app)
        .post(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/end`)
        .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId });

      expect(res.status).toBe(200);
      expect(res.body.op).toBe('stream_end');
      expect(mockStreamService.endStream).toHaveBeenCalled();
    });

    it('DELETE /api/grpc/stream/:id delegates cancel to stream service', async () => {
      const res = await request(app)
        .delete(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}`)
        .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId });

      expect(res.status).toBe(200);
      expect(res.body.op).toBe('stream_cancel');
      expect(mockStreamService.cancelStream).toHaveBeenCalled();
    });

    it('returns 400 when stream start body is an array', async () => {
      const res = await request(app)
        .post('/api/grpc/stream/start')
        .query({ tabId: 'tab-1' })
        .send([]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      expect(mockStreamService.startStream).not.toHaveBeenCalled();
    });

    it('returns 409 for send on server-streaming via real GrpcStreamService', async () => {
      clearGrpcStreamRegistry();
      clearGrpcDescriptorStore();
      setGrpcDescriptor(FIXTURE_DESCRIPTOR);
      const mockStreamingClient: GrpcStreamingClientFactory = {
        startStream: vi.fn((_params, callbacks) => {
          queueMicrotask(() => {
            callbacks.onInboundMessage({ message: 'chunk' }, {});
          });
          return {
            callType: 'server_streaming',
            write: vi.fn(),
            endWrites: vi.fn(),
            cancel: vi.fn(),
          };
        }),
      };
      const realStreamService = new GrpcStreamService(mockStreamingClient);
      const realApp = buildApp(createMockService(), realStreamService);

      const startRes = await request(realApp)
        .post('/api/grpc/stream/start')
        .query({ tabId: 'tab-1' })
        .send({ ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-route-ss-send' });

      expect(startRes.status).toBe(200);
      const streamId = startRes.body.data.streamId as string;

      const sendRes = await request(realApp)
        .post(`/api/grpc/stream/${streamId}/send`)
        .query({ tabId: 'tab-1' })
        .send({ body: { message: 'nope' } });

      expect(sendRes.status).toBe(409);
      expect(sendRes.body.error.message).toContain('server-streaming');
    });

    it('returns 409 for end on server-streaming via real GrpcStreamService', async () => {
      clearGrpcStreamRegistry();
      clearGrpcDescriptorStore();
      setGrpcDescriptor(FIXTURE_DESCRIPTOR);
      const mockStreamingClient: GrpcStreamingClientFactory = {
        startStream: vi.fn(() => ({
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        })),
      };
      const realStreamService = new GrpcStreamService(mockStreamingClient);
      const realApp = buildApp(createMockService(), realStreamService);

      const startRes = await request(realApp)
        .post('/api/grpc/stream/start')
        .query({ tabId: 'tab-1' })
        .send({ ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: 'req-route-ss-end' });

      const endRes = await request(realApp)
        .post(`/api/grpc/stream/${startRes.body.data.streamId}/end`)
        .query({ tabId: 'tab-1' });

      expect(endRes.status).toBe(409);
      expect(endRes.body.error.message).toContain('server-streaming');
    });

    it('GET /api/grpc/stream/:id/events returns 404 for unknown streamId', async () => {
      clearGrpcStreamRegistry();
      clearGrpcDescriptorStore();
      setGrpcDescriptor(FIXTURE_DESCRIPTOR);
      const mockStreamingClient: GrpcStreamingClientFactory = {
        startStream: vi.fn(() => ({
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        })),
      };
      const realStreamService = new GrpcStreamService(mockStreamingClient);
      const realApp = buildApp(createMockService(), realStreamService);

      const res = await request(realApp)
        .get('/api/grpc/stream/unknown-stream-id/events')
        .query({ tabId: 'tab-1' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    });

    it('returns 409 for stream send when tabId mismatches', async () => {
      clearGrpcStreamRegistry();
      clearGrpcDescriptorStore();
      setGrpcDescriptor(FIXTURE_DESCRIPTOR);
      const mockStreamingClient: GrpcStreamingClientFactory = {
        startStream: vi.fn(() => ({
          callType: 'client_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        })),
      };
      const realStreamService = new GrpcStreamService(mockStreamingClient);
      const realApp = buildApp(createMockService(), realStreamService);

      const startRes = await request(realApp)
        .post('/api/grpc/stream/start')
        .query({ tabId: 'tab-1' })
        .send({ ...FIXTURE_CLIENT_STREAM_START_REQUEST, requestId: 'req-route-tab-send' });

      expect(startRes.status).toBe(200);
      const streamId = startRes.body.data.streamId as string;

      const sendRes = await request(realApp)
        .post(`/api/grpc/stream/${streamId}/send`)
        .query({ tabId: 'tab-other' })
        .send({ body: { message: 'nope' } });

      expect(sendRes.status).toBe(409);
      expect(sendRes.body.error.message).toContain('tabId');
    });

    it('returns 409 when stream events is missing tabId', async () => {
      clearGrpcStreamRegistry();
      const realStreamService = new GrpcStreamService({
        startStream: vi.fn(),
      } as unknown as GrpcStreamingClientFactory);
      const realApp = buildApp(createMockService(), realStreamService);

      const res = await request(realApp)
        .get(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/events`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('tabId');
    });

    it('returns 409 for duplicate active requestId on stream start', async () => {
      clearGrpcStreamRegistry();
      clearGrpcDescriptorStore();
      setGrpcDescriptor(FIXTURE_DESCRIPTOR);
      const mockStreamingClient: GrpcStreamingClientFactory = {
        startStream: vi.fn(() => ({
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        })),
      };
      const realStreamService = new GrpcStreamService(mockStreamingClient);
      const realApp = buildApp(createMockService(), realStreamService);
      const requestId = 'req-route-dup';

      const first = await request(realApp)
        .post('/api/grpc/stream/start')
        .query({ tabId: 'tab-1' })
        .send({ ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId });

      expect(first.status).toBe(200);

      const second = await request(realApp)
        .post('/api/grpc/stream/start')
        .query({ tabId: 'tab-2' })
        .send({ ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId });

      expect(second.status).toBe(409);
      expect(second.body.error.message).toContain('already in use');
    });
  });
});
