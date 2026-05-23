/**
 * dataSourceExpander Tags Tests
 * Split from monolithic dataSourceExpander.test.ts (961 lines -> ~460 lines)
 * Tests: Tag filtering for rows and scenarios
 */
import { describe, it, expect } from 'vitest';
import {
  filterRowsByTags,
  collectAllTags,
  countRowsByTag,
  filterRowsBySubset,
  BUILT_IN_TAGS,
  expandDataSourceWithTags,
  BUILT_IN_SCENARIO_TAGS,
  normalizeTag,
  filterScenariosByTags,
  collectAllScenarioTags,
  countScenariosByTag,
} from './dataSourceExpander';
import { DataSourceRow } from '../shared/types';
import { makeScenario, makeColumns, makeDataSource, makeTestScenario, makeFeatureGroup } from './__test-utils__/dataSourceExpanderHelpers';

// ─── Row-Level Tag Tests ──────────────────────────────────────

describe('filterRowsByTags', () => {
  const rows: DataSourceRow[] = [
    { id: 'r1', values: {}, enabled: true, tags: ['smoke', 'happy-path'] },
    { id: 'r2', values: {}, enabled: true, tags: ['edge-case'] },
    { id: 'r3', values: {}, enabled: true, tags: ['smoke', 'regression'] },
    { id: 'r4', values: {}, enabled: true }, // no tags
  ];

  it('filters by any tag (single)', () => {
    const result = filterRowsByTags(rows, ['smoke'], 'any');
    expect(result.map(r => r.id)).toEqual(['r1', 'r3']);
  });

  it('filters by any tag (multiple)', () => {
    const result = filterRowsByTags(rows, ['edge-case', 'regression'], 'any');
    expect(result.map(r => r.id)).toEqual(['r2', 'r3']);
  });

  it('filters by all tags', () => {
    const result = filterRowsByTags(rows, ['smoke', 'happy-path'], 'all');
    expect(result.map(r => r.id)).toEqual(['r1']);
  });

  it('returns empty when no rows match', () => {
    const result = filterRowsByTags(rows, ['nonexistent'], 'any');
    expect(result).toEqual([]);
  });

  it('returns empty for all mode with impossible combo', () => {
    const result = filterRowsByTags(rows, ['smoke', 'edge-case'], 'all');
    expect(result).toEqual([]);
  });

  it('returns all rows when tags array is empty', () => {
    const result = filterRowsByTags(rows, [], 'any');
    expect(result).toEqual(rows);
  });
});

describe('collectAllTags', () => {
  it('returns unique sorted tags', () => {
    const rows: DataSourceRow[] = [
      { id: 'r1', values: {}, enabled: true, tags: ['smoke', 'happy-path'] },
      { id: 'r2', values: {}, enabled: true, tags: ['smoke', 'edge-case'] },
      { id: 'r3', values: {}, enabled: true },
    ];
    expect(collectAllTags(rows)).toEqual(['edge-case', 'happy-path', 'smoke']);
  });

  it('returns empty for no tags', () => {
    expect(collectAllTags([{ id: 'r1', values: {}, enabled: true }])).toEqual([]);
  });
});

describe('countRowsByTag', () => {
  it('counts rows per tag', () => {
    const rows: DataSourceRow[] = [
      { id: 'r1', values: {}, enabled: true, tags: ['smoke', 'happy-path'] },
      { id: 'r2', values: {}, enabled: true, tags: ['smoke'] },
      { id: 'r3', values: {}, enabled: true, tags: ['edge-case'] },
    ];
    const counts = countRowsByTag(rows);
    expect(counts).toEqual({ smoke: 2, 'happy-path': 1, 'edge-case': 1 });
  });

  it('treats missing tags as no tags for that row', () => {
    const rows: DataSourceRow[] = [
      { id: 'r1', values: {}, enabled: true, tags: ['a'] },
      { id: 'r2', values: {}, enabled: true },
      { id: 'r3', values: {}, enabled: true, tags: [] },
    ];
    expect(countRowsByTag(rows)).toEqual({ a: 1 });
  });
});

describe('filterRowsBySubset', () => {
  const rows: DataSourceRow[] = [
    { id: 'r1', values: {}, enabled: true, tags: ['smoke'] },
    { id: 'r2', values: {}, enabled: true, tags: ['edge-case'] },
    { id: 'r3', values: {}, enabled: true },
  ];

  it('filters by tag subset', () => {
    const result = filterRowsBySubset(rows, {
      name: 'Smoke',
      filter: { type: 'tags', tags: ['smoke'], mode: 'any' },
    });
    expect(result.map(r => r.id)).toEqual(['r1']);
  });

  it('filters by rowId subset', () => {
    const result = filterRowsBySubset(rows, {
      name: 'Custom',
      filter: { type: 'rows', rowIds: ['r2', 'r3'] },
    });
    expect(result.map(r => r.id)).toEqual(['r2', 'r3']);
  });
});

