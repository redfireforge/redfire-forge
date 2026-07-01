/**
 * Phase 5B — normalized IndexedDB persistence for gRPC collections.
 *
 * Logical model: GrpcCollectionsStoreV1 envelope (5A).
 * Physical model: grpc-collections (metadata rows) + grpc-collection-items (saved requests).
 */
import {
  GRPC_COLLECTION_ITEMS_IDB_STORE,
  GRPC_COLLECTIONS_IDB_STORE,
  GRPC_COLLECTIONS_STORAGE_KEY,
  GRPC_PERSISTENCE_SCHEMA_VERSION,
  prepareGrpcCollectionsStoreForPersist,
  validateGrpcCollectionsStore,
  type GrpcCollectionV1,
  type GrpcCollectionsStoreV1,
} from '../grpc/grpcPersistenceSchema';
import {
  prepareGrpcCollectionsStoreForPersistSafe,
  scanGrpcPersistPayloadsForLeakage,
} from '../grpc/grpcPersistRedactionMiddleware';
import { migrateGrpcCollectionsStore } from '../grpc/grpcPersistenceMigration';
import type { GrpcSavedRequest } from '../grpc/grpcSavedRequest';
import { idbAvailable, txComplete, wrap } from './idbHelpers';
import { openDB } from './idbOpen';

export interface GrpcCollectionIdbRow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  defaultTarget?: string;
  defaultDescriptorKey?: string;
}

export interface GrpcCollectionItemIdbRow {
  id: string;
  collectionId: string;
  sortOrder: number;
  savedRequest: GrpcSavedRequest;
}

function envelopeUpdatedAt(collections: GrpcCollectionV1[], fallback: string): string {
  return collections.reduce(
    (max, collection) => (collection.updatedAt > max ? collection.updatedAt : max),
    fallback,
  );
}

function assembleStore(
  rows: GrpcCollectionIdbRow[],
  items: GrpcCollectionItemIdbRow[],
  fallbackUpdatedAt: string,
): GrpcCollectionsStoreV1 {
  const rowIds = new Set(rows.map((row) => row.id));
  const itemsByCollection = new Map<string, GrpcSavedRequest[]>();
  for (const item of items.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!rowIds.has(item.collectionId)) continue;
    const list = itemsByCollection.get(item.collectionId) ?? [];
    list.push(item.savedRequest);
    itemsByCollection.set(item.collectionId, list);
  }

  const collections: GrpcCollectionV1[] = rows.map((row) => ({
    ...row,
    savedRequests: itemsByCollection.get(row.id) ?? [],
  }));

  return {
    schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
    collections,
    updatedAt: envelopeUpdatedAt(collections, fallbackUpdatedAt),
  };
}

let _collectionsHealDone = false;

type GrpcCollectionsDbParts = {
  rows: GrpcCollectionIdbRow[];
  items: GrpcCollectionItemIdbRow[];
};

async function readRawGrpcCollectionsDbParts(): Promise<GrpcCollectionsDbParts | null> {
  const db = await openDB();
  const readTx = db.transaction(
    [GRPC_COLLECTIONS_IDB_STORE, GRPC_COLLECTION_ITEMS_IDB_STORE],
    'readonly',
  );
  const rows = await wrap(
    readTx.objectStore(GRPC_COLLECTIONS_IDB_STORE).getAll(),
  ) as GrpcCollectionIdbRow[];
  const items = await wrap(
    readTx.objectStore(GRPC_COLLECTION_ITEMS_IDB_STORE).getAll(),
  ) as GrpcCollectionItemIdbRow[];

  if (rows.length === 0 && items.length === 0) {
    return null;
  }

  const rowIds = new Set(rows.map((row) => row.id));
  const orphanItemIds = items.filter((item) => !rowIds.has(item.collectionId)).map((item) => item.id);
  if (orphanItemIds.length > 0) {
    const writeTx = db.transaction(GRPC_COLLECTION_ITEMS_IDB_STORE, 'readwrite');
    const itemStore = writeTx.objectStore(GRPC_COLLECTION_ITEMS_IDB_STORE);
    for (const id of orphanItemIds) itemStore.delete(id);
    await txComplete(writeTx);
  }

  return {
    rows,
    items: items.filter((item) => rowIds.has(item.collectionId)),
  };
}

function buildGrpcCollectionsStoreFromDbParts(parts: GrpcCollectionsDbParts): GrpcCollectionsStoreV1 {
  const fallback = new Date().toISOString();
  return migrateGrpcCollectionsStore(assembleStore(parts.rows, parts.items, fallback));
}

function rawCollectionsStoreNeedsPersistHeal(parts: GrpcCollectionsDbParts): boolean {
  const fallback = new Date().toISOString();
  const raw = assembleStore(parts.rows, parts.items, fallback);
  return scanGrpcPersistPayloadsForLeakage({ grpc_collections_v1: raw }).length > 0;
}

