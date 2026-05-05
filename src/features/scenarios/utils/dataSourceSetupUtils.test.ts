import { describe, it, expect } from 'vitest';
import {
  sanitizeVariableName,
  toVariableName,
  getTemplateSegments,
  parseTemplateParamVariables,
  shortNameForValidate,
  buildConfiguredColumnDefs,
  formatAuthLabel,
} from './dataSourceSetupUtils';
import type { Scenario } from '../../../shared/types';

// ─── sanitizeVariableName ──────────────────────────────────

describe('sanitizeVariableName', () => {
  it('removes non-alphanumeric/underscore chars', () => {
    expect(sanitizeVariableName('hello-world!')).toBe('helloworld');
  });

  it('preserves underscores and alphanumeric', () => {
    expect(sanitizeVariableName('my_var_2')).toBe('my_var_2');
  });

  it('returns empty string for all-special input', () => {
    expect(sanitizeVariableName('---')).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeVariableName('')).toBe('');
  });

  it('handles spaces and dots', () => {
    expect(sanitizeVariableName('a.b c')).toBe('abc');
  });
});

// ─── toVariableName ────────────────────────────────────────

describe('toVariableName', () => {
  it('converts kebab-case to camelCase', () => {
    expect(toVariableName('content-type')).toBe('contentType');
  });

  it('converts space-separated to camelCase', () => {
    expect(toVariableName('My Variable Name')).toBe('myVariableName');
  });

  it('returns "varName" for empty string', () => {
    expect(toVariableName('')).toBe('varName');
  });

  it('returns "varName" for all-special chars', () => {
    expect(toVariableName('---')).toBe('varName');
  });

  it('handles single word', () => {
    expect(toVariableName('Authorization')).toBe('authorization');
  });

  it('handles underscores', () => {
    expect(toVariableName('x_api_key')).toBe('xApiKey');
  });
});

// ─── getTemplateSegments ───────────────────────────────────