describe('BUILT_IN_TAGS', () => {
  it('contains expected default tags', () => {
    expect(BUILT_IN_TAGS).toContain('happy-path');
    expect(BUILT_IN_TAGS).toContain('edge-case');
    expect(BUILT_IN_TAGS).toContain('negative');
    expect(BUILT_IN_TAGS).toContain('smoke');
    expect(BUILT_IN_TAGS).toContain('regression');
  });
});

describe('expandDataSourceWithTags', () => {
  it('expands only rows matching tags', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true, tags: ['edge-case'] },
          { id: 'r3', values: { 'col-uid': '3', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
        ],
      },
    });
    const result = expandDataSourceWithTags(scenario, ['smoke']);
    expect(result.length).toBe(2);
    expect(result[0].url).toContain('/1/');
    expect(result[1].url).toContain('/3/');
  });

  it('returns original scenario when no data source', () => {
    const scenario = makeScenario();
    const result = expandDataSourceWithTags(scenario, ['smoke']);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(scenario);
  });

  it('returns empty array when no rows match', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
        ],
      },
    });
    const result = expandDataSourceWithTags(scenario, ['nonexistent']);
    expect(result.length).toBe(0);
  });

  it('filters by all mode', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true, tags: ['smoke', 'happy-path'] },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
        ],
      },
    });
    const result = expandDataSourceWithTags(scenario, ['smoke', 'happy-path'], 'all');
    expect(result.length).toBe(1);
    expect(result[0].url).toContain('/1/');
  });

  it('skips disabled rows', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: false, tags: ['smoke'] },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
        ],
      },
    });
    const result = expandDataSourceWithTags(scenario, ['smoke']);
    expect(result.length).toBe(1);
    expect(result[0].url).toContain('/2/');
  });

  it('expands all enabled rows when tags list is empty', () => {
    const scenario = makeScenario({
      dataSource: makeDataSource({
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true, tags: ['edge-case'] },
        ],
      }),
    });
    const result = expandDataSourceWithTags(scenario, []);
    expect(result).toHaveLength(2);
    expect(result[0].url).toContain('/1/');
    expect(result[1].url).toContain('/2/');
  });
});

// ─── Scenario-Level Tag Tests ─────────────────────────────────

describe('BUILT_IN_SCENARIO_TAGS', () => {
  it('contains expected tags', () => {
    expect(BUILT_IN_SCENARIO_TAGS).toContain('smoke');
    expect(BUILT_IN_SCENARIO_TAGS).toContain('regression');
    expect(BUILT_IN_SCENARIO_TAGS).toContain('critical');
    expect(BUILT_IN_SCENARIO_TAGS).toContain('e2e');
  });

  it('is readonly array', () => {
    expect(Array.isArray(BUILT_IN_SCENARIO_TAGS)).toBe(true);
  });
});

describe('normalizeTag', () => {
  it('lowercases tag', () => {
    expect(normalizeTag('SMOKE')).toBe('smoke');
    expect(normalizeTag('Regression')).toBe('regression');
  });

  it('trims whitespace', () => {
    expect(normalizeTag('  smoke  ')).toBe('smoke');
    expect(normalizeTag('\tregression\n')).toBe('regression');
  });

  it('removes special characters except hyphen and underscore', () => {
    expect(normalizeTag('happy-path')).toBe('happy-path');
    expect(normalizeTag('edge_case')).toBe('edge_case');
    expect(normalizeTag('smoke@test!')).toBe('smoketest');
    expect(normalizeTag('test#123')).toBe('test123');
  });

  it('returns empty string for invalid input', () => {
    expect(normalizeTag('   ')).toBe('');
    expect(normalizeTag('###')).toBe('');
  });

  it('handles mixed case with special chars', () => {
    expect(normalizeTag('  HAPPY-Path!  ')).toBe('happy-path');
  });
});

