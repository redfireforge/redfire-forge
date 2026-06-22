/**
 * Shared GraphQL schema localStorage cache helpers.
 * Keys must stay in sync with useGraphqlSchema.
 */
import type { GraphqlSchemaInfo } from '../../../shared/types/graphql';
import { normalizeGraphqlEndpoint } from './graphqlEndpointUtils';

const SCHEMA_CACHE_PREFIX = 'gql_schema_v1_';

/** DJB2 hash of the endpoint URL — keeps localStorage keys short */
function hashEndpoint(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h) ^ url.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function cacheKey(endpoint: string): string {
  return `${SCHEMA_CACHE_PREFIX}${hashEndpoint(endpoint)}`;
}

interface CachedSchema {
  schemaInfo: GraphqlSchemaInfo;
  sdlHash: number;
  rawIntrospection?: Record<string, unknown>;
}

function loadCachedSchemaEntry(endpoint: string): CachedSchema | null {
  if (!endpoint) return null;
  try {
    const raw = localStorage.getItem(cacheKey(endpoint));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSchema;
    if (
      !parsed.schemaInfo ||
      typeof parsed.sdlHash !== 'number' ||
      !Array.isArray(parsed.schemaInfo.types)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Load SDL from the persisted introspection cache for an endpoint URL. */
export function loadCachedGraphqlSchemaSdl(endpoint: string): string | null {
  const candidates = [endpoint, normalizeGraphqlEndpoint(endpoint)].filter(Boolean);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const sdl = loadCachedSchemaEntry(candidate)?.schemaInfo?.sdl;
    if (typeof sdl === 'string' && sdl.trim()) return sdl;
  }
  return null;
}
