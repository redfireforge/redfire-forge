/**
 * GraphQL Studio server-side routes.
 *
 * Phase 2.0 Sprint 1 — infrastructure scaffold.
 * Phase 2.0 Sprint 4 — real file upload proxy (2E-3).
 * Phase 2.0 Sprint 7 — incremental delivery proxy (2D-2): POST /api/graphql/query.
 * Phase 2A — WS subscription proxy: POST /api/graphql/subscribe
 * Phase 2B — SSE subscription relay: GET /api/graphql/sse
 * Phase 3F — APQ GET route + batch route.
 *
 * Route registration pattern mirrors the existing WS/Kafka routers:
 *   app.use(createGraphqlRouter({ onLog: broadcastLog }));
 *
 * Current routes:
 *   POST /api/graphql/query      — HTTP query/mutation proxy with multipart/mixed passthrough (Sprint 7 — REAL)
 *   GET  /api/graphql/query      — APQ GET proxy: forwards hash-only GET requests (Phase 3F)
 *   POST /api/graphql/batch      — Batch query proxy: executes N operations, returns ExecutionResult[] (Phase 3F)
 *   POST /api/graphql/subscribe  — WS subscription proxy via SSE relay (Phase 2A — REAL)
 *   GET  /api/graphql/sse        — SSE subscription relay proxy (Phase 2B — REAL)
 *   POST /api/graphql/sse        — SSE relay with CA/mTLS in JSON body
 *   POST /api/graphql/upload     — File upload multipart proxy (Sprint 4 — REAL)
 */
