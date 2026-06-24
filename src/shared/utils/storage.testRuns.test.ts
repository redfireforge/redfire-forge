/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
    idbSaveTestRun: vi.fn(async (run: TR) => { idbStore[run.id] = { ...run, _insertOrder: ++_idbInsertOrder }; }),
    idbDeleteTestRun: vi.fn(async (id: string) => { delete idbStore[id]; }),
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

import {
  saveTestRun,
  forceSaveTestRun,
  loadTestRuns,
  deleteTestRun,
  saveTestRunsBulk,
  setMaxRuns,
  getMaxRuns,
  loadEnvironments,
  loadMicroservices,
  loadFeatureGroups,
  loadGlobalAuthProfiles,
  loadRunnerConfig,
  loadRequests,
  loadCatalogEntries,
  loadCatalogRawSpec,
  loadCatalogEndpointValues,
  onStorageFull,
  writeKey,
} from './storage';
import type { TestRun } from '../types';

function makeRun(id: string, results: number = 1): TestRun {
  return {
    id,
    timestamp: Date.now(),
    config: {
      concurrency: 1, iterations: results,
      scenarioWeights: [], executionMode: 'sequential',
    },
    summary: {
      tps: 1, avgResponseTime: 100, minResponseTime: 50, maxResponseTime: 150,
      p95ResponseTime: 140, p99ResponseTime: 148, errorRate: 0,
      errorsByStatus: {}, totalRequests: results, successfulRequests: results,
      failedRequests: 0, failedValidations: 0, totalDurationMs: 1000,
    },
    results: Array.from({ length: results }, (_, i) => ({
      id: `r${i}`,
      scenarioId: 's1',
      scenarioName: 'Test',
      url: 'http://api/test',
      method: 'GET',
      httpStatus: 200,
      responseTimeMs: 100,
      responseBody: '{"ok":true}',
      timestamp: Date.now(),
      passed: true,
      validationMode: 'none' as const,
      failureDetails: [],
    })),
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
});

describe('storage — test runs', () => {
  it('saves and loads a test run', async () => {
    const run = makeRun('run-1');
    const { ok } = await saveTestRun(run);
    expect(ok).toBe(true);

    const loaded = await loadTestRuns();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('run-1');
  });

  it('prepends new runs (newest first)', async () => {
    await saveTestRun(makeRun('run-1'));
    await saveTestRun(makeRun('run-2'));
    const loaded = await loadTestRuns();
    expect(loaded[0].id).toBe('run-2');
    expect(loaded[1].id).toBe('run-1');
  });

  it('prunes to maxRuns', async () => {
    await setMaxRuns(2);
    await saveTestRun(makeRun('run-1'));
    await saveTestRun(makeRun('run-2'));
    await saveTestRun(makeRun('run-3'));
    const loaded = await loadTestRuns();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('run-3');
    expect(loaded[1].id).toBe('run-2');
  });

  it('deletes a specific run', async () => {
    await saveTestRun(makeRun('run-1'));
    await saveTestRun(makeRun('run-2'));
    await deleteTestRun('run-1');
    const loaded = await loadTestRuns();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('run-2');
  });

  it('bulk saves runs', async () => {
    await saveTestRunsBulk([makeRun('r1'), makeRun('r2'), makeRun('r3')]);
    const loaded = await loadTestRuns();
    expect(loaded).toHaveLength(3);
  });

  it('truncates long response bodies to 2000 chars', async () => {
    const run = makeRun('run-big');
    run.results[0].responseBody = 'x'.repeat(5000);
    await saveTestRun(run);
    const loaded = await loadTestRuns();
    expect(loaded[0].results[0].responseBody.length).toBeLessThan(2500);
    expect(loaded[0].results[0].responseBody).toContain('truncated');
  });

  it('returns empty array when no runs stored', async () => {
    const loaded = await loadTestRuns();
    expect(loaded).toEqual([]);
  });
});

