import type { TestRun, RequestResult, FeatureGroup, Environment, Microservice, GlobalAuthProfile, RequestsData } from '../types';
import type { CatalogEntry, SavedEndpointValues } from '../../features/catalog/types/catalog';
import { isTauri } from './platform';
import * as tauriStore from './tauriStore';

const STORAGE_KEY = 'perf-test-runs';
const GLOBAL_AUTH_KEY = 'perf-test-global-auth-profiles';
const MAX_RUNS_KEY = 'perf-test-max-runs';
const RUNNER_CONFIG_KEY = 'perf-test-runner-config';
const THEME_KEY = 'perf-test-theme';
const REQUESTS_KEY = 'perf-test-requests';
const LEGACY_WORKBENCH_KEY = 'perf-test-workbench';
const CATALOG_KEY = 'perf-test-catalog';
const CATALOG_SPEC_PREFIX = 'perf-test-catalog-spec-';
const CATALOG_EP_VALUES_PREFIX = 'perf-test-catalog-ep-';

// Flat app-level data keys (v3)
const FLAT_ENVS_KEY = 'perf-test-v3-environments';
const FLAT_SVCS_KEY = 'perf-test-v3-microservices';
const FLAT_FGS_KEY = 'perf-test-v3-feature-groups';
const FLAT_SEL_ENV_KEY = 'perf-test-v3-selected-env';
const FLAT_SEL_SVC_KEY = 'perf-test-v3-selected-svc';
const FLAT_MIGRATED_KEY = 'perf-test-v3-migrated';

// Legacy keys (used only for migration)
const LEGACY_FEATURES_KEY = 'perf-test-features';
const LEGACY_ENVS_KEY = 'perf-test-environments';
const LEGACY_SERVICES_KEY = 'perf-test-microservices';
const LEGACY_GLOBAL_AUTH_KEY = 'perf-test-global-auth';
const PROJECTS_KEY = 'perf-test-projects';
const SELECTED_PROJECT_KEY = 'perf-test-selected-project';

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

// ---------- Test runs ----------