describe('filterScenariosByTags', () => {
  const scenarios: TestScenario[] = [
    makeTestScenario({ id: 's1', name: 'Smoke Test', tags: ['smoke', 'critical'] }),
    makeTestScenario({ id: 's2', name: 'Regression Test', tags: ['regression'] }),
    makeTestScenario({ id: 's3', name: 'Edge Case', tags: ['regression', 'edge-case'] }),
    makeTestScenario({ id: 's4', name: 'No Tags' }),
  ];

  it('returns all scenarios when filter tags is empty', () => {
    const result = filterScenariosByTags(scenarios, []);
    expect(result).toHaveLength(4);
  });

  it('filters by any mode (default) - matches if scenario has ANY of the tags', () => {
    const result = filterScenariosByTags(scenarios, ['smoke', 'regression']);
    expect(result).toHaveLength(3);
    expect(result.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('filters by all mode - requires ALL tags to be present', () => {
    const result = filterScenariosByTags(scenarios, ['regression', 'edge-case'], 'all');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s3');
  });

  it('excludes scenarios without tags', () => {
    const result = filterScenariosByTags(scenarios, ['smoke']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
    expect(result.find(s => s.id === 's4')).toBeUndefined();
  });

  it('handles case-insensitive matching', () => {
    const result = filterScenariosByTags(scenarios, ['SMOKE', 'Regression']);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no scenarios match', () => {
    const result = filterScenariosByTags(scenarios, ['nonexistent']);
    expect(result).toHaveLength(0);
  });

  it('handles empty scenarios array', () => {
    const result = filterScenariosByTags([], ['smoke']);
    expect(result).toHaveLength(0);
  });

  it('handles scenarios with empty tags array', () => {
    const scenariosWithEmpty = [
      makeTestScenario({ id: 's1', tags: [] }),
      makeTestScenario({ id: 's2', tags: ['smoke'] }),
    ];
    const result = filterScenariosByTags(scenariosWithEmpty, ['smoke']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s2');
  });

  it('handles whitespace in filter tags', () => {
    const result = filterScenariosByTags(scenarios, ['  smoke  ', '\tregression\n']);
    expect(result).toHaveLength(3);
    expect(result.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });
});

describe('collectAllScenarioTags', () => {
  it('returns empty array for no feature groups', () => {
    const result = collectAllScenarioTags([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when no scenarios have tags', () => {
    const groups = [
      makeFeatureGroup([makeTestScenario(), makeTestScenario({ id: 's2' })]),
    ];
    const result = collectAllScenarioTags(groups);
    expect(result).toEqual([]);
  });

  it('collects tags from single feature group', () => {
    const groups = [
      makeFeatureGroup([
        makeTestScenario({ tags: ['smoke', 'critical'] }),
        makeTestScenario({ id: 's2', tags: ['regression'] }),
      ]),
    ];
    const result = collectAllScenarioTags(groups);
    expect(result).toEqual(['critical', 'regression', 'smoke']);
  });

  it('deduplicates tags across multiple groups', () => {
    const groups = [
      makeFeatureGroup([makeTestScenario({ tags: ['smoke', 'critical'] })]),
      makeFeatureGroup([makeTestScenario({ tags: ['smoke', 'regression'] })], { id: 'fg-2' }),
    ];
    const result = collectAllScenarioTags(groups);
    expect(result).toEqual(['critical', 'regression', 'smoke']);
  });

  it('returns sorted tags', () => {
    const groups = [
      makeFeatureGroup([makeTestScenario({ tags: ['z-test', 'a-test', 'm-test'] })]),
    ];
    const result = collectAllScenarioTags(groups);
    expect(result).toEqual(['a-test', 'm-test', 'z-test']);
  });
});

describe('countScenariosByTag', () => {
  it('returns empty object for no feature groups', () => {
    const result = countScenariosByTag([]);
    expect(result).toEqual({});
  });

  it('returns empty object when no scenarios have tags', () => {
    const groups = [
      makeFeatureGroup([makeTestScenario(), makeTestScenario({ id: 's2' })]),
    ];
    const result = countScenariosByTag(groups);
    expect(result).toEqual({});
  });

  it('counts scenarios per tag', () => {
    const groups = [
      makeFeatureGroup([
        makeTestScenario({ tags: ['smoke', 'critical'] }),
        makeTestScenario({ id: 's2', tags: ['smoke', 'regression'] }),
        makeTestScenario({ id: 's3', tags: ['regression'] }),
      ]),
    ];
    const result = countScenariosByTag(groups);
    expect(result).toEqual({
      smoke: 2,
      critical: 1,
      regression: 2,
    });
  });

  it('counts correctly across multiple feature groups', () => {
    const groups = [
      makeFeatureGroup([makeTestScenario({ tags: ['smoke'] })]),
      makeFeatureGroup([makeTestScenario({ tags: ['smoke', 'e2e'] })], { id: 'fg-2' }),
      makeFeatureGroup([makeTestScenario({ tags: ['e2e'] })], { id: 'fg-3' }),
    ];
    const result = countScenariosByTag(groups);
    expect(result).toEqual({
      smoke: 2,
      e2e: 2,
    });
  });
});