describe('storage — cap and truncate results', () => {
  it('caps results to 2000 and samples passed results', async () => {
    const run = makeRun('big-run', 3000);
    const { ok } = await saveTestRun(run);
    expect(ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded[0].results.length).toBeLessThanOrEqual(2000);
  });

  it('does not sample passed results when there are no passing rows over budget', async () => {
    const run = makeRun('all-fail', 2001);
    run.results = Array.from({ length: 2001 }, (_, i) => ({
      id: `f${i}`,
      scenarioId: 's1',
      scenarioName: 'Test',
      url: 'http://api/test',
      method: 'GET' as const,
      httpStatus: 500,
      responseTimeMs: 100,
      responseBody: '{}',
      timestamp: Date.now(),
      passed: false,
      validationMode: 'none' as const,
      failureDetails: [] as string[],
    }));
    await saveTestRun(run);
    const loaded = await loadTestRuns();
    expect(loaded[0].results).toHaveLength(2001);
  });

  it('keeps all failed results when failures alone exceed the cap budget', async () => {
    const run = makeRun('mixed', 2100);
    run.results = [
      ...Array.from({ length: 2000 }, (_, i) => ({
        id: `f${i}`,
        scenarioId: 's1',
        scenarioName: 'Test',
        url: 'http://api/test',
        method: 'GET' as const,
        httpStatus: 500,
        responseTimeMs: 100,
        responseBody: '{}',
        timestamp: Date.now(),
        passed: false,
        validationMode: 'none' as const,
        failureDetails: [] as string[],
      })),
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `p${i}`,
        scenarioId: 's1',
        scenarioName: 'Test',
        url: 'http://api/test',
        method: 'GET' as const,
        httpStatus: 200,
        responseTimeMs: 100,
        responseBody: '{}',
        timestamp: Date.now(),
        passed: true,
        validationMode: 'none' as const,
        failureDetails: [] as string[],
      })),
    ];
    await saveTestRun(run);
    const loaded = await loadTestRuns();
    expect(loaded[0].results.filter((r) => !r.passed)).toHaveLength(2000);
    expect(loaded[0].results.length).toBeLessThanOrEqual(2000);
  });
});

describe('storage — save errors & force save', () => {
  const nativeSetItem = Storage.prototype.setItem;

  beforeEach(() => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockImplementation(async (key: string) => localStorage.getItem(key));
    tauriSetItem.mockImplementation(async (key: string, value: string) => { localStorage.setItem(key, value); });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(false);
    tauriGetItem.mockReset();
    tauriGetItem.mockResolvedValue(null);
    tauriSetItem.mockReset();
    tauriSetItem.mockResolvedValue(undefined);
    tauriGetUsage.mockReset();
    tauriGetUsage.mockResolvedValue({ usedBytes: 0, entries: {} });
  });

  it('returns quotaError when saveTestRun cannot persist', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    const { ok, quotaError } = await saveTestRun(makeRun('q1'));
    expect(ok).toBe(false);
    expect(quotaError).toBe(true);
  });

  it('forceSaveTestRun succeeds on first write when storage is healthy', async () => {
    const result = await forceSaveTestRun(makeRun('fs1'));
    expect(result.ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded.some((r) => r.id === 'fs1')).toBe(true);
  });

  it('forceSaveTestRun shrinks runs and succeeds after transient quota errors', async () => {
    await saveTestRunsBulk([makeRun('a'), makeRun('b'), makeRun('c'), makeRun('d')]);
    let n = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'perf-test-runs' && n++ < 2) {
        throw new DOMException('QuotaExceeded', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    const result = await forceSaveTestRun(makeRun('new-run'));
    expect(result.ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded.length).toBeGreaterThanOrEqual(1);
    expect(loaded.some((r) => r.id === 'new-run')).toBe(true);
  });

  it('forceSaveTestRun returns ok false when all writes fail', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    });
    const result = await forceSaveTestRun(makeRun('dead'));
    expect(result.ok).toBe(false);
  });

  it('forceSaveTestRun uses the final single-run path when the loop never completes setMaxRuns', async () => {
    let maxRunsWrites = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'perf-test-max-runs' && maxRunsWrites++ < 10) {
        throw new DOMException('QuotaExceeded', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    });
    const result = await forceSaveTestRun(makeRun('final-path'));
    expect(result.ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded.some((r) => r.id === 'final-path')).toBe(true);
  });
});

