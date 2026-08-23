/**
 * Phase 5D — gRPC call history recorder (append-only + dual-mode persistence).
 */
import type { GrpcCallHistoryRecord } from '@shared/grpc/grpcRedaction';
import {
  createEmptyGrpcCallHistoryStore,
  GRPC_CALL_HISTORY_MAX_ENTRIES,
  GRPC_CALL_HISTORY_STORAGE_KEY,
  type GrpcCallHistoryEntryV1,
} from '@shared/grpc/grpcPersistenceSchema';
import {
  prepareGrpcCallHistoryEntryForPersistSafe,
  prepareGrpcCallHistoryStoreForPersistSafe,
} from '@shared/grpc/grpcPersistRedactionMiddleware';
import { migrateGrpcCallHistoryStore } from '@shared/grpc/grpcPersistenceMigration';
import { isTauri } from '@shared/utils/platform';
import { readKey, writeKey } from '@shared/utils/storage';
import {
  idbAppendGrpcCallHistoryEntry,
  idbClearGrpcCallHistory,
  idbDeleteGrpcCallHistoryEntries,
  idbDeleteGrpcCallHistoryEntry,
  idbLoadGrpcCallHistoryByService,
  idbLoadGrpcCallHistoryEntries,
  idbSyncGrpcCallHistoryFromLocalStorage,
} from '@shared/utils/idbGrpcCallHistory';
import { idbAvailable } from '@shared/utils/idbHelpers';
import {
  filterGrpcCallHistoryEntries,
  type GrpcCallHistoryFilters,
} from '../utils/grpcHistoryFilters';

let historyPersistQueue: Promise<void> = Promise.resolve();

export type GrpcCallHistoryAppendInput = {
  id?: string;
  snapshot: GrpcCallHistoryRecord['snapshot'];
  result?: GrpcCallHistoryRecord['result'];
  error?: GrpcCallHistoryRecord['error'];
  /** Denormalized filter target when snapshot stores template form (Phase 9F). */
  filterTarget?: string;
};

