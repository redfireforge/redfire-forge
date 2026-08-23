/**
 * Native Tauri GraphQL multipart upload — rustls skip-cert / CA / mTLS.
 *
 * Mirrors `tauriGqlNativeFetch` for graphql-multipart-request-spec uploads
 * when custom TLS is active on desktop (no Node proxy on port 3001).
 */

import type { HttpResponse } from '@shared/utils/httpClient';
import { serializeGqlTlsForProxy, type GqlTlsSettings } from '@shared/types/gqlTls';
import { toHttpResponse } from './tauriGqlNativeFetch';

export interface GqlNativeUploadPart {
  kind: 'field' | 'file';
  name: string;
  value?: string;
  filename?: string;
  mimeType?: string;
  dataBase64?: string;
}

interface GqlHttpUploadResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

/** Serialize browser FormData for the Rust multipart builder. */
export async function serializeFormDataForNativeUpload(
  formData: FormData,
): Promise<GqlNativeUploadPart[]> {
  const parts: GqlNativeUploadPart[] = [];
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string') {
      parts.push({ kind: 'field', name, value });
      continue;
    }
    const buf = await value.arrayBuffer();
    parts.push({
      kind: 'file',
      name,
      filename: value.name,
      mimeType: value.type || 'application/octet-stream',
      dataBase64: bytesToBase64(new Uint8Array(buf)),
    });
  }
  return parts;
}

/** Invoke `gql_http_upload` with abort support via a racing promise. */
export async function tauriGqlNativeUpload(
  endpoint: string,
  formData: FormData,
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
  tls: GqlTlsSettings,
): Promise<HttpResponse> {
  if (signal?.aborted) {
    return { status: 0, statusText: '', headers: {}, body: '', error: 'Aborted' };
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const parts = await serializeFormDataForNativeUpload(formData);
  const forwardHeaders = { ...headers };
  for (const k of Object.keys(forwardHeaders)) {
    if (k.toLowerCase() === 'content-type') delete forwardHeaders[k];
  }

  const request = {
    url: endpoint,
    headers: forwardHeaders,
    parts,
    ...serializeGqlTlsForProxy(tls),
  };

  const invokePromise = invoke<GqlHttpUploadResponse>('gql_http_upload', { request });

  if (!signal) {
    try {
      return toHttpResponse(await invokePromise);
    } catch (err) {
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error: err instanceof Error ? err.message : 'Native GraphQL upload request failed',
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
          error: err instanceof Error ? err.message : 'Native GraphQL upload request failed',
        });
      });
  });
}