describe('storage — parse / catch fallbacks', () => {
  it('getMaxRuns falls back to default when stored value is not a number', async () => {
    localStorage.setItem('perf-test-max-runs', 'NaNish');
    expect(await getMaxRuns()).toBe(50);
  });

  it('getMaxRuns falls back to default when stored value is empty string', async () => {
    localStorage.setItem('perf-test-max-runs', '');
    expect(await getMaxRuns()).toBe(50);
  });

  it('getMaxRuns treats stored zero as invalid and uses default', async () => {
    localStorage.setItem('perf-test-max-runs', '0');
    expect(await getMaxRuns()).toBe(50);
  });

  it('getMaxRuns falls back when localStorage.getItem throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(await getMaxRuns()).toBe(50);
    vi.restoreAllMocks();
  });

  it('getMaxRuns falls back when readKey rejects', async () => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockRejectedValueOnce(new Error('tauri read failed'));
    expect(await getMaxRuns()).toBe(50);
    isTauriMock.mockReturnValue(false);
  });

  it('loadTestRuns returns empty array when JSON is invalid', async () => {
    localStorage.setItem('perf-test-runs', '{');
    expect(await loadTestRuns()).toEqual([]);
  });

  it('loadEnvironments returns empty array when JSON is invalid', async () => {
    localStorage.setItem('perf-test-v3-environments', '{');
    expect(await loadEnvironments()).toEqual([]);
  });

  it('loadMicroservices returns empty array when JSON is invalid', async () => {
    localStorage.setItem('perf-test-v3-microservices', '{');
    expect(await loadMicroservices()).toEqual([]);
  });

  it('loadFeatureGroups returns empty array when JSON is invalid', async () => {
    localStorage.setItem('perf-test-v3-feature-groups', '{');
    expect(await loadFeatureGroups()).toEqual([]);
  });

  it('loadGlobalAuthProfiles returns empty array when JSON is invalid', async () => {
    localStorage.setItem('perf-test-global-auth-profiles', '{');
    expect(await loadGlobalAuthProfiles()).toEqual([]);
  });

  it('loadRunnerConfig returns null when JSON is invalid', async () => {
    localStorage.setItem('perf-test-runner-config', '{');
    expect(await loadRunnerConfig()).toBeNull();
  });

  it('loadRequests returns empty shape when JSON is invalid', async () => {
    localStorage.setItem('perf-test-requests', '{');
    const loaded = await loadRequests();
    expect(loaded.environments).toEqual([]);
    expect(loaded.collections).toEqual([]);
  });

  it('loadCatalogEntries returns empty array when JSON is invalid', async () => {
    localStorage.setItem('perf-test-catalog', '{');
    expect(await loadCatalogEntries()).toEqual([]);
  });

  it('loadCatalogRawSpec returns null when stored value is empty string', async () => {
    localStorage.setItem('perf-test-catalog-spec-c1-v1', '');
    expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
  });

  it('loadCatalogRawSpec returns null when read throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'perf-test-catalog-spec-c1-v1') throw new Error('io');
      return null;
    });
    expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
    vi.restoreAllMocks();
  });

  it('loadCatalogEndpointValues returns empty object when JSON is invalid', async () => {
    localStorage.setItem('perf-test-catalog-ep-c1', '{');
    expect(await loadCatalogEndpointValues('c1')).toEqual({});
  });
});