export async function idbLoadGrpcCollectionsStore(): Promise<GrpcCollectionsStoreV1 | null> {
  if (!idbAvailable()) return null;

  let parts = await readRawGrpcCollectionsDbParts();
  if (!parts) return null;

  if (!_collectionsHealDone) {
    if (rawCollectionsStoreNeedsPersistHeal(parts)) {
      const fallback = new Date().toISOString();
      await idbSaveGrpcCollectionsStore(assembleStore(parts.rows, parts.items, fallback));
      parts = await readRawGrpcCollectionsDbParts();
      if (!parts) return null;
    }
    _collectionsHealDone = true;
  }

  return buildGrpcCollectionsStoreFromDbParts(parts);
}

export async function idbSaveGrpcCollectionsStore(store: GrpcCollectionsStoreV1): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const prepared = prepareGrpcCollectionsStoreForPersistSafe(store);
  const validated = validateGrpcCollectionsStore(prepared);
  if (!validated.ok) {
    const summary = validated.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Invalid gRPC collections store: ${summary}`);
  }
  const db = await openDB();

  const readTx = db.transaction(
    [GRPC_COLLECTIONS_IDB_STORE, GRPC_COLLECTION_ITEMS_IDB_STORE],
    'readonly',
  );
  const existingCollectionIds = await wrap(
    readTx.objectStore(GRPC_COLLECTIONS_IDB_STORE).getAllKeys(),
  ) as string[];
  const existingItemIds = await wrap(
    readTx.objectStore(GRPC_COLLECTION_ITEMS_IDB_STORE).getAllKeys(),
  ) as string[];

  const nextCollectionIds = new Set(prepared.collections.map((collection) => collection.id));
  const nextItemIds = new Set(
    prepared.collections.flatMap((collection) => collection.savedRequests.map((saved) => saved.id)),
  );

  const writeTx = db.transaction(
    [GRPC_COLLECTIONS_IDB_STORE, GRPC_COLLECTION_ITEMS_IDB_STORE],
    'readwrite',
  );
  const colStore = writeTx.objectStore(GRPC_COLLECTIONS_IDB_STORE);
  const itemStore = writeTx.objectStore(GRPC_COLLECTION_ITEMS_IDB_STORE);

  for (const id of existingCollectionIds) {
    if (!nextCollectionIds.has(String(id))) colStore.delete(id);
  }
  for (const id of existingItemIds) {
    if (!nextItemIds.has(String(id))) itemStore.delete(id);
  }

  for (const collection of prepared.collections) {
    const row: GrpcCollectionIdbRow = {
      id: collection.id,
      name: collection.name,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      defaultTarget: collection.defaultTarget,
      defaultDescriptorKey: collection.defaultDescriptorKey,
    };
    colStore.put(row);
    collection.savedRequests.forEach((savedRequest, sortOrder) => {
      itemStore.put({
        id: savedRequest.id,
        collectionId: collection.id,
        sortOrder,
        savedRequest,
      } satisfies GrpcCollectionItemIdbRow);
    });
  }

  await txComplete(writeTx);
}

/** Merge LS envelope into IDB store (IDB wins collection + saved-request conflicts). */
function mergeCollectionsStores(
  idbStore: GrpcCollectionsStoreV1,
  lsStore: GrpcCollectionsStoreV1,
): GrpcCollectionsStoreV1 {
  const byColId = new Map<string, GrpcCollectionV1>();
  for (const col of lsStore.collections) {
    byColId.set(col.id, structuredClone(col));
  }
  for (const col of idbStore.collections) {
    const existing = byColId.get(col.id);
    if (!existing) {
      byColId.set(col.id, structuredClone(col));
      continue;
    }
    const bySavedId = new Map(existing.savedRequests.map((saved) => [saved.id, saved]));
    for (const saved of col.savedRequests) bySavedId.set(saved.id, saved);
    byColId.set(col.id, {
      ...col,
      savedRequests: Array.from(bySavedId.values()),
    });
  }
  return prepareGrpcCollectionsStoreForPersist({
    schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
    collections: Array.from(byColId.values()),
    updatedAt: idbStore.updatedAt,
  });
}

/**
 * Merge legacy localStorage envelope into IDB.
 * Empty IDB → save LS store. Partial IDB → merge by id (IDB wins conflicts).
 */
export async function idbSyncGrpcCollectionsFromLocalStorage(raw: string): Promise<boolean> {
  if (!idbAvailable()) return false;
  try {
    const fromLs = migrateGrpcCollectionsStore(raw);
    if (fromLs.collections.length === 0) return false;

    const idbStore = await idbLoadGrpcCollectionsStore();
    if (!idbStore || idbStore.collections.length === 0) {
      await idbSaveGrpcCollectionsStore(fromLs);
      return true;
    }

    const merged = mergeCollectionsStores(idbStore, fromLs);
    await idbSaveGrpcCollectionsStore(merged);
    return true;
  } catch {
    return false;
  }
}

/** Migrate legacy localStorage envelope into IDB when IDB is empty. */
export async function idbMigrateGrpcCollectionsFromLocalStorage(raw: string): Promise<boolean> {
  return idbSyncGrpcCollectionsFromLocalStorage(raw);
}

export { GRPC_COLLECTIONS_STORAGE_KEY };

/** Test-only: reset heal memo between tests. */
export function resetGrpcCollectionsHealPromiseForTests(): void {
  _collectionsHealDone = false;
}
