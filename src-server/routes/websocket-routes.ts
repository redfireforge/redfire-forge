import { Router, type Request, type Response } from 'express';
import { wsProxyService, type WebSocketProxyService } from '../websocket/websocket-service.js';
import {
  createWsErrorEnvelope,
  type WsErrorEnvelope,
  type WsProxyOperation,
  type WsRouteEnvelope,
} from '../websocket/contracts.js';
import type { LogLine } from '../../src/shared/types/server-api';

interface CreateWebSocketRouterOptions {
  service?: WebSocketProxyService;
  onLog?: (line: LogLine) => void;
}

function mapErrorStatus(error: WsErrorEnvelope['error']): number {
  if (error.code.startsWith('WS_INVALID_')) {
    return 400;
  }
  if (error.code === 'WS_NOT_FOUND') {
    return 404;
  }
  if (error.code === 'WS_NOT_CONNECTED') {
    return 409;
  }
  if (error.code === 'WS_CONNECT_TIMEOUT') {
    return 504;
  }
  return 500;
}

function sendEnvelope<T>(res: Response, envelope: WsRouteEnvelope<T>) {
  if (envelope.ok) {
    return res.status(200).json(envelope);
  }
  return res.status(mapErrorStatus(envelope.error)).json(envelope);
}

function requireBodyObject(req: Request, op: WsProxyOperation): WsRouteEnvelope<never> | null {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return createWsErrorEnvelope(op, {
      code: 'WS_INVALID_REQUEST',
      message: 'Request body must be a JSON object',
    });
  }
  return null;
}

function toStringQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toIntQuery(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

export function createWebSocketRouter(options: CreateWebSocketRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? wsProxyService;

  const log = (text: string) => {
    if (!options.onLog) return;
    options.onLog({
      prefix: '*',
      text: `[WebSocket] ${text}`,
      ts: Date.now(),
    });
  };

  router.post('/api/ws/connect', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'connect');
    if (bodyError) return sendEnvelope(res, bodyError);

    log(`connect → ${req.body.url ?? '(no url)'}`);
    const envelope = await service.connect(req.body);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/ws/disconnect', (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'disconnect');
    if (bodyError) return sendEnvelope(res, bodyError);

    log(`disconnect → ${req.body.connectionId ?? '(no id)'}`);
    const envelope = service.disconnect(req.body);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/ws/send', (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'send');
    if (bodyError) return sendEnvelope(res, bodyError);

    log(`send → ${req.body.connectionId ?? '(no id)'}`);
    const envelope = service.send(req.body);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/ws/ping', (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'ping');
    if (bodyError) return sendEnvelope(res, bodyError);

    log(`ping → ${req.body.connectionId ?? '(no id)'}`);
    const envelope = service.ping(req.body);
    return sendEnvelope(res, envelope);
  });

  router.get('/api/ws/messages', (req: Request, res: Response) => {
    const connectionId = toStringQuery(req.query.connectionId);
    if (!connectionId) {
      return sendEnvelope(res, createWsErrorEnvelope('messages', {
        code: 'WS_INVALID_REQUEST',
        message: 'connectionId query parameter is required',
      }));
    }

    const sinceCursor = toIntQuery(req.query.sinceCursor);
    const envelope = service.getMessages({ connectionId, sinceCursor });
    return sendEnvelope(res, envelope);
  });

  router.get('/api/ws/status', (req: Request, res: Response) => {
    const connectionId = toStringQuery(req.query.connectionId);
    if (!connectionId) {
      return sendEnvelope(res, createWsErrorEnvelope('status', {
        code: 'WS_INVALID_REQUEST',
        message: 'connectionId query parameter is required',
      }));
    }

    const envelope = service.getStatus({ connectionId });
    return sendEnvelope(res, envelope);
  });

  return router;
}
