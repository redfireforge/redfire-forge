import { isTauri } from './platform';

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

/**
 * Makes an HTTP request, using Tauri's native HTTP plugin (no CORS)
 * when running as a desktop app, or the Vite dev proxy when running
 * in the browser.
 */
export async function httpFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
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
