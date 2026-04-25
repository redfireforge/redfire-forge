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

import {
  saveTestRun,
  forceSaveTestRun,
  loadTestRuns,
  deleteTestRun,
  saveTestRunsBulk,
  saveEnvironments,
  loadEnvironments,
  saveMicroservices,
  loadMicroservices,
  saveFeatureGroups,
  loadFeatureGroups,
  saveGlobalAuthProfiles,
  loadGlobalAuthProfiles,
  saveSelectedEnvId,
  loadSelectedEnvId,
  saveSelectedSvcId,
  loadSelectedSvcId,
  getMaxRuns,
  setMaxRuns,
  saveRunnerConfig,
  loadRunnerConfig,
  saveTheme,
  loadTheme,
  getStorageUsage,
  migrateToFlat,
  loadRequests,
  saveRequests,
  loadCatalogEntries,
  saveCatalogEntries,
  loadCatalogRawSpec,
  saveCatalogRawSpec,
  removeCatalogRawSpec,
  removeAllCatalogRawSpecs,
  loadCatalogEndpointValues,
  saveCatalogEndpointValues,
  removeCatalogEndpointValues,
  loadSelectedWorkflowId,
  saveSelectedWorkflowId,
  loadWorkflows,
  saveWorkflows,
  loadWorkflowSampleDismissed,
  saveWorkflowSampleDismissed,
  loadPreviewSampleId,
  savePreviewSampleId,
} from './storage';
import type { TestRun, GlobalAuthProfile, RequestsData } from '../types';
import type { CatalogEntry, SavedEndpointValues } from '../types/catalog';
import type { Workflow } from '../types/workflow';

function makeRun(id: string, results: number = 1): TestRun {
  return {
    id,
    timestamp: Date.now(),
    config: {
      concurrency: 1, totalTransactions: results,
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

describe('storage — flat data', () => {
  it('saves and loads environments', async () => {
    await saveEnvironments([{ id: 'e1', name: 't01' }, { id: 'e2', name: 'p01' }]);
    const loaded = await loadEnvironments();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].name).toBe('t01');
  });

  it('saves and loads microservices', async () => {
    await saveMicroservices([{ id: 's1', name: 'svc-1', baseUrls: { e1: 'http://api' } }]);
    const loaded = await loadMicroservices();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].baseUrls.e1).toBe('http://api');
  });

  it('saves and loads feature groups', async () => {
    await saveFeatureGroups([{ id: 'fg1', name: 'FG1', scenarios: [] }]);
    const loaded = await loadFeatureGroups();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('FG1');
  });

  it('saves and loads selected env/svc ids', async () => {
    await saveSelectedEnvId('e1');
    await saveSelectedSvcId('s1');
    expect(await loadSelectedEnvId()).toBe('e1');
    expect(await loadSelectedSvcId()).toBe('s1');
  });

  it('returns empty string for selected ids when keys are absent', async () => {
    expect(await loadSelectedEnvId()).toBe('');
    expect(await loadSelectedSvcId()).toBe('');
  });

  it('returns empty arrays when nothing stored', async () => {
    expect(await loadEnvironments()).toEqual([]);
    expect(await loadMicroservices()).toEqual([]);
    expect(await loadFeatureGroups()).toEqual([]);
  });
});

describe('storage — global auth profiles', () => {
  it('saves and loads auth profiles', async () => {
    const profiles: GlobalAuthProfile[] = [
      { id: 'gp1', name: 'OAuth Prod', auth: { type: 'oauth2', tokenUrl: 'http://auth', clientId: 'c', clientSecret: 's' } },
      { id: 'gp2', name: 'Basic QA', auth: { type: 'basic', username: 'u', password: 'p' } },
    ];
    await saveGlobalAuthProfiles(profiles);
    const loaded = await loadGlobalAuthProfiles();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].auth.type).toBe('oauth2');
    expect(loaded[1].auth.type).toBe('basic');
  });

  it('returns empty array when no profiles', async () => {
    expect(await loadGlobalAuthProfiles()).toEqual([]);
  });
});

