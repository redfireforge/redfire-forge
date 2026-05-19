import { describe, it, expect } from 'vitest';
import {
  expandDataSource,
  expandQueue,
  resolveScenarioFromDataRow,
  buildRowLabel,
  filterRowsByTags,
  collectAllTags,
  countRowsByTag,
  filterRowsBySubset,
  expandDataSourceWithTags,
  expandDataSourceWithSubset,
  expandDataSourceForRows,
  BUILT_IN_TAGS,
  resolveSharedDataSource,
  resolveSharedDataSources,
} from './dataSourceExpander';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow, SharedDataSource } from '../shared/types';
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

describe('buildRowLabel', () => {
  const cols = makeColumns();

  it('builds label from non-validate columns', () => {
    const row = makeRow('r1', '42', 'WEBRNW');
    expect(buildRowLabel(row, cols, 0)).toBe('Row 1: userId=42, channel=WEBRNW');
  });

  it('uses 1-based index', () => {
    const row = makeRow('r2', '99', 'DEALER');
    expect(buildRowLabel(row, cols, 4)).toBe('Row 5: userId=99, channel=DEALER');
  });

  it('truncates long values to 14 chars + ellipsis', () => {
    const row = makeRow('r1', 'ABCDEFGHIJKLMNOPQRST', 'X');
    const label = buildRowLabel(row, cols, 0);
    expect(label).toContain('userId=ABCDEFGHIJKLMN…');
  });

  it('limits to 3 non-validate columns', () => {
    const manyCols: DataSourceColumn[] = [
      { id: 'a', name: 'a', type: 'path', mapping: 'a' },
      { id: 'b', name: 'b', type: 'param', mapping: 'b' },
      { id: 'c', name: 'c', type: 'param', mapping: 'c' },
      { id: 'd', name: 'd', type: 'param', mapping: 'd' },
    ];
    const row: DataSourceRow = {
      id: 'r1',
      values: { a: '1', b: '2', c: '3', d: '4' },
      enabled: true,
    };
    const label = buildRowLabel(row, manyCols, 0);
    expect(label).toBe('Row 1: a=1, b=2, c=3');
    expect(label).not.toContain('d=4');
  });

  it('handles empty columns gracefully', () => {
    const row: DataSourceRow = { id: 'r1', values: {}, enabled: true };
    expect(buildRowLabel(row, [], 0)).toBe('Row 1');
  });
});

// ─── resolveScenarioFromDataRow ───────────────────────────────

