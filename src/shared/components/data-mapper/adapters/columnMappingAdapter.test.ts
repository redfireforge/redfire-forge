import { describe, it, expect } from 'vitest';
import {
  createColumnMappingAdapter,
  parseScenarioTemplate,
  type ColumnMappingOutput,
} from './columnMappingAdapter';
import type { Mapping } from '../types';
import type { DataSourceColumn, Scenario } from '../../../types';

// ─── Test helpers ────────────────────────────────────────────

function makeColumn(overrides: Partial<DataSourceColumn> & { id: string; name: string }): DataSourceColumn {
  return {
    type: 'path',
    mapping: '',
    ...overrides,
  };
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test-scenario',
    name: 'Test Scenario',
    url: 'https://api.example.com/vehicles/{{vin}}/status?channel={{channel}}',
    method: 'GET',
    headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

const COLUMNS: DataSourceColumn[] = [
  makeColumn({ id: 'c1', name: 'VIN', type: 'path', mapping: 'vin' }),
  makeColumn({ id: 'c2', name: 'Channel', type: 'param', mapping: 'channel' }),
  makeColumn({ id: 'c3', name: 'Token', type: 'header', mapping: 'token' }),
  makeColumn({ id: 'c4', name: 'Status', type: 'validate', mapping: '$.status' }),
];

const MAPPINGS: Mapping[] = [
  { id: 'colmap-0', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::vin' },
  { id: 'colmap-1', sourceId: 'data-source-columns', sourcePath: 'c2', targetPath: 'param::channel' },
  { id: 'colmap-2', sourceId: 'data-source-columns', sourcePath: 'c3', targetPath: 'header::token' },
  { id: 'colmap-3', sourceId: 'data-source-columns', sourcePath: 'c4', targetPath: 'validate::$.status' },
];

// ─── parseScenarioTemplate ───────────────────────────────────

describe('parseScenarioTemplate', () => {
  it('extracts path variables from URL path', () => {
    const scenario = makeScenario({ url: 'https://api.com/vehicles/{{vin}}/details' });
    const slots = parseScenarioTemplate(scenario);
    const pathSlots = slots.filter(s => s.type === 'path');
    expect(pathSlots).toHaveLength(1);
    expect(pathSlots[0].name).toBe('vin');
    expect(pathSlots[0].targetPath).toBe('path::vin');
  });

  it('extracts query param placeholders', () => {
    const scenario = makeScenario({ url: 'https://api.com/data?channel={{channel}}&limit=10' });
    const slots = parseScenarioTemplate(scenario);
    const paramSlots = slots.filter(s => s.type === 'param');
    expect(paramSlots).toHaveLength(1);
    expect(paramSlots[0].name).toBe('channel');
  });

  it('extracts body placeholders', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      body: '{"name": "{{userName}}", "email": "{{userEmail}}"}',
    });
    const slots = parseScenarioTemplate(scenario);
    const bodySlots = slots.filter(s => s.type === 'body');
    expect(bodySlots).toHaveLength(2);
    expect(bodySlots.map(s => s.name).sort()).toEqual(['userEmail', 'userName']);
  });

  it('extracts header placeholders', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      headers: [
        { key: 'Authorization', value: 'Bearer {{token}}' },
        { key: 'X-Request-Id', value: '{{requestId}}' },
      ],
    });
    const slots = parseScenarioTemplate(scenario);
    const headerSlots = slots.filter(s => s.type === 'header');
    expect(headerSlots).toHaveLength(2);
    expect(headerSlots.map(s => s.name).sort()).toEqual(['requestId', 'token']);
  });

  it('extracts all types from a complex scenario', () => {
    const scenario = makeScenario({
      url: 'https://api.com/vehicles/{{vin}}/status?channel={{channel}}',
      body: '{"payload": "{{data}}"}',
      headers: [{ key: 'Auth', value: '{{token}}' }],
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots).toHaveLength(4);
    expect(slots.find(s => s.name === 'vin')?.type).toBe('path');
    expect(slots.find(s => s.name === 'channel')?.type).toBe('param');
    expect(slots.find(s => s.name === 'data')?.type).toBe('body');
    expect(slots.find(s => s.name === 'token')?.type).toBe('header');
  });

  it('deduplicates same variable in same category', () => {
    const scenario = makeScenario({
      url: 'https://api.com/{{vin}}/{{vin}}/data',
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.filter(s => s.name === 'vin')).toHaveLength(1);
  });

  it('handles URL-encoded braces', () => {
    const scenario = makeScenario({
      url: 'https://api.com/vehicles/%7B%7Bvin%7D%7D/status',
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.some(s => s.name === 'vin')).toBe(true);
  });

  it('handles non-parseable URL (no protocol)', () => {
    const scenario = makeScenario({
      url: '{{host}}/api/{{vin}}/data',
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.some(s => s.name === 'host')).toBe(true);
    expect(slots.some(s => s.name === 'vin')).toBe(true);
  });

  it('returns empty for scenario with no templates', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      body: '{"static": true}',
      headers: [{ key: 'Accept', value: 'application/json' }],
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots).toHaveLength(0);
  });

  it('handles empty URL', () => {
    const scenario = makeScenario({ url: '', headers: [], body: '' });
    const slots = parseScenarioTemplate(scenario);
    expect(slots).toHaveLength(0);
  });

  it('handles whitespace inside template tokens', () => {
    const scenario = makeScenario({
      url: 'https://api.com/{{ vin }}/status',
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.some(s => s.name === 'vin')).toBe(true);
  });

  it('keeps same var in different categories as separate slots', () => {
    const scenario = makeScenario({
      url: 'https://api.com/{{id}}/data',
      body: '{"ref": "{{id}}"}',
    });
    const slots = parseScenarioTemplate(scenario);
    const idSlots = slots.filter(s => s.name === 'id');
    expect(idSlots).toHaveLength(2);
    expect(idSlots.map(s => s.type).sort()).toEqual(['body', 'path']);
  });

  it('ignores empty body and headers', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      body: '',
      headers: [],
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots).toHaveLength(0);
  });

  it('handles multiple placeholders in one header value', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      headers: [{ key: 'Auth', value: '{{scheme}} {{credential}}' }],
    });
    const slots = parseScenarioTemplate(scenario);
    const headerSlots = slots.filter(s => s.type === 'header');
    expect(headerSlots).toHaveLength(2);
    expect(headerSlots.map(s => s.name).sort()).toEqual(['credential', 'scheme']);
  });

  it('extracts bodyForm placeholders', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      body: '',
      headers: [],
      bodyForm: [
        { key: 'name', value: '{{userName}}' },
        { key: 'email', value: '{{userEmail}}' },
      ],
    });
    const slots = parseScenarioTemplate(scenario);
    const bodySlots = slots.filter(s => s.type === 'body');
    expect(bodySlots).toHaveLength(2);
    expect(bodySlots.map(s => s.name).sort()).toEqual(['userEmail', 'userName']);
  });

  it('deduplicates body and bodyForm placeholders', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      body: '{"name": "{{userName}}"}',
      headers: [],
      bodyForm: [{ key: 'name', value: '{{userName}}' }],
    });
    const slots = parseScenarioTemplate(scenario);
    const bodySlots = slots.filter(s => s.type === 'body');
    expect(bodySlots).toHaveLength(1);
    expect(bodySlots[0].name).toBe('userName');
  });

  it('categorizes query tokens as param in non-parseable URL', () => {
    const scenario = makeScenario({
      url: '{{host}}/api/{{vin}}?channel={{channel}}',
      body: '',
      headers: [],
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.find(s => s.name === 'host')?.type).toBe('path');
    expect(slots.find(s => s.name === 'vin')?.type).toBe('path');
    expect(slots.find(s => s.name === 'channel')?.type).toBe('param');
  });

  it('assigns location: path for path variables', () => {
    const scenario = makeScenario({ url: 'https://api.com/vehicles/{{vin}}/details' });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.find(s => s.name === 'vin')?.location).toBe('path');
  });

  it('assigns location: query for query param placeholders', () => {
    const scenario = makeScenario({ url: 'https://api.com/data?channel={{channel}}&limit=10' });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.find(s => s.name === 'channel')?.location).toBe('query');
  });

  it('assigns location: body for body placeholders', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      body: '{"name": "{{userName}}"}',
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.find(s => s.name === 'userName')?.location).toBe('body');
  });

  it('assigns location: header for header placeholders', () => {
    const scenario = makeScenario({
      url: 'https://api.com/data',
      headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.find(s => s.name === 'token')?.location).toBe('header');
  });

  it('mixed scenario assigns correct locations to all slots', () => {
    const scenario = makeScenario({
      url: 'https://api.com/{{vin}}?channel={{channel}}',
      body: '{"payload": "{{data}}"}',
      headers: [{ key: 'Auth', value: '{{token}}' }],
    });
    const slots = parseScenarioTemplate(scenario);
    expect(slots.find(s => s.name === 'vin')?.location).toBe('path');
    expect(slots.find(s => s.name === 'channel')?.location).toBe('query');
    expect(slots.find(s => s.name === 'data')?.location).toBe('body');
    expect(slots.find(s => s.name === 'token')?.location).toBe('header');
  });
});

