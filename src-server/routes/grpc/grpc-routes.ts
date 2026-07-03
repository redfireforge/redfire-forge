import { Router, type Request, type Response } from 'express';
import {
  createGrpcErrorEnvelope,
  GRPC_ERROR_CODES,
  mapGrpcErrorCodeToHttpStatus,
  type GrpcOperation,
  type GrpcRouteEnvelope,
} from '../../../src/shared/grpc/contracts.js';
import type { LogLine } from '../../../src/shared/types/server-api.js';
import { grpcService, type GrpcService } from '../../grpc/grpc-service.js';
import { grpcStreamService, type GrpcStreamService } from '../../grpc/grpc-stream-service.js';
import {
  grpcK8sPortForwardManager,
  type GrpcK8sPortForwardManager,
  type GrpcK8sPortForwardConfig,
} from '../../grpc/grpcK8sPortForwardManager.js';
import {
  getGrpcDescribeUsageTelemetrySnapshot,
  recordGrpcDescribeUsage,
} from '../../grpc/grpcDescribeUsageTelemetry.js';
import {
  getGrpcRoutePerformanceSnapshot,
  recordGrpcRoutePerformance,
} from '../../grpc/grpcRoutePerformanceTelemetry.js';
import { GRPC_ROUTE_IDS } from '../../grpc/grpcObservabilityTaxonomy.js';

interface CreateGrpcRouterOptions {
  service?: GrpcService;
  streamService?: GrpcStreamService;
  k8sPortForwardManager?: GrpcK8sPortForwardManager;
  onLog?: (line: LogLine) => void;
}

function sendGrpcEnvelope<T>(res: Response, envelope: GrpcRouteEnvelope<T>) {
  if (envelope.ok) {
    return res.status(200).json(envelope);
  }
  return res.status(mapGrpcErrorCodeToHttpStatus(envelope.error, envelope.op)).json(envelope);
}

function requireBodyObject(req: Request, res: Response, op: GrpcOperation): boolean {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    sendGrpcEnvelope(res, createGrpcErrorEnvelope(op, {
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'Request body must be a JSON object',
    }));
    return false;
  }
  return true;
}

function toStringQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toIntQuery(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function elapsedMs(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

export function createGrpcRouter(options: CreateGrpcRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? grpcService;
  const streamService = options.streamService ?? grpcStreamService;
  const k8sPortForwardManager = options.k8sPortForwardManager ?? grpcK8sPortForwardManager;

  const log = (text: string) => {
    if (!options.onLog) return;
    options.onLog({
      prefix: '*',
      text: `[gRPC] ${text}`,
      ts: Date.now(),
    });
  };

  router.get('/api/grpc/status', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const address = toStringQuery(req.query.address);
    const tlsMode = toStringQuery(req.query.tlsMode) as 'disabled' | 'tls' | 'mtls' | undefined;
    const timeoutMs = toIntQuery(req.query.timeoutMs);

    log(`status → ${address ?? '(no address)'}`);
    const envelope = await service.status({
      address: address ?? '',
      tlsMode,
      timeoutMs,
    });
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.STATUS,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.post('/api/grpc/reflect', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'reflect')) return;
    log(`reflect → ${req.body.target?.address ?? '(no target)'}`);
    const envelope = await service.reflect(req.body);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.REFLECT,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.post('/api/grpc/describe', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'describe')) return;
    recordGrpcDescribeUsage(req.body);
    log(`describe → ${req.body.source ?? '(no source)'}`);
    const envelope = await service.describe(req.body);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.DESCRIBE,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.get('/api/grpc/describe/usage', (_req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const response = res.status(200).json({
      ok: true,
      data: getGrpcDescribeUsageTelemetrySnapshot(),
    });
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.DESCRIBE_USAGE,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.get('/api/grpc/perf/snapshot', (_req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const response = res.status(200).json({
      ok: true,
      data: getGrpcRoutePerformanceSnapshot(),
    });
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.PERF_SNAPSHOT,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.post('/api/grpc/export-protoset', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'export_protoset')) return;
    log(`export-protoset → ${req.body.descriptorKey ?? '(no key)'}`);
    const envelope = await service.exportProtoset(req.body);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.EXPORT_PROTOSET,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.post('/api/grpc/descriptor/lookup', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'lookup_descriptor')) return;
    log(`descriptor-lookup → ${req.body.descriptorKey ?? '(no key)'}`);
    const envelope = await service.lookupDescriptor(req.body);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.LOOKUP_DESCRIPTOR,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.post('/api/grpc/call', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'call')) return;
    const tabId = toStringQuery(req.query.tabId);
    log(`call → ${req.body.service ?? '?'}.${req.body.method ?? '?'} (${req.body.requestId ?? 'no-id'})`);
    const envelope = await service.call(req.body, tabId);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.CALL,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.delete('/api/grpc/call/:requestId', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const requestId = req.params.requestId;
    const tabId = toStringQuery(req.query.tabId);
    log(`cancel → ${requestId}`);
    const envelope = service.cancel(requestId, tabId);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.CANCEL,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.post('/api/grpc/stream/start', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'stream_start')) return;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/start → ${req.body.service ?? '?'}.${req.body.method ?? '?'} (${req.body.requestId ?? 'no-id'})`);
    const envelope = await Promise.resolve(streamService.startStream(req.body, tabId));
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.STREAM_START,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.get('/api/grpc/stream/:streamId/events', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    const lastSequence = toIntQuery(req.query.lastSequence);
    log(`stream/events → ${streamId}`);
    const errorEnvelope = streamService.attachStreamEvents(streamId, tabId, res, lastSequence);
    if (errorEnvelope) {
      const response = sendGrpcEnvelope(res, errorEnvelope);
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.STREAM_EVENTS,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    }
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.STREAM_EVENTS,
      durationMs: elapsedMs(startedAt),
      statusCode: 200,
    });
    return undefined;
  });

  router.post('/api/grpc/stream/:streamId/send', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'stream_send')) return;
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/send → ${streamId}`);
    const envelope = streamService.sendStreamMessage(streamId, tabId, req.body);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.STREAM_SEND,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.post('/api/grpc/stream/:streamId/end', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/end → ${streamId}`);
    const envelope = streamService.endStream(streamId, tabId);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.STREAM_END,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.delete('/api/grpc/stream/:streamId', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/cancel → ${streamId}`);
    const envelope = streamService.cancelStream(streamId, tabId);
    const response = sendGrpcEnvelope(res, envelope);
    recordGrpcRoutePerformance({
      routeId: GRPC_ROUTE_IDS.STREAM_CANCEL,
      durationMs: elapsedMs(startedAt),
      statusCode: response.statusCode,
    });
    return response;
  });

  router.get('/api/grpc/k8s-port-forward/status', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const scopeId = toStringQuery(req.query.scopeId) ?? '';
    try {
      const data = k8sPortForwardManager.getStatus(scopeId);
      const response = res.status(200).json({ ok: true, data });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_STATUS,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read K8s port-forward status';
      const response = res.status(400).json({ ok: false, error: message });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_STATUS,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    }
  });

  router.get('/api/grpc/k8s-port-forward/logs', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    const scopeId = toStringQuery(req.query.scopeId) ?? '';
    const afterSeq = toIntQuery(req.query.afterSeq);
    try {
      const data = k8sPortForwardManager.getLogs(scopeId, afterSeq);
      const response = res.status(200).json({ ok: true, data });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_LOGS,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read K8s port-forward logs';
      const response = res.status(400).json({ ok: false, error: message });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_LOGS,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    }
  });

  router.post('/api/grpc/k8s-port-forward/logs/clear', (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'cancel')) return;
    const scopeId = typeof req.body.scopeId === 'string' ? req.body.scopeId : '';
    try {
      const data = k8sPortForwardManager.clearLogs(scopeId);
      const response = res.status(200).json({ ok: true, data });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_LOGS_CLEAR,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear K8s port-forward logs';
      const response = res.status(400).json({ ok: false, error: message });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_LOGS_CLEAR,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    }
  });

  router.post('/api/grpc/k8s-port-forward/start', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'call')) return;
    const scopeId = typeof req.body.scopeId === 'string' ? req.body.scopeId : '';
    const config = (req.body.config ?? {}) as Partial<GrpcK8sPortForwardConfig>;
    log(`k8s/start → ${scopeId || '(no scope)'}`);
    try {
      const data = await k8sPortForwardManager.startPortForward(scopeId, config);
      const response = res.status(200).json({ ok: true, data });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_START,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start kubectl port-forward';
      const response = res.status(400).json({ ok: false, error: message });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_START,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    }
  });

  router.post('/api/grpc/k8s-port-forward/stop', async (req: Request, res: Response) => {
    const startedAt = process.hrtime.bigint();
    if (!requireBodyObject(req, res, 'cancel')) return;
    const scopeId = typeof req.body.scopeId === 'string' ? req.body.scopeId : '';
    log(`k8s/stop → ${scopeId || '(no scope)'}`);
    try {
      const data = await k8sPortForwardManager.stopPortForward(scopeId);
      const response = res.status(200).json({ ok: true, data });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_STOP,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop kubectl port-forward';
      const response = res.status(400).json({ ok: false, error: message });
      recordGrpcRoutePerformance({
        routeId: GRPC_ROUTE_IDS.K8S_STOP,
        durationMs: elapsedMs(startedAt),
        statusCode: response.statusCode,
      });
      return response;
    }
  });

  return router;
}
