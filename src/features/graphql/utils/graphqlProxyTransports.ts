/**
 * graphqlProxyTransports.ts — Node.js proxy-based subscription transports.
 *
 * Phase 2A: WebSocket subscription proxy transport (`createWsProxyTransport`).
 * Phase 2B: SSE subscription proxy transport (`createSseProxyTransport`).
 *
 * Both transports relay subscriptions through the dev-server proxy running on
 * port 3001 so that browser-level TLS certificate restrictions can be bypassed.
 * They share the `subscribeThroughSseProxy` helper that reads raw SSE frames
 * from a streaming `fetch` response.
 *
 * Extracted from graphqlClient.ts to keep that file under 900 lines.
 */
import { buildAuthHeaders, buildConnectionParams } from './authUtils';
import { isTauri } from '../../../shared/utils/platform';
import type { GraphqlTransport, GraphqlSubscribeCallbacks } from './graphqlTransportTypes';
import type { GraphqlAuth, GraphqlResponse } from '../../../shared/types/graphql';

// ─── Proxy base URL ───────────────────────────────────────────────────────────

/**
 * Returns the base URL for Node.js proxy server routes.
 *
 * In Tauri, the proxy server runs on localhost:3001 and is accessed via an
 * absolute URL. In web mode the Vite dev proxy (or production server) routes
 * relative paths like `/api/graphql/*` to port 3001.
 */
export function getProxyBase(): string {
  return isTauri() ? 'http://localhost:3001' : '';
}

// ─── Shared SSE stream parser ─────────────────────────────────────────────────

/**
 * Reads a `ReadableStream<Uint8Array>`, yields `{ event, data }` tuples for
 * each complete SSE event received. Used by both proxy transports.
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = 'message';
  let dataLine = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataLine = line.slice(6);
        } else if (line === '') {
          if (dataLine) {
            yield { event: eventType, data: dataLine };
          }
          eventType = 'message';
          dataLine = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Shared SSE proxy subscriber ──────────────────────────────────────────────

/** Lifecycle state values reported by both proxy transports. */
export type TransportStateChange = (
  state: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed',
  attempt?: number,
) => void;

/**
 * Handles an SSE event stream from a proxy endpoint, converting events to
 * subscription callbacks. Shared by `createWsProxyTransport` and
 * `createSseProxyTransport`.
 *
 * Returns the unsubscribe function that aborts the fetch.
 */
