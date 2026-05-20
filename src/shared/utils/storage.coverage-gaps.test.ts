/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { isTauriMock, tauriGetItem, tauriSetItem, tauriGetUsage } = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  tauriGetItem: vi.fn(async (): Promise<string | null> => null),
  tauriSetItem: vi.fn(async () => {}),
  tauriGetUsage: vi.fn(async () => ({ usedBytes: 0, entries: {} as Record<string, number> })),
}));

vi.mock('./platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('./tauriStore', () => ({
  getItem: (key: string) => tauriGetItem(key),
  setItem: (key: string, value: string) => tauriSetItem(key, value),
  getUsageBytes: () => tauriGetUsage(),
}));

const { idbStore } = vi.hoisted(() => {
  const store: Record<string, unknown> = {};
  return { idbStore: store };
});

let _idbInsertOrder = 0;

vi.mock('./idbTestRuns', () => {
  type TR = { id: string; timestamp?: number; _insertOrder?: number; [k: string]: unknown };
  const getRuns = (): TR[] => {
    const all = Object.values(idbStore) as TR[];
    all.sort((a, b) => {
      const td = (b.timestamp ?? 0) - (a.timestamp ?? 0);
      if (td !== 0) return td;
      return (b._insertOrder ?? 0) - (a._insertOrder ?? 0);
    });
    return all;
  };
  return {
    idbLoadTestRuns: vi.fn(async () => getRuns()),
    idbSaveTestRun: vi.fn(async (run: TR) => {
      idbStore[run.id] = { ...run, _insertOrder: ++_idbInsertOrder };
    }),
    idbDeleteTestRun: vi.fn(async (id: string) => {
      delete idbStore[id];
    }),
    idbSaveTestRunsBulk: vi.fn(async (runs: TR[]) => {
      for (const k of Object.keys(idbStore)) delete idbStore[k];
      for (const r of runs) idbStore[r.id] = { ...r, _insertOrder: ++_idbInsertOrder };
    }),
    idbPruneToMax: vi.fn(async (max: number) => {
      const all = getRuns();
      if (all.length <= max) return 0;
      const toDelete = all.slice(max);
      for (const r of toDelete) delete idbStore[r.id];
      return toDelete.length;
    }),
    idbMigrateFromLocalStorage: vi.fn(async () => false),
    idbGetRunsInfo: vi.fn(async () => {
      const all = getRuns();
      return { count: all.length, approxBytes: JSON.stringify(all).length * 2 };
    }),
    idbDeleteRunsOlderThan: vi.fn(async (cutoff: number) => {
      const all = getRuns();
      const toDelete = all.filter(r => (r.timestamp ?? 0) < cutoff);
      for (const r of toDelete) delete idbStore[r.id];
      return toDelete.length;
    }),
    idbClearAllRuns: vi.fn(async () => {
      for (const k of Object.keys(idbStore)) delete idbStore[k];
    }),
  };
});

const fgIdb = vi.hoisted(() => ({
  idbLoadFeatureGroups: vi.fn(async () => null as import('../types').FeatureGroup[] | null),
  idbSaveFeatureGroups: vi.fn(async () => {}),
  idbMigrateFeatureGroups: vi.fn(async () => false),
}));

vi.mock('./idbFeatureGroups', () => ({
  idbLoadFeatureGroups: () => fgIdb.idbLoadFeatureGroups(),
  idbSaveFeatureGroups: (fgs: import('../types').FeatureGroup[]) => fgIdb.idbSaveFeatureGroups(fgs),
  idbMigrateFeatureGroups: (key: string) => fgIdb.idbMigrateFeatureGroups(key),
}));

const sharedIdb = vi.hoisted(() => ({
  idbLoadSharedDataSources: vi.fn(async () => null as import('../types').SharedDataSource[] | null),
  idbSaveSharedDataSources: vi.fn(async () => {}),
  idbMigrateSharedDataSources: vi.fn(async () => false),
}));

vi.mock('./idbSharedDataSources', () => ({
  idbLoadSharedDataSources: () => sharedIdb.idbLoadSharedDataSources(),
  idbSaveSharedDataSources: (s: import('../types').SharedDataSource[]) => sharedIdb.idbSaveSharedDataSources(s),
  idbMigrateSharedDataSources: (key: string) => sharedIdb.idbMigrateSharedDataSources(key),
}));

