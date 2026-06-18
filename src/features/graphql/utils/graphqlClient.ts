/**
 * graphqlClient.ts — Unified transport abstraction for GraphQL Studio.
 *
 * Phase 2.0 Sprint 1 (2-PRE-2): Defines the `GraphqlTransport` interface and
 * provides concrete transport implementations:
 *
 *   - HTTP transport   — wraps `gqlFetch` (Phase 1, complete).
 *   - WS transport     — `graphql-transport-ws` / `graphql-ws` (Sprint 2 stub).
 *   - SSE transport    — `graphql-sse` (Sprint 3 stub).
 *
 * Architecture: Option C hybrid (§23.13.13 / §23.16.1):
 *
 *   query/mutation          → always HTTP
 *   subscription, auto      → WS (direct) if no auth and no TLS skip in browser
 *                             WS (proxied via /api/graphql/subscribe) otherwise
 *                             Tauri: Tauri proxy on localhost
 *   subscription, sse       → SSE (direct fetch + ReadableStream)
 *                             SSE (proxied via /api/graphql/sse) if auth gated
 *
 * Usage:
 *   const transport = selectTransport(connection, 'subscription');
 *   const unsub = transport.subscribe(query, variables, opName, { onMessage, onError, onComplete });
 *   // later:
 *   unsub();
 */

import { gqlFetch } from './gqlFetch';
import { isTauri } from '../../../shared/utils/platform';
import type { GraphqlResponse, GraphqlAuth, GraphqlError } from '../../../shared/types/graphql';

// ─── Transport interface ───────────────────────────────────────────────────────

/** All resolved (post-interpolation) parameters for a single operation. */
export interface GraphqlOperationParams {
  /** GraphQL endpoint URL. */
  endpoint: string;
  /** Resolved request headers (user headers + auth headers, already merged). */
  headers: Record<string, string>;
  /** Whether to skip TLS certificate validation for self-signed/dev endpoints. */
  skipTlsVerify?: boolean;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export interface GraphqlSubscribeCallbacks {
  /** Invoked for each `data` / `next` frame from the subscription stream. */
  onMessage: (data: unknown) => void;
  /** Invoked when the subscription encounters an error. */
  onError: (error: string) => void;
  /** Invoked when the subscription stream ends cleanly. */
  onComplete: () => void;
}

/**
 * Discriminated union of all transport implementations.
 * Sprint 2/3 will replace the 'ws' / 'sse' stubs with real implementations.
 */
export type GraphqlTransportType = 'http' | 'ws' | 'sse';

export interface GraphqlTransport {
  /** Transport discriminant — useful for debugging and logging. */
  readonly type: GraphqlTransportType;

  /**
   * Execute a query or mutation.
   * Returns a Promise that resolves with the GraphQL response.
   * Subscriptions via this method are not supported — use `subscribe()`.
   */
  execute(
    query: string,
    variables: Record<string, unknown>,
    operationName: string | undefined,
    params: GraphqlOperationParams,
  ): Promise<GraphqlResponse>;

  /**
   * Open a subscription stream.
   * Returns an `unsubscribe` function — call it to close the stream.
   */
  subscribe(
    query: string,
    variables: Record<string, unknown>,
    operationName: string | undefined,
    params: GraphqlOperationParams,
    callbacks: GraphqlSubscribeCallbacks,
  ): () => void;
}

// ─── Connection config slice used by selectTransport ─────────────────────────

export interface GraphqlTransportSelector {
  /** Resolved auth config for the active connection (if any). */
  auth?: GraphqlAuth | null;
  /** Skip TLS verification. */
  skipTlsVerify?: boolean;
  /**
   * Preferred subscription transport. 'auto' applies Option C routing rules.
   * Explicit values override the routing logic.
   */
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
}

// ─── HTTP transport ───────────────────────────────────────────────────────────

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

