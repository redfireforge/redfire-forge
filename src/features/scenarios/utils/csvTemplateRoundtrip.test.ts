import { describe, it, expect } from 'vitest';
import { generateCsvTemplate, parseCsvToScenarios } from './csvTemplateCsv';
import { Scenario } from '../../../shared/types';
import { META_LINE_PREFIX, type ExportOptions } from './csvTemplateTypes';

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

describe('CSV template generate → parse roundtrip', () => {
  it('roundtrips a test with path variables and validation fields', () => {
    const test = makeTest();
    const opts: ExportOptions = {
      test,
      pathVariables: [{ segmentIndex: 2, variableName: 'vin' }],
    };

    const csv = generateCsvTemplate(opts);
    const result = parseCsvToScenarios(csv);

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
    const csv = generateCsvTemplate(opts);
    const result = parseCsvToScenarios(csv);

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
    const csv = generateCsvTemplate(opts);
    const result = parseCsvToScenarios(csv);

    expect(result.validRows).toBe(1);
    const parsed = result.rows[0].scenario!;
    expect(parsed.method).toBe('GET');
    expect(parsed.url).toContain('page=1');
    expect(parsed.validation.mode).toBe('none');
  });

  it('uses empty string when path variable segmentIndex is out of bounds', () => {
    const test = makeTest({ url: 'https://api.example.com/v1', validation: { mode: 'none' }, headers: [], body: '', auth: { type: 'none' } });
    const opts: ExportOptions = {
      test,
      pathVariables: [{ segmentIndex: 99, variableName: 'missing' }],
    };
    const csv = generateCsvTemplate(opts);
    expect(csv).toContain('path:missing');
    // Parse it back - the path variable should be empty, causing an error
    const result = parseCsvToScenarios(csv);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors).toContain('Missing path variable: missing');
  });

  it('roundtrips full validation mode', () => {
    const test = makeTest({
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });
    const opts: ExportOptions = { test, pathVariables: [] };
    const csv = generateCsvTemplate(opts);
    const result = parseCsvToScenarios(csv);

    expect(result.rows[0].scenario!.validation.mode).toBe('full');
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
    const csv = generateCsvTemplate(opts);
    const result = parseCsvToScenarios(csv);

    const parsed = result.rows[0].scenario!;
    expect(parsed.url).toContain('ORG1');
    expect(parsed.url).toContain('VIN999');
  });

  it('handles CSV without metadata line (legacy format)', () => {
    const legacyCsv = 'name,url\nTest 1,https://api.example.com/v1/test';
    const result = parseCsvToScenarios(legacyCsv);

    expect(result.meta).toBeNull();
    expect(result.validRows).toBe(1);
    const parsed = result.rows[0].scenario!;
    expect(parsed.name).toBe('Test 1');
    expect(parsed.url).toBe('https://api.example.com/v1/test');
    expect(parsed.method).toBe('GET');
    expect(parsed.auth).toEqual({ type: 'inherit' });
  });

  it('detects missing name as error row', () => {
    const test = makeTest();
    const opts: ExportOptions = { test, pathVariables: [] };
    const csv = generateCsvTemplate(opts);
    const lines = csv.split('\n');
    const dataLine = lines[2].replace('Vehicle Onboarding', '');
    const modified = [lines[0], lines[1], dataLine].join('\n');
    const result = parseCsvToScenarios(modified);

    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors).toContain('Missing name');
  });

  it('detects missing path variable as error row', () => {
    const test = makeTest();
    const opts: ExportOptions = {
      test,
      pathVariables: [{ segmentIndex: 2, variableName: 'vin' }],
    };
    const csv = generateCsvTemplate(opts);
    const lines = csv.split('\n');
    const dataLine = lines[2].replace('VIN123', '');
    const modified = [lines[0], lines[1], dataLine].join('\n');
    const result = parseCsvToScenarios(modified);

    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors[0]).toContain('Missing path variable');
  });

  it('handles empty CSV body', () => {
    const csv = '#META:{"version":1,"method":"GET","urlPattern":"https://api.example.com","headers":[],"body":"","auth":{"type":"none"},"validationMode":"none","pathVariables":[]}\nname';
    const result = parseCsvToScenarios(csv);
    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
  });

  it('roundtrips inherit auth', () => {
    const test = makeTest({ auth: { type: 'inherit' } });
    const opts: ExportOptions = { test, pathVariables: [] };
    const csv = generateCsvTemplate(opts);
    const result = parseCsvToScenarios(csv);
    expect(result.rows[0].scenario!.auth).toEqual({ type: 'inherit' });
  });

  it('roundtrips basic auth', () => {
    const test = makeTest({ auth: { type: 'basic', username: 'admin', password: 'secret' } });
    const opts: ExportOptions = { test, pathVariables: [] };
    const csv = generateCsvTemplate(opts);
    const result = parseCsvToScenarios(csv);
    expect(result.rows[0].scenario!.auth).toEqual({ type: 'basic', username: 'admin', password: 'secret' });
  });
});

