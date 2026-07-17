/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CsvTemplateExportModal from './CsvTemplateExportModal';
import type { Scenario } from '../../../shared/types';
import type { ColumnDef, ExportOptions } from '../utils/csvTemplate';

const mockAnalyzeUrlPath = vi.fn();
const mockBuildColumnDefs = vi.fn();
const mockGenerateExcelTemplate = vi.fn(() => ({ wb: true }));
const mockDownloadExcel = vi.fn(() => Promise.resolve());

vi.mock('../utils/csvTemplate', () => ({
  analyzeUrlPath: (...a: unknown[]) => mockAnalyzeUrlPath(...a),
  buildColumnDefs: (...a: unknown[]) => mockBuildColumnDefs(...a),
  generateExcelTemplate: (...a: unknown[]) => mockGenerateExcelTemplate(...a),
  downloadExcel: (...a: unknown[]) => mockDownloadExcel(...a),
}));

vi.mock('../../../shared/components/FullPanelModal', () => ({
  default: ({ title, children, footer }: {
    title: React.ReactNode; children: React.ReactNode; footer: React.ReactNode; onClose: () => void;
  }) => (
    <div data-testid="panel-modal">
      <div data-testid="panel-title">{title}</div>
      <div data-testid="panel-body">{children}</div>
      <div data-testid="panel-footer">{footer}</div>
    </div>
  ),
}));

function makeTest(over: Partial<Scenario> = {}): Scenario {
  return {
    id: 't1',
    name: 'Get User',
    url: 'http://api.example.com/users/123?q=x',
    method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '{"a":1}',
    auth: { type: 'none' },
    validation: {
      mode: 'exact',
      unorderedArrays: true,
      excludedPaths: ['$.ts'],
      expectedFields: [{ jsonPath: '$.status', expectedValue: 'active' }],
    } as Scenario['validation'],
    ...over,
  };
}

function defaultDefs(): ColumnDef[] {
  return [
    { type: 'name', fullKey: 'name', mapping: '', autoName: 'test_name', customName: 'test_name' },
    { type: 'path', fullKey: 'path:userId', mapping: 'userId', autoName: 'userId', customName: 'userId' },
    { type: 'param', fullKey: 'param:q', mapping: 'q', autoName: 'q', customName: 'q' },
    { type: 'validate', fullKey: 'validate:$.status', mapping: '$.status', autoName: 'status', customName: 'status' },
  ];
}

beforeEach(() => {
  resetAllMocks();
  mockAnalyzeUrlPath.mockReturnValue({
    origin: 'http://api.example.com',
    segments: [
      { index: 0, segment: 'users', suggestedVariable: false, variableName: '' },
      { index: 1, segment: '123', suggestedVariable: true, variableName: 'userId' },
    ],
    params: [{ key: 'q', value: 'x' }],
  });
  mockBuildColumnDefs.mockReturnValue(defaultDefs());
  mockGenerateExcelTemplate.mockReturnValue({ wb: true });
});

function goToColumns() {
  fireEvent.click(screen.getByText('Next: Column Names'));
}

function goToReview() {
  goToColumns();
  fireEvent.click(screen.getByText('Next: Review'));
}

describe('CsvTemplateExportModal — Step 1 variables', () => {
  it('renders title, method badge and step indicators', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    expect(screen.getByText('Export Excel Template')).toBeInTheDocument();
    expect(screen.getAllByText('GET').length).toBeGreaterThan(0);
    expect(screen.getByText('Path Variables')).toBeInTheDocument();
  });

  it('shows preview url with the suggested variable substituted', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    expect(screen.getByText('http://api.example.com/users/{{userId}}')).toBeInTheDocument();
  });

  it('toggles a segment and edits its variable name', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // enable segment 0
    const inputs = screen.getAllByPlaceholderText('variable name');
    fireEvent.change(inputs[0], { target: { value: 'org!!' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('org');
    expect(screen.getByText('http://api.example.com/{{org}}/{{userId}}')).toBeInTheDocument();
  });

  it('unchecks the suggested segment removing it from preview', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // disable segment 1
    expect(screen.getByText('http://api.example.com/users/123')).toBeInTheDocument();
  });

  it('shows fixed metadata items', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    expect(screen.getByText('Headers')).toBeInTheDocument();
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Excluded')).toBeInTheDocument();
    expect(screen.getByText('1 paths')).toBeInTheDocument();
    expect(screen.getByText(/exact · unordered arrays/)).toBeInTheDocument();
  });

  it('shows None for headers/params when absent', () => {
    render(<CsvTemplateExportModal test={makeTest({ headers: [], url: 'http://api.example.com/users/123', body: '', validation: { mode: 'exact', expectedFields: [] } as Scenario['validation'] })} onClose={vi.fn()} />);
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
  });

  it('cancels from footer', () => {
    const onClose = vi.fn();
    render(<CsvTemplateExportModal test={makeTest()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('builds column defs when advancing to step 2', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToColumns();
    const opts = mockBuildColumnDefs.mock.calls[0][0] as ExportOptions;
    expect(opts.pathVariables).toEqual([{ segmentIndex: 1, variableName: 'userId' }]);
    expect(screen.getByText('Customize Column Headers')).toBeInTheDocument();
  });
});

describe('CsvTemplateExportModal — Step 2 columns', () => {
  it('renders column rows and enables Next when valid', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToColumns();
    expect(screen.getByDisplayValue('test_name')).toBeInTheDocument();
    expect(screen.getByText('Next: Review')).not.toBeDisabled();
  });

  it('flags empty column name and disables Next', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToColumns();
    fireEvent.change(screen.getByDisplayValue('userId'), { target: { value: '' } });
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.getByText('Next: Review')).toBeDisabled();
  });

  it('flags duplicate column names', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToColumns();
    fireEvent.change(screen.getByDisplayValue('userId'), { target: { value: 'q' } });
    expect(screen.getAllByText('duplicate').length).toBeGreaterThan(0);
    expect(screen.getByText('Next: Review')).toBeDisabled();
  });

  it('strips invalid characters from typed names', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToColumns();
    const input = screen.getByDisplayValue('userId') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a-b c' } });
    expect(input.value).toBe('abc');
  });

  it('navigates Back to variables', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToColumns();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('URL Path Segments')).toBeInTheDocument();
  });
});

