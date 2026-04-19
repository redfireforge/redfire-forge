/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./platform', () => ({ isTauri: () => false }));

import {
  saveTestRun,
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
  loadWorkbench,
  saveWorkbench,
  loadCatalogEntries,
  saveCatalogEntries,
  loadCatalogRawSpec,
  saveCatalogRawSpec,
  removeCatalogRawSpec,
  removeAllCatalogRawSpecs,
  loadCatalogEndpointValues,
  saveCatalogEndpointValues,
  removeCatalogEndpointValues,
} from './storage';
import type { TestRun, GlobalAuthProfile } from '../types';

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

describe('storage — workbench', () => {
  it('returns empty workbench when nothing stored', async () => {
    const wb = await loadWorkbench();
    expect(wb.environments).toEqual([]);
    expect(wb.collections).toEqual([]);
  });

  it('saves and loads workbench data', async () => {
    const data = { environments: [{ id: 'e1', name: 'dev' }], collections: [] };
    await saveWorkbench(data as any);
    const loaded = await loadWorkbench();
    expect(loaded.environments).toHaveLength(1);
    expect(loaded.environments[0].name).toBe('dev');
  });
});

describe('storage — catalog entries', () => {
  it('returns empty array when no catalog entries', async () => {
    const entries = await loadCatalogEntries();
    expect(entries).toEqual([]);
  });

  it('saves and loads catalog entries', async () => {
    const entries = [{ id: 'c1', name: 'API1' }] as any;
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
    await saveCatalogEndpointValues('c1', values as any);
    const loaded = await loadCatalogEndpointValues('c1');
    expect(loaded.ep1.params).toEqual({ id: '123' });
  });

  it('removes endpoint values', async () => {
    await saveCatalogEndpointValues('c1', { ep1: {} as any });
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
});
