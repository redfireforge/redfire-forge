import { Router, type Request, type Response } from 'express';
import { wsMockService, type WebSocketMockService } from '../websocket/websocket-mock-service.js';
import type { LogLine } from '../../src/shared/types/server-api';

const VALID_FALLBACKS = new Set(['echo', 'ignore', 'close']);

interface CreateMockRouterOptions {
  service?: WebSocketMockService;
  onLog?: (line: LogLine) => void;
}

function json200(res: Response, data: unknown) {
  return res.status(200).json({ ok: true, data });
}

function jsonError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ ok: false, error: { code, message } });
}

export function createWebSocketMockRouter(options: CreateMockRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? wsMockService;

  const log = (text: string) => {
    if (!options.onLog) return;
    options.onLog({ prefix: '*', text: `[WS-Mock] ${text}`, ts: Date.now() });
  };

  router.post('/api/ws/mock/start', async (req: Request, res: Response) => {
    const { port, rules, fallback } = req.body ?? {};
    const portNum = typeof port === 'number' ? port : typeof port === 'string' ? parseInt(port, 10) : 9876;

    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      return jsonError(res, 400, 'MOCK_INVALID_PORT', `Port must be 1024–65535, got ${portNum}`);
    }

    const validFallback = typeof fallback === 'string' && VALID_FALLBACKS.has(fallback)
      ? (fallback as 'echo' | 'ignore' | 'close')
      : 'echo';

    log(`Starting mock server on port ${portNum} with ${Array.isArray(rules) ? rules.length : 0} rules`);

    try {
      const status = await service.start({
        port: portNum,
        rules: Array.isArray(rules) ? rules : [],
        fallback: validFallback,
      });
      return json200(res, status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = msg.includes('EADDRINUSE') ? 'MOCK_PORT_IN_USE' : 'MOCK_START_FAILED';
      log(`Start failed: ${msg}`);
      return jsonError(res, 500, code, msg);
    }
  });

  router.post('/api/ws/mock/stop', (_req: Request, res: Response) => {
    log('Stopping mock server');
    service.stop();
    return json200(res, service.getStatus());
  });

  router.get('/api/ws/mock/status', (_req: Request, res: Response) => {
    return json200(res, service.getStatus());
  });

  router.post('/api/ws/mock/broadcast', (req: Request, res: Response) => {
    const { data } = req.body ?? {};
    if (typeof data !== 'string' || data.length === 0) {
      return jsonError(res, 400, 'MOCK_INVALID_DATA', 'Broadcast data must be a non-empty string');
    }
    const sent = service.broadcast(data);
    log(`Broadcast to ${sent} clients`);
    return json200(res, { sent });
  });

  router.post('/api/ws/mock/rules', (req: Request, res: Response) => {
    const { rules, fallback } = req.body ?? {};
    if (!Array.isArray(rules)) {
      return jsonError(res, 400, 'MOCK_INVALID_RULES', 'Rules must be an array');
    }
    const validFallback = typeof fallback === 'string' && VALID_FALLBACKS.has(fallback)
      ? (fallback as 'echo' | 'ignore' | 'close')
      : undefined;
    service.updateRules(rules, validFallback);
    log(`Updated ${rules.length} rules`);
    return json200(res, { count: rules.length });
  });

  router.get('/api/ws/mock/log', (req: Request, res: Response) => {
    let sinceCursor: number | undefined;
    if (typeof req.query.sinceCursor === 'string') {
      const parsed = parseInt(req.query.sinceCursor, 10);
      if (!isNaN(parsed)) sinceCursor = parsed;
    }
    const entries = service.getLogs(sinceCursor);
    return json200(res, { entries, cursor: entries.length > 0 ? entries[entries.length - 1].id : (sinceCursor ?? 0) });
  });

  return router;
}