// ─── Adapter creation ────────────────────────────────────────

describe('createColumnMappingAdapter', () => {
  it('creates adapter with correct contextId', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.contextId).toBe('column-mapping');
  });

  it('creates adapter with correct title', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.title).toBe('Columns → Request Template');
  });

  it('creates adapter with data-source category', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.category).toBe('data-source');
  });

  it('creates source from column ids with name values', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.sources).toHaveLength(1);
    expect(adapter.sources[0].id).toBe('data-source-columns');
    const sample = adapter.sources[0].sampleData as Record<string, string>;
    expect(Object.keys(sample)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(sample['c1']).toBe('VIN');
    expect(sample['c2']).toBe('Channel');
  });

  it('does not support live fetch', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.sources[0].supportsLiveFetch).toBe(false);
    expect(adapter.fetchSampleData).toBeUndefined();
  });

  it('creates target fields from scenario template', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.target.fields).toBeDefined();
    expect(adapter.target.fields!.length).toBeGreaterThan(0);
    const pathField = adapter.target.fields!.find(f => f.path === 'path::vin');
    expect(pathField).toBeDefined();
    expect(pathField!.label).toBe('vin (URL Path)');
  });

  it('target fields include location tags', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const pathField = adapter.target.fields!.find(f => f.path === 'path::vin');
    expect(pathField!.location).toBe('path');
    const paramField = adapter.target.fields!.find(f => f.path === 'param::channel');
    expect(paramField!.location).toBe('query');
  });

  it('allows custom target fields', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.target.allowCustomFields).toBe(true);
  });

  it('adds validate catch-all when no validate slots exist', () => {
    const scenario = makeScenario({
      url: 'https://api.com/{{vin}}',
      body: '',
      headers: [],
    });
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario });
    const validateFields = adapter.target.fields!.filter(f => f.type === 'validate');
    expect(validateFields).toHaveLength(1);
    expect(validateFields[0].path).toBe('validate::__custom__');
  });

  it('handles empty columns', () => {
    const adapter = createColumnMappingAdapter({ columns: [], scenario: makeScenario() });
    expect(adapter.sources[0].sampleData).toEqual({});
  });
});

