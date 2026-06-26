/**
 * Shared GraphQL schema cache (IndexedDB on web, storage abstraction on Tauri).
 * Keys must stay in sync with useGraphqlSchema.
 */
import type { GraphqlSchemaInfo } from '../../../shared/types/graphql';
import {
  GQL_SCHEMA_CACHE_PREFIX,
  idbGetSchemaCacheRaw,
  idbSetSchemaCacheRaw,
} from '../../../shared/utils/idbGraphqlStudio';
import { readKey, writeKey } from '../../../shared/utils/storage';
import { isTauri } from '../../../shared/utils/platform';
import { normalizeGraphqlEndpoint } from './graphqlEndpointUtils';

/** DJB2 hash of the endpoint URL — keeps cache keys short */
function hashEndpoint(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h) ^ url.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export function schemaCacheKey(endpoint: string): string {
  return `${GQL_SCHEMA_CACHE_PREFIX}${hashEndpoint(endpoint)}`;
}

export interface CachedSchemaEntry {
  schemaInfo: GraphqlSchemaInfo;
  sdlHash: number;
  rawIntrospection?: Record<string, unknown>;
}

/** In-memory mirror so sync SDL readers work after an async IDB load. */
const memorySchemaCache = new Map<string, CachedSchemaEntry>();

function parseCachedSchema(raw: string): CachedSchemaEntry | null {
  try {
    const parsed = JSON.parse(raw) as CachedSchemaEntry;
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

function rememberInMemory(key: string, entry: CachedSchemaEntry): void {
  memorySchemaCache.set(key, entry);
}

export async function loadCachedSchemaEntry(endpoint: string): Promise<CachedSchemaEntry | null> {
  if (!endpoint) return null;
  const key = schemaCacheKey(endpoint);
  const mem = memorySchemaCache.get(key);
  if (mem) return mem;

  try {
    if (!isTauri()) {
      let raw = await idbGetSchemaCacheRaw(key);
      if (!raw && typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(key);
        if (raw) {
          try {
            await idbSetSchemaCacheRaw(key, raw);
            localStorage.removeItem(key);
          } catch { /* ignore migrate failure */ }
        }
      }
      if (!raw) return null;
      const parsed = parseCachedSchema(raw);
      if (parsed) rememberInMemory(key, parsed);
      return parsed;
    }

    const raw = await readKey(key);
    if (!raw) return null;
    const parsed = parseCachedSchema(raw);
    if (parsed) rememberInMemory(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Sync read — memory + legacy localStorage only (no IDB). */
export function loadCachedSchemaEntrySync(endpoint: string): CachedSchemaEntry | null {
  if (!endpoint) return null;
  const key = schemaCacheKey(endpoint);
  const mem = memorySchemaCache.get(key);
  if (mem) return mem;
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = parseCachedSchema(raw);
    if (parsed) rememberInMemory(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedSchemaEntry(
  endpoint: string,
  entry: CachedSchemaEntry,
): Promise<void> {
  if (!endpoint) return;
  const key = schemaCacheKey(endpoint);
  rememberInMemory(key, entry);
  const raw = JSON.stringify(entry);
  try {
    if (!isTauri()) {
      await idbSetSchemaCacheRaw(key, raw);
      try {
        localStorage.removeItem(key);
      } catch { /* ignore */ }
      return;
    }
    await writeKey(key, raw);
  } catch {
    // Quota exceeded — silently skip persistence
  }
}

/** Load SDL from the persisted introspection cache for an endpoint URL. */
export function loadCachedGraphqlSchemaSdl(endpoint: string): string | null {
  const candidates = [endpoint, normalizeGraphqlEndpoint(endpoint)].filter(Boolean);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const sdl = loadCachedSchemaEntrySync(candidate)?.schemaInfo?.sdl;
    if (typeof sdl === 'string' && sdl.trim()) return sdl;
  }
  return null;
}

/** Pre-warm memory cache from IDB (call after migration or before sync SDL reads). */
export async function warmGraphqlSchemaMemoryCache(endpoint: string): Promise<void> {
  await loadCachedSchemaEntry(endpoint);
}

/** Clears in-memory cache — for unit tests only. */
export function clearGraphqlSchemaMemoryCacheForTests(): void {
  memorySchemaCache.clear();
}
