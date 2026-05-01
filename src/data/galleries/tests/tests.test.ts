import { describe, it, expect } from 'vitest';
import { testSampleCatalog } from './index';

describe('testSampleCatalog', () => {
  it('has 8 entries', () => {
    expect(testSampleCatalog).toHaveLength(8);
  });

  it('every entry has a unique id', () => {
    const ids = testSampleCatalog.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has domain "tests"', () => {
    for (const entry of testSampleCatalog) {
      expect(entry.domain).toBe('tests');
    }
  });

  it('every entry has at least one liveApi', () => {
    for (const entry of testSampleCatalog) {
      expect(entry.liveApis.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has at least one tag', () => {
    for (const entry of testSampleCatalog) {
      expect(entry.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every factory returns a valid FeatureGroup', () => {
    for (const entry of testSampleCatalog) {
      const fg = entry.factory();
      expect(fg.id).toBeTruthy();
      expect(fg.name).toBeTruthy();
      expect(fg.scenarios).toBeDefined();
      expect(fg.scenarios.length).toBe(entry.scenarioCount);
    }
  });

  it('every FeatureGroup scenario has at least one test', () => {
    for (const entry of testSampleCatalog) {
      const fg = entry.factory();
      for (const ts of fg.scenarios) {
        expect(ts.tests.length).toBeGreaterThanOrEqual(1);
        for (const test of ts.tests) {
          expect(test.url).toMatch(/^https:\/\//);
          expect(test.method).toBeTruthy();
        }
      }
    }
  });

  it('covers all difficulty levels', () => {
    const diffs = new Set(testSampleCatalog.map(e => e.difficulty));
    expect(diffs).toContain('easy');
    expect(diffs).toContain('medium');
    expect(diffs).toContain('advanced');
  });

  it('scenarioCount matches actual scenario count', () => {
    for (const entry of testSampleCatalog) {
      const fg = entry.factory();
      expect(fg.scenarios.length).toBe(entry.scenarioCount);
    }
  });
});