describe('resolveScenarioFromDataRow', () => {
  it('substitutes path variables in URL', () => {
    const base = makeScenario();
    const cols = makeColumns();
    const row = makeRow('r1', '42', 'WEBRNW');
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toContain('/users/42/');
  });

  it('sets query parameters from param columns', () => {
    const base = makeScenario();
    const cols = makeColumns();
    const row = makeRow('r1', '42', 'WEBRNW');
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    const url = new URL(resolved.url);
    expect(url.searchParams.get('channel')).toBe('WEBRNW');
  });

  it('replaces {{placeholder}} with empty string when param column value is empty', () => {
    const base = makeScenario({
      url: 'https://api.example.com/data?channel={{channel}}&code={{code}}',
    });
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'channel', type: 'param', mapping: 'channel' },
      { id: 'c2', name: 'code', type: 'param', mapping: 'code' },
    ];
    const row: DataSourceRow = { id: 'r1', values: { c1: 'WEB', c2: '' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    const url = new URL(resolved.url);
    expect(url.searchParams.get('channel')).toBe('WEB');
    expect(url.searchParams.get('code')).toBe('');
    expect(resolved.url).not.toContain('{{');
    expect(resolved.url).not.toContain('%7B%7B');
  });

  it('replaces body variables from body columns', () => {
    const base = makeScenario({
      url: 'https://api.example.com/login',
      method: 'POST',
      body: '{"username":"{{user}}","password":"{{pass}}"}',
    });
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'user', type: 'body', mapping: 'user' },
      { id: 'c2', name: 'pass', type: 'body', mapping: 'pass' },
    ];
    const row: DataSourceRow = {
      id: 'r1',
      values: { c1: 'alice', c2: 'secret' },
      enabled: true,
    };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.body).toBe('{"username":"alice","password":"secret"}');
  });

  it('adds header values from header columns', () => {
    const base = makeScenario({
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    });
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'token', type: 'header', mapping: 'X-Auth-Token' },
    ];
    const row: DataSourceRow = {
      id: 'r1',
      values: { c1: 'tok_abc123' },
      enabled: true,
    };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.headers).toContainEqual({ key: 'X-Auth-Token', value: 'tok_abc123' });
    expect(resolved.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' });
  });

  it('overrides existing headers by name (case-insensitive)', () => {
    const base = makeScenario({
      headers: [{ key: 'X-Custom', value: 'old-value' }],
    });
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'custom', type: 'header', mapping: 'X-Custom' },
    ];
    const row: DataSourceRow = {
      id: 'r1',
      values: { c1: 'new-value' },
      enabled: true,
    };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.headers).toEqual([{ key: 'X-Custom', value: 'new-value' }]);
  });

  it('clears dataSource on expanded scenarios', () => {
    const base = makeScenario({ dataSource: makeDataSource() });
    const cols = makeColumns();
    const row = makeRow('r1', '42', 'WEBRNW');
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.dataSource).toBeUndefined();
  });

  it('sets dataRowId and dataRowLabel', () => {
    const base = makeScenario();
    const cols = makeColumns();
    const row = makeRow('r1', '42', 'WEBRNW');
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.dataRowId).toBe('r1');
    expect(resolved.dataRowLabel).toBe('Row 1: userId=42, channel=WEBRNW');
  });

  it('preserves featureGroupName and groupName', () => {
    const base = makeScenario({ featureGroupName: 'FG', groupName: 'GRP' });
    const cols = makeColumns();
    const row = makeRow('r1', '42', 'WEBRNW');
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.featureGroupName).toBe('FG');
    expect(resolved.groupName).toBe('GRP');
  });

  it('leaves unmatched {{variables}} in place', () => {
    const base = makeScenario({
      url: 'https://api.example.com/{{region}}/users',
    });
    const resolved = resolveScenarioFromDataRow(base, [], makeRow('r1', '', ''), 0);
    expect(resolved.url).toContain('{{region}}');
  });

  it('uses column name as path var key when URL placeholder matches name but not mapping', () => {
    const base = makeScenario({
      url: 'https://api.example.com/users/{{userId}}/posts',
    });
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'userId', type: 'path', mapping: 'uid' },
    ];
    const row: DataSourceRow = { id: 'r1', values: { c1: '99' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toContain('/users/99/posts');
  });

  it('uses mapping as path var key when URL contains {{mapping}} placeholder', () => {
    const base = makeScenario({
      url: 'https://api.example.com/users/{{uid}}/posts',
    });
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'userId', type: 'path', mapping: 'uid' },
    ];
    const row: DataSourceRow = { id: 'r1', values: { c1: '77' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toContain('/users/77/posts');
  });

  it('skips path substitution when row value is a lone template token', () => {
    const base = makeScenario({ url: 'https://api.example.com/users/{{userId}}/posts' });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: '{{fromElsewhere}}' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toContain('{{userId}}');
  });

  it('falls back through normalizeUnresolvedQueryPlaceholders when base URL is not parseable (no param columns)', () => {
    const base = makeScenario({ url: 'not-a-valid-url' });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: '1' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toBe('not-a-valid-url');
  });

  it('falls back when param substitution yields a non-parseable URL', () => {
    const base = makeScenario({ url: 'not-a-valid-url?channel={{channel}}' });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'channel', type: 'param', mapping: 'channel' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: 'WEB' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toContain('channel');
    expect(resolved.url).not.toContain('{{channel}}');
  });

  it('does not rewrite body when body is empty despite body columns', () => {
    const base = makeScenario({ url: 'https://api.example.com/x', body: '' });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'x', type: 'body', mapping: 'x' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: 'hello' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.body).toBe('');
  });

  it('sets unorderedArrays when arrayValidationMode has unordered and no expected fields', () => {
    const base = makeScenario({ validation: { mode: 'full' } });
    const cols = makeColumns();
    const row: DataSourceRow = {
      id: 'r1',
      values: { 'col-uid': '1', 'col-ch': 'WEB', 'col-val': '' },
      enabled: true,
    };
    const resolved = resolveScenarioFromDataRow(
      base,
      cols,
      row,
      0,
      { items: 'unordered' },
      'full',
    );
    expect(resolved.validation.unorderedArrays).toBe(true);
    expect(resolved.validation.expectedFields).toBeUndefined();
  });

  it('merges unorderedArrays from arrayValidationMode into selective validation when expected fields exist', () => {
    const base = makeScenario({ validation: { mode: 'full', unorderedArrays: false } });
    const cols = makeColumns();
    const row = makeRow('r1', '1', 'WEB', '200');
    const resolved = resolveScenarioFromDataRow(
      base,
      cols,
      row,
      0,
      { items: 'unordered' },
      'full',
    );
    expect(resolved.validation.mode).toBe('selective');
    expect(resolved.validation.unorderedArrays).toBe(true);
  });

  it('prefers name key for new query param when URL has both mapping and name keys and row supplies both', () => {
    const base = makeScenario({
      url: 'https://api.example.com/data?channel={{channel}}&ch={{ch}}',
    });
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'ch', type: 'param', mapping: 'channel' },
    ];
    const row: DataSourceRow = { id: 'r1', values: { c1: 'APP' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    const url = new URL(resolved.url);
    expect(url.searchParams.get('channel')).toBe('APP');
    expect(url.searchParams.get('ch')).toBe('APP');
  });

  it('clears template-only query param values after path substitution', () => {
    const base = makeScenario({
      url: 'https://api.example.com/users/{{userId}}/data?extra={{extra}}',
    });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: '5' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    const url = new URL(resolved.url);
    expect(url.pathname).toContain('/users/5/');
    expect(url.searchParams.get('extra')).toBe('');
  });

  it('clears query params that stay as template tokens after param substitution pass', () => {
    const base = makeScenario({
      url: 'https://api.example.com/data?channel={{channel}}&orphan={{orphan}}',
    });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'channel', type: 'param', mapping: 'channel' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: 'WEB' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    const url = new URL(resolved.url);
    expect(url.searchParams.get('channel')).toBe('WEB');
    expect(url.searchParams.get('orphan')).toBe('');
  });

  it('does not merge param values that are empty or lone placeholder tokens', () => {
    const base = makeScenario({
      url: 'https://api.example.com/data?a={{a}}&b={{b}}',
    });
    const cols: DataSourceColumn[] = [
      { id: 'ca', name: 'a', type: 'param', mapping: 'a' },
      { id: 'cb', name: 'b', type: 'param', mapping: 'b' },
    ];
    const row: DataSourceRow = { id: 'r1', values: { ca: '', cb: '{{nested}}' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    const url = new URL(resolved.url);
    expect(url.searchParams.get('a')).toBe('');
    expect(url.searchParams.get('b')).toBe('');
  });

  it('omits path vars when mapping and name are both blank', () => {
    const base = makeScenario({ url: 'https://api.example.com/users/{{userId}}/x' });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: '', type: 'path', mapping: '' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: '99' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toContain('{{userId}}');
  });

  it('keeps existing validation unorderedArrays when expected fields apply and mode was already unordered', () => {
    const base = makeScenario({
      validation: { mode: 'full', unorderedArrays: true },
    });
    const cols = makeColumns();
    const row = makeRow('r1', '1', 'WEB', '200');
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0, undefined, 'full');
    expect(resolved.validation.unorderedArrays).toBe(true);
  });

  it('selects name over mapping for new query key when mapping key is absent from URL', () => {
    const base = makeScenario({
      url: 'https://api.example.com/data?ch={{ch}}',
    });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'ch', type: 'param', mapping: 'channel' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: 'X' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    const url = new URL(resolved.url);
    expect(url.searchParams.get('ch')).toBe('X');
    expect(url.searchParams.has('channel')).toBe(false);
  });

  it('ignores param mapping when computed query key is blank', () => {
    const base = makeScenario({ url: 'https://api.example.com/data?x=1' });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: '', type: 'param', mapping: '' }];
    const row: DataSourceRow = { id: 'r1', values: { c1: 'oops' }, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.url).toContain('x=1');
  });

  it('uses empty string for header column when row omits that cell', () => {
    const base = makeScenario({ headers: [] });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 't', type: 'header', mapping: 'X-Token' }];
    const row: DataSourceRow = { id: 'r1', values: {}, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.headers).toContainEqual({ key: 'X-Token', value: '' });
  });

  it('substitutes body placeholders with empty string when row omits that cell', () => {
    const base = makeScenario({
      url: 'https://api.example.com/x',
      body: '{"a":"{{a}}"}',
    });
    const cols: DataSourceColumn[] = [{ id: 'c1', name: 'a', type: 'body', mapping: 'a' }];
    const row: DataSourceRow = { id: 'r1', values: {}, enabled: true };
    const resolved = resolveScenarioFromDataRow(base, cols, row, 0);
    expect(resolved.body).toBe('{"a":""}');
  });
});

