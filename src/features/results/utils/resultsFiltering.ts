import type { RequestResult, TestRun } from '@shared/types';

export type RunTypeFilter = 'all' | 'test' | 'workflow';

export function filterVisibleRuns(
  allRuns: TestRun[],
  envName: string | undefined,
  svcName: string | undefined,
  runTypeFilter: RunTypeFilter,
): TestRun[] {
  return allRuns.filter((run) => {
    const isWorkflowRun = run.config.executionMode === 'workflow';

    if (!isWorkflowRun) {
      const isUnscoped = !run.svcName;
      if (!isUnscoped) {
        if (envName && run.envName && run.envName !== envName) return false;
        if (svcName && run.svcName && run.svcName !== svcName) return false;
      }
    }

    if (runTypeFilter === 'workflow' && !isWorkflowRun) return false;
    if (runTypeFilter === 'test' && isWorkflowRun) return false;
    return true;
  });
}

export function computeRunCounts(
  allRuns: TestRun[],
  envName: string | undefined,
  svcName: string | undefined,
): { all: number; test: number; workflow: number } {
  const testRuns = allRuns.filter((run) => {
    if (run.config.executionMode === 'workflow') return false;
    const isUnscoped = !run.svcName;
    if (!isUnscoped) {
      if (envName && run.envName && run.envName !== envName) return false;
      if (svcName && run.svcName && run.svcName !== svcName) return false;
    }
    return true;
  });

  const workflowRuns = allRuns.filter((run) => run.config.executionMode === 'workflow');
  return {
    all: testRuns.length + workflowRuns.length,
    test: testRuns.length,
    workflow: workflowRuns.length,
  };
}

export function computeFilteredResults(
  selectedRun: TestRun | null,
  filterPassed: string,
  resultTagFilter: string | null,
  searchTerm: string,
): RequestResult[] {
  if (!selectedRun) return [];
  const query = searchTerm.toLowerCase().trim();

  return selectedRun.results.filter((result) => {
    const passed = !!result.passed;
    if (filterPassed === 'passed' && !passed) return false;
    if (filterPassed === 'failed' && passed) return false;
    if (filterPassed === 'failed-data-rows' && (passed || !result.dataRowId)) return false;
    if (resultTagFilter && !(result.scenarioTags ?? []).includes(resultTagFilter)) return false;

    if (
      query
      && !(
        result.scenarioName.toLowerCase().includes(query)
        || result.url.toLowerCase().includes(query)
        || result.featureGroupName?.toLowerCase().includes(query)
        || result.groupName?.toLowerCase().includes(query)
        || result.errorMessage?.toLowerCase().includes(query)
        || result.dataRowLabel?.toLowerCase().includes(query)
        || (result.scenarioTags ?? []).some((tag) => tag.toLowerCase().includes(query))
      )
    ) {
      return false;
    }

    return true;
  });
}
