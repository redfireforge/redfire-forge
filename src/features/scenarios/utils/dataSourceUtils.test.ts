import { describe, it, expect, vi } from 'vitest';
import { autoDetectColumns, createEmptyDataSource, createDataSourceWithTemplatizedUrl, createEmptyRow, createEmptyColumn, buildUrlTemplate } from './dataSourceUtils';
import type { Scenario } from '../../../shared/types';

vi.mock('uuid', () => {
  let counter = 0;
  return { v4: () => `test-uuid-${counter++}` };
});

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'https://api.example.com/vehicles',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

describe('autoDetectColumns', () => {
  it('returns empty array for simple URL without params or variables', () => {
    const cols = autoDetectColumns(makeScenario({ url: 'https://api.example.com/api' }));
    expect(cols).toHaveLength(0);
  });

  it('detects query parameters', () => {
    const cols = autoDetectColumns(makeScenario({ url: 'https://api.example.com/api?channel=WEBRNW&status=active' }));
    const paramCols = cols.filter(c => c.type === 'param');
    expect(paramCols).toHaveLength(2);
    expect(paramCols[0].name).toBe('channel');
    expect(paramCols[0].mapping).toBe('channel');
    expect(paramCols[1].name).toBe('status');
  });

  it('detects existing {{varName}} path placeholders in URL', () => {
    const cols = autoDetectColumns(makeScenario({ url: 'https://api.example.com/vehicles/{{vin}}/details' }));
    const pathCols = cols.filter(c => c.type === 'path');
    expect(pathCols).toHaveLength(1);
    expect(pathCols[0].name).toBe('vin');
    expect(pathCols[0].mapping).toBe('vin');
  });

  it('does not detect literal path segments as variables', () => {
    // Without {{...}}, no path columns should be detected
    const cols = autoDetectColumns(makeScenario({ url: 'https://api.example.com/vehicles/12345/details' }));
    const pathCols = cols.filter(c => c.type === 'path');
    expect(pathCols).toHaveLength(0);
  });

  it('detects body template variables', () => {
    const cols = autoDetectColumns(makeScenario({
      url: 'https://api.example.com/api',
      body: '{"vin": "{{vin}}", "channel": "{{channel}}"}',
    }));
    const bodyCols = cols.filter(c => c.type === 'body');
    expect(bodyCols).toHaveLength(2);
    expect(bodyCols[0].name).toBe('vin');
    expect(bodyCols[0].mapping).toBe('vin');
    expect(bodyCols[1].name).toBe('channel');
  });

  it('detects header template variables', () => {
    const cols = autoDetectColumns(makeScenario({
      url: 'https://api.example.com/api',
      headers: [{ key: 'X-Token', value: '{{authToken}}' }],
    }));
    const headerCols = cols.filter(c => c.type === 'header');
    expect(headerCols).toHaveLength(1);
    expect(headerCols[0].name).toBe('authToken');
    expect(headerCols[0].mapping).toBe('authToken');
  });

  it('deduplicates variables across types', () => {
    const cols = autoDetectColumns(makeScenario({
      url: 'https://api.example.com/api?vin=123',
      body: '{"vin": "{{vin}}"}', // same name as query param, but different type
    }));
    // vin appears as param and body — both should exist (different types)
    expect(cols.filter(c => c.name === 'vin')).toHaveLength(2);
  });

  it('does not duplicate same variable within same type', () => {
    const cols = autoDetectColumns(makeScenario({
      url: 'https://api.example.com/api',
      body: '{"a": "{{vin}}", "b": "{{vin}}"}',
    }));
    const bodyCols = cols.filter(c => c.type === 'body');
    expect(bodyCols).toHaveLength(1);
  });
});

describe('createEmptyDataSource', () => {
  it('creates a table with auto-detected columns and one empty row', () => {
    const table = createEmptyDataSource(makeScenario({ url: 'https://api.example.com/api?foo=bar' }));
    expect(table.id).toMatch(/^test-uuid-/);
    expect(table.columns.length).toBeGreaterThanOrEqual(1);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].enabled).toBe(true);
    expect(table.source.type).toBe('inline');
  });

  it('creates a table with no columns for plain URL', () => {
    const table = createEmptyDataSource(makeScenario({ url: 'https://api.example.com/api' }));
    expect(table.columns).toHaveLength(0);
    expect(table.rows).toHaveLength(1);
  });
});

describe('createEmptyRow', () => {
  it('creates row with empty values for each column', () => {
    const columns = [
      { id: 'c1', name: 'vin', type: 'body' as const, mapping: 'vin' },
      { id: 'c2', name: 'channel', type: 'param' as const, mapping: 'channel' },
    ];
    const row = createEmptyRow(columns);
    expect(row.id).toMatch(/^test-uuid-/);
    expect(row.enabled).toBe(true);
    expect(row.values).toEqual({ c1: '', c2: '' });
  });
});

