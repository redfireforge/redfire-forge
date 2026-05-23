/**
 * IndexedDB storage backend for catalog entries + raw specs (browser only).
 * Entries stored as single blob under key "all".
 * Raw specs stored individually under key "spec:{entryId}-{versionId}".
 * Endpoint values stored individually under key "ep:{entryId}".
 */

import type { CatalogEntry, SavedEndpointValues } from '../../features/catalog/types/catalog';
import { createIdbBlobStore, idbAvailable, wrap, getObjectStore } from './idbHelpers';

const STORE_NAME = 'catalog';

// --- Catalog entries ---

const catalogEntriesStore = createIdbBlobStore<CatalogEntry[]>(
  STORE_NAME,
  (d) => Array.isArray(d) && d.length > 0,
);

export const idbLoadCatalogEntries = catalogEntriesStore.load;
export const idbSaveCatalogEntries = catalogEntriesStore.save;
export const idbMigrateCatalogEntries = catalogEntriesStore.migrate;

// --- Raw specs ---

function specKey(entryId: string, versionId: string): string {
  return `spec:${entryId}-${versionId}`;
}

export async function idbLoadCatalogRawSpec(entryId: string, versionId: string): Promise<string | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await getObjectStore(STORE_NAME,'readonly');
    const data = await wrap(store.get(specKey(entryId, versionId)));
    if (!data) return null;
    return data as string;
  } catch {
    return null;
  }
}

export async function idbSaveCatalogRawSpec(entryId: string, versionId: string, rawSpec: string): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const store = await getObjectStore(STORE_NAME,'readwrite');
  await wrap(store.put(rawSpec, specKey(entryId, versionId)));
}

export async function idbRemoveCatalogRawSpec(entryId: string, versionId: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const store = await getObjectStore(STORE_NAME,'readwrite');
    await wrap(store.delete(specKey(entryId, versionId)));
  } catch { /* ignore */ }
}

export async function idbRemoveAllCatalogRawSpecs(entryId: string, versionIds: string[]): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const store = await getObjectStore(STORE_NAME,'readwrite');
    await Promise.all(versionIds.map(vid => wrap(store.delete(specKey(entryId, vid)))));
  } catch { /* ignore */ }
}

/**
 * Migrate all catalog raw specs from localStorage to IDB.
 * Scans for keys matching the prefix and moves them.
 */
export async function idbMigrateCatalogRawSpecs(lsPrefix: string): Promise<number> {
  if (!idbAvailable()) return 0;
  let migrated = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(lsPrefix)) continue;
      const suffix = key.slice(lsPrefix.length);
      const dashIdx = suffix.indexOf('-');
      if (dashIdx < 0) continue;
      const entryId = suffix.slice(0, dashIdx);
      const versionId = suffix.slice(dashIdx + 1);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      await idbSaveCatalogRawSpec(entryId, versionId, raw);
      keysToRemove.push(key);
      migrated++;
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch { /* partial migration is fine */ }
  return migrated;
}

// --- Endpoint values ---

function epKey(entryId: string): string {
  return `ep:${entryId}`;
}

export async function idbLoadCatalogEndpointValues(entryId: string): Promise<Record<string, SavedEndpointValues> | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await getObjectStore(STORE_NAME,'readonly');
    const data = await wrap(store.get(epKey(entryId)));
    if (!data) return null;
    return data as Record<string, SavedEndpointValues>;
  } catch {
    return null;
  }
}

export async function idbSaveCatalogEndpointValues(entryId: string, values: Record<string, SavedEndpointValues>): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const store = await getObjectStore(STORE_NAME,'readwrite');
  await wrap(store.put(values, epKey(entryId)));
}

export async function idbRemoveCatalogEndpointValues(entryId: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const store = await getObjectStore(STORE_NAME,'readwrite');
    await wrap(store.delete(epKey(entryId)));
  } catch { /* ignore */ }
}

/**
 * Migrate catalog endpoint values from localStorage to IDB.
 */
export async function idbMigrateCatalogEndpointValues(lsPrefix: string): Promise<number> {
  if (!idbAvailable()) return 0;
  let migrated = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(lsPrefix)) continue;
      const entryId = key.slice(lsPrefix.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const values: Record<string, SavedEndpointValues> = JSON.parse(raw);
      await idbSaveCatalogEndpointValues(entryId, values);
      keysToRemove.push(key);
      migrated++;
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch { /* partial migration is fine */ }
  return migrated;
}
