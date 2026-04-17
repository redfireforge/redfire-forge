import type { TestRun, RequestResult, FeatureGroup, Environment, Microservice, GlobalAuthProfile, Project, WorkbenchData } from '../types';
import { isTauri } from './platform';
import * as tauriStore from './tauriStore';

const STORAGE_KEY = 'perf-test-runs';
const PROJECTS_KEY = 'perf-test-projects';
const SELECTED_PROJECT_KEY = 'perf-test-selected-project';
const GLOBAL_AUTH_KEY = 'perf-test-global-auth-profiles';
const MAX_RUNS_KEY = 'perf-test-max-runs';
const RUNNER_CONFIG_KEY = 'perf-test-runner-config';
const THEME_KEY = 'perf-test-theme';
const WORKBENCH_KEY = 'perf-test-workbench';

// Legacy keys (used only for migration)
const LEGACY_FEATURES_KEY = 'perf-test-features';
const LEGACY_ENVS_KEY = 'perf-test-environments';
const LEGACY_SERVICES_KEY = 'perf-test-microservices';
const LEGACY_GLOBAL_AUTH_KEY = 'perf-test-global-auth';

const DEFAULT_MAX_RUNS = 50;
const RESPONSE_BODY_MAX_CHARS = 2000;
const MAX_STORED_RESULTS_PER_RUN = 2000;

// ---------- Low-level read/write abstraction ----------

async function readKey(key: string): Promise<string | null> {
  if (isTauri()) {
    return tauriStore.getItem(key);
  }
  return localStorage.getItem(key);
}

async function writeKey(key: string, value: string): Promise<void> {
  if (isTauri()) {
    await tauriStore.setItem(key, value);
    return;
  }
  localStorage.setItem(key, value);
}

async function removeKey(key: string): Promise<void> {
  if (isTauri()) {
    await tauriStore.setItem(key, '');
    return;
  }
  localStorage.removeItem(key);
}

// ---------- Max runs ----------

export async function getMaxRuns(): Promise<number> {
  try {
    const v = await readKey(MAX_RUNS_KEY);
    if (v) return Math.max(1, parseInt(v, 10) || DEFAULT_MAX_RUNS);
  } catch { /* ignore */ }
  return DEFAULT_MAX_RUNS;
}

export async function setMaxRuns(n: number): Promise<void> {
  const clamped = Math.max(1, Math.min(500, n));
  await writeKey(MAX_RUNS_KEY, String(clamped));
  await pruneOldRuns();
}

// ---------- Helpers ----------

function capAndTruncateResults(run: TestRun): TestRun {
  let results = run.results;

  if (results.length > MAX_STORED_RESULTS_PER_RUN) {
    const failed = results.filter(r => !r.passed);
    const passed = results.filter(r => r.passed);
    const passedBudget = Math.max(0, MAX_STORED_RESULTS_PER_RUN - failed.length);
    if (passed.length > passedBudget) {
      const step = Math.ceil(passed.length / passedBudget);
      const sampled: RequestResult[] = [];
      for (let i = 0; i < passed.length && sampled.length < passedBudget; i += step) {
        sampled.push(passed[i]);
      }
      results = [...failed, ...sampled];
    }
  }

  return {
    ...run,
    results: results.map((r) => ({
      ...r,
      responseBody:
        r.responseBody.length > RESPONSE_BODY_MAX_CHARS
          ? r.responseBody.slice(0, RESPONSE_BODY_MAX_CHARS) + `\n...[truncated, ${r.responseBody.length} chars total]`
          : r.responseBody,
    })),
  };
}

async function pruneOldRuns(): Promise<void> {
  const runs = await loadTestRuns();
  const max = await getMaxRuns();
  if (runs.length > max) {
    runs.length = max;
    await writeKey(STORAGE_KEY, JSON.stringify(runs));
  }
}

// ---------- Storage usage ----------

export async function getStorageUsage(): Promise<{ usedBytes: number; entries: Record<string, number> }> {
  if (isTauri()) {
    return tauriStore.getUsageBytes();
  }
  const entries: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('perf-test')) {
      const size = (localStorage.getItem(key) ?? '').length * 2;
      entries[key] = size;
      total += size;
    }
  }
  return { usedBytes: total, entries };
}

// ---------- Test runs (global, not per-project) ----------

export async function saveTestRun(run: TestRun): Promise<{ ok: boolean; quotaError?: boolean }> {
  const truncated = capAndTruncateResults(run);
  const runs = await loadTestRuns();
  runs.unshift(truncated);
  const max = await getMaxRuns();
  if (runs.length > max) runs.length = max;
  try {
    await writeKey(STORAGE_KEY, JSON.stringify(runs));
    return { ok: true };
  } catch {
    return { ok: false, quotaError: true };
  }
}

