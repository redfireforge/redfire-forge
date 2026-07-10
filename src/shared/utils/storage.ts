import type { TestRun, RequestResult, FeatureGroup, Environment, Microservice, GlobalAuthProfile, RequestsData, SharedDataSource, DataSource } from '../types';
import { migrateScenarioKinds } from './scenarioMigration';
import { ensureScenarioDefaults } from './wsScenarioDefaults';
import { isTauri } from './platform';
import * as tauriStore from './tauriStore';
import {
  idbLoadTestRuns, idbLoadTestRunsLite, idbLoadTrace,
  idbSaveTestRun, idbDeleteTestRun,
  idbSaveTestRunsBulk, idbPruneToMax, idbMigrateFromLocalStorage,
  idbGetRunsInfo, idbDeleteRunsOlderThan, idbClearAllRuns,
} from './idbTestRuns';
import {
  idbLoadFeatureGroups, idbSaveFeatureGroups, idbMigrateFeatureGroups,
} from './idbFeatureGroups';
import {
  idbLoadEnvironments, idbSaveEnvironments, idbMigrateEnvironments,
  idbLoadMicroservices, idbSaveMicroservices, idbMigrateMicroservices,
} from './idbEnvironmentsMicroservices';
import {
  idbLoadGlobalAuthProfiles,
  idbSaveGlobalAuthProfiles,
  idbMigrateGlobalAuthProfiles,
} from './idbGlobalAuthProfiles';
import { createDualModeArrayStorage } from './storageDualMode';
import {
  idbLoadSharedDataSources, idbSaveSharedDataSources, idbMigrateSharedDataSources,
} from './idbSharedDataSources';
import { idbLoadWorkflows } from './idbWorkflows';
import {
  idbLoadRequests, idbSaveRequests, idbMigrateRequests,
} from './idbRequests';
import { idbLoadCatalogEntries } from './idbCatalog';
import {
  idbLoadProjects,
} from './idbProjects';
import { compressTrace, sampleIterations } from './traceCompression';
import { formatStorageDiagnostics } from './storageUiPrefs';
import { cleanupStaleStorageKeys, purgeStaleRunnerConfigKeys, reclaimLocalStorageQuotaForWrite } from './storageCleanup';
import {
  idbLoadRunnerConfig,
  idbSaveRunnerConfig,
  purgeRunnerConfigLocalStorageKeys,
} from './idbRunnerConfig';
import {
  STORAGE_KEY,
  GLOBAL_AUTH_KEY,
  MAX_RUNS_KEY,
  RUNNER_CONFIG_KEY,
  THEME_KEY,
  REQUESTS_KEY,
  LEGACY_WORKBENCH_KEY,
  FLAT_ENVS_KEY,
  FLAT_SVCS_KEY,
  FLAT_FGS_KEY,
  FLAT_SHARED_DS_KEY,
  FLAT_WORKSPACE_DEFAULTS_KEY,
  FLAT_SEL_ENV_KEY,
  FLAT_SEL_SVC_KEY,
} from './storageKeys';

export {
  FLAT_MIGRATED_KEY,
  LEGACY_FEATURES_KEY,
  LEGACY_ENVS_KEY,
  LEGACY_SERVICES_KEY,
  LEGACY_GLOBAL_AUTH_KEY,
  PROJECTS_KEY,
  SELECTED_PROJECT_KEY,
} from './storageKeys';

export { cleanupStaleStorageKeys, purgeStaleRunnerConfigKeys, migrateAppFlatDataFromLocalStorage, ensureBrowserLargeDataMigrated, reclaimLocalStorageQuotaForWrite } from './storageCleanup';

const DEFAULT_MAX_RUNS = 50;
const RESPONSE_BODY_MAX_CHARS = 2000;
const MAX_STORED_RESULTS_PER_RUN = 2000;

// ---------- Low-level read/write abstraction ----------

export async function readKey(key: string): Promise<string | null> {
  if (isTauri()) {
    return tauriStore.getItem(key);
  }
  return localStorage.getItem(key);
}

