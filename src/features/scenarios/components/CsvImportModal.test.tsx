/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CsvImportModal from './CsvImportModal';
import type { FeatureGroup, Scenario } from '../../../shared/types';
import type { CsvParseResult, ParsedRow } from '../utils/csvTemplateTypes';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const parseCsvMock = vi.fn();
const parseExcelMock = vi.fn();
const parseJsonMock = vi.fn();
const downloadCsvMock = vi.fn(() => Promise.resolve());

vi.mock('../utils/csvTemplate', () => ({
  parseCsvToScenarios: (...a: unknown[]) => parseCsvMock(...a),
  parseExcelToScenarios: (...a: unknown[]) => parseExcelMock(...a),
  downloadCsv: (...a: unknown[]) => downloadCsvMock(...a),
}));
vi.mock('../utils/csvTemplateJson', () => ({
  parseJsonToScenarios: (...a: unknown[]) => parseJsonMock(...a),
}));
vi.mock('../../../shared/components/PopupModal', () => ({
  default: ({ title, onClose, children, footer }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div data-testid="popup-modal">
      <div data-testid="popup-title">{title}</div>
      <button data-testid="popup-close" onClick={onClose}>x</button>
      <div data-testid="popup-body">{children}</div>
      <div data-testid="popup-footer">{footer}</div>
    </div>
  ),
}));

const makeScenario = (over: Partial<Scenario> = {}): Scenario =>
  _makeScenario({
    id: 's1',
    name: 'Get Items',
    url: 'https://api.example.com/v1/items',
    validation: { mode: 'status' } as Scenario['validation'],
    ...over,
  });

function makeResult(over: Partial<CsvParseResult> = {}): CsvParseResult {
  const rows: ParsedRow[] = over.rows ?? [
    { rowIndex: 1, scenario: makeScenario(), errors: [], raw: { name: 'Get Items', method: 'GET', url: 'https://api.example.com/v1/items' } },
  ];
  return {
    rows,
    columns: over.columns ?? ['name', 'method', 'url'],
    totalRows: over.totalRows ?? rows.length,
    validRows: over.validRows ?? rows.filter(r => r.scenario).length,
    errorRows: over.errorRows ?? rows.filter(r => !r.scenario).length,
    meta: over.meta ?? null,
    fileErrors: over.fileErrors ?? [],
    warnings: over.warnings ?? [],
    columnTypes: over.columnTypes,
    validationContract: over.validationContract,
    arrayValidationMode: over.arrayValidationMode,
  };
}

const FGS: FeatureGroup[] = [
  { id: 'fg1', name: 'Group One', scenarios: [{ id: 'sc1', name: 'Scenario A', kind: 'standard', tests: [] }] },
  { id: 'fg2', name: 'Group Two', scenarios: [] },
];

