/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  clearGraphqlSchemaMemoryCacheForTests,
  loadCachedGraphqlSchemaSdl,
} from './graphqlSchemaCache';
import { normalizeGraphqlEndpoint } from './graphqlEndpointUtils';

const SCHEMA_CACHE_PREFIX = 'gql_schema_v1_';

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

function setCacheEntry(
  endpoint: string,
  entry: Record<string, unknown>,
) {
  localStorage.setItem(cacheKey(endpoint), JSON.stringify(entry));
}

const validSchemaInfo = {
  types: [{ name: 'Query' }],
  sdl: 'type Query { hello: String }',
};

describe('loadCachedGraphqlSchemaSdl', () => {
  beforeEach(() => {
    clearGraphqlSchemaMemoryCacheForTests();
    localStorage.clear();
  });

  afterEach(() => {
    clearGraphqlSchemaMemoryCacheForTests();
    localStorage.clear();
  });

  it('returns null for empty endpoint', () => {
    expect(loadCachedGraphqlSchemaSdl('')).toBeNull();
  });

  it('returns SDL from a valid cache entry', () => {
    const endpoint = 'http://localhost:4010/graphql';
    setCacheEntry(endpoint, { schemaInfo: validSchemaInfo, sdlHash: 42 });
    expect(loadCachedGraphqlSchemaSdl(endpoint)).toBe(validSchemaInfo.sdl);
  });

  it('returns null when cache JSON is invalid', () => {
    const endpoint = 'http://localhost:4010/graphql';
    localStorage.setItem(cacheKey(endpoint), '{not valid json');
    expect(loadCachedGraphqlSchemaSdl(endpoint)).toBeNull();
  });

  it('returns null when schemaInfo is missing', () => {
    const endpoint = 'http://localhost:4010/graphql';
    setCacheEntry(endpoint, { sdlHash: 1 });
    expect(loadCachedGraphqlSchemaSdl(endpoint)).toBeNull();
  });

  it('returns null when sdlHash is not a number', () => {
    const endpoint = 'http://localhost:4010/graphql';
    setCacheEntry(endpoint, { schemaInfo: validSchemaInfo, sdlHash: 'bad' });
    expect(loadCachedGraphqlSchemaSdl(endpoint)).toBeNull();
  });

  it('returns null when schemaInfo.types is not an array', () => {
    const endpoint = 'http://localhost:4010/graphql';
    setCacheEntry(endpoint, {
      schemaInfo: { ...validSchemaInfo, types: 'Query' },
      sdlHash: 1,
    });
    expect(loadCachedGraphqlSchemaSdl(endpoint)).toBeNull();
  });

  it('returns null when SDL is missing or whitespace-only', () => {
    const endpoint = 'http://localhost:4010/graphql';
    setCacheEntry(endpoint, {
      schemaInfo: { types: [{ name: 'Query' }], sdl: '   ' },
      sdlHash: 1,
    });
    expect(loadCachedGraphqlSchemaSdl(endpoint)).toBeNull();
  });

  it('falls back to normalized endpoint when raw endpoint has no cache', () => {
    const raw = 'http://localhost:4010/graphql';
    const normalized = normalizeGraphqlEndpoint(raw);
    expect(normalized).not.toBe(raw);
    setCacheEntry(normalized, { schemaInfo: validSchemaInfo, sdlHash: 7 });
    expect(loadCachedGraphqlSchemaSdl(raw)).toBe(validSchemaInfo.sdl);
  });

  it('prefers raw endpoint cache over normalized fallback', () => {
    const raw = 'http://localhost:4010/graphql';
    const normalized = normalizeGraphqlEndpoint(raw);
    setCacheEntry(raw, {
      schemaInfo: { types: [{ name: 'Query' }], sdl: 'type Query { raw: String }' },
      sdlHash: 1,
    });
    setCacheEntry(normalized, {
      schemaInfo: { types: [{ name: 'Query' }], sdl: 'type Query { normalized: String }' },
      sdlHash: 2,
    });
    expect(loadCachedGraphqlSchemaSdl(raw)).toBe('type Query { raw: String }');
  });

  it('deduplicates identical endpoint candidates', () => {
    const endpoint = 'http://example.com/graphql';
    const normalized = normalizeGraphqlEndpoint(endpoint);
    expect(normalized).toBe(endpoint);
    setCacheEntry(endpoint, { schemaInfo: validSchemaInfo, sdlHash: 3 });
    expect(loadCachedGraphqlSchemaSdl(endpoint)).toBe(validSchemaInfo.sdl);
  });

  it('returns null when no cache exists for any candidate', () => {
    expect(loadCachedGraphqlSchemaSdl('http://missing.example/graphql')).toBeNull();
  });
});
