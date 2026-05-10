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
  loadTestRuns,
  saveTestRunsBulk,
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
import type { CatalogEntry, SavedEndpointValues } from '../../features/catalog/types/catalog';
import type { Workflow } from '../../features/workflow/types/workflow';

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
