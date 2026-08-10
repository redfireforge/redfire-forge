import { isTauri } from './platform';
import { idbMigrateProjects } from './idbProjects';
import { idbMigrateRequests } from './idbRequests';
import {
  PROJECTS_KEY,
  REQUESTS_KEY,
  RUNNER_CONFIG_KEY,
  GLOBAL_AUTH_KEY,
  FLAT_SEL_ENV_KEY,
  FLAT_SEL_SVC_KEY,
  FLAT_ENVS_KEY,
  FLAT_SVCS_KEY,
  FLAT_FGS_KEY,
} from './storageKeys';
import { idbMigrateEnvironments, idbMigrateMicroservices } from './idbEnvironmentsMicroservices';
import { idbMigrateFeatureGroups } from './idbFeatureGroups';
import { idbMigrateGlobalAuthProfiles } from './idbGlobalAuthProfiles';
import {
  idbLoadEnvironments,
  idbLoadMicroservices,
} from './idbEnvironmentsMicroservices';
import { idbLoadFeatureGroups } from './idbFeatureGroups';
import { idbLoadGlobalAuthProfiles } from './idbGlobalAuthProfiles';
import {
  migrateGraphqlStudioFromLocalStorage,
  purgeGraphqlStudioLocalStorageDuplicates,
} from './idbGraphqlStudio';
import {
  idbMigrateRunnerConfigsFromLocalStorage,
  purgeRunnerConfigLocalStorageKeys,
} from './idbRunnerConfig';
import { migrateCatalogKeysToIdb } from './storageCatalog';
import { migrateWorkflowKeysToIdb } from './storageWorkflows';

const WORKFLOW_RUN_CACHE_KEY = 'rfg-workflow-run-cache';
const MAX_WORKFLOW_RUN_CACHE_ENTRIES = 6;
const MAX_CONSOLE_LINES_PER_CACHED_WORKFLOW = 200;

/**
 * Designer Quick Test run cache — one localStorage blob keyed by workflow id.
 * Demo lessons seed many ephemeral workflow UUIDs; trim to recent entries only.
 */
export function trimWorkflowRunCacheStorage(
  maxEntries = MAX_WORKFLOW_RUN_CACHE_ENTRIES,
): { removed: number; freedBytes: number } {
  if (isTauri()) return { removed: 0, freedBytes: 0 };
  try {
    const raw = localStorage.getItem(WORKFLOW_RUN_CACHE_KEY);
    if (!raw) return { removed: 0, freedBytes: 0 };
    const beforeBytes = raw.length * 2;
    const parsed = JSON.parse(raw) as Array<[string, { lastRunTime?: number; consoleLines?: unknown[] }]>;
    if (!Array.isArray(parsed)) return { removed: 0, freedBytes: 0 };

    const sorted = [...parsed].sort(
      (a, b) => (b[1]?.lastRunTime ?? 0) - (a[1]?.lastRunTime ?? 0),
    );
    const kept = sorted.slice(0, maxEntries).map(([id, run]) => [
      id,
      {
        ...run,
        consoleLines: Array.isArray(run.consoleLines)
          ? run.consoleLines.slice(-MAX_CONSOLE_LINES_PER_CACHED_WORKFLOW)
          : run.consoleLines,
      },
    ] as [string, typeof run]);

    if (kept.length === parsed.length && kept.length > 0) {
      const first = parsed[0]?.[1];
      const firstKept = kept[0]?.[1];
      if (first?.consoleLines?.length === firstKept?.consoleLines?.length) {
        return { removed: 0, freedBytes: 0 };
      }
    }

    const next = JSON.stringify(kept);
    localStorage.setItem(WORKFLOW_RUN_CACHE_KEY, next);
    const freedBytes = Math.max(0, beforeBytes - next.length * 2);
    return { removed: Math.max(0, parsed.length - kept.length), freedBytes };
  } catch {
    try {
      localStorage.removeItem(WORKFLOW_RUN_CACHE_KEY);
      return { removed: 1, freedBytes: 0 };
    } catch {
      return { removed: 0, freedBytes: 0 };
    }
  }
}

const GQL_STUDIO_LS_KEYS = {
  tabsKey: 'gql_tabs_v1',
  tabsActiveKey: 'gql_tabs_v1_active',
  authKey: 'gql_auth_v1',
  environmentsKey: 'gql_environments_v1',
  profilesKey: 'gql_profiles_v1',
} as const;

/** Suffixes we always retain across runner-config purges. */
const RUNNER_CONFIG_KEEP_SUFFIXES = ['_workflow_runner'];

