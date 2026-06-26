import { isTauri } from './platform';
import { idbMigrateProjects } from './idbProjects';
import { idbMigrateRequests } from './idbRequests';
import {
  PROJECTS_KEY,
  REQUESTS_KEY,
  RUNNER_CONFIG_KEY,
  FLAT_SEL_ENV_KEY,
  FLAT_SEL_SVC_KEY,
  FLAT_ENVS_KEY,
  FLAT_SVCS_KEY,
  FLAT_FGS_KEY,
} from './storageKeys';
import { idbMigrateEnvironments, idbMigrateMicroservices } from './idbEnvironmentsMicroservices';
import { idbMigrateFeatureGroups } from './idbFeatureGroups';

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
  const [{ migrateWorkflowKeysToIdb }, { migrateCatalogKeysToIdb }] = await Promise.all([
    import('./storageWorkflows'),
    import('./storageCatalog'),
  ]);
  await migrateWorkflowKeysToIdb();
  const migrations: Array<{ check: string; fn: () => Promise<boolean | number> }> = [
    { check: REQUESTS_KEY, fn: () => idbMigrateRequests(REQUESTS_KEY) },
    { check: PROJECTS_KEY, fn: () => idbMigrateProjects(PROJECTS_KEY) },
    { check: FLAT_ENVS_KEY, fn: () => idbMigrateEnvironments(FLAT_ENVS_KEY) },
    { check: FLAT_SVCS_KEY, fn: () => idbMigrateMicroservices(FLAT_SVCS_KEY) },
    { check: FLAT_FGS_KEY, fn: () => idbMigrateFeatureGroups(FLAT_FGS_KEY) },
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
}> {
  const [environments, microservices, featureGroups] = await Promise.all([
    idbMigrateEnvironments(FLAT_ENVS_KEY),
    idbMigrateMicroservices(FLAT_SVCS_KEY),
    idbMigrateFeatureGroups(FLAT_FGS_KEY),
  ]);
  return { environments, microservices, featureGroups };
}
