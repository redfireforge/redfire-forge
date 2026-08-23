import { describe, it, expect } from 'vitest';
import { buildTemplateMetaAndSample, buildScenarioFromRow } from './csvTemplateShared';
import type { ExportOptions } from './csvTemplateTypes';
import type { Scenario } from '@shared/types';
import { makeScenario as _makeScenario } from '@test-utils/factories';

// ---------------------------------------------------------------------------
// buildTemplateMetaAndSample
// ---------------------------------------------------------------------------

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario =>
  _makeScenario({
    id: 'test-1',
    name: 'Test',
    method: 'POST',
    url: 'https://api.example.com/v1/users/123?page=1&size=10',
    headers: [{ key: 'Accept', value: 'application/json' }, { key: '', value: '' }],
    body: '{"name":"test"}',
    validation: {
      mode: 'selective',
      selectiveMode: 'include',
      expectedFields: [{ jsonPath: '$.name', expectedValue: 'test' }],
    },
    ...overrides,
  });

function makeOpts(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    test: makeScenario(),
    pathVariables: [{ segmentIndex: 2, variableName: 'userId' }],
    ...overrides,
  };
}

describe('buildTemplateMetaAndSample', () => {
  it('builds metadata with correct method and URL pattern', () => {
    const { meta, urlPattern } = buildTemplateMetaAndSample(makeOpts());
    expect(meta.method).toBe('POST');
    expect(urlPattern).toBe('https://api.example.com/v1/users/{{userId}}');
    expect(meta.urlPattern).toBe(urlPattern);
  });

  it('filters out empty headers', () => {
    const { meta } = buildTemplateMetaAndSample(makeOpts());
    expect(meta.headers).toEqual([{ key: 'Accept', value: 'application/json' }]);
  });

  it('builds correct columns order', () => {
    const { columns } = buildTemplateMetaAndSample(makeOpts());
    expect(columns).toEqual([
      'name',
      'path:userId',
      'param:page',
      'param:size',
      'validate:$.name',
    ]);
  });

  it('builds sample row with current values', () => {
    const { sampleRow } = buildTemplateMetaAndSample(makeOpts());
    expect(sampleRow['name']).toBe('Test');
    expect(sampleRow['path:userId']).toBe('123');
    expect(sampleRow['param:page']).toBe('1');
    expect(sampleRow['param:size']).toBe('10');
    expect(sampleRow['validate:$.name']).toBe('test');
  });

  it('includes auth, body, validationMode in metadata', () => {
    const { meta } = buildTemplateMetaAndSample(makeOpts());
    expect(meta.auth).toEqual({ type: 'none' });
    expect(meta.body).toBe('{"name":"test"}');
    expect(meta.validationMode).toBe('selective');
    expect(meta.selectiveMode).toBe('include');
  });

  it('works with no path variables', () => {
    const { meta, columns, sampleRow } = buildTemplateMetaAndSample(makeOpts({ pathVariables: [] }));
    expect(meta.pathVariables).toEqual([]);
    expect(columns).not.toContain(expect.stringMatching(/^path:/));
    expect(sampleRow).not.toHaveProperty('path:userId');
  });

  it('works with no query params', () => {
    const opts = makeOpts({
      test: makeScenario({ url: 'https://api.example.com/v1/users/123' }),
    });
    const { columns } = buildTemplateMetaAndSample(opts);
    expect(columns.filter(c => c.startsWith('param:'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildScenarioFromRow
// ---------------------------------------------------------------------------

describe('buildScenarioFromRow', () => {
  it('builds scenario from row with metadata', () => {
    const { scenario, errors } = buildScenarioFromRow(
      { name: 'Test Row', 'path:userId': '456', 'param:page': '2' },
      {
        columns: ['name', 'path:userId', 'param:page'],
        meta: {
          version: 1, method: 'GET',
          urlPattern: 'https://api.example.com/v1/users/{{userId}}',
          headers: [{ key: 'Accept', value: 'application/json' }],
          body: '', auth: { type: 'none' },
          validationMode: 'none', pathVariables: ['userId'],
        },
      },
    );
    expect(errors).toEqual([]);
    expect(scenario).not.toBeNull();
    expect(scenario!.name).toBe('Test Row');
    expect(scenario!.url).toBe('https://api.example.com/v1/users/456?page=2');
    expect(scenario!.method).toBe('GET');
  });

  it('returns error when name is missing', () => {
    const { scenario, errors } = buildScenarioFromRow(
      { name: '', 'path:userId': '123' },
      { columns: ['name', 'path:userId'], meta: null },
    );
    expect(scenario).toBeNull();
    expect(errors).toContain('Missing name');
  });

  it('returns error when path variable is empty', () => {
    const { scenario, errors } = buildScenarioFromRow(
      { name: 'Test', 'path:userId': '' },
      {
        columns: ['name', 'path:userId'],
        meta: {
          version: 1, method: 'GET',
          urlPattern: 'https://example.com/{{userId}}',
          headers: [], body: '', auth: { type: 'none' },
          validationMode: 'none', pathVariables: ['userId'],
        },
      },
    );
    expect(scenario).toBeNull();
    expect(errors).toContain('Missing path variable: userId');
  });

  it('falls back to url column when no metadata', () => {
    const { scenario, errors } = buildScenarioFromRow(
      { name: 'Test', url: 'https://example.com/api' },
      { columns: ['name', 'url'], meta: null },
    );
    expect(errors).toEqual([]);
    expect(scenario!.url).toBe('https://example.com/api');
    expect(scenario!.method).toBe('GET');
  });

  it('returns error when no url and no metadata', () => {
    const { scenario, errors } = buildScenarioFromRow(
      { name: 'Test' },
      { columns: ['name'], meta: null },
    );
    expect(scenario).toBeNull();
    expect(errors).toContain('Missing url (no template metadata found)');
  });

  it('appends query params when using url fallback', () => {
    const { scenario } = buildScenarioFromRow(
      { name: 'Test', url: 'https://example.com/api', 'param:key': 'val' },
      { columns: ['name', 'url', 'param:key'], meta: null },
    );
    expect(scenario!.url).toBe('https://example.com/api?key=val');
  });

  it('collects validate fields into expectedFields', () => {
    const { scenario } = buildScenarioFromRow(
      { name: 'Test', url: 'https://example.com', 'validate:$.id': '42' },
      { columns: ['name', 'url', 'validate:$.id'], meta: null },
    );
    expect(scenario!.validation.mode).toBe('selective');
    expect(scenario!.validation.expectedFields).toEqual([
      { jsonPath: '$.id', expectedValue: '42' },
    ]);
  });

  it('uses metadata for method, headers, body, auth', () => {
    const { scenario } = buildScenarioFromRow(
      { name: 'Test', url: 'https://example.com' },
      {
        columns: ['name', 'url'],
        meta: {
          version: 1, method: 'POST',
          urlPattern: '', // not used when url column present
          headers: [{ key: 'X-Custom', value: 'v1' }],
          body: '{"x":1}', auth: { type: 'bearer', token: 'tok' },
          validationMode: 'none', pathVariables: [],
        },
      },
    );
    expect(scenario!.method).toBe('POST');
    expect(scenario!.headers).toEqual([{ key: 'X-Custom', value: 'v1' }]);
    expect(scenario!.body).toBe('{"x":1}');
    expect(scenario!.auth.type).toBe('bearer');
  });

  it('defaults to GET and inherit auth when no metadata', () => {
    const { scenario } = buildScenarioFromRow(
      { name: 'Test', url: 'https://example.com' },
      { columns: ['name', 'url'], meta: null },
    );
    expect(scenario!.method).toBe('GET');
    expect(scenario!.auth).toEqual({ type: 'inherit' });
  });

  it('skips empty validate columns', () => {
    const { scenario } = buildScenarioFromRow(
      { name: 'Test', url: 'https://example.com', 'validate:$.id': '' },
      { columns: ['name', 'url', 'validate:$.id'], meta: null },
    );
    expect(scenario!.validation.expectedFields).toBeUndefined();
  });

  it('uses empty string fallback for optional body and empty expectedFields in metadata', () => {
    const { meta, columns } = buildTemplateMetaAndSample(makeOpts({
      test: makeScenario({
        body: '',
        validation: {
          mode: 'none',
          expectedFields: undefined,
        },
      }),
    }));
    expect(meta.body).toBe('');
    expect(columns.some(c => c.startsWith('validate:'))).toBe(false);
  });

  it('falls back to raw segment when decodeURIComponent throws for path variable sample', () => {
    const { sampleRow } = buildTemplateMetaAndSample(makeOpts({
      test: makeScenario({
        url: 'https://api.example.com/v1/users/%E0%A4%A?page=1',
      }),
    }));
    expect(sampleRow['path:userId']).toBe('%E0%A4%A');
  });

  it('sets expectedJson only for full validation mode with expectedJson metadata', () => {
    const { scenario } = buildScenarioFromRow(
      { name: 'Full mode row', url: 'https://example.com' },
      {
        columns: ['name', 'url', 'param:missing'],
        meta: {
          version: 1,
          method: 'POST',
          urlPattern: '',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validationMode: 'full',
          expectedJson: { ok: true },
          pathVariables: [],
        },
      },
    );
    expect(scenario!.validation.mode).toBe('full');
    expect(scenario!.validation.expectedJson).toEqual({ ok: true });
    expect(scenario!.url).toBe('https://example.com?missing=');
  });
});
