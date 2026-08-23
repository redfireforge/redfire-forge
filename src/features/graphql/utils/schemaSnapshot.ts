/**
 * schemaSnapshot.ts — Phase 3D (task 3D-1)
 *
 * IndexedDB CRUD for GraphqlSchemaSnapshot objects stored in
 * the `graphql-schema-snapshots` object store (added in 3A-12, DB_VERSION=6).
 *
 * Lifecycle rules:
 *  - Max 20 snapshots per connectionId (oldest by capturedAt evicted on add)
 *  - SDL > 500KB triggers a console warning (stored anyway)
 *  - Snapshots are write-once: no update method; delete + re-add instead
 */

import { openDB } from '@shared/utils/idbOpen';
import type { GraphqlSchemaSnapshot } from '@shared/types/graphql';
import { deleteAcksForSnapshot } from './schemaDiffAck';

const STORE = 'graphql-schema-snapshots';
const MAX_PER_CONNECTION = 20;
const SDL_WARN_BYTES = 500 * 1024;

/** Load all snapshots for a connection, newest first */
export async function loadSnapshots(connectionId: string): Promise<GraphqlSchemaSnapshot[]> {
  const db = await openDB();
  return new Promise<GraphqlSchemaSnapshot[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('connectionId');
    const req = idx.getAll(IDBKeyRange.only(connectionId));
    req.onsuccess = () => {
      const rows = (req.result as GraphqlSchemaSnapshot[]) ?? [];
      rows.sort((a, b) => b.capturedAt - a.capturedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB loadSnapshots failed'));
  });
}

/** Save a new snapshot (FIFO-evicts oldest when count exceeds MAX_PER_CONNECTION) */
export async function saveSnapshot(snapshot: GraphqlSchemaSnapshot): Promise<void> {
  if (snapshot.sdl.length > SDL_WARN_BYTES) {
    console.warn(
      `[schemaSnapshot] SDL for snapshot ${snapshot.id} is ${Math.round(snapshot.sdl.length / 1024)}KB — exceeds 500KB advisory limit`,
    );
  }

  const db = await openDB();
  // Check count and evict if needed (load before the write transaction)
  const existing = await loadSnapshots(snapshot.connectionId);
  const toEvict = existing.slice(MAX_PER_CONNECTION - 1); // keep MAX-1 so adding one stays ≤ MAX

  // Cascade-delete acks for evicted snapshots first (separate async ops before IDB write)
  for (const s of toEvict) {
    await deleteAcksForSnapshot(s.id).catch(() => {});
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const s of toEvict) store.delete(s.id);
    store.put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB saveSnapshot failed'));
  });
}

/** Delete a single snapshot by id, including its associated acknowledgements */
export async function deleteSnapshot(id: string): Promise<void> {
  // Cascade-delete acks first (fire-and-forget failures; IDB error is non-fatal)
  await deleteAcksForSnapshot(id).catch(() => {});
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB deleteSnapshot failed'));
  });
}

/** Rename (relabel) a snapshot */
export async function relabelSnapshot(id: string, label: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const snapshot = getReq.result as GraphqlSchemaSnapshot | undefined;
      if (snapshot) {
        store.put({ ...snapshot, label });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB relabelSnapshot failed'));
  });
}
