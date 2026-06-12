// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsDashboardHeader, RunTypeFilterTabs } from './ResultsDashboardHeader';
import { makeTestRun } from '../../../test-utils/factories';

// Mock the export side-effecting helpers so clicking Export buttons does not
// attempt real file downloads, while still letting us assert they were called.
const exportJson = vi.fn();
const exportCsv = vi.fn();
vi.mock('../../../shared/utils/export', () => ({
  exportJson: (...args: unknown[]) => exportJson(...args),
  exportCsv: (...args: unknown[]) => exportCsv(...args),
}));

function makeProps(overrides: Partial<React.ComponentProps<typeof ResultsDashboardHeader>> = {}) {
  return {
    selectedRun: null,
    importError: null,
    traceLoading: false,
    reportMenuOpen: false,
    onRefresh: vi.fn(),
    onImportTrace: vi.fn(),
    onOpenResultsExplorer: vi.fn(),
    onGenerateReport: vi.fn(),
    onDelete: vi.fn(),
    onReportMenuToggle: vi.fn(),
    setImportError: vi.fn(),
    setReplayTrace: vi.fn(),
    setImportedFileName: vi.fn(),
    setShowReplayModal: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  exportJson.mockClear();
  exportCsv.mockClear();
});

describe('ResultsDashboardHeader', () => {
  it('renders the base header with no selected run', () => {
    const props = makeProps();
    render(<ResultsDashboardHeader {...props} />);
    expect(screen.getByRole('heading', { name: 'Results' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Import Trace/ })).toBeTruthy();
    // No run-specific buttons
    expect(screen.queryByRole('button', { name: 'Export JSON' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('shows import error when provided', () => {
    render(<ResultsDashboardHeader {...makeProps({ importError: 'Bad file' })} />);
    expect(screen.getByText('Bad file')).toBeTruthy();
  });

  it('calls onRefresh when Refresh is clicked', () => {
    const props = makeProps();
    render(<ResultsDashboardHeader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('clicking Import Trace triggers the hidden file input click', () => {
    const props = makeProps();
    render(<ResultsDashboardHeader {...props} />);
    const input = screen.getByTestId('import-trace-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: /Import Trace/ }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onImportTrace when the file input changes', () => {
    const props = makeProps();
    render(<ResultsDashboardHeader {...props} />);
    fireEvent.change(screen.getByTestId('import-trace-input'));
    expect(props.onImportTrace).toHaveBeenCalledTimes(1);
  });

  it('renders run actions and context tags when a run is selected', () => {
    const run = makeTestRun({ envName: 'prod', svcName: 'svc-a' });
    render(<ResultsDashboardHeader {...makeProps({ selectedRun: run })} />);
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByText('prod')).toBeTruthy();
  });

  it('does not show the Results Explorer button when there is no execution trace', () => {
    const run = makeTestRun();
    render(<ResultsDashboardHeader {...makeProps({ selectedRun: run })} />);
    expect(screen.queryByRole('button', { name: /Results Explorer/ })).toBeNull();
  });

  it('shows the Results Explorer button when the run has an execution trace', () => {
    const run = makeTestRun({ hasTrace: true });
    const props = makeProps({ selectedRun: run });
    render(<ResultsDashboardHeader {...props} />);
    const btn = screen.getByRole('button', { name: /Results Explorer/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(props.onOpenResultsExplorer).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables the Results Explorer button when traceLoading', () => {
    const run = makeTestRun({ hasTrace: true });
    render(<ResultsDashboardHeader {...makeProps({ selectedRun: run, traceLoading: true })} />);
    const btn = screen.getByRole('button', { name: /Loading trace/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls exportJson and exportCsv on the corresponding buttons', () => {
    const run = makeTestRun({ envName: 'prod', svcName: 'svc-a' });
    render(<ResultsDashboardHeader {...makeProps({ selectedRun: run })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(exportJson).toHaveBeenCalledWith(run);
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(exportCsv).toHaveBeenCalledWith(run.results, 'prod', 'svc-a');
  });

  it('toggles the report menu and triggers report generation', () => {
    const run = makeTestRun();
    const props = makeProps({ selectedRun: run });
    const { rerender } = render(<ResultsDashboardHeader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/ }));
    expect(props.onReportMenuToggle).toHaveBeenCalledTimes(1);
    // Dropdown is hidden when reportMenuOpen is false
    expect(screen.queryByRole('button', { name: 'HTML Report' })).toBeNull();

    rerender(<ResultsDashboardHeader {...props} reportMenuOpen={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'HTML Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'JSON Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Markdown Report' }));
    expect(props.onGenerateReport).toHaveBeenNthCalledWith(1, 'html');
    expect(props.onGenerateReport).toHaveBeenNthCalledWith(2, 'json');
    expect(props.onGenerateReport).toHaveBeenNthCalledWith(3, 'markdown');
  });

  it('calls onDelete with the run id', () => {
    const run = makeTestRun();
    const props = makeProps({ selectedRun: run });
    render(<ResultsDashboardHeader {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onDelete).toHaveBeenCalledWith(run.id);
  });
});

describe('RunTypeFilterTabs', () => {
  it('renders counts, marks the active tab, and fires filter changes', () => {
    const onFilterChange = vi.fn();
    render(
      <RunTypeFilterTabs
        runTypeFilter="all"
        runCounts={{ all: 7, test: 4, workflow: 3 }}
        onFilterChange={onFilterChange}
      />,
    );

    const allTab = screen.getByRole('button', { name: 'All Runs (7)' });
    expect(allTab.className).toContain('active');

    fireEvent.click(screen.getByRole('button', { name: /Test Runs \(4\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /Workflow Runs \(3\)/ }));
    fireEvent.click(allTab);

    expect(onFilterChange).toHaveBeenNthCalledWith(1, 'test');
    expect(onFilterChange).toHaveBeenNthCalledWith(2, 'workflow');
    expect(onFilterChange).toHaveBeenNthCalledWith(3, 'all');
  });

  it('marks the test tab active when selected', () => {
    render(
      <RunTypeFilterTabs
        runTypeFilter="test"
        runCounts={{ all: 1, test: 1, workflow: 0 }}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Test Runs/ }).className).toContain('active');
    expect(screen.getByRole('button', { name: /All Runs/ }).className).not.toContain('active');
  });
});
