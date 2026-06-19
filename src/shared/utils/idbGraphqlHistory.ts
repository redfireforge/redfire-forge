/**
 * Low-level IndexedDB operations for the `graphql-history` store.
 *
 * Design notes (from plan 3A-12 / Third-Pass review):
 *  - Each entry keyed by `id = crypto.randomUUID()` (NOT connectionId+timestamp — collision risk).
 *  - Compound index `[connectionId, timestamp]` enables efficient per-connection range queries.
 *  - Stored `response` is a JSON string capped at 512KB before write (3A-1).
 *  - FIFO eviction per-connection: when limit exceeded, delete the oldest entry for THAT connection.
 */

import { openDB } from './idbOpen';
import { wrap, txComplete } from './idbHelpers';
import type { GraphqlHistoryItem } from '../types/graphql';

export const HISTORY_STORE = 'graphql-history';
export const RESPONSE_CAP_BYTES = 512 * 1024; // 512KB

// ─── Per-connection serialization queue ──────────────────────────────────────
//
// idbSaveHistoryItem has a TOCTOU (time-of-check / time-of-use) vulnerability:
// two concurrent saves for the same connection both read the same item count,
// neither evicts, and both insert — exceeding maxItems.
//
// Fix: serialise all saves for a given connectionId through a promise chain.
// Since JS is single-threaded this is sufficient. The queue holds the tail of the
// chain; each save awaits the previous one before starting its own read phase.
const _saveQueues = new Map<string, Promise<void>>();

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Save a history item. Truncates `response` to 512KB if necessary.
 * Evicts the oldest entry for this connection when `maxItems` is reached.
 *
 * Concurrent saves for the same connection are serialised through a per-connection
 * promise queue to prevent TOCTOU: without serialisation, two concurrent callers
 * could both read the same pre-eviction count and both insert, violating maxItems.
 *
 * IDB transaction safety: we split into two transactions — one readonly read to
 * check the current count, and one readwrite write that queues all deletes and
 * the insert synchronously before awaiting txComplete. This avoids the classic
 * "IDB auto-commit between awaits" pitfall where some browsers commit a
 * readwrite transaction as soon as there are no pending requests on it.
 */
export function idbSaveHistoryItem(
  item: GraphqlHistoryItem,
  maxItems: number,
): Promise<void> {
  const connectionId = item.connectionId;
  const prev = _saveQueues.get(connectionId) ?? Promise.resolve();
  // Chain the new save onto the tail; errors are swallowed per-call so a failed
  // save does not block the queue for subsequent saves.
  const next = prev.then(() => _doSaveHistoryItem(item, maxItems)).catch(() => {});
  _saveQueues.set(connectionId, next);
  return next;
}

async function _doSaveHistoryItem(
  item: GraphqlHistoryItem,
  maxItems: number,
): Promise<void> {
  const db = await openDB();
  const truncated = maybeCapResponse(item);

  // Phase 1: read existing items for this connection (readonly tx — safe to await).
  const readTx = db.transaction(HISTORY_STORE, 'readonly');
  const range = IDBKeyRange.bound([item.connectionId, 0], [item.connectionId, Infinity]);
  const existing = (await wrap(readTx.objectStore(HISTORY_STORE).index('connectionId_timestamp').getAll(range))) as GraphqlHistoryItem[];

  // Phase 2: queue all writes synchronously on a fresh readwrite tx, then await
  // the transaction's oncomplete event (not individual request promises).
  const writeTx = db.transaction(HISTORY_STORE, 'readwrite');
  const store = writeTx.objectStore(HISTORY_STORE);
  const count = existing.length;
  if (count >= maxItems) {
    const sorted = existing.slice().sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = count - maxItems + 1;
    // Queue deletes synchronously — no await between them.
    for (const e of sorted.slice(0, toDelete)) store.delete(e.id);
  }
  store.put(truncated); // queue the insert synchronously
  await txComplete(writeTx);
}

/**
 * Load all history items for a connection, ordered newest-first.
 */
export async function idbLoadHistory(connectionId: string): Promise<GraphqlHistoryItem[]> {
  const db = await openDB();
  const tx = db.transaction(HISTORY_STORE, 'readonly');
  const store = tx.objectStore(HISTORY_STORE);
  const index = store.index('connectionId_timestamp');
  const range = IDBKeyRange.bound([connectionId, 0], [connectionId, Infinity]);
  const items = await wrap(index.getAll(range)) as GraphqlHistoryItem[];
  return items.slice().sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Delete a single history item by id.
 */
export async function idbDeleteHistoryItem(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(HISTORY_STORE, 'readwrite');
  await wrap(tx.objectStore(HISTORY_STORE).delete(id));
}

/**
 * Delete all history items for a connection.
 *
 * Uses two transactions (readonly read → readwrite delete) to avoid the IDB
 * auto-commit pitfall that can occur when awaiting between requests on the same
 * transaction.
 */
export async function idbClearHistory(connectionId: string): Promise<void> {
  const db = await openDB();

  // Phase 1: collect IDs (readonly).
  const readTx = db.transaction(HISTORY_STORE, 'readonly');
  const ids = (await wrap(readTx.objectStore(HISTORY_STORE).index('connectionId').getAllKeys(IDBKeyRange.only(connectionId)))) as string[];

  if (ids.length === 0) return;

  // Phase 2: delete all synchronously (readwrite), then await txComplete.
  const writeTx = db.transaction(HISTORY_STORE, 'readwrite');
  const store = writeTx.objectStore(HISTORY_STORE);
  for (const id of ids) store.delete(id);
  await txComplete(writeTx);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function maybeCapResponse(item: GraphqlHistoryItem): GraphqlHistoryItem {
  if (typeof item.response !== 'string') return item;
  const bytes = new Blob([item.response]).size;
  if (bytes <= RESPONSE_CAP_BYTES) return item;
  // Truncate the JSON string to fit; mark as truncated with a sentinel suffix.
  const encoder = new TextEncoder();
  let slice = item.response;
  while (new Blob([slice]).size > RESPONSE_CAP_BYTES - 64) {
    // Trim by halving the excess, then find a safe UTF-8 character boundary.
    const excess = encoder.encode(slice).length - (RESPONSE_CAP_BYTES - 64);
    slice = slice.slice(0, Math.max(0, slice.length - Math.ceil(excess / 2)));
  }
  return { ...item, response: slice + '\n__TRUNCATED__' };
}

