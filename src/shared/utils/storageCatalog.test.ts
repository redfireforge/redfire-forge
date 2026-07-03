/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CatalogEntry, SavedEndpointValues } from '../../features/catalog/types/catalog';

const { isTauriMock, tauriStoreMap, tauriGetItem, tauriSetItem, catalogStore } = vi.hoisted(() => {
  const tauriStoreMap = new Map<string, string>();
  return {
    isTauriMock: vi.fn(() => false),
    tauriStoreMap,
    tauriGetItem: vi.fn(async (key: string) => tauriStoreMap.get(key) ?? null),
    tauriSetItem: vi.fn(async (key: string, value: string) => {
      if (value === '') tauriStoreMap.delete(key);
      else tauriStoreMap.set(key, value);
    }),
    catalogStore: {
    entries: null as CatalogEntry[] | null,
    rawSpecs: {} as Record<string, string>,
    endpointValues: {} as Record<string, Record<string, SavedEndpointValues>>,
    throwOnSaveEntries: false,
    throwOnLoadEntries: false,
    throwOnSaveRawSpec: false,
    throwOnLoadRawSpec: false,
    throwOnSaveEndpointValues: false,
    throwOnLoadEndpointValues: false,
    throwOnMigrateEntries: false,
    throwOnMigrateRawSpecs: false,
    throwOnMigrateEndpointValues: false,
    },
  };
});

vi.mock('./platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('./tauriStore', () => ({
  getItem: (key: string) => tauriGetItem(key),
  setItem: (key: string, value: string) => tauriSetItem(key, value),
  getUsageBytes: vi.fn(async () => ({ usedBytes: 0, entries: {} })),
}));

vi.mock('./idbCatalog', () => ({
  idbLoadCatalogEntries: vi.fn(async () => {
    if (catalogStore.throwOnLoadEntries) throw new Error('idb load entries fail');
    return catalogStore.entries;
  }),
  idbSaveCatalogEntries: vi.fn(async (entries: CatalogEntry[]) => {
    if (catalogStore.throwOnSaveEntries) throw new Error('idb save entries fail');
    catalogStore.entries = entries;
  }),
  idbMigrateCatalogEntries: vi.fn(async () => {
    if (catalogStore.throwOnMigrateEntries) throw new Error('idb migrate entries fail');
    return true;
  }),
  idbLoadCatalogRawSpec: vi.fn(async (entryId: string, versionId: string) => {
    if (catalogStore.throwOnLoadRawSpec) throw new Error('idb load raw spec fail');
    return catalogStore.rawSpecs[`${entryId}-${versionId}`] ?? null;
  }),
  idbSaveCatalogRawSpec: vi.fn(async (entryId: string, versionId: string, raw: string) => {
    if (catalogStore.throwOnSaveRawSpec) throw new Error('idb save raw spec fail');
    catalogStore.rawSpecs[`${entryId}-${versionId}`] = raw;
  }),
  idbRemoveCatalogRawSpec: vi.fn(async (entryId: string, versionId: string) => {
    delete catalogStore.rawSpecs[`${entryId}-${versionId}`];
  }),
  idbRemoveAllCatalogRawSpecs: vi.fn(async (entryId: string, versionIds: string[]) => {
    for (const vid of versionIds) delete catalogStore.rawSpecs[`${entryId}-${vid}`];
  }),
  idbMigrateCatalogRawSpecs: vi.fn(async () => {
    if (catalogStore.throwOnMigrateRawSpecs) throw new Error('idb migrate raw specs fail');
    return 1;
  }),
  idbLoadCatalogEndpointValues: vi.fn(async (entryId: string) => {
    if (catalogStore.throwOnLoadEndpointValues) throw new Error('idb load endpoint values fail');
    return catalogStore.endpointValues[entryId] ?? null;
  }),
  idbSaveCatalogEndpointValues: vi.fn(async (entryId: string, values: Record<string, SavedEndpointValues>) => {
    if (catalogStore.throwOnSaveEndpointValues) throw new Error('idb save endpoint values fail');
    catalogStore.endpointValues[entryId] = values;
  }),
  idbRemoveCatalogEndpointValues: vi.fn(async (entryId: string) => {
    delete catalogStore.endpointValues[entryId];
  }),
  idbMigrateCatalogEndpointValues: vi.fn(async () => {
    if (catalogStore.throwOnMigrateEndpointValues) throw new Error('idb migrate endpoint values fail');
    return 1;
  }),
}));

