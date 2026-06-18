/**
 * gqlFetch — GraphQL Studio HTTP transport helper.
 *
 * Thin wrapper around httpFetch that adds `skipTlsVerify` support.
 * In web mode the flag is forwarded to the /__proxy middleware which
 * creates an undici Agent with rejectUnauthorized:false for that request.
 * In Tauri mode, httpFetch is used as-is (Tauri handles TLS separately).
 *
 * Phase 2.0 Sprint 4: also exports `gqlUpload` for multipart file upload via
 * the /api/graphql/upload proxy route.
 */

import { isTauri } from '../../../shared/utils/platform';
import { httpFetch } from '../../../shared/utils/httpClient';
import type { HttpResponse } from '../../../shared/utils/httpClient';

export async function gqlFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  signal?: AbortSignal,
  skipTlsVerify?: boolean,
): Promise<HttpResponse> {
  if (signal?.aborted) {
    return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
  }

  // For Tauri (desktop) or when TLS skip is not requested, use standard httpFetch
  if (!skipTlsVerify || isTauri()) {
    return httpFetch(url, method, headers, body, signal);
  }

  // Web path with TLS skip: call /__proxy directly with the skipTlsVerify flag
  try {
    const resp = await fetch('/__proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, headers, body, skipTlsVerify: true }),
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
export async function gqlUpload(
  endpoint: string,
  formData: FormData,
  headers: Record<string, string>,
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number) => void,
): Promise<HttpResponse> {
  if (signal?.aborted) {
    return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
  }

  const uploadProxyUrl = '/api/graphql/upload';
  const fetchHeaders: Record<string, string> = {
    ...headers,
    'x-graphql-endpoint': endpoint,
  };
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
