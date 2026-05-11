import { describe, it, expect } from 'vitest';
import { mapperGallerySamples } from './gallerySamples';

describe('gallerySamples', () => {
  it('contains 6 samples', () => {
    expect(mapperGallerySamples).toHaveLength(6);
  });

  it('all samples have unique ids', () => {
    const ids = mapperGallerySamples.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all samples have required fields', () => {
    for (const sample of mapperGallerySamples) {
      expect(sample.id).toBeTruthy();
      expect(sample.name).toBeTruthy();
      expect(sample.description).toBeTruthy();
      expect(sample.difficulty).toMatch(/^(easy|medium|advanced)$/);
      expect(sample.tags.length).toBeGreaterThan(0);
      expect(sample.sources.length).toBeGreaterThanOrEqual(1);
      expect(sample.target).toBeTruthy();
      expect(sample.mappings.length).toBeGreaterThan(0);
    }
  });

  it('all mappings reference valid source ids', () => {
    for (const sample of mapperGallerySamples) {
      const sourceIds = new Set(sample.sources.map((s) => s.id));
      for (const mapping of sample.mappings) {
        expect(sourceIds.has(mapping.sourceId)).toBe(true);
      }
    }
  });

  it('all mappings have unique ids within each sample', () => {
    for (const sample of mapperGallerySamples) {
      const ids = sample.mappings.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('all target fields have valid paths', () => {
    for (const sample of mapperGallerySamples) {
      if (!sample.target.fields) continue;
      for (const field of sample.target.fields) {
        expect(field.path).toBeTruthy();
        expect(field.label).toBeTruthy();
      }
    }
  });

  it('multi-source sample has two sources', () => {
    const multi = mapperGallerySamples.find((s) => s.id === 'gallery-multi-source');
    expect(multi).toBeTruthy();
    expect(multi!.sources).toHaveLength(2);
  });

  it('expression transform sample has expressions on all mappings', () => {
    const expr = mapperGallerySamples.find((s) => s.id === 'gallery-expression-transform');
    expect(expr).toBeTruthy();
    for (const m of expr!.mappings) {
      expect(m.expression).toBeTruthy();
    }
  });

  it('direct field sample has no expressions', () => {
    const direct = mapperGallerySamples.find((s) => s.id === 'gallery-direct-field');
    expect(direct).toBeTruthy();
    for (const m of direct!.mappings) {
      expect(m.expression).toBeFalsy();
    }
  });

  it('array mapping sample uses array-specific functions', () => {
    const arr = mapperGallerySamples.find((s) => s.id === 'gallery-array-mapping');
    expect(arr).toBeTruthy();
    const exprs = arr!.mappings.filter((m) => m.expression).map((m) => m.expression!);
    expect(exprs.some((e) => e.includes('$count'))).toBe(true);
    expect(exprs.some((e) => e.includes('$join'))).toBe(true);
  });

  it('type conversion sample uses type cast functions', () => {
    const tc = mapperGallerySamples.find((s) => s.id === 'gallery-type-conversion');
    expect(tc).toBeTruthy();
    const exprs = tc!.mappings.filter((m) => m.expression).map((m) => m.expression!);
    expect(exprs.some((e) => e.includes('$parseFloat'))).toBe(true);
    expect(exprs.some((e) => e.includes('$toBool'))).toBe(true);
    expect(exprs.some((e) => e.includes('$toString'))).toBe(true);
  });
});
