import { describe, expect, it } from 'vitest';
import { makeResult, makeTestRun } from '../../../test-utils/factories';
import { computeFilteredResults, computeRunCounts, filterVisibleRuns } from './resultsFiltering';

describe('resultsFiltering utils', () => {
  it('filters visible runs by env/svc and run type while keeping workflow runs global', () => {
    const unscopedTestRun = makeTestRun({ id: 'unscoped', svcName: '', envName: '', config: { ...makeTestRun().config, executionMode: 'pool' } });
    const matchingScopedRun = makeTestRun({ id: 'match', svcName: 'svc-a', envName: 'dev', config: { ...makeTestRun().config, executionMode: 'pool' } });
    const mismatchedScopedRun = makeTestRun({ id: 'mismatch', svcName: 'svc-b', envName: 'dev', config: { ...makeTestRun().config, executionMode: 'pool' } });
    const workflowRun = makeTestRun({ id: 'workflow', svcName: 'svc-b', envName: 'prod', config: { ...makeTestRun().config, executionMode: 'workflow' } });

    const allRuns = [unscopedTestRun, matchingScopedRun, mismatchedScopedRun, workflowRun];

    expect(filterVisibleRuns(allRuns, 'dev', 'svc-a', 'all').map((r) => r.id)).toEqual(['unscoped', 'match', 'workflow']);
    expect(filterVisibleRuns(allRuns, 'dev', 'svc-a', 'test').map((r) => r.id)).toEqual(['unscoped', 'match']);
    expect(filterVisibleRuns(allRuns, 'dev', 'svc-a', 'workflow').map((r) => r.id)).toEqual(['workflow']);
  });

  it('computes run counts with env/svc constraints for test runs only', () => {
    const runs = [
      makeTestRun({ id: 'test-match', svcName: 'svc-a', envName: 'dev', config: { ...makeTestRun().config, executionMode: 'pool' } }),
      makeTestRun({ id: 'test-other-env', svcName: 'svc-a', envName: 'prod', config: { ...makeTestRun().config, executionMode: 'pool' } }),
      makeTestRun({ id: 'test-unscoped', svcName: '', envName: '', config: { ...makeTestRun().config, executionMode: 'pool' } }),
      makeTestRun({ id: 'workflow', svcName: 'svc-z', envName: 'qa', config: { ...makeTestRun().config, executionMode: 'workflow' } }),
    ];

    expect(computeRunCounts(runs, 'dev', 'svc-a')).toEqual({ all: 3, test: 2, workflow: 1 });
  });

  it('filters selected run results by pass/fail mode, tag filter, and search term', () => {
    const selectedRun = makeTestRun({
      id: 'run-filter',
      results: [
        makeResult({ id: 'p1', passed: true, scenarioName: 'Happy path', url: 'https://api.local/pass', scenarioTags: ['smoke'] }),
        makeResult({ id: 'f1', passed: false, dataRowId: 'row-1', scenarioName: 'Failure path', url: 'https://api.local/fail', errorMessage: 'Timeout', scenarioTags: ['nightly'] }),
        makeResult({ id: 'f2', passed: false, dataRowId: undefined, scenarioName: 'Group failure', url: 'https://api.local/group', groupName: 'checkout', scenarioTags: ['regression'] }),
      ],
    });

    expect(computeFilteredResults(null, 'all', null, '')).toEqual([]);
    expect(computeFilteredResults(selectedRun, 'passed', null, '').map((r) => r.id)).toEqual(['p1']);
    expect(computeFilteredResults(selectedRun, 'failed', null, '').map((r) => r.id)).toEqual(['f1', 'f2']);
    expect(computeFilteredResults(selectedRun, 'failed-data-rows', null, '').map((r) => r.id)).toEqual(['f1']);
    expect(computeFilteredResults(selectedRun, 'all', 'nightly', '').map((r) => r.id)).toEqual(['f1']);
    expect(computeFilteredResults(selectedRun, 'all', null, 'timeout').map((r) => r.id)).toEqual(['f1']);
    expect(computeFilteredResults(selectedRun, 'all', null, 'checkout').map((r) => r.id)).toEqual(['f2']);
    expect(computeFilteredResults(selectedRun, 'all', null, 'smoke').map((r) => r.id)).toEqual(['p1']);
  });
});
