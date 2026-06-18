/**
 * GraphQL Studio server-side routes.
 *
 * Phase 2.0 Sprint 1 — infrastructure scaffold.
 * Phase 2.0 Sprint 4 — real file upload proxy (2E-3).
 * Phase 2.0 Sprint 7 — incremental delivery proxy (2D-2): POST /api/graphql/query.
 *
 * Route registration pattern mirrors the existing WS/Kafka routers:
 *   app.use(createGraphqlRouter({ onLog: broadcastLog }));
 *
 * Current routes:
 *   POST /api/graphql/query      — HTTP query/mutation proxy with multipart/mixed passthrough (Sprint 7 — REAL)
 *   POST /api/graphql/subscribe  — WS subscription proxy upgrade (Sprint 2 — stub 501)
 *   GET  /api/graphql/sse        — SSE subscription proxy relay (Sprint 3 — stub 501)
 *   POST /api/graphql/upload     — File upload multipart proxy (Sprint 4 — REAL)
 *
 * Each stub validates the request body and returns a structured JSON error so
 * clients can display a clear "not yet available" message rather than a raw 501.
 */
import Busboy from 'busboy';
import { Router, type Request, type Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
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

// Headers that must never be forwarded to the upstream server.
// Content-Type and Content-Length are explicitly set for the reconstructed body.
const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer',
  'upgrade', 'proxy-authorization', 'proxy-authenticate',
  'x-graphql-endpoint', 'host',
  'content-type', 'content-length',
]);

/**
 * Escape a quoted-string value for use in a Content-Disposition header.
 * Escapes backslashes first, then double quotes (RFC 7230 §3.2.6).
 */
