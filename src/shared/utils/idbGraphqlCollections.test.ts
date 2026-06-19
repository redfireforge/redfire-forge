/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// ─── In-memory store state ─────────────────────────────────────────────────────

type StoreData = Map<string, unknown>;

const stores: Record<string, StoreData> = {
  'graphql-collections': new Map(),
  'graphql-collection-folders': new Map(),
  'graphql-collection-items': new Map(),
};

// ─── Mock idbHelpers ───────────────────────────────────────────────────────────

vi.mock('./idbHelpers', () => ({
  wrap: <T>(req: IDBRequest<T> | { _value: T }) => {
    // Our mock requests carry _value directly
    const r = req as { _value: T };
    return Promise.resolve(r._value as T);
  },
  txComplete: () => Promise.resolve(),
}));

// ─── Mock idbOpen ──────────────────────────────────────────────────────────────

vi.mock('./idbOpen', () => {
  const makeRequest = <T>(value: T) => ({ _value: value });

  const makeIndex = (storeName: string, indexField: string) => ({
    getAll: (range?: IDBKeyRange) => {
      const store = stores[storeName]!;
      const all = Array.from(store.values()) as Record<string, unknown>[];
      const filtered = range
        ? all.filter((item) => {
            const key = (item as Record<string, unknown>)[indexField];
            // IDBKeyRange.only(val) — check if key equals the bound
            const bound = (range as unknown as { lower: unknown }).lower;
            return key === bound;
          })
        : all;
      return makeRequest(filtered);
    },
    getAllKeys: (range?: IDBKeyRange) => {
      const store = stores[storeName]!;
      const all = Array.from(store.values()) as Record<string, unknown>[];
      const filtered = range
        ? all.filter((item) => {
            const key = (item as Record<string, unknown>)[indexField];
            const bound = (range as unknown as { lower: unknown }).lower;
            return key === bound;
          })
        : all;
      return makeRequest(filtered.map((item) => (item as Record<string, unknown>).id));
    },
  });

  const makeObjectStore = (storeName: string) => ({
    getAll: () => makeRequest(Array.from((stores[storeName] ?? new Map()).values())),
    get: (key: string) => makeRequest(stores[storeName]?.get(key)),
    put: (value: unknown) => {
      const id = (value as Record<string, unknown>).id as string;
      stores[storeName]?.set(id, value);
      return makeRequest(id);
    },
    delete: (key: string) => {
      stores[storeName]?.delete(key);
      return makeRequest(undefined);
    },
    clear: () => {
      stores[storeName]?.clear();
      return makeRequest(undefined);
    },
    index: (indexField: string) => makeIndex(storeName, indexField),
  });

  const mockDB = {
    transaction: (storeNames: string | string[]) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return {
        objectStore: (name: string) => {
          if (!names.includes(name)) throw new Error(`Store ${name} not in transaction`);
          return makeObjectStore(name);
        },
        oncomplete: null as ((e: Event) => void) | null,
      };
    },
  };

  return { openDB: vi.fn().mockResolvedValue(mockDB) };
});

// ─── Import SUT after mocks ────────────────────────────────────────────────────

import {
  idbLoadCollections,
  idbSaveCollection,
  idbDeleteCollection,
  idbLoadFolders,
  idbSaveFolder,
  idbDeleteFolder,
  idbLoadItems,
  idbSaveItem,
  idbDeleteItem,
  idbUpdateItemSortOrders,
  idbExportCollections,
  idbImportCollections,
  type CollectionExportData,
} from './idbGraphqlCollections';
import type { GraphqlCollection, GraphqlCollectionFolder, GraphqlCollectionItem } from '../types/graphql';

// ─── Test factories ────────────────────────────────────────────────────────────