// ─── expandDataSource ──────────────────────────────────────────

describe('expandDataSource', () => {
  it('returns scenario as-is when no data source', () => {
    const sc = makeScenario();
    const result = expandDataSource(sc);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(sc);
  });

  it('returns scenario as-is when data source has no rows', () => {
    const sc = makeScenario({
      dataSource: makeDataSource({ rows: [] }),
    });
    const result = expandDataSource(sc);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(sc);
  });

  it('returns scenario as-is when data source has no columns', () => {
    const sc = makeScenario({
      dataSource: makeDataSource({ columns: [] }),
    });
    const result = expandDataSource(sc);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(sc);
  });

  it('expands to N scenarios for N enabled rows', () => {
    const dt = makeDataSource(); // 3 rows, 1 disabled
    const sc = makeScenario({ dataSource: dt });
    const result = expandDataSource(sc);
    expect(result).toHaveLength(2); // only enabled rows
  });

  it('returns scenario as-is when all rows are disabled', () => {
    const dt = makeDataSource({
      rows: [
        makeRow('r1', '1', 'A', '', false),
        makeRow('r2', '2', 'B', '', false),
      ],
    });
    const sc = makeScenario({ dataSource: dt });
    const result = expandDataSource(sc);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(sc);
  });

  it('each expanded scenario has correct URL', () => {
    const dt = makeDataSource();
    const sc = makeScenario({ dataSource: dt });
    const result = expandDataSource(sc);

    expect(result[0].url).toContain('/users/42/');
    expect(result[1].url).toContain('/users/99/');
  });

  it('each expanded scenario has unique dataRowId', () => {
    const dt = makeDataSource();
    const sc = makeScenario({ dataSource: dt });
    const result = expandDataSource(sc);

    expect(result[0].dataRowId).toBe('r1');
    expect(result[1].dataRowId).toBe('r2');
  });

  it('preserves sequential distribution by default', () => {
    const dt = makeDataSource();
    const sc = makeScenario({ dataSource: dt });
    const result = expandDataSource(sc);
    // r1 (42) before r2 (99) — sequential order
    expect(result[0].dataRowId).toBe('r1');
    expect(result[1].dataRowId).toBe('r2');
  });

  it('preserves row order for round-robin distribution (single expansion pass)', () => {
    const dt = makeDataSource({ distribution: 'round-robin' });
    const sc = makeScenario({ dataSource: dt });
    const result = expandDataSource(sc);
    expect(result[0].dataRowId).toBe('r1');
    expect(result[1].dataRowId).toBe('r2');
  });

  it('shuffles rows with random distribution', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow(`r${i}`, String(i), 'CH'),
    );
    const dt = makeDataSource({ rows, distribution: 'random' });
    const sc = makeScenario({ dataSource: dt });

    // Run multiple times — at least one should differ from sequential
    const orders = new Set<string>();
    for (let trial = 0; trial < 5; trial++) {
      const result = expandDataSource(sc);
      orders.add(result.map(r => r.dataRowId).join(','));
    }
    // With 20 rows, the chance of all 5 trials being sequential is negligible
    expect(orders.size).toBeGreaterThan(1);
  });
});

