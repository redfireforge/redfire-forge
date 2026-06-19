import { describe, it, expect } from 'vitest';
import { migrateScenarioKinds, inferScenarioKind } from './scenarioMigration';
import type { FeatureGroup, TestScenario, Scenario, DataSource, ScenarioKind } from '../types';
import { makeScenario as _makeScenario } from '../../test-utils/factories';

function makeTest(id: string, overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id,
    name: `Test ${id}`,
    url: '/api',
    ...overrides,
  }) as Scenario;
}

const sampleDataSource: DataSource = {
  columns: [{ id: 'c1', name: 'col1' }],
  rows: [{ id: 'r1', values: { c1: 'val1' } }],
};

function makeScenario(id: string, tests: Scenario[], kind?: ScenarioKind): TestScenario {
  const sc: Record<string, unknown> = { id, name: `Scenario ${id}`, tests };
  if (kind !== undefined) sc.kind = kind;
  return sc as TestScenario;
}

function makeFg(id: string, scenarios: TestScenario[]): FeatureGroup {
  return { id, name: `FG ${id}`, scenarios } as FeatureGroup;
}

describe('inferScenarioKind', () => {
  it('returns "standard" for empty tests array', () => {
    expect(inferScenarioKind([])).toBe('standard');
  });

  it('returns "standard" when no tests have data sources', () => {
    expect(inferScenarioKind([makeTest('t1'), makeTest('t2')])).toBe('standard');
  });

  it('returns "parameterized" when any test has inline dataSource', () => {
    expect(inferScenarioKind([
      makeTest('t1'),
      makeTest('t2', { dataSource: sampleDataSource }),
    ])).toBe('parameterized');
  });

  it('returns "parameterized" when any test has sharedDataSourceId', () => {
    expect(inferScenarioKind([
      makeTest('t1', { sharedDataSourceId: 'ds-1' }),
    ])).toBe('parameterized');
  });
});

