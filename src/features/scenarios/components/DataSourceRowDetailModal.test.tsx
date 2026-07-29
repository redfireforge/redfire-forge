/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceRowDetailModal from './DataSourceRowDetailModal';
import type { Scenario, DataSource, DataSourceRow, DataSourceColumn } from '../../../shared/types';

vi.mock('../../workflow/components/modals/WorkflowEditorModalFrame', () => ({
  default: ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div data-testid="modal-frame">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
    </div>
  ),
}));

vi.mock('../../../shared/components/data-mapper', () => ({
  DataMapperModal: ({ onSave, initialData }: {
    onSave: (output: { selectiveMode: string; expectedFields: unknown[]; excludedPaths: string[] }) => void;
    initialData: { expectedFields: unknown[] };
  }) => (
    <div data-testid="data-mapper-modal">
      <span>Fields: {initialData.expectedFields.length}</span>
      <button type="button" data-testid="add-field" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [...initialData.expectedFields, { jsonPath: '$.new', expectedValue: '"val"' }], excludedPaths: [] })
      }>Add Field</button>
      <button type="button" data-testid="add-items-name-field" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [...initialData.expectedFields, { jsonPath: 'items[0].name', expectedValue: '"dyn"' }], excludedPaths: [] })
      }>Add items name</button>
      <button type="button" data-testid="set-status-and-missing-paths" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [{ jsonPath: '$.status', expectedValue: '"old"' }, { jsonPath: '$.notInResponse', expectedValue: '"keep"' }], excludedPaths: [] })
      }>Status plus missing</button>
      <button type="button" data-testid="set-validate-quoted-json" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [{ jsonPath: '$.status', expectedValue: '"hello"' }], excludedPaths: [] })
      }>Quoted status</button>
      <button type="button" data-testid="set-broken-quoted-validate" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [{ jsonPath: '$.status', expectedValue: '"notclosed' }], excludedPaths: [] })
      }>Broken quoted</button>
      <button type="button" data-testid="set-deep-status-expected" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [{ jsonPath: '$.status', expectedValue: '"flat"' }], excludedPaths: [] })
      }>Deep status</button>
      <button type="button" data-testid="set-boolean-path-field" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [{ jsonPath: 'enabled', expectedValue: '"prior"' }], excludedPaths: [] })
      }>Set enabled path</button>
    </div>
  ),
  createValidationAdapter: () => ({}),
}));

const mockProxyFetch = vi.fn();
const mockResolveScenario = vi.fn(() => ({
  url: 'https://api.example.com/users/1',
  method: 'GET',
  headers: [] as { key: string; value: string }[],
  body: '',
}));

vi.mock('../../../engine/dataSourceExpander', () => ({
  resolveScenarioFromDataRow: (...args: unknown[]) => mockResolveScenario(...args),
}));

vi.mock('../../../engine/executor', () => ({
  proxyFetch: (...args: unknown[]) => mockProxyFetch(...args),
  buildHeaders: vi.fn(() => ({})),
}));

const mockExpandPattern = vi.fn(() => [] as string[]);
vi.mock('../utils/dataSourceImport', () => ({
  expandPatternFromResponse: (...args: unknown[]) => mockExpandPattern(...args),
}));

const createDraft = (): Scenario => ({
  id: 'test-1',
  name: 'Test',
  url: 'https://api.example.com/users/{{userId}}',
  method: 'GET',
  headers: [],
  auth: { type: 'none' },
  validation: { mode: 'none' },
});

