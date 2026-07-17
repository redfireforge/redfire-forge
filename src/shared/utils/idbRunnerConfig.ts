/**
 * Runner configuration (Test Runner / Workflow Runner UI prefs) in IndexedDB.
 * Keeps perf-test-runner-config* out of the ~5 MB localStorage quota.
 */
import { RUNNER_CONFIG_KEY } from './storageKeys';
import { getObjectStore, idbAvailable, wrap } from './idbHelpers';

export const RUNNER_CONFIGS_STORE = 'runnerConfigs';

/** Max distinct env/svc/runner context keys retained in IDB. */
export const MAX_RUNNER_CONFIG_ENTRIES = 16;

export interface RunnerConfigRecord {
  savedAt: number;
  payload: string;
}

function contextKeyToId(contextKey: string): string {
  return contextKey || '__default__';
}

export async function idbLoadRunnerConfig(contextKey: string): Promise<string | null> {
  if (!idbAvailable()) return null;
  try {
    const store = await getObjectStore(RUNNER_CONFIGS_STORE, 'readonly');
    const row = await wrap(store.get(contextKeyToId(contextKey))) as RunnerConfigRecord | undefined;
    return row?.payload ?? null;
  } catch {
    return null;
  }
}

export async function idbSaveRunnerConfig(contextKey: string, payload: string): Promise<void> {
  if (!idbAvailable()) throw new Error('IndexedDB not available');
  const id = contextKeyToId(contextKey);
  const store = await getObjectStore(RUNNER_CONFIGS_STORE, 'readwrite');
  await wrap(store.put({ savedAt: Date.now(), payload } satisfies RunnerConfigRecord, id));
  await idbPruneRunnerConfigs(MAX_RUNNER_CONFIG_ENTRIES, new Set([id]));
}

export async function idbListRunnerConfigIds(): Promise<string[]> {
  if (!idbAvailable()) return [];
  try {
    const store = await getObjectStore(RUNNER_CONFIGS_STORE, 'readonly');
    return await wrap(store.getAllKeys()) as string[];
  } catch {
    return [];
  }
}

export async function idbPruneRunnerConfigs(
  maxEntries: number,
  alwaysKeep: Set<string> = new Set(),
): Promise<number> {
  if (!idbAvailable() || maxEntries < 1) return 0;
  try {
    const store = await getObjectStore(RUNNER_CONFIGS_STORE, 'readwrite');
    const rows = await wrap(store.getAll()) as RunnerConfigRecord[];
    const keys = await wrap(store.getAllKeys()) as string[];
    if (keys.length <= maxEntries) return 0;

    const indexed = keys.map((key, i) => ({
      key,
      savedAt: rows[i]?.savedAt ?? 0,
    }));
    indexed.sort((a, b) => b.savedAt - a.savedAt);

    let removed = 0;
    for (const { key } of indexed) {
      if (indexed.length - removed <= maxEntries) break;
      if (alwaysKeep.has(key)) continue;
      await wrap(store.delete(key));
      removed++;
    }
    return removed;
  } catch {
    return 0;
  }
}

function legacyLocalStorageKey(contextKey: string): string {
  return contextKey ? `${RUNNER_CONFIG_KEY}:${contextKey}` : RUNNER_CONFIG_KEY;
}

/** One-time (or repeat-safe) migration of perf-test-runner-config* keys from localStorage. */
export async function idbMigrateRunnerConfigsFromLocalStorage(): Promise<number> {
  if (!idbAvailable()) return 0;
  let migrated = 0;
  const toRemove: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key !== RUNNER_CONFIG_KEY && !key.startsWith(`${RUNNER_CONFIG_KEY}:`)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const contextKey = key === RUNNER_CONFIG_KEY
        ? ''
        : key.slice(RUNNER_CONFIG_KEY.length + 1);

      try {
        await idbSaveRunnerConfig(contextKey, raw);
        toRemove.push(key);
        migrated++;
      } catch { /* keep in LS until next attempt */ }
    }
  } catch { /* ignore */ }

  for (const key of toRemove) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  return migrated;
}

/** Remove any remaining runner-config keys from localStorage (data lives in IDB). */
export function purgeRunnerConfigLocalStorageKeys(activeContextKey?: string): { removed: number; freedBytes: number } {
  const keep = new Set<string>();
  if (activeContextKey) keep.add(legacyLocalStorageKey(activeContextKey));

  let removed = 0;
  let freedBytes = 0;
  const toRemove: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key !== RUNNER_CONFIG_KEY && !key.startsWith(`${RUNNER_CONFIG_KEY}:`)) continue;
      if (keep.has(key)) continue;
      toRemove.push(key);
    }
  } catch { /* ignore */ }

  for (const key of toRemove) {
    freedBytes += (localStorage.getItem(key) ?? '').length * 2;
    localStorage.removeItem(key);
    removed++;
  }
  return { removed, freedBytes };
}
