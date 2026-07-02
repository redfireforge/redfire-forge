/**
 * Phase 5B — gRPC collections repository (CRUD + dual-mode persistence).
 */
import {
  bumpGrpcSavedRequestRevision,
  createEmptyGrpcCollectionsStore,
  createGrpcSavedRequestIdentity,
  GRPC_PERSISTENCE_SCHEMA_VERSION,
  prepareGrpcCollectionsStoreForPersist,
  validateGrpcCollectionsStore,
  type GrpcCollectionV1,
  type GrpcCollectionsStoreV1,
} from '../../../shared/grpc/grpcPersistenceSchema';
import { prepareGrpcCollectionsStoreForPersistSafe } from '../../../shared/grpc/grpcPersistRedactionMiddleware';
import { migrateGrpcCollectionsStore } from '../../../shared/grpc/grpcPersistenceMigration';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import { isTauri } from '../../../shared/utils/platform';
import { readKey, writeKey } from '../../../shared/utils/storage';
import {
  GRPC_COLLECTIONS_STORAGE_KEY,
  idbLoadGrpcCollectionsStore,
  idbSaveGrpcCollectionsStore,
  idbSyncGrpcCollectionsFromLocalStorage,
} from '../../../shared/utils/idbGrpcCollections';
import { idbAvailable } from '../../../shared/utils/idbHelpers';

let persistQueue: Promise<void> = Promise.resolve();

