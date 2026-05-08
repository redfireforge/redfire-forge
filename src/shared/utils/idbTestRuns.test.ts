/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  idbLoadTestRuns,
  idbSaveTestRun,
  idbDeleteTestRun,
  idbSaveTestRunsBulk,
  idbDeleteRunsOlderThan,
  idbClearAllRuns,
  idbGetRunsInfo,
  idbPruneToMax,
  idbMigrateFromLocalStorage,
} from './idbTestRuns';
import type { TestRun } from '../types';

function makeRun(id: string, timestamp: number): TestRun {
  return {
    id,
    timestamp,
    config: { concurrency: 1, totalTransactions: 1, executionMode: 'sequential', scenarioWeights: [] },
    results: [],
  } as unknown as TestRun;
}

// Each test module import gets a fresh fake-indexeddb, but
// the idbTestRuns module caches the DB promise via a module-level variable.
// We need to clear the IDB database between tests.
beforeEach(async () => {
  await idbClearAllRuns();
});

describe('idbTestRuns', () => {
  describe('idbSaveTestRun / idbLoadTestRuns', () => {
    it('saves and loads a test run', async () => {
      const run = makeRun('r1', 1000);
      await idbSaveTestRun(run);
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('r1');
      expect(loaded[0].timestamp).toBe(1000);
    });

    it('returns runs sorted newest-first', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRun(makeRun('r2', 3000));
      await idbSaveTestRun(makeRun('r3', 2000));
      const loaded = await idbLoadTestRuns();
      expect(loaded.map(r => r.id)).toEqual(['r2', 'r3', 'r1']);
    });

    it('upserts existing run (put semantics)', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRun({ ...makeRun('r1', 2000) });
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].timestamp).toBe(2000);
    });
  });

  describe('idbDeleteTestRun', () => {
    it('deletes a run by id', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRun(makeRun('r2', 2000));
      await idbDeleteTestRun('r1');
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('r2');
    });

    it('is a no-op for nonexistent id', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbDeleteTestRun('nonexistent');
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(1);
    });
  });

  describe('idbSaveTestRunsBulk', () => {
    it('replaces all runs with the given list', async () => {
      await idbSaveTestRun(makeRun('old1', 500));
      await idbSaveTestRunsBulk([makeRun('r1', 1000), makeRun('r2', 2000)]);
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(2);
      expect(loaded.map(r => r.id).sort()).toEqual(['r1', 'r2']);
    });

    it('clears everything when called with empty array', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRunsBulk([]);
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('idbDeleteRunsOlderThan', () => {
    it('deletes runs older than cutoff', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRun(makeRun('r2', 2000));
      await idbSaveTestRun(makeRun('r3', 3000));
      const deleted = await idbDeleteRunsOlderThan(2000);
      expect(deleted).toBe(1);
      const loaded = await idbLoadTestRuns();
      expect(loaded.map(r => r.id).sort()).toEqual(['r2', 'r3']);
    });

    it('returns 0 when nothing to delete', async () => {
      await idbSaveTestRun(makeRun('r1', 5000));
      const deleted = await idbDeleteRunsOlderThan(1000);
      expect(deleted).toBe(0);
    });
  });

  describe('idbClearAllRuns', () => {
    it('removes all runs', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRun(makeRun('r2', 2000));
      await idbClearAllRuns();
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('idbGetRunsInfo', () => {
    it('returns count and approximate byte size', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRun(makeRun('r2', 2000));
      const info = await idbGetRunsInfo();
      expect(info.count).toBe(2);
      expect(info.approxBytes).toBeGreaterThan(0);
    });

    it('returns zeros for empty store', async () => {
      const info = await idbGetRunsInfo();
      expect(info.count).toBe(0);
      expect(info.approxBytes).toBe(0);
    });

    it('uses sampling for more than 10 runs', async () => {
      // Save 12 runs to trigger the sampling branch (>10)
      for (let i = 1; i <= 12; i++) {
        await idbSaveTestRun(makeRun(`r${i}`, i * 1000));
      }
      const info = await idbGetRunsInfo();
      expect(info.count).toBe(12);
      // Sampling takes first 5 + last 5 = 10 runs, then extrapolates
      expect(info.approxBytes).toBeGreaterThan(0);
    });

    it('calculates exact size for exactly 10 runs', async () => {
      for (let i = 1; i <= 10; i++) {
        await idbSaveTestRun(makeRun(`r${i}`, i * 1000));
      }
      const info = await idbGetRunsInfo();
      expect(info.count).toBe(10);
      expect(info.approxBytes).toBeGreaterThan(0);
    });
  });

  describe('idbPruneToMax', () => {
    it('keeps only the newest maxRuns runs', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      await idbSaveTestRun(makeRun('r2', 2000));
      await idbSaveTestRun(makeRun('r3', 3000));
      await idbSaveTestRun(makeRun('r4', 4000));
      const deleted = await idbPruneToMax(2);
      expect(deleted).toBe(2);
      const loaded = await idbLoadTestRuns();
      expect(loaded.map(r => r.id)).toEqual(['r4', 'r3']);
    });

    it('returns 0 when count is within limit', async () => {
      await idbSaveTestRun(makeRun('r1', 1000));
      const deleted = await idbPruneToMax(5);
      expect(deleted).toBe(0);
    });
  });

  describe('idbMigrateFromLocalStorage', () => {
    const LS_KEY = 'test_migrate_key';

    beforeEach(() => {
      localStorage.removeItem(LS_KEY);
    });

    it('migrates runs from localStorage to IDB and removes the key', async () => {
      const runs = [makeRun('r1', 1000), makeRun('r2', 2000)];
      localStorage.setItem(LS_KEY, JSON.stringify(runs));
      const migrated = await idbMigrateFromLocalStorage(LS_KEY);
      expect(migrated).toBe(true);
      expect(localStorage.getItem(LS_KEY)).toBeNull();
      const loaded = await idbLoadTestRuns();
      expect(loaded).toHaveLength(2);
    });

    it('returns false when localStorage key does not exist', async () => {
      const migrated = await idbMigrateFromLocalStorage('nonexistent');
      expect(migrated).toBe(false);
    });

    it('returns false for empty array in localStorage', async () => {
      localStorage.setItem(LS_KEY, JSON.stringify([]));
      const migrated = await idbMigrateFromLocalStorage(LS_KEY);
      expect(migrated).toBe(false);
    });

    it('returns false for invalid JSON', async () => {
      localStorage.setItem(LS_KEY, 'not json');
      const migrated = await idbMigrateFromLocalStorage(LS_KEY);
      expect(migrated).toBe(false);
    });
  });
});
