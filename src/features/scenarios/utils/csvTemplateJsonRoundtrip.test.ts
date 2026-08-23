import { describe, it, expect } from 'vitest';
import { generateJsonTemplate, parseJsonToScenarios } from './csvTemplateJson';
import { Scenario } from '@shared/types';
import { ExportOptions } from './csvTemplateTypes';

function makeTest(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 't1',
    name: 'Vehicle Onboarding',
    url: 'https://api.example.com/v1/vehicles/VIN123/onboarding?channel=web&source=dealer',
    method: 'POST',
    headers: [{ key: 'X-Correlation-Id', value: 'abc-123' }],
    body: '{"action":"start"}',
    auth: { type: 'oauth2', tokenUrl: 'http://auth/token', clientId: 'cid', clientSecret: 'csec' },
    validation: {
      mode: 'selective',
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: '$.data.status', expectedValue: 'active' },
        { jsonPath: '$.data.vin', expectedValue: 'VIN123' },
      ],
      excludedPaths: ['$.timestamp'],
      unorderedArrays: true,
    },
    ...overrides,
  };
}

describe('JSON template generate → parse roundtrip', () => {
  it('roundtrips a test with path variables and validation fields', () => {
    const test = makeTest();
    const opts: ExportOptions = {
      test,
      pathVariables: [{ segmentIndex: 2, variableName: 'vin' }],
    };

    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);

    expect(result.fileErrors).toEqual([]);
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.errorRows).toBe(0);

    const parsed = result.rows[0].scenario!;
    expect(parsed.name).toBe('Vehicle Onboarding');
    expect(parsed.method).toBe('POST');
    expect(parsed.url).toContain('VIN123');
    expect(parsed.url).toContain('channel=web');
    expect(parsed.url).toContain('source=dealer');
    expect(parsed.auth).toEqual(test.auth);
    expect(parsed.validation.mode).toBe('selective');
    expect(parsed.validation.selectiveMode).toBe('include');
    expect(parsed.validation.expectedFields).toEqual(test.validation.expectedFields);
    expect(parsed.validation.unorderedArrays).toBe(true);
    expect(parsed.validation.excludedPaths).toEqual(['$.timestamp']);
  });

  it('preserves metadata (method, headers, body, auth)', () => {
    const test = makeTest();
    const opts: ExportOptions = { test, pathVariables: [] };
    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);

    expect(result.meta).toBeTruthy();
    expect(result.meta!.method).toBe('POST');
    expect(result.meta!.headers).toEqual([{ key: 'X-Correlation-Id', value: 'abc-123' }]);
    expect(result.meta!.body).toBe('{"action":"start"}');
    expect(result.meta!.auth).toEqual(test.auth);
  });

  it('roundtrips GET test with no validation', () => {
    const test = makeTest({
      method: 'GET',
      url: 'https://api.example.com/v1/products?page=1',
      validation: { mode: 'none' },
      headers: [],
      body: '',
      auth: { type: 'none' },
    });
    const opts: ExportOptions = { test, pathVariables: [] };
    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);

    expect(result.validRows).toBe(1);
    const parsed = result.rows[0].scenario!;
    expect(parsed.method).toBe('GET');
    expect(parsed.url).toContain('page=1');
    expect(parsed.validation.mode).toBe('none');
  });

  it('roundtrips multiple path variables', () => {
    const test = makeTest({
      url: 'https://api.example.com/v1/orgs/ORG1/vehicles/VIN999/status',
    });
    const opts: ExportOptions = {
      test,
      pathVariables: [
        { segmentIndex: 2, variableName: 'orgId' },
        { segmentIndex: 4, variableName: 'vin' },
      ],
    };
    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);

    const parsed = result.rows[0].scenario!;
    expect(parsed.url).toContain('ORG1');
    expect(parsed.url).toContain('VIN999');
  });

  it('roundtrips full validation mode', () => {
    const test = makeTest({
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });
    const opts: ExportOptions = { test, pathVariables: [] };
    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);

    expect(result.rows[0].scenario!.validation.mode).toBe('full');
  });

  it('roundtrips inherit auth', () => {
    const test = makeTest({ auth: { type: 'inherit' } });
    const opts: ExportOptions = { test, pathVariables: [] };
    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);
    expect(result.rows[0].scenario!.auth).toEqual({ type: 'inherit' });
  });

  it('roundtrips basic auth', () => {
    const test = makeTest({ auth: { type: 'basic', username: 'admin', password: 'secret' } });
    const opts: ExportOptions = { test, pathVariables: [] };
    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);
    expect(result.rows[0].scenario!.auth).toEqual({ type: 'basic', username: 'admin', password: 'secret' });
  });

  it('uses empty string when path variable segmentIndex is out of bounds', () => {
    const test = makeTest({ url: 'https://api.example.com/v1', validation: { mode: 'none' }, headers: [], body: '', auth: { type: 'none' } });
    const opts: ExportOptions = {
      test,
      pathVariables: [{ segmentIndex: 99, variableName: 'missing' }],
    };
    const json = generateJsonTemplate(opts);
    const result = parseJsonToScenarios(json);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors).toContain('Missing path variable: missing');
  });
});