// ─── Serialize ───────────────────────────────────────────────

describe('serialize', () => {
  it('updates column type and mapping from mappings', () => {
    const cols = [
      makeColumn({ id: 'c1', name: 'VIN', type: 'path', mapping: '' }),
      makeColumn({ id: 'c2', name: 'Channel', type: 'path', mapping: '' }),
    ];
    const adapter = createColumnMappingAdapter({ columns: cols, scenario: makeScenario() });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::vin' },
      { id: 'm2', sourceId: 'data-source-columns', sourcePath: 'c2', targetPath: 'param::channel' },
    ];
    const output = adapter.serialize(mappings);
    expect(output[0].type).toBe('path');
    expect(output[0].mapping).toBe('vin');
    expect(output[1].type).toBe('param');
    expect(output[1].mapping).toBe('channel');
  });

  it('preserves unmapped columns', () => {
    const cols = [
      makeColumn({ id: 'c1', name: 'VIN', type: 'path', mapping: 'vin' }),
      makeColumn({ id: 'c2', name: 'Extra', type: 'body', mapping: 'extra' }),
    ];
    const adapter = createColumnMappingAdapter({ columns: cols, scenario: makeScenario() });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::vin' },
    ];
    const output = adapter.serialize(mappings);
    expect(output[1]).toEqual(cols[1]);
  });

  it('sets correct type for each target category', () => {
    const cols = [
      makeColumn({ id: 'c1', name: 'A' }),
      makeColumn({ id: 'c2', name: 'B' }),
      makeColumn({ id: 'c3', name: 'C' }),
      makeColumn({ id: 'c4', name: 'D' }),
      makeColumn({ id: 'c5', name: 'E' }),
    ];
    const scenario = makeScenario({
      url: 'https://api.com/{{pathVar}}?q={{paramVar}}',
      body: '{{bodyVar}}',
      headers: [{ key: 'H', value: '{{headerVar}}' }],
    });
    const adapter = createColumnMappingAdapter({ columns: cols, scenario });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::pathVar' },
      { id: 'm2', sourceId: 'data-source-columns', sourcePath: 'c2', targetPath: 'param::paramVar' },
      { id: 'm3', sourceId: 'data-source-columns', sourcePath: 'c3', targetPath: 'body::bodyVar' },
      { id: 'm4', sourceId: 'data-source-columns', sourcePath: 'c4', targetPath: 'header::headerVar' },
      { id: 'm5', sourceId: 'data-source-columns', sourcePath: 'c5', targetPath: 'validate::$.status' },
    ];
    const output = adapter.serialize(mappings);
    expect(output[0].type).toBe('path');
    expect(output[1].type).toBe('param');
    expect(output[2].type).toBe('body');
    expect(output[3].type).toBe('header');
    expect(output[4].type).toBe('validate');
  });

  it('returns original columns when mappings are empty', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const output = adapter.serialize([]);
    expect(output).toEqual(COLUMNS);
  });

  it('handles __custom__ validate target by preserving existing mapping', () => {
    const cols = [makeColumn({ id: 'c1', name: 'MyVal', type: 'path', mapping: '$.response.code' })];
    const adapter = createColumnMappingAdapter({ columns: cols, scenario: makeScenario() });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'validate::__custom__' },
    ];
    const output = adapter.serialize(mappings);
    expect(output[0].type).toBe('validate');
    expect(output[0].mapping).toBe('$.response.code');
  });

  it('preserves column id and other properties', () => {
    const cols = [makeColumn({ id: 'c1', name: 'VIN', type: 'path', mapping: '', description: 'Vehicle ID' })];
    const adapter = createColumnMappingAdapter({ columns: cols, scenario: makeScenario() });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::vin' },
    ];
    const output = adapter.serialize(mappings);
    expect(output[0].id).toBe('c1');
    expect(output[0].description).toBe('Vehicle ID');
  });

  it('ignores mappings with invalid target paths', () => {
    const cols = [makeColumn({ id: 'c1', name: 'VIN', type: 'path', mapping: 'old' })];
    const adapter = createColumnMappingAdapter({ columns: cols, scenario: makeScenario() });
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'invalid-no-separator' },
    ];
    const output = adapter.serialize(mappings);
    expect(output[0].type).toBe('path');
    expect(output[0].mapping).toBe('old');
  });
});

