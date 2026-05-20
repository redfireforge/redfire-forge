import { describe, it, expect } from 'vitest';
import { expandDataSource, resolveScenarioFromDataRow, expandDataSourceWithSubset, expandDataSourceForRows, resolveSharedDataSource, resolveSharedDataSources } from './dataSourceExpander';
import { Scenario, DataSource, DataSourceColumn, DataSourceRow, SharedDataSource } from '../shared/types';
import { makeScenario as _makeScenario } from '../test-utils/factories';

// ─── Test Helpers ─────────────────────────────────────────────

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    url: 'https://api.example.com/users/{{userId}}/posts?channel={{channel}}',
    headers: [{ key: 'X-Custom', value: 'static' }],
    ...overrides,
  });
}

function makeColumns(): DataSourceColumn[] {
  return [
    { id: 'col-uid', name: 'userId', type: 'path', mapping: 'userId' },
    { id: 'col-ch', name: 'channel', type: 'param', mapping: 'channel' },
    { id: 'col-val', name: 'expectedStatus', type: 'validate', mapping: '$.status' },
  ];
}

function makeRow(id: string, userId: string, channel: string, expected = 'active', enabled = true): DataSourceRow {
  return {
    id,
    values: { 'col-uid': userId, 'col-ch': channel, 'col-val': expected },
    enabled,
  };
}

function makeDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'dt-1',
    columns: makeColumns(),
    rows: [
      makeRow('r1', '42', 'WEBRNW'),
      makeRow('r2', '99', 'DEALER'),
      makeRow('r3', '7', 'MOBILE', 'pending', false), // disabled
    ],
    source: { type: 'inline' },
    ...overrides,
  };
}

// ─── buildRowLabel ────────────────────────────────────────────

describe('expandDataSourceWithSubset', () => {
  it('expands rows matching a named tag subset', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true, tags: ['edge-case'] },
        ],
        subsets: [
          { name: 'Smoke', filter: { type: 'tags', tags: ['smoke'], mode: 'any' } },
        ],
      },
    });
    const result = expandDataSourceWithSubset(scenario, 'Smoke');
    expect(result.length).toBe(1);
    expect(result[0].url).toContain('/1/');
  });

  it('expands rows matching a named rowId subset', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true },
          { id: 'r3', values: { 'col-uid': '3', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true },
        ],
        subsets: [
          { name: 'Custom', filter: { type: 'rows', rowIds: ['r1', 'r3'] } },
        ],
      },
    });
    const result = expandDataSourceWithSubset(scenario, 'Custom');
    expect(result.length).toBe(2);
    expect(result[0].url).toContain('/1/');
    expect(result[1].url).toContain('/3/');
  });

  it('falls back to full expansion when subset not found', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true },
        ],
      },
    });
    const result = expandDataSourceWithSubset(scenario, 'Missing');
    expect(result.length).toBe(2); // all rows expanded
  });

  it('returns empty when subset matches no rows', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true, tags: ['smoke'] },
        ],
        subsets: [
          { name: 'Edge', filter: { type: 'tags', tags: ['edge-case'], mode: 'any' } },
        ],
      },
    });
    const result = expandDataSourceWithSubset(scenario, 'Edge');
    expect(result.length).toBe(0);
  });

  it('returns original scenario when no data source', () => {
    const scenario = makeScenario();
    const result = expandDataSourceWithSubset(scenario, 'Any');
    expect(result.length).toBe(1);
    expect(result[0]).toBe(scenario);
  });
});

// ─── expandDataSourceForRows ─────────────────────────────────

describe('expandDataSourceForRows', () => {
  it('expands only specific rows by ID', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true },
          { id: 'r2', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': '200' }, enabled: true },
          { id: 'r3', values: { 'col-uid': '3', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true },
        ],
      },
    });
    const result = expandDataSourceForRows(scenario, ['r1', 'r3']);
    expect(result.length).toBe(2);
    expect(result[0].url).toContain('/1/');
    expect(result[1].url).toContain('/3/');
  });

  it('returns empty array for empty rowIds', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true },
        ],
      },
    });
    expect(expandDataSourceForRows(scenario, [])).toEqual([]);
  });

  it('returns empty array when no data source', () => {
    const scenario = makeScenario();
    expect(expandDataSourceForRows(scenario, ['r1'])).toEqual([]);
  });

  it('returns empty array when rowIds do not match', () => {
    const scenario = makeScenario({
      dataSource: {
        columns: makeColumns(),
        rows: [
          { id: 'r1', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '200' }, enabled: true },
        ],
      },
    });
    expect(expandDataSourceForRows(scenario, ['nonexistent'])).toEqual([]);
  });
});

// ─── validationMode + isSample ────────────────────────────────