describe('parseJsonToScenarios — simple array format', () => {
  it('parses a plain array of objects with name and url', () => {
    const json = JSON.stringify([
      { name: 'Test 1', url: 'https://api.example.com/v1/items' },
      { name: 'Test 2', url: 'https://api.example.com/v1/users', method: 'POST', body: '{"x":1}' },
    ]);
    const result = parseJsonToScenarios(json);

    expect(result.fileErrors).toEqual([]);
    expect(result.meta).toBeNull();
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);

    expect(result.rows[0].scenario!.name).toBe('Test 1');
    expect(result.rows[0].scenario!.url).toBe('https://api.example.com/v1/items');
    expect(result.rows[0].scenario!.method).toBe('GET');

    expect(result.rows[1].scenario!.name).toBe('Test 2');
    expect(result.rows[1].scenario!.method).toBe('POST');
    expect(result.rows[1].scenario!.body).toBe('{"x":1}');
  });

  it('reports error when name is missing', () => {
    const json = JSON.stringify([{ url: 'https://api.example.com' }]);
    const result = parseJsonToScenarios(json);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors).toContain('Missing name');
  });

  it('reports error when url is missing', () => {
    const json = JSON.stringify([{ name: 'No URL' }]);
    const result = parseJsonToScenarios(json);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors).toContain('Missing url');
  });

  it('reports error for non-object array elements', () => {
    const json = JSON.stringify(['not an object', 42]);
    const result = parseJsonToScenarios(json);
    expect(result.errorRows).toBe(2);
    expect(result.rows[0].errors).toContain('Row is not an object');
  });

  it('defaults to GET and inherit auth', () => {
    const json = JSON.stringify([{ name: 'T', url: 'https://x.com' }]);
    const result = parseJsonToScenarios(json);
    const s = result.rows[0].scenario!;
    expect(s.method).toBe('GET');
    expect(s.auth).toEqual({ type: 'inherit' });
    expect(s.validation.mode).toBe('none');
  });
});

describe('parseJsonToScenarios — structured format without meta', () => {
  it('parses { data: [...] } without meta', () => {
    const json = JSON.stringify({
      data: [
        { name: 'T1', url: 'https://api.example.com/v1/test' },
      ],
    });
    const result = parseJsonToScenarios(json);
    expect(result.meta).toBeNull();
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.name).toBe('T1');
    expect(result.rows[0].scenario!.method).toBe('GET');
  });
});

describe('parseJsonToScenarios — error handling', () => {
  it('returns file error for invalid JSON', () => {
    const result = parseJsonToScenarios('{not valid json}');
    expect(result.fileErrors.length).toBe(1);
    expect(result.fileErrors[0]).toContain('Invalid JSON');
    expect(result.totalRows).toBe(0);
  });

  it('returns file error for non-array, non-object JSON', () => {
    const result = parseJsonToScenarios('"just a string"');
    expect(result.fileErrors.length).toBe(1);
    expect(result.fileErrors[0]).toContain('must be an array');
  });

  it('returns file error when data is not an array', () => {
    const result = parseJsonToScenarios('{"data": "not an array"}');
    expect(result.fileErrors.length).toBe(1);
    expect(result.fileErrors[0]).toContain('"data" must be an array');
  });

  it('handles empty data array', () => {
    const result = parseJsonToScenarios('{"meta": {}, "data": []}');
    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
    expect(result.fileErrors).toEqual([]);
  });

  it('handles empty array', () => {
    const result = parseJsonToScenarios('[]');
    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
    expect(result.fileErrors).toEqual([]);
  });

  it('coerces numeric values to strings', () => {
    const json = JSON.stringify({
      data: [{ name: 'T1', url: 'https://x.com', 'param:page': 42 }],
    });
    const result = parseJsonToScenarios(json);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.url).toContain('page=42');
  });
});

describe('generateJsonTemplate', () => {
  it('produces valid JSON with meta and data', () => {
    const test = makeTest();
    const json = generateJsonTemplate({ test, pathVariables: [] });
    const parsed = JSON.parse(json);

    expect(parsed.meta).toBeTruthy();
    expect(parsed.meta.version).toBe(1);
    expect(parsed.meta.method).toBe('POST');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].name).toBe('Vehicle Onboarding');
  });

  it('includes path variable columns in data row', () => {
    const test = makeTest();
    const json = generateJsonTemplate({
      test,
      pathVariables: [{ segmentIndex: 2, variableName: 'vin' }],
    });
    const parsed = JSON.parse(json);

    expect(parsed.meta.urlPattern).toContain('{{vin}}');
    expect(parsed.meta.pathVariables).toEqual(['vin']);
    expect(parsed.data[0]['path:vin']).toBe('VIN123');
  });

  it('includes param and validate columns', () => {
    const test = makeTest();
    const json = generateJsonTemplate({ test, pathVariables: [] });
    const parsed = JSON.parse(json);

    expect(parsed.data[0]['param:channel']).toBe('web');
    expect(parsed.data[0]['param:source']).toBe('dealer');
    expect(parsed.data[0]['validate:$.data.status']).toBe('active');
    expect(parsed.data[0]['validate:$.data.vin']).toBe('VIN123');
  });
});