import { saveTestRun, forceSaveTestRun, loadTestRuns, updateTestRun, deleteTestRun, deleteRunsOlderThan, clearAllTestRuns, setMaxRuns, getStorageUsage, saveFeatureGroups, loadFeatureGroups, saveSharedDataSources, loadSharedDataSources, loadPreviewSampleId, savePreviewSampleId, loadTestRunsLite, loadTraceForRun, loadRunnerConfig, loadWorkflowFolders, saveWorkflowFolders, } from './storage';
import { SharedDataSource, TestRun } from '../types';
import { idbSaveTestRun, idbLoadTestRuns, idbGetRunsInfo, } from './idbTestRuns';

function makeRun(id: string, overrides: Partial<TestRun> = {}): TestRun {
  return {
    id,
    timestamp: Date.now(),
    config: {
      concurrency: 1,
      iterations: 1,
      scenarioWeights: [],
      executionMode: 'sequential',
    },
    summary: {
      tps: 1,
      avgResponseTime: 100,
      minResponseTime: 50,
      maxResponseTime: 150,
      p95ResponseTime: 140,
      p99ResponseTime: 148,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: 1,
      successfulRequests: 1,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs: 1000,
    },
    results: [
      {
        id: 'r0',
        scenarioId: 's1',
        scenarioName: 'Test',
        url: 'http://api/test',
        method: 'GET',
        httpStatus: 200,
        responseTimeMs: 100,
        responseBody: '{}',
        timestamp: Date.now(),
        passed: true,
        validationMode: 'none',
        failureDetails: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  for (const k of Object.keys(idbStore)) delete idbStore[k];
  _idbInsertOrder = 0;
  isTauriMock.mockReturnValue(false);
  tauriGetItem.mockReset();
  tauriGetItem.mockResolvedValue(null);
  tauriSetItem.mockReset();
  tauriSetItem.mockResolvedValue(undefined);
  tauriGetUsage.mockReset();
  tauriGetUsage.mockResolvedValue({ usedBytes: 0, entries: {} });
  fgIdb.idbLoadFeatureGroups.mockImplementation(async () => null);
  fgIdb.idbSaveFeatureGroups.mockImplementation(async () => {});
  fgIdb.idbMigrateFeatureGroups.mockImplementation(async () => false);
  sharedIdb.idbLoadSharedDataSources.mockImplementation(async () => null);
  sharedIdb.idbSaveSharedDataSources.mockImplementation(async () => {});
  sharedIdb.idbMigrateSharedDataSources.mockImplementation(async () => false);
});

describe('storage — coverage gaps (Tauri test runs)', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockImplementation(async (key: string) => localStorage.getItem(key));
    tauriSetItem.mockImplementation(async (key: string, value: string) => {
      localStorage.setItem(key, value);
    });
  });

  it('saveTestRun trims to maxRuns when over limit in Tauri mode', async () => {
    await setMaxRuns(1);
    await saveTestRun(makeRun('first'));
    await saveTestRun(makeRun('second'));
    const loaded = await loadTestRuns();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('second');
  });

  it('saveTestRun does not trim when under maxRuns in Tauri mode', async () => {
    await setMaxRuns(50);
    const { ok } = await saveTestRun(makeRun('single'));
    expect(ok).toBe(true);
    expect((await loadTestRuns())).toHaveLength(1);
  });

  it('deleteRunsOlderThan skips write when nothing is deleted (Tauri)', async () => {
    await saveTestRun(makeRun('recent', { timestamp: 50_000 }));
    expect(await deleteRunsOlderThan(1000)).toBe(0);
  });

  it('saveTestRun returns ok when write succeeds', async () => {
    const { ok, quotaError } = await saveTestRun(makeRun('t-ok'));
    expect(ok).toBe(true);
    expect(quotaError).toBeUndefined();
    const loaded = await loadTestRuns();
    expect(loaded[0].id).toBe('t-ok');
  });

  it('setMaxRuns prunes Tauri-backed runs when over max', async () => {
    await saveTestRun(makeRun('a'));
    await saveTestRun(makeRun('b'));
    await saveTestRun(makeRun('c'));
    await setMaxRuns(2);
    const loaded = await loadTestRuns();
    expect(loaded).toHaveLength(2);
  });

  it('deleteTestRun removes a run in Tauri mode', async () => {
    await saveTestRun(makeRun('keep'));
    await saveTestRun(makeRun('drop'));
    await deleteTestRun('drop');
    expect((await loadTestRuns()).map((r) => r.id)).toEqual(['keep']);
  });

  it('deleteRunsOlderThan deletes older runs in Tauri mode', async () => {
    const oldTs = 1000;
    const newTs = 5000;
    await saveTestRun(makeRun('old', { timestamp: oldTs }));
    await saveTestRun(makeRun('new', { timestamp: newTs }));
    const n = await deleteRunsOlderThan(3000);
    expect(n).toBe(1);
    expect((await loadTestRuns()).map((r) => r.id)).toEqual(['new']);
  });

  it('clearAllTestRuns empties runs in Tauri mode', async () => {
    await saveTestRun(makeRun('x'));
    await clearAllTestRuns();
    expect(await loadTestRuns()).toEqual([]);
  });

  it('loadTestRuns returns [] when JSON parse fails in Tauri mode', async () => {
    localStorage.setItem('perf-test-runs', '{');
    expect(await loadTestRuns()).toEqual([]);
  });

  it('updateTestRun replaces an existing run in Tauri mode', async () => {
    await saveTestRun(makeRun('u1', { summary: { ...makeRun('').summary, tps: 1 } }));
    const updated = makeRun('u1', { summary: { ...makeRun('').summary, tps: 99 } });
    expect((await updateTestRun(updated)).ok).toBe(true);
    expect((await loadTestRuns())[0].summary.tps).toBe(99);
  });

  it('updateTestRun returns ok false when id is missing in Tauri mode', async () => {
    await saveTestRun(makeRun('only'));
    expect((await updateTestRun(makeRun('missing'))).ok).toBe(false);
  });

  it('updateTestRun returns ok false when write fails in Tauri mode', async () => {
    await saveTestRun(makeRun('wr'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    expect((await updateTestRun(makeRun('wr', { summary: { ...makeRun('').summary, tps: 3 } }))).ok).toBe(false);
    vi.restoreAllMocks();
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockImplementation(async (key: string) => localStorage.getItem(key));
    tauriSetItem.mockImplementation(async (key: string, value: string) => {
      localStorage.setItem(key, value);
    });
  });
});

describe('storage — coverage gaps (browser test runs)', () => {
  it('forceSaveTestRun returns ok true when IndexedDB save succeeds', async () => {
    expect(await forceSaveTestRun(makeRun('browser-force-ok'))).toEqual({ ok: true });
    const loaded = await loadTestRuns();
    expect(loaded.some((r) => r.id === 'browser-force-ok')).toBe(true);
  });

  it('saveTestRun returns quotaError when idbSaveTestRun throws', async () => {
    vi.mocked(idbSaveTestRun).mockRejectedValueOnce(new Error('idb full'));
    const { ok, quotaError } = await saveTestRun(makeRun('q'));
    expect(ok).toBe(false);
    expect(quotaError).toBe(true);
  });

  it('forceSaveTestRun returns ok false when idb save throws', async () => {
    vi.mocked(idbSaveTestRun).mockRejectedValueOnce(new Error('idb full'));
    expect(await forceSaveTestRun(makeRun('f'))).toEqual({ ok: false });
  });

  it('updateTestRun upserts in IndexedDB path', async () => {
    await saveTestRun(makeRun('idb-up'));
    expect((await updateTestRun(makeRun('idb-up', { summary: { ...makeRun('').summary, tps: 42 } }))).ok).toBe(true);
    expect((await loadTestRuns())[0].summary.tps).toBe(42);
  });

  it('updateTestRun returns ok false when idb put fails', async () => {
    await saveTestRun(makeRun('bad-up'));
    vi.mocked(idbSaveTestRun).mockRejectedValueOnce(new Error('fail'));
    expect((await updateTestRun(makeRun('bad-up'))).ok).toBe(false);
  });

  it('loadTestRuns returns [] when idb load throws', async () => {
    vi.mocked(idbLoadTestRuns).mockRejectedValueOnce(new Error('idb'));
    expect(await loadTestRuns()).toEqual([]);
  });

  it('deleteRunsOlderThan delegates to idb in browser mode', async () => {
    await saveTestRun(makeRun('o', { timestamp: 10 }));
    await saveTestRun(makeRun('n', { timestamp: 20_000 }));
    expect(await deleteRunsOlderThan(15_000)).toBe(1);
  });

  it('clearAllTestRuns clears idb in browser mode', async () => {
    await saveTestRun(makeRun('z'));
    await clearAllTestRuns();
    expect(await loadTestRuns()).toEqual([]);
  });
});

describe('storage — getStorageUsage IndexedDB info', () => {
  it('includes test-runs (IndexedDB) entry when runs exist', async () => {
    await saveTestRun(makeRun('usage-run'));
    const { entries, usedBytes } = await getStorageUsage();
    expect(entries['test-runs (IndexedDB)']).toBeGreaterThan(0);
    expect(usedBytes).toBeGreaterThanOrEqual(entries['test-runs (IndexedDB)'] ?? 0);
  });

  it('ignores idb runs info when idbGetRunsInfo throws', async () => {
    vi.mocked(idbGetRunsInfo).mockRejectedValueOnce(new Error('no idb'));
    await saveTestRun(makeRun('x'));
    const { usedBytes } = await getStorageUsage();
    expect(usedBytes).toBeGreaterThanOrEqual(0);
  });
});

describe('storage — feature groups / shared DS branches', () => {
  it('saveFeatureGroups uses JSON path when Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    tauriSetItem.mockImplementation(async (k: string, v: string) => {
      localStorage.setItem(k, v);
    });
    await saveFeatureGroups([{ id: 'fg', name: 'G', scenarios: [] }]);
    expect(localStorage.getItem('perf-test-v3-feature-groups')).toContain('fg');
  });

  it('loadFeatureGroups reads JSON when Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{ id: 'tfg', name: 'T', scenarios: [] }]));
    tauriGetItem.mockImplementation(async (key: string) => localStorage.getItem(key));
    const fgs = await loadFeatureGroups();
    expect(fgs).toHaveLength(1);
    expect(fgs[0].id).toBe('tfg');
  });

  it('loadFeatureGroups runs dataSource migration loops for empty scenarios', async () => {
    fgIdb.idbLoadFeatureGroups.mockResolvedValueOnce([{ id: 'empty-sc', name: 'E', scenarios: [] }]);
    await expect(loadFeatureGroups()).resolves.toEqual([{ id: 'empty-sc', name: 'E', scenarios: [] }]);
  });

  it('loadFeatureGroups prefers IndexedDB when it returns data', async () => {
    fgIdb.idbLoadFeatureGroups.mockResolvedValueOnce([{ id: 'from-idb', name: 'I', scenarios: [] }]);
    const fgs = await loadFeatureGroups();
    expect(fgs[0].id).toBe('from-idb');
  });

  it('saveFeatureGroups removes stale localStorage copy after IDB save', async () => {
    localStorage.setItem('perf-test-v3-feature-groups', '[]');
    await saveFeatureGroups([{ id: 'n', name: 'N', scenarios: [] }]);
    expect(localStorage.getItem('perf-test-v3-feature-groups')).toBeNull();
  });

  it('saveFeatureGroups does not remove localStorage when key was absent', async () => {
    expect(localStorage.getItem('perf-test-v3-feature-groups')).toBeNull();
    await saveFeatureGroups([{ id: 'clean', name: 'C', scenarios: [] }]);
    expect(localStorage.getItem('perf-test-v3-feature-groups')).toBeNull();
  });

  it('migrates legacy dataTable to dataSource on load', async () => {
    const dt = {
      id: 'ds1',
      columns: [],
      rows: [],
      source: { type: 'inline' as const },
    };
    localStorage.setItem(
      'perf-test-v3-feature-groups',
      JSON.stringify([
        {
          id: 'fg',
          name: 'F',
          scenarios: [
            {
              id: 'sc',
              name: 'S',
              tests: [
                {
                  id: 't1',
                  name: 'T',
                  url: 'http://x',
                  method: 'GET',
                  headers: [],
                  body: '',
                  auth: { type: 'none' },
                  validation: { mode: 'none' },
                  dataTable: dt,
                },
              ],
            },
          ],
        },
      ]),
    );

    const fgs = await loadFeatureGroups();
    const test = fgs[0].scenarios![0].tests![0];
    expect(test.dataSource).toEqual(dt);
    expect('dataTable' in test).toBe(false);
  });

  it('skips dataTable rename when dataSource is already set', async () => {
    const ds = {
      id: 'ds2',
      columns: [],
      rows: [],
      source: { type: 'inline' as const },
    };
    localStorage.setItem(
      'perf-test-v3-feature-groups',
      JSON.stringify([
        {
          id: 'fg2',
          name: 'F2',
          scenarios: [
            {
              id: 'sc',
              name: 'S',
              tests: [
                {
                  id: 't1',
                  name: 'T',
                  url: 'http://x',
                  method: 'GET',
                  headers: [],
                  body: '',
                  auth: { type: 'none' },
                  validation: { mode: 'none' },
                  dataSource: ds,
                  dataTable: { id: 'legacy', columns: [], rows: [], source: { type: 'inline' } },
                },
              ],
            },
          ],
        },
      ]),
    );
    const fgs = await loadFeatureGroups();
    expect(fgs[0].scenarios![0].tests![0].dataSource).toEqual(ds);
    expect((fgs[0].scenarios![0].tests![0] as unknown as Record<string, unknown>)['dataTable']).toBeDefined();
  });

  it('saveSharedDataSources uses JSON when Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    tauriSetItem.mockImplementation(async (k: string, v: string) => {
      localStorage.setItem(k, v);
    });
    const sds: SharedDataSource[] = [
      {
        id: 'sd',
        name: 'S',
        dataSource: { id: 'd', columns: [], rows: [], source: { type: 'inline' } },
        updatedAt: 1,
      },
    ];
    await saveSharedDataSources(sds);
    expect(localStorage.getItem('perf-test-v3-shared-data-sources')).toContain('sd');
  });

  it('loadSharedDataSources reads JSON when Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    const blob = [
      {
        id: 'sd',
        name: 'S',
        dataSource: { id: 'd', columns: [], rows: [], source: { type: 'inline' } },
        updatedAt: 1,
      },
    ];
    localStorage.setItem('perf-test-v3-shared-data-sources', JSON.stringify(blob));
    tauriGetItem.mockImplementation(async (key: string) => localStorage.getItem(key));
    const loaded = await loadSharedDataSources();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('sd');
  });

  it('loadSharedDataSources returns IDB when first load is non-null', async () => {
    const row: SharedDataSource[] = [
      {
        id: 'direct-idb',
        name: 'D',
        dataSource: { id: 'd', columns: [], rows: [], source: { type: 'inline' } },
        updatedAt: 2,
      },
    ];
    sharedIdb.idbLoadSharedDataSources.mockResolvedValueOnce(row);
    await expect(loadSharedDataSources()).resolves.toEqual(row);
  });

  it('loadSharedDataSources reads localStorage when migration leaves IDB empty', async () => {
    const lsBlob: SharedDataSource[] = [
      {
        id: 'ls-fallback',
        name: 'L',
        dataSource: { id: 'd', columns: [], rows: [], source: { type: 'inline' } },
        updatedAt: 3,
      },
    ];
    sharedIdb.idbLoadSharedDataSources.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    sharedIdb.idbMigrateSharedDataSources.mockResolvedValueOnce(true);
    localStorage.setItem('perf-test-v3-shared-data-sources', JSON.stringify(lsBlob));
    await expect(loadSharedDataSources()).resolves.toEqual(lsBlob);
  });

  it('loadSharedDataSources returns IDB after successful migration', async () => {
    const migrated: SharedDataSource[] = [
      {
        id: 'm1',
        name: 'M',
        dataSource: { id: 'd', columns: [], rows: [], source: { type: 'inline' } },
        updatedAt: 1,
      },
    ];
    sharedIdb.idbLoadSharedDataSources
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(migrated);
    sharedIdb.idbMigrateSharedDataSources.mockResolvedValueOnce(true);
    localStorage.setItem('perf-test-v3-shared-data-sources', JSON.stringify(migrated));

    const loaded = await loadSharedDataSources();
    expect(loaded).toEqual(migrated);
  });

  it('loadSharedDataSources falls back to JSON when outer try fails', async () => {
    sharedIdb.idbLoadSharedDataSources.mockRejectedValueOnce(new Error('idb'));
    const blob = [
      {
        id: 'fb',
        name: 'F',
        dataSource: { id: 'd', columns: [], rows: [], source: { type: 'inline' } },
        updatedAt: 1,
      },
    ];
    localStorage.setItem('perf-test-v3-shared-data-sources', JSON.stringify(blob));
    const loaded = await loadSharedDataSources();
    expect(loaded[0].id).toBe('fb');
  });
});