describe('parseCsvToScenarios — metadata line', () => {
  it('ignores invalid JSON on the metadata line and still parses the CSV body', () => {
    const csv = `${META_LINE_PREFIX}{not valid json\nname,url\nT,https://z.example/`;
    const result = parseCsvToScenarios(csv);
    expect(result.fileErrors).toEqual([]);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.name).toBe('T');
    expect(result.rows[0].scenario!.url).toBe('https://z.example/');
  });
});

describe('parseCsvToScenarios — legacy URL without metadata', () => {
  it('reports error when url is missing and there is no template metadata', () => {
    const csv = 'name,url\nMy test,';
    const result = parseCsvToScenarios(csv);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors).toContain('Missing url (no template metadata found)');
  });

  it('appends query string from param columns when using raw url', () => {
    const csv = 'name,url,param:q,param:src\nT,https://api.example.com/items,,x';
    const result = parseCsvToScenarios(csv);
    expect(result.fileErrors).toEqual([]);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.url).toBe(
      'https://api.example.com/items?q=&src=x',
    );
  });

  it('uses raw url without query string when no param columns', () => {
    const csv = 'name,url\nT,https://api.example.com/items';
    const result = parseCsvToScenarios(csv);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.url).toBe('https://api.example.com/items');
  });
});

describe('parseCsvToScenarios — edge branch coverage', () => {
  it('falls back to defaults when no metadata and no method column', () => {
    const csv = 'name,url\nTest,https://example.com/api';
    const result = parseCsvToScenarios(csv);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.method).toBe('GET');
    expect(result.rows[0].scenario!.auth.type).toBe('inherit');
  });

  it('skips validate columns with empty values', () => {
    const csv = 'name,url,validate:$.id\nTest,https://example.com/api,';
    const result = parseCsvToScenarios(csv);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.validation.expectedFields).toBeUndefined();
  });

  it('reports error for missing path variable', () => {
    const meta = JSON.stringify({ version: 1, method: 'GET', urlPattern: 'https://api.com/{{id}}', headers: [], body: '', pathVariables: ['id'] });
    const csv = `#META:${meta}\nname,path:id\nTest,`;
    const result = parseCsvToScenarios(csv);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0].errors).toContain('Missing path variable: id');
  });

  it('handles full validation mode with expectedJson from metadata', () => {
    const meta = JSON.stringify({ version: 1, method: 'POST', urlPattern: 'https://api.com/test', headers: [], body: '{}', validationMode: 'full', expectedJson: '{"ok":true}' });
    const csv = `#META:${meta}\nname\nTest`;
    const result = parseCsvToScenarios(csv);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.validation.mode).toBe('full');
    expect(result.rows[0].scenario!.validation.expectedJson).toBe('{"ok":true}');
  });

  it('uses selective mode when validate fields present but no metadata', () => {
    const csv = 'name,url,validate:$.status\nTest,https://api.com/x,200';
    const result = parseCsvToScenarios(csv);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.validation.mode).toBe('selective');
    expect(result.rows[0].scenario!.validation.selectiveMode).toBe('include');
    expect(result.rows[0].scenario!.validation.expectedFields).toHaveLength(1);
  });

  it('handles invalid metadata JSON gracefully', () => {
    const csv = '#META:{invalid json\nname,url\nTest,https://example.com/api';
    const result = parseCsvToScenarios(csv);
    expect(result.validRows).toBe(1);
  });
});