/**
 * Remove accumulated per-context runner config keys from localStorage.
 * Keeps the global key, workflow runner, current env:svc selection, and optional active key.
 */
export function purgeStaleRunnerConfigKeys(activeContextKey?: string): { removed: number; freedBytes: number } {
  if (isTauri()) return { removed: 0, freedBytes: 0 };

  const keep = new Set<string>([RUNNER_CONFIG_KEY]);
  for (const suffix of RUNNER_CONFIG_KEEP_SUFFIXES) {
    keep.add(`${RUNNER_CONFIG_KEY}:${suffix}`);
  }
  if (activeContextKey) {
    keep.add(`${RUNNER_CONFIG_KEY}:${activeContextKey}`);
  }

  try {
    const envId = localStorage.getItem(FLAT_SEL_ENV_KEY)?.replace(/^"|"$/g, '').trim();
    const svcId = localStorage.getItem(FLAT_SEL_SVC_KEY)?.replace(/^"|"$/g, '').trim();
    if (envId && svcId) {
      keep.add(`${RUNNER_CONFIG_KEY}:${envId}:${svcId}`);
      keep.add(`${RUNNER_CONFIG_KEY}:${envId}:${svcId}:param`);
    } else if (envId) {
      keep.add(`${RUNNER_CONFIG_KEY}:${envId}`);
      keep.add(`${RUNNER_CONFIG_KEY}:${envId}:param`);
    }
  } catch { /* ignore */ }

  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(`${RUNNER_CONFIG_KEY}:`)) continue;
    if (!keep.has(key)) toRemove.push(key);
  }

  let freedBytes = 0;
  for (const key of toRemove) {
    freedBytes += (localStorage.getItem(key) ?? '').length * 2;
    localStorage.removeItem(key);
  }
  return { removed: toRemove.length, freedBytes };
}

/**
 * Remove stale per-scenario runner config, progress, undo, replay, and dm- keys
 * that accumulate over time and bloat localStorage. Keeps only keys that reference
 * IDs still present in the active data.
 * Returns the number of keys removed and bytes freed.
 */
export function cleanupStaleStorageKeys(): { removed: number; freedKB: number } {
  if (isTauri()) return { removed: 0, freedKB: 0 };

  const EPHEMERAL_PREFIXES = [
    'perf-test-last-progress:',
    'perf-test-wf-undo-',
    'replayLayout:',
    'dm-schema-snapshot-',
    'dm-patterns:',
  ];

  let removed = 0;
  let freedBytes = 0;
  const toRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (EPHEMERAL_PREFIXES.some(p => key.startsWith(p))) {
      toRemove.push(key);
    }
  }

  for (const key of toRemove) {
    const size = (localStorage.getItem(key) ?? '').length * 2;
    localStorage.removeItem(key);
    removed++;
    freedBytes += size;
  }

  const runnerPurge = purgeStaleRunnerConfigKeys();
  removed += runnerPurge.removed;
  freedBytes += runnerPurge.freedBytes;

  const lsRunnerPurge = purgeRunnerConfigLocalStorageKeys();
  removed += lsRunnerPurge.removed;
  freedBytes += lsRunnerPurge.freedBytes;

  const wfCache = trimWorkflowRunCacheStorage();
  removed += wfCache.removed;
  freedBytes += wfCache.freedBytes;

  migrateRemainingLargeKeysToIdb().catch(() => { /* best effort */ });

  const freedKB = Math.round(freedBytes / 1024);
  if (removed > 0) {
    console.info(`[Storage] Cleanup: removed ${removed} stale keys, freed ${freedKB} KB`);
  }
  return { removed, freedKB };
}

/**
 * Migrate any large localStorage keys that haven't been moved to IDB yet.
 * Called on startup by cleanupStaleStorageKeys — each key is moved once then
 * deleted from localStorage, freeing up the ~5 MB quota.
 */
async function migrateRemainingLargeKeysToIdb(): Promise<void> {
  await migrateWorkflowKeysToIdb();
  const migrations: Array<{ check: string; fn: () => Promise<boolean | number> }> = [
    { check: REQUESTS_KEY, fn: () => idbMigrateRequests(REQUESTS_KEY) },
    { check: PROJECTS_KEY, fn: () => idbMigrateProjects(PROJECTS_KEY) },
    { check: FLAT_ENVS_KEY, fn: () => idbMigrateEnvironments(FLAT_ENVS_KEY) },
    { check: FLAT_SVCS_KEY, fn: () => idbMigrateMicroservices(FLAT_SVCS_KEY) },
    { check: FLAT_FGS_KEY, fn: () => idbMigrateFeatureGroups(FLAT_FGS_KEY) },
    { check: GLOBAL_AUTH_KEY, fn: () => idbMigrateGlobalAuthProfiles(GLOBAL_AUTH_KEY) },
  ];
  for (const { check, fn } of migrations) {
    if (localStorage.getItem(check)) {
      try { await fn(); } catch { /* ignore */ }
    }
  }
  await migrateCatalogKeysToIdb();
}

