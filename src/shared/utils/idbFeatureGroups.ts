/**
 * IndexedDB storage backend for feature groups (browser only).
 * Provides effectively unlimited storage compared to localStorage's ~5MB cap.
 *
 * Schema: DB "redfireforge", object store "featureGroups", single key "all".
 * Feature groups are stored as a single JSON blob for atomic reads/writes.
 */

import type { FeatureGroup } from '../types';
import { openDB } from './idbOpen';

const STORE_NAME = 'featureGroups';

/** Check if IndexedDB is available (not in Node/test environments). */
function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(db => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Load all feature groups from IndexedDB. */
export async function idbLoadFeatureGroups(): Promise<FeatureGroup[] | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await tx('readonly');
    const data = await wrap(store.get('all'));
    if (!data) return null;
    return data as FeatureGroup[];
  } catch {
    return null;
  }
}

/** Save all feature groups to IndexedDB. Throws if IDB is unavailable. */
export async function idbSaveFeatureGroups(fgs: FeatureGroup[]): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const store = await tx('readwrite');
  await wrap(store.put(fgs, 'all'));
}

/**
 * Migrate feature groups from localStorage to IndexedDB (one-time).
 * Reads from the given key, writes to IDB, then removes from localStorage.
 */
export async function idbMigrateFeatureGroups(lsKey: string): Promise<boolean> {
  if (!idbAvailable()) return false;
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return false;
    const fgs: FeatureGroup[] = JSON.parse(raw);
    if (!Array.isArray(fgs) || fgs.length === 0) return false;
    await idbSaveFeatureGroups(fgs);
    localStorage.removeItem(lsKey);
    return true;
  } catch {
    return false;
  }
}
