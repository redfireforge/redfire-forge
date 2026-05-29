/**
 * IndexedDB storage backend for trash items (browser only).
 * Same pattern as idbFeatureGroups.ts — single key "all" in "trash" store.
 */

import type { TrashItem } from '../types';
import { idbAvailable, wrap, getObjectStore } from './idbHelpers';

const STORE_NAME = 'trash';

export async function idbLoadTrash(): Promise<TrashItem[] | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await getObjectStore(STORE_NAME,'readonly');
    const data = await wrap(store.get('all'));
    if (!data) return null;
    return data as TrashItem[];
  } catch {
    return null;
  }
}

export async function idbSaveTrash(items: TrashItem[]): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const store = await getObjectStore(STORE_NAME,'readwrite');
  await wrap(store.put(items, 'all'));
}
