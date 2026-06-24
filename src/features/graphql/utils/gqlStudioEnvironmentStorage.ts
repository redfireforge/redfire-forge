/**
 * Storage helpers for GraphQL Studio named environments (gql_environments_v1).
 * Used by useGraphqlEnvironments and demo-lesson cleanup (works when Studio is unmounted).
 */
import type { GraphqlEnvironment } from '../../../shared/types/graphql';
import { readKey, writeKey } from '../../../shared/utils/storage';

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

export async function readGqlStudioEnvironments(): Promise<GraphqlEnvironment[]> {
  try {
    const raw = await readKey(GQL_ENVS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGraphqlEnvironment);
  } catch {
    return [];
  }
}

export async function writeGqlStudioEnvironments(envs: GraphqlEnvironment[]): Promise<void> {
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
