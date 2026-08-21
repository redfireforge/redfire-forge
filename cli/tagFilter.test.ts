/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { parseTagFilter, filterScenariosByRowTags } from './tagFilter';
import type { Scenario, DataSource } from '../src/shared/types';

function makeDataSource(rows: { id: string; tags?: string[] }[]): DataSource {
  return {
    id: 'ds1',
    columns: [{ id: 'c1', name: 'userId', type: 'param', mapping: 'userId' }],
    rows: rows.map(r => ({ id: r.id, values: { c1: '1' }, enabled: true, tags: r.tags })),
    source: { type: 'inline' },
  };
}

function makeScenario(name: string, dataSource?: DataSource): Scenario {
  return {
    id: name,
    name,
    url: '/users',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    dataSource,
  } as Scenario;
}

describe('parseTagFilter', () => {
  it('splits, trims, and lowercases a comma-separated tag list', () => {
    expect(parseTagFilter(' Smoke, Critical ,regression')).toEqual(['smoke', 'critical', 'regression']);
  });

  it('drops empty entries', () => {
    expect(parseTagFilter('smoke,,  ,critical')).toEqual(['smoke', 'critical']);
  });
});

describe('filterScenariosByRowTags', () => {
  it('keeps scenarios without a dataSource untouched', () => {
    const sc = makeScenario('No Data');
    const result = filterScenariosByRowTags([sc], ['smoke'], 'any');

    expect(result.scenarios).toEqual([sc]);
    expect(result.droppedScenarioNames).toEqual([]);
  });

  it('keeps scenarios whose dataSource already has zero rows untouched', () => {
    const sc = makeScenario('Empty DS', { ...makeDataSource([]), rows: [] });
    const result = filterScenariosByRowTags([sc], ['smoke'], 'any');

    expect(result.scenarios).toEqual([sc]);
    expect(result.droppedScenarioNames).toEqual([]);
  });

  it('filters rows down to only tag matches (mode: any)', () => {
    const sc = makeScenario('Users', makeDataSource([
      { id: 'r1', tags: ['smoke'] },
      { id: 'r2', tags: ['regression'] },
      { id: 'r3', tags: ['smoke', 'critical'] },
    ]));

    const result = filterScenariosByRowTags([sc], ['smoke'], 'any');

    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].dataSource!.rows.map(r => r.id)).toEqual(['r1', 'r3']);
    expect(result.matchingRowCount).toBe(2);
  });

  it('requires every filter tag to be present in mode: all', () => {
    const sc = makeScenario('Users', makeDataSource([
      { id: 'r1', tags: ['smoke', 'critical'] },
      { id: 'r2', tags: ['smoke'] },
    ]));

    const result = filterScenariosByRowTags([sc], ['smoke', 'critical'], 'all');

    expect(result.scenarios[0].dataSource!.rows.map(r => r.id)).toEqual(['r1']);
  });

  it('excludes rows with no tags at all, even in mode: any', () => {
    const sc = makeScenario('Users', makeDataSource([
      { id: 'r1', tags: undefined },
      { id: 'r2', tags: ['smoke'] },
    ]));

    const result = filterScenariosByRowTags([sc], ['smoke'], 'any');

    expect(result.scenarios[0].dataSource!.rows.map(r => r.id)).toEqual(['r2']);
  });

  it('drops a scenario entirely when every row is filtered out (BUG-2 fix)', () => {
    const sc = makeScenario('No Matches', makeDataSource([
      { id: 'r1', tags: ['regression'] },
      { id: 'r2', tags: ['boundary'] },
    ]));

    const result = filterScenariosByRowTags([sc], ['smoke'], 'any');

    expect(result.scenarios).toEqual([]);
    expect(result.droppedScenarioNames).toEqual(['No Matches']);
  });

  it('keeps matching scenarios and drops non-matching ones in the same run', () => {
    const match = makeScenario('Match', makeDataSource([{ id: 'r1', tags: ['smoke'] }]));
    const noMatch = makeScenario('No Match', makeDataSource([{ id: 'r2', tags: ['regression'] }]));
    const noData = makeScenario('No Data');

    const result = filterScenariosByRowTags([match, noMatch, noData], ['smoke'], 'any');

    expect(result.scenarios.map(s => s.name)).toEqual(['Match', 'No Data']);
    expect(result.droppedScenarioNames).toEqual(['No Match']);
  });

  it('does not mutate the original scenario or dataSource objects', () => {
    const original = makeScenario('Users', makeDataSource([
      { id: 'r1', tags: ['smoke'] },
      { id: 'r2', tags: ['regression'] },
    ]));
    const originalRows = original.dataSource!.rows;

    filterScenariosByRowTags([original], ['smoke'], 'any');

    expect(original.dataSource!.rows).toBe(originalRows);
    expect(original.dataSource!.rows).toHaveLength(2);
  });
});
