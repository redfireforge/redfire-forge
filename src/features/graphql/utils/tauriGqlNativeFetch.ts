/**
 * Native Tauri GraphQL HTTP transport — rustls skip-cert / CA / mTLS.
 *
 * Used by gqlFetch when custom TLS settings are active on desktop. Mirrors the
 * WebSocket native transport (ws_connect) so GQL-5 mTLS works without the
 * Node.js proxy on port 3001.
 */

import type { HttpResponse } from '../../../shared/utils/httpClient';
import { serializeGqlTlsForProxy, type GqlTlsSettings } from '../../../shared/types/gqlTls';

interface GqlHttpFetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

export function toHttpResponse(native: GqlHttpFetchResponse): HttpResponse {
  return {
    status: native.status,
    statusText: native.statusText,
    headers: native.headers,
    body: native.body,
    error: native.error,
  };
}

/** Invoke `gql_http_fetch` with abort support via a racing promise. */
export async function tauriGqlNativeFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal | undefined,
  tls: GqlTlsSettings,
): Promise<HttpResponse> {
  if (signal?.aborted) {
    return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const tlsPayload = serializeGqlTlsForProxy(tls);

  const request = {
    url,
    method,
    headers,
    body,
    ...tlsPayload,
  };

  const invokePromise = invoke<GqlHttpFetchResponse>('gql_http_fetch', { request });

  if (!signal) {
    try {
      return toHttpResponse(await invokePromise);
    } catch (err) {
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error: err instanceof Error ? err.message : 'Native GraphQL HTTP request failed',
      };
    }
  }

  return new Promise<HttpResponse>((resolve) => {
    const onAbort = () => {
      resolve({ status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' });
    };
    signal.addEventListener('abort', onAbort, { once: true });

    invokePromise
      .then((native) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) {
          resolve({ status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' });
          return;
        }
        resolve(toHttpResponse(native));
      })
      .catch((err: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) {
          resolve({ status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' });
          return;
        }
        resolve({
          status: 0,
          statusText: '',
          headers: {},
          body: '',
          error: err instanceof Error ? err.message : 'Native GraphQL HTTP request failed',
        });
      });
  });
}
