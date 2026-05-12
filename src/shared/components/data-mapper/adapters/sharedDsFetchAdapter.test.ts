import { describe, it, expect, vi } from 'vitest';
import {
  createSharedDsFetchAdapter,
  type SharedDsFetchOutput,
} from './sharedDsFetchAdapter';
import type { DataSource, DataSourceColumn, SharedDataSourceFetchConfig } from '../../../types';
import type { Mapping } from '../types';

// ── Fixtures ──────────────────────────────────────────────

const SAMPLE_RESPONSE = {
  results: [
    { id: '1', name: 'Alice', email: 'alice@test.com', status: 'active' },
    { id: '2', name: 'Bob', email: 'bob@test.com', status: 'inactive' },
    { id: '3', name: 'Carol', email: 'carol@test.com', status: 'active' },
  ],
  meta: { total: 3 },
};

const ROOT_ARRAY_RESPONSE = [
  { vin: 'V001', channel: 'web' },
  { vin: 'V002', channel: 'mobile' },
];

function makeDataSource(overrides?: Partial<DataSource>): DataSource {
  return {
    id: 'ds-1',
    columns: [],
    rows: [],
    source: { type: 'inline' },
    ...overrides,
  };
}

function makeColumn(overrides?: Partial<DataSourceColumn>): DataSourceColumn {
  return {
    id: 'col-1',
    name: 'VIN',
    type: 'path',
    mapping: 'vin',
    ...overrides,
  };
}

function makeFetchConfig(overrides?: Partial<SharedDataSourceFetchConfig>): SharedDataSourceFetchConfig {
  return {
    url: 'https://api.example.com/v1/vehicles',
    method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json' }],
    ...overrides,
  };
}

const SOURCE_ID = 'shared-ds-response';

const MAPPINGS: Mapping[] = [
  { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'id', targetPath: 'ID' },
  { id: 'sdf-1', sourceId: SOURCE_ID, sourcePath: 'name', targetPath: 'Name' },
  { id: 'sdf-2', sourceId: SOURCE_ID, sourcePath: 'email', targetPath: 'Email' },
];

// ── Adapter creation ──────────────────────────────────────

describe('createSharedDsFetchAdapter', () => {
  it('creates an adapter with correct contextId and category', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.contextId).toBe('shared-ds-fetch');
    expect(adapter.category).toBe('data-source');
  });

  it('builds title from fetchConfig URL', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchConfig: makeFetchConfig(),
    });
    expect(adapter.title).toBe('GET /v1/vehicles → Data Source');
  });

  it('builds title with POST method', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchConfig: makeFetchConfig({ method: 'POST', url: 'https://api.example.com/search' }),
    });
    expect(adapter.title).toBe('POST /search → Data Source');
  });

  it('builds fallback title when no fetchConfig', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.title).toBe('Shared DS API → Data Source');
  });

  it('builds fallback title for empty URL', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchConfig: makeFetchConfig({ url: '' }),
    });
    expect(adapter.title).toBe('Shared DS API → Data Source');
  });

  it('sets source sampleData from first array item', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    expect(adapter.sources[0].sampleData).toEqual(SAMPLE_RESPONSE.results[0]);
  });

  it('uses undefined sampleData when no response', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.sources[0].sampleData).toBeUndefined();
  });

  it('uses correct source ID and label', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.sources[0].id).toBe(SOURCE_ID);
    expect(adapter.sources[0].label).toBe('Shared DS API Response');
  });

  it('auto-selects the best (largest) array path', () => {
    const response = {
      items: [{ a: 1 }],
      results: [{ b: 1 }, { b: 2 }, { b: 3 }],
    };
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
    });
    expect(adapter.selectedArrayPath).toBe('results');
  });

  it('uses explicit selectedArrayPath over auto-detection', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    expect(adapter.selectedArrayPath).toBe('results');
  });

  it('detects arrays in the response', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
    });
    expect(adapter.detectedArrays).toHaveLength(1);
    expect(adapter.detectedArrays[0].path).toBe('results');
    expect(adapter.detectedArrays[0].length).toBe(3);
  });

  it('returns empty detectedArrays when no response', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.detectedArrays).toEqual([]);
  });

  it('builds target fields from existing columns', () => {
    const ds = makeDataSource({
      columns: [
        makeColumn({ id: 'c1', name: 'VIN', type: 'path', mapping: 'vin' }),
        makeColumn({ id: 'c2', name: 'Channel', type: 'validate', mapping: 'channel' }),
      ],
    });
    const adapter = createSharedDsFetchAdapter({ dataSource: ds });
    expect(adapter.target.fields).toHaveLength(2);
    expect(adapter.target.fields![0].path).toBe('VIN');
    expect(adapter.target.fields![0].label).toContain('Path Variable');
    expect(adapter.target.fields![1].label).toContain('Validate Field');
  });

  it('sets supportsLiveFetch when fetchSampleData provided', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchSampleData: async () => ({}),
    });
    expect(adapter.sources[0].supportsLiveFetch).toBe(true);
  });

  it('does not set supportsLiveFetch when no fetchSampleData', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.sources[0].supportsLiveFetch).toBe(false);
  });

  it('defaults mode to append', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.mode).toBe('append');
  });

  it('respects explicit mode', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      mode: 'replace',
    });
    expect(adapter.mode).toBe('replace');
  });

  it('allows custom target fields', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.target.allowCustomFields).toBe(true);
  });

  it('handles root-level array response ($)', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: ROOT_ARRAY_RESPONSE,
      selectedArrayPath: '$',
    });
    expect(adapter.sources[0].sampleData).toEqual(ROOT_ARRAY_RESPONSE[0]);
  });

  it('exposes getResponseJson for pre-fetched response', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
    });
    expect(adapter.getResponseJson()).toEqual(SAMPLE_RESPONSE);
  });

  it('returns null from getResponseJson when no response', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.getResponseJson()).toBeNull();
  });
});

