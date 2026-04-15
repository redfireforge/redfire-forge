import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { generateExcelTemplate, buildColumnDefs, parseExcelToScenarios } from './csvTemplateExcel';
import type { Scenario } from '../types';
import type { ExportOptions } from './csvTemplateTypes';

function makeTest(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 't1',
    name: 'Vehicle Onboarding',
    url: 'https://api.example.com/v1/vehicles/VIN123/onboarding?channel=web',
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

function roundtrip(test: Scenario, pathVars: { segmentIndex: number; variableName: string }[] = []) {
  const exportOpts: ExportOptions = { test, pathVariables: pathVars };
  const columnDefs = buildColumnDefs(exportOpts);
  const wb = generateExcelTemplate({ test, pathVariables: pathVars, columnDefs });
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return parseExcelToScenarios(buf);
}

describe('Excel template generate → parse roundtrip', () => {
  it('roundtrips a test with path variables and validation fields', () => {
    const test = makeTest();
    const result = roundtrip(test, [{ segmentIndex: 2, variableName: 'vin' }]);

    expect(result.fileErrors).toEqual([]);
    expect(result.warnings.length).toBeLessThanOrEqual(1);
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.errorRows).toBe(0);

    const parsed = result.rows[0].scenario!;
    expect(parsed.name).toBe('Vehicle Onboarding');
    expect(parsed.method).toBe('POST');
    expect(parsed.url).toContain('VIN123');
    expect(parsed.url).toContain('channel=web');
  });

  it('preserves auth config through roundtrip', () => {
    const test = makeTest();
    const result = roundtrip(test);
    const parsed = result.rows[0].scenario!;
    expect(parsed.auth).toEqual(test.auth);
  });

  it('preserves validation mode and fields', () => {
    const test = makeTest();
    const result = roundtrip(test, [{ segmentIndex: 2, variableName: 'vin' }]);
    const parsed = result.rows[0].scenario!;

    expect(parsed.validation.mode).toBe('selective');
    expect(parsed.validation.selectiveMode).toBe('include');
    expect(parsed.validation.expectedFields).toEqual(test.validation.expectedFields);
    expect(parsed.validation.unorderedArrays).toBe(true);
    expect(parsed.validation.excludedPaths).toEqual(['$.timestamp']);
  });

  it('preserves headers through metadata sheet', () => {
    const test = makeTest();
    const result = roundtrip(test);
    const parsed = result.rows[0].scenario!;
    expect(parsed.headers).toEqual([{ key: 'X-Correlation-Id', value: 'abc-123' }]);
  });

  it('preserves request body', () => {
    const test = makeTest();
    const result = roundtrip(test);
    expect(result.rows[0].scenario!.body).toBe('{"action":"start"}');
  });

  it('roundtrips a GET test with no validation', () => {
    const test = makeTest({
      method: 'GET',
      url: 'https://api.example.com/v1/products?page=1',
      validation: { mode: 'none' },
      headers: [],
      body: '',
      auth: { type: 'none' },
    });
    const result = roundtrip(test);

    expect(result.validRows).toBe(1);
    const parsed = result.rows[0].scenario!;
    expect(parsed.method).toBe('GET');
    expect(parsed.validation.mode).toBe('none');
  });

  it('roundtrips full validation mode with expected JSON', () => {
    const test = makeTest({
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });
    const result = roundtrip(test);
    const parsed = result.rows[0].scenario!;
    expect(parsed.validation.mode).toBe('full');
    expect(parsed.validation.expectedJson).toBe('{"ok":true}');
  });

  it('roundtrips multiple path variables', () => {
    const test = makeTest({
      url: 'https://api.example.com/v1/orgs/ORG1/vehicles/VIN999/status',
    });
    const result = roundtrip(test, [
      { segmentIndex: 2, variableName: 'orgId' },
      { segmentIndex: 4, variableName: 'vin' },
    ]);

    const parsed = result.rows[0].scenario!;
    expect(parsed.url).toContain('ORG1');
    expect(parsed.url).toContain('VIN999');
  });

  it('roundtrips basic auth', () => {
    const test = makeTest({ auth: { type: 'basic', username: 'admin', password: 'pass' } });
    const result = roundtrip(test);
    expect(result.rows[0].scenario!.auth).toEqual({ type: 'basic', username: 'admin', password: 'pass' });
  });

  it('roundtrips API key auth in header', () => {
    const test = makeTest({ auth: { type: 'apikey', apiKeyName: 'X-Key', apiKeyValue: 'secret', apiKeyIn: 'header' } });
    const result = roundtrip(test);
    expect(result.rows[0].scenario!.auth).toEqual(test.auth);
  });

  it('generates unique IDs for parsed scenarios', () => {
    const test = makeTest();
    const result = roundtrip(test);
    expect(result.rows[0].scenario!.id).toBeTruthy();
    expect(result.rows[0].scenario!.id).not.toBe('t1');
  });
});

describe('parseExcelToScenarios — error handling', () => {
  it('returns fileError for corrupted buffer', () => {
    const result = parseExcelToScenarios(new ArrayBuffer(10));
    expect(result.fileErrors.length).toBeGreaterThan(0);
  });

  it('returns fileError for workbook with wrong sheet names', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['test']]), 'WrongName');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.length).toBeGreaterThan(0);
  });

  it('returns fileError for missing Data sheet', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['COLUMN MAPPINGS', '', ''], ['column', 'type', 'mapping'], ['name', 'name', '']]), 'Metadata');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.some(e => e.includes('Missing "Data" sheet'))).toBe(true);
  });

  it('returns fileError for empty metadata', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name'], ['Test']]), 'Data');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Metadata');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.length).toBeGreaterThan(0);
  });

  it('returns fileError for missing urlPattern in config', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name'], ['Test']]), 'Data');
    const metaAoa = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['name', 'name', ''],
      [],
      ['CONFIG', ''],
      ['key', 'value'],
      ['method', 'GET'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaAoa), 'Metadata');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.some(e => e.includes('urlPattern'))).toBe(true);
  });
});

describe('buildColumnDefs', () => {
  it('generates correct defs for a test with path, param, and validation', () => {
    const test = makeTest();
    const opts: ExportOptions = {
      test,
      pathVariables: [{ segmentIndex: 2, variableName: 'vin' }],
    };
    const defs = buildColumnDefs(opts);

    expect(defs[0]).toMatchObject({ type: 'name', fullKey: 'name' });
    expect(defs.find(d => d.type === 'path')).toMatchObject({ mapping: 'vin' });
    expect(defs.find(d => d.type === 'param')).toMatchObject({ mapping: 'channel' });
    expect(defs.filter(d => d.type === 'validate')).toHaveLength(2);
  });

  it('deduplicates column names', () => {
    const test = makeTest({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.data.name', expectedValue: 'A' },
          { jsonPath: '$.info.name', expectedValue: 'B' },
        ],
      },
    });
    const defs = buildColumnDefs({ test, pathVariables: [] });
    const names = defs.map(d => d.customName);
    expect(new Set(names).size).toBe(names.length);
  });
});
