/**
 * Low-level IndexedDB operations for GraphQL collections, folders, and items.
 *
 * Stores used (all created in idbOpen.ts v6 migration):
 *   graphql-collections        — GraphqlCollection root objects
 *   graphql-collection-folders — GraphqlCollectionFolder objects
 *   graphql-collection-items   — GraphqlCollectionItem objects
 *
 * Export/import format: _exportMeta v1.1 (plan 3A-5).
 * Replace-mode import uses a single IDB transaction for atomicity (plan 3A-12).
 */

import { openDB } from './idbOpen';
import { wrap, txComplete } from './idbHelpers';
import type {
  GraphqlCollection,
  GraphqlCollectionFolder,
  GraphqlCollectionItem,
} from '../types/graphql';

// Convenience alias used in normalization casts
type PartialFolder = Partial<GraphqlCollectionFolder>;
type PartialItem   = Partial<GraphqlCollectionItem>;

export const COL_STORE    = 'graphql-collections';
export const FOLDER_STORE = 'graphql-collection-folders';
export const ITEM_STORE   = 'graphql-collection-items';

// ─── Collections ──────────────────────────────────────────────────────────────

export async function idbLoadCollections(): Promise<GraphqlCollection[]> {
  const db = await openDB();
  return (await wrap(db.transaction(COL_STORE, 'readonly').objectStore(COL_STORE).getAll())) as GraphqlCollection[];
}

export async function idbSaveCollection(col: GraphqlCollection): Promise<void> {
  const db = await openDB();
  await wrap(db.transaction(COL_STORE, 'readwrite').objectStore(COL_STORE).put(col));
}