// ── Serialize ─────────────────────────────────────────────

describe('serialize', () => {
  it('creates columns and rows from mappings', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });

    const output = adapter.serialize(MAPPINGS);

    expect(output.columns).toHaveLength(3);
    expect(output.columns[0].name).toBe('ID');
    expect(output.columns[1].name).toBe('Name');
    expect(output.columns[2].name).toBe('Email');

    expect(output.rows).toHaveLength(3);
    const firstRow = output.rows[0];
    const idColId = output.columns.find(c => c.name === 'ID')!.id;
    const nameColId = output.columns.find(c => c.name === 'Name')!.id;
    expect(firstRow.values[idColId]).toBe('1');
    expect(firstRow.values[nameColId]).toBe('Alice');
    expect(firstRow.enabled).toBe(true);
  });

  it('reuses existing columns when matching', () => {
    const existingCol = makeColumn({ id: 'existing-id', name: 'id', type: 'path', mapping: 'id' });
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource({ columns: [existingCol] }),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });

    const output = adapter.serialize(MAPPINGS);
    const idCol = output.columns.find(c => c.name === 'id' || c.name === 'ID');
    expect(idCol).toBeDefined();
    expect(output.columns.length).toBeLessThanOrEqual(4);
  });

  it('preserves existing column definitions', () => {
    const existingCol = makeColumn({ id: 'keep-me', name: 'ExistingCol', type: 'body', mapping: 'keep' });
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource({ columns: [existingCol] }),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });

    const output = adapter.serialize(MAPPINGS);
    expect(output.columns[0]).toEqual(existingCol);
  });

  it('fills baseline values from first enabled row', () => {
    const existingCol = makeColumn({ id: 'keep-me', name: 'Existing', type: 'body', mapping: 'keep' });
    const baselineRow = { id: 'r1', values: { 'keep-me': 'baseline-val' }, enabled: true };
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource({ columns: [existingCol], rows: [baselineRow] }),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });

    const output = adapter.serialize(MAPPINGS);
    expect(output.rows[0].values['keep-me']).toBe('baseline-val');
  });

  it('returns mode in output', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
      mode: 'replace',
    });
    const output = adapter.serialize(MAPPINGS);
    expect(output.mode).toBe('replace');
  });

  it('returns empty rows when no mappings', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    const output = adapter.serialize([]);
    expect(output.rows).toEqual([]);
  });

  it('returns empty rows when no response JSON', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
    });
    const output = adapter.serialize(MAPPINGS);
    expect(output.rows).toEqual([]);
  });

  it('assigns path type for id-like fields via guessColType', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    const output = adapter.serialize(MAPPINGS);
    const idCol = output.columns.find(c => c.name === 'ID');
    expect(idCol?.type).toBe('path');
  });

  it('assigns validate type for non-id fields via guessColType', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    const output = adapter.serialize(MAPPINGS);
    const nameCol = output.columns.find(c => c.name === 'Name');
    expect(nameCol?.type).toBe('validate');
  });

  it('stringifies object values in cells', () => {
    const response = { items: [{ name: 'Alice', meta: { score: 100 } }] };
    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'meta', targetPath: 'Meta' },
    ];
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
      selectedArrayPath: 'items',
    });
    const output = adapter.serialize(mappings);
    const metaColId = output.columns.find(c => c.name === 'Meta')!.id;
    expect(output.rows[0].values[metaColId]).toBe('{"score":100}');
  });

  it('handles null values as empty string', () => {
    const response = { items: [{ name: null }] };
    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'name', targetPath: 'Name' },
    ];
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
      selectedArrayPath: 'items',
    });
    const output = adapter.serialize(mappings);
    const colId = output.columns.find(c => c.name === 'Name')!.id;
    expect(output.rows[0].values[colId]).toBe('');
  });

  it('handles root array ($) response', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: ROOT_ARRAY_RESPONSE,
      selectedArrayPath: '$',
    });
    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'vin', targetPath: 'VIN' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.rows).toHaveLength(2);
    const vinColId = output.columns.find(c => c.name === 'VIN')!.id;
    expect(output.rows[0].values[vinColId]).toBe('V001');
    expect(output.rows[1].values[vinColId]).toBe('V002');
  });

  it('generates unique row IDs', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    const output = adapter.serialize(MAPPINGS);
    const ids = output.rows.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves nested dotted source paths via getByPath', () => {
    const response = {
      items: [
        { address: { city: 'NYC', zip: '10001' } },
        { address: { city: 'LA', zip: '90001' } },
      ],
    };
    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'address.city', targetPath: 'City' },
      { id: 'sdf-1', sourceId: SOURCE_ID, sourcePath: 'address.zip', targetPath: 'Zip' },
    ];
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
      selectedArrayPath: 'items',
    });
    const output = adapter.serialize(mappings);
    const cityColId = output.columns.find(c => c.name === 'City')!.id;
    const zipColId = output.columns.find(c => c.name === 'Zip')!.id;
    expect(output.rows[0].values[cityColId]).toBe('NYC');
    expect(output.rows[0].values[zipColId]).toBe('10001');
    expect(output.rows[1].values[cityColId]).toBe('LA');
    expect(output.rows[1].values[zipColId]).toBe('90001');
  });
});

