/** Unified transport abstraction for GraphQL Studio. */

import { createClient } from 'graphql-ws';
import { createClient as createSseClient } from 'graphql-sse';
import { parse, visit } from 'graphql';
import { gqlFetch } from './gqlFetch';
import { gqlRequiresTlsProxy, buildTabTlsSettings, type GqlTlsSettings } from '@shared/types/gqlTls';
import { buildAuthHeaders, buildConnectionParams } from './authUtils';
import type { GraphqlResponse, GraphqlAuth, GraphqlError } from '@shared/types/graphql';
import {
  createWsProxyTransport as _createWsProxyTransport,
  createSseProxyTransport as _createSseProxyTransport,
} from './graphqlProxyTransports';
import type {
  GraphqlSubscribeCallbacks,
  GraphqlTransport,
  GraphqlTransportSelector,
} from './graphqlTransportTypes';
export type {
  GraphqlOperationParams,
  GraphqlSubscribeCallbacks,
  GraphqlTransportType,
  GraphqlTransport,
  GraphqlTransportSelector,
} from './graphqlTransportTypes';

/**
 * HTTP transport — wraps `gqlFetch`.
 *
 * Handles query and mutation operations. Subscription operations via HTTP
 * are not supported (call `selectTransport` which will return a WS/SSE
 * transport for subscription operation types instead).
 */
export function createHttpTransport(): GraphqlTransport {
  return {
    type: 'http',

    async execute(query, variables, operationName, { endpoint, headers, skipTlsVerify, tls: tlsInput, tlsCaCert, tlsClientCert, tlsClientKey, signal }) {
      const tls: GqlTlsSettings = tlsInput ?? buildTabTlsSettings({
        skipTlsVerify: !!skipTlsVerify,
        tlsCaCert,
        tlsClientCert,
        tlsClientKey,
      });
      const bodyObj: Record<string, unknown> = { query, variables };
      if (operationName) bodyObj.operationName = operationName;

      const startMs = Date.now();
      const result = await gqlFetch(
        endpoint,
        'POST',
        {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers,
        },
        JSON.stringify(bodyObj),
        signal,
        tls,
      );
      const latencyMs = Date.now() - startMs;

      if (result.error) {
        return {
          // Normalize transport errors to null (not undefined) — consistent with
          // useGraphqlExecution.ts which always sets data=null on all error paths.
          data: null,
          errors: [{ message: result.error }],
          latencyMs,
          httpStatus: result.status,
          httpHeaders: result.headers,
          timestamp: Date.now(),
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.body || '{}');
      } catch {
        return {
          data: null,
          errors: [{ message: `Failed to parse response JSON: ${result.body.slice(0, 200)}` }],
          latencyMs,
          httpStatus: result.status,
          httpHeaders: result.headers,
          timestamp: Date.now(),
        };
      }

      const asRecord = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        ? (parsed as Record<string, unknown>)
        : {};

      return {
        // Normalize: use null (not undefined) when server omits the data field on pure errors.
        // Keeping undefined would cause `data !== null` to be true, reporting 'success' wrongly.
        data: asRecord.data !== undefined ? asRecord.data : null,
        errors: Array.isArray(asRecord.errors) ? (asRecord.errors as GraphqlError[]) : undefined,
        extensions: asRecord.extensions as Record<string, unknown> | undefined,
        latencyMs,
        httpStatus: result.status,
        httpHeaders: result.headers,
        timestamp: Date.now(),
      };
    },

    subscribe(_query, _variables, _operationName, _params, callbacks) {
      const msg = 'HTTP transport does not support subscriptions. Use selectTransport() which returns WS/SSE for subscriptions.';
      callbacks.onError(msg);
      return () => { /* noop — subscription was never opened */ };
    },
  };
}

/**
 * Vendored minimal client for the legacy `graphql-ws` WebSocket subprotocol.
 *
 * This protocol is used by Apollo Server ≤v3 and older GraphQL servers that
 * pre-date the modern `graphql-transport-ws` spec. It is NOT the same as the
 * `graphql-ws` npm package (which implements the modern protocol — confusing).
 *
 * Protocol:
 *   - WS subprotocol identifier: `graphql-ws`
 *   - connection_init → connection_ack → start → data/error/complete → stop
 *
 * Implementation is vendored (~120 lines) to avoid depending on the deprecated
 * `subscriptions-transport-ws` npm package (unmaintained since 2022).
 *
 * @internal  Used only by createWsTransport when subprotocol === 'graphql-ws'.
 */