function makeProps(over: Partial<React.ComponentProps<typeof CsvImportModal>> = {}) {
  return {
    featureGroups: FGS,
    onImport: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
}

function csvFile(name = 'data.csv') {
  return new File(['name,method,url\nA,GET,u'], name, { type: 'text/csv' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CsvImportModal', () => {
  it('renders steps 1 and 2 and a disabled import button by default', () => {
    render(<CsvImportModal {...makeProps()} />);
    expect(screen.getByText('Step 1 — Get a template')).toBeInTheDocument();
    expect(screen.getByText('Step 2 — Upload your file')).toBeInTheDocument();
    expect(screen.getByText('Import 0 Tests')).toBeDisabled();
  });

  it('closes via close button and Cancel', () => {
    const onClose = vi.fn();
    render(<CsvImportModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('downloads the sample template', async () => {
    render(<CsvImportModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Download Sample Template'));
    await waitFor(() => expect(downloadCsvMock).toHaveBeenCalledWith(expect.any(String), 'redfireforge_csv_template_sample.csv'));
  });

  it('parses a CSV file and shows the preview', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    const { container } = render(<CsvImportModal {...makeProps()} />);
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [csvFile('mytests.csv')] } });
    await waitFor(() => expect(screen.getByText('Step 3 — Preview')).toBeInTheDocument());
    expect(screen.getByText('mytests.csv')).toBeInTheDocument();
    expect(parseCsvMock).toHaveBeenCalled();
  });

  it('parses a JSON file', async () => {
    parseJsonMock.mockReturnValue(makeResult());
    const { container } = render(<CsvImportModal {...makeProps()} />);
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['{}'], 'data.json', { type: 'application/json' })] } });
    await waitFor(() => expect(parseJsonMock).toHaveBeenCalled());
  });

  it('parses an Excel file', async () => {
    parseExcelMock.mockReturnValue(makeResult());
    const { container } = render(<CsvImportModal {...makeProps()} />);
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['x'], 'data.xlsx', { type: 'application/vnd.openxmlformats' })] } });
    await waitFor(() => expect(parseExcelMock).toHaveBeenCalled());
  });

  it('shows a parse error when CSV parsing throws', async () => {
    parseCsvMock.mockImplementation(() => { throw new Error('boom'); });
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Parse Error')).toBeInTheDocument());
    expect(screen.getByText(/Failed to parse CSV file: boom/)).toBeInTheDocument();
  });

  it('shows a parse error when JSON parsing throws', async () => {
    parseJsonMock.mockImplementation(() => { throw 'rawstring'; });
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['{'], 'd.json')] } });
    await waitFor(() => expect(screen.getByText(/Failed to parse JSON file/)).toBeInTheDocument());
  });

  it('shows a parse error when Excel parsing throws', async () => {
    parseExcelMock.mockImplementation(() => { throw new Error('xl'); });
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['x'], 'd.xlsx')] } });
    await waitFor(() => expect(screen.getByText(/Failed to parse Excel file: xl/)).toBeInTheDocument());
  });

  it('shows file structure errors', async () => {
    parseCsvMock.mockReturnValue(makeResult({ fileErrors: ['Missing header', 'Bad column'], totalRows: 0, validRows: 0, rows: [] }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('File Structure Errors')).toBeInTheDocument());
    expect(screen.getByText('Missing header')).toBeInTheDocument();
  });

  it('shows a single file structure error label without plural', async () => {
    parseCsvMock.mockReturnValue(makeResult({ fileErrors: ['Only one'], totalRows: 0, validRows: 0, rows: [] }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('File Structure Error')).toBeInTheDocument());
  });

  it('shows warnings (plural and single)', async () => {
    parseCsvMock.mockReturnValue(makeResult({ warnings: ['w1', 'w2'] }));
    const { container, rerender } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Warnings')).toBeInTheDocument());

    parseCsvMock.mockReturnValue(makeResult({ warnings: ['only-warn'] }));
    rerender(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile('w2.csv')] } });
    await waitFor(() => expect(screen.getByText('Warning')).toBeInTheDocument());
  });

  it('shows template metadata details (selective)', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      meta: {
        version: 1, method: 'POST', urlPattern: 'https://x/{{vin}}?channel={{channel}}',
        headers: [{ key: 'a', value: 'b' }], body: '', auth: { type: 'bearer', token: 't' },
        validationMode: 'selective', pathVariables: ['vin'],
      },
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Template detected')).toBeInTheDocument());
    expect(screen.getByText('Selective Fields')).toBeInTheDocument();
  });

  it('shows template metadata details (full + unordered + expectedJson)', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      meta: {
        version: 1, method: 'GET', urlPattern: 'https://x', headers: [], body: '',
        auth: { type: 'none' }, validationMode: 'full', unorderedArrays: true,
        expectedJson: '{"a":1}', pathVariables: [],
      },
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText(/Full JSON Match/)).toBeInTheDocument());
    expect(screen.getByText('Included in metadata')).toBeInTheDocument();
  });

  it('shows template metadata details (none validation + missing expectedJson handled)', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      meta: {
        version: 1, method: 'GET', urlPattern: 'https://x', headers: [], body: '',
        auth: { type: 'none' }, validationMode: 'none', pathVariables: [],
      },
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('No Body Validation')).toBeInTheDocument());
  });

  it('toggles error row details in the preview table', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      rows: [
        { rowIndex: 1, scenario: makeScenario(), errors: [], raw: { name: 'OK', method: 'GET', url: 'u' } },
        { rowIndex: 2, scenario: null, errors: ['bad value', 'missing url'], raw: { name: 'Bad', method: '', url: '' } },
      ],
      totalRows: 2, validRows: 1, errorRows: 1,
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('2 Errors')).toBeInTheDocument());
    // expand
    fireEvent.click(screen.getByText('2 Errors').closest('tr')!);
    expect(screen.getByText('• bad value')).toBeInTheDocument();
    // collapse
    fireEvent.click(screen.getByText('2 Errors').closest('tr')!);
    await waitFor(() => expect(screen.queryByText('• bad value')).not.toBeInTheDocument());
  });

  it('renders a single error badge without plural', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      rows: [
        { rowIndex: 1, scenario: null, errors: ['one'], raw: { name: 'Bad' } },
      ],
      totalRows: 1, validRows: 0, errorRows: 1,
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('1 Error')).toBeInTheDocument());
    expect(screen.getByText(/1 error\b/)).toBeInTheDocument();
  });

  it('imports tests into an existing scenario', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    // pick scenario among multiple selects
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    const scenSelect = selects.find(s => within(s).queryByText(/Scenario A/)) as HTMLSelectElement;
    fireEvent.change(scenSelect, { target: { value: 'sc1' } });
    expect(screen.getByText('Import 1 Test')).toBeEnabled();
    fireEvent.click(screen.getByText('Import 1 Test'));
    expect(onImport).toHaveBeenCalledWith('fg1', 'sc1', [expect.objectContaining({ name: 'Get Items' })]);
  });

  it('creates a new feature group and scenario then imports', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Create new feature group'));
    fireEvent.change(screen.getByPlaceholderText('New feature group name'), { target: { value: 'Brand New FG' } });
    fireEvent.change(screen.getByPlaceholderText('New scenario name'), { target: { value: 'Brand New Scenario' } });
    fireEvent.click(screen.getByText('Import 1 Test'));
    expect(onImport).toHaveBeenCalledWith('__new_fg__:Brand New FG', '__new__:Brand New Scenario', expect.any(Array));
  });

  it('creates a new scenario (without new FG) then imports', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile('foo-bar.csv')] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Create new scenario'));
    // newScenarioName defaults from filename "foo bar"
    fireEvent.click(screen.getByText('Import 1 Test'));
    expect(onImport).toHaveBeenCalledWith('fg1', '__new__:foo bar', expect.any(Array));
  });

  it('switches feature group selection', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    const fgSelect = selects.find(s => within(s).queryByText('Group Two')) as HTMLSelectElement;
    fireEvent.change(fgSelect, { target: { value: 'fg2' } });
    expect(fgSelect.value).toBe('fg2');
  });

  it('imports as a parameterized test covering all column prefixes', async () => {
    const columnTypes = new Map<string, { type: string; mapping: string }>([
      ['fromTypes', { type: 'param', mapping: 'ft' }],
      ['nameType', { type: 'name', mapping: '' }],
    ]);
    parseCsvMock.mockReturnValue(makeResult({
      columns: [
        'path:vin', 'param:channel', 'validate:offers[0].code', 'expect:data.name',
        'header:X-Test', 'body:payload', 'name', 'method', 'url',
        'fromTypes', 'nameType', 'pathVar', 'queryParam', 'leftover',
      ],
      meta: {
        version: 1, method: 'POST', urlPattern: 'https://api/{{vin}}?queryParam=x',
        headers: [], body: '{}', auth: { type: 'none' }, validationMode: 'selective',
        pathVariables: ['pathVar'],
      },
      columnTypes,
      rows: [
        {
          rowIndex: 1,
          scenario: makeScenario({ name: 'Order - VIN123', method: 'POST' }),
          errors: [],
          raw: {
            'path:vin': 'V1', 'param:channel': 'web', 'validate:offers[0].code': 'C1',
            'expect:data.name': 'N1', 'header:X-Test': 'h', 'body:payload': 'p',
            name: 'Order - VIN123', method: 'POST', url: 'https://api/V1',
            fromTypes: 'tval', nameType: 'skip', pathVar: 'pv', queryParam: 'qp', leftover: 'lv',
          },
        },
      ],
      totalRows: 1, validRows: 1, errorRows: 0,
    }));
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    // set import mode to parameterized
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    const modeSelect = selects.find(s => within(s).queryByText(/Parameterized Test/)) as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'parameterized' } });
    // pick scenario
    const scenSelect = selects.find(s => within(s).queryByText(/Scenario A/)) as HTMLSelectElement;
    fireEvent.change(scenSelect, { target: { value: 'sc1' } });
    fireEvent.click(screen.getByText(/Import as Parameterized Test/));
    expect(onImport).toHaveBeenCalledWith('fg1', 'sc1', [expect.objectContaining({
      name: 'Order',
      dataSource: expect.objectContaining({
        validationContract: expect.arrayContaining(['offers[*].code']),
      }),
    })]);
  });

  it('switches the duplicate handling mode', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    const dupSelect = selects.find(s => within(s).queryByText(/Skip duplicates/)) as HTMLSelectElement;
    fireEvent.change(dupSelect, { target: { value: 'skip' } });
    expect(dupSelect.value).toBe('skip');
  });

  it('handles drag enter/leave/drop document events', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    render(<CsvImportModal {...makeProps()} />);

    const enter = new Event('dragenter', { bubbles: true });
    document.dispatchEvent(enter);
    await waitFor(() => expect(screen.getByText('Drop file here')).toBeInTheDocument());

    const over = new Event('dragover', { bubbles: true });
    Object.defineProperty(over, 'dataTransfer', { value: { dropEffect: '' } });
    document.dispatchEvent(over);

    const leave = new Event('dragleave', { bubbles: true });
    document.dispatchEvent(leave);
    await waitFor(() => expect(screen.getByText('Drag & drop a file here')).toBeInTheDocument());

    const drop = new Event('drop', { bubbles: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [csvFile()] } });
    document.dispatchEvent(drop);
    await waitFor(() => expect(parseCsvMock).toHaveBeenCalled());
  });

  it('ignores drops of unsupported file types', () => {
    render(<CsvImportModal {...makeProps()} />);
    const drop = new Event('drop', { bubbles: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['x'], 'image.png')] } });
    document.dispatchEvent(drop);
    expect(parseCsvMock).not.toHaveBeenCalled();
  });

  it('ignores a file input change with no file', () => {
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [] } });
    expect(parseCsvMock).not.toHaveBeenCalled();
  });

  it('handles a FileReader read error', async () => {
    const RealFileReader = window.FileReader;
    class FailingReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      readAsText() { setTimeout(() => this.onerror?.(), 0); }
      readAsArrayBuffer() { setTimeout(() => this.onerror?.(), 0); }
    }
    // @ts-expect-error -- test stub
    window.FileReader = FailingReader;
    try {
      const { container } = render(<CsvImportModal {...makeProps()} />);
      fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
      await waitFor(() => expect(screen.getByText(/Failed to read file/)).toBeInTheDocument());
    } finally {
      window.FileReader = RealFileReader;
    }
  });

  it('opens the native file picker on drop zone click', () => {
    const { container } = render(<CsvImportModal {...makeProps()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(container.querySelector('.csv-drop-zone')!);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('renders with no feature groups (empty selectedFgId)', () => {
    render(<CsvImportModal {...makeProps({ featureGroups: [] })} />);
    expect(screen.getByText('Step 1 — Get a template')).toBeInTheDocument();
  });

  it('shows unexpected parse error from synchronous processFile failure', async () => {
    const RealFileReader = window.FileReader;
    class ThrowingReader {
      readAsText() { throw new Error('sync boom'); }
      readAsArrayBuffer() { throw new Error('sync boom'); }
    }
    // @ts-expect-error -- test stub
    window.FileReader = ThrowingReader;
    try {
      const { container } = render(<CsvImportModal {...makeProps()} />);
      fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
      await waitFor(() => expect(screen.getByText(/Unexpected error: sync boom/)).toBeInTheDocument());
    } finally {
      window.FileReader = RealFileReader;
    }
  });

  it('uses validation contract and array mode from parse result metadata', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      columns: ['validate:offers[0].code'],
      validationContract: ['offers[*].code'],
      arrayValidationMode: 'subset',
      rows: [{
        rowIndex: 1,
        scenario: makeScenario({ name: 'Order - X1' }),
        errors: [],
        raw: { 'validate:offers[0].code': 'C1', name: 'Order - X1', method: 'POST', url: 'https://x' },
      }],
      meta: {
        version: 1, method: 'POST', urlPattern: 'https://x', headers: [], body: '',
        auth: { type: 'none' }, validationMode: 'selective', pathVariables: [],
      },
    }));
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    const modeSelect = selects.find(s => within(s).queryByText(/Parameterized Test/)) as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'parameterized' } });
    const scenSelect = selects.find(s => within(s).queryByText(/Scenario A/)) as HTMLSelectElement;
    fireEvent.change(scenSelect, { target: { value: 'sc1' } });
    fireEvent.click(screen.getByText(/Import as Parameterized Test/));
    expect(onImport).toHaveBeenCalledWith('fg1', 'sc1', [expect.objectContaining({
      dataSource: expect.objectContaining({
        validationContract: ['offers[*].code'],
        arrayValidationMode: 'subset',
      }),
    })]);
  });

  it('builds parameterized import without wildcard validation contract', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      columns: ['plainField'],
      rows: [{
        rowIndex: 1,
        scenario: makeScenario({ name: 'Row One' }),
        errors: [],
        raw: { plainField: 'v1', name: 'Row One', method: 'GET', url: 'https://x' },
      }, {
        rowIndex: 2,
        scenario: null,
        errors: ['bad'],
        raw: { plainField: 'v2', name: 'Bad', method: '', url: '' },
      }],
      meta: {
        version: 1, method: 'GET', urlPattern: 'https://x?p=1', headers: [], body: '',
        auth: { type: 'none' }, validationMode: 'selective', pathVariables: [],
      },
    }));
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    fireEvent.change(selects.find(s => within(s).queryByText(/Parameterized Test/))!, { target: { value: 'parameterized' } });
    fireEvent.change(selects.find(s => within(s).queryByText(/Scenario A/))!, { target: { value: 'sc1' } });
    fireEvent.click(screen.getByText(/Import as Parameterized Test/));
    expect(onImport).toHaveBeenCalledWith('fg1', 'sc1', [expect.objectContaining({
      dataSource: expect.objectContaining({ validationContract: undefined, rows: expect.any(Array) }),
    })]);
  });

  it('does not import when destination ids are missing', async () => {
    parseCsvMock.mockReturnValue(makeResult());
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport, featureGroups: [] })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 3 — Preview')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Import 1 Test'));
    expect(onImport).not.toHaveBeenCalled();
  });

  it('imports parameterized rows with header, body, and expect column prefixes', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      columns: ['header:X-Auth', 'body:payload', 'expect:status'],
      rows: [{
        rowIndex: 1,
        scenario: makeScenario({ name: 'Prefixed Row' }),
        errors: [],
        raw: {
          'header:X-Auth': 'tok',
          'body:payload': '{}',
          'expect:status': '200',
          name: 'Prefixed Row',
          method: 'GET',
          url: 'https://x',
        },
      }],
      meta: {
        version: 1, method: 'GET', urlPattern: 'https://x', headers: [], body: '',
        auth: { type: 'none' }, validationMode: 'selective', pathVariables: [],
      },
    }));
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    fireEvent.change(selects.find(s => within(s).queryByText(/Parameterized Test/))!, { target: { value: 'parameterized' } });
    fireEvent.change(selects.find(s => within(s).queryByText(/Scenario A/))!, { target: { value: 'sc1' } });
    fireEvent.click(screen.getByText(/Import as Parameterized Test/));
    expect(onImport).toHaveBeenCalledWith('fg1', 'sc1', [expect.objectContaining({
      dataSource: expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ type: 'header', mapping: 'X-Auth' }),
          expect.objectContaining({ type: 'body', mapping: 'payload' }),
          expect.objectContaining({ type: 'validate', mapping: 'status' }),
        ]),
      }),
    })]);
  });

  it('shows preview with zero validation rules when expectedFields are absent', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      rows: [{
        rowIndex: 1,
        scenario: makeScenario({ validation: { mode: 'status' } as Scenario['validation'] }),
        errors: [],
        raw: { name: 'No Rules', method: 'GET', url: 'https://x' },
      }],
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('0 rules')).toBeInTheDocument());
  });

  it('maps parameterized columns by plain mapping name and strips row suffix from test name', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      columns: ['channel'],
      rows: [{
        rowIndex: 1,
        scenario: makeScenario({ name: 'Checkout - ABC123', url: 'https://x?channel=web' }),
        errors: [],
        raw: { channel: 'web', name: 'Checkout - ABC123', method: 'GET', url: 'https://x?channel=web' },
      }],
      meta: {
        version: 1, method: 'GET', urlPattern: 'https://x?channel=web', headers: [], body: '',
        auth: { type: 'none' }, validationMode: 'selective', pathVariables: [],
      },
    }));
    const onImport = vi.fn();
    const { container } = render(<CsvImportModal {...makeProps({ onImport })} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Step 4 — Select destination')).toBeInTheDocument());
    const selects = within(screen.getByTestId('popup-body')).getAllByRole('combobox');
    fireEvent.change(selects.find(s => within(s).queryByText(/Parameterized Test/))!, { target: { value: 'parameterized' } });
    fireEvent.change(selects.find(s => within(s).queryByText(/Scenario A/))!, { target: { value: 'sc1' } });
    fireEvent.click(screen.getByText(/Import as Parameterized Test/));
    expect(onImport).toHaveBeenCalledWith('fg1', 'sc1', [expect.objectContaining({
      name: 'Checkout',
      url: 'https://x?channel=web',
    })]);
  });

  it('shows template metadata for full validation without expectedJson in metadata', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      meta: {
        version: 1, method: 'GET', urlPattern: 'https://x', headers: [], body: '',
        auth: { type: 'none' }, validationMode: 'full', pathVariables: [],
      },
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Not set (capture after first run)')).toBeInTheDocument());
  });

  it('shows plural import label for multiple valid tests', async () => {
    parseCsvMock.mockReturnValue(makeResult({
      rows: [
        { rowIndex: 1, scenario: makeScenario({ id: 'a', name: 'A' }), errors: [], raw: { name: 'A', method: 'GET', url: 'u1' } },
        { rowIndex: 2, scenario: makeScenario({ id: 'b', name: 'B' }), errors: [], raw: { name: 'B', method: 'GET', url: 'u2' } },
      ],
      totalRows: 2,
      validRows: 2,
      errorRows: 0,
    }));
    const { container } = render(<CsvImportModal {...makeProps()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [csvFile()] } });
    await waitFor(() => expect(screen.getByText('Import 2 Tests')).toBeInTheDocument());
  });
});
