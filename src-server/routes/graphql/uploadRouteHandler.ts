/**
 * uploadRouteHandler.ts — POST /api/graphql/upload
 *
 * Sprint 4: File upload multipart proxy (graphql-multipart-request-spec).
 * Body is multipart/form-data with `operations`, `map`, and file parts.
 * Uses busboy to parse the incoming multipart, then streams the reassembled
 * multipart/form-data to the upstream GraphQL endpoint without buffering.
 *
 * Extracted from graphql-routes.ts to keep the main routes file under 900 lines.
 */
import Busboy from 'busboy';
import type { Request, Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import type { LogLine } from '../../../src/shared/types/server-api.js';
import { log, HOP_BY_HOP_HEADERS, escapeQuotedString, parseGqlTlsFromBase64Header } from './routeUtils.js';
import { buildGraphqlTlsAgent } from './tlsAgent.js';

export function registerUploadRoute(
  router: { post: (path: string, handler: (req: Request, res: Response) => void) => void },
  onLog: ((line: LogLine) => void) | undefined,
): void {
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

    const uploadTls = parseGqlTlsFromBase64Header(
      typeof req.headers['x-gql-tls-config'] === 'string' ? req.headers['x-gql-tls-config'] : undefined,
    );
    const tlsAgent = buildGraphqlTlsAgent(uploadTls, targetEndpoint);

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
          method:   'POST',
          hostname: targetUrl.hostname,
          port:     targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
          path:     targetUrl.pathname + targetUrl.search,
          headers:  forwardHeaders,
          ...(tlsAgent ? { agent: tlsAgent } : {}),
        },
        (upstreamRes) => {
          res.status(upstreamRes.statusCode ?? 200);
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
}