function makeCollection(overrides: Partial<GraphqlCollection> = {}): GraphqlCollection {
  return {
    id: 'col-1',
    name: 'Test Collection',
    variables: {},
    preRequestScript: '',
    postResponseScript: '',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<GraphqlCollectionFolder> = {}): GraphqlCollectionFolder {
  return {
    id: 'folder-1',
    collectionId: 'col-1',
    name: 'Test Folder',
    parentId: undefined,
    sortOrder: 0,
    createdAt: 1000,
    ...overrides,
  };
}

function makeItem(overrides: Partial<GraphqlCollectionItem> = {}): GraphqlCollectionItem {
  return {
    id: 'item-1',
    collectionId: 'col-1',
    folderId: undefined,
    name: 'Test Item',
    sortOrder: 0,
    isPinned: false,
    tags: [],
    scripts: { preRequest: '', postResponse: '' },
    operation: { query: '{ hello }', variables: '', operationName: '' },
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeExportData(
  collections: Array<{ collection: GraphqlCollection; folders?: GraphqlCollectionFolder[]; items?: GraphqlCollectionItem[] }>,
): CollectionExportData {
  return {
    _exportMeta: { version: '1.1', exportedAt: '2024-01-01T00:00:00.000Z', source: 'RedfireForge/GraphQL' },
    collections: collections.map(({ collection, folders = [], items = [] }) => ({
      collection,
      folders,
      items,
    })),
  };
}

// ─── Reset stores before each test ────────────────────────────────────────────

beforeEach(() => {
  stores['graphql-collections']!.clear();
  stores['graphql-collection-folders']!.clear();
  stores['graphql-collection-items']!.clear();
});

// ─── Collections ──────────────────────────────────────────────────────────────

describe('idbLoadCollections', () => {
  it('returns empty array when no collections exist', async () => {
    const result = await idbLoadCollections();
    expect(result).toEqual([]);
  });

  it('returns all collections from the store', async () => {
    const col = makeCollection();
    stores['graphql-collections']!.set(col.id, col);
    const result = await idbLoadCollections();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(col);
  });
});

describe('idbSaveCollection', () => {
  it('writes the collection to the store', async () => {
    const col = makeCollection();
    await idbSaveCollection(col);
    expect(stores['graphql-collections']!.get('col-1')).toEqual(col);
  });

  it('overwrites an existing collection', async () => {
    const col = makeCollection({ name: 'Original' });
    stores['graphql-collections']!.set(col.id, col);
    const updated = makeCollection({ name: 'Updated' });
    await idbSaveCollection(updated);
    expect((stores['graphql-collections']!.get('col-1') as GraphqlCollection).name).toBe('Updated');
  });
});

describe('idbDeleteCollection', () => {
  it('removes the collection and cascades to folders and items', async () => {
    const col = makeCollection();
    const folder = makeFolder({ collectionId: 'col-1' });
    const item = makeItem({ collectionId: 'col-1' });
    stores['graphql-collections']!.set(col.id, col);
    stores['graphql-collection-folders']!.set(folder.id, folder);
    stores['graphql-collection-items']!.set(item.id, item);

    await idbDeleteCollection('col-1');

    expect(stores['graphql-collections']!.has('col-1')).toBe(false);
    expect(stores['graphql-collection-folders']!.has('folder-1')).toBe(false);
    expect(stores['graphql-collection-items']!.has('item-1')).toBe(false);
  });

  it('handles deletion of collection with no folders/items', async () => {
    const col = makeCollection();
    stores['graphql-collections']!.set(col.id, col);
    await expect(idbDeleteCollection('col-1')).resolves.not.toThrow();
    expect(stores['graphql-collections']!.has('col-1')).toBe(false);
  });
});

// ─── Folders ──────────────────────────────────────────────────────────────────

describe('idbLoadFolders', () => {
  it('returns folders for a collection sorted by sortOrder', async () => {
    const f1 = makeFolder({ id: 'f1', collectionId: 'col-1', sortOrder: 2 });
    const f2 = makeFolder({ id: 'f2', collectionId: 'col-1', sortOrder: 0 });
    const f3 = makeFolder({ id: 'f3', collectionId: 'col-2', sortOrder: 0 });
    stores['graphql-collection-folders']!.set('f1', f1);
    stores['graphql-collection-folders']!.set('f2', f2);
    stores['graphql-collection-folders']!.set('f3', f3);

    const result = await idbLoadFolders('col-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('f2');
    expect(result[1].id).toBe('f1');
  });

  it('returns empty array when collection has no folders', async () => {
    const result = await idbLoadFolders('unknown-col');
    expect(result).toEqual([]);
  });
});

describe('idbSaveFolder', () => {
  it('writes the folder to the store', async () => {
    const folder = makeFolder();
    await idbSaveFolder(folder);
    expect(stores['graphql-collection-folders']!.get('folder-1')).toEqual(folder);
  });
});

describe('idbDeleteFolder', () => {
  it('removes folder and cascades to items in that folder', async () => {
    const folder = makeFolder({ id: 'f-del' });
    const item = makeItem({ id: 'i-del', folderId: 'f-del' });
    const otherItem = makeItem({ id: 'i-other', folderId: undefined });
    stores['graphql-collection-folders']!.set('f-del', folder);
    stores['graphql-collection-items']!.set('i-del', item);
    stores['graphql-collection-items']!.set('i-other', otherItem);

    await idbDeleteFolder('f-del');

    expect(stores['graphql-collection-folders']!.has('f-del')).toBe(false);
    expect(stores['graphql-collection-items']!.has('i-del')).toBe(false);
    expect(stores['graphql-collection-items']!.has('i-other')).toBe(true);
  });
});

// ─── Items ────────────────────────────────────────────────────────────────────

describe('idbLoadItems', () => {
  it('returns items sorted by sortOrder', async () => {
    const i1 = makeItem({ id: 'i1', collectionId: 'col-1', sortOrder: 3 });
    const i2 = makeItem({ id: 'i2', collectionId: 'col-1', sortOrder: 1 });
    const i3 = makeItem({ id: 'i3', collectionId: 'col-2', sortOrder: 0 });
    stores['graphql-collection-items']!.set('i1', i1);
    stores['graphql-collection-items']!.set('i2', i2);
    stores['graphql-collection-items']!.set('i3', i3);

    const result = await idbLoadItems('col-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('i2');
    expect(result[1].id).toBe('i1');
  });
});

describe('idbSaveItem', () => {
  it('writes the item to the store when variables is empty', async () => {
    const item = makeItem({ operation: { query: '{ hello }', variables: '', operationName: '' } });
    await idbSaveItem(item);
    expect(stores['graphql-collection-items']!.has('item-1')).toBe(true);
  });

  it('accepts an item with valid JSON variables', async () => {
    const item = makeItem({ operation: { query: '{ q }', variables: '{"key": "val"}', operationName: '' } });
    await idbSaveItem(item);
    expect(stores['graphql-collection-items']!.has('item-1')).toBe(true);
  });

  it('accepts item with variables = {}', async () => {
    const item = makeItem({ operation: { query: '{ q }', variables: '{}', operationName: '' } });
    await idbSaveItem(item);
    expect(stores['graphql-collection-items']!.has('item-1')).toBe(true);
  });

  it('throws when variables is malformed JSON', async () => {
    const item = makeItem({ operation: { query: '{ q }', variables: 'not-json', operationName: '' } });
    await expect(idbSaveItem(item)).rejects.toThrow('Variables must be valid JSON');
  });
});

describe('idbDeleteItem', () => {
  it('removes the item from the store', async () => {
    const item = makeItem();
    stores['graphql-collection-items']!.set('item-1', item);
    await idbDeleteItem('item-1');
    expect(stores['graphql-collection-items']!.has('item-1')).toBe(false);
  });
});

describe('idbUpdateItemSortOrders', () => {
  it('is a no-op when updates is empty', async () => {
    await expect(idbUpdateItemSortOrders([])).resolves.not.toThrow();
  });

  it('updates sort orders for existing items', async () => {
    const i1 = makeItem({ id: 'sa', sortOrder: 0 });
    const i2 = makeItem({ id: 'sb', sortOrder: 1 });
    stores['graphql-collection-items']!.set('sa', i1);
    stores['graphql-collection-items']!.set('sb', i2);

    await idbUpdateItemSortOrders([{ id: 'sa', sortOrder: 5 }, { id: 'sb', sortOrder: 3 }]);

    expect((stores['graphql-collection-items']!.get('sa') as GraphqlCollectionItem).sortOrder).toBe(5);
    expect((stores['graphql-collection-items']!.get('sb') as GraphqlCollectionItem).sortOrder).toBe(3);
  });

  it('skips update for items not found in store (item is undefined)', async () => {
    await expect(idbUpdateItemSortOrders([{ id: 'nonexistent', sortOrder: 99 }])).resolves.not.toThrow();
  });
});

// ─── Export / Import ──────────────────────────────────────────────────────────

describe('idbExportCollections', () => {
  it('exports all collections with their folders and items', async () => {
    const col = makeCollection();
    const folder = makeFolder({ collectionId: 'col-1' });
    const item = makeItem({ collectionId: 'col-1' });
    stores['graphql-collections']!.set('col-1', col);
    stores['graphql-collection-folders']!.set('folder-1', folder);
    stores['graphql-collection-items']!.set('item-1', item);

    const result = await idbExportCollections();

    expect(result._exportMeta.version).toBe('1.1');
    expect(result._exportMeta.source).toBe('RedfireForge/GraphQL');
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]!.collection.id).toBe('col-1');
    expect(result.collections[0]!.folders).toHaveLength(1);
    expect(result.collections[0]!.items).toHaveLength(1);
  });

  it('exports only selected collection IDs when specified', async () => {
    const col1 = makeCollection({ id: 'col-1' });
    const col2 = makeCollection({ id: 'col-2', name: 'Second' });
    stores['graphql-collections']!.set('col-1', col1);
    stores['graphql-collections']!.set('col-2', col2);

    const result = await idbExportCollections(['col-1']);
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]!.collection.id).toBe('col-1');
  });

  it('exports empty collections when none exist', async () => {
    const result = await idbExportCollections();
    expect(result.collections).toHaveLength(0);
    expect(result._exportMeta.version).toBe('1.1');
  });
});

describe('idbImportCollections — replace mode', () => {
  it('clears all existing data and imports new collections', async () => {
    const existing = makeCollection({ id: 'existing-col' });
    stores['graphql-collections']!.set('existing-col', existing);

    const newCol = makeCollection({ id: 'new-col', name: 'New' });
    const data = makeExportData([{ collection: newCol }]);

    const conflicts = await idbImportCollections(data, 'replace');

    expect(conflicts).toEqual([]);
    expect(stores['graphql-collections']!.has('existing-col')).toBe(false);
    expect(stores['graphql-collections']!.has('new-col')).toBe(true);
  });

  it('imports collection with folders and items in replace mode', async () => {
    const col = makeCollection({ id: 'rc' });
    const folder = makeFolder({ id: 'rf', collectionId: 'rc' });
    const item = makeItem({ id: 'ri', collectionId: 'rc' });
    const data = makeExportData([{ collection: col, folders: [folder], items: [item] }]);

    await idbImportCollections(data, 'replace');

    expect(stores['graphql-collections']!.has('rc')).toBe(true);
    expect(stores['graphql-collection-folders']!.has('rf')).toBe(true);
    expect(stores['graphql-collection-items']!.has('ri')).toBe(true);
  });
});

describe('idbImportCollections — merge mode', () => {
  it('adds new collections without conflicts', async () => {
    const col = makeCollection({ id: 'new-mc' });
    const data = makeExportData([{ collection: col }]);

    const conflicts = await idbImportCollections(data, 'merge');

    expect(conflicts).toEqual([]);
    expect(stores['graphql-collections']!.has('new-mc')).toBe(true);
  });

  it('reports conflicts for existing collection IDs without resolution', async () => {
    const col = makeCollection({ id: 'conflict-col', name: 'Conflict' });
    stores['graphql-collections']!.set('conflict-col', col);

    const data = makeExportData([{ collection: col }]);
    const conflicts = await idbImportCollections(data, 'merge');

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.id).toBe('conflict-col');
    expect(conflicts[0]!.name).toBe('Conflict');
  });

  it('skips collection with skip resolution', async () => {
    const col = makeCollection({ id: 'skip-col' });
    stores['graphql-collections']!.set('skip-col', col);

    const data = makeExportData([{ collection: makeCollection({ id: 'skip-col', name: 'New Name' }) }]);
    const resolutions = new Map([['skip-col', 'skip' as const]]);

    const conflicts = await idbImportCollections(data, 'merge', resolutions);

    expect(conflicts).toEqual([]);
    // Original should remain
    expect((stores['graphql-collections']!.get('skip-col') as GraphqlCollection).name).toBe('Test Collection');
  });

  it('creates a renamed copy for keep-both resolution', async () => {
    const col = makeCollection({ id: 'kb-col', name: 'My Collection' });
    stores['graphql-collections']!.set('kb-col', col);

    const folder = makeFolder({ id: 'kb-folder', collectionId: 'kb-col' });
    const item = makeItem({ id: 'kb-item', collectionId: 'kb-col', folderId: 'kb-folder' });
    const data = makeExportData([{ collection: makeCollection({ id: 'kb-col', name: 'My Collection' }), folders: [folder], items: [item] }]);
    const resolutions = new Map([['kb-col', 'keep-both' as const]]);

    const conflicts = await idbImportCollections(data, 'merge', resolutions);

    expect(conflicts).toEqual([]);
    // A new collection should be created with a different id
    const allCollections = Array.from(stores['graphql-collections']!.values()) as GraphqlCollection[];
    expect(allCollections).toHaveLength(2);
    const imported = allCollections.find((c) => c.id !== 'kb-col');
    expect(imported?.name).toContain('(imported)');
  });

  it('overwrites existing collection with overwrite resolution', async () => {
    const existing = makeCollection({ id: 'ow-col', name: 'Old' });
    const existingFolder = makeFolder({ id: 'ow-f', collectionId: 'ow-col' });
    const existingItem = makeItem({ id: 'ow-i', collectionId: 'ow-col' });
    stores['graphql-collections']!.set('ow-col', existing);
    stores['graphql-collection-folders']!.set('ow-f', existingFolder);
    stores['graphql-collection-items']!.set('ow-i', existingItem);

    const newCol = makeCollection({ id: 'ow-col', name: 'New' });
    const newFolder = makeFolder({ id: 'ow-f2', collectionId: 'ow-col' });
    const data = makeExportData([{ collection: newCol, folders: [newFolder] }]);
    const resolutions = new Map([['ow-col', 'overwrite' as const]]);

    const conflicts = await idbImportCollections(data, 'merge', resolutions);

    expect(conflicts).toEqual([]);
    const saved = stores['graphql-collections']!.get('ow-col') as GraphqlCollection;
    expect(saved.name).toBe('New');
    // Old folder should be removed, new folder added
    expect(stores['graphql-collection-folders']!.has('ow-f')).toBe(false);
    expect(stores['graphql-collection-folders']!.has('ow-f2')).toBe(true);
  });
});