import {
  CATALOG_KEY,
  CATALOG_SPEC_PREFIX,
  CATALOG_EP_VALUES_PREFIX,
  loadCatalogEntries,
  saveCatalogEntries,
  loadCatalogRawSpec,
  saveCatalogRawSpec,
  removeCatalogRawSpec,
  removeAllCatalogRawSpecs,
  loadCatalogEndpointValues,
  saveCatalogEndpointValues,
  removeCatalogEndpointValues,
  migrateCatalogKeysToIdb,
} from './storageCatalog';
import {
  idbLoadCatalogEntries,
  idbSaveCatalogEntries,
  idbMigrateCatalogEntries,
  idbSaveCatalogRawSpec,
  idbRemoveCatalogRawSpec,
  idbRemoveAllCatalogRawSpecs,
  idbMigrateCatalogRawSpecs,
  idbSaveCatalogEndpointValues,
  idbRemoveCatalogEndpointValues,
  idbMigrateCatalogEndpointValues,
} from './idbCatalog';

function makeEntry(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    currentVersionId: 'v1',
    versions: [],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
    hostConfig: { mode: 'direct', baseUrl: 'https://api.example.com' },
    authConfig: { mode: 'none' },
  } as unknown as CatalogEntry;
}

function resetCatalogStore() {
  catalogStore.entries = null;
  catalogStore.rawSpecs = {};
  catalogStore.endpointValues = {};
  catalogStore.throwOnSaveEntries = false;
  catalogStore.throwOnLoadEntries = false;
  catalogStore.throwOnSaveRawSpec = false;
  catalogStore.throwOnLoadRawSpec = false;
  catalogStore.throwOnSaveEndpointValues = false;
  catalogStore.throwOnLoadEndpointValues = false;
  catalogStore.throwOnMigrateEntries = false;
  catalogStore.throwOnMigrateRawSpecs = false;
  catalogStore.throwOnMigrateEndpointValues = false;
}