function subscribeLegacyWs(
  wsUrl: string,
  connectionParams: Record<string, unknown>,
  query: string,
  variables: Record<string, unknown>,
  operationName: string | undefined,
  callbacks: GraphqlSubscribeCallbacks,
  onStateChange?: (state: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed', attempt?: number) => void,
  signal?: AbortSignal,
  WsImpl: typeof WebSocket = WebSocket,
): () => void {
  if (signal?.aborted) {
    callbacks.onError('Aborted before legacy WebSocket connection was opened');
    return () => { /* noop */ };
  }

  onStateChange?.('connecting');

  let ws: WebSocket;
  let disposed = false;
  const OP_ID = '1';

  function dispose(cleanClose = true) {
    if (disposed) return;
    disposed = true;
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        if (cleanClose && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stop', id: OP_ID }));
        }
        ws.close(1000, cleanClose ? 'Subscription complete' : 'Subscription aborted');
      }
    } catch { /* ignore errors during cleanup */ }
    signal?.removeEventListener('abort', abortHandler);
  }

  function abortHandler() {
    dispose(false);
    callbacks.onError('Subscription aborted');
  }

  try {
    ws = new WsImpl(wsUrl, 'graphql-ws');
  } catch (err) {
    callbacks.onError(`Failed to open legacy WebSocket: ${String(err)}`);
    return () => { /* noop */ };
  }

  ws.onopen = () => {
    if (disposed) return;
    // Send connection_init with optional auth payload
    const initPayload = Object.keys(connectionParams).length > 0 ? connectionParams : undefined;
    ws.send(JSON.stringify({
      type: 'connection_init',
      ...(initPayload ? { payload: initPayload } : {}),
    }));
  };

  ws.onmessage = (event: MessageEvent) => {
    if (disposed) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
      return; // ignore unparseable messages
    }

    switch (msg.type) {
      case 'connection_ack':
        onStateChange?.('connected');
        // Start the subscription
        ws.send(JSON.stringify({
          type: 'start',
          id: OP_ID,
          payload: {
            query,
            ...(Object.keys(variables).length > 0 ? { variables } : {}),
            ...(operationName ? { operationName } : {}),
          },
        }));
        break;

      case 'connection_keep_alive':
        break; // heartbeat — no action needed

      case 'ka':
        break; // alias some servers send

      case 'connection_error': {
        const errPayload = msg.payload as Record<string, unknown> | undefined;
        const errMsg = typeof errPayload?.message === 'string'
          ? errPayload.message
          : 'Connection rejected by server (connection_error)';
        dispose(false);
        callbacks.onError(errMsg);
        break;
      }

      case 'data': {
        if (msg.id !== OP_ID) break;
        const payload = (msg.payload ?? {}) as Record<string, unknown>;
        const errors = Array.isArray(payload.errors) ? payload.errors : undefined;
        if (errors && errors.length > 0 && payload.data === undefined) {
          // Pure error frame (no data field at all) — surface as onError
          callbacks.onError(
            (errors as GraphqlError[]).map((e) => e.message).join('; '),
          );
        } else {
          // Pass wrapped { data, errors? } so partial errors are visible.
          // useGraphqlSubscription extracts .data via the 'data' in key check,
          // consistent with the modern WS and SSE transports.
          callbacks.onMessage({ data: payload.data ?? null, ...(errors ? { errors } : {}) });
        }
        break;
      }

      case 'error': {
        if (msg.id !== OP_ID) break;
        const errPayload = msg.payload;
        const errMsg = Array.isArray(errPayload)
          ? (errPayload as GraphqlError[]).map((e) => e.message).join('; ')
          : typeof errPayload === 'string'
          ? errPayload
          : 'Unknown legacy subscription error';
        callbacks.onError(errMsg);
        dispose(false);
        break;
      }

      case 'complete':
        if (msg.id !== OP_ID) break;
        dispose(true);
        callbacks.onComplete();
        onStateChange?.('closed');
        break;

      default:
        break;
    }
  };

  ws.onerror = () => {
    if (disposed) return;
    callbacks.onError('WebSocket error on legacy graphql-ws connection');
    onStateChange?.('error');
    dispose(false);
  };

  ws.onclose = (event: CloseEvent) => {
    if (disposed) return;
    if (!event.wasClean || event.code !== 1000) {
      const reason = event.reason || `code ${event.code}`;
      callbacks.onError(`Legacy WebSocket closed unexpectedly: ${reason}`);
      onStateChange?.('error');
    } else {
      // Server closed cleanly (code 1000) without sending a `complete` message first.
      // Signal stream end so the consumer doesn't hang in a "connected" state.
      callbacks.onComplete();
      onStateChange?.('closed');
    }
  };

  signal?.addEventListener('abort', abortHandler, { once: true });

  return () => dispose(true);
}

