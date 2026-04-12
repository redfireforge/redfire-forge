import type { TestRun, FeatureGroup, Environment, Microservice, GlobalAuthProfile } from '../types';
import { isTauri } from './platform';
import * as tauriStore from './tauriStore';

const STORAGE_KEY = 'perf-test-runs';
const SCENARIOS_KEY = 'perf-test-scenarios';
const FEATURES_KEY = 'perf-test-features';
const ENVS_KEY = 'perf-test-environments';
const SERVICES_KEY = 'perf-test-microservices';
const SELECTED_ENV_KEY = 'perf-test-selected-env';
const SELECTED_SVC_KEY = 'perf-test-selected-svc';
const MAX_RUNS_KEY = 'perf-test-max-runs';
const GLOBAL_AUTH_KEY = 'perf-test-global-auth';
const RUNNER_CONFIG_KEY = 'perf-test-runner-config';
const THEME_KEY = 'perf-test-theme';

const DEFAULT_MAX_RUNS = 50;
const RESPONSE_BODY_MAX_CHARS = 2000;

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

function truncateResponseBodies(run: TestRun): TestRun {
  return {
    ...run,
    results: run.results.map((r) => ({
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

// ---------- Test runs ----------

export async function saveTestRun(run: TestRun): Promise<{ ok: boolean; quotaError?: boolean }> {
  const truncated = truncateResponseBodies(run);
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
  const truncated = truncateResponseBodies(run);
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

// ---------- Scenarios ----------

export async function saveScenarios(scenarios: unknown): Promise<void> {
  await writeKey(SCENARIOS_KEY, JSON.stringify(scenarios));
}

export async function loadScenarios<T>(): Promise<T | null> {
  try {
    const raw = await readKey(SCENARIOS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ---------- Feature groups ----------

export async function saveFeatureGroups(groups: FeatureGroup[]): Promise<void> {
  await writeKey(FEATURES_KEY, JSON.stringify(groups));
}

export async function loadFeatureGroups(): Promise<FeatureGroup[]> {
  try {
    const raw = await readKey(FEATURES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FeatureGroup[];
  } catch {
    return [];
  }
}

// ---------- Environments ----------

export async function saveEnvironments(envs: Environment[]): Promise<void> {
  await writeKey(ENVS_KEY, JSON.stringify(envs));
}

export async function loadEnvironments(): Promise<Environment[]> {
  try {
    const raw = await readKey(ENVS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Environment[];
  } catch { return []; }
}

// ---------- Microservices ----------

export async function saveMicroservices(svcs: Microservice[]): Promise<void> {
  await writeKey(SERVICES_KEY, JSON.stringify(svcs));
}

export async function loadMicroservices(): Promise<Microservice[]> {
  try {
    const raw = await readKey(SERVICES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Microservice[];
  } catch { return []; }
}

// ---------- Selections ----------

export async function saveSelectedEnv(envId: string): Promise<void> {
  await writeKey(SELECTED_ENV_KEY, envId);
}

export async function loadSelectedEnv(): Promise<string> {
  return (await readKey(SELECTED_ENV_KEY)) ?? '';
}

export async function saveSelectedService(svcId: string): Promise<void> {
  await writeKey(SELECTED_SVC_KEY, svcId);
}

export async function loadSelectedService(): Promise<string> {
  return (await readKey(SELECTED_SVC_KEY)) ?? '';
}

// ---------- Global Auth Profiles ----------

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

// ---------- Runner config ----------

export async function saveRunnerConfig(config: unknown): Promise<void> {
  await writeKey(RUNNER_CONFIG_KEY, JSON.stringify(config));
}

export async function loadRunnerConfig(): Promise<unknown | null> {
  try {
    const raw = await readKey(RUNNER_CONFIG_KEY);
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