// ─── expandQueue ──────────────────────────────────────────────

describe('expandQueue', () => {
  it('passes through non-parameterized scenarios', () => {
    const sc1 = makeScenario({ id: 's1' });
    const sc2 = makeScenario({ id: 's2' });
    const result = expandQueue([sc1, sc2]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(sc1);
    expect(result[1]).toBe(sc2);
  });

  it('expands parameterized scenarios in place', () => {
    const sc1 = makeScenario({ id: 's1' }); // no data source
    const sc2 = makeScenario({
      id: 's2',
      dataSource: makeDataSource(), // 2 enabled rows
    });
    const sc3 = makeScenario({ id: 's3' }); // no data source

    const result = expandQueue([sc1, sc2, sc3]);
    expect(result).toHaveLength(4); // 1 + 2 + 1
    expect(result[0].id).toBe('s1');
    expect(result[1].dataRowId).toBe('r1');
    expect(result[2].dataRowId).toBe('r2');
    expect(result[3].id).toBe('s3');
  });

  it('handles empty queue', () => {
    expect(expandQueue([])).toEqual([]);
  });
});

// ─── Phase 12: Tag filtering tests ───────────────────────────

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

// ─── expandDataSourceWithTags ────────────────────────────────

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

// ─── expandDataSourceWithSubset ──────────────────────────────

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
