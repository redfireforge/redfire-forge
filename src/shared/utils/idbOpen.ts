/**
 * Shared IndexedDB connection for the "redfireforge" database.
 * Both idbTestRuns.ts and idbFeatureGroups.ts must use this single
 * openDB() so only one connection/upgrade request is ever in flight.
 *
 * Includes a 3-second timeout: if IDB never responds (e.g. corrupted state,
 * DevTools holding a lock), we reject so callers can fall back to localStorage.
 */

const DB_NAME = 'redfireforge';
const DB_VERSION = 4;
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