export function subscribeThroughSseProxy(
  proxyUrl: string,
  fetchInit: RequestInit,
  signal: AbortSignal | undefined,
  callbacks: GraphqlSubscribeCallbacks,
  onStateChange?: TransportStateChange,
): () => void {
  const abortController = new AbortController();
  if (signal) {
    signal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  let disposed = false;

  (async () => {
    try {
      onStateChange?.('connecting');
      const resp = await fetch(proxyUrl, {
        ...fetchInit,
        signal: abortController.signal,
      });

      if (!resp.ok || !resp.body) {
        let errMsg = `Proxy request failed: HTTP ${resp.status}`;
        try {
          const body = await resp.text();
          const parsed = JSON.parse(body) as { error?: { message?: string } };
          if (parsed.error?.message) errMsg = parsed.error.message;
        } catch { /* use default */ }
        if (!disposed) callbacks.onError(errMsg);
        return;
      }

      for await (const { event, data } of parseSseStream(resp.body)) {
        if (disposed) break;

        try {
          const parsed: unknown = JSON.parse(data);

          if (event === 'connected') {
            onStateChange?.('connected');
          } else if (event === 'next') {
            callbacks.onMessage(parsed);
          } else if (event === 'error') {
            const errors = Array.isArray(parsed) ? parsed : [{ message: String(parsed) }];
            const msg = (errors as Array<{ message?: string }>)
              .map((e) => e.message ?? String(e))
              .join('; ');
            callbacks.onError(msg);
            disposed = true;
            return;
          } else if (event === 'complete') {
            callbacks.onComplete();
            disposed = true;
            return;
          }
        } catch {
          // Ignore malformed SSE data lines
        }
      }

      if (!disposed) callbacks.onComplete();
    } catch (err) {
      if (disposed) return;
      if (err instanceof Error && err.name === 'AbortError') {
        callbacks.onError('Subscription aborted');
      } else {
        callbacks.onError(`Proxy error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  })();

  return () => {
    disposed = true;
    abortController.abort();
    onStateChange?.('closed');
  };
}

// ─── WS proxy transport (Phase 2A) ────────────────────────────────────────────

/**
 * WebSocket subscription proxy transport.
 *
 * Used when the client cannot open a WebSocket directly to the upstream server
 * (i.e. when `skipTlsVerify=true`). The client sends a POST to the Node.js
 * proxy at `/api/graphql/subscribe`, which opens a WebSocket to the upstream
 * with TLS skip enabled, and relays subscription events back as an SSE stream.
 */
export function createWsProxyTransport(
  subprotocol: 'graphql-transport-ws' | 'graphql-ws' = 'graphql-transport-ws',
  auth?: GraphqlAuth | null,
  onStateChange?: TransportStateChange,
): GraphqlTransport {
  return {
    type: 'ws',

    execute(_query, _variables, _operationName, _params) {
      return Promise.resolve<GraphqlResponse>({
        data: null,
        errors: [{ message: 'WS proxy transport does not support queries/mutations. Use HTTP transport.' }],
        latencyMs: 0, httpStatus: 0, httpHeaders: {}, timestamp: Date.now(),
      });
    },

    subscribe(query, variables, operationName, { endpoint, headers, skipTlsVerify, signal }, callbacks) {
      if (signal?.aborted) {
        callbacks.onError('Aborted before proxy WebSocket connection was opened');
        return () => { /* noop */ };
      }

      const connectionParams = buildConnectionParams(auth);
      const authHeaders = buildAuthHeaders(auth);
      const mergedHeaders = { ...authHeaders, ...headers };

      const body = JSON.stringify({
        endpoint,
        query,
        variables,
        ...(operationName ? { operationName } : {}),
        ...(Object.keys(mergedHeaders).length > 0 ? { headers: mergedHeaders } : {}),
        ...(Object.keys(connectionParams).length > 0 ? { connectionParams } : {}),
        subprotocol,
        skipTlsVerify: !!skipTlsVerify,
      });

      return subscribeThroughSseProxy(
        `${getProxyBase()}/api/graphql/subscribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        signal,
        callbacks,
        onStateChange,
      );
    },
  };
}

// ─── SSE proxy transport (Phase 2B) ───────────────────────────────────────────

/**
 * SSE subscription proxy transport.
 *
 * Used when the client cannot fetch the upstream SSE endpoint directly
 * (i.e. when `skipTlsVerify=true`). The client sends a GET to the Node.js
 * proxy at `/api/graphql/sse`, which opens an HTTPS connection to the upstream
 * with TLS skip enabled, and pipes the SSE stream back to the client.
 */
export function createSseProxyTransport(
  auth?: GraphqlAuth | null,
  onStateChange?: TransportStateChange,
): GraphqlTransport {
  return {
    type: 'sse',

    execute(_query, _variables, _operationName, _params) {
      return Promise.resolve<GraphqlResponse>({
        data: null,
        errors: [{ message: 'SSE proxy transport does not support queries/mutations. Use HTTP transport.' }],
        latencyMs: 0, httpStatus: 0, httpHeaders: {}, timestamp: Date.now(),
      });
    },

    subscribe(query, variables, operationName, { endpoint, headers, skipTlsVerify, signal }, callbacks) {
      if (signal?.aborted) {
        callbacks.onError('Aborted before proxy SSE connection was opened');
        return () => { /* noop */ };
      }

      const authHeaders = buildAuthHeaders(auth);
      const mergedHeaders = { ...authHeaders, ...headers };

      const params = new URLSearchParams();
      params.set('endpoint', endpoint);
      params.set('query', query);
      if (Object.keys(variables).length > 0) {
        params.set('variables', JSON.stringify(variables));
      }
      if (operationName) {
        params.set('operationName', operationName);
      }
      if (skipTlsVerify) {
        params.set('skipTlsVerify', 'true');
      }

      return subscribeThroughSseProxy(
        `${getProxyBase()}/api/graphql/sse?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...mergedHeaders,
          },
        },
        signal,
        callbacks,
        onStateChange,
      );
    },
  };
}
