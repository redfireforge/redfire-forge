/**
 * apqClient.ts — Phase 3F (task 3F-1)
 *
 * Automatic Persisted Queries (Apollo APQ spec v1) implementation.
 *
 * Two-step flow:
 *   1. Client sends hash-only: { extensions: { persistedQuery: { version: 1, sha256Hash: "..." } } }
 *   2. Server returns PERSISTED_QUERY_NOT_FOUND error if query is not in its cache
 *   3. Client resends with full query + hash (always POST) — server caches and responds
 *   4. All subsequent requests use hash-only (cache hit)
 *
 * In-memory FIFO hash cache (max 500 entries) avoids re-computing SHA-256 for
 * queries that are executed repeatedly in the same session.
 *
 * GET support (3F-1 R3-new):
 *   When `useGet` is true and the operation type is 'query', the hash-only first
 *   request uses HTTP GET with URL-encoded query params. This makes the request
 *   CDN-cacheable. The PERSISTED_QUERY_NOT_FOUND fallback always uses POST.
 *   Mutations always use POST regardless of `useGet`.
 */

import { parse, print } from 'graphql';
import type { GraphqlResponse } from '../../../shared/types/graphql';

// ─── Hash cache (module-level FIFO, max 500 entries) ─────────────────────────

const APQ_CACHE_MAX = 500;

/** normalizedQuery → hex SHA-256 hash */
const apqHashCache = new Map<string, string>();

/**
 * Compute the APQ SHA-256 hash for a GraphQL query string.
 *
 * Normalizes whitespace via `parse` + `print` before hashing.
 * Results are cached in a FIFO map (max 500 entries, oldest evicted).
 */
export async function computeAPQHash(query: string): Promise<string> {
  let normalized: string;
  try {
    normalized = print(parse(query));
  } catch {
    // Unparseable query — hash the raw string as-is
    normalized = query;
  }

  const cached = apqHashCache.get(normalized);
  if (cached) return cached;

  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Evict oldest entry when at capacity (FIFO)
  if (apqHashCache.size >= APQ_CACHE_MAX) {
    apqHashCache.delete(apqHashCache.keys().next().value!);
  }
  apqHashCache.set(normalized, hash);
  return hash;
}

// ─── Response inspection helpers ─────────────────────────────────────────────

/**
 * Returns true when the response contains a `PERSISTED_QUERY_NOT_FOUND` error.
 * This is a cache miss — the client should retry with the full query body.
 */
export function isPersistedQueryNotFound(response: GraphqlResponse): boolean {
  return (response.errors ?? []).some(
    (e) =>
      (e.extensions as Record<string, unknown> | undefined)?.['code'] ===
      'PERSISTED_QUERY_NOT_FOUND',
  );
}

/**
 * Returns true when the response indicates the server does NOT support APQ at all,
 * as opposed to a simple cache miss. Used to auto-detect unsupported servers.
 *
 * Detection heuristic (Apollo APQ spec):
 *   - HTTP 400 or 405  → server rejected the hash-only body structure
 *   - Error code `PERSISTED_QUERY_NOT_SUPPORTED` → server explicitly rejects APQ
 *
 * Intentionally NOT triggered by ordinary GraphQL field/validation errors returned
 * with HTTP 200 — those indicate a valid APQ cache-hit response carrying application
 * errors, NOT a server that lacks APQ support.
 */
export function isAPQUnsupported(response: GraphqlResponse): boolean {
  if (response.httpStatus === 400 || response.httpStatus === 405) return true;
  return (response.errors ?? []).some(
    (e) =>
      (e.extensions as Record<string, unknown> | undefined)?.['code'] ===
      'PERSISTED_QUERY_NOT_SUPPORTED',
  );
}

// ─── sendFn type ─────────────────────────────────────────────────────────────

