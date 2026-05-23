import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { prepareRustScenario, resetAvailabilityCache } from './rustBridge';
import { isTauri } from '../../../shared/utils/platform';
import { Scenario } from '../../../shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const mockIsTauri = vi.mocked(isTauri);

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    headers: [{ key: 'X-Custom', value: 'test' }],
    ...overrides,
  });
}

beforeEach(() => {
  resetAvailabilityCache();
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(false);
});

/* ── prepareRustScenario ─────────────────────────────────────────── */

describe('prepareRustScenario', () => {
  it('resolves headers and URL for a GET scenario', () => {
    const scenario = makeScenario();
    const result = prepareRustScenario(scenario);
    expect(result.id).toBe('sc-1');
    expect(result.url).toBe('https://api.example.com/users');
    expect(result.method).toBe('GET');
    expect(result.headers['X-Custom']).toBe('test');
    expect(result.body).toBeNull();
  });

  it('sets body for POST scenario with JSON body', () => {
    const scenario = makeScenario({
      method: 'POST',
      body: '{"name":"test"}',
      bodyType: 'json',
    });
    const result = prepareRustScenario(scenario);
    expect(result.body).toBe('{"name":"test"}');
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('resolves basic auth into Authorization header', () => {
    const scenario = makeScenario({
      auth: { type: 'basic', username: 'admin', password: 'secret' },
    });
    const result = prepareRustScenario(scenario);
    const expected = 'Basic ' + btoa('admin:secret');
    expect(result.headers['Authorization']).toBe(expected);
  });

  it('resolves bearer auth into Authorization header', () => {
    const scenario = makeScenario({
      auth: { type: 'bearer', token: 'my-token' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.headers['Authorization']).toBe('Bearer my-token');
  });

  it('resolves API key in query param into URL', () => {
    const scenario = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'secret123', apiKeyIn: 'query' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.url).toContain('key=secret123');
  });

  it('resolves API key in header', () => {
    const scenario = makeScenario({
      auth: { type: 'apikey', apiKeyName: 'X-Api-Key', apiKeyValue: 'abc', apiKeyIn: 'header' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.headers['X-Api-Key']).toBe('abc');
  });

  it('preserves data row fields for parameterized scenarios', () => {
    const scenario = makeScenario({ dataRowId: 'row-5', dataRowLabel: 'Row 5: user=admin' });
    const result = prepareRustScenario(scenario);
    expect(result.dataRowId).toBe('row-5');
    expect(result.dataRowLabel).toBe('Row 5: user=admin');
  });

  it('sets featureGroupName and groupName', () => {
    const scenario = makeScenario({ featureGroupName: 'Auth API', groupName: 'Login' });
    const result = prepareRustScenario(scenario);
    expect(result.featureGroupName).toBe('Auth API');
    expect(result.groupName).toBe('Login');
  });

  it('handles form-urlencoded body', () => {
    const scenario = makeScenario({
      method: 'POST',
      bodyType: 'form-urlencoded',
      bodyForm: [{ key: 'user', value: 'admin' }, { key: 'pass', value: 'secret' }],
    });
    const result = prepareRustScenario(scenario);
    expect(result.body).toContain('user=admin');
    expect(result.body).toContain('pass=secret');
    expect(result.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('includes validation config with mode and expectedFields', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'name', expectedValue: '"Alice"', operator: 'equals' },
          { jsonPath: 'age', expectedValue: '30' },
        ],
        unorderedArrays: true,
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.validation).toBeDefined();
    expect(result.validation!.mode).toBe('selective');
    expect(result.validation!.expectedFields).toHaveLength(2);
    expect(result.validation!.expectedFields![0].jsonPath).toBe('name');
    expect(result.validation!.expectedFields![0].operator).toBe('equals');
    expect(result.validation!.unorderedArrays).toBe(true);
  });

  it('includes validation config with full mode and expectedJson', () => {
    const scenario = makeScenario({
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });
    const result = prepareRustScenario(scenario);
    expect(result.validation!.mode).toBe('full');
    expect(result.validation!.expectedJson).toBe('{"ok":true}');
  });

  it('strips UI-only fields from validation config', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'selective',
        selectiveMode: 'field' as never,
        sampleJson: '{"sample":true}' as never,
        excludedPaths: ['$.meta'] as never,
        responseVersions: [] as never,
        rulesVersions: [] as never,
      },
    });
    const result = prepareRustScenario(scenario);
    const v = result.validation!;
    expect(v.mode).toBe('selective');
    expect('selectiveMode' in v).toBe(false);
    expect('sampleJson' in v).toBe(false);
    expect('excludedPaths' in v).toBe(false);
    expect('responseVersions' in v).toBe(false);
    expect('rulesVersions' in v).toBe(false);
  });

  it('filters out custom assertions from serialized assertions', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'status', expected: '200', negate: false },
          { type: 'custom', expression: 'response.ok === true', negate: false },
          { type: 'responseTime', maxMs: 500, negate: false },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(2);
    expect(result.assertions!.every(a => a.type !== 'custom')).toBe(true);
  });

  it('omits assertions field when no non-custom assertions exist', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'custom', expression: 'true', negate: false },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toBeUndefined();
  });

  it('omits assertions field when no assertions at all', () => {
    const scenario = makeScenario({ validation: { mode: 'none' } });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toBeUndefined();
  });

  it('normalizes existence assertion with existsMode=exists', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field', existsMode: 'exists' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(true);
  });

  it('normalizes existence assertion with existsMode=does_not_exist', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field', existsMode: 'does_not_exist' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(false);
  });

  it('normalizes existence assertion with explicit expectExists', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field', expectExists: false },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(false);
  });

  it('defaults existence assertion expectExists to true when no mode specified', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'existence', path: '$.field' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].expectExists).toBe(true);
  });

  it('normalizes header assertion with legacy field names', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'header', headerName: 'Content-Type', headerOp: 'contains', headerValue: 'json' },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].name).toBe('Content-Type');
    expect(result.assertions![0].operator).toBe('contains');
    expect(result.assertions![0].value).toBe('json');
  });

  it('normalizes numeric assertion with legacy comparison field', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'numeric', path: '$.count', comparison: '>=', value: 10 },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].operator).toBe('>=');
  });

  it('normalizes arrayLength assertion with legacy comparison field', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'arrayLength', path: '$.items', comparison: '==', value: 5 },
        ],
      },
    });
    const result = prepareRustScenario(scenario);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions![0].operator).toBe('==');
  });
});