/**
 * Move environments, microservices, and feature groups off localStorage when still present.
 * Safe before GraphQL demo lessons — frees quota for selection keys and runner config.
 */
export async function migrateAppFlatDataFromLocalStorage(): Promise<{
  environments: boolean;
  microservices: boolean;
  featureGroups: boolean;
  globalAuthProfiles: boolean;
}> {
  const [environments, microservices, featureGroups, globalAuthProfiles] = await Promise.all([
    idbMigrateEnvironments(FLAT_ENVS_KEY),
    idbMigrateMicroservices(FLAT_SVCS_KEY),
    idbMigrateFeatureGroups(FLAT_FGS_KEY),
    idbMigrateGlobalAuthProfiles(GLOBAL_AUTH_KEY),
  ]);
  return { environments, microservices, featureGroups, globalAuthProfiles };
}

/** Drop localStorage copies of large blobs once IndexedDB holds the data. */
async function purgeFlatLocalStorageWhenIdbReady(): Promise<number> {
  if (isTauri()) return 0;

  const checks: Array<{ lsKey: string; idbLoad: () => Promise<unknown[] | null> }> = [
    { lsKey: FLAT_ENVS_KEY, idbLoad: idbLoadEnvironments },
    { lsKey: FLAT_SVCS_KEY, idbLoad: idbLoadMicroservices },
    { lsKey: FLAT_FGS_KEY, idbLoad: idbLoadFeatureGroups },
    { lsKey: GLOBAL_AUTH_KEY, idbLoad: idbLoadGlobalAuthProfiles },
  ];

  let removed = 0;
  for (const { lsKey, idbLoad } of checks) {
    try {
      if (!localStorage.getItem(lsKey)) continue;
      const data = await idbLoad();
      if (data === null) continue;
      localStorage.removeItem(lsKey);
      removed++;
    } catch { /* ignore */ }
  }
  return removed;
}

/**
 * One-shot browser bootstrap: migrate large blobs to IndexedDB and reclaim
 * localStorage quota. Call before loading or saving app data on web.
 */
export async function ensureBrowserLargeDataMigrated(): Promise<void> {
  if (isTauri()) return;

  purgeStaleRunnerConfigKeys();
  await idbMigrateRunnerConfigsFromLocalStorage();
  purgeRunnerConfigLocalStorageKeys();
  trimWorkflowRunCacheStorage();
  await migrateRemainingLargeKeysToIdb();
  await migrateAppFlatDataFromLocalStorage();
  await migrateGraphqlStudioFromLocalStorage(GQL_STUDIO_LS_KEYS);
  await purgeFlatLocalStorageWhenIdbReady();
  await purgeGraphqlStudioLocalStorageDuplicates(GQL_STUDIO_LS_KEYS);
}

/**
 * Best-effort quota reclaim before retrying a localStorage write.
 * Returns approximate KB freed from localStorage.
 */
export async function reclaimLocalStorageQuotaForWrite(): Promise<number> {
  if (isTauri()) return 0;

  const before = localStorage.length;
  let freedBytes = 0;

  const stale = cleanupStaleStorageKeys();
  freedBytes += stale.freedKB * 1024;

  await migrateAppFlatDataFromLocalStorage();
  await migrateGraphqlStudioFromLocalStorage(GQL_STUDIO_LS_KEYS);
  const flatRemoved = await purgeFlatLocalStorageWhenIdbReady();
  await purgeGraphqlStudioLocalStorageDuplicates(GQL_STUDIO_LS_KEYS);

  if (flatRemoved > 0 || localStorage.length < before) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if ([FLAT_ENVS_KEY, FLAT_SVCS_KEY, FLAT_FGS_KEY, GLOBAL_AUTH_KEY].includes(key)) {
        const size = (localStorage.getItem(key) ?? '').length * 2;
        localStorage.removeItem(key);
        freedBytes += size;
      }
    }
  }

  return Math.round(freedBytes / 1024);
}
