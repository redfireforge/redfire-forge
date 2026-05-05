import { describe, it, expect } from 'vitest';
import { computeStats, buildGroups } from './resultsGrouping';
import type { RequestResult } from '../../../shared/types';

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: '1',
    scenarioId: 's1',
    scenarioName: 'test-scenario',
    featureGroupName: 'Feature A',
    groupName: 'Group 1',
    url: 'http://example.com',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeStats
// ---------------------------------------------------------------------------
describe('computeStats', () => {
  it('computes stats for all-passing results', () => {
    const results = [
      makeResult({ responseTimeMs: 100 }),
      makeResult({ responseTimeMs: 200 }),
      makeResult({ responseTimeMs: 300 }),
    ];
    const stats = computeStats(results);
    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(3);
    expect(stats.failed).toBe(0);
    expect(stats.validationFailed).toBe(0);
    expect(stats.avgTime).toBe(200);
    expect(stats.minTime).toBe(100);
    expect(stats.maxTime).toBe(300);
  });

  it('counts HTTP failures (errorMessage present)', () => {
    const results = [
      makeResult({ passed: false, errorMessage: 'timeout' }),
      makeResult({ passed: false, errorMessage: '500 error' }),
      makeResult({ passed: true }),
    ];
    const stats = computeStats(results);
    expect(stats.failed).toBe(2);
    expect(stats.passed).toBe(1);
  });

  it('counts validation-only failures', () => {
    const results = [
      makeResult({
        passed: false,
        failureDetails: [{ path: '$.x', expected: '1', actual: '2' }],
      }),
    ];
    const stats = computeStats(results);
    expect(stats.validationFailed).toBe(1);
    expect(stats.failed).toBe(0);
  });

  it('handles empty results', () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgTime).toBe(0);
    expect(stats.minTime).toBe(0);
    expect(stats.maxTime).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildGroups
// ---------------------------------------------------------------------------
describe('buildGroups', () => {
  it('returns empty for no results', () => {
    expect(buildGroups([], ['feature'])).toEqual([]);
  });

  it('returns empty for no levels', () => {
    expect(buildGroups([makeResult()], [])).toEqual([]);
  });

  it('groups by feature', () => {
    const results = [
      makeResult({ featureGroupName: 'Auth' }),
      makeResult({ featureGroupName: 'Auth' }),
      makeResult({ featureGroupName: 'Payments' }),
    ];
    const groups = buildGroups(results, ['feature']);
    expect(groups.length).toBe(2);
    expect(groups.find(g => g.key === 'Auth')?.total).toBe(2);
    expect(groups.find(g => g.key === 'Payments')?.total).toBe(1);
  });

  it('groups by group name', () => {
    const results = [
      makeResult({ groupName: 'Suite A' }),
      makeResult({ groupName: 'Suite B' }),
    ];
    const groups = buildGroups(results, ['group']);
    expect(groups.length).toBe(2);
  });

  it('groups by test (scenario name)', () => {
    const results = [
      makeResult({ scenarioName: 'Login' }),
      makeResult({ scenarioName: 'Login' }),
      makeResult({ scenarioName: 'Logout' }),
    ];
    const groups = buildGroups(results, ['test']);
    expect(groups.length).toBe(2);
    expect(groups.find(g => g.key === 'Login')?.total).toBe(2);
  });

  it('handles multi-level grouping', () => {
    const results = [
      makeResult({ featureGroupName: 'Auth', groupName: 'Login Suite', scenarioName: 'Happy Path' }),
      makeResult({ featureGroupName: 'Auth', groupName: 'Login Suite', scenarioName: 'Bad Creds' }),
      makeResult({ featureGroupName: 'Auth', groupName: 'Signup Suite', scenarioName: 'New User' }),
    ];
    const groups = buildGroups(results, ['feature', 'group', 'test']);
    expect(groups.length).toBe(1);
    expect(groups[0].key).toBe('Auth');
    expect(groups[0].children.length).toBe(2);
    const loginSuite = groups[0].children.find(c => c.key === 'Login Suite')!;
    expect(loginSuite.children.length).toBe(2);
  });

  it('uses (unknown feature) for missing feature names', () => {
    const results = [makeResult({ featureGroupName: undefined })];
    const groups = buildGroups(results, ['feature']);
    expect(groups[0].key).toBe('(unknown feature)');
  });

  it('includes correct stats at each level', () => {
    const results = [
      makeResult({ featureGroupName: 'F1', responseTimeMs: 100 }),
      makeResult({ featureGroupName: 'F1', responseTimeMs: 200, passed: false, errorMessage: 'err' }),
    ];
    const groups = buildGroups(results, ['feature']);
    expect(groups[0].total).toBe(2);
    expect(groups[0].passed).toBe(1);
    expect(groups[0].failed).toBe(1);
    expect(groups[0].avgTime).toBe(150);
  });

  it('uses "(unknown group)" when groupName is empty', () => {
    const results = [
      makeResult({ groupName: '' }),
    ];
    const groups = buildGroups(results, ['group']);
    expect(groups[0].key).toBe('(unknown group)');
  });

  it('groups by dataRow using dataRowLabel', () => {
    const results = [
      makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1: VIN=ABC' }),
      makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1: VIN=ABC' }),
      makeResult({ dataRowId: 'r2', dataRowLabel: 'Row 2: VIN=DEF' }),
    ];
    const groups = buildGroups(results, ['dataRow']);
    expect(groups.length).toBe(2);
    expect(groups.find(g => g.key === 'Row 1: VIN=ABC')?.total).toBe(2);
    expect(groups.find(g => g.key === 'Row 2: VIN=DEF')?.total).toBe(1);
  });

  it('falls back to dataRowId when dataRowLabel is missing', () => {
    const results = [
      makeResult({ dataRowId: 'r1' }),
    ];
    const groups = buildGroups(results, ['dataRow']);
    expect(groups[0].key).toBe('r1');
  });

  it('uses "(no data row)" when both dataRowLabel and dataRowId are missing', () => {
    const results = [makeResult()];
    const groups = buildGroups(results, ['dataRow']);
    expect(groups[0].key).toBe('(no data row)');
  });

  it('handles test → dataRow multi-level grouping', () => {
    const results = [
      makeResult({ scenarioName: 'Test A', dataRowId: 'r1', dataRowLabel: 'Row 1' }),
      makeResult({ scenarioName: 'Test A', dataRowId: 'r2', dataRowLabel: 'Row 2' }),
      makeResult({ scenarioName: 'Test B' }),
    ];
    const groups = buildGroups(results, ['test', 'dataRow']);
    expect(groups.length).toBe(2);
    const testA = groups.find(g => g.key === 'Test A')!;
    expect(testA.children.length).toBe(2);
    expect(testA.children[0].key).toBe('Row 1');
  });
});
