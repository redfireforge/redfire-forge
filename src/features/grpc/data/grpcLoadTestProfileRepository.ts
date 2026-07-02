/**
 * Phase 11J — load-test profile persistence (config only, no secrets).
 */
import type { GrpcLoadTestConfig } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { assertGrpcLoadTestConfig } from '../../../shared/grpc/grpcAdvancedFeatureContracts';
import { isTauri } from '../../../shared/utils/platform';
import { readKey, removeKey, writeKey } from '../../../shared/utils/storage';
import { idbAvailable, txComplete, wrap } from '../../../shared/utils/idbHelpers';
import { openDB } from '../../../shared/utils/idbOpen';

export const GRPC_LOAD_TEST_PROFILES_STORAGE_KEY = 'grpc_load_test_profiles_v1';
export const GRPC_LOAD_TEST_PROFILES_IDB_STORE = 'grpc-load-test-profiles';

export interface GrpcLoadTestProfile {
  id: string;
  name: string;
  updatedAt: string;
  config: GrpcLoadTestConfig;
}

export interface GrpcLoadTestProfilesStoreV1 {
  schemaVersion: 1;
  profiles: GrpcLoadTestProfile[];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyStore(): GrpcLoadTestProfilesStoreV1 {
  const now = nowIso();
  return { schemaVersion: 1, profiles: [], updatedAt: now };
}

function validateProfile(profile: GrpcLoadTestProfile): void {
  const trimmedName = profile.name.trim();
  if (!trimmedName) {
    throw new Error('Profile name is required');
  }
  assertGrpcLoadTestConfig('unary', profile.config);
}

function normalizeStore(raw: unknown): GrpcLoadTestProfilesStoreV1 {
  if (raw == null || typeof raw !== 'object') {
    return emptyStore();
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.profiles)) {
    return emptyStore();
  }
  const profiles: GrpcLoadTestProfile[] = [];
  for (const entry of record.profiles) {
    if (entry == null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.updatedAt !== 'string') {
      continue;
    }
    if (row.config == null || typeof row.config !== 'object') continue;
    try {
      const profile: GrpcLoadTestProfile = {
        id: row.id,
        name: row.name.trim(),
        updatedAt: row.updatedAt,
        config: row.config as GrpcLoadTestConfig,
      };
      validateProfile(profile);
      profiles.push(profile);
    } catch {
      /* skip invalid profile rows */
    }
  }
  return {
    schemaVersion: 1,
    profiles,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : nowIso(),
  };
}