describe('storage — max runs', () => {
  it('defaults to 50', async () => {
    expect(await getMaxRuns()).toBe(50);
  });

  it('saves and loads custom max', async () => {
    await setMaxRuns(10);
    expect(await getMaxRuns()).toBe(10);
  });

  it('clamps to 1 minimum', async () => {
    await setMaxRuns(0);
    expect(await getMaxRuns()).toBe(1);
  });

  it('clamps to 500 maximum', async () => {
    await setMaxRuns(1000);
    expect(await getMaxRuns()).toBe(500);
  });

  it('prunes existing runs when max is lowered', async () => {
    await saveTestRunsBulk([makeRun('r1'), makeRun('r2'), makeRun('r3')]);
    await setMaxRuns(2);
    const loaded = await loadTestRuns();
    expect(loaded).toHaveLength(2);
  });
});

describe('storage — runner config', () => {
  it('saves and loads runner config', async () => {
    const config = { concurrency: 5, mode: 'batch' };
    await saveRunnerConfig(config);
    const loaded = await loadRunnerConfig();
    expect(loaded).toEqual(config);
  });

  it('saves and loads with context key', async () => {
    await saveRunnerConfig({ concurrency: 5 }, 'env-1:svc-1');
    await saveRunnerConfig({ concurrency: 10 }, 'env-2:svc-2');

    expect(await loadRunnerConfig('env-1:svc-1')).toEqual({ concurrency: 5 });
    expect(await loadRunnerConfig('env-2:svc-2')).toEqual({ concurrency: 10 });
  });

  it('returns null when no config stored', async () => {
    expect(await loadRunnerConfig()).toBeNull();
  });
});

describe('storage — theme', () => {
  it('defaults to dark', async () => {
    expect(await loadTheme()).toBe('dark');
  });

  it('saves and loads theme', async () => {
    await saveTheme('light');
    expect(await loadTheme()).toBe('light');
  });
});

describe('storage — usage', () => {
  it('returns zero for empty storage', async () => {
    const { usedBytes, entries } = await getStorageUsage();
    expect(usedBytes).toBe(0);
    expect(Object.keys(entries)).toHaveLength(0);
  });

  it('counts bytes for stored data', async () => {
    await saveEnvironments([{ id: 'e1', name: 't01' }]);
    const { usedBytes, entries } = await getStorageUsage();
    expect(usedBytes).toBeGreaterThan(0);
    expect(entries['perf-test-v3-environments']).toBeGreaterThan(0);
  });
});

describe('storage — migration', () => {
  it('returns null when no legacy data and marks as migrated', async () => {
    expect(await migrateToFlat()).toBeNull();
  });

  it('migrates v2 project data to flat', async () => {
    const project = {
      id: 'p1', name: 'Test Project', createdAt: Date.now(),
      environments: [{ id: 'e1', name: 't01' }],
      microservices: [{ id: 's1', name: 'svc', baseUrls: { e1: 'http://api' } }],
      globalAuthProfiles: [{ id: 'a1', name: 'Auth', auth: { type: 'basic' } }],
      featureGroups: [{ id: 'f1', name: 'Feature', scenarios: [] }],
      selectedEnvId: 'e1',
      selectedSvcId: 's1',
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([project]));
    localStorage.setItem('perf-test-selected-project', 'p1');

    const result = await migrateToFlat();
    expect(result).toBeTruthy();
    expect(result!.environments).toHaveLength(1);
    expect(result!.microservices).toHaveLength(1);
    expect(result!.featureGroups).toHaveLength(1);
    expect(result!.globalAuthProfiles).toHaveLength(1);
    expect(result!.selectedEnvId).toBe('e1');
    expect(result!.selectedSvcId).toBe('s1');

    const envs = await loadEnvironments();
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe('t01');
  });

  it('migrates v1 legacy keys to flat', async () => {
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 't01' }]));
    localStorage.setItem('perf-test-microservices', JSON.stringify([{ id: 's1', name: 'svc', baseUrls: {} }]));
    localStorage.setItem('perf-test-global-auth', JSON.stringify([{ id: 'g1', name: 'Auth', auth: { type: 'basic' } }]));
    localStorage.setItem('perf-test-features', JSON.stringify([{ id: 'f1', name: 'Feature', scenarios: [] }]));

    const result = await migrateToFlat();
    expect(result).toBeTruthy();
    expect(result!.environments).toHaveLength(1);
    expect(result!.microservices).toHaveLength(1);
    expect(result!.featureGroups).toHaveLength(1);
    expect(result!.globalAuthProfiles).toHaveLength(1);
  });

  it('does not re-migrate after first migration', async () => {
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 't01' }]));
    await migrateToFlat();
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e2', name: 'p01' }]));
    const result = await migrateToFlat();
    expect(result).toBeNull();
  });

  it('strips projectId from legacy feature groups', async () => {
    localStorage.setItem('perf-test-features', JSON.stringify([
      { id: 'f1', name: 'FG', scenarios: [], projectId: 'old-project' },
    ]));
    const result = await migrateToFlat();
    expect(result!.featureGroups[0]).not.toHaveProperty('projectId');
  });
});

