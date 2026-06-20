/**
 * Shared IndexedDB connection for the "redfireforge" database.
 * Both idbTestRuns.ts and idbFeatureGroups.ts must use this single
 * openDB() so only one connection/upgrade request is ever in flight.
 *
 * Includes a 3-second timeout: if IDB never responds (e.g. corrupted state,
 * DevTools holding a lock), we reject so callers can fall back to localStorage.
 */

const DB_NAME = 'redfireforge';
const DB_VERSION = 6; // v6: adds 5 graphql Phase-3 stores (history, collections, folders, schema-snapshots, diff-acks)
const OPEN_TIMEOUT_MS = 3000;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const timer = setTimeout(() => {
      // Keep dbPromise cached so subsequent callers get an instant rejection
      // instead of starting a new 3-second timeout each time.
      reject(new Error('IndexedDB open timed out'));
    }, OPEN_TIMEOUT_MS);

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('testRuns')) {
        const store = db.createObjectStore('testRuns', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('featureGroups')) {
        db.createObjectStore('featureGroups');
      }
      if (!db.objectStoreNames.contains('sharedDataSources')) {
        db.createObjectStore('sharedDataSources');
      }
      if (!db.objectStoreNames.contains('trash')) {
        db.createObjectStore('trash');
      }
      // v5: large-data stores migrated from localStorage
      if (!db.objectStoreNames.contains('workflows')) {
        db.createObjectStore('workflows');
      }
      if (!db.objectStoreNames.contains('workflowFolders')) {
        db.createObjectStore('workflowFolders');
      }
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests');
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog');
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects');
      }
      // v6: GraphQL Studio Phase 3 stores
      if (!db.objectStoreNames.contains('graphql-history')) {
        const historyStore = db.createObjectStore('graphql-history', { keyPath: 'id' });
        historyStore.createIndex('connectionId', 'connectionId', { unique: false });
        historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        // Compound index for efficient per-connection chronological range queries.
        // Supports IDBKeyRange.bound([connectionId, 0], [connectionId, Infinity]).
        historyStore.createIndex('connectionId_timestamp', ['connectionId', 'timestamp'], { unique: false });
      }
      if (!db.objectStoreNames.contains('graphql-collections')) {
        const colStore = db.createObjectStore('graphql-collections', { keyPath: 'id' });
        colStore.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('graphql-collection-folders')) {
        const folderStore = db.createObjectStore('graphql-collection-folders', { keyPath: 'id' });
        folderStore.createIndex('collectionId', 'collectionId', { unique: false });
        folderStore.createIndex('parentId', 'parentId', { unique: false });
        // Compound index for ordered folder loads within a collection.
        folderStore.createIndex('collectionId_sortOrder', ['collectionId', 'sortOrder'], { unique: false });
      }
      if (!db.objectStoreNames.contains('graphql-collection-items')) {
        const itemStore = db.createObjectStore('graphql-collection-items', { keyPath: 'id' });
        itemStore.createIndex('collectionId', 'collectionId', { unique: false });
        itemStore.createIndex('folderId', 'folderId', { unique: false });
        // Compound index for ordered item loads within a folder.
        itemStore.createIndex('collectionId_sortOrder', ['collectionId', 'sortOrder'], { unique: false });
      }
      if (!db.objectStoreNames.contains('graphql-schema-snapshots')) {
        const snapStore = db.createObjectStore('graphql-schema-snapshots', { keyPath: 'id' });
        snapStore.createIndex('connectionId', 'connectionId', { unique: false });
        snapStore.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('graphql-diff-acknowledgements')) {
        const ackStore = db.createObjectStore('graphql-diff-acknowledgements', { keyPath: 'id' });
        ackStore.createIndex('connectionId', 'connectionId', { unique: false });
        ackStore.createIndex('snapshotId', 'snapshotId', { unique: false });
      }
    };
    req.onblocked = () => {
      clearTimeout(timer);
      dbPromise = null;
      try { req.result?.close(); } catch { /* ignore */ }
      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onsuccess = () => { openDB().then(resolve, reject); };
      del.onerror = () => reject(new Error('IndexedDB blocked and delete failed'));
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      clearTimeout(timer);
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}