describe('storage — preview sample sessionStorage errors', () => {
  it('loadPreviewSampleId returns null when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadPreviewSampleId()).toBeNull();
    vi.restoreAllMocks();
  });

  it('savePreviewSampleId ignores errors when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => savePreviewSampleId('x')).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('storage — Tauri branches for loadTestRunsLite', () => {
  it('returns runs without compressedTrace in Tauri mode', async () => {
    isTauriMock.mockReturnValue(true);
    const runs = [
      { id: 'r1', compressedTrace: 'large-data', hasTrace: false, timestamp: 1 },
      { id: 'r2', timestamp: 2 },
    ];
    tauriGetItem.mockResolvedValue(JSON.stringify(runs));
    const result = await loadTestRunsLite();
    expect(result).toHaveLength(2);
    expect(result[0].hasTrace).toBe(true);
    expect((result[0] as Record<string, unknown>).compressedTrace).toBeUndefined();
    expect(result[1].id).toBe('r2');
  });

  it('returns empty array when Tauri storage is empty', async () => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockResolvedValue(null);
    const result = await loadTestRunsLite();
    expect(result).toEqual([]);
  });

  it('returns empty array when Tauri storage throws', async () => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockRejectedValue(new Error('disk error'));
    const result = await loadTestRunsLite();
    expect(result).toEqual([]);
  });
});

