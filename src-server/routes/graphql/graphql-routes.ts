/**
 * GraphQL Studio server-side routes.
 *
 * Phase 2.0 Sprint 1 — infrastructure scaffold.
 *
 * Route registration pattern mirrors the existing WS/Kafka routers:
 *   app.use(createGraphqlRouter({ onLog: broadcastLog }));
 *
 * Current routes (Sprint 1 stubs — 501 Not Implemented):
 *   POST /api/graphql/subscribe  — WS subscription proxy upgrade (Sprint 2)
 *   GET  /api/graphql/sse        — SSE subscription proxy relay (Sprint 3)
 *   POST /api/graphql/upload     — File upload multipart proxy (Sprint 4)
 *
 * Each stub validates the request body and returns a structured JSON error so
 * clients can display a clear "not yet available" message rather than a raw 501.
 */
import { Router, type Request, type Response } from 'express';
import type { LogLine } from '../../../src/shared/types/server-api.js';

export interface CreateGraphqlRouterOptions {
  onLog?: (line: LogLine) => void;
}

function log(
  onLog: ((line: LogLine) => void) | undefined,
  level: LogLine['level'],
  message: string,
  meta?: Record<string, unknown>,
): void {
  onLog?.({
    level,
    message: meta ? `[graphql] ${message} ${JSON.stringify(meta)}` : `[graphql] ${message}`,
    timestamp: Date.now(),
  });
}

export function createGraphqlRouter(options: CreateGraphqlRouterOptions = {}): Router {
  const { onLog } = options;
  const router = Router();

  // ── POST /api/graphql/subscribe ─────────────────────────────────────────────
  // Sprint 2: WebSocket upgrade proxy for graphql-transport-ws / graphql-ws.
  // Clients send { endpoint, headers, auth, skipTlsVerify } as JSON.
  // Server upgrades the connection, negotiates subprotocol, and relays frames.
  router.post('/api/graphql/subscribe', (req: Request, res: Response) => {
    const endpoint: unknown = req.body?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` (string) is required' },
      });
      return;
    }
    log(onLog, 'warn', 'WS subscription proxy called but not yet implemented (Sprint 2)', { endpoint });
    res.status(501).json({
      ok: false,
      error: {
        code: 'GQL_NOT_IMPLEMENTED',
        message: 'WebSocket subscription proxy is not yet implemented (Phase 2.0 Sprint 2)',
      },
    });
  });

  // ── GET /api/graphql/sse ────────────────────────────────────────────────────
  // Sprint 3: SSE subscription relay (for auth-gated endpoints).
  // Query params: endpoint, operationId. Headers forwarded from request.
  router.get('/api/graphql/sse', (req: Request, res: Response) => {
    const endpoint: unknown = req.query.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` query param (string) is required' },
      });
      return;
    }
    log(onLog, 'warn', 'SSE subscription proxy called but not yet implemented (Sprint 3)', { endpoint });
    res.status(501).json({
      ok: false,
      error: {
        code: 'GQL_NOT_IMPLEMENTED',
        message: 'SSE subscription proxy is not yet implemented (Phase 2.0 Sprint 3)',
      },
    });
  });

  // ── POST /api/graphql/upload ────────────────────────────────────────────────
  // Sprint 4: File upload multipart proxy (graphql-multipart-request-spec).
  // Body is multipart/form-data with `operations`, `map`, and file parts.
  router.post('/api/graphql/upload', (req: Request, res: Response) => {
    const contentType: string = (req.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.includes('multipart/form-data')) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'GQL_INVALID_REQUEST',
          message: 'Content-Type must be multipart/form-data for file uploads',
        },
      });
      return;
    }
    log(onLog, 'warn', 'File upload proxy called but not yet implemented (Sprint 4)');
    res.status(501).json({
      ok: false,
      error: {
        code: 'GQL_NOT_IMPLEMENTED',
        message: 'File upload proxy is not yet implemented (Phase 2.0 Sprint 4)',
      },
    });
  });

  return router;
}