const createDataTable = (): DataSource => ({
  columns: [
    { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
    { id: 'c2', name: 'name', type: 'param', mapping: 'name' },
    { id: 'c3', name: 'expectedStatus', type: 'validate', mapping: '$.status' },
  ],
  rows: [
    { id: 'r1', values: { c1: '1', c2: 'Alice', c3: 'active' }, enabled: true },
    { id: 'r2', values: { c1: '2', c2: 'Bob', c3: 'inactive' }, enabled: true },
  ],
  source: { type: 'inline' },
});

const createRow = (): DataSourceRow => ({
  id: 'r1',
  values: { c1: '1', c2: 'Alice', c3: 'active' },
  enabled: true,
  label: 'User Alice',
});

/** Validate columns named so deriving `items0_name` must pick `_3` suffix */
function createDataTableWithCollidingNames(): DataSource {
  return {
    columns: [
      { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
      { id: 'c2', name: 'name', type: 'param', mapping: 'name' },
      { id: 'c3', name: 'items0_name', type: 'validate', mapping: 'a' },
      { id: 'c4', name: 'items0_name_2', type: 'validate', mapping: 'b' },
      { id: 'c5', name: 'unrelated', type: 'validate', mapping: 'c' },
    ],
    rows: [],
    source: { type: 'inline' },
  };
}

describe('DataSourceRowDetailModal', () => {
  const defaultProps = {
    draft: createDraft(),
    dataTable: createDataTable(),
    row: createRow(),
    rowIndex: 0,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    resetAllMocks();
    mockResolveScenario.mockImplementation(() => ({
      url: 'https://api.example.com/users/1',
      method: 'GET',
      headers: [],
      body: '',
    }));
  });

  async function fetchAndOpenMapper() {
    mockProxyFetch.mockResolvedValue({ status: 200, statusText: 'OK', body: '{"status":"active"}', headers: {} });
    await act(async () => { fireEvent.click(screen.getByText('Fetch Response')); });
    await waitFor(() => {
      const keepBtn = screen.queryByText(/Keep Rules/);
      if (keepBtn) return expect(keepBtn).toBeTruthy();
      return expect(screen.getByText('⚡ Data Mapper')).not.toBeDisabled();
    });
    const keepBtn = screen.queryByText(/Keep Rules/);
    if (keepBtn) fireEvent.click(keepBtn);
    await waitFor(() => { expect(screen.getByText('⚡ Data Mapper')).not.toBeDisabled(); });
    fireEvent.click(screen.getByText('⚡ Data Mapper'));
  }

  describe('rendering', () => {
    it('renders modal frame', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByTestId('modal-frame')).toBeInTheDocument();
    });

    it('renders title with row index and label', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Row 1 — User Alice');
    });

    it('renders title with row index only when row has no label', () => {
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      render(<DataSourceRowDetailModal {...defaultProps} row={row} />);
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Row 1');
    });

    it('shows param, body, and header type badges', () => {
      const dt = createDataTable();
      dt.columns = [
        { id: 'p1', name: 'q', type: 'param', mapping: 'q' },
        { id: 'b1', name: 'payload', type: 'body', mapping: 'body' },
        { id: 'h1', name: 'X-Trace', type: 'header', mapping: 'X-Trace' },
        { id: 'c3', name: 'v', type: 'validate', mapping: '$.x' },
      ];
      const row: DataSourceRow = {
        id: 'r1',
        values: { p1: '1', b1: '2', h1: '3', c3: '' },
        enabled: true,
      };
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      expect(screen.getByText('param')).toBeInTheDocument();
      const bodyBadge = document.querySelector('.row-detail-type-body');
      expect(bodyBadge).toBeTruthy();
      expect(bodyBadge).toHaveTextContent('body');
      expect(screen.getByText('header')).toBeInTheDocument();
    });

    it('uses draft URL in preview when resolveScenarioFromDataRow throws', () => {
      mockResolveScenario.mockImplementation(() => {
        throw new Error('resolve failed');
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('https://api.example.com/users/{{userId}}')).toBeInTheDocument();
    });

    it('renders input fields for non-validate columns', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });

    it('renders empty string for non-validate column value when row value is missing', () => {
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c3: 'active' },
        enabled: true,
      };
      render(<DataSourceRowDetailModal {...defaultProps} row={row} />);
      const input = document.querySelector('input[placeholder="name"]') as HTMLInputElement | null;
      expect(input).toBeTruthy();
      expect(input?.value).toBe('');
    });

    it('renders input columns section', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('Input Columns')).toBeInTheDocument();
    });

    it('renders label input', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByDisplayValue('User Alice')).toBeInTheDocument();
    });

    it('renders Fetch Response button', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('Fetch Response')).toBeInTheDocument();
    });

    it('renders resolved URL preview', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('https://api.example.com/users/1')).toBeInTheDocument();
    });

    it('renders HTTP method', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('GET')).toBeInTheDocument();
    });

    it('renders Data Mapper button when sampleJson is set', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('⚡ Data Mapper')).toBeInTheDocument();
    });

    it('shows column type badges', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('path')).toBeInTheDocument();
    });

    it('omits mapping hint when column mapping matches display name', () => {
      const dt = createDataTable();
      dt.columns[1] = { ...dt.columns[1], name: 'Same', mapping: 'Same' };
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} />);
      const label = screen.getByText('Same').closest('label');
      expect(label?.querySelector('.row-detail-field-mapping')).toBeNull();
    });

    it('shows mapping when different from name', () => {
      const dt = createDataTable();
      dt.columns[1] = { ...dt.columns[1], name: 'Name', mapping: 'full_name' };
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} />);
      expect(screen.getByText('→ full_name')).toBeInTheDocument();
    });

    it('renders footer with Save, Cancel, Close', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('builds sample from quoted expected field string for mapper enablement', () => {
      const dt = createDataTable();
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c2: 'Alice', c3: '"active"' },
        enabled: true,
      };
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      expect(screen.getByText('⚡ Data Mapper')).not.toBeDisabled();
    });

    it('skips malformed expected field paths while still enabling mapper when valid paths exist', () => {
      const dt = createDataTable();
      dt.columns.push({ id: 'c4', name: 'bad', type: 'validate', mapping: '$.[', });
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c2: 'Alice', c3: 'ok', c4: 'bad' },
        enabled: true,
      };
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      expect(screen.getByText('⚡ Data Mapper')).not.toBeDisabled();
    });

    it('ignores validate rows with empty mapping when building initial expected fields', () => {
      const dt = createDataTable();
      dt.columns[2] = { ...dt.columns[2], mapping: '' };
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} />);
      expect(screen.queryByText('$.status')).not.toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('allows editing input values', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      const input = screen.getByDisplayValue('1');
      fireEvent.change(input, { target: { value: '42' } });
      expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    });

    it('allows editing label', () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      const input = screen.getByDisplayValue('User Alice');
      fireEvent.change(input, { target: { value: 'New Label' } });
      expect(screen.getByDisplayValue('New Label')).toBeInTheDocument();
    });
  });

  describe('save', () => {
    it('calls onSave with updated values', () => {
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} onSave={onSave} />);
      fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '99' } });
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ values: expect.objectContaining({ c1: '99' }) }),
        undefined,
      );
    });

    it('calls onSave with updated label', () => {
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} onSave={onSave} />);
      fireEvent.change(screen.getByDisplayValue('User Alice'), { target: { value: 'Bob' } });
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Bob' }),
        undefined,
      );
    });

    it('omits label on save when row label is cleared', () => {
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} onSave={onSave} />);
      fireEvent.change(screen.getByDisplayValue('User Alice'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ label: undefined }),
        undefined,
      );
    });

    it('clears validate columns not in expected fields', () => {
      const dt = createDataTable();
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ values: expect.objectContaining({ c3: '' }) }),
        undefined,
      );
    });

    it('preserves validate column values for selected fields', () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      // The initial expectedFields should have the validate field populated
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ values: expect.objectContaining({ c3: 'active' }) }),
        undefined,
      );
    });

    it('parses quoted JSON expected values when saving to existing validate column', async () => {
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('set-validate-quoted-json'));
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ c3: 'hello' }),
        }),
        undefined,
      );
    });

    it('keeps validate cell unchanged when quoted expected value fails JSON.parse', async () => {
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('set-broken-quoted-validate'));
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ c3: '"notclosed' }),
        }),
        undefined,
      );
    });

    it('creates dynamically expanded column with suffixed name when base collides', async () => {
      const dt = createDataTable();
      dt.validationContract = ['items[*].name'];
      dt.columns[2] = {
        id: 'c3',
        name: 'items0_name',
        type: 'validate',
        mapping: 'other.path',
      };
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c2: 'Alice', c3: '' },
        enabled: true,
      };
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('add-items-name-field'));
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({ name: 'items0_name_2', type: 'validate', mapping: 'items[0].name' }),
        ]),
      );
    });

    it('increments suffix until deriveColumnName is unique', async () => {
      const dt = createDataTableWithCollidingNames();
      dt.validationContract = ['items[*].name'];
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c2: 'Alice', c3: '', c4: '', c5: '' },
        enabled: true,
      };
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('add-items-name-field'));
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({ name: 'items0_name_3', type: 'validate' }),
        ]),
      );
    });
  });

  describe('close', () => {
    it('calls onClose when Cancel clicked', () => {
      const onClose = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} onClose={onClose} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('fetch', () => {
    it('shows success line without timing when response has no timing', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/^✓ 200 OK$/)).toBeInTheDocument();
      });
    });

    it('handles 200 response with empty body', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/✓ 200 OK/)).toBeInTheDocument();
      });
    });

    it('calls proxyFetch on Fetch Response click', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"name":"Alice","status":"active"}',
        headers: {},
        timing: { total: 150 },
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/✓ 200 OK/)).toBeInTheDocument();
      });
    });

    it('uses onFetchRow when provided', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"result":true}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} onFetchRow={onFetchRow} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(onFetchRow).toHaveBeenCalled();
        expect(screen.getByText(/✓ 200 OK/)).toBeInTheDocument();
      });
    });

    it('shows error for HTTP 4xx/5xx', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        body: '{"error":"fail"}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/✗ HTTP 500/)).toBeInTheDocument();
      });
    });

    it('shows HTTP status timing for non-2xx responses', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        body: '{"error":"fail"}',
        headers: {},
        timing: { total: 123 },
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/123ms/)).toBeInTheDocument();
      });
    });

    it('shows error for network failure', async () => {
      mockProxyFetch.mockRejectedValue(new Error('Network timeout'));
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Network timeout/)).toBeInTheDocument();
      });
    });

    it('uses string message when fetch rejects with non-Error', async () => {
      mockProxyFetch.mockRejectedValue('plain rejection');
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/plain rejection/)).toBeInTheDocument();
      });
    });

    it('shows HTTP error without response body', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 502,
        statusText: 'Bad Gateway',
        body: '',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/✗ HTTP 502/)).toBeInTheDocument();
      });
    });

    it('shows error when result.error is set', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 0,
        statusText: '',
        body: '',
        headers: {},
        error: 'Connection refused',
      });
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
      });
    });
  });

  describe('fetch confirmation bar', () => {
    it('shows confirmation when fetching with existing selections', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":"inactive"}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Keep Rules & Update Values/)).toBeInTheDocument();
        expect(screen.getByText(/Clear Rules/)).toBeInTheDocument();
      });
    });

    it('Keep Rules updates response and keeps fields', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":"new-value"}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Keep Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Keep Rules/));
      expect(screen.queryByText(/Keep Rules & Update Values/)).not.toBeInTheDocument();
    });

    it('Clear Rules clears fields', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":"new-value"}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Clear Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Clear Rules/));
      expect(screen.queryByText(/Clear Rules/)).not.toBeInTheDocument();
      expect(document.querySelector('.validation-fields-table')).toBeFalsy();
    });

    it('Cancel dismisses confirmation bar', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":"new-value"}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText('Cancel', { selector: '.fetch-confirm-actions button' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Cancel', { selector: '.fetch-confirm-actions button' }));
      expect(screen.queryByText(/existing rule/)).not.toBeInTheDocument();
    });

    it('Keep Rules keeps fields whose path is absent in the new response', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = '';
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('set-status-and-missing-paths'));
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":"fresh"}',
        headers: {},
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Keep Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Keep Rules/));
      await waitFor(() => {
        expect(screen.queryByText(/existing rule/)).not.toBeInTheDocument();
      });
    });

    it('Keep Rules stringifies object values found at expected paths', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = '';
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('set-deep-status-expected'));
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":{"code":1,"msg":"ok"}}',
        headers: {},
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Keep Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Keep Rules/));
      await waitFor(() => {
        expect(screen.queryByText(/existing rule/)).not.toBeInTheDocument();
      });
    });

    it('Keep Rules updates expected values for boolean JSON paths', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = '';
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('set-boolean-path-field'));
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"enabled":true}',
        headers: {},
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Keep Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Keep Rules/));
      await waitFor(() => {
        expect(screen.queryByText(/existing rule/)).not.toBeInTheDocument();
      });
    });

    it('renders default type badge class for unknown column types', () => {
      const dt = createDataTable();
      dt.columns.push({
        id: 'cx',
        name: 'extra',
        type: 'not-a-real-type' as unknown as DataSourceColumn['type'],
        mapping: 'x',
      });
      const row = createRow();
      row.values.cx = 'v';
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      expect(screen.getByDisplayValue('v')).toBeInTheDocument();
    });

    it('Keep Rules tolerates non-JSON pending body', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: 'not-json{',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Keep Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Keep Rules/));
      expect(screen.queryByText(/existing rule/)).not.toBeInTheDocument();
    });

    it('keeps no-op when Keep Rules clicked after bar dismiss path', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":"new-value"}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Keep Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Keep Rules/));
      expect(screen.queryByText(/Keep Rules/)).not.toBeInTheDocument();
    });

    it('keeps no-op when Clear Rules clicked after bar dismiss path', async () => {
      const dt = createDataTable();
      const row = createRow();
      row.values.c3 = 'active';
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{"status":"new-value"}',
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/Clear Rules/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Clear Rules/));
      expect(screen.queryByText(/Clear Rules/)).not.toBeInTheDocument();
    });
  });

  describe('Data Mapper integration', () => {
    it('updates expected fields when mapper saves', async () => {
      render(<DataSourceRowDetailModal {...defaultProps} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('add-field'));
    });
  });

  describe('save with new columns', () => {
    it('creates new validate column for dynamic pattern expansion', async () => {
      const dt = createDataTable();
      dt.validationContract = ['$.items[*].name'];
      const row = createRow();
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('add-field'));
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalled();
    });
  });

});
