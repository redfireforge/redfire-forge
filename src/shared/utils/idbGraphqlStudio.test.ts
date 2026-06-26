/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  GQL_SCHEMA_CACHE_PREFIX,
  idbGetSchemaCacheRaw,
  idbMigrateSchemaCacheFromLocalStorage,
  idbMigrateTabsFromLocalStorage,
  idbSaveTabsPersisted,
  idbLoadTabsPersisted,
  migrateGraphqlStudioFromLocalStorage,
} from './idbGraphqlStudio';

vi.mock('./platform', () => ({ isTauri: () => false }));

describe('idbGraphqlStudio', () => {
  beforeEach(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('redfireforge');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('migrates tabs from localStorage to IDB', async () => {
    localStorage.setItem('gql_tabs_v1', JSON.stringify([{ id: 'gql-tab-1', label: 'A' }]));
    localStorage.setItem('gql_tabs_v1_active', 'gql-tab-1');

    const migrated = await idbMigrateTabsFromLocalStorage('gql_tabs_v1', 'gql_tabs_v1_active');
    expect(migrated).toBe(true);
    expect(localStorage.getItem('gql_tabs_v1')).toBeNull();

    const blob = await idbLoadTabsPersisted();
    expect(blob?.activeId).toBe('gql-tab-1');
    expect(blob?.tabs).toHaveLength(1);
  });

  it('migrates schema cache entries from localStorage to IDB', async () => {
    const key = `${GQL_SCHEMA_CACHE_PREFIX}abc123`;
    localStorage.setItem(key, JSON.stringify({ schemaInfo: { types: [] }, sdlHash: 1 }));

    const moved = await idbMigrateSchemaCacheFromLocalStorage();
    expect(moved).toBe(1);
    expect(localStorage.getItem(key)).toBeNull();
    expect(await idbGetSchemaCacheRaw(key)).toContain('sdlHash');
  });

  it('migrateGraphqlStudioFromLocalStorage runs all migrations', async () => {
    localStorage.setItem('gql_profiles_v1', JSON.stringify([{ id: 'p1', name: 'Demo', endpoint: 'http://x', createdAt: 1 }]));
    const result = await migrateGraphqlStudioFromLocalStorage({
      tabsKey: 'gql_tabs_v1',
      tabsActiveKey: 'gql_tabs_v1_active',
      authKey: 'gql_auth_v1',
      environmentsKey: 'gql_environments_v1',
      profilesKey: 'gql_profiles_v1',
    });
    expect(result.profiles).toBe(true);
    expect(localStorage.getItem('gql_profiles_v1')).toBeNull();
  });

  it('saves and loads tabs blob', async () => {
    await idbSaveTabsPersisted([{ id: 't1' }], 't1');
    const blob = await idbLoadTabsPersisted();
    expect(blob?.activeId).toBe('t1');
  });
});
