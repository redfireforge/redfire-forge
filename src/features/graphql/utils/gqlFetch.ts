/**
 * gqlFetch — GraphQL Studio HTTP transport helper.
 *
 * Thin wrapper around httpFetch that adds `skipTlsVerify` support.
 * In web mode the flag is forwarded to the /__proxy middleware which
 * creates an undici Agent with rejectUnauthorized:false for that request.
 * In Tauri mode, loopback POST and custom TLS route through the Node proxy on
 * port 3001; trusted remote HTTPS uses httpFetch directly.
 *
 * Phase 2.0 Sprint 4: also exports `gqlUpload` for multipart file upload via
 * the /api/graphql/upload proxy route.
 */

import { isTauri } from '../../../shared/utils/platform';
import { httpFetch } from '../../../shared/utils/httpClient';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import {
  gqlRequiresTlsProxy,
  normalizeGqlFetchTls,
  serializeGqlTlsForProxy,
  tlsApqGetNeedsPostProxy,
  type GqlTlsSettings,
} from '../../../shared/types/gqlTls';
import { isLoopbackUrl } from '../../../shared/utils/loopbackUrl';
import { isGraphqlMockEndpoint } from './graphqlEndpointUtils';
import { getProxyBase } from './graphqlProxyTransports';

/** Relay POST GraphQL through Node /api/graphql/query (Tauri + custom TLS). */
async function gqlFetchViaGraphqlQueryProxy(
  endpoint: string,
  headers: Record<string, string>,
  body: string,
  signal: AbortSignal | undefined,
  tls: GqlTlsSettings,
): Promise<HttpResponse> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: 'Invalid JSON body for GraphQL query proxy',
    };
  }

  const proxyBody = {
    endpoint,
    query: parsed.query,
    ...(parsed.variables !== undefined ? { variables: parsed.variables } : {}),
    ...(typeof parsed.operationName === 'string' ? { operationName: parsed.operationName } : {}),
    headers,
    ...serializeGqlTlsForProxy(tls),
  };

  try {
    const resp = await fetch(`${getProxyBase()}/api/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(proxyBody),
      signal,
    });
    const text = await resp.text().catch(() => '');
    const responseHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => { responseHeaders[k] = v; });
    return {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders,
      body: text,
    };
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
    }
    return {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: err instanceof Error
        ? `${err.message} — is the Node proxy running? (npm run server, port 3001)`
        : 'Network error — is the Node proxy running? (npm run server, port 3001)',
    };
  }
}

export async function gqlFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  signal?: AbortSignal,
  tlsInput?: boolean | GqlTlsSettings,
): Promise<HttpResponse> {
  if (signal?.aborted) {
    return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
  }

  const tls = normalizeGqlFetchTls(tlsInput);
  const proxyBase = getProxyBase();

  // Tauri: loopback GraphQL POST via Node proxy — avoids corporate-proxy breakage
  // when localhost→127.0.0.1 rewriting bypasses NO_PROXY; mock server also lives on :3001.
  // Mock execute/introspect must hit /api/graphql/mock directly, not via /api/graphql/query.
  if (
    isTauri()
    && method === 'POST'
    && body
    && isLoopbackUrl(url)
    && !isGraphqlMockEndpoint(url)
    && !url.startsWith('/api/')
    && !url.startsWith(`${proxyBase}/api/`)
  ) {
    return gqlFetchViaGraphqlQueryProxy(url, headers, body, signal, tls);
  }

  if (!gqlRequiresTlsProxy(tls)) {
    const resolvedUrl = isTauri() && url.startsWith('/api/')
      ? `${getProxyBase()}${url}`
      : url;
    return httpFetch(resolvedUrl, method, headers, body, signal);
  }

  // Tauri native HTTP cannot apply custom TLS — route through the Node proxy.
  if (isTauri() && method === 'POST' && body) {
    return gqlFetchViaGraphqlQueryProxy(url, headers, body, signal, tls);
  }

  if (
    isTauri() &&
    method === 'GET' &&
    gqlRequiresTlsProxy(tls) &&
    !url.startsWith('/api/') &&
    !url.startsWith(`${proxyBase}/api/`)
  ) {
    if (tlsApqGetNeedsPostProxy(tls)) {
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error: 'Custom TLS certificates require a POST GraphQL request on desktop',
      };
    }
    try {
      const parsed = new URL(url);
      const proxyParams = new URLSearchParams();
      proxyParams.set('endpoint', `${parsed.origin}${parsed.pathname}`);
      parsed.searchParams.forEach((v, k) => proxyParams.set(k, v));
      if (tls.skipTlsVerify) proxyParams.set('skipTlsVerify', 'true');
      return httpFetch(
        `${proxyBase}/api/graphql/query?${proxyParams.toString()}`,
        'GET',
        headers,
        undefined,
        signal,
      );
    } catch {
      /* fall through to direct httpFetch */
    }
  }

  // Web: Vite / preview POST /__proxy with TLS options.
  if (isTauri()) {
    const resolvedUrl = url.startsWith('/api/')
      ? `${proxyBase}${url}`
      : url;
    return httpFetch(resolvedUrl, method, headers, body, signal);
  }

  try {
    const resp = await fetch('/__proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method,
        headers,
        body,
        ...serializeGqlTlsForProxy(tls),
      }),
      signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error: `Vite HTTP proxy returned ${resp.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`,
      };
    }
    return (await resp.json()) as HttpResponse;
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
    }
    return {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * gqlUpload — sends a multipart/form-data request to the upload proxy route.
 *
 * Sends `formData` (built by `buildMultipartFormData`) to `/api/graphql/upload`,
 * including the upstream `endpoint` as an `x-graphql-endpoint` header.
 * Any additional headers (auth, custom) are forwarded too.
 *
 * The response body is the upstream server's GraphQL JSON response.
 *
 * When `onProgress` is provided, the request uses `XMLHttpRequest` instead of
 * `fetch` so upload progress events are available. The callback is called with
 * `(loaded, total)` as bytes are sent to the proxy (browser → proxy transfer).
 * `total` may be 0 if the browser cannot determine the size in advance (rare).
 */
/** Base64-encode TLS proxy JSON for the upload route header (ASCII-safe PEM). */
function encodeGqlTlsConfigHeader(tls: GqlTlsSettings): string {
  const json = JSON.stringify(serializeGqlTlsForProxy(tls));
  if (typeof btoa === 'function') {
    return btoa(json);
  }
  return Buffer.from(json, 'utf8').toString('base64');
}

export async function gqlUpload(
  endpoint: string,
  formData: FormData,
  headers: Record<string, string>,
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number) => void,
  tlsInput?: boolean | GqlTlsSettings,
): Promise<HttpResponse> {
  if (signal?.aborted) {
    return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
  }

  const uploadProxyUrl = `${getProxyBase()}/api/graphql/upload`;
  const tls = normalizeGqlFetchTls(tlsInput);
  const fetchHeaders: Record<string, string> = {
    ...headers,
    'x-graphql-endpoint': endpoint,
  };
  if (gqlRequiresTlsProxy(tls)) {
    fetchHeaders['x-gql-tls-config'] = encodeGqlTlsConfigHeader(tls);
  }
  // Do NOT set Content-Type — browser sets it automatically with the boundary for FormData.
  // Case-insensitive delete: headers from user input may have any casing.
  for (const k of Object.keys(fetchHeaders)) {
    if (k.toLowerCase() === 'content-type') delete fetchHeaders[k];
  }

  // ── XHR path: use when onProgress is provided ──────────────────────────────
  if (onProgress) {
    return new Promise<HttpResponse>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadProxyUrl);

      // Set all custom headers
      for (const [k, v] of Object.entries(fetchHeaders)) {
        // Skip headers that XHR manages automatically
        if (k.toLowerCase() === 'content-type') continue;
        try { xhr.setRequestHeader(k, v); } catch { /* ignore restricted headers */ }
      }

      // Wire AbortSignal to XHR abort
      const abortHandler = () => xhr.abort();
      signal?.addEventListener('abort', abortHandler, { once: true });

      xhr.upload.onprogress = (e) => {
        onProgress(e.loaded, e.total);
      };

      xhr.onload = () => {
        signal?.removeEventListener('abort', abortHandler);
        const responseHeaders: Record<string, string> = {};
        // Parse response headers (getAllResponseHeaders returns raw string)
        for (const line of xhr.getAllResponseHeaders().split('\r\n')) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            responseHeaders[line.slice(0, colonIdx).trim().toLowerCase()] =
              line.slice(colonIdx + 1).trim();
          }
        }
        resolve({
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
          body: xhr.responseText,
        });
      };

      xhr.onerror = () => {
        signal?.removeEventListener('abort', abortHandler);
        resolve({ status: 0, statusText: '', headers: {}, body: '', error: 'Network error during file upload' });
      };

      xhr.onabort = () => {
        signal?.removeEventListener('abort', abortHandler);
        resolve({ status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' });
      };

      xhr.send(formData);
    });
  }

  // ── Fetch path: no progress tracking ──────────────────────────────────────
  try {
    const resp = await fetch(uploadProxyUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: formData,
      signal,
    });

    const responseHeaders: Record<string, string> = {};
    resp.headers.forEach((val, key) => { responseHeaders[key] = val; });

    const body = await resp.text().catch(() => '');
    return { status: resp.status, statusText: resp.statusText, headers: responseHeaders, body };
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
    }
    return {
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      error: err instanceof Error ? err.message : 'Network error during file upload',
    };
  }
}