// ── Deserialize ───────────────────────────────────────────

describe('deserialize', () => {
  it('reconstructs mappings from columns with mapping values', () => {
    const output: SharedDsFetchOutput = {
      columns: [
        makeColumn({ id: 'c1', name: 'ID', type: 'path', mapping: 'id' }),
        makeColumn({ id: 'c2', name: 'Name', type: 'validate', mapping: 'name' }),
      ],
      rows: [],
      mode: 'append',
    };
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const mappings = adapter.deserialize(output);

    expect(mappings).toHaveLength(2);
    expect(mappings[0].sourceId).toBe(SOURCE_ID);
    expect(mappings[0].sourcePath).toBe('id');
    expect(mappings[0].targetPath).toBe('ID');
    expect(mappings[1].sourcePath).toBe('name');
    expect(mappings[1].targetPath).toBe('Name');
  });

  it('skips columns with empty mapping', () => {
    const output: SharedDsFetchOutput = {
      columns: [
        makeColumn({ id: 'c1', name: 'Manual', type: 'body', mapping: '' }),
        makeColumn({ id: 'c2', name: 'WithMapping', type: 'validate', mapping: 'field' }),
      ],
      rows: [],
      mode: 'append',
    };
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const mappings = adapter.deserialize(output);

    expect(mappings).toHaveLength(1);
    expect(mappings[0].targetPath).toBe('WithMapping');
  });

  it('returns empty array for null/undefined input', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.deserialize(null as unknown as SharedDsFetchOutput)).toEqual([]);
    expect(adapter.deserialize(undefined as unknown as SharedDsFetchOutput)).toEqual([]);
  });

  it('returns empty array for empty columns', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.deserialize({ columns: [], rows: [], mode: 'append' })).toEqual([]);
  });

  it('generates stable IDs (sdf-N pattern)', () => {
    const output: SharedDsFetchOutput = {
      columns: [
        makeColumn({ id: 'c1', name: 'A', type: 'path', mapping: 'a' }),
        makeColumn({ id: 'c2', name: 'B', type: 'validate', mapping: 'b' }),
      ],
      rows: [],
      mode: 'append',
    };
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const mappings = adapter.deserialize(output);
    expect(mappings[0].id).toBe('sdf-0');
    expect(mappings[1].id).toBe('sdf-1');
  });
});

