import type { TestRun, FeatureGroup } from '../types';

const STORAGE_KEY = 'perf-test-runs';
const SCENARIOS_KEY = 'perf-test-scenarios';
const FEATURES_KEY = 'perf-test-features';

export function saveTestRun(run: TestRun): void {
  const runs = loadTestRuns();
  runs.unshift(run);
  // Keep last 50 runs
  if (runs.length > 50) runs.length = 50;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
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