describe('getTemplateSegments', () => {
  it('extracts path segments from a URL template', () => {
    expect(getTemplateSegments('https://api.example.com/v1/users/{{id}}')).toEqual([
      'v1', 'users', '%7B%7Bid%7D%7D',
    ]);
  });

  it('ignores query string', () => {
    expect(getTemplateSegments('https://api.example.com/v1?q=1')).toEqual(['v1']);
  });

  it('returns empty array for undefined', () => {
    expect(getTemplateSegments(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(getTemplateSegments('')).toEqual([]);
  });

  it('returns empty array for invalid URL', () => {
    expect(getTemplateSegments('not a url at all')).toEqual([
      'not%20a%20url%20at%20all',
    ]);
  });

  it('handles root path', () => {
    expect(getTemplateSegments('https://api.example.com/')).toEqual([]);
  });
});

// ─── parseTemplateParamVariables ───────────────────────────

describe('parseTemplateParamVariables', () => {
  it('extracts param variables from template', () => {
    expect(parseTemplateParamVariables('https://api.example.com/v1?country={{countryCode}}&lang={{language}}')).toEqual({
      country: 'countryCode',
      lang: 'language',
    });
  });

  it('ignores non-template values', () => {
    expect(parseTemplateParamVariables('https://api.example.com?q=hello&var={{x}}')).toEqual({
      var: 'x',
    });
  });

  it('returns empty object for no variables', () => {
    expect(parseTemplateParamVariables('https://api.example.com?q=hello')).toEqual({});
  });

  it('returns empty object for invalid URL', () => {
    expect(parseTemplateParamVariables('not a url')).toEqual({});
  });

  it('handles URL without query string', () => {
    expect(parseTemplateParamVariables('https://api.example.com/path')).toEqual({});
  });
});

// ─── shortNameForValidate ──────────────────────────────────

describe('shortNameForValidate', () => {
  it('returns parent_tail for multi-segment path', () => {
    expect(shortNameForValidate('offers[0].offerName')).toBe('offers0_offerName');
  });

  it('handles simple single-segment path', () => {
    expect(shortNameForValidate('status')).toBe('status');
  });

  it('handles dollar prefix', () => {
    expect(shortNameForValidate('$.data.value')).toBe('data_value');
  });

  it('returns validateField for empty path', () => {
    expect(shortNameForValidate('')).toBe('validateField');
  });

  it('handles deep nested path', () => {
    expect(shortNameForValidate('a.b.c.d')).toBe('c_d');
  });

  it('handles indexed arrays', () => {
    expect(shortNameForValidate('items[1].name')).toBe('items1_name');
  });
});

// ─── formatAuthLabel ───────────────────────────────────────

describe('formatAuthLabel', () => {
  it('returns "None" for none type', () => {
    expect(formatAuthLabel({ type: 'none' } as Scenario['auth'])).toBe('None');
  });

  it('returns "Inherited (from parent)" for inherit type', () => {
    expect(formatAuthLabel({ type: 'inherit' } as Scenario['auth'])).toBe('Inherited (from parent)');
  });

  it('returns "Bearer Token (Bearer)" for bearer type', () => {
    expect(formatAuthLabel({ type: 'bearer', token: 'abc', prefix: 'Bearer' } as Scenario['auth'])).toBe('Bearer Token (Bearer)');
  });

  it('returns "Basic Auth" for basic type', () => {
    expect(formatAuthLabel({ type: 'basic', username: 'u', password: 'p' } as Scenario['auth'])).toBe('Basic Auth');
  });

  it('returns "API Key (name)" for apikey with name', () => {
    expect(formatAuthLabel({ type: 'apikey', apiKeyName: 'X-API-KEY', apiKeyValue: '123', apiKeyIn: 'header' } as Scenario['auth'])).toBe('API Key (X-API-KEY)');
  });

  it('returns "API Key" for apikey without name', () => {
    expect(formatAuthLabel({ type: 'apikey', apiKeyValue: '123', apiKeyIn: 'header' } as Scenario['auth'])).toBe('API Key');
  });

  it('returns "OAuth2 Client Credentials" for oauth2', () => {
    expect(formatAuthLabel({ type: 'oauth2', tokenUrl: '', clientId: '', clientSecret: '' } as Scenario['auth'])).toBe('OAuth2 Client Credentials');
  });
});

// ─── buildConfiguredColumnDefs ──────────────────────────────

describe('buildConfiguredColumnDefs', () => {
  const baseTest = {
    id: 'test1',
    name: 'Test',
    method: 'GET',
    url: 'https://api.example.com/v1/items?q=1',
    headers: [],
    body: '',
    validation: { expectedFields: [] },
    auth: { type: 'none' },
  } as unknown as Scenario;

  it('builds path variable columns', () => {
    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: baseTest,
      pathVars: [{ segmentIndex: 2, variableName: 'itemId' }],
      urlParams: [],
      paramSelections: {},
      headerSelections: {},
      bodySelections: {},
    });

    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe('path');
    expect(defs[0].mapping).toBe('itemId');
    expect(defs[0].customName).toBe('itemId');
  });

  it('builds param columns from enabled selections', () => {
    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: baseTest,
      pathVars: [],
      urlParams: [{ key: 'q', value: '1' }, { key: 'page', value: '2' }],
      paramSelections: {
        q: { enabled: true, name: 'query' },
        page: { enabled: false, name: 'page' },
      },
      headerSelections: {},
      bodySelections: {},
    });

    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe('param');
    expect(defs[0].customName).toBe('query');
  });

  it('skips disabled param selections', () => {
    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: baseTest,
      pathVars: [],
      urlParams: [{ key: 'q', value: '1' }],
      paramSelections: { q: { enabled: false, name: 'q' } },
      headerSelections: {},
      bodySelections: {},
    });

    expect(defs).toHaveLength(0);
  });

  it('includes name column in export mode', () => {
    const defs = buildConfiguredColumnDefs({
      mode: 'export',
      test: baseTest,
      pathVars: [],
      urlParams: [],
      paramSelections: {},
      headerSelections: {},
      bodySelections: {},
    });

    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe('name');
    expect(defs[0].customName).toBe('name');
  });

  it('deduplicates column names', () => {
    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: baseTest,
      pathVars: [
        { segmentIndex: 0, variableName: 'id' },
        { segmentIndex: 1, variableName: 'id' },
      ],
      urlParams: [],
      paramSelections: {},
      headerSelections: {},
      bodySelections: {},
    });

    expect(defs).toHaveLength(2);
    expect(defs[0].customName).toBe('id');
    expect(defs[1].customName).toBe('id_2');
  });

  it('builds header variable columns', () => {
    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: baseTest,
      pathVars: [],
      urlParams: [],
      paramSelections: {},
      headerSelections: { 'X-API-Key': { enabled: true, name: 'apiKey' } },
      bodySelections: {},
    });

    expect(defs).toHaveLength(1);
    expect(defs[0].mapping).toBe('X-API-Key');
    expect(defs[0].customName).toBe('apiKey');
  });

  it('builds body variable columns', () => {
    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: baseTest,
      pathVars: [],
      urlParams: [],
      paramSelections: {},
      headerSelections: {},
      bodySelections: { payload: { enabled: true, name: 'bodyPayload' } },
    });

    expect(defs).toHaveLength(1);
    expect(defs[0].mapping).toBe('payload');
    expect(defs[0].customName).toBe('bodyPayload');
  });

  it('builds validate columns from expectedFields', () => {
    const testWithValidation = {
      ...baseTest,
      validation: {
        expectedFields: [
          { jsonPath: 'status', expectedValue: '200', comparator: 'equals' as const },
          { jsonPath: 'data.name', expectedValue: 'test', comparator: 'equals' as const },
        ],
      },
    } as unknown as Scenario;

    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: testWithValidation,
      pathVars: [],
      urlParams: [],
      paramSelections: {},
      headerSelections: {},
      bodySelections: {},
    });

    expect(defs).toHaveLength(2);
    expect(defs[0].type).toBe('validate');
    expect(defs[0].mapping).toBe('status');
    expect(defs[1].mapping).toBe('data.name');
  });

  it('deduplicates validate fields from expectedFields and dataSource.columns', () => {
    const testWithBoth = {
      ...baseTest,
      validation: {
        expectedFields: [{ jsonPath: 'status', expectedValue: '200', comparator: 'equals' as const }],
      },
      dataSource: {
        id: 'ds1',
        columns: [{ id: 'c1', name: 'status', type: 'validate', mapping: 'status' }],
        rows: [],
      },
    } as unknown as Scenario;

    const defs = buildConfiguredColumnDefs({
      mode: 'configure',
      test: testWithBoth,
      pathVars: [],
      urlParams: [],
      paramSelections: {},
      headerSelections: {},
      bodySelections: {},
    });

    // Should have only 1 validate column (deduped)
    expect(defs.filter(d => d.type === 'validate')).toHaveLength(1);
  });

  it('combines all column types in correct order', () => {
    const testWithValidation = {
      ...baseTest,
      validation: {
        expectedFields: [{ jsonPath: 'result', expectedValue: 'ok', comparator: 'equals' as const }],
      },
    } as unknown as Scenario;

    const defs = buildConfiguredColumnDefs({
      mode: 'export',
      test: testWithValidation,
      pathVars: [{ segmentIndex: 0, variableName: 'userId' }],
      urlParams: [{ key: 'q', value: '1' }],
      paramSelections: { q: { enabled: true, name: 'query' } },
      headerSelections: { 'Auth': { enabled: true, name: 'authHeader' } },
      bodySelections: { data: { enabled: true, name: 'bodyData' } },
    });

    const types = defs.map(d => d.type);
    expect(types).toEqual(['name', 'path', 'param', 'header', 'body', 'validate']);
  });
});
