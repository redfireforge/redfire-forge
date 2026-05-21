/**
 * IndexedDB storage backend for trash items (browser only).
 * Same pattern as idbFeatureGroups.ts — single key "all" in "trash" store.
 */

import type { TrashItem } from '../types';
import { openDB } from './idbOpen';

const STORE_NAME = 'trash';

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

export async function idbLoadTrash(): Promise<TrashItem[] | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await tx('readonly');
    const data = await wrap(store.get('all'));
    if (!data) return null;
    return data as TrashItem[];
  } catch {
    return null;
  }
}

export async function idbSaveTrash(items: TrashItem[]): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const store = await tx('readwrite');
  await wrap(store.put(items, 'all'));
}
