/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock platform to always return false (browser mode) so we use localStorage
vi.mock('./platform', () => ({ isTauri: () => false }));

import {
  saveTestRun,
  loadTestRuns,
  deleteTestRun,
  saveTestRunsBulk,
  saveProjects,
  loadProjects,
  saveSelectedProject,
  loadSelectedProject,
  saveGlobalAuthProfiles,
  loadGlobalAuthProfiles,
  getMaxRuns,
  setMaxRuns,
  saveRunnerConfig,
  loadRunnerConfig,
  saveTheme,
  loadTheme,
  getStorageUsage,
  migrateLegacyData,
} from './storage';
import type { TestRun, Project, GlobalAuthProfile } from '../types';

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

function makeProject(id: string, name: string): Project {
  return {
    id, name, createdAt: Date.now(),
    environments: [{ id: 'env1', name: 't01' }],
    microservices: [{ id: 'svc1', name: 'vehicle-svc', baseUrls: { env1: 'http://api' } }],
    globalAuthProfiles: [],
    featureGroups: [],
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

describe('storage — projects', () => {
  it('saves and loads projects', async () => {
    const projects = [makeProject('p1', 'Project 1'), makeProject('p2', 'Project 2')];
    await saveProjects(projects);
    const loaded = await loadProjects();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].name).toBe('Project 1');
    expect(loaded[1].name).toBe('Project 2');
  });

  it('returns empty array when no projects', async () => {
    expect(await loadProjects()).toEqual([]);
  });

  it('saves and loads selected project', async () => {
    await saveSelectedProject('p1');
    expect(await loadSelectedProject()).toBe('p1');
  });

  it('returns empty string when no selected project', async () => {
    expect(await loadSelectedProject()).toBe('');
  });

  it('overwrites projects on re-save', async () => {
    await saveProjects([makeProject('p1', 'V1')]);
    await saveProjects([makeProject('p1', 'V2')]);
    const loaded = await loadProjects();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('V2');
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
    await saveRunnerConfig({ concurrency: 5 }, 'project-1:env-1:svc-1');
    await saveRunnerConfig({ concurrency: 10 }, 'project-2:env-2:svc-2');

    expect(await loadRunnerConfig('project-1:env-1:svc-1')).toEqual({ concurrency: 5 });
    expect(await loadRunnerConfig('project-2:env-2:svc-2')).toEqual({ concurrency: 10 });
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
    await saveProjects([makeProject('p1', 'Test')]);
    const { usedBytes, entries } = await getStorageUsage();
    expect(usedBytes).toBeGreaterThan(0);
    expect(entries['perf-test-projects']).toBeGreaterThan(0);
  });
});

describe('storage — legacy migration', () => {
  it('returns null when no legacy data', async () => {
    expect(await migrateLegacyData()).toBeNull();
  });

  it('migrates legacy keys into a project', async () => {
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 't01' }]));
    localStorage.setItem('perf-test-microservices', JSON.stringify([{ id: 's1', name: 'svc', baseUrls: {} }]));
    localStorage.setItem('perf-test-global-auth', JSON.stringify([{ id: 'g1', name: 'Auth', auth: { type: 'basic' } }]));
    localStorage.setItem('perf-test-features', JSON.stringify([{ id: 'f1', name: 'Feature', scenarios: [] }]));

    const project = await migrateLegacyData();
    expect(project).toBeTruthy();
    expect(project!.name).toBe('Default Project');
    expect(project!.environments).toHaveLength(1);
    expect(project!.microservices).toHaveLength(1);
    expect(project!.globalAuthProfiles).toHaveLength(1);
    expect(project!.featureGroups).toHaveLength(1);
  });

  it('cleans up legacy keys after migration', async () => {
    localStorage.setItem('perf-test-environments', JSON.stringify([{ id: 'e1', name: 't01' }]));
    await migrateLegacyData();

    expect(localStorage.getItem('perf-test-environments')).toBeNull();
  });

  it('strips projectId from legacy feature groups', async () => {
    localStorage.setItem('perf-test-features', JSON.stringify([
      { id: 'f1', name: 'FG', scenarios: [], projectId: 'old-project' },
    ]));
    const project = await migrateLegacyData();
    expect(project!.featureGroups[0]).not.toHaveProperty('projectId');
  });

  it('returns null when all legacy keys are empty arrays', async () => {
    localStorage.setItem('perf-test-environments', '[]');
    localStorage.setItem('perf-test-microservices', '[]');
    localStorage.setItem('perf-test-global-auth', '[]');
    localStorage.setItem('perf-test-features', '[]');
    expect(await migrateLegacyData()).toBeNull();
  });
});