describe('storage — requests', () => {
  it('returns empty requests data when nothing stored', async () => {
    const result = await loadRequests();
    expect(result.environments).toEqual([]);
    expect(result.collections).toEqual([]);
  });

  it('saves and loads requests data', async () => {
    const data = { environments: [{ id: 'e1', name: 'dev' }], collections: [] };
    await saveRequests(data as unknown as RequestsData);
    const loaded = await loadRequests();
    expect(loaded.environments).toHaveLength(1);
    expect(loaded.environments[0].name).toBe('dev');
  });

  it('migrates data from legacy workbench key to requests key', async () => {
    const legacy = { environments: [{ id: 'e1', name: 'staging' }], collections: [{ id: 'c1', name: 'Col' }] };
    localStorage.setItem('perf-test-workbench', JSON.stringify(legacy));

    const loaded = await loadRequests();
    expect(loaded.environments).toHaveLength(1);
    expect(loaded.environments[0].name).toBe('staging');
    expect(loaded.collections).toHaveLength(1);

    expect(localStorage.getItem('perf-test-workbench')).toBeNull();
    expect(localStorage.getItem('perf-test-requests')).toBeTruthy();
  });

  it('prefers new key over legacy key', async () => {
    const legacy = { environments: [{ id: 'e1', name: 'old' }], collections: [] };
    const current = { environments: [{ id: 'e2', name: 'new' }], collections: [] };
    localStorage.setItem('perf-test-workbench', JSON.stringify(legacy));
    localStorage.setItem('perf-test-requests', JSON.stringify(current));

    const loaded = await loadRequests();
    expect(loaded.environments[0].name).toBe('new');
    expect(localStorage.getItem('perf-test-workbench')).toBeTruthy();
  });
});

describe('storage — catalog entries', () => {
  it('returns empty array when no catalog entries', async () => {
    const entries = await loadCatalogEntries();
    expect(entries).toEqual([]);
  });

  it('saves and loads catalog entries', async () => {
    const entries = [{ id: 'c1', name: 'API1' }] as unknown as CatalogEntry[];
    await saveCatalogEntries(entries);
    const loaded = await loadCatalogEntries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('API1');
  });
});

describe('storage — catalog raw specs', () => {
  it('returns null when no spec stored', async () => {
    expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
  });

  it('saves and loads raw spec', async () => {
    await saveCatalogRawSpec('c1', 'v1', '{"openapi":"3.0"}');
    const spec = await loadCatalogRawSpec('c1', 'v1');
    expect(spec).toBe('{"openapi":"3.0"}');
  });

  it('removes raw spec', async () => {
    await saveCatalogRawSpec('c1', 'v1', 'spec-data');
    await removeCatalogRawSpec('c1', 'v1');
    expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
  });

  it('removes all raw specs for an entry', async () => {
    await saveCatalogRawSpec('c1', 'v1', 'spec1');
    await saveCatalogRawSpec('c1', 'v2', 'spec2');
    await removeAllCatalogRawSpecs('c1', ['v1', 'v2']);
    expect(await loadCatalogRawSpec('c1', 'v1')).toBeNull();
    expect(await loadCatalogRawSpec('c1', 'v2')).toBeNull();
  });
});