describe('storage — onStorageFull notification', () => {
  it('registers a listener and calls it when retry after cleanup also fails', async () => {
    const listener = vi.fn();
    const unsub = onStorageFull(listener);

    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };

    try {
      await writeKey('test-key', 'value');
    } catch {
      // expected — writeKey re-throws after retry
    }

    expect(listener).toHaveBeenCalledWith('test-key');

    unsub();
    Storage.prototype.setItem = origSetItem;
  });

  it('writeKey succeeds on retry after cleanup frees space', async () => {
    const origSetItem = Storage.prototype.setItem;
    let attempts = 0;
    Storage.prototype.setItem = function (key: string, value: string) {
      attempts += 1;
      if (attempts === 1) {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
      return origSetItem.call(this, key, value);
    };

    await writeKey('perf-test-runner-config:_workflow_runner', '{"iterations":1}');
    expect(localStorage.getItem('perf-test-runner-config:_workflow_runner')).toBe('{"iterations":1}');

    Storage.prototype.setItem = origSetItem;
  });

  it('unsubscribe stops listener from being called', async () => {
    const listener = vi.fn();
    const unsub = onStorageFull(listener);
    unsub();

    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };

    try {
      await writeKey('test-key', 'value');
    } catch {
      // expected
    }

    expect(listener).not.toHaveBeenCalled();
    Storage.prototype.setItem = origSetItem;
  });

  it('swallows errors thrown by storage-full listeners', async () => {
    const badListener = vi.fn(() => { throw new Error('listener boom'); });
    const goodListener = vi.fn();
    const unsub1 = onStorageFull(badListener);
    const unsub2 = onStorageFull(goodListener);

    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };

    try {
      await writeKey('test-key', 'value');
    } catch {
      // expected
    }

    expect(badListener).toHaveBeenCalled();
    expect(goodListener).toHaveBeenCalled();
    unsub1();
    unsub2();
    Storage.prototype.setItem = origSetItem;
  });
});

describe('storage — execution trace sampling in capAndTruncateResults', () => {
  function makeRunWithTrace(id: string, samplingEnabled: boolean, samplingThreshold?: number): TestRun {
    return {
      id,
      timestamp: Date.now(),
      config: {
        concurrency: 1, iterations: 1,
        scenarioWeights: [], executionMode: 'sequential',
        traceOptions: {
          samplingEnabled,
          ...(samplingThreshold !== undefined ? { samplingThreshold } : {}),
        },
      },
      summary: {
        tps: 1, avgResponseTime: 100, minResponseTime: 50, maxResponseTime: 150,
        p95ResponseTime: 140, p99ResponseTime: 148, errorRate: 0,
        errorsByStatus: {}, totalRequests: 1, successfulRequests: 1,
        failedRequests: 0, failedValidations: 0, totalDurationMs: 1000,
      },
      results: [{
        id: 'r1', scenarioId: 's1', scenarioName: 'Test',
        url: 'http://api/test', method: 'GET', httpStatus: 200,
        responseTimeMs: 100, responseBody: '{}', timestamp: Date.now(),
        passed: true, validationMode: 'none' as const, failureDetails: [],
      }],
      executionTrace: {
        iterations: [
          {
            index: 0, passed: true, durationMs: 100,
            events: [], finalVariables: {}, traversedEdges: [],
          },
          {
            index: 1, passed: true, durationMs: 200,
            events: [], finalVariables: {}, traversedEdges: [],
          },
        ],
        traversedEdges: [],
        workflowSnapshot: { nodes: [], edges: [] },
        workflowId: 'wf1', workflowName: 'TestWF',
        totalIterations: 2, totalDurationMs: 300,
      },
    } as TestRun;
  }

  it('compresses trace with sampling enabled (default)', async () => {
    const run = makeRunWithTrace('trace-sampling-on', true);
    const { ok } = await saveTestRun(run);
    expect(ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded[0].hasTrace).toBe(true);
    expect(loaded[0].executionTrace).toBeUndefined();
    expect(loaded[0].compressedTrace).toBeTruthy();
  });

  it('marks all iterations as sampled when sampling disabled', async () => {
    const run = makeRunWithTrace('trace-sampling-off', false);
    const { ok } = await saveTestRun(run);
    expect(ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded[0].hasTrace).toBe(true);
    expect(loaded[0].compressedTrace).toBeTruthy();
  });

  it('passes custom sampling threshold when provided', async () => {
    const run = makeRunWithTrace('trace-threshold', true, 5);
    const { ok } = await saveTestRun(run);
    expect(ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded[0].hasTrace).toBe(true);
    expect(loaded[0].compressedTrace).toBeTruthy();
  });

  it('saves run without executionTrace normally (no trace block)', async () => {
    const run = makeRunWithTrace('no-trace', true);
    delete run.executionTrace;
    const { ok } = await saveTestRun(run);
    expect(ok).toBe(true);
    const loaded = await loadTestRuns();
    expect(loaded[0].hasTrace).toBeFalsy();
    expect(loaded[0].compressedTrace).toBeFalsy();
  });
});
