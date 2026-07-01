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

interface CreateGrpcRouterOptions {
  service?: GrpcService;
  streamService?: GrpcStreamService;
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

export function createGrpcRouter(options: CreateGrpcRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? grpcService;
  const streamService = options.streamService ?? grpcStreamService;

  const log = (text: string) => {
    if (!options.onLog) return;
    options.onLog({
      prefix: '*',
      text: `[gRPC] ${text}`,
      ts: Date.now(),
    });
  };

  router.get('/api/grpc/status', async (req: Request, res: Response) => {
    const address = toStringQuery(req.query.address);
    const tlsMode = toStringQuery(req.query.tlsMode) as 'disabled' | 'tls' | 'mtls' | undefined;
    const timeoutMs = toIntQuery(req.query.timeoutMs);

    log(`status → ${address ?? '(no address)'}`);
    const envelope = await service.status({
      address: address ?? '',
      tlsMode,
      timeoutMs,
    });
    return sendGrpcEnvelope(res, envelope);
  });

  router.post('/api/grpc/reflect', async (req: Request, res: Response) => {
    if (!requireBodyObject(req, res, 'reflect')) return;
    log(`reflect → ${req.body.target?.address ?? '(no target)'}`);
    const envelope = await service.reflect(req.body);
    return sendGrpcEnvelope(res, envelope);
  });

  router.post('/api/grpc/describe', async (req: Request, res: Response) => {
    if (!requireBodyObject(req, res, 'describe')) return;
    log(`describe → ${req.body.source ?? '(no source)'}`);
    const envelope = await service.describe(req.body);
    return sendGrpcEnvelope(res, envelope);
  });

  router.post('/api/grpc/export-protoset', async (req: Request, res: Response) => {
    if (!requireBodyObject(req, res, 'export_protoset')) return;
    log(`export-protoset → ${req.body.descriptorKey ?? '(no key)'}`);
    const envelope = await service.exportProtoset(req.body);
    return sendGrpcEnvelope(res, envelope);
  });

  router.post('/api/grpc/call', async (req: Request, res: Response) => {
    if (!requireBodyObject(req, res, 'call')) return;
    const tabId = toStringQuery(req.query.tabId);
    log(`call → ${req.body.service ?? '?'}.${req.body.method ?? '?'} (${req.body.requestId ?? 'no-id'})`);
    const envelope = await service.call(req.body, tabId);
    return sendGrpcEnvelope(res, envelope);
  });

  router.delete('/api/grpc/call/:requestId', (req: Request, res: Response) => {
    const requestId = req.params.requestId;
    const tabId = toStringQuery(req.query.tabId);
    log(`cancel → ${requestId}`);
    const envelope = service.cancel(requestId, tabId);
    return sendGrpcEnvelope(res, envelope);
  });

  router.post('/api/grpc/stream/start', async (req: Request, res: Response) => {
    if (!requireBodyObject(req, res, 'stream_start')) return;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/start → ${req.body.service ?? '?'}.${req.body.method ?? '?'} (${req.body.requestId ?? 'no-id'})`);
    const envelope = await Promise.resolve(streamService.startStream(req.body, tabId));
    return sendGrpcEnvelope(res, envelope);
  });

  router.get('/api/grpc/stream/:streamId/events', (req: Request, res: Response) => {
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    const lastSequence = toIntQuery(req.query.lastSequence);
    log(`stream/events → ${streamId}`);
    const errorEnvelope = streamService.attachStreamEvents(streamId, tabId, res, lastSequence);
    if (errorEnvelope) {
      return sendGrpcEnvelope(res, errorEnvelope);
    }
    return undefined;
  });

  router.post('/api/grpc/stream/:streamId/send', (req: Request, res: Response) => {
    if (!requireBodyObject(req, res, 'stream_send')) return;
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/send → ${streamId}`);
    const envelope = streamService.sendStreamMessage(streamId, tabId, req.body);
    return sendGrpcEnvelope(res, envelope);
  });

  router.post('/api/grpc/stream/:streamId/end', (req: Request, res: Response) => {
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/end → ${streamId}`);
    const envelope = streamService.endStream(streamId, tabId);
    return sendGrpcEnvelope(res, envelope);
  });

  router.delete('/api/grpc/stream/:streamId', (req: Request, res: Response) => {
    const streamId = req.params.streamId;
    const tabId = toStringQuery(req.query.tabId);
    log(`stream/cancel → ${streamId}`);
    const envelope = streamService.cancelStream(streamId, tabId);
    return sendGrpcEnvelope(res, envelope);
  });

  return router;
}
