import { describe, it, expect } from 'vitest';
import { computeStats, buildGroups, hasWorkflowData, getWorkflowSteps, getIterationCount, computeWorkflowStepSummaries, computeWorkflowIterationSummaries, } from './resultsGrouping';
import { RequestResult } from '../../../shared/types';
import { makeResult as _makeResult } from '../../../test-utils/factories';

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return _makeResult({
    id: '1',
    scenarioName: 'test-scenario',
    featureGroupName: 'Feature A',
    groupName: 'Group 1',
    url: 'http://example.com',
    ...overrides,
  });
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

  it('counts failed results without errorMessage or failureDetails', () => {
    const results = [
      makeResult({ passed: false }),
      makeResult({ passed: true }),
    ];
    const stats = computeStats(results);
    expect(stats.total).toBe(2);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.validationFailed).toBe(0);
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

  it('uses empty string for missing feature names (no synthetic label)', () => {
    const results = [makeResult({ featureGroupName: undefined })];
    const groups = buildGroups(results, ['feature']);
    expect(groups[0].key).toBe('');
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

  it('falls back to scenarioName when groupName is empty', () => {
    const results = [makeResult({ groupName: '' })];
    const groups = buildGroups(results, ['group']);
    expect(groups[0].key).toBe('test-scenario');
  });

  it('uses "(unknown group)" when both groupName and scenarioName are empty', () => {
    const results = [makeResult({ groupName: '', scenarioName: '' })];
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

  it('groups by workflowStep using workflowNodeId', () => {
    const results = [
      makeResult({ workflowNodeId: 'step1', scenarioName: 'Create Order' }),
      makeResult({ workflowNodeId: 'step1', scenarioName: 'Create Order' }),
      makeResult({ workflowNodeId: 'step2', scenarioName: 'Get Order' }),
    ];
    const groups = buildGroups(results, ['workflowStep']);
    expect(groups.length).toBe(2);
    expect(groups.find(g => g.key === 'step1')?.total).toBe(2);
    expect(groups.find(g => g.key === 'step2')?.total).toBe(1);
  });

  it('uses scenarioName for workflowStep when workflowNodeId is missing', () => {
    const results = [makeResult({ scenarioName: 'HTTP Step' })];
    const groups = buildGroups(results, ['workflowStep']);
    expect(groups[0].key).toBe('HTTP Step');
  });

  it('falls back to (unknown step) when both workflowNodeId and scenarioName are empty', () => {
    const results = [makeResult({ workflowNodeId: undefined, scenarioName: '' })];
    const groups = buildGroups(results, ['workflowStep']);
    expect(groups[0].key).toBe('(unknown step)');
  });

  it('falls back to (unknown iteration) when iterationIndex is undefined', () => {
    const results = [makeResult({ iterationIndex: undefined })];
    const groups = buildGroups(results, ['iteration']);
    expect(groups[0].key).toBe('(unknown iteration)');
  });

  it('groups by iteration using iterationIndex', () => {
    const results = [
      makeResult({ iterationIndex: 0 }),
      makeResult({ iterationIndex: 0 }),
      makeResult({ iterationIndex: 1 }),
      makeResult({ iterationIndex: 2 }),
    ];
    const groups = buildGroups(results, ['iteration']);
    expect(groups.length).toBe(3);
    expect(groups[0].key).toBe('Iteration #0');
    expect(groups[0].total).toBe(2);
  });

  it('sorts iteration groups numerically', () => {
    const results = [
      makeResult({ iterationIndex: 10 }),
      makeResult({ iterationIndex: 2 }),
      makeResult({ iterationIndex: 1 }),
    ];
    const groups = buildGroups(results, ['iteration']);
    expect(groups[0].key).toBe('Iteration #1');
    expect(groups[1].key).toBe('Iteration #2');
    expect(groups[2].key).toBe('Iteration #10');
  });

  it('handles iteration → workflowStep multi-level grouping', () => {
    const results = [
      makeResult({ iterationIndex: 0, workflowNodeId: 'step1' }),
      makeResult({ iterationIndex: 0, workflowNodeId: 'step2' }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'step1' }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'step2' }),
    ];
    const groups = buildGroups(results, ['iteration', 'workflowStep']);
    expect(groups.length).toBe(2);
    expect(groups[0].children.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Workflow helpers
// ---------------------------------------------------------------------------
describe('hasWorkflowData', () => {
  it('returns false when no workflow data present', () => {
    const results = [makeResult(), makeResult()];
    expect(hasWorkflowData(results)).toBe(false);
  });

  it('returns true when iterationIndex is present', () => {
    const results = [makeResult({ iterationIndex: 0 })];
    expect(hasWorkflowData(results)).toBe(true);
  });

  it('returns true when workflowNodeId is present', () => {
    const results = [makeResult({ workflowNodeId: 'node1' })];
    expect(hasWorkflowData(results)).toBe(true);
  });
});

describe('getWorkflowSteps', () => {
  it('returns empty array for no results', () => {
    expect(getWorkflowSteps([])).toEqual([]);
  });

  it('returns unique step names from workflowNodeId', () => {
    const results = [
      makeResult({ workflowNodeId: 'step1' }),
      makeResult({ workflowNodeId: 'step1' }),
      makeResult({ workflowNodeId: 'step2' }),
    ];
    expect(getWorkflowSteps(results)).toEqual(['step1', 'step2']);
  });

  it('falls back to scenarioName when workflowNodeId is missing', () => {
    const results = [makeResult({ scenarioName: 'HTTP Request' })];
    expect(getWorkflowSteps(results)).toEqual(['HTTP Request']);
  });

  it('skips results where both workflowNodeId and scenarioName are empty', () => {
    const results = [makeResult({ workflowNodeId: '', scenarioName: '' })];
    expect(getWorkflowSteps(results)).toEqual([]);
  });
});

describe('getIterationCount', () => {
  it('returns 0 for no results', () => {
    expect(getIterationCount([])).toBe(0);
  });

  it('returns 0 when no iterationIndex present', () => {
    const results = [makeResult(), makeResult()];
    expect(getIterationCount(results)).toBe(0);
  });

  it('counts unique iterations', () => {
    const results = [
      makeResult({ iterationIndex: 0 }),
      makeResult({ iterationIndex: 0 }),
      makeResult({ iterationIndex: 1 }),
      makeResult({ iterationIndex: 2 }),
    ];
    expect(getIterationCount(results)).toBe(3);
  });
});

describe('computeWorkflowStepSummaries', () => {
  it('computes per-step summaries', () => {
    const results = [
      makeResult({ workflowNodeId: 'step1', responseTimeMs: 100, passed: true }),
      makeResult({ workflowNodeId: 'step1', responseTimeMs: 200, passed: true }),
      makeResult({ workflowNodeId: 'step2', responseTimeMs: 300, passed: false, errorMessage: 'err' }),
    ];
    const summaries = computeWorkflowStepSummaries(results);
    expect(summaries.length).toBe(2);
    
    const step1 = summaries.find(s => s.stepName === 'step1')!;
    expect(step1.total).toBe(2);
    expect(step1.passed).toBe(2);
    expect(step1.passRate).toBe(100);
    expect(step1.avgTime).toBe(150);
    
    const step2 = summaries.find(s => s.stepName === 'step2')!;
    expect(step2.total).toBe(1);
    expect(step2.passed).toBe(0);
    expect(step2.passRate).toBe(0);
  });

  it('returns empty array for no results', () => {
    expect(computeWorkflowStepSummaries([])).toEqual([]);
  });

  it('includes percentile fields with fallback to 0', () => {
    const results = [
      makeResult({ workflowNodeId: 'step1', responseTimeMs: 50, passed: true }),
    ];
    const summaries = computeWorkflowStepSummaries(results);
    expect(summaries[0].p50Time).toBeGreaterThanOrEqual(0);
    expect(summaries[0].p95Time).toBeGreaterThanOrEqual(0);
    expect(summaries[0].p99Time).toBeGreaterThanOrEqual(0);
  });
});

describe('computeWorkflowIterationSummaries', () => {
  it('computes per-iteration summaries', () => {
    const results = [
      makeResult({ iterationIndex: 0, responseTimeMs: 100, passed: true }),
      makeResult({ iterationIndex: 0, responseTimeMs: 200, passed: true }),
      makeResult({ iterationIndex: 1, responseTimeMs: 150, passed: true }),
      makeResult({ iterationIndex: 1, responseTimeMs: 250, passed: false, errorMessage: 'err' }),
    ];
    const summaries = computeWorkflowIterationSummaries(results);
    expect(summaries.length).toBe(2);
    
    expect(summaries[0].iterationIndex).toBe(0);
    expect(summaries[0].allPassed).toBe(true);
    expect(summaries[0].totalTime).toBe(300);
    
    expect(summaries[1].iterationIndex).toBe(1);
    expect(summaries[1].allPassed).toBe(false);
    expect(summaries[1].totalTime).toBe(400);
  });

  it('sorts iterations by index', () => {
    const results = [
      makeResult({ iterationIndex: 2 }),
      makeResult({ iterationIndex: 0 }),
      makeResult({ iterationIndex: 1 }),
    ];
    const summaries = computeWorkflowIterationSummaries(results);
    expect(summaries[0].iterationIndex).toBe(0);
    expect(summaries[1].iterationIndex).toBe(1);
    expect(summaries[2].iterationIndex).toBe(2);
  });
});

describe('computeStats percentiles', () => {
  it('computes percentile metrics', () => {
    const results: RequestResult[] = [];
    for (let i = 1; i <= 100; i++) {
      results.push(makeResult({ id: String(i), responseTimeMs: i * 10 }));
    }
    const stats = computeStats(results);
    expect(stats.p50Time).toBe(510);
    expect(stats.p95Time).toBe(960);
    expect(stats.p99Time).toBe(1000);
  });
});