describe('normalizeImportData — v1.0 backward compat', () => {
  it('adds defaults for missing variables/scripts on collections', async () => {
    const legacyCol = { id: 'l-col', name: 'Legacy', createdAt: 1000, updatedAt: 1000 } as unknown as GraphqlCollection;
    const data = makeExportData([{ collection: legacyCol }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collections']!.get('l-col') as GraphqlCollection;
    expect(saved.variables).toEqual({});
    expect(saved.preRequestScript).toBe('');
    expect(saved.postResponseScript).toBe('');
  });

  it('adds sortOrder default for legacy folders missing it', async () => {
    const col = makeCollection({ id: 'nf-col' });
    const legacyFolder = { id: 'nf-f', name: 'LF', collectionId: 'nf-col', createdAt: 1000 } as unknown as GraphqlCollectionFolder;
    const data = makeExportData([{ collection: col, folders: [legacyFolder] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-folders']!.get('nf-f') as GraphqlCollectionFolder;
    expect(saved.sortOrder).toBe(0);
  });

  it('adds defaults for legacy items missing sortOrder/isPinned/tags', async () => {
    const col = makeCollection({ id: 'ni-col' });
    const legacyItem = {
      id: 'ni-i',
      name: 'LI',
      collectionId: 'ni-col',
      operation: { query: '{ q }', variables: '', operationName: '' },
      scripts: { preRequest: '', postResponse: '' },
      createdAt: 1000,
    } as unknown as GraphqlCollectionItem;
    const data = makeExportData([{ collection: col, items: [legacyItem] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-items']!.get('ni-i') as GraphqlCollectionItem;
    expect(saved.sortOrder).toBe(0);
    expect(saved.isPinned).toBe(false);
    expect(saved.tags).toEqual([]);
    expect(saved.updatedAt).toBeDefined();
  });

  it('resets malformed variables JSON in items to empty string', async () => {
    const col = makeCollection({ id: 'mv-col' });
    const item = makeItem({ id: 'mv-i', collectionId: 'mv-col', operation: { query: '{ q }', variables: 'bad-json{', operationName: '' } });
    const data = makeExportData([{ collection: col, items: [item] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-items']!.get('mv-i') as GraphqlCollectionItem;
    expect(saved.operation.variables).toBe('');
  });

  it('keeps valid JSON variables unchanged', async () => {
    const col = makeCollection({ id: 'vv-col' });
    const item = makeItem({ id: 'vv-i', collectionId: 'vv-col', operation: { query: '{ q }', variables: '{"k":"v"}', operationName: '' } });
    const data = makeExportData([{ collection: col, items: [item] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-items']!.get('vv-i') as GraphqlCollectionItem;
    expect(saved.operation.variables).toBe('{"k":"v"}');
  });

  it('handles items with no operation field by inserting a placeholder operation', async () => {
    const col = makeCollection({ id: 'no-op-col' });
    const legacyItem = {
      id: 'no-op-i',
      collectionId: 'no-op-col',
      name: 'LI',
      scripts: { preRequest: '', postResponse: '' },
      createdAt: 1000,
    } as unknown as GraphqlCollectionItem;
    const data = makeExportData([{ collection: col, items: [legacyItem] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-items']!.get('no-op-i') as GraphqlCollectionItem;
    // Missing operation is replaced with a safe placeholder so the item is
    // importable without crashing downstream consumers.
    expect(saved.operation).toBeDefined();
    expect(saved.operation.query).toBe('');
    expect(saved.operation.operationType).toBe('query');
  });

  it('normalizes folder with missing collectionId from legacy data', async () => {
    const col = makeCollection({ id: 'fc-col' });
    const legacyFolder = { id: 'fc-f', name: 'LF', createdAt: 1000 } as unknown as GraphqlCollectionFolder;
    const data = makeExportData([{ collection: col, folders: [legacyFolder] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-folders']!.get('fc-f') as GraphqlCollectionFolder;
    expect(saved.collectionId).toBe('fc-col');
  });
});

// ─── Additional branch coverage ────────────────────────────────────────────────

describe('idbImportCollections — keep-both with nested parentId (L235 truthy branch)', () => {
  it('remaps parentId when parent folder is also being imported (keep-both)', async () => {
    const col = makeCollection({ id: 'nb-col' });
    stores['graphql-collections']!.set('nb-col', col);

    const parentFolder = makeFolder({ id: 'nb-parent', collectionId: 'nb-col', parentId: undefined });
    const childFolder = makeFolder({ id: 'nb-child', collectionId: 'nb-col', parentId: 'nb-parent' });
    const data = makeExportData([{ collection: makeCollection({ id: 'nb-col', name: 'Col' }), folders: [parentFolder, childFolder] }]);
    const resolutions = new Map([['nb-col', 'keep-both' as const]]);

    const conflicts = await idbImportCollections(data, 'merge', resolutions);

    expect(conflicts).toEqual([]);
    // The new collection should have folders with remapped IDs
    const allFolders = Array.from(stores['graphql-collection-folders']!.values()) as GraphqlCollectionFolder[];
    const newFolders = allFolders.filter((f) => f.collectionId !== 'nb-col');
    // The child folder should have a parentId that matches the new parent's id
    expect(newFolders).toHaveLength(2);
    // At least one has parentId set (remapped)
    const withParent = newFolders.find((f) => f.parentId !== undefined);
    expect(withParent).toBeDefined();
  });

  it('keeps original parentId when parent folder is not in the import (L235 ?? f.parentId fallback)', async () => {
    const col = makeCollection({ id: 'op-col' });
    stores['graphql-collections']!.set('op-col', col);

    // The folder has parentId 'orphan-parent' which is NOT in the import folders array
    const orphanChildFolder = makeFolder({ id: 'op-child', collectionId: 'op-col', parentId: 'orphan-parent' });
    const data = makeExportData([{ collection: makeCollection({ id: 'op-col' }), folders: [orphanChildFolder] }]);
    const resolutions = new Map([['op-col', 'keep-both' as const]]);

    const conflicts = await idbImportCollections(data, 'merge', resolutions);
    expect(conflicts).toEqual([]);

    // The imported folder should keep the original parentId (orphan-parent not remapped)
    const allFolders = Array.from(stores['graphql-collection-folders']!.values()) as GraphqlCollectionFolder[];
    const importedFolder = allFolders.find((f) => f.collectionId !== 'op-col');
    expect(importedFolder?.parentId).toBe('orphan-parent');
  });

  it('keeps original folderId for items when folderId not in imported folders (L241 ?? i.folderId fallback)', async () => {
    const col = makeCollection({ id: 'of-col' });
    stores['graphql-collections']!.set('of-col', col);

    // Item has folderId 'orphan-folder' which is NOT in the import folders array
    const item = makeItem({ id: 'of-item', collectionId: 'of-col', folderId: 'orphan-folder' });
    const data = makeExportData([{ collection: makeCollection({ id: 'of-col' }), items: [item] }]);
    const resolutions = new Map([['of-col', 'keep-both' as const]]);

    const conflicts = await idbImportCollections(data, 'merge', resolutions);
    expect(conflicts).toEqual([]);

    // The imported item should keep the original folderId
    const allItems = Array.from(stores['graphql-collection-items']!.values()) as GraphqlCollectionItem[];
    const importedItem = allItems.find((i) => i.collectionId !== 'of-col');
    expect(importedItem?.folderId).toBe('orphan-folder');
  });
});

describe('normalizeImportData — updatedAt ?? createdAt ?? now fallback', () => {
  it('uses Date.now() when both updatedAt and createdAt are absent from legacy item', async () => {
    const before = Date.now();
    const col = makeCollection({ id: 'du-col' });
    const legacyItem = {
      id: 'du-i',
      collectionId: 'du-col',
      name: 'DU Item',
      scripts: { preRequest: '', postResponse: '' },
      operation: { query: '{ q }', variables: '', operationName: '' },
      // no createdAt, no updatedAt
    } as unknown as GraphqlCollectionItem;
    const data = makeExportData([{ collection: col, items: [legacyItem] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-items']!.get('du-i') as GraphqlCollectionItem;
    expect(saved.updatedAt).toBeGreaterThanOrEqual(before);
    // createdAt should also be defaulted to now
    expect(saved.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('defaults collection.createdAt to now when absent in legacy data', async () => {
    const before = Date.now();
    // Legacy collection without createdAt
    const legacyCol = { id: 'lca-col', name: 'Legacy', variables: {}, preRequestScript: '', postResponseScript: '' } as unknown as GraphqlCollection;
    const data = makeExportData([{ collection: legacyCol }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collections']!.get('lca-col') as GraphqlCollection;
    expect(saved.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('defaults folder.createdAt to now when absent in legacy data', async () => {
    const before = Date.now();
    const col = makeCollection({ id: 'lcaf-col' });
    // Folder without createdAt
    const legacyFolder = { id: 'lcaf-f', name: 'LF', collectionId: 'lcaf-col', sortOrder: 0 } as unknown as GraphqlCollectionFolder;
    const data = makeExportData([{ collection: col, folders: [legacyFolder] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-folders']!.get('lcaf-f') as GraphqlCollectionFolder;
    expect(saved.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('preserves existing createdAt when present', async () => {
    const col = makeCollection({ id: 'pca-col' });
    const item = makeItem({ id: 'pca-i', collectionId: 'pca-col', createdAt: 1111, updatedAt: 2222 });
    const data = makeExportData([{ collection: col, items: [item] }]);

    await idbImportCollections(data, 'replace');

    const saved = stores['graphql-collection-items']!.get('pca-i') as GraphqlCollectionItem;
    expect(saved.createdAt).toBe(1111);
    expect(saved.updatedAt).toBe(2222);
  });
});

describe('idbSaveItem — variables ?? "" nullish fallback (L101)', () => {
  it('handles item where operation.variables is undefined (covers ?? "" fallback)', async () => {
    // variables=undefined triggers the ?? '' fallback on line 101
    const item = makeItem({ operation: { query: '{ q }', variables: undefined as unknown as string, operationName: '' } });
    await idbSaveItem(item);
    expect(stores['graphql-collection-items']!.has('item-1')).toBe(true);
  });
});

describe('idbImportCollections — keep-both item with undefined folderId (L241 false branch)', () => {
  it('sets folderId to undefined when item has no folderId (covers L241 false branch)', async () => {
    const col = makeCollection({ id: 'nf-item-col' });
    stores['graphql-collections']!.set('nf-item-col', col);

    // Item has no folderId → folderId ? ... : undefined → undefined
    const item = makeItem({ id: 'nf-item-i', collectionId: 'nf-item-col', folderId: undefined });
    const data = makeExportData([{ collection: makeCollection({ id: 'nf-item-col' }), items: [item] }]);
    const resolutions = new Map([['nf-item-col', 'keep-both' as const]]);

    await idbImportCollections(data, 'merge', resolutions);

    const allItems = Array.from(stores['graphql-collection-items']!.values()) as GraphqlCollectionItem[];
    const importedItem = allItems.find((i) => i.collectionId !== 'nf-item-col');
    expect(importedItem?.folderId).toBeUndefined();
  });
});