describe('migrateScenarioKinds', () => {
  it('returns migrated=false when all scenarios already have kind', () => {
    const groups = [makeFg('fg1', [
      makeScenario('sc1', [makeTest('t1')], 'standard'),
      makeScenario('sc2', [makeTest('t2', { dataSource: sampleDataSource })], 'parameterized'),
    ])];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(false);
    expect(result.splitCount).toBe(0);
    expect(result.groups).toBe(groups);
  });

  it('sets kind="standard" for scenario with only normal tests', () => {
    const groups = [makeFg('fg1', [
      makeScenario('sc1', [makeTest('t1'), makeTest('t2')]),
    ])];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(true);
    expect(result.splitCount).toBe(0);
    expect(result.groups[0].scenarios).toHaveLength(1);
    expect(result.groups[0].scenarios[0].kind).toBe('standard');
    expect(result.groups[0].scenarios[0].tests).toHaveLength(2);
  });

  it('sets kind="standard" for empty scenario', () => {
    const groups = [makeFg('fg1', [makeScenario('sc1', [])])];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(true);
    expect(result.groups[0].scenarios[0].kind).toBe('standard');
  });

  it('sets kind="parameterized" for scenario with all parameterized tests', () => {
    const groups = [makeFg('fg1', [
      makeScenario('sc1', [
        makeTest('t1', { dataSource: sampleDataSource }),
        makeTest('t2', { sharedDataSourceId: 'ds-1' }),
      ]),
    ])];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(true);
    expect(result.splitCount).toBe(0);
    expect(result.groups[0].scenarios).toHaveLength(1);
    expect(result.groups[0].scenarios[0].kind).toBe('parameterized');
    expect(result.groups[0].scenarios[0].tests).toHaveLength(2);
  });

  it('splits mixed scenario into standard + parameterized', () => {
    const normalTest = makeTest('t1');
    const paramTest = makeTest('t2', { dataSource: sampleDataSource });
    const groups = [makeFg('fg1', [
      makeScenario('sc1', [normalTest, paramTest]),
    ])];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(true);
    expect(result.splitCount).toBe(1);
    expect(result.groups[0].scenarios).toHaveLength(2);

    const stdSc = result.groups[0].scenarios[0];
    const paramSc = result.groups[0].scenarios[1];

    expect(stdSc.kind).toBe('standard');
    expect(stdSc.id).toBe('sc1');
    expect(stdSc.tests).toEqual([normalTest]);

    expect(paramSc.kind).toBe('parameterized');
    expect(paramSc.id).not.toBe('sc1');
    expect(paramSc.name).toBe('Scenario sc1 (Parameterized)');
    expect(paramSc.tests).toEqual([paramTest]);
  });

  it('preserves auth when splitting', () => {
    const auth = { type: 'bearer' as const, bearerToken: 'tok123' };
    const normalTest = makeTest('t1');
    const paramTest = makeTest('t2', { sharedDataSourceId: 'ds-1' });
    const sc = makeScenario('sc1', [normalTest, paramTest]);
    (sc as Record<string, unknown>).auth = auth;
    const groups = [makeFg('fg1', [sc])];

    const result = migrateScenarioKinds(groups);
    const paramSc = result.groups[0].scenarios[1];
    expect(paramSc.auth).toEqual(auth);
  });

  it('handles multiple feature groups', () => {
    const groups = [
      makeFg('fg1', [makeScenario('sc1', [makeTest('t1')])]),
      makeFg('fg2', [makeScenario('sc2', [makeTest('t2', { dataSource: sampleDataSource })])]),
    ];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(true);
    expect(result.groups[0].scenarios[0].kind).toBe('standard');
    expect(result.groups[1].scenarios[0].kind).toBe('parameterized');
  });

  it('handles feature group with no scenarios', () => {
    const groups = [{ id: 'fg1', name: 'Empty', scenarios: [] } as FeatureGroup];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(false);
    expect(result.groups).toBe(groups);
  });

  it('skips already-migrated scenarios in a mixed group', () => {
    const groups = [makeFg('fg1', [
      makeScenario('sc1', [makeTest('t1')], 'standard'),
      makeScenario('sc2', [makeTest('t2')]),
    ])];

    const result = migrateScenarioKinds(groups);
    expect(result.migrated).toBe(true);
    expect(result.groups[0].scenarios).toHaveLength(2);
    expect(result.groups[0].scenarios[0].kind).toBe('standard');
    expect(result.groups[0].scenarios[1].kind).toBe('standard');
  });

  it('generates unique IDs for split scenarios', () => {
    const groups = [makeFg('fg1', [
      makeScenario('sc1', [makeTest('t1'), makeTest('t2', { dataSource: sampleDataSource })]),
      makeScenario('sc2', [makeTest('t3'), makeTest('t4', { sharedDataSourceId: 'ds-1' })]),
    ])];

    const result = migrateScenarioKinds(groups);
    expect(result.splitCount).toBe(2);
    expect(result.groups[0].scenarios).toHaveLength(4);

    const ids = result.groups[0].scenarios.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(4);
  });

  it('correctly separates tests in a complex mixed scenario', () => {
    const t1 = makeTest('t1');
    const t2 = makeTest('t2', { dataSource: sampleDataSource });
    const t3 = makeTest('t3');
    const t4 = makeTest('t4', { sharedDataSourceId: 'ds-1' });
    const t5 = makeTest('t5');

    const groups = [makeFg('fg1', [
      makeScenario('sc1', [t1, t2, t3, t4, t5]),
    ])];

    const result = migrateScenarioKinds(groups);
    expect(result.splitCount).toBe(1);

    const stdSc = result.groups[0].scenarios[0];
    const paramSc = result.groups[0].scenarios[1];

    expect(stdSc.tests).toEqual([t1, t3, t5]);
    expect(paramSc.tests).toEqual([t2, t4]);
  });
});