// ─── Deserialize ─────────────────────────────────────────────

describe('deserialize', () => {
  it('reconstructs mappings from columns with mapping values', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const mappings = adapter.deserialize(COLUMNS);
    expect(mappings).toHaveLength(4);
    expect(mappings[0].sourcePath).toBe('c1');
    expect(mappings[0].targetPath).toBe('path::vin');
    expect(mappings[1].sourcePath).toBe('c2');
    expect(mappings[1].targetPath).toBe('param::channel');
    expect(mappings[2].sourcePath).toBe('c3');
    expect(mappings[2].targetPath).toBe('header::token');
    expect(mappings[3].sourcePath).toBe('c4');
    expect(mappings[3].targetPath).toBe('validate::$.status');
  });

  it('skips columns without mapping', () => {
    const cols = [
      makeColumn({ id: 'c1', name: 'VIN', type: 'path', mapping: 'vin' }),
      makeColumn({ id: 'c2', name: 'Unmapped', type: 'path', mapping: '' }),
    ];
    const adapter = createColumnMappingAdapter({ columns: cols, scenario: makeScenario() });
    const mappings = adapter.deserialize(cols);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].sourcePath).toBe('c1');
  });

  it('generates stable mapping ids', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const mappings = adapter.deserialize(COLUMNS);
    expect(mappings.map(m => m.id)).toEqual(['colmap-0', 'colmap-1', 'colmap-2', 'colmap-3']);
  });

  it('sets correct sourceId', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const mappings = adapter.deserialize(COLUMNS);
    for (const m of mappings) {
      expect(m.sourceId).toBe('data-source-columns');
    }
  });

  it('handles empty input', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.deserialize([])).toEqual([]);
  });

  it('handles null/undefined input', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    expect(adapter.deserialize(null as unknown as ColumnMappingOutput)).toEqual([]);
  });
});