/**
 * WebSocket subscription transport using `graphql-ws` npm package.
 *
 * Uses the `graphql-transport-ws` subprotocol (modern, maintained by The Guild).
 * Auth is passed via `connectionParams` in the `connection_init` message.
 *
 * Mode selection (§23.16 Sprint 2):
 *   - Direct browser WebSocket: used when TLS skip is not required and not Tauri.
 *   - Proxied mode (via /api/graphql/subscribe) is planned for Sprint 2.1 —
 *     needed when TLS skip = true or running in Tauri (no native browser WS with TLS skip).
 *
 * Auto-reconnect: `graphql-ws` retries up to `retryAttempts` times with exponential backoff.
 * The `on.connecting(isRetry)` callback allows the caller to show "Reconnecting…" UI.
 *
 * @param subprotocol  Which WS subprotocol to use.
 *                     `graphql-transport-ws` — modern (default); uses `graphql-ws` npm package.
 *                     `graphql-ws` — legacy; uses vendored `subscribeLegacyWs` (Sprint 5 2A-3).
 * @param auth         Auth config from the connection profile; builds connectionParams.
 * @param retryAttempts Max reconnect attempts for modern protocol (default 5; 0 = no reconnect).
 *                     Legacy protocol does not auto-reconnect (matches original Apollo behavior).
 * @param onStateChange Lifecycle hook for state transitions (connecting → active → error).
 */