describe('storage — catalog endpoint values', () => {
  it('returns empty object when no values stored', async () => {
    expect(await loadCatalogEndpointValues('c1')).toEqual({});
  });

  it('saves and loads endpoint values', async () => {
    const values = { ep1: { params: { id: '123' }, headers: {}, body: '{}' } };
    await saveCatalogEndpointValues('c1', values as unknown as Record<string, SavedEndpointValues>);
    const loaded = await loadCatalogEndpointValues('c1');
    expect(loaded.ep1.params).toEqual({ id: '123' });
  });

  it('removes endpoint values', async () => {
    await saveCatalogEndpointValues('c1', { ep1: {} as unknown as SavedEndpointValues });
    await removeCatalogEndpointValues('c1');
    expect(await loadCatalogEndpointValues('c1')).toEqual({});
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

describe('storage — migration edge cases', () => {
  it('returns null for v1 legacy keys that only contain empty arrays', async () => {
    localStorage.setItem('perf-test-environments', '[]');
    localStorage.setItem('perf-test-microservices', '[]');
    localStorage.setItem('perf-test-global-auth', '[]');
    localStorage.setItem('perf-test-features', '[]');
    expect(await migrateToFlat()).toBeNull();
    expect(localStorage.getItem('perf-test-v3-migrated')).toBe('true');
  });

  it('merges unique data from multiple v2 projects (selected first)', async () => {
    const p1 = {
      id: 'p1',
      name: 'A',
      createdAt: 1,
      environments: [{ id: 'e1', name: 'only-p1' }],
      microservices: [{ id: 's1', name: 'svc1', baseUrls: {} }],
      globalAuthProfiles: [{ id: 'a1', name: 'auth1', auth: { type: 'basic' as const } }],
      featureGroups: [{ id: 'f1', name: 'FG1', scenarios: [] }],
      selectedEnvId: 'e1',
      selectedSvcId: 's1',
    };
    const p2 = {
      id: 'p2',
      name: 'B',
      createdAt: 2,
      environments: [
        { id: 'e1', name: 'dup' },
        { id: 'e2', name: 'from-p2' },
      ],
      microservices: [
        { id: 's1', name: 'dup', baseUrls: {} },
        { id: 's2', name: 'svc2', baseUrls: {} },
      ],
      globalAuthProfiles: [
        { id: 'a1', name: 'dup', auth: { type: 'basic' as const } },
        { id: 'a2', name: 'auth2', auth: { type: 'basic' as const } },
      ],
      featureGroups: [{ id: 'f2', name: 'FG2', scenarios: [] }],
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([p1, p2]));
    localStorage.setItem('perf-test-selected-project', 'p1');

    const result = await migrateToFlat();
    expect(result).toBeTruthy();
    expect(result!.environments.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(result!.microservices.map((s) => s.id).sort()).toEqual(['s1', 's2']);
    expect(result!.globalAuthProfiles.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
    expect(result!.featureGroups).toHaveLength(2);
    expect(result!.environments.find((e) => e.id === 'e1')!.name).toBe('only-p1');
  });

  it('falls back to first project when selected id is missing', async () => {
    const p2 = {
      id: 'p2',
      name: 'Second',
      createdAt: 2,
      environments: [{ id: 'e2', name: 't02' }],
      microservices: [{ id: 's2', name: 'svc', baseUrls: { e2: 'http://x' } }],
      featureGroups: [],
      selectedEnvId: 'e2',
      selectedSvcId: 's2',
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([p2]));
    localStorage.setItem('perf-test-selected-project', 'missing-id');

    const result = await migrateToFlat();
    expect(result!.selectedEnvId).toBe('e2');
    expect(result!.selectedSvcId).toBe('s2');
  });

  it('falls through to v1 when v2 projects JSON is invalid', async () => {
    localStorage.setItem('perf-test-projects', '{');
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 'legacy' }]));
    localStorage.setItem('perf-test-microservices', '[]');
    localStorage.setItem('perf-test-global-auth', '[]');
    localStorage.setItem('perf-test-features', '[]');

    const result = await migrateToFlat();
    expect(result).toBeTruthy();
    expect(result!.environments[0].name).toBe('legacy');
  });

  it('falls through to v1 when projects array is empty', async () => {
    localStorage.setItem('perf-test-projects', '[]');
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 'legacy' }]));
    localStorage.setItem('perf-test-microservices', '[]');
    localStorage.setItem('perf-test-global-auth', '[]');
    localStorage.setItem('perf-test-features', '[]');

    const result = await migrateToFlat();
    expect(result!.environments[0].name).toBe('legacy');
  });

  it('strips projectId from feature groups during v2 migration', async () => {
    const project = {
      id: 'p1',
      name: 'P',
      createdAt: 1,
      environments: [],
      microservices: [],
      featureGroups: [{ id: 'f1', name: 'FG', scenarios: [], projectId: 'x' }],
      selectedEnvId: '',
      selectedSvcId: '',
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([project]));
    localStorage.setItem('perf-test-selected-project', 'p1');

    const result = await migrateToFlat();
    expect(result!.featureGroups[0]).not.toHaveProperty('projectId');
  });

  it('v1 migration reads only environments when other legacy keys are absent', async () => {
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 'solo' }]));

    const result = await migrateToFlat();
    expect(result).toBeTruthy();
    expect(result!.environments).toHaveLength(1);
    expect(result!.microservices).toEqual([]);
    expect(result!.featureGroups).toEqual([]);
    expect(result!.globalAuthProfiles).toEqual([]);
  });

  it('v1 migration merges legacy global auth with existing app global profiles', async () => {
    localStorage.setItem(
      'perf-test-global-auth-profiles',
      JSON.stringify([{ id: 'app-g', name: 'Already saved', auth: { type: 'basic', username: 'u', password: 'p' } }]),
    );
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 't01' }]));
    localStorage.setItem('perf-test-microservices', '[]');
    localStorage.setItem(
      'perf-test-global-auth',
      JSON.stringify([{ id: 'legacy-g', name: 'From legacy key', auth: { type: 'basic', username: 'a', password: 'b' } }]),
    );
    localStorage.setItem('perf-test-features', '[]');

    const result = await migrateToFlat();
    expect(result!.globalAuthProfiles.map((a) => a.id).sort()).toEqual(['app-g', 'legacy-g']);
  });

  it('v1 migration skips legacy auth ids that already exist in app global storage', async () => {
    localStorage.setItem(
      'perf-test-global-auth-profiles',
      JSON.stringify([{ id: 'same-id', name: 'Kept', auth: { type: 'basic', username: 'u', password: 'p' } }]),
    );
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 't01' }]));
    localStorage.setItem('perf-test-microservices', '[]');
    localStorage.setItem(
      'perf-test-global-auth',
      JSON.stringify([{ id: 'same-id', name: 'Skipped dup', auth: { type: 'basic', username: 'a', password: 'b' } }]),
    );
    localStorage.setItem('perf-test-features', '[]');

    const result = await migrateToFlat();
    expect(result!.globalAuthProfiles).toHaveLength(1);
    expect(result!.globalAuthProfiles[0].name).toBe('Kept');
  });

  it('v2 merge skips duplicate env/svc/auth ids from other projects', async () => {
    const p1 = {
      id: 'p1',
      name: 'A',
      createdAt: 1,
      environments: [{ id: 'e1', name: 'first' }],
      microservices: [{ id: 's1', name: 'm1', baseUrls: {} }],
      globalAuthProfiles: [{ id: 'a1', name: 'auth', auth: { type: 'basic' as const, username: 'u', password: 'p' } }],
      featureGroups: [{ id: 'f1', name: 'OnlySel', scenarios: [] }],
      selectedEnvId: 'e1',
      selectedSvcId: 's1',
    };
    const p2 = {
      id: 'p2',
      name: 'B',
      createdAt: 2,
      environments: [{ id: 'e1', name: 'dup-env' }],
      microservices: [{ id: 's1', name: 'dup-svc', baseUrls: {} }],
      globalAuthProfiles: [{ id: 'a1', name: 'dup-auth', auth: { type: 'basic' as const, username: 'x', password: 'y' } }],
      featureGroups: [{ id: 'f2', name: 'FromOther', scenarios: [] }],
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([p1, p2]));
    localStorage.setItem('perf-test-selected-project', 'p1');

    const result = await migrateToFlat();
    expect(result!.environments).toHaveLength(1);
    expect(result!.environments[0].name).toBe('first');
    expect(result!.microservices).toHaveLength(1);
    expect(result!.globalAuthProfiles).toHaveLength(1);
    expect(result!.featureGroups).toHaveLength(2);
  });

  it('v2 migration merges project auth into existing app global profiles', async () => {
    localStorage.setItem(
      'perf-test-global-auth-profiles',
      JSON.stringify([{ id: 'pre', name: 'Preloaded', auth: { type: 'basic', username: 'u', password: 'p' } }]),
    );
    const project = {
      id: 'p1',
      name: 'P',
      createdAt: 1,
      environments: [{ id: 'e1', name: 't01' }],
      microservices: [{ id: 's1', name: 'svc', baseUrls: {} }],
      globalAuthProfiles: [{ id: 'from-proj', name: 'Proj', auth: { type: 'basic', username: 'x', password: 'y' } }],
      featureGroups: [{ id: 'f1', name: 'FG', scenarios: [] }],
      selectedEnvId: 'e1',
      selectedSvcId: 's1',
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([project]));
    localStorage.setItem('perf-test-selected-project', 'p1');

    const result = await migrateToFlat();
    const ids = result!.globalAuthProfiles.map((a) => a.id).sort();
    expect(ids).toEqual(['from-proj', 'pre']);
  });

  it('v2 migration uses defaults when selected project omits optional fields', async () => {
    const minimalSel: Record<string, unknown> = {
      id: 'p1',
      name: 'Minimal',
      createdAt: 1,
    };
    const p2 = {
      id: 'p2',
      name: 'Full-other',
      createdAt: 2,
      environments: [{ id: 'e2', name: 'from-other' }],
      microservices: [{ id: 's2', name: 'svc2', baseUrls: { e2: 'http://z' } }],
      globalAuthProfiles: [{ id: 'a2', name: 'auth2', auth: { type: 'basic', username: 'u', password: 'p' } }],
      featureGroups: [{ id: 'f2', name: 'FG2', scenarios: [] }],
    };
    const bareOther: Record<string, unknown> = { id: 'p3', name: 'Bare', createdAt: 3 };
    localStorage.setItem('perf-test-projects', JSON.stringify([minimalSel, p2, bareOther]));
    localStorage.setItem('perf-test-selected-project', 'p1');

    const result = await migrateToFlat();
    expect(result!.environments.map((e) => e.id)).toContain('e2');
    expect(result!.microservices.map((s) => s.id)).toContain('s2');
    expect(result!.globalAuthProfiles.map((a) => a.id)).toContain('a2');
    expect(result!.featureGroups.map((f) => f.id)).toContain('f2');
    expect(result!.selectedEnvId).toBe('');
    expect(result!.selectedSvcId).toBe('');
  });

  it('v2 merge skips auth profiles already present in app global storage', async () => {
    localStorage.setItem(
      'perf-test-global-auth-profiles',
      JSON.stringify([{ id: 'shared', name: 'Existing', auth: { type: 'basic', username: 'u', password: 'p' } }]),
    );
    const project = {
      id: 'p1',
      name: 'P',
      createdAt: 1,
      environments: [{ id: 'e1', name: 't01' }],
      microservices: [{ id: 's1', name: 'svc', baseUrls: {} }],
      globalAuthProfiles: [{ id: 'shared', name: 'Dup', auth: { type: 'basic', username: 'x', password: 'y' } }],
      featureGroups: [],
      selectedEnvId: 'e1',
      selectedSvcId: 's1',
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([project]));
    localStorage.setItem('perf-test-selected-project', 'p1');

    const result = await migrateToFlat();
    expect(result!.globalAuthProfiles).toHaveLength(1);
    expect(result!.globalAuthProfiles[0].name).toBe('Existing');
  });
});

