import { describe, it, expect } from 'vitest';
import { catalogSpecCatalog, CATALOG_SPEC_CATEGORIES } from './index';
import { parseOpenApiSpec, countEndpoints } from '../../../features/catalog/utils/openApiParser';

describe('catalogSpecCatalog', () => {
  it('has 8 entries (2 migrated + 6 new)', () => {
    expect(catalogSpecCatalog).toHaveLength(8);
  });

  it('every entry has a unique id', () => {
    const ids = catalogSpecCatalog.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has domain "catalog"', () => {
    for (const entry of catalogSpecCatalog) {
      expect(entry.domain).toBe('catalog');
    }
  });

  it('every entry has at least one liveApi', () => {
    for (const entry of catalogSpecCatalog) {
      expect(entry.liveApis.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has at least one tag', () => {
    for (const entry of catalogSpecCatalog) {
      expect(entry.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every factory returns a non-empty YAML string', () => {
    for (const entry of catalogSpecCatalog) {
      const yaml = entry.factory();
      expect(typeof yaml).toBe('string');
      expect(yaml.length).toBeGreaterThan(100);
      expect(yaml).toContain('openapi:');
      expect(yaml).toContain('paths:');
    }
  });

  it('specYaml matches factory() output', () => {
    for (const entry of catalogSpecCatalog) {
      expect(entry.specYaml).toBe(entry.factory());
    }
  });

  it('endpointCount is positive for all entries', () => {
    for (const entry of catalogSpecCatalog) {
      expect(entry.endpointCount).toBeGreaterThan(0);
    }
  });

  it('covers all difficulty levels', () => {
    const diffs = new Set(catalogSpecCatalog.map(e => e.difficulty));
    expect(diffs).toContain('easy');
    expect(diffs).toContain('medium');
    expect(diffs).toContain('advanced');
  });

  it('includes the 2 migrated entries', () => {
    const ids = catalogSpecCatalog.map(e => e.id);
    expect(ids).toContain('sample-catalog-correlation-wait');
    expect(ids).toContain('sample-catalog-pet-store');
  });

  it('includes all 6 new entries', () => {
    const ids = catalogSpecCatalog.map(e => e.id);
    expect(ids).toContain('catalog-jsonplaceholder');
    expect(ids).toContain('catalog-fakestore');
    expect(ids).toContain('catalog-pokeapi');
    expect(ids).toContain('catalog-dummyjson');
    expect(ids).toContain('catalog-rest-countries');
    expect(ids).toContain('catalog-httpbin');
  });

  it('CATALOG_SPEC_CATEGORIES includes all and each category', () => {
    expect(CATALOG_SPEC_CATEGORIES[0].key).toBe('all');
    const keys = CATALOG_SPEC_CATEGORIES.map(c => c.key);
    expect(keys).toContain('webhooks');
    expect(keys).toContain('rest-api');
    expect(keys).toContain('microservices');
    expect(keys).toContain('public-api');
  });

  it('every specYaml parses as valid OpenAPI', async () => {
    for (const entry of catalogSpecCatalog) {
      const result = await parseOpenApiSpec(entry.specYaml);
      expect(result.entry.name).toBeTruthy();
      expect(result.entry.versions).toHaveLength(1);
    }
  });

  it('parsed endpoint count matches declared endpointCount', async () => {
    for (const entry of catalogSpecCatalog) {
      const result = await parseOpenApiSpec(entry.specYaml);
      const actual = countEndpoints(result.entry);
      expect(actual).toBe(entry.endpointCount);
    }
  });
});