export function createWsTransport(
  subprotocol: 'graphql-transport-ws' | 'graphql-ws' = 'graphql-transport-ws',
  auth?: GraphqlAuth | null,
  retryAttempts = 5,
  onStateChange?: (state: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed', attempt?: number) => void,
  /** Optional WebSocket constructor override — used in unit tests to avoid real connections. */
  wsImpl?: typeof WebSocket,
): GraphqlTransport {
  if (subprotocol === 'graphql-ws') {
    // Legacy subscriptions-transport-ws protocol (Sprint 5: 2A-3)
    // Uses vendored minimal client to avoid deprecated npm package dependency.
    return {
      type: 'ws',
      execute(_query, _variables, _operationName, _params) {
        return Promise.resolve<GraphqlResponse>({
          // data: null (not undefined) — per BUG-S1-REV-2: undefined causes status checks to
          // report 'success' incorrectly because undefined !== null evaluates true.
          data: null,
          errors: [{ message: 'WS transport does not support queries/mutations. Use HTTP transport.' }],
          latencyMs: 0, httpStatus: 0, httpHeaders: {}, timestamp: Date.now(),
        });
      },
      subscribe(query, variables, operationName, { endpoint, signal }, callbacks) {
        if (signal?.aborted) {
          callbacks.onError('Aborted before legacy WebSocket connection was opened');
          return () => { /* noop */ };
        }
        const wsUrl = deriveWsEndpoint(endpoint);
        const connectionParams = buildConnectionParams(auth);
        return subscribeLegacyWs(
          wsUrl,
          connectionParams,
          query,
          variables,
          operationName,
          callbacks,
          onStateChange,
          signal,
          wsImpl,
        );
      },
    };
  }

  return {
    type: 'ws',

    execute(_query, _variables, _operationName, _params) {
      return Promise.resolve<GraphqlResponse>({
        data: null,
        errors: [{ message: 'WS transport does not support queries/mutations. Use HTTP transport.' }],
        latencyMs: 0, httpStatus: 0, httpHeaders: {}, timestamp: Date.now(),
      });
    },

    subscribe(query, variables, operationName, { endpoint, signal }, callbacks) {
      // Abort before connecting?
      if (signal?.aborted) {
        callbacks.onError('Aborted before WebSocket connection was opened');
        return () => { /* noop */ };
      }

      const wsUrl = deriveWsEndpoint(endpoint);
      const connectionParams = buildConnectionParams(auth);
      let attemptCount = 0;

      const client = createClient({
        url: wsUrl,
        connectionParams: Object.keys(connectionParams).length > 0
          ? connectionParams
          : undefined,
        retryAttempts,
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s, ±20% jitter)
        retryWait: async (attempt) => {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
          const jitter = delay * 0.2 * (Math.random() * 2 - 1);
          await new Promise<void>((r) => setTimeout(r, delay + jitter));
        },
        on: {
          connecting: (isRetry) => {
            if (isRetry) {
              attemptCount++;
              onStateChange?.('reconnecting', attemptCount);
            } else {
              onStateChange?.('connecting');
            }
          },
          connected: () => {
            onStateChange?.('connected');
          },
          error: () => {
            onStateChange?.('error');
          },
          closed: () => {
            onStateChange?.('closed');
          },
        },
      });

      const op: { query: string; variables?: Record<string, unknown>; operationName?: string } = { query };
      if (Object.keys(variables).length > 0) op.variables = variables;
      if (operationName) op.operationName = operationName;

      const unsubscribe = client.subscribe(op, {
        next(result) {
          // Pass the full ExecutionResult (not just result.data) so partial errors
          // (data + errors in the same frame) are visible in the message log.
          // useGraphqlSubscription extracts .data via the 'data' in key check,
          // consistent with the SSE transport which also passes the full result.
          callbacks.onMessage(result);
        },
        error(err) {
          // Retries exhausted or non-retryable error (close codes 4401, 4499, etc.)
          let msg: string;
          if (err instanceof CloseEvent) {
            msg = err.reason
              ? `WebSocket closed (${err.code}): ${err.reason}`
              : `WebSocket closed with code ${err.code}`;
          } else if (err instanceof Error) {
            msg = err.message;
          } else if (Array.isArray(err)) {
            // Array of GraphQL errors
            msg = (err as GraphqlError[]).map((e) => e.message).join('; ');
          } else {
            msg = String(err);
          }
          callbacks.onError(msg);
          void client.dispose();
        },
        complete() {
          callbacks.onComplete();
          void client.dispose();
        },
      });

      // Handle abort signal — immediately close the WS
      const abortHandler = () => {
        unsubscribe();
        void client.dispose();
        callbacks.onError('Subscription aborted');
      };
      signal?.addEventListener('abort', abortHandler, { once: true });

      return () => {
        signal?.removeEventListener('abort', abortHandler);
        unsubscribe();
        void client.dispose();
      };
    },
  };
}

/**
 * Server-Sent Events subscription transport using `graphql-sse`.
 *
 * Uses distinct-connections mode (default): each subscription opens a new HTTP
 * request to the SSE endpoint. Unlike WebSocket, HTTP headers CAN be set on
 * SSE requests, so auth tokens are passed directly via the `Authorization` header.
 *
 * Auto-reconnect: `graphql-sse` retries up to `retryAttempts` times with
 * exponential backoff. The `on.connecting(reconnecting)` callback allows the
 * caller to show "Reconnecting…" UI.
 *
 * @param auth          Auth config; headers are merged directly into the SSE request.
 * @param retryAttempts Max reconnect attempts (default 5; 0 = no reconnect).
 * @param onStateChange Lifecycle hook for state transitions.
 */
