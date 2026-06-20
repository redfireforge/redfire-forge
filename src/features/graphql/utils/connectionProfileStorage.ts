/**
 * Shared read/write helpers for GraphQL connection profiles (gql_profiles_v1).
 */
import type { GraphqlAuth } from '../../../shared/types/graphql';
import { readKey } from '../../../shared/utils/storage';

export const GQL_PROFILES_STORAGE_KEY = 'gql_profiles_v1';

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