// ── Round-trip ────────────────────────────────────────────

describe('round-trip (serialize → deserialize)', () => {
  it('preserves mapping structure through round-trip', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });

    const output = adapter.serialize(MAPPINGS);
    const roundTripped = adapter.deserialize(output);

    expect(roundTripped).toHaveLength(3);
    expect(roundTripped[0].sourcePath).toBe('id');
    expect(roundTripped[0].targetPath).toBe('ID');
    expect(roundTripped[1].sourcePath).toBe('name');
    expect(roundTripped[1].targetPath).toBe('Name');
    expect(roundTripped[2].sourcePath).toBe('email');
    expect(roundTripped[2].targetPath).toBe('Email');
  });

  it('round-trip with fetchConfig preserves data', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchConfig: makeFetchConfig({ method: 'POST' }),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });

    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'id', targetPath: 'VehicleId' },
    ];
    const output = adapter.serialize(mappings);
    const roundTripped = adapter.deserialize(output);

    expect(roundTripped).toHaveLength(1);
    expect(roundTripped[0].sourcePath).toBe('id');
    expect(roundTripped[0].targetPath).toBe('VehicleId');
  });
});

// ── Validate ──────────────────────────────────────────────

describe('validate', () => {
  it('returns no issues for valid mappings with response', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    const issues = adapter.validate!(MAPPINGS);
    expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('warns when no mappings', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const issues = adapter.validate!([]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('No fields mapped');
  });

  it('reports error for empty targetPath', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const issues = adapter.validate!([
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'id', targetPath: '' },
    ]);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('Column name is required'))).toBe(true);
  });

  it('reports error for empty sourcePath', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const issues = adapter.validate!([
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: '', targetPath: 'Name' },
    ]);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('Source field is empty'))).toBe(true);
  });

  it('reports error for duplicate targetPath', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const issues = adapter.validate!([
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'id', targetPath: 'Name' },
      { id: 'sdf-1', sourceId: SOURCE_ID, sourcePath: 'name', targetPath: 'Name' },
    ]);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('Duplicate column name'))).toBe(true);
  });

  it('reports error when no response JSON (blocks save)', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    const issues = adapter.validate!(MAPPINGS);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('Fetch an API response'))).toBe(true);
  });

  it('does not report fetch error when response JSON present', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: SAMPLE_RESPONSE,
      selectedArrayPath: 'results',
    });
    const issues = adapter.validate!(MAPPINGS);
    expect(issues.some(i => i.message.includes('Fetch an API response'))).toBe(false);
  });
});

// ── fetchSampleData ───────────────────────────────────────

describe('fetchSampleData', () => {
  it('delegates to provided callback and returns first array item', async () => {
    const response = { items: [{ x: 1, y: 2 }, { x: 3, y: 4 }] };
    const fetchFn = vi.fn().mockResolvedValue(response);
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchSampleData: fetchFn,
    });
    const result = await adapter.fetchSampleData!();
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it('stores fetched response for serialize', async () => {
    const response = { items: [{ a: 'val1' }, { a: 'val2' }] };
    const fetchFn = vi.fn().mockResolvedValue(response);
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchSampleData: fetchFn,
    });

    await adapter.fetchSampleData!();
    expect(adapter.getResponseJson()).toEqual(response);
    expect(adapter.selectedArrayPath).toBe('items');
    expect(adapter.detectedArrays).toHaveLength(1);

    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'a', targetPath: 'A' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.rows).toHaveLength(2);
    const colId = output.columns.find(c => c.name === 'A')!.id;
    expect(output.rows[0].values[colId]).toBe('val1');
    expect(output.rows[1].values[colId]).toBe('val2');
  });

  it('auto-selects best array after fetch', async () => {
    const response = {
      small: [{ x: 1 }],
      large: [{ y: 1 }, { y: 2 }, { y: 3 }],
    };
    const fetchFn = vi.fn().mockResolvedValue(response);
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchSampleData: fetchFn,
    });
    await adapter.fetchSampleData!();
    expect(adapter.selectedArrayPath).toBe('large');
  });

  it('returns undefined when response has no arrays', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ scalar: 42 });
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchSampleData: fetchFn,
    });
    const result = await adapter.fetchSampleData!();
    expect(result).toBeUndefined();
    expect(adapter.selectedArrayPath).toBe('');
  });

  it('is undefined when no callback provided', () => {
    const adapter = createSharedDsFetchAdapter({ dataSource: makeDataSource() });
    expect(adapter.fetchSampleData).toBeUndefined();
  });

  it('works with fetchConfig context for auth-aware fetch delegation', async () => {
    const response = { vehicles: [{ vin: 'V001', make: 'Toyota' }] };
    const fetchFn = vi.fn().mockResolvedValue(response);
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchConfig: makeFetchConfig({
        auth: { type: 'bearer', token: 'test-token' },
        pathVariables: [{ segmentIndex: 2, variableName: 'orgId' }],
      }),
      fetchSampleData: fetchFn,
    });

    await adapter.fetchSampleData!();
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(adapter.selectedArrayPath).toBe('vehicles');

    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'vin', targetPath: 'VIN' },
      { id: 'sdf-1', sourceId: SOURCE_ID, sourcePath: 'make', targetPath: 'Make' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.rows).toHaveLength(1);
    const vinColId = output.columns.find(c => c.name === 'VIN')!.id;
    expect(output.rows[0].values[vinColId]).toBe('V001');
  });
});

