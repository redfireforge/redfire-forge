/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  clearGraphqlSchemaMemoryCacheForTests,
  loadCachedSchemaEntry,
  loadCachedSchemaEntrySync,
  saveCachedSchemaEntry,
  schemaCacheKey,
  warmGraphqlSchemaMemoryCache,
} from './graphqlSchemaCache';

vi.mock('../../../shared/utils/platform', () => ({ isTauri: () => false }));

const validEntry = {
  schemaInfo: {
    types: [{ name: 'Query' }],
    sdl: 'type Query { hello: String }',
  },
  sdlHash: 42,
};

describe('graphqlSchemaCache — async IDB paths', () => {
  beforeEach(() => {
    clearGraphqlSchemaMemoryCacheForTests();
    localStorage.clear();
    indexedDB.deleteDatabase('redfireforge');
  });

  afterEach(() => {
    clearGraphqlSchemaMemoryCacheForTests();
  });

  it('loadCachedSchemaEntry returns null for empty endpoint', async () => {
    expect(await loadCachedSchemaEntry('')).toBeNull();
  });

  it('saveCachedSchemaEntry and loadCachedSchemaEntry round-trip via IDB', async () => {
    const endpoint = 'http://localhost:4010/graphql';
    await saveCachedSchemaEntry(endpoint, validEntry);
    expect(localStorage.getItem(schemaCacheKey(endpoint))).toBeNull();
    const loaded = await loadCachedSchemaEntry(endpoint);
    expect(loaded?.schemaInfo.sdl).toBe(validEntry.schemaInfo.sdl);
  });

  it('loadCachedSchemaEntry migrates legacy localStorage entry to IDB', async () => {
    const endpoint = 'http://localhost:4999/graphql';
    localStorage.setItem(schemaCacheKey(endpoint), JSON.stringify(validEntry));
    const loaded = await loadCachedSchemaEntry(endpoint);
    expect(loaded?.sdlHash).toBe(42);
  });

  it('loadCachedSchemaEntrySync reads from localStorage after memory cleared', async () => {
    const endpoint = 'http://localhost:4997/graphql';
    localStorage.setItem(schemaCacheKey(endpoint), JSON.stringify(validEntry));
    clearGraphqlSchemaMemoryCacheForTests();
    expect(loadCachedSchemaEntrySync(endpoint)?.sdlHash).toBe(42);
  });

  it('loadCachedSchemaEntrySync returns null for empty endpoint', () => {
    expect(loadCachedSchemaEntrySync('')).toBeNull();
  });

  it('loadCachedSchemaEntrySync returns null for invalid stored JSON shape', () => {
    const endpoint = 'http://localhost:4995/graphql';
    localStorage.setItem(schemaCacheKey(endpoint), JSON.stringify({ bad: true }));
    clearGraphqlSchemaMemoryCacheForTests();
    expect(loadCachedSchemaEntrySync(endpoint)).toBeNull();
  });

  it('saveCachedSchemaEntry no-ops for empty endpoint', async () => {
    await expect(saveCachedSchemaEntry('', validEntry)).resolves.toBeUndefined();
  });

  it('loadCachedSchemaEntry returns null for invalid JSON', async () => {
    const endpoint = 'http://localhost:4998/graphql';
    localStorage.setItem(schemaCacheKey(endpoint), '{bad');
    expect(await loadCachedSchemaEntry(endpoint)).toBeNull();
  });

  it('warmGraphqlSchemaMemoryCache preloads memory from IDB', async () => {
    const endpoint = 'http://localhost:4996/graphql';
    await saveCachedSchemaEntry(endpoint, validEntry);
    clearGraphqlSchemaMemoryCacheForTests();
    await warmGraphqlSchemaMemoryCache(endpoint);
    expect(loadCachedSchemaEntrySync(endpoint)?.sdlHash).toBe(42);
  });
});

describe('graphqlSchemaCache — Tauri path', () => {
  beforeEach(() => {
    vi.resetModules();
    clearGraphqlSchemaMemoryCacheForTests();
  });

  it('loadCachedSchemaEntry uses readKey on Tauri', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({ isTauri: () => true }));
    vi.doMock('../../../shared/utils/storage', () => ({
      readKey: vi.fn(async () => JSON.stringify(validEntry)),
      writeKey: vi.fn(async () => {}),
    }));
    const mod = await import('./graphqlSchemaCache');
    const loaded = await mod.loadCachedSchemaEntry('http://x/graphql');
    expect(loaded?.sdlHash).toBe(42);
    vi.doUnmock('../../../shared/utils/platform');
    vi.doUnmock('../../../shared/utils/storage');
    vi.resetModules();
  });

  it('loadCachedSchemaEntry returns null on Tauri when readKey is empty', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({ isTauri: () => true }));
    vi.doMock('../../../shared/utils/storage', () => ({
      readKey: vi.fn(async () => null),
      writeKey: vi.fn(async () => {}),
    }));
    const mod = await import('./graphqlSchemaCache');
    expect(await mod.loadCachedSchemaEntry('http://x/graphql')).toBeNull();
    vi.doUnmock('../../../shared/utils/platform');
    vi.doUnmock('../../../shared/utils/storage');
    vi.resetModules();
  });

  it('loadCachedSchemaEntry returns null on Tauri for invalid cached shape', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({ isTauri: () => true }));
    vi.doMock('../../../shared/utils/storage', () => ({
      readKey: vi.fn(async () => JSON.stringify({ notSchema: true })),
      writeKey: vi.fn(async () => {}),
    }));
    const mod = await import('./graphqlSchemaCache');
    expect(await mod.loadCachedSchemaEntry('http://x/graphql')).toBeNull();
    vi.doUnmock('../../../shared/utils/platform');
    vi.doUnmock('../../../shared/utils/storage');
    vi.resetModules();
  });
});
