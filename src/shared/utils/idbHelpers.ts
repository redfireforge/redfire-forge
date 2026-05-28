import { openDB } from './idbOpen';

export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getObjectStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export interface IdbBlobStore<T> {
  load(): Promise<T | null>;
  save(data: T): Promise<void>;
  migrate(lsKey: string): Promise<boolean>;
}

export function createIdbBlobStore<T>(
  storeName: string,
  validate: (data: unknown) => boolean = (data) => !!data,
): IdbBlobStore<T> {
  async function load(): Promise<T | null> {
    if (!idbAvailable()) return null;
    try {
      const store = await getObjectStore(storeName, 'readonly');
      const data = await wrap(store.get('all'));
      if (!data) return null;
      return data as T;
    } catch {
      return null;
    }
  }

  async function save(data: T): Promise<void> {
    if (!idbAvailable()) throw new Error('IndexedDB not available');
    const store = await getObjectStore(storeName, 'readwrite');
    await wrap(store.put(data, 'all'));
  }

  async function migrate(lsKey: string): Promise<boolean> {
    if (!idbAvailable()) return false;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return false;
      const items = JSON.parse(raw);
      if (!validate(items)) return false;
      await save(items as T);
      localStorage.removeItem(lsKey);
      return true;
    } catch {
      return false;
    }
  }

  return { load, save, migrate };
}
