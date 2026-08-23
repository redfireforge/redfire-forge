// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  selectOptionByIndex,
  getCustomSelectOptionLabels,
} from '@test-utils/customSelectHelper';
import { ResultsRequestDetailsTab } from './ResultsRequestDetailsTab';
import { makeResult, makeTestRun } from '@test-utils/factories';
import type { GroupNode } from '../../test-runner/utils/resultsGrouping';

function makeBaseProps() {
  const passing = makeResult({ id: 'r-1', scenarioName: 'Users List', url: 'https://api/users', method: 'GET', passed: true });
  const failingWithDetails = makeResult({
    id: 'r-2',
    scenarioName: 'Users Detail',
    url: 'https://api/users/1',
    method: 'GET',
    passed: false,
    failureDetails: [{ path: '$.id', expected: '2', actual: '1' }],
    errorMessage: undefined,
    dataRowId: 'row-1',
    dataRowLabel: 'Row 1',
    scenarioTags: ['critical'],
  });

  const groupNode: GroupNode = {
    key: 'Users',
    results: [passing, failingWithDetails],
    children: [],
    total: 2,
    passed: 1,
    failed: 1,
    validationFailed: 1,
    avgTime: 100,
    minTime: 80,
    maxTime: 120,
  };

  const selectedRun = makeTestRun({ results: [passing, failingWithDetails] });

  return {
    selectedRun,
    filteredResults: [passing, failingWithDetails],
    filterPassed: 'all',
    setFilterPassed: vi.fn(),
    resultTags: ['critical'],
    resultTagFilter: null,
    setResultTagFilter: vi.fn(),
    groupBy: 'feature' as const,
    handleGroupByChange: vi.fn(),
    subGroupOptions: [{ value: 'group' as const, label: 'Scenario' }],
    subGroupBy: 'group' as const,
    setSubGroupBy: vi.fn(),
    setExpanded: vi.fn(),
    expanded: new Set<string>(['Users']),
    groupCount: 1,
    isFlat: false,
    groupTree: [groupNode],
    toggle: vi.fn(),
    searchTerm: '',
    setSearchTerm: vi.fn(),
    page: 0,
    setPage: vi.fn(),
    pageSize: 50,
    isWorkflowRun: false,
    onResultClick: vi.fn(),
    renderErrorSnippet: vi.fn(() => null),
  };
}