    async execute(query, variables, operationName, { endpoint, headers, skipTlsVerify, signal }) {
      const bodyObj: Record<string, unknown> = { query, variables };
      if (operationName) bodyObj.operationName = operationName;

      const startMs = Date.now();
      const result = await gqlFetch(
        endpoint,
        'POST',
        { 'Content-Type': 'application/json', ...headers },
        JSON.stringify(bodyObj),
        signal,
        skipTlsVerify,
      );
      const latencyMs = Date.now() - startMs;

      if (result.error) {
        return {
          data: undefined,
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
          data: undefined,
          errors: [{ message: `Failed to parse response JSON: ${result.body?.slice(0, 200) ?? '(empty)'}` }],
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
        data: asRecord.data,
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

// ─── WS transport (Sprint 2 stub) ─────────────────────────────────────────────

/**
 * WebSocket subscription transport using `graphql-transport-ws` or `graphql-ws`.
 *
 * Sprint 2 stub — throws GQL_NOT_IMPLEMENTED. Sprint 2 will implement:
 *   - Direct mode (browser native WebSocket, no proxy)
 *   - Proxied mode (via /api/graphql/subscribe for auth or TLS skip scenarios)
 *   - Tauri mode (via localhost:3001 proxy)
 *
 * @param subprotocol 'graphql-transport-ws' (modern) or 'graphql-ws' (Apollo legacy)
 */
export function createWsTransport(subprotocol: 'graphql-transport-ws' | 'graphql-ws' = 'graphql-transport-ws'): GraphqlTransport {
  return {
    type: 'ws',

    execute(_query, _variables, _operationName, _params) {
      return Promise.resolve<GraphqlResponse>({
        data: undefined,
        errors: [{
          message: `WS transport (${subprotocol}) does not support queries/mutations. Use HTTP transport.`,
        }],
        latencyMs: 0,
        httpStatus: 0,
        httpHeaders: {},
        timestamp: Date.now(),
      });
    },

    subscribe(_query, _variables, _operationName, _params, callbacks) {
      callbacks.onError(
        `WebSocket subscription transport (${subprotocol}) is not yet implemented. ` +
        'Phase 2.0 Sprint 2 will add this capability.',
      );
      return () => { /* noop */ };
    },
  };
}

// ─── SSE transport (Sprint 3 stub) ────────────────────────────────────────────

/**
 * Server-Sent Events subscription transport using `graphql-sse`.
 *
 * Sprint 3 stub — throws GQL_NOT_IMPLEMENTED. Sprint 3 will implement:
 *   - Direct mode (browser native EventSource / ReadableStream)
 *   - Proxied mode (via /api/graphql/sse for auth-gated endpoints)
 */
export function createSseTransport(): GraphqlTransport {
  return {
    type: 'sse',

    execute(_query, _variables, _operationName, _params) {
      return Promise.resolve<GraphqlResponse>({
        data: undefined,
        errors: [{ message: 'SSE transport does not support queries/mutations. Use HTTP transport.' }],
        latencyMs: 0,
        httpStatus: 0,
        httpHeaders: {},
        timestamp: Date.now(),
      });
    },

    subscribe(_query, _variables, _operationName, _params, callbacks) {
      callbacks.onError(
        'SSE subscription transport is not yet implemented. ' +
        'Phase 2.0 Sprint 3 will add this capability.',
      );
      return () => { /* noop */ };
    },
  };
}

// ─── Transport factory / router ───────────────────────────────────────────────

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

/**
 * Returns true when the connection config requires proxying for WS subscriptions.
 *
 * Conditions that require the proxy (can't use a direct browser WebSocket):
 *   1. Auth headers need to be injected (browser WebSocket cannot send headers).
 *   2. TLS skip is requested (requires server-side undici Agent with rejectUnauthorized:false).
 *   3. Running in Tauri (handled via localhost proxy on port 3001).
 *
 * Auth that only injects into `connectionParams` (bearer, basic, apiKey) can use
 * the direct path because connectionParams is sent in the `connection_init` message,
 * not as HTTP headers.
 */
export function requiresWsProxy(selector: GraphqlTransportSelector): boolean {
  if (isTauri()) return true;
  if (selector.skipTlsVerify) return true;
  return false;
}

/**
 * Select the appropriate transport based on the operation type and connection config.
 *
 * Operation routing (Option C hybrid — §23.16.1):
 *   'query' | 'mutation'  → HTTP transport (always)
 *   'subscription'        → WS or SSE based on subscriptionTransport setting
 *
 * Sprint 1: WS and SSE transports return stubs (not yet implemented).
 */
export function selectTransport(
  selector: GraphqlTransportSelector,
  operationType: 'query' | 'mutation' | 'subscription',
): GraphqlTransport {
  if (operationType !== 'subscription') {
    return createHttpTransport();
  }

  const pref = selector.subscriptionTransport ?? 'auto';

  if (pref === 'sse') {
    return createSseTransport();
  }

  // 'auto', 'graphql-transport-ws', or 'graphql-ws' all use WS transport.
  // The distinction between modern (graphql-transport-ws) and legacy (graphql-ws)
  // is handled inside the WS transport implementation (Sprint 2).
  const subprotocol = pref === 'graphql-ws' ? 'graphql-ws' : 'graphql-transport-ws';
  return createWsTransport(subprotocol);
}