export async function saveTestRun(run: TestRun): Promise<{ ok: boolean; quotaError?: boolean }> {
  const truncated = capAndTruncateResults(run);
  let runs = await loadTestRuns();
  runs.unshift(truncated);
  const max = await getMaxRuns();
  if (runs.length > max) runs.length = max;
  try {
    await writeKey(STORAGE_KEY, JSON.stringify(runs));
    return { ok: true };
  } catch {
    // Auto-shrink: remove oldest runs until it fits
    for (let attempt = 0; attempt < 5 && runs.length > 1; attempt++) {
      runs = runs.slice(0, Math.max(1, Math.ceil(runs.length * 0.75)));
      try {
        await writeKey(STORAGE_KEY, JSON.stringify(runs));
        return { ok: true };
      } catch { /* keep shrinking */ }
    }
    // Last resort: save only the new run
    try {
      await writeKey(STORAGE_KEY, JSON.stringify([truncated]));
      return { ok: true };
    } catch {
      return { ok: false, quotaError: true };
    }
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

export async function saveEnvironments(envs: Environment[]): Promise<void> { await saveJsonKey(FLAT_ENVS_KEY, envs); }
export async function loadEnvironments(): Promise<Environment[]> { return loadJsonKey<Environment>(FLAT_ENVS_KEY); }

export async function saveMicroservices(svcs: Microservice[]): Promise<void> { await saveJsonKey(FLAT_SVCS_KEY, svcs); }
export async function loadMicroservices(): Promise<Microservice[]> { return loadJsonKey<Microservice>(FLAT_SVCS_KEY); }

export async function saveFeatureGroups(fgs: FeatureGroup[]): Promise<void> { await saveJsonKey(FLAT_FGS_KEY, fgs); }
export async function loadFeatureGroups(): Promise<FeatureGroup[]> { return loadJsonKey<FeatureGroup>(FLAT_FGS_KEY); }

export async function saveSelectedEnvId(id: string): Promise<void> { await writeKey(FLAT_SEL_ENV_KEY, id); }
export async function loadSelectedEnvId(): Promise<string> { return (await readKey(FLAT_SEL_ENV_KEY)) ?? ''; }

export async function saveSelectedSvcId(id: string): Promise<void> { await writeKey(FLAT_SEL_SVC_KEY, id); }
export async function loadSelectedSvcId(): Promise<string> { return (await readKey(FLAT_SEL_SVC_KEY)) ?? ''; }

// ---------- Global Auth Profiles ----------

export async function saveGlobalAuthProfiles(profiles: GlobalAuthProfile[]): Promise<void> { await saveJsonKey(GLOBAL_AUTH_KEY, profiles); }
export async function loadGlobalAuthProfiles(): Promise<GlobalAuthProfile[]> { return loadJsonKey<GlobalAuthProfile>(GLOBAL_AUTH_KEY); }

// ---------- Migration (v1 legacy + v2 projects → v3 flat) ----------

export async function migrateToFlat(): Promise<AppData | null> {
  const alreadyMigrated = await readKey(FLAT_MIGRATED_KEY);
  if (alreadyMigrated === 'true') return null;

  // Try v2 (project-based) migration first
  const rawProjects = await readKey(PROJECTS_KEY);
  if (rawProjects) {
    try {
      const projects = JSON.parse(rawProjects) as Array<{
        id: string; environments?: Environment[]; microservices?: Microservice[];
        globalAuthProfiles?: GlobalAuthProfile[]; featureGroups?: FeatureGroup[];
        selectedEnvId?: string; selectedSvcId?: string;
      }>;
      const rawSelId = await readKey(SELECTED_PROJECT_KEY);
      const sel = projects.find((p) => p.id === rawSelId) ?? projects[0];
      if (sel) {
        // Merge all project data (selected first, then others for envs/svcs/auth)
        const envs = [...(sel.environments ?? [])];
        const svcs = [...(sel.microservices ?? [])];
        let fgs = [...(sel.featureGroups ?? [])];
        const auth = [...(sel.globalAuthProfiles ?? [])];

        const envIds = new Set(envs.map(e => e.id));
        const svcIds = new Set(svcs.map(s => s.id));
        const authIds = new Set(auth.map(a => a.id));
        for (const p of projects) {
          if (p.id === sel.id) continue;
          for (const e of (p.environments ?? [])) if (!envIds.has(e.id)) { envs.push(e); envIds.add(e.id); }
          for (const s of (p.microservices ?? [])) if (!svcIds.has(s.id)) { svcs.push(s); svcIds.add(s.id); }
          for (const a of (p.globalAuthProfiles ?? [])) if (!authIds.has(a.id)) { auth.push(a); authIds.add(a.id); }
          fgs.push(...(p.featureGroups ?? []));
        }

        // Strip any projectId from FGs
        fgs = fgs.map((fg) => {
          const copy = { ...fg };
          if ('projectId' in copy) delete (copy as Record<string, unknown>).projectId;
          return copy;
        });

        // Merge project-level auth profiles into app global
        const existingGlobal = await loadGlobalAuthProfiles();
        const existingGlobalIds = new Set(existingGlobal.map(a => a.id));
        const mergedGlobal = [...existingGlobal];
        for (const a of auth) {
          if (!existingGlobalIds.has(a.id)) { mergedGlobal.push(a); existingGlobalIds.add(a.id); }
        }

        const data: AppData = {
          environments: envs,
          microservices: svcs,
          featureGroups: fgs,
          globalAuthProfiles: mergedGlobal,
          selectedEnvId: sel.selectedEnvId ?? '',
          selectedSvcId: sel.selectedSvcId ?? '',
        };

        await Promise.all([
          saveEnvironments(data.environments),
          saveMicroservices(data.microservices),
          saveFeatureGroups(data.featureGroups),
          saveGlobalAuthProfiles(data.globalAuthProfiles),
          saveSelectedEnvId(data.selectedEnvId),
          saveSelectedSvcId(data.selectedSvcId),
          writeKey(FLAT_MIGRATED_KEY, 'true'),
        ]);
        return data;
      }
    } catch { /* fall through to v1 */ }
  }

  // Try v1 (legacy flat keys) migration
  const [legacyEnvs, legacySvcs, legacyAuth, legacyFgs] = await Promise.all([
    readKey(LEGACY_ENVS_KEY),
    readKey(LEGACY_SERVICES_KEY),
    readKey(LEGACY_GLOBAL_AUTH_KEY),
    readKey(LEGACY_FEATURES_KEY),
  ]);

  const hasLegacy = legacyEnvs || legacySvcs || legacyAuth || legacyFgs;
  if (!hasLegacy) {
    await writeKey(FLAT_MIGRATED_KEY, 'true');
    return null;
  }

  const environments: Environment[] = legacyEnvs ? JSON.parse(legacyEnvs) : [];
  const microservices: Microservice[] = legacySvcs ? JSON.parse(legacySvcs) : [];
  const globalAuthProfiles: GlobalAuthProfile[] = legacyAuth ? JSON.parse(legacyAuth) : [];
  let featureGroups: FeatureGroup[] = legacyFgs ? JSON.parse(legacyFgs) : [];
  featureGroups = featureGroups.map((fg) => {
    const copy = { ...fg };
    if ('projectId' in copy) delete (copy as Record<string, unknown>).projectId;
    return copy;
  });

  if (environments.length === 0 && microservices.length === 0 && globalAuthProfiles.length === 0 && featureGroups.length === 0) {
    await writeKey(FLAT_MIGRATED_KEY, 'true');
    return null;
  }

  const existingGlobal = await loadGlobalAuthProfiles();
  const merged = [...existingGlobal];
  const ids = new Set(existingGlobal.map(a => a.id));
  for (const a of globalAuthProfiles) if (!ids.has(a.id)) merged.push(a);

  const data: AppData = { environments, microservices, featureGroups, globalAuthProfiles: merged, selectedEnvId: '', selectedSvcId: '' };
  await Promise.all([
    saveEnvironments(data.environments),
    saveMicroservices(data.microservices),
    saveFeatureGroups(data.featureGroups),
    saveGlobalAuthProfiles(data.globalAuthProfiles),
    writeKey(FLAT_MIGRATED_KEY, 'true'),
  ]);

  await Promise.all([
    removeKey(LEGACY_ENVS_KEY), removeKey(LEGACY_SERVICES_KEY),
    removeKey(LEGACY_GLOBAL_AUTH_KEY), removeKey(LEGACY_FEATURES_KEY),
    removeKey('perf-test-selected-env'), removeKey('perf-test-selected-svc'),
    removeKey('perf-test-scenarios'),
  ]);

  return data;
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

// ---------- Requests ----------

const EMPTY_REQUESTS: RequestsData = {
  environments: [],
  collections: [],
};

export async function loadRequests(): Promise<RequestsData> {
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

export async function saveRequests(data: RequestsData): Promise<void> {
  await writeKey(REQUESTS_KEY, JSON.stringify(data));
}

// ---------- Catalog ----------

export async function loadCatalogEntries(): Promise<CatalogEntry[]> {
  try {
    const raw = await readKey(CATALOG_KEY);
    if (raw) return JSON.parse(raw) as CatalogEntry[];
  } catch { /* ignore */ }
  return [];
}

export async function saveCatalogEntries(entries: CatalogEntry[]): Promise<void> {
  await writeKey(CATALOG_KEY, JSON.stringify(entries));
}

export async function loadCatalogRawSpec(entryId: string, versionId: string): Promise<string | null> {
  try {
    const raw = await readKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`);
    return raw || null;
  } catch { return null; }
}

export async function saveCatalogRawSpec(entryId: string, versionId: string, rawSpec: string): Promise<void> {
  await writeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`, rawSpec);
}

export async function removeCatalogRawSpec(entryId: string, versionId: string): Promise<void> {
  await removeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${versionId}`);
}

export async function removeAllCatalogRawSpecs(entryId: string, versionIds: string[]): Promise<void> {
  await Promise.all(versionIds.map(vid => removeKey(`${CATALOG_SPEC_PREFIX}${entryId}-${vid}`)));
}

// ---------- Catalog Endpoint Values ----------

export async function loadCatalogEndpointValues(entryId: string): Promise<Record<string, SavedEndpointValues>> {
  try {
    const raw = await readKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export async function saveCatalogEndpointValues(entryId: string, values: Record<string, SavedEndpointValues>): Promise<void> {
  await writeKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`, JSON.stringify(values));
}

export async function removeCatalogEndpointValues(entryId: string): Promise<void> {
  await removeKey(`${CATALOG_EP_VALUES_PREFIX}${entryId}`);
}

// ── Workflows ──────────────────────────────────────────────

const WORKFLOWS_KEY = 'workflows';
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

export async function loadWorkflows(): Promise<import('../../features/workflow/types/workflow').Workflow[]> {
  try { const r = await readKey(WORKFLOWS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

export async function saveWorkflows(workflows: import('../../features/workflow/types/workflow').Workflow[]): Promise<void> {
  await writeKey(WORKFLOWS_KEY, JSON.stringify(workflows));
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

/** Preview sample workflow entry ID — survives refresh via sessionStorage. */
const WORKFLOW_PREVIEW_SAMPLE_KEY = 'workflow_preview_sample_id';

export function loadPreviewSampleId(): string | null {
  try {
    return sessionStorage.getItem(WORKFLOW_PREVIEW_SAMPLE_KEY) || null;
  } catch {
    return null;
  }
}

export function savePreviewSampleId(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(WORKFLOW_PREVIEW_SAMPLE_KEY, id);
    } else {
      sessionStorage.removeItem(WORKFLOW_PREVIEW_SAMPLE_KEY);
    }
  } catch {
    /* sessionStorage may be unavailable */
  }
}