export function createSseTransport(
  auth?: GraphqlAuth | null,
  retryAttempts = 5,
  onStateChange?: (state: 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed', attempt?: number) => void,
): GraphqlTransport {
  return {
    type: 'sse',

    execute(_query, _variables, _operationName, _params) {
      return Promise.resolve<GraphqlResponse>({
        data: null,
        errors: [{ message: 'SSE transport does not support queries/mutations. Use HTTP transport.' }],
        latencyMs: 0, httpStatus: 0, httpHeaders: {}, timestamp: Date.now(),
      });
    },

    subscribe(query, variables, operationName, { endpoint, headers, signal }, callbacks) {
      if (signal?.aborted) {
        callbacks.onError('Aborted before SSE connection was opened');
        return () => { /* noop */ };
      }

      // Normalise URL: convert wss:// → https:// so fetch() works for SSE
      const sseUrl = deriveSseEndpoint(endpoint);

      // Merge auth headers (SSE supports HTTP headers directly, unlike WebSocket connectionParams)
      const authH = buildAuthHeaders(auth);
      const mergedHeaders: Record<string, string> = { ...authH, ...headers };

      // Track reconnect attempt count (mirrors graphql-ws retry counter convention)
      let reconnectCount = 0;

      const client = createSseClient({
        url: sseUrl,
        headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined,
        retryAttempts,
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s, ±20% jitter)
        retry: async (retries: number) => {
          const delay = Math.min(1000 * Math.pow(2, retries), 30_000);
          const jitter = delay * 0.2 * (Math.random() * 2 - 1);
          await new Promise<void>((r) => setTimeout(r, delay + jitter));
        },
        on: {
          connecting: (reconnecting: boolean) => {
            if (reconnecting) {
              reconnectCount++;
              onStateChange?.('reconnecting', reconnectCount);
            } else {
              reconnectCount = 0;
              onStateChange?.('connecting');
            }
          },
          connected: () => {
            reconnectCount = 0;
            onStateChange?.('connected');
          },
        },
      });

      let disposed = false;

      const doDispose = () => {
        if (!disposed) {
          disposed = true;
          client.dispose();
        }
      };

      // Honour AbortSignal — dispose the SSE client when the signal fires.
      // { once: true } mirrors the WS transport pattern (lines 365 and 533) and ensures
      // the listener auto-removes after firing, preventing stale registration.
      const abortHandler = () => doDispose();
      signal?.addEventListener('abort', abortHandler, { once: true });

      const unsubscribe = client.subscribe(
        { query, variables, operationName },
        {
          next(result) {
            callbacks.onMessage(result);
          },
          error(err: unknown) {
            signal?.removeEventListener('abort', abortHandler);
            doDispose();
            if (err instanceof Error) {
              callbacks.onError(err.message);
            } else if (Array.isArray(err)) {
              callbacks.onError(
                (err as GraphqlError[]).map((e) => e.message).join('; '),
              );
            } else {
              callbacks.onError(String(err));
            }
          },
          complete() {
            signal?.removeEventListener('abort', abortHandler);
            doDispose();
            callbacks.onComplete();
          },
        },
      );

      return () => {
        signal?.removeEventListener('abort', abortHandler);
        unsubscribe();
        doDispose();
      };
    },
  };
}

/**
 * Converts a WebSocket endpoint URL to its HTTP equivalent for SSE.
 *
 *   wss://api.example.com/graphql  → https://api.example.com/graphql
 *   ws://localhost:4000/graphql    → http://localhost:4000/graphql
 *   https://...                   → https://... (unchanged)
 *   http://...                    → http://...  (unchanged)
 *
 * Used by the SSE transport to normalise URLs that the user may have entered
 * as WebSocket URLs (e.g. copy-pasted from a WS client before switching to SSE).
 */
export function deriveSseEndpoint(url: string): string {
  if (url.startsWith('wss://')) return `https://${url.slice(6)}`;
  if (url.startsWith('ws://'))  return `http://${url.slice(5)}`;
  return url; // already https:// / http:// or unknown protocol
}

/**
 * Converts an HTTP endpoint URL to its WebSocket equivalent.
 *
 *   https://api.example.com/graphql  → wss://api.example.com/graphql
 *   http://localhost:4000/graphql    → ws://localhost:4000/graphql
 *   wss://...                        → wss://... (unchanged)
 *   ws://...                         → ws://...  (unchanged)
 *
 * Preserves path, query string, and fragment. Non-HTTP/WS protocols are
 * returned unchanged (caller should validate the URL beforehand).
 */