/**
 * Transport function injected by the caller.
 * Sends a GraphQL request body and returns a parsed GraphqlResponse.
 *
 * method = 'GET':  caller sends the body fields as URL query params
 *                  (?extensions=<encoded>&variables=<encoded>)
 * method = 'POST': caller sends the body as JSON
 */
export type APQSendFn = (
  body: Record<string, unknown>,
  method: 'POST' | 'GET',
) => Promise<GraphqlResponse>;

// ─── Main APQ execution function ─────────────────────────────────────────────

export interface APQResult {
  response:  GraphqlResponse;
  /** true = hash-only request succeeded (server cache hit) */
  cacheHit:  boolean;
  /** SHA-256 hex hash of the normalized query */
  hash:      string;
  /** true = server does not support APQ (caller should auto-disable) */
  unsupported: boolean;
}

/**
 * Execute a GraphQL operation using the APQ two-step protocol.
 *
 * @param sendFn        — caller-provided transport function
 * @param query         — raw GraphQL query string
 * @param variables     — resolved variables object (may be empty)
 * @param operationType — 'query' | 'mutation'; mutations always use POST
 * @param useGet        — when true and operationType==='query', hash-only request uses GET
 * @param signal        — optional AbortSignal; when aborted between steps the function
 *                        throws an AbortError so the caller's abort handler fires promptly
 *                        rather than waiting for a second network round-trip to complete.
 */
export async function executeWithAPQ(
  sendFn: APQSendFn,
  query: string,
  variables: Record<string, unknown>,
  operationType: 'query' | 'mutation',
  useGet = false,
  signal?: AbortSignal,
): Promise<APQResult> {
  const hash = await computeAPQHash(query);
  const persistedQueryExt = { persistedQuery: { version: 1, sha256Hash: hash } };

  // Mutations must always use POST per APQ spec; queries can optionally use GET
  const method: 'POST' | 'GET' =
    useGet && operationType === 'query' ? 'GET' : 'POST';

  // Hash-only body: no `query` field, only extensions (+ variables if present)
  const hashOnlyBody: Record<string, unknown> = { extensions: persistedQueryExt };
  if (Object.keys(variables).length > 0) hashOnlyBody.variables = variables;

  const r1 = await sendFn(hashOnlyBody, method);

  // Check abort after step 1 completes — before firing step 2 or 3.
  if (signal?.aborted) {
    throw new DOMException('APQ request aborted', 'AbortError');
  }

  // Cache miss: server doesn't have the query yet → retry with full query (POST)
  if (isPersistedQueryNotFound(r1)) {
    const fullBody: Record<string, unknown> = {
      query,
      extensions: persistedQueryExt,
    };
    if (Object.keys(variables).length > 0) fullBody.variables = variables;
    const r2 = await sendFn(fullBody, 'POST');
    return { response: r2, cacheHit: false, hash, unsupported: false };
  }

  // Server does not support APQ at all → fall back transparently
  if (isAPQUnsupported(r1)) {
    // Check abort before firing the fallback request
    if (signal?.aborted) {
      throw new DOMException('APQ request aborted', 'AbortError');
    }
    const fallbackBody: Record<string, unknown> = { query };
    if (Object.keys(variables).length > 0) fallbackBody.variables = variables;
    const r3 = await sendFn(fallbackBody, 'POST');
    return { response: r3, cacheHit: false, hash, unsupported: true };
  }

  // Cache hit: hash-only request succeeded
  return { response: r1, cacheHit: true, hash, unsupported: false };
}

// ─── Test helpers (not exported for production) ───────────────────────────────

/** Clear the in-memory hash cache. Used in tests only. */
export function _clearAPQCache(): void {
  apqHashCache.clear();
}

/** Return current cache size. Used in tests only. */
export function _apqCacheSize(): number {
  return apqHashCache.size;
}

/** Inspect cache entries. Used in tests only. */
export function _apqCacheEntries(): Array<[string, string]> {
  return [...apqHashCache.entries()];
}
