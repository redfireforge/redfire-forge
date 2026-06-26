/**
 * Storage helpers for GraphQL Studio named environments (gql_environments_v1).
 * Used by useGraphqlEnvironments and demo-lesson cleanup (works when Studio is unmounted).
 */
import type { GraphqlEnvironment } from '../../../shared/types/graphql';
import {
  idbLoadStudioEnvironments,
  idbMigrateStudioEnvironmentsFromLocalStorage,
  idbSaveStudioEnvironments,
} from '../../../shared/utils/idbGraphqlStudio';
import { readKey, writeKey } from '../../../shared/utils/storage';
import { isTauri } from '../../../shared/utils/platform';

export const GQL_ENVS_STORAGE_KEY = 'gql_environments_v1';
export const GQL_ENVS_RELOAD_EVENT = 'gql-environments-reload';

function isGraphqlEnvironment(value: unknown): value is GraphqlEnvironment {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    Array.isArray((value as Record<string, unknown>).variables)
  );
}

function normalizeEnvironments(parsed: unknown): GraphqlEnvironment[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isGraphqlEnvironment);
}

async function loadEnvironmentsFromIdb(): Promise<GraphqlEnvironment[] | null> {
  try {
    let data = await idbLoadStudioEnvironments();
    if (!data) {
      const migrated = await idbMigrateStudioEnvironmentsFromLocalStorage(GQL_ENVS_STORAGE_KEY);
      if (!migrated) return null;
      data = await idbLoadStudioEnvironments();
    }
    if (!data) return null;
    try {
      localStorage.removeItem(GQL_ENVS_STORAGE_KEY);
    } catch { /* ignore */ }
    return normalizeEnvironments(data);
  } catch {
    return null;
  }
}

export async function readGqlStudioEnvironments(): Promise<GraphqlEnvironment[]> {
  if (!isTauri()) {
    const fromIdb = await loadEnvironmentsFromIdb();
    if (fromIdb !== null) return fromIdb;
  }
  try {
    const raw = await readKey(GQL_ENVS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeEnvironments(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export async function writeGqlStudioEnvironments(envs: GraphqlEnvironment[]): Promise<void> {
  if (!isTauri()) {
    try {
      await idbSaveStudioEnvironments(envs);
      try {
        localStorage.removeItem(GQL_ENVS_STORAGE_KEY);
      } catch { /* ignore */ }
      return;
    } catch (err) {
      console.error('[Storage] GraphQL environments IDB save failed', err);
    }
  }
  await writeKey(GQL_ENVS_STORAGE_KEY, JSON.stringify(envs));
}

/** Remove all studio environments with the given name. Returns true when any were removed. */
export async function purgeGqlStudioEnvironmentsByName(name: string): Promise<boolean> {
  const envs = await readGqlStudioEnvironments();
  const filtered = envs.filter((e) => e.name !== name);
  if (filtered.length === envs.length) return false;
  if (filtered.length > 0 && !filtered.some((e) => e.isActive)) {
    filtered[0] = { ...filtered[0], isActive: true };
  }
  await writeGqlStudioEnvironments(filtered);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GQL_ENVS_RELOAD_EVENT));
  }
  return true;
}