function escapeQuotedString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createGraphqlRouter(options: CreateGraphqlRouterOptions = {}): Router {
  const { onLog } = options;
  const router = Router();

  // ── POST /api/graphql/query ─────────────────────────────────────────────────
  // Sprint 7 (2D-2): HTTP query/mutation proxy with multipart/mixed passthrough.
  //
  // Used when:
  //   a) The query contains @defer or @stream (client sends Accept: multipart/mixed)
  //   b) skipTlsVerify is true (browser fetch cannot set rejectUnauthorized)
  //
  // For regular queries from the browser, gqlFetch uses the Vite /__proxy directly.
  // This route is needed for TLS-skip + Tauri scenarios, and for multipart streaming
  // where the Vite proxy buffers the response body instead of streaming it.
  //
  // Request body (JSON): { endpoint, query, variables?, operationName?, headers?, skipTlsVerify? }
  // Forwards to upstream GraphQL endpoint.
  // Passes through chunked responses without buffering (Transfer-Encoding: chunked preserved).
  router.post('/api/graphql/query', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const endpoint: unknown = body?.endpoint;
    const query: unknown    = body?.query;

    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` (string) is required' },
      });
      return;
    }
    if (typeof query !== 'string' || !query) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`query` (string) is required' },
      });
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(endpoint);
    } catch {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: `Invalid endpoint URL: ${endpoint}` },
      });
      return;
    }

    const skipTlsVerify = body?.skipTlsVerify === true;
    const variables     = body?.variables;
    const operationName = typeof body?.operationName === 'string' ? body.operationName : undefined;
    const extraHeaders  = (body?.headers && typeof body.headers === 'object' && !Array.isArray(body.headers))
      ? body.headers as Record<string, string>
      : {};

    const upstreamBody: Record<string, unknown> = { query };
    if (variables !== undefined) upstreamBody.variables = variables;
    if (operationName) upstreamBody.operationName = operationName;

    const bodyStr   = JSON.stringify(upstreamBody);
    const bodyBuf   = Buffer.from(bodyStr, 'utf8');

    // Accept header: forward as-is (the client sets multipart/mixed for @defer/@stream)
    const acceptHeader = typeof req.headers['accept'] === 'string' ? req.headers['accept'] : 'application/json';

    const forwardHeaders: Record<string, string> = {
      'content-type':   'application/json',
      'content-length': String(bodyBuf.length),
      'accept':         acceptHeader,
    };

    // Forward user-supplied headers (auth, custom, etc.)
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (typeof v === 'string') forwardHeaders[k.toLowerCase()] = v;
    }

    const transport = targetUrl.protocol === 'https:' ? https : http;

    // Only create a TLS agent for HTTPS endpoints — plain HTTP connections don't use TLS.
    const tlsAgent = skipTlsVerify && targetUrl.protocol === 'https:'
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

    log(onLog, 'info', 'Query proxy: relaying to upstream', {
      endpoint,
      acceptMultipart: acceptHeader.includes('multipart'),
      skipTlsVerify,
    });

    const requestOptions: http.RequestOptions = {
      method:   'POST',
      hostname: targetUrl.hostname,
      port:     targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path:     targetUrl.pathname + targetUrl.search,
      headers:  forwardHeaders,
      ...(tlsAgent ? { agent: tlsAgent } : {}),
    };

    const upstreamReq = transport.request(requestOptions, (upstreamRes) => {
      const upstreamStatus = upstreamRes.statusCode ?? 200;
      res.status(upstreamStatus);

      // Forward response headers, preserving Content-Type and Transfer-Encoding
      // so the browser can detect multipart/mixed and stream chunks correctly.
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        if (['connection', 'keep-alive'].includes(k)) continue;
        if (v !== undefined) res.setHeader(k, v as string | string[]);
      }

      // Pipe the upstream body directly without buffering.
      // This preserves Transfer-Encoding: chunked for multipart/mixed responses.
      upstreamRes.pipe(res, { end: true });
    });

    upstreamReq.on('error', (err) => {
      log(onLog, 'error', 'Query proxy upstream error', { error: String(err) });
      if (!res.headersSent) {
        res.status(502).json({
          ok: false,
          error: { code: 'GQL_UPSTREAM_ERROR', message: `Upstream request failed: ${err.message}` },
        });
      }
    });

    upstreamReq.write(bodyBuf);
    upstreamReq.end();
  });

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
  // Uses busboy to parse incoming multipart, then streams the reassembled
  // multipart/form-data to the upstream GraphQL endpoint without buffering.
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

    // Extract target endpoint from header or query param
    const targetEndpoint = (
      (req.headers['x-graphql-endpoint'] as string | undefined) ??
      (req.query['endpoint'] as string | undefined) ?? ''
    ).trim();

    if (!targetEndpoint) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'GQL_INVALID_REQUEST',
          message: '`x-graphql-endpoint` header or `endpoint` query param is required',
        },
      });
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(targetEndpoint);
    } catch {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: `Invalid endpoint URL: ${targetEndpoint}` },
      });
      return;
    }

    log(onLog, 'info', 'File upload proxy: relaying multipart to upstream', { targetEndpoint });

    // Parse the incoming multipart using busboy, collect fields and file parts,
    // then reconstruct a multipart/form-data request to the upstream server.
    const boundary = `RedfireForge${Date.now().toString(36)}`;
    const parts: Array<
      | { kind: 'field'; name: string; value: string }
      | { kind: 'file'; name: string; filename: string; mimeType: string; buf: Buffer }
    > = [];

    const bb = Busboy({ headers: req.headers });

    bb.on('field', (name: string, val: string) => {
      parts.push({ kind: 'field', name, value: val });
    });

    bb.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        parts.push({ kind: 'file', name, filename: info.filename, mimeType: info.mimeType, buf: Buffer.concat(chunks) });
      });
      stream.on('error', (err: Error) => {
        log(onLog, 'error', 'File upload stream read error', { file: info.filename, error: String(err) });
      });
    });

    bb.on('finish', () => {
      // Build the multipart/form-data body buffer for the upstream request
      const CRLF = '\r\n';
      const bodyChunks: Buffer[] = [];

      for (const part of parts) {
        bodyChunks.push(Buffer.from(`--${boundary}${CRLF}`, 'utf8'));
        if (part.kind === 'field') {
          bodyChunks.push(Buffer.from(
            `Content-Disposition: form-data; name="${escapeQuotedString(part.name)}"${CRLF}${CRLF}${part.value}${CRLF}`,
            'utf8',
          ));
        } else {
          bodyChunks.push(Buffer.from(
            `Content-Disposition: form-data; name="${escapeQuotedString(part.name)}"; filename="${escapeQuotedString(part.filename)}"${CRLF}` +
            `Content-Type: ${part.mimeType}${CRLF}${CRLF}`,
            'utf8',
          ));
          bodyChunks.push(part.buf);
          bodyChunks.push(Buffer.from(CRLF, 'utf8'));
        }
      }
      bodyChunks.push(Buffer.from(`--${boundary}--${CRLF}`, 'utf8'));

      const body = Buffer.concat(bodyChunks);

      // Forward auth and custom headers from the original request.
      // Use a deny-list approach so user-defined headers from the Headers tab
      // (e.g. tenant-id, x-api-key, Authorization, x-custom-auth) are all
      // forwarded to the upstream GraphQL server.
      const forwardHeaders: Record<string, string> = {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length),
        'accept': 'application/json',
      };
      for (const [h, v] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(h.toLowerCase()) && typeof v === 'string') {
          forwardHeaders[h] = v;
        }
      }

      const transport = targetUrl.protocol === 'https:' ? https : http;
      const upstreamReq = transport.request(
        {
          method: 'POST',
          hostname: targetUrl.hostname,
          port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
          path: targetUrl.pathname + targetUrl.search,
          headers: forwardHeaders,
        },
        (upstreamRes) => {
          res.status(upstreamRes.statusCode ?? 200);
          // Forward response headers (excluding hop-by-hop)
          for (const [k, v] of Object.entries(upstreamRes.headers)) {
            if (!['transfer-encoding', 'connection', 'keep-alive'].includes(k)) {
              res.setHeader(k, v as string);
            }
          }
          upstreamRes.pipe(res);
        },
      );

      upstreamReq.on('error', (err) => {
        log(onLog, 'error', 'File upload proxy upstream error', { error: String(err) });
        if (!res.headersSent) {
          res.status(502).json({
            ok: false,
            error: { code: 'GQL_UPSTREAM_ERROR', message: `Upstream request failed: ${err.message}` },
          });
        }
      });

      upstreamReq.write(body);
      upstreamReq.end();
    });

    bb.on('error', (err: Error) => {
      log(onLog, 'error', 'File upload busboy parse error', { error: String(err) });
      if (!res.headersSent) {
        res.status(400).json({
          ok: false,
          error: { code: 'GQL_INVALID_REQUEST', message: `Multipart parse error: ${err.message}` },
        });
      }
    });

    req.pipe(bb);
  });

  return router;
}