export async function forceSaveTestRun(run: TestRun): Promise<{ ok: boolean }> {
  const truncated = capAndTruncateResults(run);
  let runs = await loadTestRuns();
  runs.unshift(truncated);

  for (let attempt = 0; attempt < 10; attempt++) {
    const keep = Math.max(1, Math.floor(runs.length / 2));
    runs = runs.slice(0, keep);
    try {
      await writeKey(STORAGE_KEY, JSON.stringify(runs));
      await setMaxRuns(keep);
      return { ok: true };
    } catch { /* keep shrinking */ }
  }

  try {
    await writeKey(STORAGE_KEY, JSON.stringify([truncated]));
    await setMaxRuns(1);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function loadTestRuns(): Promise<TestRun[]> {
  try {
    const raw = await readKey(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TestRun[];
  } catch {
    return [];
  }
}

export async function saveTestRunsBulk(runs: TestRun[]): Promise<void> {
  await writeKey(STORAGE_KEY, JSON.stringify(runs));
}

export async function deleteTestRun(runId: string): Promise<void> {
  const runs = (await loadTestRuns()).filter((r) => r.id !== runId);
  await writeKey(STORAGE_KEY, JSON.stringify(runs));
}

// ---------- Projects ----------

export async function saveProjects(projects: Project[]): Promise<void> {
  await writeKey(PROJECTS_KEY, JSON.stringify(projects));
}

export async function loadProjects(): Promise<Project[]> {
  try {
    const raw = await readKey(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch { return []; }
}

export async function saveSelectedProject(projectId: string): Promise<void> {
  await writeKey(SELECTED_PROJECT_KEY, projectId);
}

export async function loadSelectedProject(): Promise<string> {
  return (await readKey(SELECTED_PROJECT_KEY)) ?? '';
}

// ---------- Global Auth Profiles (app-level, shared across projects) ----------

export async function saveGlobalAuthProfiles(profiles: GlobalAuthProfile[]): Promise<void> {
  await writeKey(GLOBAL_AUTH_KEY, JSON.stringify(profiles));
}

export async function loadGlobalAuthProfiles(): Promise<GlobalAuthProfile[]> {
  try {
    const raw = await readKey(GLOBAL_AUTH_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GlobalAuthProfile[];
  } catch { return []; }
}

// ---------- Legacy migration ----------

export async function migrateLegacyData(): Promise<Project | null> {
  const [legacyEnvs, legacySvcs, legacyAuth, legacyFgs] = await Promise.all([
    readKey(LEGACY_ENVS_KEY),
    readKey(LEGACY_SERVICES_KEY),
    readKey(LEGACY_GLOBAL_AUTH_KEY),
    readKey(LEGACY_FEATURES_KEY),
  ]);

  const hasLegacy = legacyEnvs || legacySvcs || legacyAuth || legacyFgs;
  if (!hasLegacy) return null;

  const environments: Environment[] = legacyEnvs ? JSON.parse(legacyEnvs) : [];
  const microservices: Microservice[] = legacySvcs ? JSON.parse(legacySvcs) : [];
  const globalAuthProfiles: GlobalAuthProfile[] = legacyAuth ? JSON.parse(legacyAuth) : [];
  let featureGroups: FeatureGroup[] = legacyFgs ? JSON.parse(legacyFgs) : [];

  // Strip any projectId from legacy FGs
  featureGroups = featureGroups.map((fg) => {
    const { ...rest } = fg;
    if ('projectId' in rest) delete (rest as Record<string, unknown>).projectId;
    return rest;
  });

  if (environments.length === 0 && microservices.length === 0 && globalAuthProfiles.length === 0 && featureGroups.length === 0) {
    return null;
  }

  const project: Project = {
    id: crypto.randomUUID ? crypto.randomUUID() : `legacy-${Date.now()}`,
    name: 'Default Project',
    description: 'Migrated from previous version',
    createdAt: Date.now(),
    environments,
    microservices,
    globalAuthProfiles,
    featureGroups,
  };

  // Clean up legacy keys
  await Promise.all([
    removeKey(LEGACY_ENVS_KEY),
    removeKey(LEGACY_SERVICES_KEY),
    removeKey(LEGACY_GLOBAL_AUTH_KEY),
    removeKey(LEGACY_FEATURES_KEY),
    removeKey('perf-test-selected-env'),
    removeKey('perf-test-selected-svc'),
    removeKey('perf-test-scenarios'),
  ]);

  return project;
}

// ---------- Runner config ----------

export async function saveRunnerConfig(config: unknown, contextKey?: string): Promise<void> {
  const key = contextKey ? `${RUNNER_CONFIG_KEY}:${contextKey}` : RUNNER_CONFIG_KEY;
  await writeKey(key, JSON.stringify(config));
}

export async function loadRunnerConfig(contextKey?: string): Promise<unknown | null> {
  try {
    const key = contextKey ? `${RUNNER_CONFIG_KEY}:${contextKey}` : RUNNER_CONFIG_KEY;
    const raw = await readKey(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ---------- Theme ----------

export async function saveTheme(theme: string): Promise<void> {
  await writeKey(THEME_KEY, theme);
}

export async function loadTheme(): Promise<string> {
  return (await readKey(THEME_KEY)) ?? 'dark';
}

// ---------- Workbench ----------

const EMPTY_WORKBENCH: WorkbenchData = {
  environments: [],
  collections: [],
};

export async function loadWorkbench(): Promise<WorkbenchData> {
  try {
    const raw = await readKey(WORKBENCH_KEY);
    if (raw) return JSON.parse(raw) as WorkbenchData;
  } catch { /* ignore */ }
  return { ...EMPTY_WORKBENCH, environments: [], collections: [] };
}

export async function saveWorkbench(data: WorkbenchData): Promise<void> {
  await writeKey(WORKBENCH_KEY, JSON.stringify(data));
}