describe('storage — usage key filter', () => {
  it('ignores localStorage keys that do not start with perf-test', async () => {
    localStorage.setItem('other-app', 'yyyy');
    await saveTheme('dark');
    const { entries } = await getStorageUsage();
    expect(Object.keys(entries).every((k) => k.startsWith('perf-test'))).toBe(true);
    expect(entries['other-app']).toBeUndefined();
  });

  it('treats missing values for enumerated perf-test keys as empty string', async () => {
    const nativeGet = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'perf-test-orphan') return null;
      return nativeGet.call(this, key);
    });
    localStorage.setItem('perf-test-orphan', 'ignored');
    const { entries, usedBytes } = await getStorageUsage();
    expect(entries['perf-test-orphan']).toBe(0);
    expect(usedBytes).toBe(0);
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
});

describe('storage — tauri backend', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(true);
  });

  it('getMaxRuns reads from tauriStore', async () => {
    tauriGetItem.mockResolvedValue('42');
    expect(await getMaxRuns()).toBe(42);
    expect(tauriGetItem).toHaveBeenCalledWith('perf-test-max-runs');
  });

  it('saveTheme writes via tauriStore', async () => {
    await saveTheme('light');
    expect(tauriSetItem).toHaveBeenCalledWith('perf-test-theme', 'light');
  });

  it('getStorageUsage delegates to tauriStore', async () => {
    tauriGetUsage.mockResolvedValue({ usedBytes: 999, entries: { 'perf-test-theme': 999 } });
    expect(await getStorageUsage()).toEqual({ usedBytes: 999, entries: { 'perf-test-theme': 999 } });
  });

  it('removeCatalogRawSpec clears the key via tauriStore setItem empty string', async () => {
    await removeCatalogRawSpec('c1', 'v1');
    expect(tauriSetItem).toHaveBeenCalledWith('perf-test-catalog-spec-c1-v1', '');
  });
});

