/**
 * IndexedDB storage backend for test runs (browser only).
 * Provides effectively unlimited storage compared to localStorage's ~5MB cap.
 *
 * Schema: DB "redfireforge", object store "testRuns", keyPath "id".
 * Runs are stored individually (one record per run) for efficient CRUD.
 */

import type { TestRun } from '../types';
import { openDB } from './idbOpen';

const STORE_NAME = 'testRuns';

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(db => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Load all test runs, sorted newest-first. */
export async function idbLoadTestRuns(): Promise<TestRun[]> {
  const store = await tx('readonly');
  const all: TestRun[] = await wrap(store.getAll());
  all.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return all;
}

/**
 * Load all test runs WITHOUT compressedTrace (lightweight).
 * Sets hasTrace=true if compressedTrace existed. Used for dashboard list loading.
 */
export async function idbLoadTestRunsLite(): Promise<TestRun[]> {
  const store = await tx('readonly');
  const all: TestRun[] = await wrap(store.getAll());
  all.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return all.map(run => {
    if (!run.compressedTrace) return run;
    const { compressedTrace: _, ...lite } = run;
    return { ...lite, hasTrace: true };
  });
}

/**
 * Load only the compressedTrace for a single run by ID.
 * Returns the compressed string, or undefined if not found / no trace.
 */
export async function idbLoadTrace(runId: string): Promise<string | undefined> {
  const store = await tx('readonly');
  const run: TestRun | undefined = await wrap(store.get(runId));
  return run?.compressedTrace;
}

/** Save (put) a single test run. */
export async function idbSaveTestRun(run: TestRun): Promise<void> {
  const store = await tx('readwrite');
  await wrap(store.put(run));
}

/** Delete a single test run by id. */
export async function idbDeleteTestRun(runId: string): Promise<void> {
  const store = await tx('readwrite');
  await wrap(store.delete(runId));
}

/** Bulk-replace all test runs. */
export async function idbSaveTestRunsBulk(runs: TestRun[]): Promise<void> {
  const db = await openDB();
  const txn = db.transaction(STORE_NAME, 'readwrite');
  const store = txn.objectStore(STORE_NAME);
  // Clear then re-insert
  store.clear();
  for (const run of runs) {
    store.put(run);
  }
  return new Promise((resolve, reject) => {
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

/** Delete runs older than a cutoff timestamp. Returns number deleted. */
export async function idbDeleteRunsOlderThan(cutoffMs: number): Promise<number> {
  const all = await idbLoadTestRuns();
  const toDelete = all.filter(r => (r.timestamp ?? 0) < cutoffMs);
  if (toDelete.length === 0) return 0;
  const store = await tx('readwrite');
  for (const r of toDelete) store.delete(r.id);
  return toDelete.length;
}

/** Delete all test runs. */
export async function idbClearAllRuns(): Promise<void> {
  const store = await tx('readwrite');
  await wrap(store.clear());
}

/** Get count and approximate size of stored runs. */
export async function idbGetRunsInfo(): Promise<{ count: number; approxBytes: number }> {
  const all = await idbLoadTestRuns();
  // Estimate size by serializing (sampling for speed)
  let approxBytes = 0;
  if (all.length <= 10) {
    approxBytes = all.reduce((sum, r) => sum + JSON.stringify(r).length * 2, 0);
  } else {
    // Sample 10 runs, extrapolate
    const sample = all.slice(0, 5).concat(all.slice(-5));
    const sampleSize = sample.reduce((sum, r) => sum + JSON.stringify(r).length * 2, 0);
    approxBytes = Math.round((sampleSize / sample.length) * all.length);
  }
  return { count: all.length, approxBytes };
}

/** Prune to keep only the newest `maxRuns` runs. Returns number deleted. */
export async function idbPruneToMax(maxRuns: number): Promise<number> {
  const all = await idbLoadTestRuns(); // sorted newest-first
  if (all.length <= maxRuns) return 0;
  const toDelete = all.slice(maxRuns);
  const store = await tx('readwrite');
  for (const r of toDelete) store.delete(r.id);
  return toDelete.length;
}

/**
 * Migrate runs from localStorage to IndexedDB (one-time).
 * Reads from the given key, writes to IDB, then removes from localStorage.
 */
export async function idbMigrateFromLocalStorage(lsKey: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return false;
    const runs: TestRun[] = JSON.parse(raw);
    if (!Array.isArray(runs) || runs.length === 0) return false;
    await idbSaveTestRunsBulk(runs);
    localStorage.removeItem(lsKey);
    return true;
  } catch {
    return false;
  }
}
