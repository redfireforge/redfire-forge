/**
 * Shared IndexedDB connection for the "redfireforge" database.
 * Both idbTestRuns.ts and idbFeatureGroups.ts must use this single
 * openDB() so only one connection/upgrade request is ever in flight.
 *
 * Includes a 3-second timeout: if IDB never responds (e.g. corrupted state,
 * DevTools holding a lock), we reject so callers can fall back to localStorage.
 */

const DB_NAME = 'redfireforge';
const DB_VERSION = 10; // v10: runnerConfigs — move perf-test-runner-config off localStorage
const OPEN_TIMEOUT_MS = 10_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDBInternal(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }

    const timer = setTimeout(() => {
      dbPromise = null;
      try { req.result?.close(); } catch { /* ignore */ }
      reject(new Error('IndexedDB open timed out'));
    }, OPEN_TIMEOUT_MS);

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
      // v7: app config blobs — free localStorage quota for selection keys / runner config
      if (!db.objectStoreNames.contains('environments')) {
        db.createObjectStore('environments');
      }
      if (!db.objectStoreNames.contains('microservices')) {
        db.createObjectStore('microservices');
      }
      // v8: global auth profiles — keeps localStorage headroom for small prefs
      if (!db.objectStoreNames.contains('globalAuthProfiles')) {
        db.createObjectStore('globalAuthProfiles');
      }
      // v9: GraphQL Studio — free localStorage for demo/introspection workloads
      if (!db.objectStoreNames.contains('gqlStudioTabs')) {
        db.createObjectStore('gqlStudioTabs');
      }
      if (!db.objectStoreNames.contains('gqlStudioEnvironments')) {
        db.createObjectStore('gqlStudioEnvironments');
      }
      if (!db.objectStoreNames.contains('gqlConnectionProfiles')) {
        db.createObjectStore('gqlConnectionProfiles');
      }
      if (!db.objectStoreNames.contains('gqlPageAuth')) {
        db.createObjectStore('gqlPageAuth');
      }
      if (!db.objectStoreNames.contains('gqlSchemaCache')) {
        db.createObjectStore('gqlSchemaCache');
      }
      // v10: runner UI config (env/svc/workflow-runner) — frees localStorage quota
      if (!db.objectStoreNames.contains('runnerConfigs')) {
        db.createObjectStore('runnerConfigs');
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
}

/** Shared IndexedDB handle — retries open after transient timeout/error. */
export function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDBInternal().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}
