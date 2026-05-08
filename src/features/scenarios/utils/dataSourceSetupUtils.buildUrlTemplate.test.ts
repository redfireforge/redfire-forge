import { describe, it, expect } from 'vitest';
import { buildUrlTemplate, buildScenarioFromFetchConfig } from './dataSourceSetupUtils';
import type { ColumnDef } from './csvTemplate';

describe('buildUrlTemplate', () => {
  const makeColDef = (overrides: Partial<ColumnDef>): ColumnDef => ({
    mapping: '',
    customName: '',
    type: 'param',
    ...overrides,
  } as ColumnDef);

  it('returns urlTemplateInput when provided', () => {
    const result = buildUrlTemplate(
      'https://api.example.com/{{id}}',
      [],
      'https://api.example.com/123',
      [],
    );
    expect(result).toBe('https://api.example.com/{{id}}');
  });

  it('builds template from previewUrl when no input', () => {
    const result = buildUrlTemplate(
      '',
      [],
      'https://api.example.com/items',
      [],
    );
    expect(result).toBe('https://api.example.com/items');
  });

  it('appends param columns as query string', () => {
    const result = buildUrlTemplate(
      '',
      [makeColDef({ type: 'param', mapping: 'channel', customName: 'channel' })],
      'https://api.example.com/items',
      [{ key: 'channel', value: 'web' }],
    );
    expect(result).toContain('channel={{channel}}');
  });

  it('replaces unresolved placeholders with fallback values', () => {
    const result = buildUrlTemplate(
      'https://api.example.com?foo={{foo}}&bar={{bar}}',
      [makeColDef({ type: 'param', mapping: 'foo', customName: 'foo' })],
      'https://api.example.com',
      [{ key: 'bar', value: 'literal' }],
    );
    expect(result).toContain('foo={{foo}}');
    expect(result).toContain('bar=literal');
  });

  it('does not overwrite query keys when enabled param maps to empty variable name', () => {
    const result = buildUrlTemplate(
      'https://api.example.com/items?foo={{foo}}',
      [makeColDef({ type: 'param', mapping: 'foo', customName: '   ' })],
      'https://api.example.com/items',
      [],
    );
    expect(result).toContain('foo={{foo}}');
  });

  it('clears non-param template query values when fallback is also a template token', () => {
    const result = buildUrlTemplate(
      'https://api.example.com/items?foo={{foo}}',
      [],
      'https://api.example.com/items',
      [{ key: 'foo', value: '{{bar}}' }],
    );
    expect(result).toContain('foo=');
    expect(result.endsWith('foo=')).toBe(true);
  });
});

describe('buildScenarioFromFetchConfig', () => {
  it('creates a scenario with basic fetch config', () => {
    const result = buildScenarioFromFetchConfig(
      'ds-1',
      'My Source',
      { url: 'https://api.example.com', method: 'GET', headers: [], body: '', bodyType: 'none', auth: { type: 'none' } },
      { id: 'dt-1', columns: [], rows: [], source: { type: 'inline' } },
    );
    expect(result.id).toBe('ds-1');
    expect(result.name).toBe('My Source');
    expect(result.url).toBe('https://api.example.com');
    expect(result.method).toBe('GET');
  });

  it('applies urlOverride when provided', () => {
    const result = buildScenarioFromFetchConfig(
      'ds-1',
      'Test',
      { url: 'https://template/{{var}}', method: 'POST', headers: [{ key: 'X-Key', value: 'val' }], body: '{}', bodyType: 'json', auth: { type: 'bearer', token: 'tok' } },
      { id: 'dt-1', columns: [], rows: [], source: { type: 'inline' } },
      'https://actual-url.com',
    );
    expect(result.url).toBe('https://actual-url.com');
    expect(result.method).toBe('POST');
    expect(result.body).toBe('{}');
  });

  it('substitutes placeholder headers when fetch config has empty header list', () => {
    const result = buildScenarioFromFetchConfig(
      'ds-1',
      'Test',
      {
        url: 'https://api.example.com',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        auth: { type: 'none' },
      },
      { id: 'dt-1', columns: [], rows: [], source: { type: 'inline' } },
    );
    expect(result.headers).toEqual([{ key: '', value: '' }]);
  });

  it('defaults bodyType to json when body is present without explicit bodyType', () => {
    const result = buildScenarioFromFetchConfig(
      'ds-1',
      'Test',
      {
        url: 'https://api.example.com/p',
        method: 'POST',
        headers: [{ key: 'H', value: 'v' }],
        body: '{}',
        auth: { type: 'none' },
      },
      { id: 'dt-1', columns: [], rows: [], source: { type: 'inline' } },
    );
    expect(result.bodyType).toBe('json');
  });
});