describe('storage — Tauri branches for loadTraceForRun', () => {
  it('returns compressedTrace for matching run in Tauri mode', async () => {
    isTauriMock.mockReturnValue(true);
    const runs = [
      { id: 'r1', compressedTrace: 'trace-data-1', timestamp: 1 },
      { id: 'r2', compressedTrace: 'trace-data-2', timestamp: 2 },
    ];
    tauriGetItem.mockResolvedValue(JSON.stringify(runs));
    const result = await loadTraceForRun('r2');
    expect(result).toBe('trace-data-2');
  });

  it('returns undefined for non-matching run in Tauri mode', async () => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockResolvedValue(JSON.stringify([{ id: 'r1', compressedTrace: 'x' }]));
    const result = await loadTraceForRun('no-match');
    expect(result).toBeUndefined();
  });

  it('returns undefined when Tauri storage is empty', async () => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockResolvedValue(null);
    const result = await loadTraceForRun('r1');
    expect(result).toBeUndefined();
  });

  it('returns undefined when Tauri storage throws', async () => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockRejectedValue(new Error('disk error'));
    const result = await loadTraceForRun('r1');
    expect(result).toBeUndefined();
  });
});

describe('storage — loadRunnerConfig legacy migration', () => {
  it('migrates totalTransactions to iterations', async () => {
    isTauriMock.mockReturnValue(false);
    const legacy = { totalTransactions: 100, concurrency: 5 };
    localStorage.setItem('perf-test-runner-config', JSON.stringify(legacy));
    const result = await loadRunnerConfig();
    expect(result).toEqual(expect.objectContaining({ iterations: 100, concurrency: 5 }));
    expect((result as Record<string, unknown>).totalTransactions).toBeUndefined();
  });
});

describe('storage — workflowFolders', () => {
  it('loadWorkflowFolders returns empty array when no data', async () => {
    isTauriMock.mockReturnValue(false);
    localStorage.removeItem('workflow_folders');
    const result = await loadWorkflowFolders();
    expect(result).toEqual([]);
  });

  it('saveWorkflowFolders and loadWorkflowFolders round-trip', async () => {
    isTauriMock.mockReturnValue(false);
    const folders = [{ id: 'f1', name: 'Folder 1', children: [] }];
    await saveWorkflowFolders(folders as never[]);
    const loaded = await loadWorkflowFolders();
    expect(loaded).toEqual(folders);
  });

  it('loadWorkflowFolders returns empty on parse error', async () => {
    isTauriMock.mockReturnValue(false);
    localStorage.setItem('workflow_folders', 'not-json');
    const result = await loadWorkflowFolders();
    expect(result).toEqual([]);
  });
});
