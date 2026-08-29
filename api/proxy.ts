/**
 * Vercel Serverless Function — HTTP forward proxy for the RedfireForge web app.
 *
 * The browser-based app cannot make cross-origin requests directly (CORS), so
 * every HTTP test request is sent here as a JSON envelope and forwarded
 * server-side.  This mirrors the Vite dev/preview middleware at `/__proxy`
 * (`vite.config.ts`) so the same frontend code works in both environments.
 *
 * Route:   POST /__proxy   →  (vercel.json rewrite)  →  /api/proxy
 * Runtime: Node.js (not Edge) — needs full TCP stack for arbitrary hosts.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProxyPayload {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface ProxyResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing?: { ttfb: number; download: number; total: number };
  error?: string;
}

// ---------------------------------------------------------------------------
// SSRF protection — block requests to private / link-local ranges
// ---------------------------------------------------------------------------

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',
  '169.254.169.254', // AWS / GCP instance metadata
]);

const PRIVATE_IP_RE =
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc00:|fe80:)/;

function isBlockedTarget(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') return true;
    if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return true;
    if (PRIVATE_IP_RE.test(hostname)) return true;
    return false;
  } catch {
    return true; // unparseable URL — block it
  }
}

// ---------------------------------------------------------------------------
// Allowed origins — only requests from our own deployment
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN_RE =
  /^https?:\/\/(localhost(:\d+)?|.*\.redfireforge\.com|.*\.vercel\.app)$/;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_RE.test(origin);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const MAX_BODY = 2 * 1024 * 1024; // 2 MB — same cap as the Vite proxy

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // CORS pre-flight
  const origin = req.headers['origin'] as string | undefined;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  // Collect request body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');

  let payload: ProxyPayload;
  try {
    payload = JSON.parse(rawBody) as ProxyPayload;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  if (!payload.url || !payload.method) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url or method' }));
    return;
  }

  // SSRF guard
  if (isBlockedTarget(payload.url)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Blocked: requests to private or non-HTTP targets are not allowed (${new URL(payload.url).hostname})` }));
    return;
  }

  // Forward the request
  try {
    const fetchOpts: RequestInit = {
      method: payload.method,
      headers: payload.headers as HeadersInit,
    };
    if (payload.body && payload.method !== 'GET') {
      fetchOpts.body = payload.body;
    }

    const t0 = performance.now();
    const upstream = await fetch(payload.url, fetchOpts);
    const tFirstByte = performance.now();

    const rawResponse = await upstream.text();
    const tDone = performance.now();

    const responseBody =
      rawResponse.length > MAX_BODY ? rawResponse.slice(0, MAX_BODY) : rawResponse;

    const resHeaders: Record<string, string> = {};
    upstream.headers.forEach((v, k) => { resHeaders[k] = v; });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const result: ProxyResult = {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders,
      body: responseBody,
      timing: {
        ttfb: round2(tFirstByte - t0),
        download: round2(tDone - tFirstByte),
        total: round2(tDone - t0),
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: ProxyResult = {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: `Proxy fetch failed: ${message}`,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
}
