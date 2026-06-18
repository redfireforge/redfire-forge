/**
 * gqlFetch — GraphQL Studio HTTP transport helper.
 *
 * Thin wrapper around httpFetch that adds `skipTlsVerify` support.
 * In web mode the flag is forwarded to the /__proxy middleware which
 * creates an undici Agent with rejectUnauthorized:false for that request.
 * In Tauri mode, httpFetch is used as-is (Tauri handles TLS separately).
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