// ─── Round-trip ──────────────────────────────────────────────

describe('round-trip', () => {
  it('serialize → deserialize produces equivalent mappings', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const output = adapter.serialize(MAPPINGS);
    const roundTripped = adapter.deserialize(output);
    expect(roundTripped).toHaveLength(MAPPINGS.length);
    for (let i = 0; i < MAPPINGS.length; i++) {
      expect(roundTripped[i].sourcePath).toBe(MAPPINGS[i].sourcePath);
      expect(roundTripped[i].targetPath).toBe(MAPPINGS[i].targetPath);
    }
  });

  it('deserialize → serialize preserves column type and mapping', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const mappings = adapter.deserialize(COLUMNS);
    const output = adapter.serialize(mappings);
    for (let i = 0; i < COLUMNS.length; i++) {
      expect(output[i].type).toBe(COLUMNS[i].type);
      expect(output[i].mapping).toBe(COLUMNS[i].mapping);
    }
  });

  it('double round-trip is stable', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const first = adapter.serialize(MAPPINGS);
    const mappings1 = adapter.deserialize(first);
    const second = adapter.serialize(mappings1);
    const mappings2 = adapter.deserialize(second);
    expect(mappings2.map(m => ({ s: m.sourcePath, t: m.targetPath })))
      .toEqual(mappings1.map(m => ({ s: m.sourcePath, t: m.targetPath })));
  });
});

// ─── Validate ────────────────────────────────────────────────

describe('validate', () => {
  it('returns info when no mappings', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!([]);
    expect(issues.some(i => i.severity === 'info' && i.message.includes('No columns mapped'))).toBe(true);
  });

  it('reports error for empty source path', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!([
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: '', targetPath: 'path::vin' },
    ]);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('Column name is empty'))).toBe(true);
  });

  it('reports error for empty target path', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!([
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: '' },
    ]);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('No target slot'))).toBe(true);
  });

  it('reports error for invalid target path format', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!([
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'no-separator' },
    ]);
    expect(issues.some(i => i.severity === 'error' && i.message.includes('Invalid target path'))).toBe(true);
  });

  it('warns on duplicate source column', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!([
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::vin' },
      { id: 'm2', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'param::other' },
    ]);
    expect(issues.some(i => i.severity === 'warning' && i.message.includes('mapped multiple times'))).toBe(true);
  });

  it('warns on duplicate target slot', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!([
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::vin' },
      { id: 'm2', sourceId: 'data-source-columns', sourcePath: 'c2', targetPath: 'path::vin' },
    ]);
    expect(issues.some(i => i.severity === 'warning' && i.message.includes('multiple columns mapped'))).toBe(true);
  });

  it('reports info about unmapped template placeholders', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!([
      { id: 'm1', sourceId: 'data-source-columns', sourcePath: 'c1', targetPath: 'path::vin' },
    ]);
    const infoIssue = issues.find(i => i.severity === 'info' && i.message.includes('not mapped'));
    expect(infoIssue).toBeDefined();
    expect(infoIssue!.message).toContain('channel');
    expect(infoIssue!.message).toContain('token');
  });

  it('no unmapped info when all slots filled', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!(MAPPINGS);
    expect(issues.filter(i => i.severity === 'info' && i.message.includes('not mapped'))).toHaveLength(0);
  });

  it('valid mappings produce no errors', () => {
    const adapter = createColumnMappingAdapter({ columns: COLUMNS, scenario: makeScenario() });
    const issues = adapter.validate!(MAPPINGS);
    expect(issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });
});
