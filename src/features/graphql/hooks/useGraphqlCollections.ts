/**
 * useGraphqlCollections — Phase 3A (task 3A-3)
 *
 * IndexedDB-persisted collection + folder + item CRUD.
 * Exposes:
 *  - CRUD for collections, folders, and items
 *  - Drag-and-drop reorder (updates sortOrder in IDB)
 *  - Fork/clone a collection
 *  - Export/import (3A-5)
 *  - Pin/unpin items
 *  - Collection-level variables CRUD (3A-10)
 */

import { useCallback, useEffect, useState } from 'react';
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
  type ImportConflict,
} from '../../../shared/utils/idbGraphqlCollections';
import type {
  GraphqlCollection,
  GraphqlCollectionFolder,
  GraphqlCollectionItem,
  GraphqlOperation,
} from '../../../shared/types/graphql';
import { GQL_COLLECTIONS_RELOAD_EVENT } from '../utils/gqlDemoCollectionsCleanup';

export interface CollectionTree {
  collection: GraphqlCollection;
  folders: GraphqlCollectionFolder[];
  items: GraphqlCollectionItem[];
}

export interface UseGraphqlCollectionsResult {
  trees: CollectionTree[];
  loading: boolean;
  // Collections
  addCollection: (name: string) => Promise<GraphqlCollection>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  forkCollection: (id: string, newName: string) => Promise<void>;
  updateCollectionVariables: (id: string, variables: Record<string, string>) => Promise<void>;
  updateCollectionScript: (id: string, field: 'preRequestScript' | 'postResponseScript', script: string) => Promise<void>;
  // Folders
  addFolder: (collectionId: string, name: string, parentId?: string) => Promise<GraphqlCollectionFolder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  // Items
  addItem: (collectionId: string, folderId: string | undefined, name: string, operation: GraphqlOperation) => Promise<GraphqlCollectionItem>;
  updateItem: (item: GraphqlCollectionItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  reorderItems: (collectionId: string, ordered: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  markItemExecuted: (id: string) => Promise<void>;
  // Export / import
  exportCollections: (collectionIds?: string[]) => Promise<CollectionExportData>;
  importCollections: (data: CollectionExportData, mode: 'replace' | 'merge', resolutions?: Map<string, 'overwrite' | 'keep-both' | 'skip'>) => Promise<ImportConflict[]>;
}

export function useGraphqlCollections(): UseGraphqlCollectionsResult {
  const [trees, setTrees] = useState<CollectionTree[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const collections = await idbLoadCollections();
    const built: CollectionTree[] = await Promise.all(
      collections.map(async (col) => {
        const [folders, items] = await Promise.all([
          idbLoadFolders(col.id),
          idbLoadItems(col.id),
        ]);
        return { collection: col, folders, items };
      }),
    );
    setTrees(built);
  }, []);

  useEffect(() => {
    setLoading(true);
    reload().catch(() => {}).finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    const onReload = () => {
      reload().catch(() => {});
    };
    window.addEventListener(GQL_COLLECTIONS_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(GQL_COLLECTIONS_RELOAD_EVENT, onReload);
  }, [reload]);

  // ── Collections ─────────────────────────────────────────────────────────────

  const addCollection = useCallback(async (name: string): Promise<GraphqlCollection> => {
    const col: GraphqlCollection = {
      id: crypto.randomUUID(),
      name,
      variables: {},
      preRequestScript: '',
      postResponseScript: '',
      createdAt: Date.now(),
    };
    await idbSaveCollection(col);
    setTrees((prev) => [...prev, { collection: col, folders: [], items: [] }]);
    return col;
  }, []);

  const renameCollection = useCallback(async (id: string, name: string) => {
    setTrees((prev) => prev.map((t) => {
      if (t.collection.id !== id) return t;
      const updated = { ...t.collection, name };
      idbSaveCollection(updated).catch(() => {});
      return { ...t, collection: updated };
    }));
  }, []);

  const deleteCollection = useCallback(async (id: string) => {
    await idbDeleteCollection(id);
    setTrees((prev) => prev.filter((t) => t.collection.id !== id));
  }, []);

  const forkCollection = useCallback(async (id: string, newName: string) => {
    const tree = trees.find((t) => t.collection.id === id);
    if (!tree) return;
    const newColId = crypto.randomUUID();
    // First pass: generate new IDs so we can remap parentId references in second pass.
    const folderIdMap = new Map<string, string>();
    for (const f of tree.folders) folderIdMap.set(f.id, crypto.randomUUID());
    // Second pass: build new folder objects with remapped collectionId AND parentId.
    const newFolders = tree.folders.map((f) => ({
      ...f,
      id: folderIdMap.get(f.id)!,
      collectionId: newColId,
      parentId: f.parentId ? (folderIdMap.get(f.parentId) ?? undefined) : undefined,
    }));
    const newItems = tree.items.map((i) => ({
      ...i,
      id: crypto.randomUUID(),
      collectionId: newColId,
      folderId: i.folderId ? (folderIdMap.get(i.folderId) ?? undefined) : undefined,
      lastExecutedAt: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as GraphqlCollectionItem));
    const newCol: GraphqlCollection = {
      ...tree.collection,
      id: newColId,
      name: newName,
      createdAt: Date.now(),
    };
    await idbSaveCollection(newCol);
    for (const f of newFolders) await idbSaveFolder(f);
    for (const i of newItems) await idbSaveItem(i);
    setTrees((prev) => [...prev, { collection: newCol, folders: newFolders, items: newItems }]);
  }, [trees]);

  const updateCollectionVariables = useCallback(async (id: string, variables: Record<string, string>) => {
    setTrees((prev) => prev.map((t) => {
      if (t.collection.id !== id) return t;
      const updated = { ...t.collection, variables };
      idbSaveCollection(updated).catch(() => {});
      return { ...t, collection: updated };
    }));
  }, []);

  const updateCollectionScript = useCallback(async (id: string, field: 'preRequestScript' | 'postResponseScript', script: string) => {
    setTrees((prev) => prev.map((t) => {
      if (t.collection.id !== id) return t;
      const updated = { ...t.collection, [field]: script };
      idbSaveCollection(updated).catch(() => {});
      return { ...t, collection: updated };
    }));
  }, []);

  // ── Folders ─────────────────────────────────────────────────────────────────

  const addFolder = useCallback(async (collectionId: string, name: string, parentId?: string): Promise<GraphqlCollectionFolder> => {
    const tree = trees.find((t) => t.collection.id === collectionId);
    const maxSort = tree ? Math.max(0, ...tree.folders.map((f) => f.sortOrder + 1)) : 0;
    const folder: GraphqlCollectionFolder = {
      id: crypto.randomUUID(),
      collectionId,
      name,
      parentId,
      sortOrder: maxSort,
      createdAt: Date.now(),
    };
    await idbSaveFolder(folder);
    setTrees((prev) => prev.map((t) => t.collection.id === collectionId
      ? { ...t, folders: [...t.folders, folder] }
      : t));
    return folder;
  }, [trees]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    setTrees((prev) => prev.map((t) => {
      const f = t.folders.find((f) => f.id === id);
      if (!f) return t;
      const updated = { ...f, name };
      idbSaveFolder(updated).catch(() => {});
      return { ...t, folders: t.folders.map((x) => x.id === id ? updated : x) };
    }));
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    // Collect the full subtree of folders to delete (BFS from `id`).
    // Must be done before the IDB call so we can read the current trees state.
    const allFolderIdsToDelete = new Set<string>([id]);
    let changed = true;
    // Iterate until no new descendants are discovered.
    while (changed) {
      changed = false;
      for (const tree of trees) {
        for (const f of tree.folders) {
          if (f.parentId && allFolderIdsToDelete.has(f.parentId) && !allFolderIdsToDelete.has(f.id)) {
            allFolderIdsToDelete.add(f.id);
            changed = true;
          }
        }
      }
    }
    // Delete each folder (idbDeleteFolder also deletes its direct items).
    for (const fid of allFolderIdsToDelete) {
      await idbDeleteFolder(fid);
    }
    setTrees((prev) => prev.map((t) => ({
      ...t,
      folders: t.folders.filter((f) => !allFolderIdsToDelete.has(f.id)),
      items: t.items.filter((i) => !i.folderId || !allFolderIdsToDelete.has(i.folderId)),
    })));
  }, [trees]);

  // ── Items ────────────────────────────────────────────────────────────────────

  const addItem = useCallback(async (
    collectionId: string,
    folderId: string | undefined,
    name: string,
    operation: GraphqlOperation,
  ): Promise<GraphqlCollectionItem> => {
    const tree = trees.find((t) => t.collection.id === collectionId);
    const siblings = tree?.items.filter((i) => i.folderId === folderId) ?? [];
    const maxSort = siblings.length > 0 ? Math.max(...siblings.map((i) => i.sortOrder)) + 1 : 0;
    const item: GraphqlCollectionItem = {
      id: crypto.randomUUID(),
      collectionId,
      folderId,
      name,
      sortOrder: maxSort,
      operation,
      isPinned: false,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await idbSaveItem(item);
    setTrees((prev) => prev.map((t) => t.collection.id === collectionId
      ? { ...t, items: [...t.items, item] }
      : t));
    return item;
  }, [trees]);

  const updateItem = useCallback(async (item: GraphqlCollectionItem) => {
    const updated = { ...item, updatedAt: Date.now() };
    await idbSaveItem(updated);
    setTrees((prev) => prev.map((t) => {
      if (t.collection.id !== item.collectionId) return t;
      return { ...t, items: t.items.map((i) => (i.id === item.id ? updated : i)) };
    }));
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    await idbDeleteItem(id);
    setTrees((prev) => prev.map((t) => ({ ...t, items: t.items.filter((i) => i.id !== id) })));
  }, []);

  const reorderItems = useCallback(async (collectionId: string, ordered: Array<{ id: string; sortOrder: number }>) => {
    await idbUpdateItemSortOrders(ordered);
    setTrees((prev) => prev.map((t) => {
      if (t.collection.id !== collectionId) return t;
      const sortMap = new Map(ordered.map((o) => [o.id, o.sortOrder]));
      const updated = t.items.map((i) => sortMap.has(i.id) ? { ...i, sortOrder: sortMap.get(i.id)! } : i);
      return { ...t, items: updated.slice().sort((a, b) => a.sortOrder - b.sortOrder) };
    }));
  }, []);

  const setPinned = useCallback(async (id: string, pinned: boolean) => {
    setTrees((prev) => prev.map((t) => {
      const item = t.items.find((i) => i.id === id);
      if (!item) return t;
      const updated = { ...item, isPinned: pinned, updatedAt: Date.now() };
      idbSaveItem(updated).catch(() => {});
      return { ...t, items: t.items.map((i) => i.id === id ? updated : i) };
    }));
  }, []);

  const markItemExecuted = useCallback(async (id: string) => {
    setTrees((prev) => prev.map((t) => {
      const item = t.items.find((i) => i.id === id);
      if (!item) return t;
      const updated = { ...item, lastExecutedAt: Date.now(), updatedAt: Date.now() };
      idbSaveItem(updated).catch(() => {});
      return { ...t, items: t.items.map((i) => i.id === id ? updated : i) };
    }));
  }, []);

  // ── Export / Import ──────────────────────────────────────────────────────────

  const exportCollections = useCallback((ids?: string[]) => idbExportCollections(ids), []);

  const importCollections = useCallback(async (
    data: CollectionExportData,
    mode: 'replace' | 'merge',
    resolutions?: Map<string, 'overwrite' | 'keep-both' | 'skip'>,
  ): Promise<ImportConflict[]> => {
    const conflicts = await idbImportCollections(data, mode, resolutions);
    // Always reload — in merge mode, non-conflicting collections may have already been written.
    await reload();
    return conflicts;
  }, [reload]);

  return {
    trees,
    loading,
    addCollection,
    renameCollection,
    deleteCollection,
    forkCollection,
    updateCollectionVariables,
    updateCollectionScript,
    addFolder,
    renameFolder,
    deleteFolder,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    setPinned,
    markItemExecuted,
    exportCollections,
    importCollections,
  };
}
