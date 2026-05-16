import { describe, it, expect } from 'vitest';
import {
  TRANSFORMATION_LIBRARY,
  findTemplatesForConversion,
  getTemplatesByCategory,
  searchTemplates,
} from './transformationLibrary';
import type { TransformCategory } from './transformationLibrary';

describe('TRANSFORMATION_LIBRARY', () => {
  it('has no duplicate IDs', () => {
    const ids = TRANSFORMATION_LIBRARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has all required fields', () => {
    for (const t of TRANSFORMATION_LIBRARY) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.template).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.fromType).toBeTruthy();
      expect(t.toType).toBeTruthy();
      expect(typeof t.priority).toBe('number');
    }
  });

  it('templates contain $.PATH placeholder', () => {
    for (const t of TRANSFORMATION_LIBRARY) {
      expect(t.template).toContain('$.PATH');
    }
  });
});

describe('findTemplatesForConversion', () => {
  it('finds string→number templates', () => {
    const results = findTemplatesForConversion('string', 'number');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => (r.fromType === 'string' || r.fromType === '*') && r.toType === 'number')).toBe(true);
  });

  it('finds array→string templates', () => {
    const results = findTemplatesForConversion('array', 'string');
    expect(results.length).toBeGreaterThan(0);
  });

  it('includes wildcard fromType matches', () => {
    const results = findTemplatesForConversion('number', 'string');
    const wildcardCount = results.filter((r) => r.fromType === '*').length;
    expect(wildcardCount).toBeGreaterThanOrEqual(1);
    const anyNumResults = findTemplatesForConversion('array', 'number');
    expect(anyNumResults.some((r) => r.fromType === '*' || r.fromType === 'array')).toBe(true);
  });

  it('returns empty for unsupported conversion', () => {
    const results = findTemplatesForConversion('boolean', 'array');
    expect(results).toEqual([]);
  });

  it('includes null-handling templates via wildcard', () => {
    const results = findTemplatesForConversion('string', 'string');
    const nullHandling = results.filter((r) => r.fromType === '*');
    expect(nullHandling.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getTemplatesByCategory', () => {
  it('groups all templates by category', () => {
    const grouped = getTemplatesByCategory();
    let totalCount = 0;
    for (const [, templates] of grouped) {
      totalCount += templates.length;
    }
    expect(totalCount).toBe(TRANSFORMATION_LIBRARY.length);
  });

  it('includes expected categories', () => {
    const grouped = getTemplatesByCategory();
    const categories: TransformCategory[] = ['conversion', 'date', 'string', 'array', 'null-handling', 'math'];
    for (const cat of categories) {
      expect(grouped.has(cat)).toBe(true);
    }
  });
});

describe('searchTemplates', () => {
  it('finds templates by label', () => {
    const results = searchTemplates('trim');
    expect(results.some((r) => r.id === 'str-trim')).toBe(true);
  });

  it('finds templates by description', () => {
    const results = searchTemplates('separator');
    expect(results.length).toBeGreaterThan(0);
  });

  it('case-insensitive search', () => {
    const results = searchTemplates('LOWERCASE');
    expect(results.some((r) => r.id === 'str-lower')).toBe(true);
  });

  it('returns empty for no match', () => {
    const results = searchTemplates('zzz_nonexistent_zzz');
    expect(results).toEqual([]);
  });
});