export function deriveWsEndpoint(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) return `wss://${httpUrl.slice(8)}`;
  if (httpUrl.startsWith('http://'))  return `ws://${httpUrl.slice(7)}`;
  return httpUrl; // already ws:// / wss:// or unknown protocol
}

export { createWsProxyTransport, createSseProxyTransport } from './graphqlProxyTransports';

/**
 * Returns true when the connection config requires proxying for WS/SSE subscriptions.
 *
 * The only condition that requires the proxy is custom TLS configuration
 * (skipTlsVerify, custom CA, or mTLS client credentials): browsers cannot
 * apply those options on WebSocket or fetch connections. The Node.js proxy
 * applies them via https.Agent on server-side connections.
 */
export function requiresWsProxy(selector: GraphqlTransportSelector): boolean {
  return gqlRequiresTlsProxy({
    skipTlsVerify: selector.skipTlsVerify,
    caCert: selector.tlsCaCert,
    clientCert: selector.tlsClientCert,
    clientKey: selector.tlsClientKey,
  });
}

/**
 * Select the appropriate transport based on the operation type and connection config.
 *
 * Operation routing (Option C hybrid — §23.16.1):
 *   'query' | 'mutation'  → HTTP transport (always)
 *   'subscription'        → WS (graphql-transport-ws / graphql-ws) or SSE (graphql-sse)
 *                           Proxy variants used when skipTlsVerify=true.
 *
 * Auto-detection heuristic for SSE (Sprint 3):
 *   When `subscriptionTransport === 'auto'` and the endpoint URL ends with `/stream`
 *   or `/graphql/stream`, SSE is preferred over WS because such endpoints are
 *   conventionally SSE-only (e.g. graphql-sse server with the `GET /graphql/stream` path).
 *
 * Auth is threaded through to createWsTransport (connectionParams) and
 * createSseTransport (HTTP headers) respectively.
 */
export function selectTransport(
  selector: GraphqlTransportSelector,
  operationType: 'query' | 'mutation' | 'subscription',
  onStateChange?: Parameters<typeof createWsTransport>[3],
): GraphqlTransport {
  if (operationType !== 'subscription') {
    return createHttpTransport();
  }

  const pref = selector.subscriptionTransport ?? 'auto';
  const needsProxy = requiresWsProxy(selector);

  if (pref === 'sse') {
    return needsProxy
      ? _createSseProxyTransport(selector.auth, onStateChange)
      : createSseTransport(selector.auth, 5, onStateChange);
  }

  if (pref === 'auto') {
    // Heuristic: endpoints ending in /stream → SSE by default
    const url = (selector.endpoint ?? '').toLowerCase();
    if (url.endsWith('/stream') || url.includes('/stream?')) {
      return needsProxy
        ? _createSseProxyTransport(selector.auth, onStateChange)
        : createSseTransport(selector.auth, 5, onStateChange);
    }
  }

  // 'auto' (non-stream URL), 'graphql-transport-ws', or 'graphql-ws' → WS transport
  const subprotocol = pref === 'graphql-ws' ? 'graphql-ws' : 'graphql-transport-ws';
  return needsProxy
    ? _createWsProxyTransport(subprotocol, selector.auth, onStateChange)
    : createWsTransport(subprotocol, selector.auth, 5, onStateChange);
}

/**
 * Returns true if the query contains at least one `@defer` or `@stream` directive.
 *
 * Used by `useGraphqlExecution` to set `Accept: multipart/mixed` and route the
 * response through the incremental delivery parser instead of a single JSON parse.
 *
 * Returns `false` on parse error so that malformed queries are simply sent to the
 * server, which will return a proper GraphQL error — no special client-side handling.
 */
export function hasIncrementalDirective(query: string): boolean {
  try {
    const doc = parse(query);
    let found = false;
    visit(doc, {
      Directive(node) {
        if (node.name.value === 'defer' || node.name.value === 'stream') {
          found = true;
        }
      },
    });
    return found;
  } catch {
    return false; // parse error — let server report the problem
  }
}