describe('validationMode per-row enforcement', () => {
  const cols = makeColumns();
  const sampleRow: DataSourceRow = { id: 'rs', values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': 'ok' }, enabled: true, isSample: true };
  const normalRow: DataSourceRow = { id: 'rn', values: { 'col-uid': '2', 'col-ch': 'APP', 'col-val': 'ok' }, enabled: true };

  it('mode=none: skips validation for all rows', () => {
    const base = makeScenario({ validation: { mode: 'selective' } });
    const result = resolveScenarioFromDataRow(base, cols, sampleRow, 0, undefined, 'none');
    expect(result.validation.mode).toBe('none');
  });

  it('mode=none: skips validation even for sample rows', () => {
    const base = makeScenario({ validation: { mode: 'selective' } });
    const result = resolveScenarioFromDataRow(base, cols, sampleRow, 0, undefined, 'none');
    expect(result.validation.mode).toBe('none');
    expect(result.validation.expectedFields).toBeUndefined();
  });

  it('mode=selective: validates sample rows', () => {
    const base = makeScenario({ validation: { mode: 'none' } });
    const result = resolveScenarioFromDataRow(base, cols, sampleRow, 0, undefined, 'selective');
    expect(result.validation.mode).toBe('selective');
    expect(result.validation.expectedFields).toHaveLength(1);
  });

  it('mode=selective: skips validation for non-sample rows', () => {
    const base = makeScenario({ validation: { mode: 'selective' } });
    const result = resolveScenarioFromDataRow(base, cols, normalRow, 0, undefined, 'selective');
    expect(result.validation.mode).toBe('none');
  });

  it('mode=full: validates all rows with validate data', () => {
    const base = makeScenario({ validation: { mode: 'none' } });
    const resultSample = resolveScenarioFromDataRow(base, cols, sampleRow, 0, undefined, 'full');
    const resultNormal = resolveScenarioFromDataRow(base, cols, normalRow, 1, undefined, 'full');
    expect(resultSample.validation.mode).toBe('selective');
    expect(resultNormal.validation.mode).toBe('selective');
    expect(resultSample.validation.expectedFields).toHaveLength(1);
    expect(resultNormal.validation.expectedFields).toHaveLength(1);
  });

  it('undefined mode (default): validates all rows like full', () => {
    const base = makeScenario({ validation: { mode: 'none' } });
    const result = resolveScenarioFromDataRow(base, cols, normalRow, 0, undefined, undefined);
    expect(result.validation.mode).toBe('selective');
    expect(result.validation.expectedFields).toHaveLength(1);
  });

  it('expandDataSource respects dataSource.validationMode=selective', () => {
    const sc = makeScenario({
      validation: { mode: 'selective' },
      dataSource: makeDataSource({
        validationMode: 'selective',
        rows: [sampleRow, normalRow],
      }),
    });
    const expanded = expandDataSource(sc);
    expect(expanded).toHaveLength(2);
    // Sample row should have validation
    expect(expanded[0].validation.mode).toBe('selective');
    expect(expanded[0].validation.expectedFields).toHaveLength(1);
    // Normal row should have validation skipped
    expect(expanded[1].validation.mode).toBe('none');
  });

  it('expandDataSource respects dataSource.validationMode=none', () => {
    const sc = makeScenario({
      validation: { mode: 'selective' },
      dataSource: makeDataSource({
        validationMode: 'none',
        rows: [sampleRow, normalRow],
      }),
    });
    const expanded = expandDataSource(sc);
    expect(expanded).toHaveLength(2);
    expect(expanded[0].validation.mode).toBe('none');
    expect(expanded[1].validation.mode).toBe('none');
  });
});

// ─── 19B: Shared Data Source resolution ─────────────────────

function makeSharedDs(id: string, name: string, rows: DataSourceRow[] = []): SharedDataSource {
  return {
    id,
    name,
    dataSource: {
      id: `ds-${id}`,
      columns: [{ id: 'col1', name: 'vin', type: 'path' }],
      rows,
      source: { type: 'inline' },
    },
    updatedAt: Date.now(),
  };
}

describe('resolveSharedDataSource', () => {
  it('attaches shared data source to scenario', () => {
    const rows: DataSourceRow[] = [{ id: 'r1', values: { col1: 'ABC123' }, enabled: true }];
    const shared = makeSharedDs('s1', 'Vehicles', rows);
    const scenario = makeScenario({ sharedDataSourceId: 's1' });

    const resolved = resolveSharedDataSource(scenario, [shared]);
    expect(resolved.dataSource).toBe(shared.dataSource);
  });

  it('returns scenario unchanged when no sharedDataSourceId', () => {
    const scenario = makeScenario();
    const resolved = resolveSharedDataSource(scenario, []);
    expect(resolved).toBe(scenario);
  });

  it('returns scenario unchanged when no sharedDataSources provided', () => {
    const scenario = makeScenario({ sharedDataSourceId: 's1' });
    const resolved = resolveSharedDataSource(scenario);
    expect(resolved).toBe(scenario);
  });

  it('returns scenario unchanged when shared DS not found', () => {
    const scenario = makeScenario({ sharedDataSourceId: 'missing' });
    const shared = makeSharedDs('s1', 'Vehicles');
    const resolved = resolveSharedDataSource(scenario, [shared]);
    expect(resolved).toBe(scenario);
  });

  it('does not replace inline dataSource when shared id is set', () => {
    const inline = makeDataSource({ id: 'inline' });
    const scenario = makeScenario({ sharedDataSourceId: 's1', dataSource: inline });
    const shared = makeSharedDs('s1', 'Shared');
    const resolved = resolveSharedDataSource(scenario, [shared]);
    expect(resolved).toBe(scenario);
    expect(resolved.dataSource).toBe(inline);
  });

  it('returns scenario unchanged when shared list is empty array', () => {
    const scenario = makeScenario({ sharedDataSourceId: 's1' });
    expect(resolveSharedDataSource(scenario, [])).toBe(scenario);
  });
});

describe('resolveSharedDataSources', () => {
  it('resolves shared DS across multiple scenarios', () => {
    const rows: DataSourceRow[] = [{ id: 'r1', values: { col1: 'XYZ' }, enabled: true }];
    const shared = makeSharedDs('s1', 'VINs', rows);

    const scenario1 = makeScenario({ id: 'sc-1', sharedDataSourceId: 's1' });
    const scenario2 = makeScenario({ id: 'sc-2' }); // no shared DS

    const resolved = resolveSharedDataSources([scenario1, scenario2], [shared]);
    expect(resolved[0].dataSource).toBe(shared.dataSource);
    expect(resolved[1]).toBe(scenario2);
  });

  it('handles empty queue', () => {
    expect(resolveSharedDataSources([], [])).toEqual([]);
  });

  describe('with SharedDataSource[]', () => {
    it('resolves shared DS from flat array', () => {
      const rows: DataSourceRow[] = [{ id: 'r1', values: { col1: 'ABC' }, enabled: true }];
      const shared = makeSharedDs('s1', 'Users', rows);
      const scenario = makeScenario({ sharedDataSourceId: 's1' });

      const resolved = resolveSharedDataSources([scenario], [shared]);
      expect(resolved[0].dataSource).toBe(shared.dataSource);
    });

    it('resolves multiple scenarios from top-level array', () => {
      const rows1: DataSourceRow[] = [{ id: 'r1', values: { col1: 'A' }, enabled: true }];
      const rows2: DataSourceRow[] = [{ id: 'r2', values: { col1: 'B' }, enabled: true }];
      const shared1 = makeSharedDs('s1', 'Users', rows1);
      const shared2 = makeSharedDs('s2', 'Products', rows2);

      const scenario1 = makeScenario({ id: 'sc-1', sharedDataSourceId: 's1' });
      const scenario2 = makeScenario({ id: 'sc-2', sharedDataSourceId: 's2' });
      const scenario3 = makeScenario({ id: 'sc-3' }); // no shared DS

      const resolved = resolveSharedDataSources([scenario1, scenario2, scenario3], [shared1, shared2]);
      expect(resolved[0].dataSource).toBe(shared1.dataSource);
      expect(resolved[1].dataSource).toBe(shared2.dataSource);
      expect(resolved[2]).toBe(scenario3);
    });

    it('returns scenario unchanged when sharedDataSourceId not found in array', () => {
      const shared = makeSharedDs('s1', 'Users');
      const scenario = makeScenario({ sharedDataSourceId: 'nonexistent' });

      const resolved = resolveSharedDataSources([scenario], [shared]);
      expect(resolved[0]).toBe(scenario);
      expect(resolved[0].dataSource).toBeUndefined();
    });

    it('does not overwrite existing inline dataSource', () => {
      const inlineDs = makeDataSource({ id: 'inline-ds' });
      const shared = makeSharedDs('s1', 'Users');
      const scenario = makeScenario({ sharedDataSourceId: 's1', dataSource: inlineDs });

      const resolved = resolveSharedDataSources([scenario], [shared]);
      expect(resolved[0].dataSource).toBe(inlineDs);
    });

    it('handles empty SharedDataSource array', () => {
      const scenario = makeScenario({ sharedDataSourceId: 's1' });
      const resolved = resolveSharedDataSources([scenario], []);
      expect(resolved[0]).toBe(scenario);
    });
  });
});