async function loadFromTauri(): Promise<GrpcLoadTestProfilesStoreV1> {
  try {
    const raw = await readKey(GRPC_LOAD_TEST_PROFILES_STORAGE_KEY);
    if (!raw) return emptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

async function saveToTauri(store: GrpcLoadTestProfilesStoreV1): Promise<void> {
  await writeKey(GRPC_LOAD_TEST_PROFILES_STORAGE_KEY, JSON.stringify(store));
}

async function loadFromIdb(): Promise<GrpcLoadTestProfilesStoreV1> {
  if (!idbAvailable()) return emptyStore();
  const db = await openDB();
  const rows = await wrap<GrpcLoadTestProfile[]>(
    db.transaction(GRPC_LOAD_TEST_PROFILES_IDB_STORE, 'readonly')
      .objectStore(GRPC_LOAD_TEST_PROFILES_IDB_STORE)
      .getAll(),
  );
  return normalizeStore({ schemaVersion: 1, profiles: rows ?? [], updatedAt: nowIso() });
}

async function saveToIdb(store: GrpcLoadTestProfilesStoreV1): Promise<void> {
  if (!idbAvailable()) {
    throw new Error('IndexedDB not available for gRPC load-test profiles');
  }
  const db = await openDB();

  const readTx = db.transaction(GRPC_LOAD_TEST_PROFILES_IDB_STORE, 'readonly');
  const existingIds = await wrap<IDBValidKey[]>(
    readTx.objectStore(GRPC_LOAD_TEST_PROFILES_IDB_STORE).getAllKeys(),
  );

  const nextIds = new Set(store.profiles.map((profile) => profile.id));
  const writeTx = db.transaction(GRPC_LOAD_TEST_PROFILES_IDB_STORE, 'readwrite');
  const objectStore = writeTx.objectStore(GRPC_LOAD_TEST_PROFILES_IDB_STORE);

  for (const id of existingIds) {
    if (!nextIds.has(String(id))) {
      objectStore.delete(id);
    }
  }
  for (const profile of store.profiles) {
    objectStore.put(profile);
  }
  await txComplete(writeTx);
}

async function loadStore(): Promise<GrpcLoadTestProfilesStoreV1> {
  if (isTauri()) return loadFromTauri();
  try {
    if (idbAvailable()) {
      const fromIdb = await loadFromIdb();
      if (fromIdb.profiles.length > 0) return fromIdb;
      const legacy = await loadFromTauri();
      if (legacy.profiles.length > 0) {
        await saveToIdb({
          schemaVersion: 1,
          profiles: legacy.profiles,
          updatedAt: nowIso(),
        });
        try {
          await removeKey(GRPC_LOAD_TEST_PROFILES_STORAGE_KEY);
        } catch {
          /* ignore legacy key cleanup failures */
        }
        return legacy;
      }
      return fromIdb;
    }
    return loadFromTauri();
  } catch {
    return emptyStore();
  }
}

async function saveStore(store: GrpcLoadTestProfilesStoreV1): Promise<GrpcLoadTestProfilesStoreV1> {
  const next: GrpcLoadTestProfilesStoreV1 = {
    schemaVersion: 1,
    profiles: store.profiles.map((profile) => structuredClone(profile)),
    updatedAt: nowIso(),
  };
  for (const profile of next.profiles) {
    validateProfile(profile);
  }
  if (isTauri()) {
    await saveToTauri(next);
    return next;
  }
  await saveToIdb(next);
  return next;
}

let persistQueue: Promise<void> = Promise.resolve();

function withPersistLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = persistQueue.then(fn);
  persistQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function listGrpcLoadTestProfiles(): Promise<GrpcLoadTestProfile[]> {
  const store = await loadStore();
  return store.profiles
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function getGrpcLoadTestProfileById(id: string): Promise<GrpcLoadTestProfile | undefined> {
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  const store = await loadStore();
  return store.profiles.find((profile) => profile.id === trimmed);
}

export async function saveGrpcLoadTestProfile(input: {
  name: string;
  config: GrpcLoadTestConfig;
  id?: string;
}): Promise<GrpcLoadTestProfile> {
  return withPersistLock(async () => {
    const store = await loadStore();
    const now = nowIso();
    const trimmedName = input.name.trim();
    const duplicate = store.profiles.find(
      (profile) => profile.name.localeCompare(trimmedName, undefined, { sensitivity: 'base' }) === 0
        && profile.id !== input.id,
    );
    if (duplicate) {
      throw new Error(`Profile name already exists: ${trimmedName}`);
    }
    const profile: GrpcLoadTestProfile = {
      id: input.id ?? crypto.randomUUID(),
      name: trimmedName,
      updatedAt: now,
      config: structuredClone(input.config),
    };
    validateProfile(profile);
    const index = store.profiles.findIndex((entry) => entry.id === profile.id);
    if (index >= 0) {
      store.profiles[index] = profile;
    } else {
      store.profiles.push(profile);
    }
    await saveStore(store);
    return profile;
  });
}

export async function renameGrpcLoadTestProfile(id: string, name: string): Promise<GrpcLoadTestProfile> {
  return withPersistLock(async () => {
    const store = await loadStore();
    const profile = store.profiles.find((entry) => entry.id === id);
    if (!profile) throw new Error(`Profile not found: ${id}`);
    const trimmedName = name.trim();
    const duplicate = store.profiles.find(
      (entry) => entry.id !== id
        && entry.name.localeCompare(trimmedName, undefined, { sensitivity: 'base' }) === 0,
    );
    if (duplicate) {
      throw new Error(`Profile name already exists: ${trimmedName}`);
    }
    const now = nowIso();
    const next: GrpcLoadTestProfile = {
      ...profile,
      name: trimmedName,
      updatedAt: now,
    };
    validateProfile(next);
    const index = store.profiles.findIndex((entry) => entry.id === id);
    store.profiles[index] = next;
    await saveStore(store);
    return next;
  });
}

export async function deleteGrpcLoadTestProfile(id: string): Promise<void> {
  return withPersistLock(async () => {
    const store = await loadStore();
    store.profiles = store.profiles.filter((profile) => profile.id !== id);
    await saveStore(store);
  });
}

/** Test-only: reset persist queue between tests. */
export function resetGrpcLoadTestProfilesPersistQueueForTests(): void {
  persistQueue = Promise.resolve();
}
