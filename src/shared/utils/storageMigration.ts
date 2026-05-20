/**
 * Storage migrations (extracted from `storage.ts` to keep the main module under
 * the monolithic-file threshold).
 *
 * - `migrateToFlat` — one-time migration from legacy v1 flat keys or v2
 *   project-based shape into the current v3 flat top-level layout.
 * - `migratePerFgSharedDataSourcesToTopLevel` — promotes per-FeatureGroup
 *   `sharedDataSources` arrays to the top-level `sharedDataSources` collection
 *   and strips them from FGs (idempotent).
 */
import type {
  Environment,
  FeatureGroup,
  GlobalAuthProfile,
  Microservice,
  SharedDataSource,
} from '../types';
import {
  readKey,
  writeKey,
  removeKey,
  saveEnvironments,
  saveMicroservices,
  saveFeatureGroups,
  saveGlobalAuthProfiles,
  saveSelectedEnvId,
  saveSelectedSvcId,
  loadGlobalAuthProfiles,
  loadFeatureGroups,
  loadSharedDataSources,
  saveSharedDataSources,
  PROJECTS_KEY,
  SELECTED_PROJECT_KEY,
  LEGACY_FEATURES_KEY,
  LEGACY_ENVS_KEY,
  LEGACY_SERVICES_KEY,
  LEGACY_GLOBAL_AUTH_KEY,
  FLAT_MIGRATED_KEY,
} from './storage';
import type { AppData } from './storage';

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

/**
 * Migrate per-FeatureGroup sharedDataSources to top-level.
 * This is a one-time migration that:
 * 1. Collects all sharedDataSources from each FeatureGroup
 * 2. Merges them into the top-level sharedDataSources array (deduping by ID)
 * 3. Removes the sharedDataSources field from each FeatureGroup
 * 4. Saves both
 *
 * Idempotent: safe to run multiple times.
 */
export async function migratePerFgSharedDataSourcesToTopLevel(): Promise<{ migrated: number; removed: number }> {
  const featureGroups = await loadFeatureGroups();
  const topLevelSharedDs = await loadSharedDataSources();

  const existingIds = new Set(topLevelSharedDs.map(ds => ds.id));
  const toMigrate: SharedDataSource[] = [];
  let removedCount = 0;

  // Collect sharedDataSources from each FG
  for (const fg of featureGroups) {
    const fgShared = (fg as { sharedDataSources?: SharedDataSource[] }).sharedDataSources;
    if (fgShared && fgShared.length > 0) {
      for (const ds of fgShared) {
        if (!existingIds.has(ds.id)) {
          toMigrate.push(ds);
          existingIds.add(ds.id);
        }
      }
      removedCount += fgShared.length;
    }
  }

  if (toMigrate.length === 0 && removedCount === 0) {
    return { migrated: 0, removed: 0 };
  }

  // Merge into top-level
  const mergedTopLevel = [...topLevelSharedDs, ...toMigrate];

  // Remove sharedDataSources from each FG
  const cleanedFgs = featureGroups.map(fg => {
    const copy = { ...fg };
    delete (copy as { sharedDataSources?: SharedDataSource[] }).sharedDataSources;
    return copy;
  });

  // Save both
  await Promise.all([
    saveSharedDataSources(mergedTopLevel),
    saveFeatureGroups(cleanedFgs),
  ]);

  return { migrated: toMigrate.length, removed: removedCount };
}