describe('ResultsRequestDetailsTab', () => {
  it('updates filter and search controls', () => {
    const props = makeBaseProps();
    render(<ResultsRequestDetailsTab {...props} />);

    selectOptionByIndex(document.body, 0, 'Failed Only');
    selectOptionByIndex(document.body, 1, 'Scenario');
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'users' } });

    expect(props.setFilterPassed).toHaveBeenCalledWith('failed');
    expect(props.handleGroupByChange).toHaveBeenCalledWith('group');
    expect(props.setPage).toHaveBeenCalledWith(0);
    expect(props.setSearchTerm).toHaveBeenCalledWith('users');
  });

  it('renders grouped rows and toggles a group row click', () => {
    const props = makeBaseProps();
    render(<ResultsRequestDetailsTab {...props} />);

    expect(screen.getByText('Group by')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();

    fireEvent.click(screen.getByText('Users'));
    expect(props.toggle).toHaveBeenCalledWith('Users');
  });

  it('shows failed-data-rows filter option when selected run has data rows', () => {
    const props = makeBaseProps();
    render(<ResultsRequestDetailsTab {...props} />);
    expect(getCustomSelectOptionLabels(document.body, 0)).toContain('Failed Data Rows');
  });

  it('renders flat table rows and row click forwards result', () => {
    const props = makeBaseProps();
    const first = props.filteredResults[0];
    render(<ResultsRequestDetailsTab {...props} isFlat groupTree={[]} />);

    fireEvent.click(screen.getByText('Users List'));
    expect(props.onResultClick).toHaveBeenCalledWith(first);
  });

  it('clicking validation failure snippet opens details once', () => {
    const props = makeBaseProps();
    render(<ResultsRequestDetailsTab {...props} isFlat groupTree={[]} renderErrorSnippet={() => null} />);

    const snippet = screen.getByText('1 validation failure');
    fireEvent.click(snippet);
    expect(props.onResultClick).toHaveBeenCalledTimes(1);
    expect(props.onResultClick).toHaveBeenCalledWith(props.filteredResults[1]);
  });

  it('clicking grouped validation snippet opens details', () => {
    const props = makeBaseProps();
    const noDataRows = [
      makeResult({ id: 'g-1', scenarioName: 'Grouped Fail', passed: false, errorMessage: undefined, failureDetails: [{ path: '$.x', expected: '1', actual: '0' }] }),
    ];
    const group: GroupNode = {
      key: 'Grouped',
      results: noDataRows,
      children: [],
      total: 1,
      passed: 0,
      failed: 1,
      validationFailed: 0,
      avgTime: 1,
      minTime: 1,
      maxTime: 1,
    };
    render(<ResultsRequestDetailsTab {...props} filteredResults={noDataRows} groupTree={[group]} expanded={new Set(['Grouped'])} />);
    fireEvent.click(screen.getByText('1 validation failure'));
    expect(props.onResultClick).toHaveBeenCalledWith(noDataRows[0]);
  });

  it('renders ungrouped root rows and detail header when group key is empty', () => {
    const props = makeBaseProps();
    const noDataRows = [
      makeResult({ id: 'u-1', scenarioName: 'Ungrouped 1', passed: true, dataRowId: undefined, dataRowLabel: undefined }),
      makeResult({ id: 'u-2', scenarioName: 'Ungrouped 2', passed: false, dataRowId: undefined, dataRowLabel: undefined }),
    ];
    const emptyRoot: GroupNode = {
      key: '',
      results: noDataRows,
      children: [],
      total: 2,
      passed: 1,
      failed: 1,
      validationFailed: 1,
      avgTime: 90,
      minTime: 80,
      maxTime: 100,
    };
    render(<ResultsRequestDetailsTab {...props} filteredResults={noDataRows} groupTree={[emptyRoot]} expanded={new Set()} />);
    expect(screen.getByText('Error / Details')).toBeTruthy();
  });

  it('renders child groups when parent is expanded', () => {
    const props = makeBaseProps();
    const child: GroupNode = {
      key: 'Child',
      results: [props.filteredResults[0]],
      children: [],
      total: 1,
      passed: 1,
      failed: 0,
      validationFailed: 0,
      avgTime: 100,
      minTime: 100,
      maxTime: 100,
    };
    const parent: GroupNode = {
      key: 'Parent',
      results: [props.filteredResults[0]],
      children: [child],
      total: 1,
      passed: 1,
      failed: 0,
      validationFailed: 0,
      avgTime: 100,
      minTime: 100,
      maxTime: 100,
    };
    render(<ResultsRequestDetailsTab {...props} groupTree={[parent]} expanded={new Set(['Parent'])} />);
    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('updates tag filter and subgroup selection controls', () => {
    const props = makeBaseProps();
    render(<ResultsRequestDetailsTab {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'critical' }));
    expect(props.setResultTagFilter).toHaveBeenCalledWith('critical');

    selectOptionByIndex(document.body, 2, 'Scenario');
    expect(props.setSubGroupBy).toHaveBeenCalledWith('group');
    expect(props.setExpanded).toHaveBeenCalled();
  });

  it('shows workflow-specific group options when isWorkflowRun is true', () => {
    const props = makeBaseProps();
    render(<ResultsRequestDetailsTab {...props} isWorkflowRun />);
    const groupByLabels = getCustomSelectOptionLabels(document.body, 1);
    expect(groupByLabels).toContain('Iteration');
    expect(groupByLabels).toContain('Workflow Step');
  });

  it('renders pagination and fires navigation actions in flat view', () => {
    const props = makeBaseProps();
    const manyResults = Array.from({ length: 55 }, (_, i) =>
      makeResult({ id: `row-${i + 1}`, scenarioName: `Scenario ${i + 1}`, passed: i % 2 === 0 }),
    );
    render(
      <ResultsRequestDetailsTab
        {...props}
        isFlat
        groupTree={[]}
        filteredResults={manyResults}
        page={0}
        pageSize={50}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Last' }));
    expect(props.setPage).toHaveBeenCalled();
  });

  it('handles First and Prev pagination actions when page is not zero', () => {
    const props = makeBaseProps();
    const manyResults = Array.from({ length: 120 }, (_, i) => makeResult({ id: `p-${i + 1}` }));
    render(
      <ResultsRequestDetailsTab
        {...props}
        isFlat
        groupTree={[]}
        filteredResults={manyResults}
        page={1}
        pageSize={50}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    expect(props.setPage).toHaveBeenCalled();
  });

  it('applies passed/failed/failed-data-rows filters in grouped detail rows', () => {
    const base = makeBaseProps();
    const noDataRowResults = [
      makeResult({ id: 'p-1', scenarioName: 'Pass', passed: true }),
      makeResult({ id: 'f-1', scenarioName: 'Fail', passed: false }),
    ];
    const withDataRowResults = [
      ...noDataRowResults,
      makeResult({ id: 'f-2', scenarioName: 'Fail Row', passed: false, dataRowId: 'row-9', dataRowLabel: 'Row 9' }),
    ];
    const groupNoDataRows: GroupNode = {
      key: 'G',
      results: noDataRowResults,
      children: [],
      total: 2,
      passed: 1,
      failed: 1,
      validationFailed: 0,
      avgTime: 1,
      minTime: 1,
      maxTime: 1,
    };
    const groupWithDataRows: GroupNode = {
      ...groupNoDataRows,
      results: withDataRowResults,
      total: 3,
      failed: 2,
    };

    const { rerender } = render(
      <ResultsRequestDetailsTab {...base} filterPassed="passed" filteredResults={noDataRowResults} groupTree={[groupNoDataRows]} expanded={new Set(['G'])} />,
    );
    expect(screen.getByText('Pass')).toBeTruthy();
    expect(screen.queryByText('Fail')).toBeNull();

    rerender(
      <ResultsRequestDetailsTab {...base} filterPassed="failed" filteredResults={noDataRowResults} groupTree={[groupNoDataRows]} expanded={new Set(['G'])} />,
    );
    expect(screen.getByText('Fail')).toBeTruthy();
    expect(screen.queryByText('Pass')).toBeNull();

    rerender(
      <ResultsRequestDetailsTab {...base} filterPassed="failed-data-rows" filteredResults={withDataRowResults} groupTree={[groupWithDataRows]} expanded={new Set(['G'])} />,
    );
    expect(screen.getByText(/1\s+rows/)).toBeTruthy();
  });

  it('renders ungrouped root with child groups', () => {
    const props = makeBaseProps();
    const child: GroupNode = {
      key: 'FromRoot',
      results: [makeResult({ id: 'c-1', scenarioName: 'Child Scenario' })],
      children: [],
      total: 1,
      passed: 1,
      failed: 0,
      validationFailed: 0,
      avgTime: 1,
      minTime: 1,
      maxTime: 1,
    };
    const root: GroupNode = {
      key: '',
      results: [],
      children: [child],
      total: 1,
      passed: 1,
      failed: 0,
      validationFailed: 0,
      avgTime: 1,
      minTime: 1,
      maxTime: 1,
    };
    render(<ResultsRequestDetailsTab {...props} groupTree={[root]} expanded={new Set(['__ungrouped__/FromRoot'])} />);
    expect(screen.getByText('FromRoot')).toBeTruthy();
  });

  it('clicking All tag clears filter', () => {
    const props = makeBaseProps();
    render(<ResultsRequestDetailsTab {...props} resultTagFilter="critical" />);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(props.setResultTagFilter).toHaveBeenCalledWith(null);
  });

  it('renders ERR status, none validation fallback, and plural validation failures', () => {
    const props = makeBaseProps();
    const row = makeResult({
      id: 'z-1',
      scenarioName: 'Plural Case',
      passed: false,
      httpStatus: 0,
      validationMode: undefined,
      errorMessage: undefined,
      failureDetails: [
        { path: '$.a', expected: '1', actual: '0' },
        { path: '$.b', expected: '2', actual: '0' },
      ],
    });
    render(<ResultsRequestDetailsTab {...props} isFlat groupTree={[]} filteredResults={[row]} />);
    expect(screen.getByText('ERR')).toBeTruthy();
    expect(screen.getByText('none')).toBeTruthy();
    expect(screen.getByText('2 validation failures')).toBeTruthy();
  });

  it('shows PRODUCE label in status column for Kafka produce result (flat view)', () => {
    const props = makeBaseProps();
    const row = makeResult({
      id: 'kp-1',
      scenarioName: 'Kafka Produce',
      passed: false,
      transportType: 'kafkaProduce',
      method: 'KAFKA',
      httpStatus: undefined as unknown as number,
    });
    render(<ResultsRequestDetailsTab {...props} isFlat groupTree={[]} filteredResults={[row]} />);
    expect(screen.getAllByText('PRODUCE').length).toBeGreaterThanOrEqual(1);
  });

  it('shows CONSUME label in status column for Kafka consume result (flat view)', () => {
    const props = makeBaseProps();
    const row = makeResult({
      id: 'kc-1',
      scenarioName: 'Kafka Consume',
      passed: false,
      transportType: 'kafkaConsume',
      method: 'KAFKA',
      httpStatus: undefined as unknown as number,
    });
    render(<ResultsRequestDetailsTab {...props} isFlat groupTree={[]} filteredResults={[row]} />);
    expect(screen.getAllByText('CONSUME').length).toBeGreaterThanOrEqual(1);
  });
});
