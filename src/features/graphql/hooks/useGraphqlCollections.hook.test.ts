/**
 * useGraphqlCollections hook — React state callback coverage tests (Phase 3A)
 *
 * This file tests the React state management within the useGraphqlCollections
 * hook by mocking the IDB layer completely (no fake-indexeddb, no timeouts).
 *
 * The IDB-layer integration tests live in useGraphqlCollections.test.ts.
 * This file specifically covers the callbacks that manipulate React state
 * (setTrees) — branches that are otherwise unreachable in IDB-only tests.
 *
 * Covered:
 *  - deleteItem (lines 272-275) — removes item from trees state
 *  - reorderItems (lines 277-285) — re-sorts items in trees state
 *  - deleteFolder with nested child folders (lines 222-223) — BFS second pass
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mock all IDB functions ───────────────────────────────────────────────────

vi.mock('../../../shared/utils/idbGraphqlCollections', () => ({
  idbLoadCollections: vi.fn().mockResolvedValue([]),
  idbSaveCollection: vi.fn().mockResolvedValue(undefined),
  idbDeleteCollection: vi.fn().mockResolvedValue(undefined),
  idbLoadFolders: vi.fn().mockResolvedValue([]),
  idbSaveFolder: vi.fn().mockResolvedValue(undefined),
  idbDeleteFolder: vi.fn().mockResolvedValue(undefined),
  idbLoadItems: vi.fn().mockResolvedValue([]),
  idbSaveItem: vi.fn().mockResolvedValue(undefined),
  idbDeleteItem: vi.fn().mockResolvedValue(undefined),
  idbUpdateItemSortOrders: vi.fn().mockResolvedValue(undefined),
  idbMarkItemExecuted: vi.fn().mockResolvedValue(undefined),
  idbExportCollections: vi.fn().mockResolvedValue({
    _exportMeta: { version: '1.1', exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' },
    collections: [],
  }),
  idbImportCollections: vi.fn().mockResolvedValue([]),
}));

// ─── Import hook after mocking ────────────────────────────────────────────────

import { useGraphqlCollections } from './useGraphqlCollections';
import type { CollectionTree } from './useGraphqlCollections';
import type {
  GraphqlCollection,
  GraphqlCollectionFolder,
  GraphqlCollectionItem,
  GraphqlOperation,
} from '../../../shared/types/graphql';
import {
  idbLoadCollections,
  idbLoadFolders,
  idbLoadItems,
} from '../../../shared/utils/idbGraphqlCollections';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeCol(id: string, name = 'Col'): GraphqlCollection {
  return { id, name, variables: {}, preRequestScript: '', postResponseScript: '', createdAt: Date.now() };
}

function makeFolder(id: string, collectionId: string, parentId?: string): GraphqlCollectionFolder {
  return { id, collectionId, name: `Folder-${id}`, parentId, sortOrder: 0, createdAt: Date.now() };
}

function makeItem(id: string, collectionId: string, sortOrder = 0, folderId?: string): GraphqlCollectionItem {
  const op: GraphqlOperation = { id: `op-${id}`, query: 'query { x }', variables: '{}', operationType: 'query' };
  return { id, collectionId, folderId, name: `Item-${id}`, sortOrder, operation: op, isPinned: false, tags: [], createdAt: Date.now(), updatedAt: Date.now() };
}

function makeTree(col: GraphqlCollection, folders: GraphqlCollectionFolder[] = [], items: GraphqlCollectionItem[] = []): CollectionTree {
  return { collection: col, folders, items };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(idbLoadCollections).mockResolvedValue([]);
  vi.mocked(idbLoadFolders).mockResolvedValue([]);
  vi.mocked(idbLoadItems).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Helper: mount hook and wait for loading to settle ───────────────────────

async function mountHook() {
  const { result } = renderHook(() => useGraphqlCollections());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

// ─── deleteItem — state update (lines 272-275) ───────────────────────────────

describe('useGraphqlCollections hook — deleteItem', () => {
  it('removes the item from trees state after deleteItem is called', async () => {
    const col = makeCol('col-1');
    const itemA = makeItem('item-a', 'col-1', 0);
    const itemB = makeItem('item-b', 'col-1', 1);

    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([]);
    vi.mocked(idbLoadItems).mockResolvedValue([itemA, itemB]);

    const result = await mountHook();
    expect(result.current.trees).toHaveLength(1);
    expect(result.current.trees[0].items).toHaveLength(2);

    await act(async () => {
      await result.current.deleteItem('item-a');
    });

    expect(result.current.trees[0].items).toHaveLength(1);
    expect(result.current.trees[0].items[0].id).toBe('item-b');
  });

  it('is a no-op (state unchanged) when id does not match any item', async () => {
    const col = makeCol('col-1');
    const itemA = makeItem('item-a', 'col-1', 0);
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([itemA]);

    const result = await mountHook();

    await act(async () => {
      await result.current.deleteItem('nonexistent');
    });

    expect(result.current.trees[0].items).toHaveLength(1);
  });
});

// ─── reorderItems — state update (lines 277-285) ─────────────────────────────

describe('useGraphqlCollections hook — reorderItems', () => {
  it('reorders items by sortOrder after reorderItems is called', async () => {
    const col = makeCol('col-1');
    const itemA = makeItem('item-a', 'col-1', 0);
    const itemB = makeItem('item-b', 'col-1', 1);
    const itemC = makeItem('item-c', 'col-1', 2);

    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([itemA, itemB, itemC]);

    const result = await mountHook();
    expect(result.current.trees[0].items.map((i) => i.id)).toEqual(['item-a', 'item-b', 'item-c']);

    await act(async () => {
      await result.current.reorderItems('col-1', [
        { id: 'item-a', sortOrder: 2 },
        { id: 'item-b', sortOrder: 1 },
        { id: 'item-c', sortOrder: 0 },
      ]);
    });

    // After reorder, sorted ascending: c(0), b(1), a(2)
    const ids = result.current.trees[0].items.map((i) => i.id);
    expect(ids).toEqual(['item-c', 'item-b', 'item-a']);
  });

  it('leaves items for other collections unchanged', async () => {
    const col1 = makeCol('col-1');
    const col2 = makeCol('col-2');
    const itemA = makeItem('item-a', 'col-1', 0);
    const itemB = makeItem('item-b', 'col-2', 5);

    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);
    vi.mocked(idbLoadFolders).mockResolvedValue([]);
    vi.mocked(idbLoadItems).mockImplementation(async (colId: string) => {
      if (colId === 'col-1') return [itemA];
      if (colId === 'col-2') return [itemB];
      return [];
    });

    const result = await mountHook();

    await act(async () => {
      await result.current.reorderItems('col-1', [{ id: 'item-a', sortOrder: 99 }]);
    });

    const col2Tree = result.current.trees.find((t) => t.collection.id === 'col-2');
    expect(col2Tree?.items[0].sortOrder).toBe(5); // unchanged
  });

  it('does not modify items not in the ordered array', async () => {
    const col = makeCol('col-1');
    const itemA = makeItem('item-a', 'col-1', 0);
    const itemB = makeItem('item-b', 'col-1', 1);

    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([itemA, itemB]);

    const result = await mountHook();

    await act(async () => {
      // Only reorder item-a — item-b sortOrder should remain 1
      await result.current.reorderItems('col-1', [{ id: 'item-a', sortOrder: 10 }]);
    });

    const itemBAfter = result.current.trees[0].items.find((i) => i.id === 'item-b');
    expect(itemBAfter?.sortOrder).toBe(1);
  });
});

// ─── deleteFolder BFS — nested child discovery (lines 222-223) ───────────────

describe('useGraphqlCollections hook — deleteFolder BFS second pass', () => {
  it('collects and deletes nested child folders (BFS changed=true path, lines 222-223)', async () => {
    const col = makeCol('col-1');
    // Three-level folder hierarchy: root → child → grandchild
    const rootFolder  = makeFolder('fld-root',  'col-1');
    const childFolder = makeFolder('fld-child',  'col-1', 'fld-root');
    const grandchild  = makeFolder('fld-grand',  'col-1', 'fld-child');
    const unrelated   = makeFolder('fld-other',  'col-1');         // not in hierarchy

    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([rootFolder, childFolder, grandchild, unrelated]);
    vi.mocked(idbLoadItems).mockResolvedValue([]);

    const result = await mountHook();
    expect(result.current.trees[0].folders).toHaveLength(4);

    await act(async () => {
      await result.current.deleteFolder('fld-root');
    });

    // Only unrelated folder should remain
    const remaining = result.current.trees[0].folders.map((f) => f.id);
    expect(remaining).toEqual(['fld-other']);
    expect(remaining).not.toContain('fld-root');
    expect(remaining).not.toContain('fld-child');
    expect(remaining).not.toContain('fld-grand');
  });

  it('removes items that belong to deleted folders', async () => {
    const col = makeCol('col-1');
    const rootFolder  = makeFolder('fld-root',  'col-1');
    const childFolder = makeFolder('fld-child',  'col-1', 'fld-root');

    const itemInRoot  = makeItem('item-root',  'col-1', 0, 'fld-root');
    const itemInChild = makeItem('item-child', 'col-1', 1, 'fld-child');
    const itemNoFolder = makeItem('item-none',  'col-1', 2);

    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([rootFolder, childFolder]);
    vi.mocked(idbLoadItems).mockResolvedValue([itemInRoot, itemInChild, itemNoFolder]);

    const result = await mountHook();

    await act(async () => {
      await result.current.deleteFolder('fld-root');
    });

    const remainingItems = result.current.trees[0].items;
    expect(remainingItems.map((i) => i.id)).toEqual(['item-none']);
  });

  it('deletes only the target folder when it has no children', async () => {
    const col = makeCol('col-1');
    const folderA = makeFolder('fld-a', 'col-1');
    const folderB = makeFolder('fld-b', 'col-1'); // sibling, not child

    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([folderA, folderB]);
    vi.mocked(idbLoadItems).mockResolvedValue([]);

    const result = await mountHook();

    await act(async () => {
      await result.current.deleteFolder('fld-a');
    });

    const remaining = result.current.trees[0].folders.map((f) => f.id);
    expect(remaining).toEqual(['fld-b']);
  });
});

// ─── addItem with existing siblings — ternary branch (line 244 maxSort > 0) ──

describe('useGraphqlCollections hook — addItem with existing siblings', () => {
  it('uses max(sortOrder)+1 when siblings exist in the same folder', async () => {
    const col = makeCol('col-1');
    const existing = makeItem('exist-a', 'col-1', 5);

    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([existing]);

    const result = await mountHook();

    const op: GraphqlOperation = { id: 'op-new', query: 'query { x }', variables: '{}', operationType: 'query' };
    let added: import('../../../shared/types/graphql').GraphqlCollectionItem | undefined;

    await act(async () => {
      added = await result.current.addItem('col-1', undefined, 'Next Item', op);
    });

    // sortOrder should be max(5) + 1 = 6
    expect(added?.sortOrder).toBe(6);
  });

  it('returns sortOrder 0 when there are no siblings (empty items list)', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([]);

    const result = await mountHook();

    const op: GraphqlOperation = { id: 'op-first', query: 'query { x }', variables: '{}', operationType: 'query' };
    let added: import('../../../shared/types/graphql').GraphqlCollectionItem | undefined;

    await act(async () => {
      added = await result.current.addItem('col-1', undefined, 'First Item', op);
    });

    expect(added?.sortOrder).toBe(0);
  });

  it('handles null tree gracefully when collection id is not found', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([]);

    const result = await mountHook();

    const op: GraphqlOperation = { id: 'op-x', query: 'query { x }', variables: '{}', operationType: 'query' };
    let added: import('../../../shared/types/graphql').GraphqlCollectionItem | undefined;

    await act(async () => {
      // 'nonexistent' collection doesn't exist → tree will be undefined → tree?.items → []
      added = await result.current.addItem('nonexistent', undefined, 'Orphan Item', op);
    });

    // Item is still created with sortOrder 0 (siblings defaults to [])
    expect(added?.sortOrder).toBe(0);
  });
});

// ─── setPinned with non-existent item (line 290 !item branch) ────────────────

describe('useGraphqlCollections hook — setPinned with non-existent item', () => {
  it('returns tree unchanged when item id is not found (!item branch)', async () => {
    const col = makeCol('col-1');
    const item = makeItem('real-item', 'col-1', 0);
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([item]);

    const result = await mountHook();
    const before = result.current.trees[0].items[0].isPinned;

    await act(async () => {
      await result.current.setPinned('nonexistent-id', true);
    });

    // State unchanged — real item's pinned status not affected
    expect(result.current.trees[0].items[0].isPinned).toBe(before);
  });
});

// ─── markItemExecuted with non-existent item (line 300 !item branch) ──────────

describe('useGraphqlCollections hook — markItemExecuted with non-existent item', () => {
  it('returns tree unchanged when item id is not found (!item branch)', async () => {
    const col = makeCol('col-1');
    const item = makeItem('real-item', 'col-1', 0);
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([item]);

    const result = await mountHook();

    await act(async () => {
      await result.current.markItemExecuted('nonexistent-id');
    });

    // Real item's lastExecutedAt should remain undefined
    expect(result.current.trees[0].items[0].lastExecutedAt).toBeUndefined();
  });
});

// ─── addCollection — state update ────────────────────────────────────────────

describe('useGraphqlCollections hook — addCollection', () => {
  it('appends a new collection to trees state', async () => {
    const result = await mountHook();
    expect(result.current.trees).toHaveLength(0);

    await act(async () => {
      await result.current.addCollection('My New Collection');
    });

    expect(result.current.trees).toHaveLength(1);
    expect(result.current.trees[0].collection.name).toBe('My New Collection');
    expect(result.current.trees[0].folders).toEqual([]);
    expect(result.current.trees[0].items).toEqual([]);
  });
});

// ─── deleteCollection — state update ─────────────────────────────────────────

describe('useGraphqlCollections hook — deleteCollection', () => {
  it('removes the collection from trees state', async () => {
    const col = makeCol('col-del');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();
    expect(result.current.trees).toHaveLength(1);

    await act(async () => {
      await result.current.deleteCollection('col-del');
    });

    expect(result.current.trees).toHaveLength(0);
  });
});

// ─── addItem — state update ───────────────────────────────────────────────────

describe('useGraphqlCollections hook — addItem', () => {
  it('appends item to the correct collection tree', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();
    expect(result.current.trees[0].items).toHaveLength(0);

    const op: GraphqlOperation = { id: 'op1', query: 'query { x }', variables: '{}', operationType: 'query' };

    await act(async () => {
      await result.current.addItem('col-1', undefined, 'New Item', op);
    });

    expect(result.current.trees[0].items).toHaveLength(1);
    expect(result.current.trees[0].items[0].name).toBe('New Item');
  });
});

// ─── setPinned — state update (two collections: covers both !item branches) ───

describe('useGraphqlCollections hook — setPinned', () => {
  it('pins an item in the owning collection, leaves the other collection unchanged (line 293)', async () => {
    // Two collections — each gets its OWN items via mockImplementation:
    //   col-1 gets [item-p], col-2 gets [item-p2]
    // When setPinned('item-p', true) runs, setTrees iterates both trees:
    //   col-1: finds item-p  → !item == false → updates  (false branch of line 293)
    //   col-2: no item-p     → !item == true  → returns t (true branch of line 293)
    const col1 = makeCol('col-1');
    const col2 = makeCol('col-2');
    const item = makeItem('item-p', 'col-1', 0);
    const item2 = makeItem('item-p2', 'col-2', 0);

    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);
    vi.mocked(idbLoadItems).mockImplementation((colId: string) =>
      Promise.resolve(colId === 'col-1' ? [item] : [item2]),
    );

    const result = await mountHook();
    expect(result.current.trees[0].items[0].isPinned).toBe(false);

    await act(async () => {
      await result.current.setPinned('item-p', true);
    });

    expect(result.current.trees[0].items[0].isPinned).toBe(true);
    // col-2's item is untouched (returned via the !item true-branch)
    expect(result.current.trees[1].items[0].isPinned).toBe(false);
  });
});

// ─── updateItem — state update (two collections: covers both ternary branches) ─

describe('useGraphqlCollections hook — updateItem', () => {
  it('updates the item in the owning collection, ignores the other collection (lines 267-268)', async () => {
    // Two collections so the ternary "t.collection.id === item.collectionId ? ... : t"
    // covers both branch sides (267=true, 268=false) in a single setTrees sweep.
    const col1 = makeCol('col-1');
    const col2 = makeCol('col-2');
    const item = makeItem('item-u', 'col-1', 0);
    const item2 = makeItem('item-u2', 'col-2', 0);
    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);
    vi.mocked(idbLoadItems).mockImplementation((colId: string) =>
      Promise.resolve(colId === 'col-1' ? [item] : [item2]),
    );

    const result = await mountHook();
    expect(result.current.trees[0].items[0].name).toBe('Item-item-u');

    await act(async () => {
      await result.current.updateItem({ ...item, name: 'Updated Name' });
    });

    expect(result.current.trees[0].items[0].name).toBe('Updated Name');
    // col-2 tree is returned as-is (false branch of ternary, line 268)
    expect(result.current.trees[1].items[0].name).toBe('Item-item-u2');
  });
});

// ─── markItemExecuted — state update (two collections: covers both !item branches) ─

describe('useGraphqlCollections hook — markItemExecuted', () => {
  it('sets lastExecutedAt on the item in the owning collection, leaves other unchanged (line 303)', async () => {
    const col1 = makeCol('col-1');
    const col2 = makeCol('col-2');
    const item = makeItem('item-exec', 'col-1', 0);
    const item2 = makeItem('item-exec2', 'col-2', 0);
    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);
    vi.mocked(idbLoadItems).mockImplementation((colId: string) =>
      Promise.resolve(colId === 'col-1' ? [item] : [item2]),
    );

    const result = await mountHook();
    expect(result.current.trees[0].items[0].lastExecutedAt).toBeUndefined();

    const before = Date.now();
    await act(async () => {
      await result.current.markItemExecuted('item-exec');
    });

    const afterItem = result.current.trees[0].items.find((i) => i.id === 'item-exec');
    expect(afterItem?.lastExecutedAt).toBeGreaterThanOrEqual(before);
    // col-2's item is returned as-is from the !item branch
    expect(result.current.trees[1].items[0].lastExecutedAt).toBeUndefined();
  });
});

// ─── addFolder — state update ─────────────────────────────────────────────────

describe('useGraphqlCollections hook — addFolder', () => {
  it('appends folder to the correct collection tree', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();
    expect(result.current.trees[0].folders).toHaveLength(0);

    await act(async () => {
      await result.current.addFolder('col-1', 'New Folder');
    });

    expect(result.current.trees[0].folders).toHaveLength(1);
    expect(result.current.trees[0].folders[0].name).toBe('New Folder');
  });
});

// ─── renameFolder — state update ─────────────────────────────────────────────

describe('useGraphqlCollections hook — renameFolder', () => {
  it('updates folder name in state', async () => {
    const col = makeCol('col-1');
    const folder = makeFolder('fld-rename', 'col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([folder]);

    const result = await mountHook();

    await act(async () => {
      await result.current.renameFolder('fld-rename', 'Renamed Folder');
    });

    expect(result.current.trees[0].folders[0].name).toBe('Renamed Folder');
  });
});

// ─── renameCollection — state update ─────────────────────────────────────────

describe('useGraphqlCollections hook — renameCollection', () => {
  it('updates collection name in state', async () => {
    const col = makeCol('col-1', 'Original Name');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();

    await act(async () => {
      await result.current.renameCollection('col-1', 'New Name');
    });

    expect(result.current.trees[0].collection.name).toBe('New Name');
  });
});

// ─── forkCollection — state update ───────────────────────────────────────────

describe('useGraphqlCollections hook — forkCollection', () => {
  it('appends a cloned tree when forking', async () => {
    const col = makeCol('col-orig', 'Original');
    const item = makeItem('item-1', 'col-orig', 0);
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([item]);

    const result = await mountHook();
    expect(result.current.trees).toHaveLength(1);

    await act(async () => {
      await result.current.forkCollection('col-orig', 'Original (fork)');
    });

    expect(result.current.trees).toHaveLength(2);
    const forked = result.current.trees.find((t) => t.collection.name === 'Original (fork)');
    expect(forked).toBeDefined();
    expect(forked?.items).toHaveLength(1);
    expect(forked?.items[0].id).not.toBe('item-1'); // IDs must differ
  });

  it('is a no-op when the collection id does not exist', async () => {
    const result = await mountHook();
    expect(result.current.trees).toHaveLength(0);

    await act(async () => {
      await result.current.forkCollection('nonexistent', 'Fork');
    });

    expect(result.current.trees).toHaveLength(0);
  });
});

// ─── updateCollectionVariables — state update ─────────────────────────────────

describe('useGraphqlCollections hook — updateCollectionVariables', () => {
  it('updates variables in collection state', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();

    await act(async () => {
      await result.current.updateCollectionVariables('col-1', { baseUrl: 'https://api.example.com' });
    });

    expect(result.current.trees[0].collection.variables).toEqual({ baseUrl: 'https://api.example.com' });
  });
});

// ─── updateCollectionScript — state update ────────────────────────────────────

describe('useGraphqlCollections hook — updateCollectionScript', () => {
  it('updates preRequestScript in collection state', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();

    await act(async () => {
      await result.current.updateCollectionScript('col-1', 'preRequestScript', 'console.log("pre");');
    });

    expect(result.current.trees[0].collection.preRequestScript).toBe('console.log("pre");');
  });

  it('updates postResponseScript in collection state', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();

    await act(async () => {
      await result.current.updateCollectionScript('col-1', 'postResponseScript', 'console.log("post");');
    });

    expect(result.current.trees[0].collection.postResponseScript).toBe('console.log("post");');
  });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('useGraphqlCollections hook — loading state', () => {
  it('starts in loading state and settles to false after mount', async () => {
    const result = await mountHook();
    expect(result.current.loading).toBe(false);
  });
});

// ─── makeTree helper - state initialization ────────────────────────────────────

describe('useGraphqlCollections hook — tree initialization', () => {
  it('builds trees from loaded collections, folders, and items', async () => {
    const col1 = makeCol('col-1', 'Alpha');
    const col2 = makeCol('col-2', 'Beta');
    const folder = makeFolder('fld-1', 'col-1');
    const item = makeItem('item-1', 'col-1', 0, 'fld-1');

    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);
    vi.mocked(idbLoadFolders).mockImplementation(async (colId: string) => {
      return colId === 'col-1' ? [folder] : [];
    });
    vi.mocked(idbLoadItems).mockImplementation(async (colId: string) => {
      return colId === 'col-1' ? [item] : [];
    });

    const result = await mountHook();

    expect(result.current.trees).toHaveLength(2);
    const tree1 = result.current.trees.find((t) => t.collection.id === 'col-1');
    expect(tree1?.folders).toHaveLength(1);
    expect(tree1?.items).toHaveLength(1);

    const tree2 = result.current.trees.find((t) => t.collection.id === 'col-2');
    expect(tree2?.folders).toHaveLength(0);
    expect(tree2?.items).toHaveLength(0);
  });
});

// ─── Export / Import — delegates to IDB layer ─────────────────────────────────

describe('useGraphqlCollections hook — export/import', () => {
  it('exportCollections delegates to idbExportCollections', async () => {
    const result = await mountHook();

    await act(async () => {
      await result.current.exportCollections();
    });

    const { idbExportCollections } = await import('../../../shared/utils/idbGraphqlCollections');
    expect(idbExportCollections).toHaveBeenCalled();
  });

  it('importCollections delegates to idbImportCollections', async () => {
    const result = await mountHook();

    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [],
    };

    await act(async () => {
      await result.current.importCollections(payload, 'replace');
    });

    const { idbImportCollections } = await import('../../../shared/utils/idbGraphqlCollections');
    expect(idbImportCollections).toHaveBeenCalledWith(payload, 'replace', undefined);
  });
});

// ─── makeTree used for coverage tracking (export not tested above) ─────────────
void makeTree; // used implicitly above

// ─── renameCollection: covers non-matching collection branch (line 111) ────────

describe('useGraphqlCollections hook — renameCollection with multiple collections', () => {
  it('only renames the matching collection; other collections are returned unchanged', async () => {
    const col1 = makeCol('col-1', 'Original 1');
    const col2 = makeCol('col-2', 'Original 2');
    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);

    const result = await mountHook();

    await act(async () => {
      await result.current.renameCollection('col-1', 'Updated 1');
    });

    expect(result.current.trees[0].collection.name).toBe('Updated 1');
    // col-2 should remain unchanged (covers line 111 false branch)
    expect(result.current.trees[1].collection.name).toBe('Original 2');
  });
});

// ─── forkCollection: covers parentId and folderId ternaries (lines 135, 141) ──

describe('useGraphqlCollections hook — forkCollection with folders and nested items', () => {
  it('forks folders with parentId correctly, preserving remapped parentId (line 135 truthy branch)', async () => {
    const col = makeCol('col-orig', 'Original');
    const rootFolder = makeFolder('fld-root', 'col-orig');
    const childFolder: ReturnType<typeof makeFolder> = { ...makeFolder('fld-child', 'col-orig'), parentId: 'fld-root' };
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([rootFolder, childFolder]);

    const result = await mountHook();

    await act(async () => {
      await result.current.forkCollection('col-orig', 'Fork');
    });

    const forked = result.current.trees.find((t) => t.collection.name === 'Fork')!;
    expect(forked.folders).toHaveLength(2);
    // child folder in fork should have a remapped parentId (not the original 'fld-root')
    const forkedChild = forked.folders.find((f) => f.parentId !== undefined);
    expect(forkedChild?.parentId).not.toBe('fld-root');
  });

  it('forks folders without parentId sets parentId to undefined (line 135 falsy branch)', async () => {
    const col = makeCol('col-orig', 'Original');
    const rootFolder = makeFolder('fld-root', 'col-orig'); // no parentId
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([rootFolder]);

    const result = await mountHook();

    await act(async () => {
      await result.current.forkCollection('col-orig', 'Fork');
    });

    const forked = result.current.trees.find((t) => t.collection.name === 'Fork')!;
    expect(forked.folders[0].parentId).toBeUndefined();
  });

  it('forks items with folderId remapped correctly (line 141 truthy branch)', async () => {
    const col = makeCol('col-orig', 'Original');
    const folder = makeFolder('fld-1', 'col-orig');
    const item: ReturnType<typeof makeItem> = { ...makeItem('item-1', 'col-orig', 0), folderId: 'fld-1' };
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([folder]);
    vi.mocked(idbLoadItems).mockResolvedValue([item]);

    const result = await mountHook();

    await act(async () => {
      await result.current.forkCollection('col-orig', 'Fork');
    });

    const forked = result.current.trees.find((t) => t.collection.name === 'Fork')!;
    // folderId should be remapped (not original 'fld-1')
    expect(forked.items[0].folderId).not.toBe('fld-1');
    expect(forked.items[0].folderId).toBeDefined();
  });

  it('forks items without folderId sets folderId to undefined (line 141 falsy branch)', async () => {
    const col = makeCol('col-orig', 'Original');
    const item = makeItem('item-1', 'col-orig', 0); // folderId = undefined
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([item]);

    const result = await mountHook();

    await act(async () => {
      await result.current.forkCollection('col-orig', 'Fork');
    });

    const forked = result.current.trees.find((t) => t.collection.name === 'Fork')!;
    expect(forked.items[0].folderId).toBeUndefined();
  });
});

// ─── updateCollectionVariables: covers non-matching branch (line 160) ──────────

describe('useGraphqlCollections hook — updateCollectionVariables with multiple collections', () => {
  it('only updates variables on the matching collection; others unchanged', async () => {
    const col1 = makeCol('col-1');
    const col2 = makeCol('col-2');
    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);

    const result = await mountHook();

    await act(async () => {
      await result.current.updateCollectionVariables('col-1', { token: 'abc' });
    });

    expect(result.current.trees[0].collection.variables).toEqual({ token: 'abc' });
    // col-2 should remain with default empty variables (covers line 160 false branch)
    expect(result.current.trees[1].collection.variables).toEqual({});
  });
});

// ─── updateCollectionScript: covers non-matching branch (line 169) ─────────────

describe('useGraphqlCollections hook — updateCollectionScript with multiple collections', () => {
  it('only updates script on the matching collection; others unchanged', async () => {
    const col1 = makeCol('col-1');
    const col2 = makeCol('col-2');
    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);

    const result = await mountHook();

    await act(async () => {
      await result.current.updateCollectionScript('col-1', 'preRequestScript', 'console.log("x");');
    });

    expect(result.current.trees[0].collection.preRequestScript).toBe('console.log("x");');
    // col-2 should remain with default empty script (covers line 169 false branch)
    expect(result.current.trees[1].collection.preRequestScript).toBe('');
  });
});

// ─── addFolder: covers non-matching collection ternary (line 190 false branch) ─

describe('useGraphqlCollections hook — addFolder with multiple collections', () => {
  it('only adds folder to the matching collection; other collections remain unchanged', async () => {
    const col1 = makeCol('col-1');
    const col2 = makeCol('col-2');
    vi.mocked(idbLoadCollections).mockResolvedValue([col1, col2]);

    const result = await mountHook();

    await act(async () => {
      await result.current.addFolder('col-1', 'My Folder');
    });

    expect(result.current.trees[0].folders).toHaveLength(1);
    // col-2 should have no folders (covers the `: t` branch of ternary on line 190)
    expect(result.current.trees[1].folders).toHaveLength(0);
  });

  it('uses sortOrder=0 when collection is not found in trees (line 180 falsy branch)', async () => {
    const col = makeCol('col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);

    const result = await mountHook();

    // Call addFolder with a non-existent collection ID — `tree` will be undefined
    // causing line 180 to take the `: 0` branch for maxSort
    let folder: GraphqlCollectionFolder | undefined;
    await act(async () => {
      folder = await result.current.addFolder('col-nonexistent', 'Orphan Folder');
    });

    expect(folder?.sortOrder).toBe(0);
  });
});

// ─── forkCollection: covers ?? undefined branch (lines 135, 141 nullish branch) ─

describe('useGraphqlCollections hook — forkCollection with orphaned parentId', () => {
  it('remaps parentId to undefined when parentId references a non-existent folder (line 135 ?? branch)', async () => {
    const col = makeCol('col-orig', 'Original');
    // childFolder.parentId points to a folder NOT in the collection — dangling ref
    const orphanChild: ReturnType<typeof makeFolder> = {
      ...makeFolder('fld-orphan', 'col-orig'),
      parentId: 'fld-does-not-exist',
    };
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([orphanChild]);

    const result = await mountHook();

    await act(async () => {
      await result.current.forkCollection('col-orig', 'Fork');
    });

    const forked = result.current.trees.find((t) => t.collection.name === 'Fork')!;
    // The remapped parentId should be undefined since the original parentId was not in the map
    expect(forked.folders[0].parentId).toBeUndefined();
  });

  it('remaps folderId to undefined when folderId references a non-existent folder (line 141 ?? branch)', async () => {
    const col = makeCol('col-orig', 'Original');
    // item.folderId points to a folder NOT in the collection — dangling ref
    const orphanItem: ReturnType<typeof makeItem> = {
      ...makeItem('item-orphan', 'col-orig', 0),
      folderId: 'fld-does-not-exist',
    };
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([orphanItem]);

    const result = await mountHook();

    await act(async () => {
      await result.current.forkCollection('col-orig', 'Fork');
    });

    const forked = result.current.trees.find((t) => t.collection.name === 'Fork')!;
    // The remapped folderId should be undefined since the original folderId was not in the map
    expect(forked.items[0].folderId).toBeUndefined();
  });
});

// ─── renameFolder: no-op when folder not found (line 199 !f branch) ─────────────

describe('useGraphqlCollections hook — renameFolder when folder does not exist', () => {
  it('is a no-op when the folder id does not match any folder', async () => {
    const col = makeCol('col-1');
    const folder = makeFolder('fld-real', 'col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([folder]);

    const result = await mountHook();

    await act(async () => {
      await result.current.renameFolder('nonexistent-fld', 'Some Name');
    });

    // Folder name should be unchanged (covers `if (!f) return t;` on line 199)
    expect(result.current.trees[0].folders[0].name).toBe(folder.name);
  });
});

// ─── renameFolder: covers non-matching folder in map (line 202 false branch) ──

describe('useGraphqlCollections hook — renameFolder with multiple folders', () => {
  it('only renames the matching folder; other folders are returned unchanged', async () => {
    const col = makeCol('col-1');
    const fldA = makeFolder('fld-a', 'col-1');
    const fldB = makeFolder('fld-b', 'col-1');
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadFolders).mockResolvedValue([fldA, fldB]);

    const result = await mountHook();
    const originalB = result.current.trees[0].folders.find((f) => f.id === 'fld-b')!;

    await act(async () => {
      await result.current.renameFolder('fld-a', 'New A Name');
    });

    expect(result.current.trees[0].folders.find((f) => f.id === 'fld-a')!.name).toBe('New A Name');
    // fld-b must remain unchanged (covers the `x` branch of the ternary on line 202)
    expect(result.current.trees[0].folders.find((f) => f.id === 'fld-b')).toBe(originalB);
  });
});

// ─── updateItem: covers non-matching item in map (line 269 false branch) ──────

describe('useGraphqlCollections hook — updateItem with sibling items', () => {
  it('only updates the matching item; sibling items are returned unchanged', async () => {
    const col = makeCol('col-1');
    const item1 = makeItem('item-1', 'col-1', 0);
    const item2 = makeItem('item-2', 'col-1', 1);
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([item1, item2]);

    const result = await mountHook();
    const originalItem2 = result.current.trees[0].items.find((i) => i.id === 'item-2')!;

    await act(async () => {
      await result.current.updateItem({ ...item1, name: 'Updated item 1' });
    });

    expect(result.current.trees[0].items.find((i) => i.id === 'item-1')!.name).toBe('Updated item 1');
    // item-2 must remain unchanged (covers `i` branch of ternary on line 269)
    expect(result.current.trees[0].items.find((i) => i.id === 'item-2')).toBe(originalItem2);
  });
});

// ─── setPinned: covers non-matching item in map (line 294 false branch) ───────

describe('useGraphqlCollections hook — setPinned with sibling items', () => {
  it('only pins the matching item; sibling items are returned unchanged', async () => {
    const col = makeCol('col-1');
    const item1 = makeItem('item-1', 'col-1', 0);
    const item2 = makeItem('item-2', 'col-1', 1);
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([item1, item2]);

    const result = await mountHook();
    const originalItem2 = result.current.trees[0].items.find((i) => i.id === 'item-2')!;

    await act(async () => {
      await result.current.setPinned('item-1', true);
    });

    expect(result.current.trees[0].items.find((i) => i.id === 'item-1')!.isPinned).toBe(true);
    // item-2 must remain the same object (covers `i` branch of ternary on line 294)
    expect(result.current.trees[0].items.find((i) => i.id === 'item-2')).toBe(originalItem2);
  });
});

// ─── markItemExecuted: covers non-matching item (line 304 false branch) ───────

describe('useGraphqlCollections hook — markItemExecuted with sibling items', () => {
  it('only updates the matching item; sibling items are returned unchanged', async () => {
    const col = makeCol('col-1');
    const item1 = makeItem('item-1', 'col-1', 0);
    const item2 = makeItem('item-2', 'col-1', 1);
    vi.mocked(idbLoadCollections).mockResolvedValue([col]);
    vi.mocked(idbLoadItems).mockResolvedValue([item1, item2]);

    const result = await mountHook();
    const originalItem2 = result.current.trees[0].items.find((i) => i.id === 'item-2')!;

    await act(async () => {
      await result.current.markItemExecuted('item-1');
    });

    expect(result.current.trees[0].items.find((i) => i.id === 'item-1')!.lastExecutedAt).toBeDefined();
    // item-2 must remain the same object (covers `i` branch of ternary on line 304)
    expect(result.current.trees[0].items.find((i) => i.id === 'item-2')).toBe(originalItem2);
  });
});

describe('useGraphqlCollections hook — export/import and reload errors', () => {
  it('exportCollections passes collection ids to idbExportCollections', async () => {
    const result = await mountHook();
    await act(async () => {
      await result.current.exportCollections(['col-1']);
    });
    const { idbExportCollections } = await import('../../../shared/utils/idbGraphqlCollections');
    expect(idbExportCollections).toHaveBeenCalledWith(['col-1']);
  });

  it('importCollections passes resolutions map to idbImportCollections', async () => {
    const result = await mountHook();
    const payload = {
      _exportMeta: { version: '1.1' as const, exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' as const },
      collections: [],
    };
    const resolutions = new Map([['c1', 'skip' as const]]);
    await act(async () => {
      await result.current.importCollections(payload, 'merge', resolutions);
    });
    const { idbImportCollections } = await import('../../../shared/utils/idbGraphqlCollections');
    expect(idbImportCollections).toHaveBeenCalledWith(payload, 'merge', resolutions);
  });

  it('swallows reload errors on mount without crashing', async () => {
    vi.mocked(idbLoadCollections).mockRejectedValueOnce(new Error('idb down'));
    const result = await mountHook();
    expect(result.current.loading).toBe(false);
    expect(result.current.trees).toEqual([]);
  });
});