export interface GrpcCollectionsExportData {
  _exportMeta: {
    version: '1.0';
    exportedAt: string;
    source: 'RedfireForge/gRPC';
  };
  store: GrpcCollectionsStoreV1;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneStore(store: GrpcCollectionsStoreV1): GrpcCollectionsStoreV1 {
  return structuredClone(store);
}

async function loadFromTauri(): Promise<GrpcCollectionsStoreV1> {
  try {
    const raw = await readKey(GRPC_COLLECTIONS_STORAGE_KEY);
    if (!raw) return createEmptyGrpcCollectionsStore();
    return migrateGrpcCollectionsStore(raw);
  } catch {
    return createEmptyGrpcCollectionsStore();
  }
}

async function writePreparedCollectionsToTauri(prepared: GrpcCollectionsStoreV1): Promise<void> {
  const validated = validateGrpcCollectionsStore(prepared);
  if (!validated.ok) {
    const summary = validated.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Invalid gRPC collections store: ${summary}`);
  }
  await writeKey(GRPC_COLLECTIONS_STORAGE_KEY, JSON.stringify(prepared));
}

function removeCollectionsLocalStorageKey(): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(GRPC_COLLECTIONS_STORAGE_KEY)) {
      localStorage.removeItem(GRPC_COLLECTIONS_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

async function ensureCollectionsSyncedFromLocalStorage(): Promise<void> {
  const raw = await readKey(GRPC_COLLECTIONS_STORAGE_KEY);
  if (!raw) return;

  const fromLs = migrateGrpcCollectionsStore(raw);
  if (fromLs.collections.length === 0) {
    removeCollectionsLocalStorageKey();
    return;
  }

  const synced = await idbSyncGrpcCollectionsFromLocalStorage(raw);
  if (synced) removeCollectionsLocalStorageKey();
}

async function loadFromWeb(): Promise<GrpcCollectionsStoreV1> {
  try {
    if (idbAvailable()) {
      await ensureCollectionsSyncedFromLocalStorage();
      const fromIdb = await idbLoadGrpcCollectionsStore();
      if (fromIdb) return fromIdb;
    }

    const raw = await readKey(GRPC_COLLECTIONS_STORAGE_KEY);
    if (raw) return migrateGrpcCollectionsStore(raw);
  } catch {
    /* fall through */
  }
  return createEmptyGrpcCollectionsStore();
}

async function savePreparedCollectionsToWeb(prepared: GrpcCollectionsStoreV1): Promise<void> {
  if (!idbAvailable()) {
    throw new Error('IndexedDB not available for gRPC collections persistence');
  }
  await ensureCollectionsSyncedFromLocalStorage();
  await idbSaveGrpcCollectionsStore(prepared);
  removeCollectionsLocalStorageKey();
}

export async function loadGrpcCollectionsStoreFromPersistence(): Promise<GrpcCollectionsStoreV1> {
  if (isTauri()) return loadFromTauri();
  return loadFromWeb();
}

export async function saveGrpcCollectionsStoreToPersistence(
  store: GrpcCollectionsStoreV1,
): Promise<GrpcCollectionsStoreV1> {
  const prepared = prepareGrpcCollectionsStoreForPersistSafe(store);
  if (isTauri()) {
    await writePreparedCollectionsToTauri(prepared);
    return prepared;
  }
  await savePreparedCollectionsToWeb(prepared);
  return prepared;
}

function withGrpcCollectionsPersistLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = persistQueue.then(fn);
  persistQueue = run.then(() => undefined, () => undefined);
  return run;
}

export function enqueueGrpcCollectionsPersist(store: GrpcCollectionsStoreV1): Promise<GrpcCollectionsStoreV1> {
  return withGrpcCollectionsPersistLock(() => saveGrpcCollectionsStoreToPersistence(store));
}

/** Test-only: reset persist queue between tests. */
export function resetGrpcCollectionsPersistQueueForTests(): void {
  persistQueue = Promise.resolve();
}

function touchStore(store: GrpcCollectionsStoreV1, now: string): GrpcCollectionsStoreV1 {
  return prepareGrpcCollectionsStoreForPersist(store, now);
}

function findCollection(store: GrpcCollectionsStoreV1, collectionId: string): GrpcCollectionV1 {
  const collection = store.collections.find((entry) => entry.id === collectionId);
  if (!collection) throw new Error(`Collection not found: ${collectionId}`);
  return collection;
}

export function createGrpcCollectionInStore(
  store: GrpcCollectionsStoreV1,
  input: { name: string; defaultTarget?: string; defaultDescriptorKey?: string },
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Collection name is required');
  const next = cloneStore(store);
  const collection: GrpcCollectionV1 = {
    id: crypto.randomUUID(),
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
    defaultTarget: input.defaultTarget?.trim() || undefined,
    defaultDescriptorKey: input.defaultDescriptorKey?.trim() || undefined,
    savedRequests: [],
  };
  next.collections.push(collection);
  return touchStore(next, now);
}

export function updateGrpcCollectionInStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  patch: Partial<Pick<GrpcCollectionV1, 'name' | 'defaultTarget' | 'defaultDescriptorKey'>>,
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const next = cloneStore(store);
  const collection = findCollection(next, collectionId);
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('Collection name is required');
    collection.name = trimmed;
  }
  if (patch.defaultTarget !== undefined) {
    collection.defaultTarget = patch.defaultTarget.trim() || undefined;
  }
  if (patch.defaultDescriptorKey !== undefined) {
    collection.defaultDescriptorKey = patch.defaultDescriptorKey.trim() || undefined;
  }
  collection.updatedAt = now;
  return touchStore(next, now);
}

export function deleteGrpcCollectionFromStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const next = cloneStore(store);
  next.collections = next.collections.filter((collection) => collection.id !== collectionId);
  return touchStore(next, now);
}

export function duplicateGrpcCollectionInStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const source = findCollection(store, collectionId);
  const next = cloneStore(store);
  const newCollectionId = crypto.randomUUID();
  const duplicatedRequests = source.savedRequests.map((saved) => {
    const identity = createGrpcSavedRequestIdentity(crypto.randomUUID(), now);
    return {
      ...structuredClone(saved),
      id: identity.id,
      revisionId: identity.revisionId,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
      name: `${saved.name} (copy)`,
    } satisfies GrpcSavedRequest;
  });
  for (const saved of duplicatedRequests) {
    assertUniqueSavedRequestId(next, saved.id);
  }

  next.collections.push({
    id: newCollectionId,
    name: `${source.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    defaultTarget: source.defaultTarget,
    defaultDescriptorKey: source.defaultDescriptorKey,
    savedRequests: duplicatedRequests,
  });
  return touchStore(next, now);
}

function assertUniqueSavedRequestId(store: GrpcCollectionsStoreV1, savedRequestId: string): void {
  for (const collection of store.collections) {
    if (collection.savedRequests.some((saved) => saved.id === savedRequestId)) {
      throw new Error(`Duplicate saved request id: ${savedRequestId}`);
    }
  }
}

export function addGrpcSavedRequestToStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  savedRequest: GrpcSavedRequest,
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  assertUniqueSavedRequestId(store, savedRequest.id);
  const next = cloneStore(store);
  const collection = findCollection(next, collectionId);
  collection.savedRequests.push(savedRequest);
  collection.updatedAt = now;
  return touchStore(next, now);
}

export function updateGrpcSavedRequestInStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  savedRequestId: string,
  patch: Partial<GrpcSavedRequest>,
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const next = cloneStore(store);
  const collection = findCollection(next, collectionId);
  const index = collection.savedRequests.findIndex((saved) => saved.id === savedRequestId);
  if (index < 0) throw new Error(`Saved request not found: ${savedRequestId}`);

  const prior = collection.savedRequests[index];
  const revision = bumpGrpcSavedRequestRevision(prior, now);
  const merged: GrpcSavedRequest = {
    ...prior,
    ...patch,
    id: prior.id,
    createdAt: prior.createdAt,
    revisionId: revision.revisionId,
    updatedAt: revision.updatedAt,
  };
  if ('responseBaseline' in patch && patch.responseBaseline === undefined) {
    delete merged.responseBaseline;
  }
  collection.savedRequests[index] = merged;
  collection.updatedAt = now;
  return touchStore(next, now);
}

export function deleteGrpcSavedRequestFromStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  savedRequestId: string,
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const next = cloneStore(store);
  const collection = findCollection(next, collectionId);
  collection.savedRequests = collection.savedRequests.filter((saved) => saved.id !== savedRequestId);
  collection.updatedAt = now;
  return touchStore(next, now);
}

export function incrementGrpcSavedRequestRunStatsInStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  savedRequestId: string,
  input: {
    grpcStatus?: number;
    durationMs?: number;
    capturedAt?: string;
  },
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const next = cloneStore(store);
  const collection = findCollection(next, collectionId);
  const index = collection.savedRequests.findIndex((saved) => saved.id === savedRequestId);
  if (index < 0) throw new Error(`Saved request not found: ${savedRequestId}`);

  const prior = collection.savedRequests[index];
  const revision = bumpGrpcSavedRequestRevision(prior, now);
  const previousStats = prior.runStats ?? {
    totalRuns: 0,
    successRuns: 0,
    errorRuns: 0,
  };
  const grpcStatus = input.grpcStatus;
  const success = typeof grpcStatus === 'number' ? grpcStatus === 0 : false;
  const runStats = {
    totalRuns: previousStats.totalRuns + 1,
    successRuns: previousStats.successRuns + (success ? 1 : 0),
    errorRuns: previousStats.errorRuns + (success ? 0 : 1),
    lastRunAt: input.capturedAt ?? now,
    lastGrpcStatus: grpcStatus,
    lastDurationMs: input.durationMs,
  };

  collection.savedRequests[index] = {
    ...prior,
    revisionId: revision.revisionId,
    updatedAt: revision.updatedAt,
    runStats,
  };
  collection.updatedAt = now;
  return touchStore(next, now);
}

export function duplicateGrpcSavedRequestInStore(
  store: GrpcCollectionsStoreV1,
  collectionId: string,
  savedRequestId: string,
  now: string = nowIso(),
): GrpcCollectionsStoreV1 {
  const source = findCollection(store, collectionId);
  const saved = source.savedRequests.find((entry) => entry.id === savedRequestId);
  if (!saved) throw new Error(`Saved request not found: ${savedRequestId}`);

  const identity = createGrpcSavedRequestIdentity(crypto.randomUUID(), now);
  const copy: GrpcSavedRequest = {
    ...structuredClone(saved),
    id: identity.id,
    revisionId: identity.revisionId,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    name: `${saved.name} (copy)`,
  };
  return addGrpcSavedRequestToStore(store, collectionId, copy, now);
}

