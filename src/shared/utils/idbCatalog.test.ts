/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CatalogEntry, SavedEndpointValues } from '../../features/catalog/types/catalog';

import 'fake-indexeddb/auto';

const mockStore = new Map<string, unknown>();
let mockGetShouldError = false;
let mockPutShouldError = false;
let mockDeleteShouldError = false;
const mockPutCalls: Array<{ data: unknown; key: string }> = [];
const mockDeleteCalls: string[] = [];

vi.mock('./idbOpen', () => {
  const createRequest = <T>(result: T, shouldError: boolean): IDBRequest<T> => {
    return {
      result,
      error: shouldError ? new Error('IDB Error') : null,
      get onsuccess() { return null; },
      set onsuccess(fn: ((ev: Event) => void) | null) {
        if (fn && !shouldError) Promise.resolve().then(() => fn(new Event('success')));
      },
      get onerror() { return null; },
      set onerror(fn: ((ev: Event) => void) | null) {
        if (fn && shouldError) Promise.resolve().then(() => fn(new Event('error')));
      },
    } as unknown as IDBRequest<T>;
  };

  const mockObjectStore = {
    get: (key: string) => createRequest(mockStore.get(key), mockGetShouldError),
    put: (data: unknown, key: string) => {
      mockPutCalls.push({ data, key });
      if (!mockPutShouldError) mockStore.set(key, data);
      return createRequest(undefined, mockPutShouldError);
    },
    delete: (key: string) => {
      mockDeleteCalls.push(key);
      if (!mockDeleteShouldError) mockStore.delete(key);
      return createRequest(undefined, mockDeleteShouldError);
    },
  };
  const mockTransaction = {
    objectStore: () => mockObjectStore,
  };
  const mockDB = {
    transaction: () => mockTransaction,
  };
  return {
    openDB: vi.fn().mockResolvedValue(mockDB),
  };
});

import {
  idbLoadCatalogEntries,
  idbSaveCatalogEntries,
  idbMigrateCatalogEntries,
  idbLoadCatalogRawSpec,
  idbSaveCatalogRawSpec,
  idbRemoveCatalogRawSpec,
  idbRemoveAllCatalogRawSpecs,
  idbMigrateCatalogRawSpecs,
  idbLoadCatalogEndpointValues,
  idbSaveCatalogEndpointValues,
  idbRemoveCatalogEndpointValues,
  idbMigrateCatalogEndpointValues,
} from './idbCatalog';

function createMockCatalogEntry(id = 'cat-1'): CatalogEntry {
  return {
    id,
    name: 'Test Catalog',
    currentVersionId: 'v1',
    versions: [{
      id: 'v1',
      version: '1.0.0',
      importedAt: Date.now(),
      specHash: 'abc123',
      specSize: 100,
    }],
    servers: [],
    securitySchemes: {},
    folders: [],
    endpoints: [],
    hostConfig: { strategy: 'global' },
    authConfig: { strategy: 'global' },
  };
}

function createMockEndpointValues(): Record<string, SavedEndpointValues> {
  return {
    'ep-1': { params: { id: '42' }, headers: { 'X-Test': 'yes' }, body: '{}' },
  };
}

