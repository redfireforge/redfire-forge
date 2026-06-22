/**
 * sseRouteHandler.ts — GET/POST /api/graphql/sse subscription relay.
 *
 * GET  — skipTlsVerify-only (query-string params).
 * POST — CA / mTLS PEM fields (JSON body; avoids URL length limits).
 */
import type { Request, Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import type { LogLine } from '../../../src/shared/types/server-api.js';
import { log, HOP_BY_HOP_HEADERS } from './routeUtils.js';
import { tlsAgentForEndpoint } from './tlsAgent.js';
import { rejectPemTlsInQueryParams } from './routeTlsQueryGuards.js';
import { parseGqlTlsFromBody, type GqlTlsSettings } from '../../../src/shared/types/gqlTls.js';

interface SseRelayParams {
  endpointParam: string;
  queryParam: string;
  variablesParam?: string;
  operationNameParam?: string;
  forwardHeaders: Record<string, string>;
  sseTls: GqlTlsSettings;
}

function normaliseSseEndpoint(endpointParam: string): URL | null {
  try {
    const normalised =
      endpointParam.startsWith('wss://') ? `https://${endpointParam.slice(6)}` :
      endpointParam.startsWith('ws://')  ? `http://${endpointParam.slice(5)}`  :
      endpointParam;
    return new URL(normalised);
  } catch {
    return null;
  }
}

function startSseUpstreamRelay(
  req: Request,
  res: Response,
  onLog: ((line: LogLine) => void) | undefined,
  opts: SseRelayParams,
): void {
  const targetUrl = normaliseSseEndpoint(opts.endpointParam);
  if (!targetUrl) {
    res.status(400).json({
      ok: false,
      error: { code: 'GQL_INVALID_REQUEST', message: `Invalid endpoint URL: ${opts.endpointParam}` },
    });
    return;
  }

  targetUrl.searchParams.set('query', opts.queryParam);
  if (opts.variablesParam) {
    targetUrl.searchParams.set('variables', opts.variablesParam);
  }
  if (opts.operationNameParam) {
    targetUrl.searchParams.set('operationName', opts.operationNameParam);
  }

  const forwardHeaders: Record<string, string> = { ...opts.forwardHeaders };
  forwardHeaders.accept = 'text/event-stream';
  forwardHeaders['cache-control'] = 'no-cache';

  log(onLog, 'info', 'SSE subscription proxy: connecting to upstream', { endpoint: targetUrl.toString() });

  const transport = targetUrl.protocol === 'https:' ? https : http;
  const tlsAgent = tlsAgentForEndpoint(opts.sseTls, targetUrl.toString());

  const upstreamReq = transport.request(
    {
      method: 'GET',
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      headers: forwardHeaders,
      ...(tlsAgent ? { agent: tlsAgent } : {}),
    },
    (upstreamRes) => {
      const status = upstreamRes.statusCode ?? 200;

      if (status !== 200) {
        log(onLog, 'warn', 'SSE subscription proxy: upstream returned non-200', { status });
        upstreamRes.resume();
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`event: error\ndata: ${JSON.stringify([{ message: `Upstream SSE returned HTTP ${status}` }])}\n\n`);
        res.end();
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();

      upstreamRes.on('error', (err: Error) => {
        log(onLog, 'error', 'SSE subscription proxy: upstream response error', { error: err.message });
        if (!res.writableEnded) {
          res.write(`event: error\ndata: ${JSON.stringify([{ message: err.message }])}\n\n`);
          res.end();
        }
      });

      upstreamRes.pipe(res, { end: true });
    },
  );

  upstreamReq.on('error', (err: Error) => {
    log(onLog, 'error', 'SSE subscription proxy: upstream error', { error: err.message });
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
    }
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify([{ message: err.message }])}\n\n`);
      res.end();
    }
  });

  req.on('close', () => {
    upstreamReq.destroy();
  });

  upstreamReq.end();
}

function collectForwardHeaders(req: Request, extra: Record<string, string> = {}): Record<string, string> {
  const forwardHeaders: Record<string, string> = { ...extra };
  for (const [h, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(h.toLowerCase()) && typeof v === 'string') {
      const lk = h.toLowerCase();
      if (!(lk in forwardHeaders)) forwardHeaders[lk] = v;
    }
  }
  return forwardHeaders;
}

export function registerSseRoutes(
  router: { get: (path: string, handler: (req: Request, res: Response) => void) => void;
    post: (path: string, handler: (req: Request, res: Response) => void) => void },
  onLog: ((line: LogLine) => void) | undefined,
): void {
  router.get('/api/graphql/sse', (req: Request, res: Response) => {
    const endpointParam = req.query.endpoint;
    if (typeof endpointParam !== 'string' || !endpointParam) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` query param (string) is required' },
      });
      return;
    }

    const queryParam = req.query.query;
    if (typeof queryParam !== 'string' || !queryParam) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`query` query param (string) is required' },
      });
      return;
    }

    if (rejectPemTlsInQueryParams(req.query as Record<string, unknown>, res)) {
      return;
    }

    const sseTls = parseGqlTlsFromBody({
      skipTlsVerify: req.query.skipTlsVerify === 'true',
    });

    startSseUpstreamRelay(req, res, onLog, {
      endpointParam,
      queryParam,
      variablesParam: typeof req.query.variables === 'string' ? req.query.variables : undefined,
      operationNameParam: typeof req.query.operationName === 'string' ? req.query.operationName : undefined,
      forwardHeaders: collectForwardHeaders(req),
      sseTls,
    });
  });

  router.post('/api/graphql/sse', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const endpointParam = body?.endpoint;
    const queryParam = body?.query;

    if (typeof endpointParam !== 'string' || !endpointParam) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`endpoint` (string) is required' },
      });
      return;
    }
    if (typeof queryParam !== 'string' || !queryParam) {
      res.status(400).json({
        ok: false,
        error: { code: 'GQL_INVALID_REQUEST', message: '`query` (string) is required' },
      });
      return;
    }

    const extraHeaders = (body?.headers && typeof body.headers === 'object' && !Array.isArray(body.headers))
      ? (body.headers as Record<string, string>)
      : {};

    let variablesParam: string | undefined;
    if (body?.variables !== undefined) {
      variablesParam = JSON.stringify(body.variables);
    }

    startSseUpstreamRelay(req, res, onLog, {
      endpointParam,
      queryParam,
      variablesParam,
      operationNameParam: typeof body?.operationName === 'string' ? body.operationName : undefined,
      forwardHeaders: collectForwardHeaders(req, extraHeaders),
      sseTls: parseGqlTlsFromBody(body),
    });
  });
}
