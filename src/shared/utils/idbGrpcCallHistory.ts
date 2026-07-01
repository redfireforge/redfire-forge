/**
 * Phase 5D — IndexedDB persistence for global gRPC call history.
 */
import {
  GRPC_CALL_HISTORY_IDB_STORE,
  GRPC_CALL_HISTORY_MAX_ENTRIES,
  GRPC_CALL_HISTORY_STORAGE_KEY,
  type GrpcCallHistoryEntryV1,
} from '../grpc/grpcPersistenceSchema';
import {
  assertGrpcCallHistoryEntryPersistSafe,
  reprepareGrpcCallHistoryEntryForPersistSafe,
} from '../grpc/grpcPersistRedactionMiddleware';
import { migrateGrpcCallHistoryStore } from '../grpc/grpcPersistenceMigration';
import { idbAvailable, txComplete, wrap } from './idbHelpers';
import { openDB } from './idbOpen';

let _appendQueue: Promise<void> = Promise.resolve();
let _healPromise: Promise<void> | null = null;

function sortNewestFirst(entries: GrpcCallHistoryEntryV1[]): GrpcCallHistoryEntryV1[] {
  return entries.slice().sort((a, b) => {
    const byCaptured = b.capturedAt.localeCompare(a.capturedAt);
    if (byCaptured !== 0) return byCaptured;
    return b.id.localeCompare(a.id);
  });
}

function entryNeedsPersistHeal(entry: GrpcCallHistoryEntryV1): boolean {
  try {
    assertGrpcCallHistoryEntryPersistSafe(entry);
    return false;
  } catch {
    return true;
  }
}

async function readAllGrpcCallHistoryEntriesFromDb(): Promise<GrpcCallHistoryEntryV1[]> {
  const db = await openDB();
  const tx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readonly');
  const entries = await wrap(
    tx.objectStore(GRPC_CALL_HISTORY_IDB_STORE).getAll(),
  ) as GrpcCallHistoryEntryV1[];
  return sortNewestFirst(entries);
}

/** One-time heal pass for pre-5E IDB rows that may contain raw secrets. */
async function ensureLegacyGrpcCallHistoryHealed(): Promise<void> {
  if (!idbAvailable()) return;
  if (!_healPromise) {
    _healPromise = (async () => {
      const entries = await readAllGrpcCallHistoryEntriesFromDb();
      if (entries.length === 0 || !entries.some(entryNeedsPersistHeal)) return;
      await idbReplaceGrpcCallHistoryEntries(entries);
    })().catch((error) => {
      _healPromise = null;
      throw error;
    });
  }
  await _healPromise;
}

async function _doAppendGrpcCallHistoryEntry(
  entry: GrpcCallHistoryEntryV1,
  maxEntries: number,
): Promise<void> {
  await ensureLegacyGrpcCallHistoryHealed();
  const sanitized = reprepareGrpcCallHistoryEntryForPersistSafe(entry);
  const db = await openDB();
  const readTx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readonly');
  const existing = await wrap(
    readTx.objectStore(GRPC_CALL_HISTORY_IDB_STORE).getAll(),
  ) as GrpcCallHistoryEntryV1[];

  const sortedOldestFirst = existing.slice().sort((a, b) => {
    const byCaptured = a.capturedAt.localeCompare(b.capturedAt);
    if (byCaptured !== 0) return byCaptured;
    return a.id.localeCompare(b.id);
  });
  const writeTx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readwrite');
  const store = writeTx.objectStore(GRPC_CALL_HISTORY_IDB_STORE);

  if (existing.length >= maxEntries) {
    const toDelete = existing.length - maxEntries + 1;
    for (const row of sortedOldestFirst.slice(0, toDelete)) {
      store.delete(row.id);
    }
  }
  store.put(sanitized);
  await txComplete(writeTx);
}

/**
 * Append a prepared history entry with global FIFO retention.
 * Serializes concurrent appends through a promise queue.
 */
export function idbAppendGrpcCallHistoryEntry(
  entry: GrpcCallHistoryEntryV1,
  maxEntries: number = GRPC_CALL_HISTORY_MAX_ENTRIES,
): Promise<void> {
  const prev = _appendQueue;
  let resolveCaller!: () => void;
  let rejectCaller!: (err: unknown) => void;
  const callerPromise = new Promise<void>((resolve, reject) => {
    resolveCaller = resolve;
    rejectCaller = reject;
  });

  _appendQueue = prev
    .then(() => _doAppendGrpcCallHistoryEntry(entry, maxEntries))
    .then(resolveCaller, (err) => {
      rejectCaller(err);
    });

  return callerPromise;
}

export async function idbLoadGrpcCallHistoryEntries(): Promise<GrpcCallHistoryEntryV1[]> {
  if (!idbAvailable()) return [];
  await ensureLegacyGrpcCallHistoryHealed();
  return readAllGrpcCallHistoryEntriesFromDb();
}

