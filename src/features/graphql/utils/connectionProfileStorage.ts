/**
 * Shared read/write helpers for GraphQL connection profiles (gql_profiles_v1).
 */
import type { GraphqlAuth } from '../../../shared/types/graphql';
import {
  idbLoadConnectionProfiles,
  idbMigrateConnectionProfilesFromLocalStorage,
  idbSaveConnectionProfiles,
} from '../../../shared/utils/idbGraphqlStudio';
import { readKey, writeKey } from '../../../shared/utils/storage';
import { isTauri } from '../../../shared/utils/platform';

export const GQL_PROFILES_STORAGE_KEY = 'gql_profiles_v1';

/** Fired after storage mutation so hooks reload the profile catalog. */
export const GQL_PROFILES_RELOAD_EVENT = 'gql-profiles-reload';

export function dispatchGqlProfilesReload(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GQL_PROFILES_RELOAD_EVENT));
  }
}

export interface ConnectionProfile {
  id: string;
  name: string;
  endpoint: string;
  auth: GraphqlAuth | null;
  createdAt: number;
}

export function parseConnectionProfiles(raw: string | null | undefined): ConnectionProfile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ConnectionProfile =>
        p !== null &&
        typeof p === 'object' &&
        typeof (p as Record<string, unknown>).id === 'string' &&
        typeof (p as Record<string, unknown>).name === 'string' &&
        typeof (p as Record<string, unknown>).endpoint === 'string',
    );
  } catch {
    return [];
  }
}

async function loadProfilesFromIdb(): Promise<ConnectionProfile[] | null> {
  try {
    let data = await idbLoadConnectionProfiles();
    if (!data) {
      const migrated = await idbMigrateConnectionProfilesFromLocalStorage(GQL_PROFILES_STORAGE_KEY);
      if (!migrated) return null;
      data = await idbLoadConnectionProfiles();
    }
    if (!data) return null;
    try {
      localStorage.removeItem(GQL_PROFILES_STORAGE_KEY);
    } catch { /* ignore */ }
    return parseConnectionProfiles(JSON.stringify(data));
  } catch {
    return null;
  }
}

export async function readConnectionProfiles(): Promise<ConnectionProfile[]> {
  if (!isTauri()) {
    const fromIdb = await loadProfilesFromIdb();
    if (fromIdb !== null) return fromIdb;
  }
  try {
    const raw = await readKey(GQL_PROFILES_STORAGE_KEY);
    return parseConnectionProfiles(raw);
  } catch {
    return [];
  }
}

export async function writeConnectionProfiles(profiles: ConnectionProfile[]): Promise<void> {
  if (!isTauri()) {
    try {
      await idbSaveConnectionProfiles(profiles);
      try {
        localStorage.removeItem(GQL_PROFILES_STORAGE_KEY);
      } catch { /* ignore */ }
      dispatchGqlProfilesReload();
      return;
    } catch (err) {
      console.error('[Storage] GraphQL profiles IDB save failed', err);
    }
  }
  await writeKey(GQL_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  dispatchGqlProfilesReload();
}

/**
 * Remove every saved profile whose trimmed name matches one of `names`.
 * @returns Count of profiles removed.
 */
export async function removeConnectionProfilesByNames(names: readonly string[]): Promise<number> {
  const nameSet = new Set(names.map((n) => n.trim()).filter(Boolean));
  if (nameSet.size === 0) return 0;

  const existing = await readConnectionProfiles();
  const next = existing.filter((p) => !nameSet.has(p.name.trim()));
  const removed = existing.length - next.length;
  if (removed === 0) return 0;

  await writeConnectionProfiles(next);
  return removed;
}