describe('storageCatalog — browser (IDB primary)', () => {
  beforeEach(() => {
    localStorage.clear();
    isTauriMock.mockReturnValue(false);
    resetCatalogStore();
    vi.clearAllMocks();
  });

  describe('loadCatalogEntries / saveCatalogEntries', () => {
    it('returns empty array when nothing stored', async () => {
      expect(await loadCatalogEntries()).toEqual([]);
    });

    it('round-trips entries through IDB', async () => {
      const entries = [makeEntry('c1', 'API One')];
      await saveCatalogEntries(entries);
      expect(catalogStore.entries).toEqual(entries);
      expect(await loadCatalogEntries()).toEqual(entries);
    });

    it('removes legacy localStorage key after IDB save', async () => {
      localStorage.setItem(CATALOG_KEY, JSON.stringify([makeEntry('legacy', 'Legacy')]));
      await saveCatalogEntries([makeEntry('c1', 'Fresh')]);
      expect(localStorage.getItem(CATALOG_KEY)).toBeNull();
    });

    it('does not write to localStorage when IDB save fails on web', async () => {
      catalogStore.throwOnSaveEntries = true;
      const entries = [makeEntry('c1', 'Fallback')];
      await saveCatalogEntries(entries);
      expect(localStorage.getItem(CATALOG_KEY)).toBeNull();
      expect(catalogStore.entries).toBeNull();
    });

    it('loads from localStorage and migrates when IDB is empty', async () => {
      const entries = [makeEntry('c1', 'Migrated')];
      localStorage.setItem(CATALOG_KEY, JSON.stringify(entries));
      const loaded = await loadCatalogEntries();
      expect(loaded).toEqual(entries);
      expect(idbMigrateCatalogEntries).toHaveBeenCalledWith(CATALOG_KEY);
    });

    it('does not migrate when localStorage catalog is empty array', async () => {
      localStorage.setItem(CATALOG_KEY, JSON.stringify([]));
      expect(await loadCatalogEntries()).toEqual([]);
      expect(idbMigrateCatalogEntries).not.toHaveBeenCalled();
    });

    it('returns empty array when IDB load throws', async () => {
      catalogStore.throwOnLoadEntries = true;
      expect(await loadCatalogEntries()).toEqual([]);
    });

    it('returns empty array when localStorage catalog JSON is invalid during migration fallback', async () => {
      catalogStore.throwOnLoadEntries = true;
      localStorage.setItem(CATALOG_KEY, '{bad-json');
      expect(await loadCatalogEntries()).toEqual([]);
    });

    it('prefers IDB over localStorage', async () => {
      catalogStore.entries = [makeEntry('idb', 'From IDB')];
      localStorage.setItem(CATALOG_KEY, JSON.stringify([makeEntry('ls', 'From LS')]));
      const loaded = await loadCatalogEntries();
      expect(loaded[0].id).toBe('idb');
    });
  });

  describe('loadCatalogRawSpec / saveCatalogRawSpec', () => {
    it('returns null when no spec stored', async () => {
      expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
    });

    it('round-trips raw spec through IDB', async () => {
      await saveCatalogRawSpec('c1', 'v1', '{"openapi":"3.0"}');
      expect(await loadCatalogRawSpec('c1', 'v1')).toBe('{"openapi":"3.0"}');
    });

    it('removes legacy localStorage key after IDB save', async () => {
      const lsKey = `${CATALOG_SPEC_PREFIX}c1-v1`;
      localStorage.setItem(lsKey, 'old-spec');
      await saveCatalogRawSpec('c1', 'v1', 'new-spec');
      expect(localStorage.getItem(lsKey)).toBeNull();
    });

    it('falls back to localStorage when IDB save fails', async () => {
      catalogStore.throwOnSaveRawSpec = true;
      await saveCatalogRawSpec('c1', 'v1', 'fallback-spec');
      expect(localStorage.getItem(`${CATALOG_SPEC_PREFIX}c1-v1`)).toBe('fallback-spec');
    });

    it('migrates spec from localStorage to IDB on load', async () => {
      const lsKey = `${CATALOG_SPEC_PREFIX}c1-v1`;
      localStorage.setItem(lsKey, 'migrated-spec');
      const spec = await loadCatalogRawSpec('c1', 'v1');
      expect(spec).toBe('migrated-spec');
      expect(catalogStore.rawSpecs['c1-v1']).toBe('migrated-spec');
      expect(localStorage.getItem(lsKey)).toBeNull();
      expect(idbSaveCatalogRawSpec).toHaveBeenCalledWith('c1', 'v1', 'migrated-spec');
    });

    it('returns null when IDB load throws', async () => {
      catalogStore.throwOnLoadRawSpec = true;
      expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
    });

    it('returns null when localStorage raw spec key exists but is empty string', async () => {
      localStorage.setItem(`${CATALOG_SPEC_PREFIX}c1-v1`, '');
      expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
    });
  });

  describe('removeCatalogRawSpec / removeAllCatalogRawSpecs', () => {
    it('removes a single raw spec from IDB and localStorage', async () => {
      await saveCatalogRawSpec('c1', 'v1', 'spec-data');
      localStorage.setItem(`${CATALOG_SPEC_PREFIX}c1-v1`, 'spec-data');
      await removeCatalogRawSpec('c1', 'v1');
      expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
      expect(localStorage.getItem(`${CATALOG_SPEC_PREFIX}c1-v1`)).toBeNull();
      expect(idbRemoveCatalogRawSpec).toHaveBeenCalledWith('c1', 'v1');
    });

    it('removes all raw specs for an entry', async () => {
      await saveCatalogRawSpec('c1', 'v1', 'spec1');
      await saveCatalogRawSpec('c1', 'v2', 'spec2');
      await removeAllCatalogRawSpecs('c1', ['v1', 'v2']);
      expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
      expect(await loadCatalogRawSpec('c1', 'v2')).toBeNull();
      expect(idbRemoveAllCatalogRawSpecs).toHaveBeenCalledWith('c1', ['v1', 'v2']);
    });
  });

  describe('loadCatalogEndpointValues / saveCatalogEndpointValues', () => {
    it('returns empty object when nothing stored', async () => {
      expect(await loadCatalogEndpointValues('c1')).toEqual({});
    });

    it('round-trips endpoint values through IDB', async () => {
      const values = {
        ep1: { params: { id: '123' }, headers: { 'X-Test': '1' }, body: '{}' },
      };
      await saveCatalogEndpointValues('c1', values);
      expect(await loadCatalogEndpointValues('c1')).toEqual(values);
    });

    it('removes legacy localStorage key after IDB save', async () => {
      const lsKey = `${CATALOG_EP_VALUES_PREFIX}c1`;
      localStorage.setItem(lsKey, JSON.stringify({ ep1: { params: {}, headers: {}, body: '' } }));
      await saveCatalogEndpointValues('c1', { ep1: { params: {}, headers: {}, body: 'x' } });
      expect(localStorage.getItem(lsKey)).toBeNull();
    });

    it('falls back to localStorage when IDB save fails', async () => {
      catalogStore.throwOnSaveEndpointValues = true;
      const values = { ep1: { params: {}, headers: {}, body: 'fb' } };
      await saveCatalogEndpointValues('c1', values);
      expect(JSON.parse(localStorage.getItem(`${CATALOG_EP_VALUES_PREFIX}c1`)!)).toEqual(values);
    });

    it('migrates endpoint values from localStorage on load', async () => {
      const values = { ep1: { params: { q: '1' }, headers: {}, body: '' } };
      localStorage.setItem(`${CATALOG_EP_VALUES_PREFIX}c1`, JSON.stringify(values));
      const loaded = await loadCatalogEndpointValues('c1');
      expect(loaded).toEqual(values);
      expect(localStorage.getItem(`${CATALOG_EP_VALUES_PREFIX}c1`)).toBeNull();
      expect(idbSaveCatalogEndpointValues).toHaveBeenCalledWith('c1', values);
    });

    it('returns empty object when IDB load throws', async () => {
      catalogStore.throwOnLoadEndpointValues = true;
      expect(await loadCatalogEndpointValues('c1')).toEqual({});
    });

    it('returns empty object when legacy endpoint values JSON is invalid', async () => {
      catalogStore.throwOnLoadEndpointValues = true;
      localStorage.setItem(`${CATALOG_EP_VALUES_PREFIX}c1`, '{bad-json');
      expect(await loadCatalogEndpointValues('c1')).toEqual({});
    });
  });

  describe('removeCatalogEndpointValues', () => {
    it('removes endpoint values from IDB and localStorage', async () => {
      await saveCatalogEndpointValues('c1', { ep1: { params: {}, headers: {}, body: '' } });
      localStorage.setItem(`${CATALOG_EP_VALUES_PREFIX}c1`, '{}');
      await removeCatalogEndpointValues('c1');
      expect(await loadCatalogEndpointValues('c1')).toEqual({});
      expect(localStorage.getItem(`${CATALOG_EP_VALUES_PREFIX}c1`)).toBeNull();
      expect(idbRemoveCatalogEndpointValues).toHaveBeenCalledWith('c1');
    });
  });

  describe('migrateCatalogKeysToIdb', () => {
    it('skips entry migration when localStorage catalog key is absent', async () => {
      await migrateCatalogKeysToIdb();
      expect(idbMigrateCatalogEntries).not.toHaveBeenCalled();
      expect(idbMigrateCatalogRawSpecs).toHaveBeenCalled();
      expect(idbMigrateCatalogEndpointValues).toHaveBeenCalled();
    });
  });

  describe('migrateCatalogKeysToIdb', () => {
    it('migrates catalog entries when localStorage key exists', async () => {
      localStorage.setItem(CATALOG_KEY, JSON.stringify([makeEntry('c1', 'X')]));
      await migrateCatalogKeysToIdb();
      expect(idbMigrateCatalogEntries).toHaveBeenCalledWith(CATALOG_KEY);
      expect(idbMigrateCatalogRawSpecs).toHaveBeenCalledWith(CATALOG_SPEC_PREFIX);
      expect(idbMigrateCatalogEndpointValues).toHaveBeenCalledWith(CATALOG_EP_VALUES_PREFIX);
    });

    it('skips entry migration when catalog key absent but still migrates specs and values', async () => {
      await migrateCatalogKeysToIdb();
      expect(idbMigrateCatalogEntries).not.toHaveBeenCalled();
      expect(idbMigrateCatalogRawSpecs).toHaveBeenCalledWith(CATALOG_SPEC_PREFIX);
      expect(idbMigrateCatalogEndpointValues).toHaveBeenCalledWith(CATALOG_EP_VALUES_PREFIX);
    });

    it('ignores migration errors', async () => {
      localStorage.setItem(CATALOG_KEY, '[]');
      catalogStore.throwOnMigrateEntries = true;
      catalogStore.throwOnMigrateRawSpecs = true;
      catalogStore.throwOnMigrateEndpointValues = true;
      await expect(migrateCatalogKeysToIdb()).resolves.toBeUndefined();
    });
  });
});