describe('createEmptyColumn', () => {
  it('creates column with default name', () => {
    const col = createEmptyColumn([]);
    expect(col.name).toBe('column');
    expect(col.type).toBe('param');
    expect(col.mapping).toBe('column');
  });

  it('avoids name collision with existing columns', () => {
    const existing = [{ id: 'x', name: 'column', type: 'param' as const, mapping: 'column' }];
    const col = createEmptyColumn(existing);
    expect(col.name).toBe('column_1');
  });
});

describe('createDataSourceWithTemplatizedUrl', () => {
  it('detects query params, pre-fills row, and builds urlTemplate with {{param}} placeholders', () => {
    const scenario = makeScenario({
      url: 'https://api.example.com/vehicles/1GTPU91D6R107995A/offers?channel=WEBRNW&country=MX',
    });
    const { dataSource, url } = createDataSourceWithTemplatizedUrl(scenario);

    // URL should NOT be modified (no auto path templatization)
    expect(url).toContain('1GTPU91D6R107995A');
    expect(url).not.toContain('{{');

    // Only query param columns (no path columns — VIN not auto-detected)
    const pathCols = dataSource.columns.filter(c => c.type === 'path');
    const paramCols = dataSource.columns.filter(c => c.type === 'param');
    expect(pathCols).toHaveLength(0);
    expect(paramCols).toHaveLength(2);

    // First row should be pre-filled with param values
    const row = dataSource.rows[0];
    const channelCol = paramCols.find(c => c.name === 'channel')!;
    expect(row.values[channelCol.id]).toBe('WEBRNW');
    const countryCol = paramCols.find(c => c.name === 'country')!;
    expect(row.values[countryCol.id]).toBe('MX');

    // urlTemplate should have {{param}} placeholders
    expect(dataSource.urlTemplate).toBe(
      'https://api.example.com/vehicles/1GTPU91D6R107995A/offers?channel={{channel}}&country={{country}}'
    );
  });

  it('detects existing {{vin}} placeholder as path column and includes in urlTemplate', () => {
    const scenario = makeScenario({
      url: 'https://api.example.com/vehicles/{{vin}}/offers?channel=WEBRNW',
    });
    const { dataSource, url } = createDataSourceWithTemplatizedUrl(scenario);

    expect(url).toContain('{{vin}}');
    const pathCols = dataSource.columns.filter(c => c.type === 'path');
    expect(pathCols).toHaveLength(1);
    expect(pathCols[0].name).toBe('vin');

    // urlTemplate preserves {{vin}} and templatizes params
    expect(dataSource.urlTemplate).toBe(
      'https://api.example.com/vehicles/{{vin}}/offers?channel={{channel}}'
    );
  });

  it('preserves URL when no variables detected', () => {
    const scenario = makeScenario({ url: 'https://api.example.com/status?env=prod' });
    const { dataSource, url } = createDataSourceWithTemplatizedUrl(scenario);

    expect(url).toBe('https://api.example.com/status?env=prod');
    expect(dataSource.columns).toHaveLength(1); // just the param
    expect(dataSource.urlTemplate).toBe('https://api.example.com/status?env={{env}}');
  });
});

describe('buildUrlTemplate', () => {
  it('replaces param values with {{paramName}} placeholders', () => {
    const columns = [
      { id: '1', name: 'channel', type: 'param' as const, mapping: 'channel' },
      { id: '2', name: 'country', type: 'param' as const, mapping: 'country' },
    ];
    const result = buildUrlTemplate('https://example.com/api?channel=WEBRNW&country=MX', columns);
    expect(result).toBe('https://example.com/api?channel={{channel}}&country={{country}}');
  });

  it('preserves existing {{varName}} in path', () => {
    const columns = [
      { id: '1', name: 'vin', type: 'path' as const, mapping: 'vin' },
      { id: '2', name: 'env', type: 'param' as const, mapping: 'env' },
    ];
    const result = buildUrlTemplate('https://example.com/vehicles/{{vin}}/offers?env=prod', columns);
    expect(result).toBe('https://example.com/vehicles/{{vin}}/offers?env={{env}}');
  });

  it('returns base path when no param columns', () => {
    const columns = [
      { id: '1', name: 'vin', type: 'path' as const, mapping: 'vin' },
    ];
    const result = buildUrlTemplate('https://example.com/vehicles/{{vin}}/offers', columns);
    expect(result).toBe('https://example.com/vehicles/{{vin}}/offers');
  });
});
