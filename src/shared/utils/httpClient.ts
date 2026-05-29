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
  /** The actual request headers sent (including auth). Populated by auth-aware callers. */
  sentHeaders?: Record<string, string>;
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
 * Browser / Web Worker: forwards the request through Vite’s POST /__proxy
 * (available with `npm run dev` and `npm run preview`, not on plain static hosting).
 */
export async function httpFetchViaViteProxy(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  signal?: AbortSignal,
): Promise<HttpResponse> {
  try {
    const resp = await fetch('/__proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, headers, body }),
      signal,
    });
    const rawText = await resp.text();
    if (!resp.ok) {
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error:
          `Vite HTTP proxy returned ${resp.status} ${resp.statusText}${rawText ? `: ${rawText.slice(0, 200)}` : ''}. `
          + 'Serve the app with npm run dev or npm run preview so POST /__proxy exists.',
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error:
          `Vite HTTP proxy returned non-JSON (${rawText.slice(0, 160).replace(/\s+/g, ' ') || '(empty)'}). `
          + 'Serve the app with npm run dev or npm run preview.',
      };
    }
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('status' in parsed)
      || typeof (parsed as HttpResponse).status !== 'number'
    ) {
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error: 'Invalid JSON from Vite HTTP proxy.',
      };
    }
    return parsed as HttpResponse;
  } catch (err) {
    const hint =
      err instanceof TypeError || (err instanceof Error && err.message === 'Failed to fetch')
        ? 'Could not reach the app HTTP proxy (POST /__proxy). Start Vite with npm run dev or npm run preview; opening built files as static HTML has no proxy. For OAuth from a static bundle, use the desktop (Tauri) app.'
        : deepErrorMessage(err);
    return {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: hint,
    };
  }
}

/**
 * Makes an HTTP request using the best available transport:
 * - Custom override (set via setHttpTransport — used by workers)
 * - Tauri native HTTP plugin (desktop app, no CORS)
 * - Node native fetch (CLI runner)
 * - Vite dev/preview proxy (browser)
 */
export async function httpFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  signal?: AbortSignal,
): Promise<HttpResponse> {
  if (signal?.aborted) {
    return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
  }
  if (_transportOverride) {
    if (!signal) return _transportOverride(url, method, headers, body);
    return Promise.race([
      _transportOverride(url, method, headers, body),
      new Promise<HttpResponse>((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    ]).catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' } as HttpResponse;
      }
      throw err;
    });
  }
  if (isNode()) {
    return nodeFetch(url, method, headers, body, signal);
  }
  if (isTauri()) {
    return tauriFetch(url, method, headers, body, signal);
  }
  return proxyFetch(url, method, headers, body, signal);
}

async function tauriFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  signal?: AbortSignal,
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
    if (signal) {
      opts.signal = signal;
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
  body?: string,
  signal?: AbortSignal,
): Promise<HttpResponse> {
  return httpFetchViaViteProxy(url, method, headers, body, signal);
}

let _nodeDispatcher: unknown = undefined;
let _nodeDispatcherInited = false;
let _nodeDispatcherIsProxy = false;

async function getNodeDispatcher(): Promise<{ dispatcher: unknown; isProxy: boolean }> {
  if (_nodeDispatcherInited) return { dispatcher: _nodeDispatcher, isProxy: _nodeDispatcherIsProxy };
  _nodeDispatcherInited = true;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — vite-ignore prevents Vite from bundling undici into the browser chunk;
    // the try-catch handles the graceful miss in non-Node (browser/Tauri) contexts.
    const undici = await import(/* @vite-ignore */ 'undici');
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
      || process.env.HTTP_PROXY || process.env.http_proxy;
    if (proxy) {
      _nodeDispatcher = undici.EnvHttpProxyAgent
        ? new undici.EnvHttpProxyAgent()
        : new undici.ProxyAgent(proxy);
      _nodeDispatcherIsProxy = true;
    } else {
      _nodeDispatcher = new undici.Agent({
        keepAliveTimeout: 30_000,
        keepAliveMaxTimeout: 60_000,
        connect: { timeout: 10_000 },
        connections: 512,
        pipelining: 10,
      });
      _nodeDispatcherIsProxy = false;
    }
  } catch { /* undici not available — use default global dispatcher */ }
  return { dispatcher: _nodeDispatcher, isProxy: _nodeDispatcherIsProxy };
}

/** Closes the shared Node dispatcher and resets the cache. */
export async function closeNodePool(): Promise<void> {
  if (_nodeDispatcher && typeof (_nodeDispatcher as { close?: () => Promise<void> }).close === 'function') {
    await (_nodeDispatcher as { close: () => Promise<void> }).close();
  }
  _nodeDispatcher = undefined;
  _nodeDispatcherInited = false;
  _nodeDispatcherIsProxy = false;
}

const PROXY_RETRY_CODES = new Set([
  'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET',
  'UND_ERR_ABORTED', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET',
]);

function isProxyError(err: unknown): boolean {
  let cur: unknown = err;
  const seen = new Set<unknown>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      const code = (cur as NodeJS.ErrnoException).code;
      if (code && PROXY_RETRY_CODES.has(code)) return true;
      if (/Proxy response \(\d+\) !== 200 when HTTP Tunneling/i.test(cur.message)) return true;
      cur = cur.cause;
    } else break;
  }
  return false;
}

async function nodeFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  signal?: AbortSignal,
): Promise<HttpResponse> {
  try {
    const { dispatcher, isProxy } = await getNodeDispatcher();
    const pooledHeaders = { ...headers, 'Connection': 'keep-alive' };
    const opts: Record<string, unknown> = { method, headers: pooledHeaders };
    if (body && method !== 'GET') opts.body = body;
    if (dispatcher) opts.dispatcher = dispatcher;
    if (signal) opts.signal = signal;

    const doFetch = async (fetchOpts: Record<string, unknown>) => {
      const t0 = performance.now();
      const response = await fetch(url, fetchOpts as RequestInit);
      const tFirstByte = performance.now();
      const responseBody = await response.text();
      const tDone = performance.now();

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => { responseHeaders[k] = v; });

      return {
        status: response.status, statusText: response.statusText,
        headers: responseHeaders, body: responseBody,
        timing: {
          dnsLookup: 0, tcpConnect: 0, tlsHandshake: 0,
          ttfb: round2(tFirstByte - t0),
          download: round2(tDone - tFirstByte),
          total: round2(tDone - t0),
        },
      };
    };

    try {
      return await doFetch(opts);
    } catch (proxyErr) {
      if (isProxy && isProxyError(proxyErr)) {
        const directOpts = { ...opts };
        delete directOpts.dispatcher;
        return await doFetch(directOpts);
      }
      throw proxyErr;
    }
  } catch (err) {
    return { status: 0, statusText: '', headers: {}, body: '', error: deepErrorMessage(err) };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