describe('storageCatalog — tauri backend', () => {
  beforeEach(() => {
    localStorage.clear();
    tauriStoreMap.clear();
    isTauriMock.mockReturnValue(true);
    resetCatalogStore();
    tauriGetItem.mockImplementation(async (key: string) => tauriStoreMap.get(key) ?? null);
    tauriSetItem.mockImplementation(async (key: string, value: string) => {
      if (value === '') tauriStoreMap.delete(key);
      else tauriStoreMap.set(key, value);
    });
    vi.clearAllMocks();
  });

  it('loadCatalogEntries reads via tauriStore', async () => {
    tauriStoreMap.set(CATALOG_KEY, JSON.stringify([makeEntry('t1', 'Tauri API')]));
    const loaded = await loadCatalogEntries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Tauri API');
    expect(idbLoadCatalogEntries).not.toHaveBeenCalled();
  });

  it('loadCatalogEntries returns empty array on parse error', async () => {
    tauriStoreMap.set(CATALOG_KEY, 'not-json');
    expect(await loadCatalogEntries()).toEqual([]);
  });

  it('loadCatalogEntries returns empty array when tauriStore read fails', async () => {
    tauriGetItem.mockRejectedValueOnce(new Error('read fail'));
    expect(await loadCatalogEntries()).toEqual([]);
  });

  it('saveCatalogEntries writes via tauriStore', async () => {
    const entries = [makeEntry('t1', 'Saved')];
    await saveCatalogEntries(entries);
    expect(JSON.parse(tauriStoreMap.get(CATALOG_KEY)!)).toEqual(entries);
    expect(idbSaveCatalogEntries).not.toHaveBeenCalled();
  });

  it('loadCatalogRawSpec returns stored spec or null', async () => {
    expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
    tauriStoreMap.set(`${CATALOG_SPEC_PREFIX}c1-v1`, 'raw-yaml');
    expect(await loadCatalogRawSpec('c1', 'v1')).toBe('raw-yaml');
  });

  it('loadCatalogRawSpec returns null when tauriStore read fails', async () => {
    tauriGetItem.mockRejectedValueOnce(new Error('read fail'));
    expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
  });

  it('saveCatalogRawSpec writes via tauriStore', async () => {
    await saveCatalogRawSpec('c1', 'v1', 'spec-body');
    expect(tauriStoreMap.get(`${CATALOG_SPEC_PREFIX}c1-v1`)).toBe('spec-body');
  });

  it('removeCatalogRawSpec clears tauriStore key', async () => {
    tauriStoreMap.set(`${CATALOG_SPEC_PREFIX}c1-v1`, 'x');
    await removeCatalogRawSpec('c1', 'v1');
    expect(tauriStoreMap.has(`${CATALOG_SPEC_PREFIX}c1-v1`)).toBe(false);
    expect(tauriSetItem).toHaveBeenCalledWith(`${CATALOG_SPEC_PREFIX}c1-v1`, '');
  });

  it('removeAllCatalogRawSpecs clears multiple tauriStore keys', async () => {
    tauriStoreMap.set(`${CATALOG_SPEC_PREFIX}c1-v1`, 'a');
    tauriStoreMap.set(`${CATALOG_SPEC_PREFIX}c1-v2`, 'b');
    await removeAllCatalogRawSpecs('c1', ['v1', 'v2']);
    expect(tauriStoreMap.has(`${CATALOG_SPEC_PREFIX}c1-v1`)).toBe(false);
    expect(tauriStoreMap.has(`${CATALOG_SPEC_PREFIX}c1-v2`)).toBe(false);
  });

  it('loadCatalogEndpointValues reads JSON from tauriStore', async () => {
    const values = { ep1: { params: { a: '1' }, headers: {}, body: '' } };
    tauriStoreMap.set(`${CATALOG_EP_VALUES_PREFIX}c1`, JSON.stringify(values));
    expect(await loadCatalogEndpointValues('c1')).toEqual(values);
  });

  it('loadCatalogEndpointValues returns {} on error', async () => {
    tauriStoreMap.set(`${CATALOG_EP_VALUES_PREFIX}c1`, '{bad');
    expect(await loadCatalogEndpointValues('c1')).toEqual({});
  });

  it('saveCatalogEndpointValues writes JSON via tauriStore', async () => {
    const values = { ep1: { params: {}, headers: {}, body: 'b' } };
    await saveCatalogEndpointValues('c1', values);
    expect(JSON.parse(tauriStoreMap.get(`${CATALOG_EP_VALUES_PREFIX}c1`)!)).toEqual(values);
  });

  it('removeCatalogEndpointValues clears tauriStore key', async () => {
    tauriStoreMap.set(`${CATALOG_EP_VALUES_PREFIX}c1`, '{}');
    await removeCatalogEndpointValues('c1');
    expect(tauriStoreMap.has(`${CATALOG_EP_VALUES_PREFIX}c1`)).toBe(false);
  });
});
