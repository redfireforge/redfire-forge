import { Router, type Request, type Response } from 'express';
import { wsMockPool, type WebSocketMockService } from '../websocket/websocket-mock-service.js';
import type { LogLine } from '../../src/shared/types/server-api';
import { toErrorMessage } from '../../src/shared/utils/helpers.js';

const VALID_FALLBACKS = new Set(['echo', 'ignore', 'close']);

interface CreateMockRouterOptions {
  /** Inject a single service for testing (bypasses pool; port param is ignored). */
  service?: WebSocketMockService;
  onLog?: (line: LogLine) => void;
}

function json200(res: Response, data: unknown) {
  return res.status(200).json({ ok: true, data });
}

function jsonError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ ok: false, error: { code, message } });
}

/** Parse a port value. Returns NaN if the value is an unparseable string so
 *  callers that validate (e.g. /start) still reject it. Pass `fallback` to
 *  default missing values without triggering the NaN path. */
function parsePort(value: unknown, fallback?: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return isNaN(n) ? (fallback ?? NaN) : n;
  }
  return fallback ?? NaN;
}

export function createWebSocketMockRouter(options: CreateMockRouterOptions = {}): Router {
  const router = Router();

  /** Resolve the service: injected (test) service or pool lookup by port. */
  const resolve = (port: number): WebSocketMockService =>
    options.service ?? wsMockPool.getOrCreate(port);

  const log = (text: string) => {
    if (!options.onLog) return;
    options.onLog({ prefix: '*', text: `[WS-Mock] ${text}`, ts: Date.now() });
  };

  // POST /api/ws/mock/start — port in body
  router.post('/api/ws/mock/start', async (req: Request, res: Response) => {
    const { port, rules, fallback } = req.body ?? {};
    // No fallback: a missing or unparseable port stays NaN so validation rejects it.
    const portNum = typeof port === 'undefined' ? 9876 : parsePort(port);

    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      return jsonError(res, 400, 'MOCK_INVALID_PORT', `Port must be 1024–65535, got ${portNum}`);
    }

    const validFallback = typeof fallback === 'string' && VALID_FALLBACKS.has(fallback)
      ? (fallback as 'echo' | 'ignore' | 'close')
      : 'echo';

    log(`Starting mock server on port ${portNum} with ${Array.isArray(rules) ? rules.length : 0} rules`);

    try {
      const status = await resolve(portNum).start({
        port: portNum,
        rules: Array.isArray(rules) ? rules : [],
        fallback: validFallback,
      });
      return json200(res, status);
    } catch (err) {
      const msg = toErrorMessage(err);
      const code = msg.includes('EADDRINUSE') ? 'MOCK_PORT_IN_USE' : 'MOCK_START_FAILED';
      log(`Start failed: ${msg}`);
      return jsonError(res, 500, code, msg);
    }
  });

  // POST /api/ws/mock/stop — port in body.
  // Stops the server but intentionally leaves the service entry in the pool so the
  // user can restart it without re-allocating. The stopped service acts as a cache:
  // if the same port is later reassigned to a new tab, getOrCreate() reuses it.
  router.post('/api/ws/mock/stop', (req: Request, res: Response) => {
    const portNum = parsePort((req.body ?? {}).port, 9876);
    log(`Stopping mock server on port ${portNum}`);
    const svc = options.service ?? wsMockPool.get(portNum);
    if (!svc) return json200(res, { running: false, port: portNum, clientCount: 0, clients: [] });
    svc.stop();
    return json200(res, svc.getStatus());
  });

  // GET /api/ws/mock/status?port=N
  router.get('/api/ws/mock/status', (req: Request, res: Response) => {
    const portNum = parsePort(req.query.port, 9876);
    const svc = options.service ?? wsMockPool.get(portNum);
    if (!svc) return json200(res, { running: false, port: portNum, clientCount: 0, clients: [] });
    return json200(res, svc.getStatus());
  });

  // POST /api/ws/mock/broadcast — port in body
  router.post('/api/ws/mock/broadcast', (req: Request, res: Response) => {
    const { port, data } = req.body ?? {};
    if (typeof data !== 'string' || data.length === 0) {
      return jsonError(res, 400, 'MOCK_INVALID_DATA', 'Broadcast data must be a non-empty string');
    }
    const portNum = parsePort(port, 9876);
    const svc = options.service ?? wsMockPool.get(portNum);
    if (!svc) return json200(res, { sent: 0 });
    const sent = svc.broadcast(data);
    log(`Broadcast to ${sent} clients on port ${portNum}`);
    return json200(res, { sent });
  });

  // POST /api/ws/mock/rules — port in body
  router.post('/api/ws/mock/rules', (req: Request, res: Response) => {
    const { port, rules, fallback } = req.body ?? {};
    if (!Array.isArray(rules)) {
      return jsonError(res, 400, 'MOCK_INVALID_RULES', 'Rules must be an array');
    }
    const portNum = parsePort(port, 9876);
    const validFallback = typeof fallback === 'string' && VALID_FALLBACKS.has(fallback)
      ? (fallback as 'echo' | 'ignore' | 'close')
      : undefined;
    resolve(portNum).updateRules(rules, validFallback);
    log(`Updated ${rules.length} rules on port ${portNum}`);
    return json200(res, { count: rules.length });
  });

  // GET /api/ws/mock/log?port=N&sinceCursor=N
  router.get('/api/ws/mock/log', (req: Request, res: Response) => {
    const portNum = parsePort(req.query.port, 9876);
    let sinceCursor: number | undefined;
    if (typeof req.query.sinceCursor === 'string') {
      const parsed = parseInt(req.query.sinceCursor, 10);
      if (!isNaN(parsed)) sinceCursor = parsed;
    }
    const svc = options.service ?? wsMockPool.get(portNum);
    if (!svc) return json200(res, { entries: [], cursor: sinceCursor ?? 0 });
    const entries = svc.getLogs(sinceCursor);
    return json200(res, { entries, cursor: entries.length > 0 ? entries[entries.length - 1].id : (sinceCursor ?? 0) });
  });

  return router;
}