describe('workflow storage', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(true);
    tauriGetItem.mockReset();
    tauriSetItem.mockReset();
  });

  it('loadSelectedWorkflowId returns trimmed id', async () => {
    tauriGetItem.mockResolvedValue('  wf-123  ');
    expect(await loadSelectedWorkflowId()).toBe('wf-123');
  });

  it('loadSelectedWorkflowId returns null for empty string', async () => {
    tauriGetItem.mockResolvedValue('   ');
    expect(await loadSelectedWorkflowId()).toBeNull();
  });

  it('loadSelectedWorkflowId returns null on error', async () => {
    tauriGetItem.mockRejectedValue(new Error('fail'));
    expect(await loadSelectedWorkflowId()).toBeNull();
  });

  it('saveSelectedWorkflowId writes trimmed id', async () => {
    await saveSelectedWorkflowId('  wf-1  ');
    expect(tauriSetItem).toHaveBeenCalledWith('workflows_selected_id', 'wf-1');
  });

  it('saveSelectedWorkflowId removes key for null', async () => {
    await saveSelectedWorkflowId(null);
    expect(tauriSetItem).toHaveBeenCalledWith('workflows_selected_id', '');
  });

  it('loadWorkflows returns parsed array', async () => {
    tauriGetItem.mockResolvedValue('[{"id":"w1"}]');
    const wfs = await loadWorkflows();
    expect(wfs).toEqual([{ id: 'w1' }]);
  });

  it('loadWorkflows returns empty array when null', async () => {
    tauriGetItem.mockResolvedValue(null);
    expect(await loadWorkflows()).toEqual([]);
  });

  it('loadWorkflows returns empty array on error', async () => {
    tauriGetItem.mockRejectedValue(new Error('fail'));
    expect(await loadWorkflows()).toEqual([]);
  });

  it('saveWorkflows writes JSON', async () => {
    await saveWorkflows([{ id: 'w1' }] as unknown as Workflow[]);
    expect(tauriSetItem).toHaveBeenCalledWith('workflows', '[{"id":"w1"}]');
  });

  it('loadWorkflowSampleDismissed returns true when stored', async () => {
    tauriGetItem.mockResolvedValue('true');
    expect(await loadWorkflowSampleDismissed()).toBe(true);
  });

  it('loadWorkflowSampleDismissed returns false when not true', async () => {
    tauriGetItem.mockResolvedValue('false');
    expect(await loadWorkflowSampleDismissed()).toBe(false);
  });

  it('loadWorkflowSampleDismissed returns false on error', async () => {
    tauriGetItem.mockRejectedValue(new Error('fail'));
    expect(await loadWorkflowSampleDismissed()).toBe(false);
  });

  it('saveWorkflowSampleDismissed writes true', async () => {
    await saveWorkflowSampleDismissed(true);
    expect(tauriSetItem).toHaveBeenCalledWith('workflows_sample_dismissed', 'true');
  });

  it('saveWorkflowSampleDismissed writes false', async () => {
    await saveWorkflowSampleDismissed(false);
    expect(tauriSetItem).toHaveBeenCalledWith('workflows_sample_dismissed', 'false');
  });
});

describe('preview sample ID (sessionStorage)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('loadPreviewSampleId returns null when nothing stored', () => {
    expect(loadPreviewSampleId()).toBeNull();
  });

  it('savePreviewSampleId stores and loads the id', () => {
    savePreviewSampleId('sample-workflow-001');
    expect(loadPreviewSampleId()).toBe('sample-workflow-001');
  });

  it('savePreviewSampleId(null) clears the stored id', () => {
    savePreviewSampleId('sample-workflow-001');
    savePreviewSampleId(null);
    expect(loadPreviewSampleId()).toBeNull();
  });

  it('loadPreviewSampleId returns null for empty string', () => {
    sessionStorage.setItem('workflow_preview_sample_id', '');
    expect(loadPreviewSampleId()).toBeNull();
  });
});