export async function idbLoadGrpcCallHistoryByService(
  service: string,
): Promise<GrpcCallHistoryEntryV1[]> {
  if (!idbAvailable()) return [];
  await ensureLegacyGrpcCallHistoryHealed();
  if (typeof IDBKeyRange === 'undefined') {
    const all = await idbLoadGrpcCallHistoryEntries();
    return sortNewestFirst(all.filter((entry) => entry.service === service));
  }
  const db = await openDB();
  const tx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readonly');
  const entries = await wrap(
    tx.objectStore(GRPC_CALL_HISTORY_IDB_STORE).index('service').getAll(IDBKeyRange.only(service)),
  ) as GrpcCallHistoryEntryV1[];
  return sortNewestFirst(entries);
}

export async function idbDeleteGrpcCallHistoryEntry(id: string): Promise<void> {
  if (!idbAvailable()) return;
  const db = await openDB();
  const tx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readwrite');
  tx.objectStore(GRPC_CALL_HISTORY_IDB_STORE).delete(id);
  await txComplete(tx);
}

export async function idbClearGrpcCallHistory(): Promise<void> {
  if (!idbAvailable()) return;
  const db = await openDB();
  const readTx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readonly');
  const ids = await wrap(readTx.objectStore(GRPC_CALL_HISTORY_IDB_STORE).getAllKeys()) as string[];
  if (ids.length === 0) return;

  const writeTx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readwrite');
  const store = writeTx.objectStore(GRPC_CALL_HISTORY_IDB_STORE);
  for (const id of ids) store.delete(id);
  await txComplete(writeTx);
}

export async function idbDeleteGrpcCallHistoryEntries(ids: string[]): Promise<void> {
  if (!idbAvailable() || ids.length === 0) return;
  const db = await openDB();
  const writeTx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readwrite');
  const store = writeTx.objectStore(GRPC_CALL_HISTORY_IDB_STORE);
  for (const id of ids) store.delete(id);
  await txComplete(writeTx);
}

export async function idbReplaceGrpcCallHistoryEntries(entries: GrpcCallHistoryEntryV1[]): Promise<void> {
  if (!idbAvailable()) return;
  const prepared = sortNewestFirst(entries)
    .slice(0, GRPC_CALL_HISTORY_MAX_ENTRIES)
    .map((entry) => reprepareGrpcCallHistoryEntryForPersistSafe(entry));
  const db = await openDB();
  const readTx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readonly');
  const existingIds = await wrap(
    readTx.objectStore(GRPC_CALL_HISTORY_IDB_STORE).getAllKeys(),
  ) as string[];

  const nextIds = new Set(prepared.map((entry) => entry.id));
  const writeTx = db.transaction(GRPC_CALL_HISTORY_IDB_STORE, 'readwrite');
  const store = writeTx.objectStore(GRPC_CALL_HISTORY_IDB_STORE);
  for (const id of existingIds) {
    if (!nextIds.has(String(id))) store.delete(id);
  }
  for (const entry of prepared) {
    store.put(entry);
  }
  await txComplete(writeTx);
}

/**
 * Merge legacy localStorage envelope into IDB.
 * Empty IDB → append all LS rows. Partial IDB → merge by id (IDB wins conflicts), replace rows, cap.
 */
export async function idbSyncGrpcCallHistoryFromLocalStorage(raw: string): Promise<boolean> {
  if (!idbAvailable()) return false;
  try {
    const fromLs = migrateGrpcCallHistoryStore(raw).entries;
    if (fromLs.length === 0) return false;

    const idbEntries = await idbLoadGrpcCallHistoryEntries();
    if (idbEntries.length === 0) {
      for (const entry of fromLs) {
        await idbAppendGrpcCallHistoryEntry(entry, GRPC_CALL_HISTORY_MAX_ENTRIES);
      }
      return true;
    }

    const byId = new Map(fromLs.map((entry) => [entry.id, entry]));
    for (const entry of idbEntries) byId.set(entry.id, entry);
    const merged = sortNewestFirst(Array.from(byId.values())).slice(0, GRPC_CALL_HISTORY_MAX_ENTRIES);
    await idbReplaceGrpcCallHistoryEntries(merged);
    return true;
  } catch {
    return false;
  }
}

/** Test-only: reset append queue between tests. */
export function resetGrpcCallHistoryAppendQueueForTests(): void {
  _appendQueue = Promise.resolve();
}

/** Test-only: reset heal memo between tests. */
export function resetGrpcCallHistoryHealPromiseForTests(): void {
  _healPromise = null;
}

export async function idbMigrateGrpcCallHistoryFromLocalStorage(raw: string): Promise<boolean> {
  return idbSyncGrpcCallHistoryFromLocalStorage(raw);
}

export { GRPC_CALL_HISTORY_STORAGE_KEY };
