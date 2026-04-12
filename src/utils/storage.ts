import type { TestRun, FeatureGroup, Environment, Microservice, GlobalAuthProfile } from '../types';

const STORAGE_KEY = 'perf-test-runs';
const SCENARIOS_KEY = 'perf-test-scenarios';
const FEATURES_KEY = 'perf-test-features';
const ENVS_KEY = 'perf-test-environments';
const SERVICES_KEY = 'perf-test-microservices';
const SELECTED_ENV_KEY = 'perf-test-selected-env';
const SELECTED_SVC_KEY = 'perf-test-selected-svc';
const MAX_RUNS_KEY = 'perf-test-max-runs';
const GLOBAL_AUTH_KEY = 'perf-test-global-auth';

const DEFAULT_MAX_RUNS = 50;
const RESPONSE_BODY_MAX_CHARS = 2000;

export function getMaxRuns(): number {
  try {
    const v = localStorage.getItem(MAX_RUNS_KEY);
    if (v) return Math.max(1, parseInt(v, 10) || DEFAULT_MAX_RUNS);
  } catch { /* ignore */ }
  return DEFAULT_MAX_RUNS;
}

export function setMaxRuns(n: number): void {
  const clamped = Math.max(1, Math.min(500, n));
  localStorage.setItem(MAX_RUNS_KEY, String(clamped));
  pruneOldRuns();
}

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

function pruneOldRuns(): void {
  const runs = loadTestRuns();
  const max = getMaxRuns();
  if (runs.length > max) {
    runs.length = max;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  }
}

export function getStorageUsage(): { usedBytes: number; entries: Record<string, number> } {
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

export function saveTestRun(run: TestRun): { ok: boolean; quotaError?: boolean } {
  const truncated = truncateResponseBodies(run);
  const runs = loadTestRuns();
  runs.unshift(truncated);
  const max = getMaxRuns();
  if (runs.length > max) runs.length = max;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
    return { ok: true };
  } catch {
    return { ok: false, quotaError: true };
  }
}

export function forceSaveTestRun(run: TestRun): { ok: boolean } {
  const truncated = truncateResponseBodies(run);
  let runs = loadTestRuns();
  runs.unshift(truncated);

  // Aggressively halve the stored runs until it fits
  for (let attempt = 0; attempt < 10; attempt++) {
    const keep = Math.max(1, Math.floor(runs.length / 2));
    runs = runs.slice(0, keep);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
      setMaxRuns(keep);
      return { ok: true };
    } catch { /* keep shrinking */ }
  }

  // Last resort: only keep the new run
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([truncated]));
    setMaxRuns(1);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function loadTestRuns(): TestRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TestRun[];
  } catch {
    return [];
  }
}

export function saveTestRunsBulk(runs: TestRun[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export function deleteTestRun(runId: string): void {
  const runs = loadTestRuns().filter((r) => r.id !== runId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export function saveScenarios(scenarios: unknown): void {
  localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
}

export function loadScenarios<T>(): T | null {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveFeatureGroups(groups: FeatureGroup[]): void {
  localStorage.setItem(FEATURES_KEY, JSON.stringify(groups));
}

export function loadFeatureGroups(): FeatureGroup[] {
  try {
    const raw = localStorage.getItem(FEATURES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FeatureGroup[];
  } catch {
    return [];
  }
}

// Environments
export function saveEnvironments(envs: Environment[]): void {
  localStorage.setItem(ENVS_KEY, JSON.stringify(envs));
}
export function loadEnvironments(): Environment[] {
  try {
    const raw = localStorage.getItem(ENVS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Environment[];
  } catch { return []; }
}

// Microservices
export function saveMicroservices(svcs: Microservice[]): void {
  localStorage.setItem(SERVICES_KEY, JSON.stringify(svcs));
}
export function loadMicroservices(): Microservice[] {
  try {
    const raw = localStorage.getItem(SERVICES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Microservice[];
  } catch { return []; }
}

// Selections
export function saveSelectedEnv(envId: string): void {
  localStorage.setItem(SELECTED_ENV_KEY, envId);
}
export function loadSelectedEnv(): string {
  return localStorage.getItem(SELECTED_ENV_KEY) ?? '';
}
export function saveSelectedService(svcId: string): void {
  localStorage.setItem(SELECTED_SVC_KEY, svcId);
}
export function loadSelectedService(): string {
  return localStorage.getItem(SELECTED_SVC_KEY) ?? '';
}

// Global Auth Profiles
export function saveGlobalAuthProfiles(profiles: GlobalAuthProfile[]): void {
  localStorage.setItem(GLOBAL_AUTH_KEY, JSON.stringify(profiles));
}
export function loadGlobalAuthProfiles(): GlobalAuthProfile[] {
  try {
    const raw = localStorage.getItem(GLOBAL_AUTH_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GlobalAuthProfile[];
  } catch { return []; }
}