export async function writeKey(key: string, value: string, options?: { notifyOnQuotaExhausted?: boolean }): Promise<void> {
  const notify = options?.notifyOnQuotaExhausted !== false;
  if (isTauri()) {
    await tauriStore.setItem(key, value);
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn(`[Storage] QuotaExceededError writing "${key}" — reclaiming quota and retrying`);
      cleanupStaleStorageKeys();
      await reclaimLocalStorageQuotaForWrite();
      try {
        localStorage.setItem(key, value);
        return;
      } catch (retryErr) {
        if (retryErr instanceof DOMException && retryErr.name === 'QuotaExceededError') {
          console.error(
            `[Storage] QuotaExceededError writing "${key}" after cleanup (${(value.length / 1024).toFixed(0)} KB). localStorage is full.`,
          );
          if (notify) notifyStorageFull(key);
        }
        throw retryErr;
      }
    }
    throw e;
  }
}

let _storageFullListeners: Array<(key: string) => void> = [];

/** Register a callback invoked when a localStorage write fails due to quota. */
export function onStorageFull(cb: (key: string) => void): () => void {
  _storageFullListeners.push(cb);
  return () => { _storageFullListeners = _storageFullListeners.filter(l => l !== cb); };
}

function notifyStorageFull(key: string) {
  for (const cb of _storageFullListeners) {
    try { cb(key); } catch { /* ignore listener errors */ }
  }
}

export async function removeKey(key: string): Promise<void> {
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

  const truncated: TestRun = {
    ...run,
    results: results.map((r) => ({
      ...r,
      responseBody:
        (r.responseBody ?? '').length > RESPONSE_BODY_MAX_CHARS
          ? (r.responseBody ?? '').slice(0, RESPONSE_BODY_MAX_CHARS) + `\n...[truncated, ${(r.responseBody ?? '').length} chars total]`
          : (r.responseBody ?? ''),
    })),
  };

  if (truncated.executionTrace) {
    const samplingEnabled = run.config.traceOptions?.samplingEnabled !== false;
    const samplingThreshold = run.config.traceOptions?.samplingThreshold;
    truncated.executionTrace = {
      ...truncated.executionTrace,
      iterations: samplingEnabled
        ? sampleIterations(truncated.executionTrace.iterations, samplingThreshold)
        : truncated.executionTrace.iterations.map(iter => ({ ...iter, sampled: true })),
    };
    truncated.compressedTrace = compressTrace(truncated.executionTrace);
    delete truncated.executionTrace;
    truncated.hasTrace = true;
  }

  return truncated;
}

async function pruneOldRuns(): Promise<void> {
  const max = await getMaxRuns();
  if (isTauri()) {
    const runs = await loadTestRuns();
    if (runs.length > max) {
      runs.length = max;
      await writeKey(STORAGE_KEY, JSON.stringify(runs));
    }
  } else {
    await idbPruneToMax(max);
  }
}

// ---------- IDB migration (browser only) ----------

let _idbMigrated = false;

/** Ensure localStorage test runs are migrated to IndexedDB (browser only, no-op for Tauri). */
async function ensureIdbMigration(): Promise<void> {
  if (isTauri() || _idbMigrated) return;
  _idbMigrated = true;
  await idbMigrateFromLocalStorage(STORAGE_KEY);
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
    if (key) {
      const size = (localStorage.getItem(key) ?? '').length * 2;
      entries[key] = size;
      total += size;
    }
  }
  // Add IDB data info
  try {
    const idbInfo = await idbGetRunsInfo();
    if (idbInfo.count > 0) {
      entries['test-runs (IndexedDB)'] = idbInfo.approxBytes;
      total += idbInfo.approxBytes;
    }
  } catch { /* IDB unavailable */ }
  // Estimate sizes of other IDB stores
  const idbChecks: Array<{ label: string; fn: () => Promise<unknown> }> = [
    { label: 'workflows (IndexedDB)', fn: idbLoadWorkflows },
    { label: 'requests (IndexedDB)', fn: idbLoadRequests },
    { label: 'catalog (IndexedDB)', fn: () => idbLoadCatalogEntries() },
    { label: 'projects (IndexedDB)', fn: idbLoadProjects },
    { label: 'environments (IndexedDB)', fn: idbLoadEnvironments },
    { label: 'microservices (IndexedDB)', fn: idbLoadMicroservices },
    { label: 'global auth (IndexedDB)', fn: idbLoadGlobalAuthProfiles },
  ];
  for (const { label, fn } of idbChecks) {
    try {
      const data = await fn();
      if (data) {
        const size = JSON.stringify(data).length * 2;
        entries[label] = size;
        total += size;
      }
    } catch { /* ignore */ }
  }
  return { usedBytes: total, entries };
}

