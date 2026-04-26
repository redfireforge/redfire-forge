import { isTauri, isNode } from './platform';
import type { TimingBreakdown } from '../types';

/** Walk the error `.cause` chain to build a detailed message string. */
function deepErrorMessage(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      parts.push(code ? `${current.message} [${code}]` : current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(' — ');
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
  timing?: TimingBreakdown;
}

export type HttpTransportFn = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
) => Promise<HttpResponse>;

let _transportOverride: HttpTransportFn | null = null;

/**
 * Override the HTTP transport used by httpFetch.
 * Pass `null` to restore the default auto-detection behaviour.
 * Used by the execution worker to route requests via postMessage.
 */
export function setHttpTransport(fn: HttpTransportFn | null): void {
  _transportOverride = fn;
}

/**
 * Makes an HTTP request using the best available transport:
 * - Custom override (set via setHttpTransport — used by workers)
 * - Tauri native HTTP plugin (desktop app, no CORS)
 * - Node native fetch (CLI runner)
 * - Vite dev proxy (browser dev mode)
 */
export async function httpFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  if (_transportOverride) return _transportOverride(url, method, headers, body);
  if (isNode()) {
    return nodeFetch(url, method, headers, body);
  }
  if (isTauri()) {
    return tauriFetch(url, method, headers, body);
  }
  return proxyFetch(url, method, headers, body);
}

async function tauriFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  try {
    const { fetch: tFetch } = await import('@tauri-apps/plugin-http');
    const opts: RequestInit & { headers: Record<string, string> } = {
      method,
      headers,
    };
    if (body && method !== 'GET') {
      opts.body = body;
    }

    const t0 = performance.now();
    const response = await tFetch(url, opts);
    const tFirstByte = performance.now();
    const responseBody = await response.text();
    const tDone = performance.now();

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      timing: {
        dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0,
        ttfb: round2(tFirstByte - t0),
        download: round2(tDone - tFirstByte),
        total: round2(tDone - t0),
      },
    };
  } catch (err) {
    return {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: deepErrorMessage(err),
    };
  }
}

async function proxyFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  const resp = await fetch('/__proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method, headers, body }),
  });
  return resp.json();
}

let _nodeDispatcher: unknown = undefined;
let _nodeDispatcherInited = false;

async function getNodeDispatcher(): Promise<unknown> {
  if (_nodeDispatcherInited) return _nodeDispatcher;
  _nodeDispatcherInited = true;
  try {
    const undici = await import('undici');
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
      || process.env.HTTP_PROXY || process.env.http_proxy;
    if (proxy) {
      _nodeDispatcher = undici.EnvHttpProxyAgent
        ? new undici.EnvHttpProxyAgent()
        : new undici.ProxyAgent(proxy);
    } else {
      _nodeDispatcher = new undici.Agent({
        keepAliveTimeout: 30_000,
        keepAliveMaxTimeout: 60_000,
        connections: 128,
        pipelining: 1,
      });
    }
  } catch { /* undici not available — use default global dispatcher */ }
  return _nodeDispatcher;
}

/** Closes the shared Node dispatcher and resets the cache. */
export async function closeNodePool(): Promise<void> {
  if (_nodeDispatcher && typeof (_nodeDispatcher as { close?: () => Promise<void> }).close === 'function') {
    await (_nodeDispatcher as { close: () => Promise<void> }).close();
  }
  _nodeDispatcher = undefined;
  _nodeDispatcherInited = false;
}

async function nodeFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  try {
    const dispatcher = await getNodeDispatcher();
    const pooledHeaders = { ...headers, 'Connection': 'keep-alive' };
    const opts: Record<string, unknown> = { method, headers: pooledHeaders };
    if (body && method !== 'GET') opts.body = body;
    if (dispatcher) opts.dispatcher = dispatcher;

    const t0 = performance.now();
    const response = await fetch(url, opts as RequestInit);
    const tFirstByte = performance.now();
    const responseBody = await response.text();
    const tDone = performance.now();

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    const total = round2(tDone - t0);
    const download = round2(tDone - tFirstByte);
    const ttfb = round2(tFirstByte - t0);

    return {
      status: response.status, statusText: response.statusText,
      headers: responseHeaders, body: responseBody,
      timing: { dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0, ttfb, download, total },
    };
  } catch (err) {
    return { status: 0, statusText: '', headers: {}, body: '', error: deepErrorMessage(err) };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
