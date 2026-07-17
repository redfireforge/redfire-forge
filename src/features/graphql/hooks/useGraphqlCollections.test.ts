/**
 * GraphQL Collections — IDB integration tests (Phase 3A task 3A-14)
 *
 * Tests the real idbGraphqlCollections functions using fake-indexeddb.
 * Each test resets modules + installs a fresh fake IDB to ensure isolation.
 *
 * Covers:
 *  - save / load collections, folders, items
 *  - variables JSON validation (3A-16)
 *  - export v1.1 format
 *  - import replace mode
 *  - import v1.0 backward-compat normalization
 *  - deleteFolder cascade (items deleted when folder is deleted)
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GraphqlCollection,
  GraphqlCollectionFolder,
  GraphqlCollectionItem,
} from '../../../shared/types/graphql';

// ─── Module handles (reloaded per test) ──────────────────────────────────────

let idbSaveCollection: typeof import('../../../shared/utils/idbGraphqlCollections').idbSaveCollection;
let idbLoadCollections: typeof import('../../../shared/utils/idbGraphqlCollections').idbLoadCollections;
let idbDeleteCollection: typeof import('../../../shared/utils/idbGraphqlCollections').idbDeleteCollection;
let idbSaveFolder: typeof import('../../../shared/utils/idbGraphqlCollections').idbSaveFolder;
let idbLoadFolders: typeof import('../../../shared/utils/idbGraphqlCollections').idbLoadFolders;
let idbDeleteFolder: typeof import('../../../shared/utils/idbGraphqlCollections').idbDeleteFolder;
let idbSaveItem: typeof import('../../../shared/utils/idbGraphqlCollections').idbSaveItem;
let idbLoadItems: typeof import('../../../shared/utils/idbGraphqlCollections').idbLoadItems;
let idbDeleteItem: typeof import('../../../shared/utils/idbGraphqlCollections').idbDeleteItem;
let idbUpdateItemSortOrders: typeof import('../../../shared/utils/idbGraphqlCollections').idbUpdateItemSortOrders;
let idbExportCollections: typeof import('../../../shared/utils/idbGraphqlCollections').idbExportCollections;
let idbImportCollections: typeof import('../../../shared/utils/idbGraphqlCollections').idbImportCollections;

// ─── Factories ────────────────────────────────────────────────────────────────

function makeCollection(overrides?: Partial<GraphqlCollection>): GraphqlCollection {
  return {
    id: crypto.randomUUID(),
    name: 'Test Collection',
    variables: {},
    preRequestScript: '',
    postResponseScript: '',
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeFolder(overrides?: Partial<GraphqlCollectionFolder>): GraphqlCollectionFolder {
  return {
    id: crypto.randomUUID(),
    collectionId: 'col-1',
    name: 'Folder',
    sortOrder: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeItem(overrides?: Partial<GraphqlCollectionItem>): GraphqlCollectionItem {
  return {
    id: crypto.randomUUID(),
    collectionId: 'col-1',
    name: 'My Query',
    sortOrder: 0,
    operation: {
      id: crypto.randomUUID(),
      query: 'query { hello }',
      variables: '{}',
      operationType: 'query',
    },
    isPinned: false,
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  await import('fake-indexeddb/auto');
  ({
    idbSaveCollection,
    idbLoadCollections,
    idbDeleteCollection,
    idbSaveFolder,
    idbLoadFolders,
    idbDeleteFolder,
    idbSaveItem,
    idbLoadItems,
    idbDeleteItem,
    idbUpdateItemSortOrders,
    idbExportCollections,
    idbImportCollections,
  } = await import('../../../shared/utils/idbGraphqlCollections'));
});

// ─── Collections CRUD ────────────────────────────────────────────────────────

describe('Collections CRUD', () => {
  it('saves and loads a collection', async () => {
    const col = makeCollection({ id: 'c1', name: 'Alpha' });
    await idbSaveCollection(col);
    const loaded = await idbLoadCollections();
    expect(loaded.some((c) => c.id === 'c1' && c.name === 'Alpha')).toBe(true);
  });

  it('deletes a collection', async () => {
    const col = makeCollection({ id: 'c2' });
    await idbSaveCollection(col);
    await idbDeleteCollection('c2');
    const loaded = await idbLoadCollections();
    expect(loaded.some((c) => c.id === 'c2')).toBe(false);
  });
});

// ─── Folders CRUD ────────────────────────────────────────────────────────────

describe('Folders CRUD', () => {
  it('saves and loads folders for a collection', async () => {
    const f = makeFolder({ id: 'f1', collectionId: 'col-A', name: 'Root Folder' });
    await idbSaveFolder(f);
    const folders = await idbLoadFolders('col-A');
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('Root Folder');
  });

  it('deletes folder and its items', async () => {
    const f = makeFolder({ id: 'fld-1', collectionId: 'col-A' });
    const item = makeItem({ id: 'itm-1', collectionId: 'col-A', folderId: 'fld-1' });
    await idbSaveFolder(f);
    await idbSaveItem(item);
    await idbDeleteFolder('fld-1');
    const folders = await idbLoadFolders('col-A');
    const items = await idbLoadItems('col-A');
    expect(folders.some((x) => x.id === 'fld-1')).toBe(false);
    expect(items.some((x) => x.id === 'itm-1')).toBe(false);
  });
});

// ─── Items CRUD ──────────────────────────────────────────────────────────────

describe('Items CRUD', () => {
  it('saves and loads items for a collection', async () => {
    const item = makeItem({ id: 'i1', collectionId: 'col-B', name: 'Get Users' });
    await idbSaveItem(item);
    const loaded = await idbLoadItems('col-B');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Get Users');
  });

  it('returns items sorted by sortOrder ascending', async () => {
    const a = makeItem({ id: 'a', collectionId: 'col-C', sortOrder: 10, name: 'Z' });
    const b = makeItem({ id: 'b', collectionId: 'col-C', sortOrder: 1, name: 'A' });
    await idbSaveItem(a);
    await idbSaveItem(b);
    const loaded = await idbLoadItems('col-C');
    expect(loaded[0].id).toBe('b');
    expect(loaded[1].id).toBe('a');
  });

  it('deletes an item', async () => {
    const item = makeItem({ id: 'del-i', collectionId: 'col-D' });
    await idbSaveItem(item);
    await idbDeleteItem('del-i');
    const loaded = await idbLoadItems('col-D');
    expect(loaded.some((i) => i.id === 'del-i')).toBe(false);
  });
});

// ─── 3A-16: Variables JSON validation ────────────────────────────────────────

describe('Variables JSON validation (3A-16)', () => {
  it('allows valid JSON variables', async () => {
    const item = makeItem({ operation: { id: 'op1', query: 'query { a }', variables: '{"key":"value"}', operationType: 'query' } });
    await expect(idbSaveItem(item)).resolves.toBeUndefined();
  });

  it('rejects malformed JSON variables', async () => {
    const item = makeItem({ operation: { id: 'op2', query: 'query { a }', variables: '{bad json}', operationType: 'query' } });
    await expect(idbSaveItem(item)).rejects.toThrow('Variables must be valid JSON');
  });

  it('allows empty variables string', async () => {
    const item = makeItem({ operation: { id: 'op3', query: 'query { a }', variables: '', operationType: 'query' } });
    await expect(idbSaveItem(item)).resolves.toBeUndefined();
  });

  it('allows "{}" as variables', async () => {
    const item = makeItem({ operation: { id: 'op4', query: 'query { a }', variables: '{}', operationType: 'query' } });
    await expect(idbSaveItem(item)).resolves.toBeUndefined();
  });
});

// ─── 3A-5: Export / Import ───────────────────────────────────────────────────

describe('Export / Import (3A-5)', () => {
  it('exports all collections with correct v1.1 format', async () => {
    // The export format groups per collection: { collection, folders, items }[]
    const col = makeCollection({ id: 'exp-col', name: 'Exported' });
    const item = makeItem({ id: 'exp-item', collectionId: 'exp-col', name: 'Query A' });
    await idbSaveCollection(col);
    await idbSaveItem(item);
    const exported = await idbExportCollections();
    expect(exported._exportMeta.version).toBe('1.1');
    expect(exported.collections.some((g) => g.collection.id === 'exp-col')).toBe(true);
    const group = exported.collections.find((g) => g.collection.id === 'exp-col');
    expect(group?.items.some((i) => i.id === 'exp-item')).toBe(true);
  });

  it('imports in replace mode and clears existing data', async () => {
    const existing = makeCollection({ id: 'old-col', name: 'Old' });
    await idbSaveCollection(existing);

    const newCol = makeCollection({ id: 'new-col', name: 'Imported' });
    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{ collection: newCol, folders: [], items: [] }],
    };
    await idbImportCollections(payload, 'replace');
    const loaded = await idbLoadCollections();
    expect(loaded.some((c) => c.id === 'old-col')).toBe(false);
    expect(loaded.some((c) => c.id === 'new-col')).toBe(true);
  });

  it('normalizes v1.0 imports (missing variables/preRequestScript fields default to {})', async () => {
    // v1.0 collections may be missing variables/script fields — normalizeImportData adds defaults.
    const v1Col = { id: 'v1-col', name: 'V1 Collection', createdAt: Date.now() } as GraphqlCollection;
    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{ collection: v1Col, folders: [], items: [] }],
    };
    await idbImportCollections(payload, 'replace');
    const loaded = await idbLoadCollections();
    const col = loaded.find((c) => c.id === 'v1-col');
    expect(col).toBeDefined();
    expect(col!.variables).toBeDefined();
    expect(typeof col!.variables).toBe('object');
    expect(col!.preRequestScript).toBe('');
    expect(col!.postResponseScript).toBe('');
  });

  it('exports only specified collection ids when provided', async () => {
    const colA = makeCollection({ id: 'colA', name: 'A' });
    const colB = makeCollection({ id: 'colB', name: 'B' });
    await idbSaveCollection(colA);
    await idbSaveCollection(colB);
    const exported = await idbExportCollections(['colA']);
    expect(exported.collections.some((g) => g.collection.id === 'colA')).toBe(true);
    expect(exported.collections.some((g) => g.collection.id === 'colB')).toBe(false);
  });

  it('normalizes malformed variables to "" during import (3A-16 bypass fix)', async () => {
    // Items with invalid JSON variables must be normalized during import rather than
    // silently written to IDB in a corrupt state (which would only fail at execution time).
    const col = makeCollection({ id: 'badvar-col', name: 'BadVars' });
    const badItem = makeItem({
      id: 'badvar-item',
      collectionId: 'badvar-col',
      operation: { id: 'op-bad', query: 'query { x }', variables: '{bad json}', operationType: 'query' },
    });
    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{ collection: col, folders: [], items: [badItem] }],
    };
    await idbImportCollections(payload, 'replace');
    const loaded = await idbLoadItems('badvar-col');
    expect(loaded).toHaveLength(1);
    // Variables must have been normalized to '' (not the original malformed JSON)
    expect(loaded[0].operation.variables).toBe('');
  });

  it('merge overwrite replaces collection atomically (no orphan state between delete and insert)', async () => {
    const existing = makeCollection({ id: 'ow-col', name: 'Original' });
    const existItem = makeItem({ id: 'ow-item-old', collectionId: 'ow-col', name: 'Old Query' });
    await idbSaveCollection(existing);
    await idbSaveItem(existItem);

    const newItem = makeItem({ id: 'ow-item-new', collectionId: 'ow-col', name: 'New Query' });
    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{ collection: existing, folders: [], items: [newItem] }],
    };
    await idbImportCollections(payload, 'merge', new Map([['ow-col', 'overwrite']]));
    const cols = await idbLoadCollections();
    expect(cols.some((c) => c.id === 'ow-col')).toBe(true);
    const items = await idbLoadItems('ow-col');
    // Old item must be gone; new item must be present
    expect(items.some((i) => i.id === 'ow-item-old')).toBe(false);
    expect(items.some((i) => i.id === 'ow-item-new')).toBe(true);
  });
});

// ─── 3A-14: sortOrder after reorder ──────────────────────────────────────────

describe('sortOrder after reorder (3A-14)', () => {
  it('idbUpdateItemSortOrders updates sortOrder for multiple items', async () => {
    const colId = 'col-reorder';
    const a = makeItem({ id: 'r-a', collectionId: colId, sortOrder: 0, name: 'A' });
    const b = makeItem({ id: 'r-b', collectionId: colId, sortOrder: 1, name: 'B' });
    const c = makeItem({ id: 'r-c', collectionId: colId, sortOrder: 2, name: 'C' });
    await idbSaveItem(a);
    await idbSaveItem(b);
    await idbSaveItem(c);

    // Reverse the order: a→2, b→1, c→0
    await idbUpdateItemSortOrders([
      { id: 'r-a', sortOrder: 2 },
      { id: 'r-b', sortOrder: 1 },
      { id: 'r-c', sortOrder: 0 },
    ]);

    const loaded = await idbLoadItems(colId);
    // Sorted ascending by sortOrder → c, b, a
    expect(loaded[0].id).toBe('r-c');
    expect(loaded[1].id).toBe('r-b');
    expect(loaded[2].id).toBe('r-a');
  });

  it('idbUpdateItemSortOrders is a no-op for an empty updates array', async () => {
    await expect(idbUpdateItemSortOrders([])).resolves.toBeUndefined();
  });
});

// ─── 3A-14: Fork collection ───────────────────────────────────────────────────

describe('Fork collection (3A-14)', () => {
  it('forking exports the collection then re-imports it with a new id and name', async () => {
    // Fork is implemented in useGraphqlCollections (not directly in idb), so test the IDB
    // primitives: export → re-import with new id → both collections exist.
    const original = makeCollection({ id: 'fork-orig', name: 'Original' });
    const origItem = makeItem({ id: 'fork-item', collectionId: 'fork-orig', name: 'My Query' });
    await idbSaveCollection(original);
    await idbSaveItem(origItem);

    // Simulate what forkCollection does:
    const exported = await idbExportCollections(['fork-orig']);
    const forkedGroup = exported.collections[0];
    const newColId = crypto.randomUUID();
    const forkedCol = { ...forkedGroup.collection, id: newColId, name: 'Original (fork)' };
    const forkedFolders = forkedGroup.folders.map((f) => ({ ...f, id: crypto.randomUUID(), collectionId: newColId }));
    const forkedItems = forkedGroup.items.map((i) => ({ ...i, id: crypto.randomUUID(), collectionId: newColId, lastExecutedAt: undefined }));
    await idbSaveCollection(forkedCol);
    for (const f of forkedFolders) await idbSaveFolder(f);
    for (const i of forkedItems) await idbSaveItem(i);

    const allCols = await idbLoadCollections();
    expect(allCols.some((c) => c.id === 'fork-orig')).toBe(true);
    expect(allCols.some((c) => c.id === newColId && c.name === 'Original (fork)')).toBe(true);

    const forkedLoaded = await idbLoadItems(newColId);
    expect(forkedLoaded).toHaveLength(1);
    expect(forkedLoaded[0].name).toBe('My Query');
    // IDs must be different from originals
    expect(forkedLoaded[0].id).not.toBe('fork-item');
  });
});

// ─── 3A-14: lastExecutedAt updated on run ────────────────────────────────────

describe('lastExecutedAt updated on run (3A-14)', () => {
  it('idbSaveItem with lastExecutedAt persists the value', async () => {
    const before = Date.now();
    const item = makeItem({ id: 'exec-item', collectionId: 'col-exec' });
    await idbSaveItem(item);

    // Simulate markItemExecuted: update lastExecutedAt
    const updatedItem: GraphqlCollectionItem = { ...item, lastExecutedAt: Date.now(), updatedAt: Date.now() };
    await idbSaveItem(updatedItem);

    const loaded = await idbLoadItems('col-exec');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].lastExecutedAt).toBeDefined();
    expect(loaded[0].lastExecutedAt!).toBeGreaterThanOrEqual(before);
  });

  it('item initially has no lastExecutedAt (undefined)', async () => {
    const item = makeItem({ id: 'no-exec', collectionId: 'col-noexec' });
    await idbSaveItem(item);
    const loaded = await idbLoadItems('col-noexec');
    expect(loaded[0].lastExecutedAt).toBeUndefined();
  });
});

// ─── Merge: no resolution provided (lines 222-223 in idbGraphqlCollections) ───

describe('Merge — unresolved conflict (no resolution provided)', () => {
  it('returns a conflict entry when a collection exists but no resolution is given', async () => {
    const existing = makeCollection({ id: 'conflict-col', name: 'Existing' });
    await idbSaveCollection(existing);

    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{ collection: existing, folders: [], items: [] }],
    };
    // Pass empty resolutions map — no decision for 'conflict-col'
    const conflicts = await idbImportCollections(payload, 'merge', new Map());
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('conflict-col');
    expect(conflicts[0].name).toBe('Existing');

    // Original collection should still exist (not overwritten)
    const loaded = await idbLoadCollections();
    expect(loaded.some((c) => c.id === 'conflict-col')).toBe(true);
  });
});

// ─── Merge: new collection (lines 275-279 in idbGraphqlCollections) ───────────

describe('Merge — new collection (non-conflicting)', () => {
  it('inserts a brand-new collection during merge when it does not exist in DB', async () => {
    const existing = makeCollection({ id: 'old-col', name: 'Old' });
    await idbSaveCollection(existing);

    const newCol = makeCollection({ id: 'brand-new-col', name: 'Brand New' });
    const newItem = makeItem({ id: 'new-item', collectionId: 'brand-new-col' });

    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{ collection: newCol, folders: [], items: [newItem] }],
    };

    const conflicts = await idbImportCollections(payload, 'merge', new Map());
    // No conflict — brand-new-col doesn't exist yet
    expect(conflicts).toHaveLength(0);

    const loaded = await idbLoadCollections();
    expect(loaded.some((c) => c.id === 'brand-new-col')).toBe(true);
    expect(loaded.some((c) => c.id === 'old-col')).toBe(true); // original preserved

    const items = await idbLoadItems('brand-new-col');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('new-item');
  });

  it('inserts a new collection with folders during merge', async () => {
    const newCol = makeCollection({ id: 'fresh-col', name: 'Fresh' });
    const folder = makeFolder({ id: 'fresh-fld', collectionId: 'fresh-col', name: 'Folder' });

    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{ collection: newCol, folders: [folder], items: [] }],
    };

    await idbImportCollections(payload, 'merge', new Map());

    const loaded = await idbLoadCollections();
    expect(loaded.some((c) => c.id === 'fresh-col')).toBe(true);

    const folders = await idbLoadFolders('fresh-col');
    expect(folders.some((f) => f.id === 'fresh-fld')).toBe(true);
  });
});

// ─── 3A-14: Merge keep-both parentId remapping ────────────────────────────────

describe('Merge keep-both parentId remapping (3A-14)', () => {
  it('remaps nested folder parentId when keep-both is used', async () => {
    const existingCol = makeCollection({ id: 'merge-col', name: 'Existing' });
    await idbSaveCollection(existingCol);

    const rootFolderId = 'root-fld';
    const childFolderId = 'child-fld';

    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [{
        collection: existingCol,
        folders: [
          makeFolder({ id: rootFolderId, collectionId: 'merge-col', name: 'Root' }),
          makeFolder({ id: childFolderId, collectionId: 'merge-col', name: 'Child', parentId: rootFolderId }),
        ],
        items: [],
      }],
    };

    const conflicts = await idbImportCollections(payload, 'merge', new Map([['merge-col', 'keep-both']]));
    // No unresolved conflicts — we provided a resolution
    expect(conflicts).toHaveLength(0);

    const allCols = await idbLoadCollections();
    // Both original and the copy should exist
    expect(allCols.some((c) => c.id === 'merge-col')).toBe(true);
    const copied = allCols.find((c) => c.name === 'Existing (imported)');
    expect(copied).toBeDefined();

    if (copied) {
      const folders = await idbLoadFolders(copied.id);
      expect(folders).toHaveLength(2);
      const root = folders.find((f) => f.name === 'Root');
      const child = folders.find((f) => f.name === 'Child');
      expect(root).toBeDefined();
      expect(child).toBeDefined();
      // Child's parentId should point to the copied root folder, not the original
      if (root && child) {
        expect(child.parentId).toBe(root.id);
        expect(child.parentId).not.toBe(rootFolderId); // must be remapped
      }
    }
  });
});

