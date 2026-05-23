import { isTauri } from './platform';
import { readKey, writeKey } from './storage';

export interface DualModeArrayStorageConfig<T> {
  key: string;
  idbLoad: () => Promise<T[] | null>;
  idbSave: (data: T[]) => Promise<void>;
  idbMigrate: (lsKey: string) => Promise<boolean>;
  swallowWriteErrors?: boolean;
}

async function writeJson(key: string, data: unknown, swallowWriteErrors: boolean): Promise<void> {
  const payload = JSON.stringify(data);
  if (swallowWriteErrors) {
    try {
      await writeKey(key, payload);
    } catch { /* QuotaExceededError — already logged and notified by writeKey */ }
    return;
  }
  await writeKey(key, payload);
}

export function createDualModeArrayStorage<T>(config: DualModeArrayStorageConfig<T>): {
  load(): Promise<T[]>;
  save(data: T[]): Promise<void>;
} {
  const { key, idbLoad, idbSave, idbMigrate, swallowWriteErrors = false } = config;

  return {
    async load(): Promise<T[]> {
      if (isTauri()) {
        try {
          const r = await readKey(key);
          return r ? JSON.parse(r) : [];
        } catch {
          return [];
        }
      }
      try {
        const fromIdb = await idbLoad();
        if (fromIdb) return fromIdb;
        const r = await readKey(key);
        if (r) {
          const items = JSON.parse(r);
          if (Array.isArray(items) && items.length > 0) await idbMigrate(key);
          return Array.isArray(items) ? items : [];
        }
      } catch { /* ignore */ }
      return [];
    },

    async save(data: T[]): Promise<void> {
      if (isTauri()) {
        await writeJson(key, data, swallowWriteErrors);
        return;
      }
      try {
        await idbSave(data);
        if (localStorage.getItem(key)) localStorage.removeItem(key);
      } catch {
        await writeJson(key, data, swallowWriteErrors);
      }
    },
  };
}
