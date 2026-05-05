/**
 * IndexedDB storage backend for shared data sources (browser only).
 * Same pattern as idbFeatureGroups.ts — single key "all" in "sharedDataSources" store.
 */

import type { SharedDataSource } from '../types';
import { openDB } from './idbOpen';

const STORE_NAME = 'sharedDataSources';

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

/** Load all shared data sources from IndexedDB. */
export async function idbLoadSharedDataSources(): Promise<SharedDataSource[] | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await tx('readonly');
    const data = await wrap(store.get('all'));
    if (!data) return null;
    return data as SharedDataSource[];
  } catch {
    return null;
  }
}

/** Save all shared data sources to IndexedDB. */
export async function idbSaveSharedDataSources(sources: SharedDataSource[]): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const store = await tx('readwrite');
  await wrap(store.put(sources, 'all'));
}

/**
 * Migrate shared data sources from localStorage to IndexedDB (one-time).
 */
export async function idbMigrateSharedDataSources(lsKey: string): Promise<boolean> {
  if (!idbAvailable()) return false;
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return false;
    const sources: SharedDataSource[] = JSON.parse(raw);
    if (!Array.isArray(sources) || sources.length === 0) return false;
    await idbSaveSharedDataSources(sources);
    localStorage.removeItem(lsKey);
    return true;
  } catch {
    return false;
  }
}