describe('idbCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockStore.clear();
    mockGetShouldError = false;
    mockPutShouldError = false;
    mockDeleteShouldError = false;
    mockPutCalls.length = 0;
    mockDeleteCalls.length = 0;
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('catalog entries', () => {
    describe('idbLoadCatalogEntries', () => {
      it('returns entries from IndexedDB when available', async () => {
        const entries = [createMockCatalogEntry()];
        mockStore.set('all', entries);

        expect(await idbLoadCatalogEntries()).toEqual(entries);
      });

      it('returns null when no data exists', async () => {
        expect(await idbLoadCatalogEntries()).toBeNull();
      });

      it('returns null on IDB error', async () => {
        mockGetShouldError = true;

        expect(await idbLoadCatalogEntries()).toBeNull();
      });

      it('returns null when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          expect(await idbLoadCatalogEntries()).toBeNull();
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });
    });

    describe('idbSaveCatalogEntries', () => {
      it('saves catalog entries to IndexedDB', async () => {
        const entries = [createMockCatalogEntry()];

        await idbSaveCatalogEntries(entries);

        expect(mockPutCalls).toEqual([{ data: entries, key: 'all' }]);
        expect(await idbLoadCatalogEntries()).toEqual(entries);
      });

      it('throws when put fails', async () => {
        mockPutShouldError = true;

        await expect(idbSaveCatalogEntries([createMockCatalogEntry()])).rejects.toThrow();
      });

      it('throws when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          await expect(idbSaveCatalogEntries([createMockCatalogEntry()])).rejects.toThrow('IndexedDB not available');
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });
    });

    describe('idbMigrateCatalogEntries', () => {
      it('migrates entries from localStorage to IndexedDB', async () => {
        const entries = [createMockCatalogEntry()];
        localStorage.setItem('rf-catalog', JSON.stringify(entries));

        const result = await idbMigrateCatalogEntries('rf-catalog');

        expect(result).toBe(true);
        expect(mockPutCalls[0]?.key).toBe('all');
        expect(localStorage.getItem('rf-catalog')).toBeNull();
        expect(await idbLoadCatalogEntries()).toEqual(entries);
      });

      it('returns false when localStorage key does not exist', async () => {
        expect(await idbMigrateCatalogEntries('missing')).toBe(false);
      });

      it('returns false for invalid JSON', async () => {
        localStorage.setItem('rf-catalog', 'bad');

        expect(await idbMigrateCatalogEntries('rf-catalog')).toBe(false);
      });

      it('returns false for empty array', async () => {
        localStorage.setItem('rf-catalog', '[]');

        expect(await idbMigrateCatalogEntries('rf-catalog')).toBe(false);
      });

      it('returns false when indexedDB is undefined', async () => {
        localStorage.setItem('rf-catalog', JSON.stringify([createMockCatalogEntry()]));
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          expect(await idbMigrateCatalogEntries('rf-catalog')).toBe(false);
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });
    });
  });

  describe('raw specs', () => {
    const entryId = 'entry-1';
    const versionId = 'v1';
    const specKey = `spec:${entryId}-${versionId}`;
    const rawSpec = '{"openapi":"3.0.0"}';

    describe('idbLoadCatalogRawSpec', () => {
      it('returns raw spec when stored', async () => {
        mockStore.set(specKey, rawSpec);

        expect(await idbLoadCatalogRawSpec(entryId, versionId)).toBe(rawSpec);
      });

      it('returns null when not found', async () => {
        expect(await idbLoadCatalogRawSpec(entryId, versionId)).toBeNull();
      });

      it('returns null on IDB error', async () => {
        mockGetShouldError = true;

        expect(await idbLoadCatalogRawSpec(entryId, versionId)).toBeNull();
      });

      it('returns null when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          expect(await idbLoadCatalogRawSpec(entryId, versionId)).toBeNull();
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });
    });

    describe('idbSaveCatalogRawSpec', () => {
      it('saves raw spec under spec key', async () => {
        await idbSaveCatalogRawSpec(entryId, versionId, rawSpec);

        expect(mockPutCalls[0]).toEqual({ data: rawSpec, key: specKey });
        expect(await idbLoadCatalogRawSpec(entryId, versionId)).toBe(rawSpec);
      });

      it('throws when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          await expect(idbSaveCatalogRawSpec(entryId, versionId, rawSpec)).rejects.toThrow('IndexedDB not available');
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });
    });

    describe('idbRemoveCatalogRawSpec', () => {
      it('removes a raw spec', async () => {
        mockStore.set(specKey, rawSpec);

        await idbRemoveCatalogRawSpec(entryId, versionId);

        expect(mockDeleteCalls).toContain(specKey);
        expect(mockStore.has(specKey)).toBe(false);
      });

      it('no-ops when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          await idbRemoveCatalogRawSpec(entryId, versionId);
          expect(mockDeleteCalls).toHaveLength(0);
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });

      it('ignores delete errors', async () => {
        mockDeleteShouldError = true;

        await expect(idbRemoveCatalogRawSpec(entryId, versionId)).resolves.toBeUndefined();
      });

      it('removes non-existent spec without error', async () => {
        await expect(idbRemoveCatalogRawSpec('missing', 'v9')).resolves.toBeUndefined();
      });
    });

    describe('idbRemoveAllCatalogRawSpecs', () => {
      it('removes all version specs for an entry', async () => {
        mockStore.set('spec:entry-1-v1', 'spec1');
        mockStore.set('spec:entry-1-v2', 'spec2');

        await idbRemoveAllCatalogRawSpecs('entry-1', ['v1', 'v2']);

        expect(mockDeleteCalls).toEqual(['spec:entry-1-v1', 'spec:entry-1-v2']);
        expect(mockStore.size).toBe(0);
      });

      it('no-ops when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          await idbRemoveAllCatalogRawSpecs('entry-1', ['v1']);
          expect(mockDeleteCalls).toHaveLength(0);
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });

      it('ignores delete errors', async () => {
        mockDeleteShouldError = true;

        await expect(idbRemoveAllCatalogRawSpecs('entry-1', ['v1'])).resolves.toBeUndefined();
      });
    });

    describe('idbMigrateCatalogRawSpecs', () => {
      const prefix = 'rf-catalog-spec-';

      it('migrates matching localStorage keys to IDB', async () => {
        localStorage.setItem(`${prefix}entry-1-v1`, rawSpec);
        localStorage.setItem(`${prefix}entry-2-v2`, '{"info":{}}');
        localStorage.setItem('other-key', 'ignored');
        localStorage.setItem(`${prefix}nodash`, 'skipped');

        const migrated = await idbMigrateCatalogRawSpecs(prefix);

        expect(migrated).toBe(2);
        expect(await idbLoadCatalogRawSpec('entry-1', 'v1')).toBe(rawSpec);
        expect(await idbLoadCatalogRawSpec('entry-2', 'v2')).toBe('{"info":{}}');
        expect(localStorage.getItem(`${prefix}entry-1-v1`)).toBeNull();
        expect(localStorage.getItem(`${prefix}entry-2-v2`)).toBeNull();
        expect(localStorage.getItem('other-key')).toBe('ignored');
        expect(localStorage.getItem(`${prefix}nodash`)).toBe('skipped');
      });

      it('returns 0 when no matching keys exist', async () => {
        expect(await idbMigrateCatalogRawSpecs(prefix)).toBe(0);
      });

      it('returns 0 when indexedDB is undefined', async () => {
        localStorage.setItem(`${prefix}entry-1-v1`, rawSpec);
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          expect(await idbMigrateCatalogRawSpecs(prefix)).toBe(0);
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });

      it('returns partial count when save fails mid-migration', async () => {
        localStorage.setItem(`${prefix}entry-1-v1`, rawSpec);
        mockPutShouldError = true;

        expect(await idbMigrateCatalogRawSpecs(prefix)).toBe(0);
      });
    });
  });

  describe('endpoint values', () => {
    const entryId = 'cat-ep-1';
    const epKey = `ep:${entryId}`;

    describe('idbLoadCatalogEndpointValues', () => {
      it('returns endpoint values when stored', async () => {
        const values = createMockEndpointValues();
        mockStore.set(epKey, values);

        expect(await idbLoadCatalogEndpointValues(entryId)).toEqual(values);
      });

      it('returns null when not found', async () => {
        expect(await idbLoadCatalogEndpointValues(entryId)).toBeNull();
      });

      it('returns null on IDB error', async () => {
        mockGetShouldError = true;

        expect(await idbLoadCatalogEndpointValues(entryId)).toBeNull();
      });
    });

    describe('idbSaveCatalogEndpointValues', () => {
      it('saves endpoint values under ep key', async () => {
        const values = createMockEndpointValues();

        await idbSaveCatalogEndpointValues(entryId, values);

        expect(mockPutCalls[0]).toEqual({ data: values, key: epKey });
        expect(await idbLoadCatalogEndpointValues(entryId)).toEqual(values);
      });

      it('throws when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          await expect(idbSaveCatalogEndpointValues(entryId, createMockEndpointValues())).rejects.toThrow('IndexedDB not available');
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });
    });

    describe('idbRemoveCatalogEndpointValues', () => {
      it('removes endpoint values', async () => {
        mockStore.set(epKey, createMockEndpointValues());

        await idbRemoveCatalogEndpointValues(entryId);

        expect(mockDeleteCalls).toContain(epKey);
        expect(mockStore.has(epKey)).toBe(false);
      });

      it('no-ops when indexedDB is undefined', async () => {
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          await idbRemoveCatalogEndpointValues(entryId);
          expect(mockDeleteCalls).toHaveLength(0);
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });

      it('ignores delete errors', async () => {
        mockDeleteShouldError = true;

        await expect(idbRemoveCatalogEndpointValues(entryId)).resolves.toBeUndefined();
      });

      it('removes non-existent values without error', async () => {
        await expect(idbRemoveCatalogEndpointValues('missing')).resolves.toBeUndefined();
      });
    });

    describe('idbMigrateCatalogEndpointValues', () => {
      const prefix = 'rf-catalog-ep-';

      it('migrates matching localStorage keys to IDB', async () => {
        const values = createMockEndpointValues();
        localStorage.setItem(`${prefix}${entryId}`, JSON.stringify(values));

        const migrated = await idbMigrateCatalogEndpointValues(prefix);

        expect(migrated).toBe(1);
        expect(await idbLoadCatalogEndpointValues(entryId)).toEqual(values);
        expect(localStorage.getItem(`${prefix}${entryId}`)).toBeNull();
      });

      it('returns 0 when no matching keys exist', async () => {
        expect(await idbMigrateCatalogEndpointValues(prefix)).toBe(0);
      });

      it('returns 0 when indexedDB is undefined', async () => {
        localStorage.setItem(`${prefix}${entryId}`, JSON.stringify(createMockEndpointValues()));
        const orig = globalThis.indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        try {
          expect(await idbMigrateCatalogEndpointValues(prefix)).toBe(0);
        } finally {
          Object.defineProperty(globalThis, 'indexedDB', { value: orig, configurable: true });
        }
      });

      it('returns partial count when JSON parse fails', async () => {
        localStorage.setItem(`${prefix}bad`, 'not-json');

        expect(await idbMigrateCatalogEndpointValues(prefix)).toBe(0);
      });
    });
  });
});
