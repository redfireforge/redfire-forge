/**
 * IndexedDB persistence for GraphQL Studio blobs (browser only).
 * Keeps tabs, environments, profiles, page auth, and schema cache off localStorage.
 */

import { isTauri } from './platform';
import { createIdbBlobStore, getObjectStore, idbAvailable, wrap } from './idbHelpers';

export const GQL_SCHEMA_CACHE_PREFIX = 'gql_schema_v1_';

export interface GqlTabsPersistedBlob {
  tabs: unknown[];
  activeId: string;
}

const tabsBlobStore = createIdbBlobStore<GqlTabsPersistedBlob>(
  'gqlStudioTabs',
  (d) =>
    d !== null &&
    typeof d === 'object' &&
    Array.isArray((d as GqlTabsPersistedBlob).tabs),
);

const pageAuthStore = createIdbBlobStore<string>(
  'gqlPageAuth',
  (d) => typeof d === 'string',
);

const studioEnvironmentsStore = createIdbBlobStore<unknown[]>(
  'gqlStudioEnvironments',
  (d) => Array.isArray(d),
);

const connectionProfilesStore = createIdbBlobStore<unknown[]>(
  'gqlConnectionProfiles',
  (d) => Array.isArray(d),
);

export const idbLoadTabsPersisted = tabsBlobStore.load;
export async function idbSaveTabsPersisted(tabs: unknown[], activeId: string): Promise<void> {
  await tabsBlobStore.save({ tabs, activeId });
}

export async function idbMigrateTabsFromLocalStorage(
  tabsKey: string,
  activeKey: string,
): Promise<boolean> {
  if (!idbAvailable()) return false;
  try {
    const raw = localStorage.getItem(tabsKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return false;
    const activeId = localStorage.getItem(activeKey) ?? '';
    await idbSaveTabsPersisted(parsed, activeId);
    localStorage.removeItem(tabsKey);
    localStorage.removeItem(activeKey);
    return true;
  } catch {
    return false;
  }
}

export const idbLoadPageAuthRaw = pageAuthStore.load;
export const idbSavePageAuthRaw = pageAuthStore.save;
export const idbMigratePageAuthFromLocalStorage = pageAuthStore.migrate;

export async function idbClearPageAuthRaw(): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const store = await getObjectStore('gqlPageAuth', 'readwrite');
    await wrap(store.delete('all'));
  } catch { /* ignore */ }
}

export const idbLoadStudioEnvironments = studioEnvironmentsStore.load;
export const idbSaveStudioEnvironments = studioEnvironmentsStore.save;
export const idbMigrateStudioEnvironmentsFromLocalStorage = studioEnvironmentsStore.migrate;

export const idbLoadConnectionProfiles = connectionProfilesStore.load;
export const idbSaveConnectionProfiles = connectionProfilesStore.save;
export const idbMigrateConnectionProfilesFromLocalStorage = connectionProfilesStore.migrate;

export async function idbGetSchemaCacheRaw(key: string): Promise<string | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await getObjectStore('gqlSchemaCache', 'readonly');
    const raw = await wrap(store.get(key));
    return typeof raw === 'string' ? raw : null;
  } catch {
    return null;
  }
}

export async function idbSetSchemaCacheRaw(key: string, raw: string): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const store = await getObjectStore('gqlSchemaCache', 'readwrite');
  await wrap(store.put(raw, key));
}

/** Move all gql_schema_v1_* entries from localStorage into IDB. */
export async function idbMigrateSchemaCacheFromLocalStorage(): Promise<number> {
  if (!idbAvailable()) return 0;
  let moved = 0;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(GQL_SCHEMA_CACHE_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      await idbSetSchemaCacheRaw(key, raw);
      localStorage.removeItem(key);
      moved++;
    } catch { /* ignore single key */ }
  }
  return moved;
}

/** Migrate all GraphQL Studio localStorage blobs to IndexedDB (web only). */
export async function migrateGraphqlStudioFromLocalStorage(keys: {
  tabsKey: string;
  tabsActiveKey: string;
  authKey: string;
  environmentsKey: string;
  profilesKey: string;
}): Promise<{
  tabs: boolean;
  auth: boolean;
  environments: boolean;
  profiles: boolean;
  schemaEntries: number;
}> {
  if (isTauri()) {
    return { tabs: false, auth: false, environments: false, profiles: false, schemaEntries: 0 };
  }
  const [tabs, auth, environments, profiles, schemaEntries] = await Promise.all([
    idbMigrateTabsFromLocalStorage(keys.tabsKey, keys.tabsActiveKey),
    idbMigratePageAuthFromLocalStorage(keys.authKey),
    idbMigrateStudioEnvironmentsFromLocalStorage(keys.environmentsKey),
    idbMigrateConnectionProfilesFromLocalStorage(keys.profilesKey),
    idbMigrateSchemaCacheFromLocalStorage(),
  ]);
  return { tabs, auth, environments, profiles, schemaEntries };
}

/** Drop localStorage copies when IDB already holds studio data. */
export async function purgeGraphqlStudioLocalStorageDuplicates(keys: {
  tabsKey: string;
  tabsActiveKey: string;
  authKey: string;
  environmentsKey: string;
  profilesKey: string;
}): Promise<number> {
  if (isTauri()) return 0;
  let removed = 0;
  const checks: Array<{ lsKey: string; hasIdb: () => Promise<boolean> }> = [
    {
      lsKey: keys.tabsKey,
      hasIdb: async () => (await idbLoadTabsPersisted()) !== null,
    },
    {
      lsKey: keys.authKey,
      hasIdb: async () => (await idbLoadPageAuthRaw()) !== null,
    },
    {
      lsKey: keys.environmentsKey,
      hasIdb: async () => (await idbLoadStudioEnvironments()) !== null,
    },
    {
      lsKey: keys.profilesKey,
      hasIdb: async () => (await idbLoadConnectionProfiles()) !== null,
    },
  ];
  for (const { lsKey, hasIdb } of checks) {
    try {
      if (!localStorage.getItem(lsKey)) continue;
      if (!(await hasIdb())) continue;
      localStorage.removeItem(lsKey);
      removed++;
    } catch { /* ignore */ }
  }
  if (localStorage.getItem(keys.tabsActiveKey) && (await idbLoadTabsPersisted())) {
    localStorage.removeItem(keys.tabsActiveKey);
    removed++;
  }
  removed += await idbMigrateSchemaCacheFromLocalStorage();
  return removed;
}
