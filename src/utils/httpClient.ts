import { isTauri, isNode } from './platform';

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

/**
 * Makes an HTTP request using the best available transport:
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
    const response = await tFetch(url, opts);
    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });
    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (err) {
    return {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: err instanceof Error ? err.message : String(err),
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
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxy) return undefined;
  try {
    const undici = await import('undici');
    if (undici.EnvHttpProxyAgent) {
      _nodeDispatcher = new undici.EnvHttpProxyAgent();
    } else if (undici.ProxyAgent) {
      _nodeDispatcher = new undici.ProxyAgent(proxy);
    }
  } catch { /* undici not available, proceed without proxy */ }
  return _nodeDispatcher;
}

async function nodeFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  try {
    const dispatcher = await getNodeDispatcher();
    const opts: Record<string, unknown> = { method, headers };
    if (body && method !== 'GET') opts.body = body;
    if (dispatcher) opts.dispatcher = dispatcher;
    const response = await fetch(url, opts as RequestInit);
    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });
    return { status: response.status, statusText: response.statusText, headers: responseHeaders, body: responseBody };
  } catch (err) {
    return { status: 0, statusText: '', headers: {}, body: '', error: err instanceof Error ? err.message : String(err) };
  }
}