describe('CsvTemplateExportModal — Step 3 review & export', () => {
  it('renders the review preview values', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToReview();
    expect(screen.getByText('Data Sheet Preview')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument(); // path value
    expect(screen.getByText('x')).toBeInTheDocument();    // param value
    expect(screen.getByText('active')).toBeInTheDocument(); // validate value
    expect(screen.getByText('Column Mappings (4)')).toBeInTheDocument();
  });

  it('navigates Back from review to columns', () => {
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToReview();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Customize Column Headers')).toBeInTheDocument();
  });

  it('exports with data source rows then closes', async () => {
    const onClose = vi.fn();
    const test = makeTest({
      dataSource: {
        columns: [{ id: 'colP', name: 'userId', type: 'path', mapping: 'userId' }],
        rows: [{ id: 'rowA', values: { colP: '999' }, enabled: true }],
        source: { type: 'inline' },
      } as Scenario['dataSource'],
    });
    render(<CsvTemplateExportModal test={test} onClose={onClose} />);
    goToReview();
    fireEvent.click(screen.getByText(/Confirm.*Download/));
    await waitFor(() => expect(mockDownloadExcel).toHaveBeenCalled());
    const opts = mockGenerateExcelTemplate.mock.calls[0][0] as { dataRows?: unknown[] };
    expect(opts.dataRows).toBeDefined();
    expect(mockDownloadExcel).toHaveBeenCalledWith({ wb: true }, 'Get_User_template.xlsx');
    expect(onClose).toHaveBeenCalled();
  });

  it('exports without data source (single sample row)', async () => {
    const onClose = vi.fn();
    render(<CsvTemplateExportModal test={makeTest()} onClose={onClose} />);
    goToReview();
    fireEvent.click(screen.getByText(/Confirm.*Download/));
    await waitFor(() => expect(mockDownloadExcel).toHaveBeenCalled());
    const opts = mockGenerateExcelTemplate.mock.calls[0][0] as { dataRows?: unknown[] };
    expect(opts.dataRows).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles invalid test URL when building query param metadata', () => {
    render(<CsvTemplateExportModal test={makeTest({ url: 'not-a-valid-url' })} onClose={vi.fn()} />);
    expect(screen.getByText('Query Params')).toBeInTheDocument();
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
  });

  it('flags invalid column name characters and disables Next', () => {
    mockBuildColumnDefs.mockReturnValue([
      { type: 'name', fullKey: 'name', mapping: '', autoName: 'test_name', customName: 'bad-name' },
    ]);
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToColumns();
    expect(screen.getByText('invalid chars')).toBeInTheDocument();
    expect(screen.getByText('Next: Review')).toBeDisabled();
  });

  it('exports data source rows with name-type column mapping', async () => {
    const onClose = vi.fn();
    mockBuildColumnDefs.mockReturnValue([
      { type: 'name', fullKey: 'name', mapping: '', autoName: 'test_name', customName: 'test_name' },
      { type: 'path', fullKey: 'path:userId', mapping: 'userId', autoName: 'userId', customName: 'userId' },
    ]);
    const test = makeTest({
      dataSource: {
        columns: [{ id: 'colP', name: 'userId', type: 'path', mapping: 'userId' }],
        rows: [{ id: 'rowA', values: { colP: '999' }, enabled: true }],
        source: { type: 'inline' },
      } as Scenario['dataSource'],
    });
    render(<CsvTemplateExportModal test={test} onClose={onClose} />);
    goToReview();
    fireEvent.click(screen.getByText(/Confirm.*Download/));
    await waitFor(() => expect(mockDownloadExcel).toHaveBeenCalled());
    const opts = mockGenerateExcelTemplate.mock.calls[0][0] as { dataRows?: { values: Record<string, string> }[] };
    expect(opts.dataRows?.[0].values.test_name).toBe('Get User');
  });

  it('shows body form metadata and review config without raw body', () => {
    render(<CsvTemplateExportModal test={makeTest({
      body: '',
      bodyType: 'form',
      bodyForm: [{ key: 'a', value: '1' }],
      validation: { mode: 'none', expectedFields: [] } as Scenario['validation'],
    })} onClose={vi.fn()} />);
    expect(screen.getByText('FORM')).toBeInTheDocument();
    goToReview();
    expect(screen.queryByText('Body: included')).not.toBeInTheDocument();
  });

  it('renders empty review cells when path, param, and validate mappings are missing', () => {
    mockBuildColumnDefs.mockReturnValue([
      { type: 'path', fullKey: 'path:missing', mapping: 'missing', autoName: 'missing', customName: 'missing' },
      { type: 'param', fullKey: 'param:q2', mapping: 'q2', autoName: 'q2', customName: 'q2' },
      { type: 'validate', fullKey: 'validate:$.x', mapping: '$.x', autoName: 'x', customName: 'x' },
    ]);
    render(<CsvTemplateExportModal test={makeTest()} onClose={vi.fn()} />);
    goToReview();
    const cells = document.querySelectorAll('.excel-review-table tbody td');
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0].textContent).toBe('');
  });
});
