/**
 * Shared read/write helpers for GraphQL connection profiles (gql_profiles_v1).
 */
import type { GraphqlAuth } from '../../../shared/types/graphql';
import { readKey, writeKey } from '../../../shared/utils/storage';

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

export async function readConnectionProfiles(): Promise<ConnectionProfile[]> {
  try {
    const raw = await readKey(GQL_PROFILES_STORAGE_KEY);
    return parseConnectionProfiles(raw);
  } catch {
    return [];
  }
}

export async function writeConnectionProfiles(profiles: ConnectionProfile[]): Promise<void> {
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
