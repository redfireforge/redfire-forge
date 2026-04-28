import { describe, it, expect } from 'vitest';
import { sampleCatalogSpecs, SAMPLE_CATALOG_CATEGORIES, type SampleCatalogCategory } from './sampleCatalogSpecs';
import { parseOpenApiSpec } from '../features/catalog/utils/openApiParser';

describe('sampleCatalogSpecs', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(sampleCatalogSpecs)).toBe(true);
    expect(sampleCatalogSpecs.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const entry of sampleCatalogSpecs) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.icon).toBeTruthy();
      expect(typeof entry.endpointCount).toBe('number');
      expect(entry.specYaml).toBeTruthy();
    }
  });

  it('has unique ids', () => {
    const ids = sampleCatalogSpecs.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every category is valid', () => {
    const validCategories: SampleCatalogCategory[] = ['webhooks', 'rest-api', 'microservices'];
    for (const entry of sampleCatalogSpecs) {
      expect(validCategories).toContain(entry.category);
    }
  });

  it('SAMPLE_CATALOG_CATEGORIES includes all and each category', () => {
    expect(SAMPLE_CATALOG_CATEGORIES[0].key).toBe('all');
    const keys = SAMPLE_CATALOG_CATEGORIES.map(c => c.key);
    expect(keys).toContain('webhooks');
    expect(keys).toContain('rest-api');
    expect(keys).toContain('microservices');
  });

  it('every specYaml parses successfully as a valid OpenAPI spec', async () => {
    for (const entry of sampleCatalogSpecs) {
      const result = await parseOpenApiSpec(entry.specYaml);
      expect(result.entry.name).toBeTruthy();
      expect(result.entry.versions).toHaveLength(1);
      expect(result.warnings).toBeDefined();
    }
  });

  it('parsed endpoint count matches declared endpointCount', async () => {
    for (const entry of sampleCatalogSpecs) {
      const result = await parseOpenApiSpec(entry.specYaml);
      const { countEndpoints } = await import('../features/catalog/utils/openApiParser');
      const actual = countEndpoints(result.entry);
      expect(actual).toBe(entry.endpointCount);
    }
  });
});
