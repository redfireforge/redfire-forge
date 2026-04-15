import { describe, it, expect } from 'vitest';
import { wrapExport, unwrapImport, reIdScenarios } from './scenarioImportExport';
import type { TestScenario, FeatureGroup, Scenario } from '../types';

function makeScenario(name: string): Scenario {
  return {
    id: 'test-id-1', name, url: 'http://api/v1/test', method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '', auth: { type: 'inherit' }, validation: { mode: 'none' },
  };
}

function makeTestScenario(name: string, tests: Scenario[]): TestScenario {
  return { id: 'sc-id-1', name, tests };
}

describe('wrapExport / unwrapImport roundtrip', () => {
  it('wraps and unwraps a single test', () => {
    const test = makeScenario('POST vehicle');
    const wrapped = wrapExport(test, 'test', { microservice: 'vehicle-svc', environment: 't01' });

    expect(wrapped._exportMeta.level).toBe('test');
    expect(wrapped._exportMeta.microservice).toBe('vehicle-svc');
    expect(wrapped._exportMeta.environment).toBe('t01');
    expect(wrapped._exportMeta.exportedAt).toBeTruthy();

    const unwrapped = unwrapImport(wrapped) as Scenario;
    expect(unwrapped.name).toBe('POST vehicle');
    expect(unwrapped.url).toBe('http://api/v1/test');
    expect(unwrapped.method).toBe('GET');
    expect(unwrapped.headers).toEqual([{ key: 'Accept', value: 'application/json' }]);
  });

  it('wraps and unwraps a scenario with tests', () => {
    const sc = makeTestScenario('Happy path', [makeScenario('Test A'), makeScenario('Test B')]);
    const wrapped = wrapExport(sc, 'scenario', {});
    const unwrapped = unwrapImport(wrapped) as TestScenario;

    expect(unwrapped.name).toBe('Happy path');
    expect(unwrapped.tests).toHaveLength(2);
    expect(unwrapped.tests[0].name).toBe('Test A');
    expect(unwrapped.tests[1].name).toBe('Test B');
  });

  it('wraps and unwraps a feature group array', () => {
    const fgs: FeatureGroup[] = [
      {
        id: 'fg-1', name: 'Onboarding',
        scenarios: [makeTestScenario('S1', [makeScenario('T1')])],
      },
      {
        id: 'fg-2', name: 'Offboarding',
        scenarios: [makeTestScenario('S2', [makeScenario('T2')])],
      },
    ];
    const wrapped = wrapExport(fgs, 'feature-groups', { environment: 'p01' });
    const unwrapped = unwrapImport(wrapped) as FeatureGroup[];

    expect(unwrapped).toHaveLength(2);
    expect(unwrapped[0].name).toBe('Onboarding');
    expect(unwrapped[1].name).toBe('Offboarding');
    expect(unwrapped[0].scenarios[0].tests[0].name).toBe('T1');
  });

  it('unwrapImport passes through raw data when no _exportMeta', () => {
    const raw = { name: 'direct', tests: [] };
    expect(unwrapImport(raw)).toBe(raw);
  });

  it('unwrapImport passes through non-objects', () => {
    expect(unwrapImport('hello')).toBe('hello');
    expect(unwrapImport(42)).toBe(42);
    expect(unwrapImport(null)).toBe(null);
    expect(unwrapImport(undefined)).toBe(undefined);
  });

  it('round-trips complex auth config', () => {
    const test: Scenario = {
      ...makeScenario('Auth test'),
      auth: { type: 'oauth2', tokenUrl: 'http://auth/token', clientId: 'id', clientSecret: 'secret' },
    };
    const wrapped = wrapExport(test, 'test', {});
    const unwrapped = unwrapImport(wrapped) as Scenario;
    expect(unwrapped.auth).toEqual(test.auth);
  });

  it('round-trips validation config with selective fields', () => {
    const test: Scenario = {
      ...makeScenario('Validation test'),
      validation: {
        mode: 'selective',
        selectiveMode: 'include',
        expectedFields: [
          { jsonPath: '$.data.id', expectedValue: '123' },
          { jsonPath: '$.data.name', expectedValue: 'Test' },
        ],
        excludedPaths: ['$.timestamp'],
        unorderedArrays: true,
      },
    };
    const wrapped = wrapExport(test, 'test', {});
    const unwrapped = unwrapImport(wrapped) as Scenario;
    expect(unwrapped.validation).toEqual(test.validation);
  });
});

describe('reIdScenarios', () => {
  it('generates new IDs for scenarios and tests', () => {
    const original = [
      makeTestScenario('S1', [makeScenario('T1'), makeScenario('T2')]),
      makeTestScenario('S2', [makeScenario('T3')]),
    ];

    const result = reIdScenarios(original);

    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe(original[0].id);
    expect(result[1].id).not.toBe(original[1].id);
    expect(result[0].tests[0].id).not.toBe(original[0].tests[0].id);
    expect(result[0].tests[1].id).not.toBe(original[0].tests[1].id);
    expect(result[1].tests[0].id).not.toBe(original[1].tests[0].id);
  });

  it('preserves names and data', () => {
    const original = [makeTestScenario('My Scenario', [makeScenario('My Test')])];
    const result = reIdScenarios(original);

    expect(result[0].name).toBe('My Scenario');
    expect(result[0].tests[0].name).toBe('My Test');
    expect(result[0].tests[0].url).toBe('http://api/v1/test');
    expect(result[0].tests[0].method).toBe('GET');
  });

  it('all new IDs are unique', () => {
    const original = [
      makeTestScenario('S1', [makeScenario('T1'), makeScenario('T2')]),
      makeTestScenario('S2', [makeScenario('T3'), makeScenario('T4')]),
    ];
    const result = reIdScenarios(original);

    const allIds = [
      result[0].id, result[1].id,
      ...result[0].tests.map(t => t.id),
      ...result[1].tests.map(t => t.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('handles empty scenarios', () => {
    expect(reIdScenarios([])).toEqual([]);
  });

  it('handles scenario with no tests', () => {
    const result = reIdScenarios([{ id: 'sc1', name: 'Empty', tests: [] }]);
    expect(result).toHaveLength(1);
    expect(result[0].tests).toEqual([]);
    expect(result[0].id).not.toBe('sc1');
  });
});