export async function idbDeleteCollection(id: string): Promise<void> {
  const db = await openDB();

  // Phase 1: collect all folder/item IDs to cascade-delete (parallel reads, readonly tx).
  const readTx = db.transaction([FOLDER_STORE, ITEM_STORE], 'readonly');
  const [folderIds, itemIds] = (await Promise.all([
    wrap(readTx.objectStore(FOLDER_STORE).index('collectionId').getAllKeys(IDBKeyRange.only(id))),
    wrap(readTx.objectStore(ITEM_STORE).index('collectionId').getAllKeys(IDBKeyRange.only(id))),
  ])) as [string[], string[]];

  // Phase 2: queue all deletes synchronously on a single readwrite tx, then
  // await txComplete to avoid the IDB auto-commit between awaits pitfall.
  const writeTx = db.transaction([COL_STORE, FOLDER_STORE, ITEM_STORE], 'readwrite');
  writeTx.objectStore(COL_STORE).delete(id);
  for (const fid of folderIds) writeTx.objectStore(FOLDER_STORE).delete(fid);
  for (const iid of itemIds) writeTx.objectStore(ITEM_STORE).delete(iid);
  await txComplete(writeTx);
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function idbLoadFolders(collectionId: string): Promise<GraphqlCollectionFolder[]> {
  const db = await openDB();
  const tx = db.transaction(FOLDER_STORE, 'readonly');
  const index = tx.objectStore(FOLDER_STORE).index('collectionId');
  const folders = (await wrap(index.getAll(IDBKeyRange.only(collectionId)))) as GraphqlCollectionFolder[];
  return folders.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function idbSaveFolder(folder: GraphqlCollectionFolder): Promise<void> {
  const db = await openDB();
  await wrap(db.transaction(FOLDER_STORE, 'readwrite').objectStore(FOLDER_STORE).put(folder));
}

export async function idbDeleteFolder(id: string): Promise<void> {
  const db = await openDB();

  // Phase 1: collect item IDs to cascade-delete (readonly).
  const readTx = db.transaction(ITEM_STORE, 'readonly');
  const itemIds = (await wrap(readTx.objectStore(ITEM_STORE).index('folderId').getAllKeys(IDBKeyRange.only(id)))) as string[];

  // Phase 2: queue all deletes synchronously, then await txComplete.
  const writeTx = db.transaction([FOLDER_STORE, ITEM_STORE], 'readwrite');
  writeTx.objectStore(FOLDER_STORE).delete(id);
  for (const iid of itemIds) writeTx.objectStore(ITEM_STORE).delete(iid);
  await txComplete(writeTx);
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function idbLoadItems(collectionId: string): Promise<GraphqlCollectionItem[]> {
  const db = await openDB();
  const tx = db.transaction(ITEM_STORE, 'readonly');
  const index = tx.objectStore(ITEM_STORE).index('collectionId');
  const items = (await wrap(index.getAll(IDBKeyRange.only(collectionId)))) as GraphqlCollectionItem[];
  return items.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function idbSaveItem(item: GraphqlCollectionItem): Promise<void> {
  // Variables JSON validation (plan 3A-16): reject malformed JSON before write.
  const vars = item.operation.variables ?? '';
  if (vars.trim() && vars.trim() !== '{}') {
    try { JSON.parse(vars); } catch {
      throw new Error('Variables must be valid JSON');
    }
  }
  const db = await openDB();
  await wrap(db.transaction(ITEM_STORE, 'readwrite').objectStore(ITEM_STORE).put(item));
}

export async function idbDeleteItem(id: string): Promise<void> {
  const db = await openDB();
  await wrap(db.transaction(ITEM_STORE, 'readwrite').objectStore(ITEM_STORE).delete(id));
}

export async function idbUpdateItemSortOrders(updates: { id: string; sortOrder: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const db = await openDB();

  // Phase 1: read all items that need updating in parallel (readonly tx).
  const readTx = db.transaction(ITEM_STORE, 'readonly');
  const store = readTx.objectStore(ITEM_STORE);
  const items = (await Promise.all(
    updates.map(({ id }) => wrap(store.get(id))),
  )) as Array<GraphqlCollectionItem | undefined>;

  // Phase 2: queue all puts synchronously on a fresh readwrite tx.
  const writeTx = db.transaction(ITEM_STORE, 'readwrite');
  const writeStore = writeTx.objectStore(ITEM_STORE);
  for (let i = 0; i < updates.length; i++) {
    const item = items[i];
    if (item) writeStore.put({ ...item, sortOrder: updates[i].sortOrder });
  }
  await txComplete(writeTx);
}

// ─── Export / Import ──────────────────────────────────────────────────────────

export interface CollectionExportData {
  _exportMeta: { version: '1.1'; exportedAt: string; source: 'RedfireForge/GraphQL' };
  collections: Array<{
    collection: GraphqlCollection;
    folders: GraphqlCollectionFolder[];
    items: GraphqlCollectionItem[];
  }>;
}

export async function idbExportCollections(collectionIds?: string[]): Promise<CollectionExportData> {
  const allCols = await idbLoadCollections();
  const selected = collectionIds
    ? allCols.filter((c) => collectionIds.includes(c.id))
    : allCols;

  const payload: CollectionExportData['collections'] = [];
  for (const col of selected) {
    const folders = await idbLoadFolders(col.id);
    const items = await idbLoadItems(col.id);
    payload.push({ collection: col, folders, items });
  }
  return {
    _exportMeta: { version: '1.1', exportedAt: new Date().toISOString(), source: 'RedfireForge/GraphQL' },
    collections: payload,
  };
}

export interface ImportConflict {
  id: string;
  name: string;
  resolution?: 'overwrite' | 'keep-both' | 'skip';
}

/**
 * Replace-mode: delete all existing collections + items in a SINGLE transaction (atomic).
 * Merge-mode: import into existing, returning a list of ID conflicts for the caller to resolve.
 */
export async function idbImportCollections(
  data: CollectionExportData,
  mode: 'replace' | 'merge',
  conflictResolutions?: Map<string, 'overwrite' | 'keep-both' | 'skip'>,
): Promise<ImportConflict[]> {
  // v1.0 backward compat: add defaults for missing fields
  const normalised = normalizeImportData(data);

  if (mode === 'replace') {
    await idbReplaceAllCollections(normalised);
    return [];
  }
  return idbMergeCollections(normalised, conflictResolutions ?? new Map());
}

async function idbReplaceAllCollections(data: CollectionExportData): Promise<void> {
  const db = await openDB();
  // All operations are queued synchronously on one transaction — no await between them.
  // This ensures the transaction stays open throughout and can only commit once all
  // requests are complete (IDB auto-commit safety).
  const tx = db.transaction([COL_STORE, FOLDER_STORE, ITEM_STORE], 'readwrite');
  tx.objectStore(COL_STORE).clear();
  tx.objectStore(FOLDER_STORE).clear();
  tx.objectStore(ITEM_STORE).clear();
  for (const { collection, folders, items } of data.collections) {
    tx.objectStore(COL_STORE).put(collection);
    for (const f of folders) tx.objectStore(FOLDER_STORE).put(f);
    for (const i of items) tx.objectStore(ITEM_STORE).put(i);
  }
  // Await the single transaction-complete event — not individual request results.
  await txComplete(tx);
}

async function idbMergeCollections(
  data: CollectionExportData,
  resolutions: Map<string, 'overwrite' | 'keep-both' | 'skip'>,
): Promise<ImportConflict[]> {
  const db = await openDB();
  const existing = await idbLoadCollections();
  const existingIds = new Set(existing.map((c) => c.id));
  const conflicts: ImportConflict[] = [];

  for (const { collection, folders, items } of data.collections) {
    if (existingIds.has(collection.id)) {
      const resolution = resolutions.get(collection.id);
      if (!resolution) {
        conflicts.push({ id: collection.id, name: collection.name });
        continue;
      }
      if (resolution === 'skip') continue;
      if (resolution === 'keep-both') {
        const newId = crypto.randomUUID();
        const renamedCol = { ...collection, id: newId, name: `${collection.name} (imported)` };
        // Build folderIdMap FIRST so parentId can be remapped for nested folders.
        const folderIdMap = new Map(folders.map((f) => [f.id, crypto.randomUUID()]));
        const renamedFolders = folders.map((f) => ({
          ...f,
          id: folderIdMap.get(f.id)!,
          collectionId: newId,
          parentId: f.parentId ? (folderIdMap.get(f.parentId) ?? f.parentId) : undefined,
        }));
        const renamedItems = items.map((i) => ({
          ...i,
          id: crypto.randomUUID(),
          collectionId: newId,
          folderId: i.folderId ? (folderIdMap.get(i.folderId) ?? i.folderId) : undefined,
        }));
        // Queue all writes synchronously — no await between requests on this tx.
        const tx = db.transaction([COL_STORE, FOLDER_STORE, ITEM_STORE], 'readwrite');
        tx.objectStore(COL_STORE).put(renamedCol);
        for (const f of renamedFolders) tx.objectStore(FOLDER_STORE).put(f);
        for (const i of renamedItems) tx.objectStore(ITEM_STORE).put(i);
        await txComplete(tx);
        continue;
      }
      // 'overwrite' — atomically delete existing and re-insert in one transaction.
      // Previous implementation used two separate transactions (delete then insert)
      // which is non-atomic: a failure between them could leave the collection deleted
      // with no replacement. Instead, we collect existing IDs to cascade-delete, then
      // perform delete + insert in a single readwrite transaction.
      const readTx = db.transaction([FOLDER_STORE, ITEM_STORE], 'readonly');
      const [existFolderIds, existItemIds] = (await Promise.all([
        wrap(readTx.objectStore(FOLDER_STORE).index('collectionId').getAllKeys(IDBKeyRange.only(collection.id))),
        wrap(readTx.objectStore(ITEM_STORE).index('collectionId').getAllKeys(IDBKeyRange.only(collection.id))),
      ])) as [string[], string[]];

      const overwriteTx = db.transaction([COL_STORE, FOLDER_STORE, ITEM_STORE], 'readwrite');
      // Delete existing data
      overwriteTx.objectStore(COL_STORE).delete(collection.id);
      for (const fid of existFolderIds) overwriteTx.objectStore(FOLDER_STORE).delete(fid);
      for (const iid of existItemIds) overwriteTx.objectStore(ITEM_STORE).delete(iid);
      // Insert new data
      overwriteTx.objectStore(COL_STORE).put(collection);
      for (const f of folders) overwriteTx.objectStore(FOLDER_STORE).put(f);
      for (const i of items) overwriteTx.objectStore(ITEM_STORE).put(i);
      await txComplete(overwriteTx);
      continue;
    }
    // New collection — queue all inserts synchronously.
    const tx = db.transaction([COL_STORE, FOLDER_STORE, ITEM_STORE], 'readwrite');
    tx.objectStore(COL_STORE).put(collection);
    for (const f of folders) tx.objectStore(FOLDER_STORE).put(f);
    for (const i of items) tx.objectStore(ITEM_STORE).put(i);
    await txComplete(tx);
  }
  return conflicts;
}

function normalizeImportData(data: CollectionExportData): CollectionExportData {
  const now = Date.now();
  return {
    ...data,
    collections: data.collections.map(({ collection, folders, items }) => ({
      collection: {
        // Spread first, then provide defaults for fields absent in v1.0 data
        ...collection,
        variables: collection.variables ?? {},
        preRequestScript: collection.preRequestScript ?? '',
        postResponseScript: collection.postResponseScript ?? '',
        // createdAt is required — default to now if absent in older export formats
        createdAt: collection.createdAt ?? now,
      },
      folders: folders.map((f, fi) => ({
        // Spread first; override collectionId/sortOrder only when absent (v1.0 had neither).
        ...(f as PartialFolder),
        collectionId: (f as PartialFolder).collectionId ?? collection.id,
        sortOrder: (f as PartialFolder).sortOrder ?? fi,
        // createdAt is required — default to now if absent in older export formats
        createdAt: (f as PartialFolder).createdAt ?? now,
      } as GraphqlCollectionFolder)),
      items: items.map((i, ii) => {
        const partial = i as PartialItem;
        // Validate operation.variables JSON — imported items may have malformed
        // variables (plan 3A-16). Reset to '' rather than silently writing corrupt
        // data that would only fail at execution time.
        let variables = partial.operation?.variables ?? '';
        if (variables.trim() && variables.trim() !== '{}') {
          try { JSON.parse(variables); } catch { variables = ''; }
        }
        // Guard against items missing the required `operation` field in malformed
        // export data (e.g. hand-crafted or partially-written files). Provide a
        // placeholder so downstream code always has a non-null operation to work with.
        const baseOperation = partial.operation ?? {
          id: crypto.randomUUID(),
          query: '',
          operationType: 'query' as const,
        };
        const operation = { ...baseOperation, variables };
        return {
          ...partial,
          operation: operation as GraphqlCollectionItem['operation'],
          collectionId: partial.collectionId ?? collection.id,
          sortOrder:    partial.sortOrder    ?? ii,
          isPinned:     partial.isPinned     ?? false,
          tags:         partial.tags         ?? [],
          // Both createdAt and updatedAt are required — default to now if absent
          createdAt:    partial.createdAt    ?? now,
          updatedAt:    partial.updatedAt    ?? partial.createdAt ?? now,
        } as GraphqlCollectionItem;
      }),
    })),
  };
}
