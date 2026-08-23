/**
 * dedupExecution.ts — Phase 3F (tasks 3F-5, 3F-6)
 *
 * Request deduplication for GraphQL Studio.
 *
 * Detects when the same query + variables combination is fired again while an
 * identical request is still in-flight. Offers three user choices:
 *   - Wait and merge  — return the existing Promise (0 extra network calls)
 *   - Cancel original — abort the in-flight request, then fire fresh
 *   - Send anyway     — allow both; skip dedup for this execution
 *
 * Dedup key = djb2(connectionId + normalizedQuery + JSON.stringify(sortedVars))
 *   connectionId is REQUIRED in the key — without it, identical queries sent
 *   to two different GraphQL endpoints would incorrectly share a request.
 *
 * Scope: within-tab only. Cross-tab dedup is explicitly NOT implemented.
 *
 * djb2 hash is used (synchronous, non-cryptographic) because dedup key
 * generation is on the hot path; async SHA-256 (used for APQ) would add
 * latency before every execute call.
 */

import { parse, print } from 'graphql';
import type { GraphqlResponse } from '@shared/types/graphql';

// ─── djb2 hash ────────────────────────────────────────────────────────────────

/**
 * djb2 non-cryptographic hash.
 *
 * Collision probability for typical GraphQL query strings is negligible in a
 * single-user developer tool. If two different queries collide (a hash
 * collision), the dedup badge appears and "Send anyway" resolves it.
 */
export function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h |= 0; // coerce to signed 32-bit
  }
  return (h >>> 0).toString(16); // unsigned hex
}

// ─── Key builder ──────────────────────────────────────────────────────────────

/**
 * Build a dedup key from connection ID, normalized query, sorted variables,
 * and optionally operationName.
 *
 * operationName is REQUIRED in the key for multi-operation documents where two
 * different named operations share the same query string. Without it, executing
 * `{ ...query... } #operationA` and then `{ ...query... } #operationB` would
 * incorrectly share a dedup slot.
 *
 * Sorting variables object keys ensures `{a:1,b:2}` and `{b:2,a:1}` produce
 * the same key.
 */
export function buildDedupKey(
  connectionId: string,
  query: string,
  variables: Record<string, unknown>,
  operationName?: string | null,
): string {
  let normalized: string;
  try {
    normalized = print(parse(query));
  } catch {
    normalized = query;
  }

  const sortedVars = Object.keys(variables).length > 0
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(variables).sort(([a], [b]) => a.localeCompare(b)),
        ),
      )
    : '{}';

  const opPart = operationName ? `::${operationName}` : '';
  return djb2(`${connectionId}::${normalized}::${sortedVars}${opPart}`);
}

// ─── In-flight store ──────────────────────────────────────────────────────────

export interface InFlightEntry {
  /** AbortController for the underlying network request */
  controller: AbortController;
  /** Promise that resolves/rejects with the GraphqlResponse */
  promise: Promise<GraphqlResponse>;
}

/**
 * The module-level in-flight map.
 * key = dedupKey; value = controller + promise for the active request.
 *
 * Stored at module level so it persists across renders within the same browser
 * tab. Each module instance represents one tab's dedup scope.
 */
const inFlightMap = new Map<string, InFlightEntry>();

/** Register an in-flight request in the dedup map. */
export function registerInFlight(key: string, entry: InFlightEntry): void {
  inFlightMap.set(key, entry);
}

/** Remove a key from the in-flight map (called when the request settles). */
export function removeInFlight(key: string): void {
  inFlightMap.delete(key);
}

/** Return the in-flight entry for a key, or undefined if none. */
export function getInFlight(key: string): InFlightEntry | undefined {
  return inFlightMap.get(key);
}

/** Clear all in-flight entries (for testing). */
export function _clearInFlightMap(): void {
  inFlightMap.clear();
}

/** Return current in-flight count (for testing). */
export function _inFlightCount(): number {
  return inFlightMap.size;
}

// ─── User-choice enum ─────────────────────────────────────────────────────────

export type DedupChoice = 'wait' | 'cancel' | 'sendAnyway';

// ─── Dedup guard helper ───────────────────────────────────────────────────────

export interface DedupGuardResult {
  /** true = a duplicate was detected; caller should show the dedup badge */
  isDuplicate: boolean;
  /**
   * When isDuplicate=true and choice='wait': resolves to the shared response.
   * When isDuplicate=false or choice!='wait': undefined — caller fires fresh.
   */
  waitPromise: Promise<GraphqlResponse> | undefined;
}

/**
 * Check for an in-flight duplicate and handle the user's choice.
 *
 * Called BEFORE the network request is fired. If a duplicate is in flight:
 *   - 'wait':       returns the existing Promise (AbortController isolation
 *                   is preserved — aborting the waiter does NOT abort the shared
 *                   controller, which may have other waiters)
 *   - 'cancel':     aborts the original controller; caller fires a fresh request
 *   - 'sendAnyway': no-op; caller fires an independent request
 *
 * @param key       — dedup key (from buildDedupKey)
 * @param choice    — user's choice when a duplicate is found (default: 'wait')
 * @returns         — { isDuplicate, waitPromise }
 */
export function handleDedupGuard(
  key: string,
  choice: DedupChoice = 'wait',
): DedupGuardResult {
  const existing = inFlightMap.get(key);
  if (!existing) {
    return { isDuplicate: false, waitPromise: undefined };
  }

  if (choice === 'wait') {
    // Return the existing promise WITHOUT aborting the underlying controller.
    // AbortController isolation: the waiting caller cannot cancel the shared request.
    return { isDuplicate: true, waitPromise: existing.promise };
  }

  if (choice === 'cancel') {
    // Abort the original; caller is expected to fire a fresh request
    existing.controller.abort();
    inFlightMap.delete(key);
    return { isDuplicate: true, waitPromise: undefined };
  }

  // 'sendAnyway': proceed with a new request alongside the existing one
  return { isDuplicate: true, waitPromise: undefined };
}
