import { describe, it, expect } from 'vitest';
import {
  createCrossFgPokemonFeatureGroup1,
  createCrossFgPokemonFeatureGroup2,
  createSharedAuthUsersDataSource,
  createSharedAuthUsersFeatureGroup,
  createSharedPokemonRosterDataSource,
  createSharedProductCatalogDataSource,
  createSharedProductCatalogFeatureGroup,
  createSharedUserIdsDataSource,
  createSharedUserIdsFeatureGroup,
} from './sharedDataSourcePresets';

describe('shared data source presets', () => {
  it('marks one sampled row disabled while keeping identifiers', () => {
    const ds = createSharedUserIdsDataSource();
    expect(ds.dataSource.rows.some(r => r.enabled === false)).toBe(true);
    expect(ds.dataSource.rows.every(r => r.id.length > 0)).toBe(true);
  });

  it('creates paired feature group + shared data for user IDs', () => {
    const fg = createSharedUserIdsFeatureGroup();
    const sds = createSharedUserIdsDataSource();
    expect(fg.source).toBe('gallery');
    expect(sds.id).toBe('sds-user-ids-10');
    expect(sds.dataSource.columns.length).toBeGreaterThan(0);
    expect(sds.dataSource.rows.every(r => typeof r.enabled === 'boolean')).toBe(true);
  });

  it('product catalog presets wire fetch configs with Accept header', () => {
    const fg = createSharedProductCatalogFeatureGroup();
    const sds = createSharedProductCatalogDataSource();
    expect(fg.scenarios.length).toBe(2);
    expect(sds.fetchConfig?.headers?.length).toBeGreaterThanOrEqual(1);
  });

  it('Pokemon cross FG samples share roster id across groups', () => {
    const a = createCrossFgPokemonFeatureGroup1();
    const b = createCrossFgPokemonFeatureGroup2();
    const roster = createSharedPokemonRosterDataSource();
    const sharedId = roster.id;
    for (const fg of [a, b]) {
      const tests = fg.scenarios.flatMap(s => s.tests);
      expect(tests.every(t => (t).sharedDataSourceId === sharedId)).toBe(true);
    }
  });

  it('shared auth exposes POST rotation body and DummyJSON URLs', () => {
    const fg = createSharedAuthUsersFeatureGroup();
    const ds = createSharedAuthUsersDataSource();
    expect(fg.scenarios.flatMap(s => s.tests)[0]?.body ?? '').toContain('{{username}}');
    expect(ds.fetchConfig?.method).toBe('POST');
    expect(ds.dataSource.rows.length).toBe(5);
    expect(ds.dataSource.rows.some(r => (r.tags?.length ?? 0) > 0)).toBe(true);
    expect(ds.dataSource.rows.some(r => r.tags == null)).toBe(true);
  });
});