// ── Edge cases ────────────────────────────────────────────

describe('edge cases', () => {
  it('handles response with multiple nested arrays', () => {
    const response = {
      users: [{ id: 1 }],
      orders: [{ id: 10 }, { id: 11 }],
      deep: { nested: { items: [{ a: 'x' }, { a: 'y' }, { a: 'z' }] } },
    };
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
    });
    expect(adapter.detectedArrays).toHaveLength(3);
    expect(adapter.selectedArrayPath).toBe('deep.nested.items');
  });

  it('handles empty array in response', () => {
    const response = { items: [] };
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
    });
    expect(adapter.detectedArrays).toEqual([]);
    expect(adapter.selectedArrayPath).toBe('');
  });

  it('handles response with no arrays', () => {
    const response = { name: 'test', value: 42 };
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
    });
    expect(adapter.detectedArrays).toEqual([]);
  });

  it('handles array items with missing fields gracefully', () => {
    const response = {
      items: [
        { a: 1, b: 2 },
        { a: 3 },
      ],
    };
    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'a', targetPath: 'A' },
      { id: 'sdf-1', sourceId: SOURCE_ID, sourcePath: 'b', targetPath: 'B' },
    ];
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
      selectedArrayPath: 'items',
    });
    const output = adapter.serialize(mappings);
    expect(output.rows).toHaveLength(2);
    const bColId = output.columns.find(c => c.name === 'B')!.id;
    expect(output.rows[1].values[bColId]).toBe('');
  });

  it('filters out non-object items from array', () => {
    const response = {
      items: [{ a: 1 }, null, 'string', { a: 2 }],
    };
    const mappings: Mapping[] = [
      { id: 'sdf-0', sourceId: SOURCE_ID, sourcePath: 'a', targetPath: 'A' },
    ];
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: response,
      selectedArrayPath: 'items',
    });
    const output = adapter.serialize(mappings);
    expect(output.rows).toHaveLength(2);
  });

  it('contextId is distinct from populate-from-api', () => {
    const ds = makeDataSource();
    const shared = createSharedDsFetchAdapter({ dataSource: ds });
    expect(shared.contextId).toBe('shared-ds-fetch');
    expect(shared.contextId).not.toBe('populate-from-api');
  });

  it('title falls back to method + API when URL is invalid', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchConfig: { url: 'http://[invalid', method: 'POST', headers: {}, body: '' },
    });
    expect(adapter.title).toBe('POST API → Data Source');
  });

  it('title defaults to GET when fetchConfig has url but no method', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchConfig: { url: '/api/v1/items', headers: {}, body: '' },
    });
    expect(adapter.title).toBe('GET /api/v1/items → Data Source');
  });

  it('fetchSampleData handles null response from callback', async () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      fetchSampleData: async () => null,
    });
    const result = await adapter.fetchSampleData!();
    expect(result).toBeUndefined();
  });

  it('validate reports no-array-path when response exists but arrayPath is undefined', () => {
    const adapter = createSharedDsFetchAdapter({
      dataSource: makeDataSource(),
      responseJson: { data: 'not array' },
      selectedArrayPath: undefined,
    });
    const mappings: Mapping[] = [
      { id: 'v1', sourceId: 'shared-ds-fetch-response', sourcePath: 'data', targetPath: 'Col' },
    ];
    const issues = adapter.validate(mappings);
    expect(issues.some(i => i.message.includes('No array found'))).toBe(true);
  });
});
