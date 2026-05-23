import type { CatalogEntry, SavedEndpointValues } from '../../features/catalog/types/catalog';
import { isTauri } from './platform';
import {
  idbLoadCatalogEntries, idbSaveCatalogEntries, idbMigrateCatalogEntries,
  idbLoadCatalogRawSpec, idbSaveCatalogRawSpec, idbRemoveCatalogRawSpec, idbRemoveAllCatalogRawSpecs,
  idbMigrateCatalogRawSpecs,
  idbLoadCatalogEndpointValues, idbSaveCatalogEndpointValues, idbRemoveCatalogEndpointValues,
  idbMigrateCatalogEndpointValues,
} from './idbCatalog';
import { readKey, writeKey, removeKey } from './storage';
import { createDualModeArrayStorage } from './storageDualMode';

export const CATALOG_KEY = 'perf-test-catalog';
export const CATALOG_SPEC_PREFIX = 'perf-test-catalog-spec-';
export const CATALOG_EP_VALUES_PREFIX = 'perf-test-catalog-ep-';

const catalogEntriesStorage = createDualModeArrayStorage<CatalogEntry>({
  key: CATALOG_KEY,
  idbLoad: idbLoadCatalogEntries,
  idbSave: idbSaveCatalogEntries,
  idbMigrate: idbMigrateCatalogEntries,
});

export const loadCatalogEntries = catalogEntriesStorage.load;
export const saveCatalogEntries = catalogEntriesStorage.save;

export async function loadCatalogRawSpec(entryId: string, versionId: string): Promise<string | null> {
  if (isTauri()) {
    try {
      const raw = await readKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`);
      return raw || null;
    } catch { return null; }
  }
  try {
    const fromIdb = await idbLoadCatalogRawSpec(entryId, versionId);
    if (fromIdb !== null) return fromIdb;
    const raw = await readKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`);
    if (raw) {
      await idbSaveCatalogRawSpec(entryId, versionId, raw);
      localStorage.removeItem(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`);
      return raw;
    }
  } catch { /* ignore */ }
  return null;
}

export async function saveCatalogRawSpec(entryId: string, versionId: string, rawSpec: string): Promise<void> {
  if (isTauri()) {
    await writeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`, rawSpec);
    return;
  }
  try {
    await idbSaveCatalogRawSpec(entryId, versionId, rawSpec);
    const lsKey = `${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`;
    if (localStorage.getItem(lsKey)) localStorage.removeItem(lsKey);
  } catch {
    await writeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`, rawSpec);
  }
}

export async function removeCatalogRawSpec(entryId: string, versionId: string): Promise<void> {
  if (isTauri()) {
    await removeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`);
    return;
  }
  await idbRemoveCatalogRawSpec(entryId, versionId);
  await removeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`);
}

export async function removeAllCatalogRawSpecs(entryId: string, versionIds: string[]): Promise<void> {
  if (isTauri()) {
    await Promise.all(versionIds.map(vid => removeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${vid}`)));
    return;
  }
  await idbRemoveAllCatalogRawSpecs(entryId, versionIds);
  await Promise.all(versionIds.map(vid => removeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${vid}`)));
}

export async function loadCatalogEndpointValues(entryId: string): Promise<Record<string, SavedEndpointValues>> {
  if (isTauri()) {
    try {
      const raw = await readKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  }
  try {
    const fromIdb = await idbLoadCatalogEndpointValues(entryId);
    if (fromIdb !== null) return fromIdb;
    const raw = await readKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`);
    if (raw) {
      const values = JSON.parse(raw);
      await idbSaveCatalogEndpointValues(entryId, values);
      localStorage.removeItem(`${CATALOG_EP_VALUES_PREFIX}${entryId}`);
      return values;
    }
  } catch { /* ignore */ }
  return {};
}

export async function saveCatalogEndpointValues(entryId: string, values: Record<string, SavedEndpointValues>): Promise<void> {
  if (isTauri()) {
    await writeKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`, JSON.stringify(values));
    return;
  }
  try {
    await idbSaveCatalogEndpointValues(entryId, values);
    const lsKey = `${CATALOG_EP_VALUES_PREFIX}${entryId}`;
    if (localStorage.getItem(lsKey)) localStorage.removeItem(lsKey);
  } catch {
    await writeKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`, JSON.stringify(values));
  }
}

export async function removeCatalogEndpointValues(entryId: string): Promise<void> {
  if (isTauri()) {
    await removeKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`);
    return;
  }
  await idbRemoveCatalogEndpointValues(entryId);
  await removeKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`);
}

/** Migrate catalog localStorage keys to IndexedDB (browser only). */
export async function migrateCatalogKeysToIdb(): Promise<void> {
  if (localStorage.getItem(CATALOG_KEY)) {
    try { await idbMigrateCatalogEntries(CATALOG_KEY); } catch { /* ignore */ }
  }
  try { await idbMigrateCatalogRawSpecs(CATALOG_SPEC_PREFIX); } catch { /* ignore */ }
  try { await idbMigrateCatalogEndpointValues(CATALOG_EP_VALUES_PREFIX); } catch { /* ignore */ }
}
