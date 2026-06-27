/**
 * Clears stale "batch unsupported" detection flags for the GraphQL demo server (4010).
 * Used by Demo Hub setup so GQL-15 always attempts true JSON-array batching.
 */
import { readKey, writeKey } from '../../../shared/utils/storage';
import { normalizeGraphqlEndpoint } from './graphqlEndpointUtils';

const DEMO_BATCH_ENDPOINTS = [
  'http://localhost:4010/graphql',
  'http://127.0.0.1:4010/graphql',
];

/** All normalized connection ids that may hold demo batch detection state. */
export function demoBatchDetectionConnectionIds(): string[] {
  return [...new Set(DEMO_BATCH_ENDPOINTS.map((url) => normalizeGraphqlEndpoint(url)).filter(Boolean))];
}

/** Reset persisted `batch: true` flags for demo endpoints. Returns count of keys updated. */
export async function purgeGqlDemoBatchDetectionFlags(): Promise<number> {
  let cleared = 0;
  for (const id of demoBatchDetectionConnectionIds()) {
    const key = `gql_conn_detection_${id}`;
    const raw = await readKey(key);
    if (!raw) continue;
    try {
      const existing = JSON.parse(raw) as { apq?: boolean; batch?: boolean };
      if (existing.batch !== true) continue;
      await writeKey(key, JSON.stringify({ ...existing, batch: false }));
      cleared += 1;
    } catch {
      await writeKey(key, JSON.stringify({ batch: false }));
      cleared += 1;
    }
  }
  return cleared;
}
