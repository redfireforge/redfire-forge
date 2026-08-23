import { describe, it, expect } from 'vitest';
import { testSampleCatalog } from './index';

describe('testSampleCatalog', () => {
  it('has 29 entries', () => {
    expect(testSampleCatalog).toHaveLength(29);
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
          // Allow wss:// for WebSocket scenarios in addition to https://
          expect(test.url).toMatch(/^(https|wss):\/\//);
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

  it('parameterized entries have dataRowCount matching actual rows', () => {
    const paramEntries = testSampleCatalog.filter(e => e.dataRowCount);
    expect(paramEntries.length).toBe(11);
    
    // Split into inline data source samples vs shared data source samples
    const inlineEntries = paramEntries.filter(e => !e.sharedDataSourceFactory);
    const sharedDsEntries = paramEntries.filter(e => e.sharedDataSourceFactory);
    
    expect(inlineEntries.length).toBe(7);
    expect(sharedDsEntries.length).toBe(4);
    
    // Check inline data source samples
    for (const entry of inlineEntries) {
      const fg = entry.factory();
      let totalRows = 0;
      for (const sc of fg.scenarios) {
        for (const test of sc.tests) {
          totalRows += test.dataSource?.rows.length ?? 0;
        }
      }
      expect(totalRows).toBe(entry.dataRowCount);
    }
    
    // Check shared data source samples
    for (const entry of sharedDsEntries) {
      const sharedDsList = entry.sharedDataSourceFactory!();
      let totalRows = 0;
      for (const sharedDs of sharedDsList) {
        totalRows += sharedDs.dataSource.rows.length;
      }
      expect(totalRows).toBe(entry.dataRowCount);
    }
  });

  it('parameterized entries have valid data source columns', () => {
    const paramEntries = testSampleCatalog.filter(e => e.dataRowCount);
    for (const entry of paramEntries) {
      const fg = entry.factory();
      for (const sc of fg.scenarios) {
        for (const test of sc.tests) {
          if (!test.dataSource) continue;
          expect(test.dataSource.columns.length).toBeGreaterThanOrEqual(1);
          for (const col of test.dataSource.columns) {
            expect(col.id).toBeTruthy();
            expect(col.name).toBeTruthy();
            expect(['path', 'param', 'body', 'header', 'validate']).toContain(col.type);
          }
          for (const row of test.dataSource.rows) {
            expect(row.id).toBeTruthy();
            expect(typeof row.enabled === 'boolean').toBe(true);
          }
        }
      }
    }
  });

  it('runs additionalFeatureGroupsFactory for cross-feature-group Pokémon catalog entry', () => {
    const entry = testSampleCatalog.find(e => e.id === 'test-shared-pokemon-cross-fg');
    expect(entry?.additionalFeatureGroupsFactory).toBeDefined();
    const extraGroups = entry!.additionalFeatureGroupsFactory!();
    expect(extraGroups.length).toBeGreaterThanOrEqual(1);
    expect(extraGroups[0].id).toBeTruthy();
  });
});
