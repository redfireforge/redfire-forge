/**
 * schemaDiffAck.ts — Phase 3D (task 3D-1b)
 *
 * CRUD for the `graphql-diff-acknowledgements` IDB store.
 *
 * Acknowledgement key: `${connectionId}__${snapshotId}__${changePath}`
 * Snapshots are write-once; acknowledgements are mutable (add note, delete).
 *
 * Only used for snapshot-vs-current diffs. Snapshot-vs-snapshot comparisons
 * are read-only historical audits and do not write acknowledgements.
 */

import { openDB } from '@shared/utils/idbOpen';

const STORE = 'graphql-diff-acknowledgements';

export interface DiffAck {
  /** `${connectionId}__${snapshotId}__${changePath}` */
  id: string;
  connectionId: string;
  snapshotId: string;
  /** The change path from GraphqlSchemaDiffChange.path */
  changePath: string;
  note: string;
  acknowledgedAt: number;
}

/** Compose the stable ack ID from its three-part key */
export function ackId(connectionId: string, snapshotId: string, changePath: string): string {
  return `${connectionId}__${snapshotId}__${changePath}`;
}

/** Fetch all acknowledgements for a connection + snapshot pair */
export async function getAcks(connectionId: string, snapshotId: string): Promise<DiffAck[]> {
  const db = await openDB();
  return new Promise<DiffAck[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('snapshotId');
    const req = idx.getAll(IDBKeyRange.only(snapshotId));
    req.onsuccess = () => {
      const all = (req.result as DiffAck[]) ?? [];
      // Filter to this connectionId (snapshotId alone is enough in practice, belt-and-suspenders)
      resolve(all.filter((a) => a.connectionId === connectionId));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Add or update an acknowledgement for a specific change */
export async function addAck(
  connectionId: string,
  snapshotId: string,
  changePath: string,
  note: string,
): Promise<DiffAck> {
  const ack: DiffAck = {
    id: ackId(connectionId, snapshotId, changePath),
    connectionId,
    snapshotId,
    changePath,
    note,
    acknowledgedAt: Date.now(),
  };
  const db = await openDB();
  return new Promise<DiffAck>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(ack);
    tx.oncomplete = () => resolve(ack);
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove an acknowledgement */
export async function deleteAck(id: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete all acknowledgements for a snapshot (called when snapshot is deleted) */
export async function deleteAcksForSnapshot(snapshotId: string): Promise<void> {
  const db = await openDB();
  // Read all acks for this snapshot
  const existing = await new Promise<DiffAck[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('snapshotId');
    const req = idx.getAll(IDBKeyRange.only(snapshotId));
    req.onsuccess = () => resolve((req.result as DiffAck[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  if (existing.length === 0) return;
  // Delete all in a single write transaction on the same connection
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const a of existing) store.delete(a.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