async function loadEnvelopeFromTauri(): Promise<GrpcCallHistoryEntryV1[]> {
  try {
    const raw = await readKey(GRPC_CALL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const migrated = migrateGrpcCallHistoryStore(raw);
    return migrated.entries;
  } catch {
    return [];
  }
}

async function saveEnvelopeToTauri(entries: GrpcCallHistoryEntryV1[]): Promise<void> {
  const store = prepareGrpcCallHistoryStoreForPersistSafe({
    ...createEmptyGrpcCallHistoryStore(),
    entries: entries.slice(0, GRPC_CALL_HISTORY_MAX_ENTRIES),
  });
  await writeKey(GRPC_CALL_HISTORY_STORAGE_KEY, JSON.stringify(store));
}

async function ensureHistoryMigratedFromLocalStorage(): Promise<void> {
  const raw = await readKey(GRPC_CALL_HISTORY_STORAGE_KEY);
  if (!raw) return;

  const fromLs = migrateGrpcCallHistoryStore(raw).entries;
  if (fromLs.length === 0) {
    removeHistoryLocalStorageKey();
    return;
  }

  const synced = await idbSyncGrpcCallHistoryFromLocalStorage(raw);
  if (synced) removeHistoryLocalStorageKey();
}

function removeHistoryLocalStorageKey(): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(GRPC_CALL_HISTORY_STORAGE_KEY)) {
      localStorage.removeItem(GRPC_CALL_HISTORY_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

async function loadHistoryEntriesOnWeb(): Promise<GrpcCallHistoryEntryV1[]> {
  await ensureHistoryMigratedFromLocalStorage();
  return idbLoadGrpcCallHistoryEntries();
}

async function loadFromWeb(filters?: GrpcCallHistoryFilters): Promise<GrpcCallHistoryEntryV1[]> {
  if (!idbAvailable()) return [];

  await ensureHistoryMigratedFromLocalStorage();

  let entries: GrpcCallHistoryEntryV1[];
  if (filters?.service && !filters.method && !filters.text && filters.grpcStatus === undefined
    && !filters.callType && !filters.capturedAfter && !filters.capturedBefore) {
    entries = await idbLoadGrpcCallHistoryByService(filters.service);
  } else {
    entries = await idbLoadGrpcCallHistoryEntries();
  }
  return filters ? filterGrpcCallHistoryEntries(entries, filters) : entries;
}

async function loadFromTauri(filters?: GrpcCallHistoryFilters): Promise<GrpcCallHistoryEntryV1[]> {
  const entries = await loadEnvelopeFromTauri();
  return filters ? filterGrpcCallHistoryEntries(entries, filters) : entries;
}

export async function loadGrpcCallHistoryEntries(
  filters?: GrpcCallHistoryFilters,
): Promise<GrpcCallHistoryEntryV1[]> {
  if (isTauri()) return loadFromTauri(filters);
  return loadFromWeb(filters);
}

export async function queryGrpcCallHistory(
  filters: GrpcCallHistoryFilters,
): Promise<GrpcCallHistoryEntryV1[]> {
  return loadGrpcCallHistoryEntries(filters);
}

function capEntries(entries: GrpcCallHistoryEntryV1[]): GrpcCallHistoryEntryV1[] {
  return entries
    .slice()
    .sort((a, b) => {
      const byCaptured = b.capturedAt.localeCompare(a.capturedAt);
      if (byCaptured !== 0) return byCaptured;
      return b.id.localeCompare(a.id);
    })
    .slice(0, GRPC_CALL_HISTORY_MAX_ENTRIES);
}

async function appendOnTauri(entry: GrpcCallHistoryEntryV1): Promise<void> {
  const existing = await loadEnvelopeFromTauri();
  await saveEnvelopeToTauri(capEntries([entry, ...existing]));
}

async function appendOnWeb(entry: GrpcCallHistoryEntryV1): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available for gRPC call history');
  await ensureHistoryMigratedFromLocalStorage();
  await idbAppendGrpcCallHistoryEntry(entry, GRPC_CALL_HISTORY_MAX_ENTRIES);
}

export async function appendGrpcCallHistory(
  input: GrpcCallHistoryAppendInput,
): Promise<GrpcCallHistoryEntryV1> {
  const entry = prepareGrpcCallHistoryEntryForPersistSafe({
    id: input.id ?? crypto.randomUUID(),
    snapshot: input.snapshot,
    result: input.result,
    error: input.error,
    filterTarget: input.filterTarget,
  });

  const run = historyPersistQueue.then(async () => {
    if (isTauri()) {
      await appendOnTauri(entry);
      return;
    }
    await appendOnWeb(entry);
  });

  historyPersistQueue = run.catch(() => {});
  await run;
  return entry;
}

export async function deleteGrpcCallHistoryEntry(id: string): Promise<void> {
  const run = historyPersistQueue.then(async () => {
    if (isTauri()) {
      const entries = await loadEnvelopeFromTauri();
      await saveEnvelopeToTauri(entries.filter((entry) => entry.id !== id));
      return;
    }
    await ensureHistoryMigratedFromLocalStorage();
    await idbDeleteGrpcCallHistoryEntry(id);
  });
  historyPersistQueue = run.catch(() => {});
  await run;
}

export async function clearGrpcCallHistory(): Promise<void> {
  const run = historyPersistQueue.then(async () => {
    if (isTauri()) {
      await saveEnvelopeToTauri([]);
      return;
    }
    await ensureHistoryMigratedFromLocalStorage();
    await idbClearGrpcCallHistory();
    removeHistoryLocalStorageKey();
  });
  historyPersistQueue = run.catch(() => {});
  await run;
}

export async function clearGrpcCallHistoryFiltered(
  filters: GrpcCallHistoryFilters,
): Promise<number> {
  let removedCount = 0;
  const run = historyPersistQueue.then(async () => {
    const entries = isTauri()
      ? await loadEnvelopeFromTauri()
      : await loadHistoryEntriesOnWeb();
    const toRemove = filterGrpcCallHistoryEntries(entries, filters);
    if (toRemove.length === 0) return;

    if (isTauri()) {
      const removeIds = new Set(toRemove.map((entry) => entry.id));
      const remaining = entries.filter((entry) => !removeIds.has(entry.id));
      await saveEnvelopeToTauri(remaining);
    } else {
      await idbDeleteGrpcCallHistoryEntries(toRemove.map((entry) => entry.id));
    }
    removedCount = toRemove.length;
  });
  historyPersistQueue = run.catch(() => {});
  await run;
  return removedCount;
}

/** Test-only: reset persist queue between tests. */
export function resetGrpcCallHistoryPersistQueueForTests(): void {
  historyPersistQueue = Promise.resolve();
}

export { GRPC_CALL_HISTORY_STORAGE_KEY, GRPC_CALL_HISTORY_MAX_ENTRIES };