import { Router, type Request, type Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import WebSocket from 'ws';
import type { LogLine } from '../../../src/shared/types/server-api.js';
import { createMockRouter } from './mock-routes.js';
import {
  attachBatchResultMeta,
  collectIncomingHttpHeaders,
  padTimedOutResults,
  runSequentialWithTimeout,
  type BatchContext,
} from './batchRouteHelpers.js';
import {
  handleGraphqlTransportWsMessage,
  handleGraphqlWsMessage,
  type SubscriptionState,
} from './subscriptionProtocolHandlers.js';
import { log, HOP_BY_HOP_HEADERS } from './routeUtils.js';
import { registerUploadRoute } from './uploadRouteHandler.js';
import { registerSseRoutes } from './sseRouteHandler.js';
import { tlsAgentForEndpoint } from './tlsAgent.js';
import { rejectPemTlsInQueryParams } from './routeTlsQueryGuards.js';
import { parseGqlTlsFromBody } from '../../../src/shared/types/gqlTls.js';

export interface CreateGraphqlRouterOptions {
  onLog?: (line: LogLine) => void;
}

export function createGraphqlRouter(options: CreateGraphqlRouterOptions = {}): Router {
  const { onLog } = options;
  const router = Router();

  // ── Phase 3E: Mock server routes ─────────────────────────────────────────
  router.use(createMockRouter());

  // ── GET /api/graphql/query ─────────────────────────────────────────────────
  // Phase 3F (task 3F-1): APQ GET proxy.
  //
  // Used when the APQ "Use GET for queries" option is enabled. The client sends
  // the hash-only body as URL-encoded query parameters. The proxy forwards them
  // as-is to the upstream endpoint so the request can be cached by a CDN.
  //
  // Query params expected from client:
  //   endpoint      — upstream GraphQL endpoint URL (required)
  //   extensions    — encodeURIComponent(JSON.stringify({persistedQuery:{...}}))
  //   variables     — encodeURIComponent(JSON.stringify({...})) (optional)
  //   operationName — string (optional)
  //   skipTlsVerify — "true" to disable TLS certificate verification
  //
  // The proxy builds: GET <endpoint>?extensions=<encoded>&variables=<encoded>&...
  router.get('/api/graphql/query', (req: Request, res: Response) => {
    const endpoint = typeof req.query['endpoint'] === 'string' ? req.query['endpoint'] : '';
    if (!endpoint) {
      res.status(400).json({ ok: false, error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` query param is required' } });
      return;
    }

    if (rejectPemTlsInQueryParams(req.query as Record<string, unknown>, res)) {
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(endpoint);
    } catch {
      res.status(400).json({ ok: false, error: { code: 'GQL_INVALID_REQUEST', message: `Invalid endpoint URL: ${endpoint}` } });
      return;
    }

    // Build upstream query string — forward extensions, variables, operationName
    const upstreamParams = new URLSearchParams();
    if (typeof req.query['extensions'] === 'string') {
      upstreamParams.set('extensions', req.query['extensions']);
    }
    if (typeof req.query['variables'] === 'string') {
      upstreamParams.set('variables', req.query['variables']);
    }
    if (typeof req.query['operationName'] === 'string') {
      upstreamParams.set('operationName', req.query['operationName']);
    }

    // Preserve any existing path+search from the endpoint URL
    const existingSearch = targetUrl.search ? targetUrl.search.slice(1) : '';
    const combinedSearch = [existingSearch, upstreamParams.toString()].filter(Boolean).join('&');
    const upstreamPath = targetUrl.pathname + (combinedSearch ? `?${combinedSearch}` : '');

    const skipTlsVerify = req.query['skipTlsVerify'] === 'true';
    const tls = parseGqlTlsFromBody({ skipTlsVerify });
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const tlsAgent = tlsAgentForEndpoint(tls, endpoint);

    // Forward custom headers except connection-level hop-by-hop ones
    const forwardHeaders: Record<string, string> = { 'accept': 'application/json' };
    for (const [h, v] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP_HEADERS.has(h.toLowerCase()) && typeof v === 'string') {
        forwardHeaders[h] = v;
      }
    }

    log(onLog, 'info', 'APQ GET proxy: relaying to upstream', { endpoint, upstreamPath });

    const upstreamReq = transport.request(
      {
        method: 'GET',
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: upstreamPath,
        headers: forwardHeaders,
        ...(tlsAgent ? { agent: tlsAgent } : {}),
      },
      (upstreamRes) => {
        res.status(upstreamRes.statusCode ?? 200);
        for (const [k, v] of Object.entries(upstreamRes.headers)) {
          if (!['connection', 'keep-alive', 'transfer-encoding'].includes(k) && v !== undefined) {
            res.setHeader(k, v as string | string[]);
          }
        }
        upstreamRes.pipe(res, { end: true });
      },
    );

    upstreamReq.on('error', (err) => {
      log(onLog, 'error', 'APQ GET proxy upstream error', { error: String(err) });
      if (!res.headersSent) {
        res.status(502).json({ ok: false, error: { code: 'GQL_UPSTREAM_ERROR', message: err.message } });
      }
    });

    upstreamReq.end();
  });

  // ── POST /api/graphql/batch ─────────────────────────────────────────────────
  // Phase 3F (task 3F-3): Batch query proxy.
  //
  // Accepts N operations and returns ExecutionResult[] in request-index order.
  //
  // Request body: {
  //   endpoint:      string                              (required)
  //   operations:    Array<{ query, variables?, operationName? }>
  //   headers?:      Record<string, string>
  //   skipTlsVerify?: boolean
  //   tryArrayBatch?: boolean  (default: true)
  //   batchTimeoutMs?: number  (default: 30000)
  // }
  //
  // Response: {
  //   results:          ExecutionResult[]   — one per operation, in request order
  //   batchUnsupported?: boolean            — true if server rejected array batch
  // }
  //
  // Server compat detection (try-and-cache-failure pattern, 3F-3):
  //   If tryArrayBatch=true, the proxy first tries forwarding operations as a JSON
  //   array [op1, op2, ...] to the upstream. If the upstream returns 400, 405, or
  //   a non-array JSON body, the proxy falls back to sequential individual POSTs
  //   and sets batchUnsupported=true in the response so the client can cache the
  //   detection result in localStorage.
  router.post('/api/graphql/batch', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
    const operations = Array.isArray(body?.operations) ? (body.operations as Record<string, unknown>[]) : [];

    if (!endpoint) {
      res.status(400).json({ ok: false, error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` is required' } });
      return;
    }
    if (operations.length === 0) {
      res.status(400).json({ ok: false, error: { code: 'GQL_INVALID_REQUEST', message: '`operations` array must not be empty' } });
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(endpoint);
    } catch {
      res.status(400).json({ ok: false, error: { code: 'GQL_INVALID_REQUEST', message: `Invalid endpoint URL: ${endpoint}` } });
      return;
    }

    const extraHeaders = (body?.headers && typeof body.headers === 'object' && !Array.isArray(body.headers))
      ? (body.headers as Record<string, string>)
      : {};
    const tls = parseGqlTlsFromBody(body as Record<string, unknown>);
    const tryArrayBatch = body?.tryArrayBatch !== false; // default true
    // Sanitize: 0, NaN, and negatives are not valid timeouts — fall back to 30 s
    const rawTimeoutMs = typeof body?.batchTimeoutMs === 'number' ? body.batchTimeoutMs : 30000;
    const batchTimeoutMs = Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0 ? rawTimeoutMs : 30000;

    const transport = targetUrl.protocol === 'https:' ? https : http;
    const tlsAgent = tlsAgentForEndpoint(tls, endpoint);
    const baseHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'accept': 'application/json',
    };
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (typeof v === 'string') baseHeaders[k.toLowerCase()] = v;
    }

    log(onLog, 'info', 'Batch proxy: executing batch', { endpoint, count: operations.length, tryArrayBatch });

    // Wall-clock deadline for the entire batch operation — covers both array-batch
    // and sequential fallback so neither path can hold the proxy open indefinitely.
    const batchDeadline = Date.now() + batchTimeoutMs;
    const batchCtx: BatchContext = { transport, targetUrl, baseHeaders, tlsAgent, batchDeadline };

    void (async () => {
      // ── Try array batch ───────────────────────────────────────────────────
      if (tryArrayBatch) {
        const batchBody = operations.map((op) => {
          const o: Record<string, unknown> = { query: op['query'] };
          if (op['variables'] !== undefined) o.variables = op['variables'];
          if (typeof op['operationName'] === 'string' && op['operationName']) o.operationName = op['operationName'];
          return o;
        });
        const bodyStr = JSON.stringify(batchBody);
        const bodyBuf = Buffer.from(bodyStr, 'utf8');
        const headers = { ...baseHeaders, 'content-length': String(bodyBuf.length) };

        const batchStartedAt = Date.now();
        const batchResult = await new Promise<{ status: number; body: string; headers: Record<string, string> }>((resolve) => {
          const holder: { req?: ReturnType<typeof transport.request> } = {};
          const remainingMs = Math.max(0, batchDeadline - Date.now());
          const timer = setTimeout(() => {
            holder.req?.destroy();
            resolve({ status: 408, body: JSON.stringify({ errors: [{ message: 'Batch timeout' }] }), headers: {} });
          }, remainingMs);

          holder.req = transport.request(
            {
              method: 'POST',
              hostname: targetUrl.hostname,
              port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
              path: targetUrl.pathname + targetUrl.search,
              headers,
              ...(tlsAgent ? { agent: tlsAgent } : {}),
            },
            (r) => {
              let raw = '';
              r.on('data', (c: Buffer) => { raw += c.toString('utf8'); });
              r.on('end', () => {
                clearTimeout(timer);
                resolve({
                  status: r.statusCode ?? 200,
                  body: raw,
                  headers: collectIncomingHttpHeaders(r.headers),
                });
              });
            },
          );
          holder.req.on('error', (err) => {
            clearTimeout(timer);
            resolve({
              status: 0,
              body: JSON.stringify({ errors: [{ message: err.message }] }),
              headers: {},
            });
          });
          holder.req.write(bodyBuf);
          holder.req.end();
        });
        const batchLatencyMs = Date.now() - batchStartedAt;
        const batchWireMeta = { headers: batchResult.headers, latencyMs: batchLatencyMs };

        // Timeout abort: the entire batch timed out — return error, no fallback.
        if (batchResult.status === 408) {
          res.status(408).json({ error: 'Batch timeout', results: [] });
          log(onLog, 'warn', 'Batch proxy: batch timed out', { batchTimeoutMs });
          return;
        }

        // Check if upstream returned an array (batch-capable server)
        if (batchResult.status !== 400 && batchResult.status !== 405) {
          try {
            const parsed = JSON.parse(batchResult.body) as unknown;
            if (Array.isArray(parsed)) {
              // Pad or truncate to match operations.length so card order is preserved.
              // Missing slots get a synthetic error entry; extra slots are dropped.
              const normalized = operations.map((_, i) => {
                const item = (parsed as Record<string, unknown>[])[i];
                if (item != null) {
                  return attachBatchResultMeta(
                    { ...item, _index: i },
                    batchResult.status,
                    batchWireMeta,
                  );
                }
                return attachBatchResultMeta(
                  {
                    data: null,
                    errors: [{ message: `No result returned for operation ${i}` }],
                    _index: i,
                  },
                  batchResult.status,
                  batchWireMeta,
                );
              });
              if (parsed.length !== operations.length) {
                log(onLog, 'warn', 'Batch proxy: response array length mismatch', {
                  expected: operations.length,
                  got: parsed.length,
                });
              }
              res.json({ results: normalized, batchUnsupported: false });
              log(onLog, 'info', 'Batch proxy: array batch succeeded', { count: normalized.length });
              return;
            }
          } catch {
            // Non-JSON response — fall through to sequential
          }
        }

        // Array batch not supported by upstream — fall back to sequential within remaining deadline
        log(onLog, 'warn', 'Batch proxy: array batch unsupported, falling back to sequential', {
          status: batchResult.status,
        });
        const { results: seqResults, timedOut } = await runSequentialWithTimeout(operations, batchCtx);
        if (timedOut) {
          // Pad remaining (incomplete) slots with a timeout error so the client can
          // display partial results rather than discarding all successfully completed ops.
          const padded = padTimedOutResults(seqResults, operations.length);
          res.status(408).json({ error: 'Batch timeout', results: padded, batchUnsupported: true });
          log(onLog, 'warn', 'Batch proxy: sequential fallback timed out', { batchTimeoutMs, completed: seqResults.length });
          return;
        }
        res.json({ results: seqResults, batchUnsupported: true });
        return;
      }

      // ── Sequential mode (batchSupported already detected as false) ─────────
      const { results: seqResults, timedOut } = await runSequentialWithTimeout(operations, batchCtx);
      if (timedOut) {
        const padded = padTimedOutResults(seqResults, operations.length);
        res.status(408).json({ error: 'Batch timeout', results: padded, batchUnsupported: false });
        log(onLog, 'warn', 'Batch proxy: sequential mode timed out', { batchTimeoutMs, completed: seqResults.length });
        return;
      }
      res.json({ results: seqResults, batchUnsupported: false });
    })();
  });

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
    const tls = parseGqlTlsFromBody(body);
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

    const tlsAgent = tlsAgentForEndpoint(tls, endpoint);

    log(onLog, 'info', 'Query proxy: relaying to upstream', {
      endpoint,
      acceptMultipart: acceptHeader.includes('multipart'),
      skipTlsVerify,
      hasCaCert: !!tls.caCert,
      hasMtls: !!(tls.clientCert || tls.clientKey),
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
  // Phase 2A: WebSocket subscription proxy using SSE relay.
  //
  // Used when the client cannot open a WebSocket directly to the upstream server
  // (typically when skipTlsVerify=true — browsers cannot bypass TLS on WebSocket).
  // The proxy opens a WebSocket to the upstream (with optional TLS skip), then
  // relays subscription events back to the browser as an SSE stream.
  //
  // Request body: {
  //   endpoint:          string   (required) — ws(s):// or http(s):// URL
  //   query:             string   (required) — GraphQL subscription document
  //   variables?:        object   (default: {})
  //   operationName?:    string
  //   headers?:          Record<string, string>  — forwarded to upstream WS handshake
  //   connectionParams?: Record<string, unknown> — sent in connection_init payload
  //   subprotocol?:      'graphql-transport-ws' | 'graphql-ws'  (default: graphql-transport-ws)
  //   skipTlsVerify?:    boolean  (default: false)
  // }
  //
  // Response: SSE stream with events:
  //   event: connected  — WS connection acknowledged, subscription started
  //   event: next       — subscription message payload (ExecutionResult)
  //   event: error      — subscription error (array of GraphQL errors)
  //   event: complete   — subscription ended cleanly
  router.post('/api/graphql/subscribe', (req: Request, res: Response) => {
    const endpoint: unknown = req.body?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` (string) is required' },
      });
      return;
    }

    const query: unknown = req.body?.query;
    if (typeof query !== 'string' || !query) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`query` (string) is required' },
      });
      return;
    }

    // Normalise endpoint to ws:// / wss://
    const wsUrl: string =
      endpoint.startsWith('https://') ? `wss://${endpoint.slice(8)}` :
      endpoint.startsWith('http://')  ? `ws://${endpoint.slice(7)}`  :
      endpoint;

    const subprotocol: string =
      req.body?.subprotocol === 'graphql-ws' ? 'graphql-ws' : 'graphql-transport-ws';
    const subscribeTls = parseGqlTlsFromBody(req.body as Record<string, unknown>);
    const variables: Record<string, unknown> =
      req.body?.variables && typeof req.body.variables === 'object' && !Array.isArray(req.body.variables)
        ? (req.body.variables as Record<string, unknown>)
        : {};
    const operationName: string | undefined =
      typeof req.body?.operationName === 'string' ? req.body.operationName : undefined;
    const upstreamHeaders: Record<string, string> =
      req.body?.headers && typeof req.body.headers === 'object'
        ? (req.body.headers as Record<string, string>)
        : {};
    const connectionParams: Record<string, unknown> =
      req.body?.connectionParams && typeof req.body.connectionParams === 'object'
        ? (req.body.connectionParams as Record<string, unknown>)
        : {};

    log(onLog, 'info', 'WS subscription proxy: connecting to upstream', { wsUrl, subprotocol });

    // Set up SSE response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const sendEvent = (eventName: string, data: unknown): void => {
      if (!res.writableEnded) {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    // Build WebSocket options
    const wsOptions: WebSocket.ClientOptions = {};
    if (Object.keys(upstreamHeaders).length > 0) {
      wsOptions.headers = upstreamHeaders;
    }
    if (wsUrl.startsWith('wss://')) {
      const agent = tlsAgentForEndpoint(subscribeTls, wsUrl);
      if (agent) wsOptions.agent = agent;
    }

    const ws = new WebSocket(wsUrl, subprotocol, wsOptions);
    const OP_ID = '1';
    const subState: SubscriptionState = { subscribed: false };
    // Set to true when the browser disconnects prematurely so ws.on('close')
    // can skip sending a spurious "WebSocket closed unexpectedly" SSE event.
    let clientDisconnected = false;
    const opParams = { query, variables, operationName, operationId: OP_ID };

    // Cleanup on premature client disconnect.
    // Use res.on('close') + writableEnded guard so that:
    //   - normal completion (res.end() already called) does NOT terminate the WS
    //   - a real client disconnect (browser navigates away) DOES terminate the WS
    // (req.on('close') fires too early in Node.js test clients that half-close
    //  the TCP socket after the request body is sent.)
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
        }
      }
    });

    ws.on('open', () => {
      const initPayload = Object.keys(connectionParams).length > 0 ? connectionParams : undefined;
      ws.send(JSON.stringify({
        type: 'connection_init',
        ...(initPayload ? { payload: initPayload } : {}),
      }));
    });

    ws.on('message', (rawData: WebSocket.RawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      if (subprotocol === 'graphql-transport-ws') {
        handleGraphqlTransportWsMessage(msg, ws, sendEvent, opParams, subState);
      } else {
        handleGraphqlWsMessage(msg, ws, sendEvent, opParams, subState);
      }
    });

    ws.on('error', (err: Error) => {
      log(onLog, 'error', 'WS subscription proxy: upstream error', { error: err.message });
      // Skip SSE write when the error was triggered by our own ws.terminate()
      // after a browser disconnect — the socket is already gone.
      if (!clientDisconnected) {
        sendEvent('error', [{ message: err.message }]);
      }
      if (!res.writableEnded) res.end();
    });

    ws.on('close', (code: number, reason: Buffer) => {
      // Only report unexpected closure if this was NOT triggered by our own cleanup
      // after a browser disconnect — in that case, the socket is already gone.
      if (!clientDisconnected && subState.subscribed && code !== 1000 && !res.writableEnded) {
        const reasonText = reason?.toString() || `code ${code}`;
        sendEvent('error', [{ message: `WebSocket closed unexpectedly: ${reasonText}` }]);
      }
      if (!res.writableEnded) res.end();
    });
  });

  registerSseRoutes(router, onLog);

  // ── POST /api/graphql/upload ────────────────────────────────────────────────
  // Sprint 4: File upload multipart proxy (graphql-multipart-request-spec).
  // Extracted to uploadRouteHandler.ts to keep this file manageable.
  registerUploadRoute(router, onLog);

  return router;
}