export async function persistGrpcCollectionsStore(
  store: GrpcCollectionsStoreV1,
): Promise<GrpcCollectionsStoreV1> {
  return enqueueGrpcCollectionsPersist(store);
}

function normalizeGrpcCollectionsImportPayload(raw: unknown): GrpcCollectionsStoreV1 {
  if (!isPlainObject(raw)) {
    throw new Error('Import payload must be a JSON object');
  }
  const exportStore = raw.store;
  if (isPlainObject(exportStore)) {
    return migrateGrpcCollectionsStore(exportStore);
  }
  if (Array.isArray(raw.collections) || raw.schemaVersion === GRPC_PERSISTENCE_SCHEMA_VERSION) {
    return migrateGrpcCollectionsStore(raw);
  }
  throw new Error('Unrecognized gRPC collections import format');
}

function mergeGrpcCollectionsStores(
  base: GrpcCollectionsStoreV1,
  incoming: GrpcCollectionsStoreV1,
): GrpcCollectionsStoreV1 {
  const byCollectionId = new Map(base.collections.map((collection) => [
    collection.id,
    structuredClone(collection),
  ]));

  for (const importedCollection of incoming.collections) {
    const existing = byCollectionId.get(importedCollection.id);
    if (!existing) {
      byCollectionId.set(importedCollection.id, structuredClone(importedCollection));
      continue;
    }
    const bySavedId = new Map(existing.savedRequests.map((saved) => [saved.id, saved]));
    for (const importedSaved of importedCollection.savedRequests) {
      bySavedId.set(importedSaved.id, structuredClone(importedSaved));
    }
    byCollectionId.set(importedCollection.id, {
      ...existing,
      name: importedCollection.name,
      defaultTarget: importedCollection.defaultTarget,
      defaultDescriptorKey: importedCollection.defaultDescriptorKey,
      updatedAt: importedCollection.updatedAt > existing.updatedAt
        ? importedCollection.updatedAt
        : existing.updatedAt,
      savedRequests: Array.from(bySavedId.values()),
    });
  }

  return prepareGrpcCollectionsStoreForPersistSafe({
    schemaVersion: GRPC_PERSISTENCE_SCHEMA_VERSION,
    collections: Array.from(byCollectionId.values()),
    updatedAt: new Date().toISOString(),
  });
}

export async function exportGrpcCollectionsStore(): Promise<GrpcCollectionsExportData> {
  const store = await loadGrpcCollectionsStoreFromPersistence();
  return {
    _exportMeta: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      source: 'RedfireForge/gRPC',
    },
    store,
  };
}

export async function importGrpcCollectionsStore(
  raw: unknown,
  mode: 'merge' | 'replace' = 'merge',
): Promise<GrpcCollectionsStoreV1> {
  return withGrpcCollectionsPersistLock(async () => {
    const incoming = normalizeGrpcCollectionsImportPayload(raw);
    const next = mode === 'replace'
      ? prepareGrpcCollectionsStoreForPersistSafe(incoming)
      : mergeGrpcCollectionsStores(await loadGrpcCollectionsStoreFromPersistence(), incoming);
    return saveGrpcCollectionsStoreToPersistence(next);
  });
}

export async function runGrpcCollectionMutation<T>(
  mutator: (store: GrpcCollectionsStoreV1) => { store: GrpcCollectionsStoreV1; result: T },
): Promise<{ store: GrpcCollectionsStoreV1; result: T }> {
  return withGrpcCollectionsPersistLock(async () => {
    const base = await loadGrpcCollectionsStoreFromPersistence();
    const { store, result } = mutator(base);
    const prepared = await saveGrpcCollectionsStoreToPersistence(store);
    return { store: prepared, result };
  });
}