// ---------- Test runs ----------

export async function saveTestRun(run: TestRun): Promise<{ ok: boolean; quotaError?: boolean }> {
  const truncated = capAndTruncateResults(run);
  if (isTauri()) {
    // Tauri: file-system backed, keep existing approach
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
  // Browser: IndexedDB
  try {
    await ensureIdbMigration();
    await idbSaveTestRun(truncated);
    const max = await getMaxRuns();
    await idbPruneToMax(max);
    return { ok: true };
  } catch {
    return { ok: false, quotaError: true };
  }
}

export async function forceSaveTestRun(run: TestRun): Promise<{ ok: boolean }> {
  const truncated = capAndTruncateResults(run);
  if (isTauri()) {
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
  // Browser: IndexedDB — no quota issue
  try {
    await ensureIdbMigration();
    await idbSaveTestRun(truncated);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Update an existing TestRun in-place (by id). Used for result merging after re-runs.
 */
export async function updateTestRun(run: TestRun): Promise<{ ok: boolean }> {
  const truncated = capAndTruncateResults(run);
  if (isTauri()) {
    try {
      const runs = await loadTestRuns();
      const idx = runs.findIndex(r => r.id === truncated.id);
      if (idx === -1) return { ok: false };
      runs[idx] = truncated;
      await writeKey(STORAGE_KEY, JSON.stringify(runs));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
  // Browser: IndexedDB — put upserts by key
  try {
    await ensureIdbMigration();
    await idbSaveTestRun(truncated);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function loadTestRuns(): Promise<TestRun[]> {
  if (isTauri()) {
    try {
      const raw = await readKey(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as TestRun[];
    } catch {
      return [];
    }
  }
  // Browser: IndexedDB
  try {
    await ensureIdbMigration();
    return await idbLoadTestRuns();
  } catch {
    return [];
  }
}

/**
 * Load test runs WITHOUT compressed trace data (lightweight).
 * For Tauri: strips compressedTrace from each run after loading.
 * For browser: uses idbLoadTestRunsLite which never reads the trace field.
 */
export async function loadTestRunsLite(): Promise<TestRun[]> {
  if (isTauri()) {
    try {
      const raw = await readKey(STORAGE_KEY);
      if (!raw) return [];
      const runs = JSON.parse(raw) as TestRun[];
      return runs.map(run => {
        if (!run.compressedTrace) return run;
        const { compressedTrace: _, ...lite } = run;
        return { ...lite, hasTrace: true };
      });
    } catch {
      return [];
    }
  }
  try {
    await ensureIdbMigration();
    return await idbLoadTestRunsLite();
  } catch {
    return [];
  }
}

/**
 * Load the compressed trace for a single run by ID. Returns the raw compressed string.
 * For Tauri: loads all runs and picks the matching one (no random-access optimization).
 * For browser: loads only the trace field from IndexedDB.
 */
export async function loadTraceForRun(runId: string): Promise<string | undefined> {
  if (isTauri()) {
    try {
      const raw = await readKey(STORAGE_KEY);
      if (!raw) return undefined;
      const runs = JSON.parse(raw) as TestRun[];
      return runs.find(r => r.id === runId)?.compressedTrace;
    } catch {
      return undefined;
    }
  }
  try {
    await ensureIdbMigration();
    return await idbLoadTrace(runId);
  } catch {
    return undefined;
  }
}

export async function saveTestRunsBulk(runs: TestRun[]): Promise<void> {
  if (isTauri()) {
    await writeKey(STORAGE_KEY, JSON.stringify(runs));
    return;
  }
  await ensureIdbMigration();
  await idbSaveTestRunsBulk(runs);
}

export async function deleteTestRun(runId: string): Promise<void> {
  if (isTauri()) {
    const runs = (await loadTestRuns()).filter((r) => r.id !== runId);
    await writeKey(STORAGE_KEY, JSON.stringify(runs));
    return;
  }
  await ensureIdbMigration();
  await idbDeleteTestRun(runId);
}

/** Delete all test runs older than `cutoffMs` (epoch). Returns count deleted. */
export async function deleteRunsOlderThan(cutoffMs: number): Promise<number> {
  if (isTauri()) {
    const runs = await loadTestRuns();
    const kept = runs.filter(r => (r.timestamp ?? 0) >= cutoffMs);
    const deleted = runs.length - kept.length;
    if (deleted > 0) await writeKey(STORAGE_KEY, JSON.stringify(kept));
    return deleted;
  }
  await ensureIdbMigration();
  return idbDeleteRunsOlderThan(cutoffMs);
}

/** Delete all test runs. */
export async function clearAllTestRuns(): Promise<void> {
  if (isTauri()) {
    await writeKey(STORAGE_KEY, JSON.stringify([]));
    return;
  }
  await ensureIdbMigration();
  await idbClearAllRuns();
}

// ---------- Flat app-level data (v3) ----------

export interface AppData {
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  globalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  selectedSvcId: string;
}

async function saveJsonKey<T>(key: string, data: T): Promise<void> { await writeKey(key, JSON.stringify(data)); }
async function loadJsonKey<T>(key: string): Promise<T[]> { try { const r = await readKey(key); return r ? JSON.parse(r) : []; } catch { return []; } }

export async function saveEnvironments(envs: Environment[]): Promise<void> {
  await environmentsStorage.save(envs);
}
export async function loadEnvironments(): Promise<Environment[]> {
  return environmentsStorage.load();
}

export async function saveMicroservices(svcs: Microservice[]): Promise<void> {
  await microservicesStorage.save(svcs);
}
export async function loadMicroservices(): Promise<Microservice[]> {
  return microservicesStorage.load();
}

const environmentsStorage = createDualModeArrayStorage<Environment>({
  key: FLAT_ENVS_KEY,
  idbLoad: idbLoadEnvironments,
  idbSave: idbSaveEnvironments,
  idbMigrate: idbMigrateEnvironments,
});

const microservicesStorage = createDualModeArrayStorage<Microservice>({
  key: FLAT_SVCS_KEY,
  idbLoad: idbLoadMicroservices,
  idbSave: idbSaveMicroservices,
  idbMigrate: idbMigrateMicroservices,
});

const globalAuthProfilesStorage = createDualModeArrayStorage<GlobalAuthProfile>({
  key: GLOBAL_AUTH_KEY,
  idbLoad: idbLoadGlobalAuthProfiles,
  idbSave: idbSaveGlobalAuthProfiles,
  idbMigrate: idbMigrateGlobalAuthProfiles,
});

const featureGroupsStorage = createDualModeArrayStorage<FeatureGroup>({
  key: FLAT_FGS_KEY,
  idbLoad: idbLoadFeatureGroups,
  idbSave: idbSaveFeatureGroups,
  idbMigrate: idbMigrateFeatureGroups,
  fallbackToLocalStorageOnIdbSaveError: true,
});

export async function saveFeatureGroups(fgs: FeatureGroup[]): Promise<void> {
  await featureGroupsStorage.save(fgs);
}

export async function loadFeatureGroups(): Promise<FeatureGroup[]> {
  let fgs = await featureGroupsStorage.load();

  // Normalize: ensure all test objects have required fields (auth, body, validation, headers)
  let normalized = false;
  for (const fg of fgs) {
    for (const sc of fg.scenarios ?? []) {
      for (const t of sc.tests ?? []) {
        if (!t.auth || !t.validation || t.body == null || !t.headers) {
          ensureScenarioDefaults(t);
          normalized = true;
        }
      }
    }
  }
  if (normalized) await saveFeatureGroups(fgs);

  // Migrate: rename legacy "dataTable" property to "dataSource" on Scenario objects
  let migrated = false;
  for (const fg of fgs) {
    for (const sc of fg.scenarios ?? []) {
      for (const t of sc.tests ?? []) {
        const legacy = t as unknown as Record<string, unknown>;
        if (legacy['dataTable'] && !t.dataSource) {
          t.dataSource = legacy['dataTable'] as DataSource;
          delete legacy['dataTable'];
          migrated = true;
        }
      }
    }
  }
  if (migrated) await saveFeatureGroups(fgs);

  // Migrate: add `kind` to scenarios that don't have it; split mixed scenarios
  const kindResult = migrateScenarioKinds(fgs);
  if (kindResult.migrated) {
    fgs = kindResult.groups;
    await saveFeatureGroups(fgs);
  }

  // Store migration metadata for notification banner
  if (kindResult.migrated && kindResult.splitCount > 0) {
    try { await writeKey('migration-v4-split-count', String(kindResult.splitCount)); } catch { /* best effort */ }
  }

  return fgs;
}

export async function saveSelectedEnvId(id: string): Promise<void> { await writeKey(FLAT_SEL_ENV_KEY, id); }
export async function loadSelectedEnvId(): Promise<string> { return (await readKey(FLAT_SEL_ENV_KEY)) ?? ''; }

export async function saveSelectedSvcId(id: string): Promise<void> { await writeKey(FLAT_SEL_SVC_KEY, id); }
export async function loadSelectedSvcId(): Promise<string> { return (await readKey(FLAT_SEL_SVC_KEY)) ?? ''; }

// ---------- Global Auth Profiles ----------

export async function saveGlobalAuthProfiles(profiles: GlobalAuthProfile[]): Promise<void> {
  await globalAuthProfilesStorage.save(profiles);
}
export async function loadGlobalAuthProfiles(): Promise<GlobalAuthProfile[]> {
  return globalAuthProfilesStorage.load();
}

// ---------- Shared Data Sources ----------

export async function saveSharedDataSources(sources: SharedDataSource[]): Promise<void> {
  if (isTauri()) {
    await saveJsonKey(FLAT_SHARED_DS_KEY, sources);
    return;
  }
  try {
    await idbSaveSharedDataSources(sources);
  } catch {
    await saveJsonKey(FLAT_SHARED_DS_KEY, sources);
  }
}

export async function loadSharedDataSources(): Promise<SharedDataSource[]> {
  if (isTauri()) {
    return loadJsonKey<SharedDataSource>(FLAT_SHARED_DS_KEY);
  }
  try {
    const fromIdb = await idbLoadSharedDataSources();
    if (fromIdb !== null) return fromIdb;
    // Attempt one-time migration from localStorage
    const migrated = await idbMigrateSharedDataSources(FLAT_SHARED_DS_KEY);
    if (migrated) {
      const after = await idbLoadSharedDataSources();
      if (after !== null) return after;
    }
    return loadJsonKey<SharedDataSource>(FLAT_SHARED_DS_KEY);
  } catch {
    return loadJsonKey<SharedDataSource>(FLAT_SHARED_DS_KEY);
  }
}

// ---------- Workspace Defaults ----------

export async function saveWorkspaceDefaults(defaults: Record<string, string>): Promise<void> {
  await writeKey(FLAT_WORKSPACE_DEFAULTS_KEY, JSON.stringify(defaults));
}

export async function loadWorkspaceDefaults(): Promise<Record<string, string>> {
  try {
    const raw = await readKey(FLAT_WORKSPACE_DEFAULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') {
        map[key] = value;
      } else if (value == null) {
        map[key] = '';
      } else if (typeof value === 'object') {
        try {
          map[key] = JSON.stringify(value);
        } catch {
          map[key] = String(value);
        }
      } else {
        map[key] = String(value);
      }
    }
    return map;
  } catch {
    return {};
  }
}

// ---------- Migration (v1 legacy + v2 projects → v3 flat) ----------
// Implementations live in `./storageMigration.ts` to keep this file under the
// monolithic-class threshold; re-exports below preserve the public API.
export {
  migrateToFlat,
  migratePerFgSharedDataSourcesToTopLevel,
} from './storageMigration';

// ---------- Runner config ----------

function runnerConfigStorageKey(contextKey?: string): string {
  return contextKey ? `${RUNNER_CONFIG_KEY}:${contextKey}` : RUNNER_CONFIG_KEY;
}

function readLegacyRunnerConfigRaw(contextKey?: string): string | null {
  try {
    return localStorage.getItem(runnerConfigStorageKey(contextKey));
  } catch {
    return null;
  }
}

async function parseRunnerConfigPayload(raw: string, contextKey?: string): Promise<unknown> {
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && 'totalTransactions' in parsed && !('iterations' in parsed)) {
    (parsed as Record<string, unknown>).iterations = (parsed as Record<string, unknown>).totalTransactions;
    delete (parsed as Record<string, unknown>).totalTransactions;
    await saveRunnerConfig(parsed, contextKey);
  }
  return parsed;
}

export async function saveRunnerConfig(config: unknown, contextKey?: string): Promise<void> {
  const payload = JSON.stringify(config);

  if (isTauri()) {
    const key = runnerConfigStorageKey(contextKey);
    purgeStaleRunnerConfigKeys(contextKey);
    try {
      await writeKey(key, payload, { notifyOnQuotaExhausted: false });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) throw e;
      purgeStaleRunnerConfigKeys(contextKey);
      cleanupStaleStorageKeys();
      try {
        await writeKey(key, payload, { notifyOnQuotaExhausted: false });
      } catch {
        console.warn(`[Storage] Runner config save failed for "${key}" — quota exceeded.`);
      }
    }
    return;
  }

  try {
    await idbSaveRunnerConfig(contextKey ?? '', payload);
    purgeRunnerConfigLocalStorageKeys(contextKey);
  } catch (err) {
    console.warn('[Storage] Runner config IDB save failed — localStorage fallback', err);
    purgeStaleRunnerConfigKeys(contextKey);
    purgeRunnerConfigLocalStorageKeys(contextKey);
    try {
      await writeKey(runnerConfigStorageKey(contextKey), payload, { notifyOnQuotaExhausted: false });
    } catch {
      console.warn('[Storage] Runner config save skipped — storage full.');
    }
  }
}

export async function loadRunnerConfig(contextKey?: string): Promise<unknown | null> {
  try {
    if (isTauri()) {
      const raw = await readKey(runnerConfigStorageKey(contextKey));
      if (!raw) return null;
      return await parseRunnerConfigPayload(raw, contextKey);
    }

    let raw = await idbLoadRunnerConfig(contextKey ?? '');
    if (raw === null) {
      const legacy = readLegacyRunnerConfigRaw(contextKey);
      if (legacy) {
        try {
          await idbSaveRunnerConfig(contextKey ?? '', legacy);
          purgeRunnerConfigLocalStorageKeys(contextKey);
        } catch { /* best effort */ }
        raw = legacy;
      }
    }
    if (!raw) return null;
    return await parseRunnerConfigPayload(raw, contextKey);
  } catch {
    return null;
  }
}

// ---------- Theme ----------

export async function saveTheme(theme: string): Promise<void> {
  await writeKey(THEME_KEY, theme);
}

export async function loadTheme(): Promise<string> {
  return (await readKey(THEME_KEY)) ?? 'dark';
}

export { loadPreviewSampleId, savePreviewSampleId } from './storageUiPrefs';

// ---------- Requests ----------

const EMPTY_REQUESTS: RequestsData = {
  environments: [],
  collections: [],
};

export async function loadRequests(): Promise<RequestsData> {
  if (isTauri()) {
    try {
      const raw = await readKey(REQUESTS_KEY);
      if (raw) return JSON.parse(raw) as RequestsData;
      const legacy = await readKey(LEGACY_WORKBENCH_KEY);
      if (legacy) {
        const data = JSON.parse(legacy) as RequestsData;
        await writeKey(REQUESTS_KEY, legacy);
        await removeKey(LEGACY_WORKBENCH_KEY);
        return data;
      }
    } catch { /* ignore */ }
    return { ...EMPTY_REQUESTS, environments: [], collections: [] };
  }
  // Browser: IDB first, then localStorage fallback + migration
  try {
    const fromIdb = await idbLoadRequests();
    if (fromIdb) return fromIdb;
    const raw = await readKey(REQUESTS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as RequestsData;
      await idbMigrateRequests(REQUESTS_KEY);
      return data;
    }
    const legacy = await readKey(LEGACY_WORKBENCH_KEY);
    if (legacy) {
      const data = JSON.parse(legacy) as RequestsData;
      await idbSaveRequests(data);
      await removeKey(LEGACY_WORKBENCH_KEY);
      return data;
    }
  } catch { /* ignore */ }
  return { ...EMPTY_REQUESTS, environments: [], collections: [] };
}

export async function saveRequests(data: RequestsData): Promise<void> {
  if (isTauri()) {
    await writeKey(REQUESTS_KEY, JSON.stringify(data));
    return;
  }
  try {
    await idbSaveRequests(data);
    if (localStorage.getItem(REQUESTS_KEY)) localStorage.removeItem(REQUESTS_KEY);
  } catch {
    await writeKey(REQUESTS_KEY, JSON.stringify(data));
  }
}

// ── Workflows (selection / UI prefs — core CRUD in storageWorkflows.ts) ──

/** Last selected workflow id in the designer (survives refresh). */
const WORKFLOWS_SELECTED_ID_KEY = 'workflows_selected_id';
/** When true, do not auto-inject the built-in sample workflow on load (user removed it). */
const WORKFLOWS_SAMPLE_DISMISSED_KEY = 'workflows_sample_dismissed';

export async function loadSelectedWorkflowId(): Promise<string | null> {
  try {
    const r = await readKey(WORKFLOWS_SELECTED_ID_KEY);
    return r?.trim() ? r.trim() : null;
  } catch {
    return null;
  }
}

export async function saveSelectedWorkflowId(id: string | null): Promise<void> {
  if (id?.trim()) {
    await writeKey(WORKFLOWS_SELECTED_ID_KEY, id.trim());
  } else {
    await removeKey(WORKFLOWS_SELECTED_ID_KEY);
  }
}

export async function loadWorkflowSampleDismissed(): Promise<boolean> {
  try {
    const r = await readKey(WORKFLOWS_SAMPLE_DISMISSED_KEY);
    return r === 'true';
  } catch {
    return false;
  }
}

export async function saveWorkflowSampleDismissed(dismissed: boolean): Promise<void> {
  await writeKey(WORKFLOWS_SAMPLE_DISMISSED_KEY, dismissed ? 'true' : 'false');
}

export async function getStorageDiagnostics(): Promise<string> {
  const usage = await getStorageUsage();
  return formatStorageDiagnostics(usage);
}

// ---------- Re-exports (catalog & workflow CRUD live in dedicated modules) ----------

export {
  loadCatalogEntries,
  saveCatalogEntries,
  loadCatalogRawSpec,
  saveCatalogRawSpec,
  removeCatalogRawSpec,
  removeAllCatalogRawSpecs,
  loadCatalogEndpointValues,
  saveCatalogEndpointValues,
  removeCatalogEndpointValues,
} from './storageCatalog';

export {
  loadWorkflows,
  saveWorkflows,
  loadWorkflowFolders,
  saveWorkflowFolders,
  compactWorkflowStorage,
} from './storageWorkflows';
