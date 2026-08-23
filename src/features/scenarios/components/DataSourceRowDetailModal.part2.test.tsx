/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceRowDetailModal from './DataSourceRowDetailModal';
import type { Scenario, DataSource, DataSourceRow } from '@shared/types';

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
      <button type="button" data-testid="set-root-path-field" onClick={() =>
        onSave({ selectiveMode: 'include', expectedFields: [{ jsonPath: '$', expectedValue: '"root"' }], excludedPaths: [] })
      }>Set root path</button>
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
function _createDataTableWithCollidingNames(): DataSource {
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

  describe('auto-select on fetch (no existing rules)', () => {
    it('auto-select does not duplicate fields when validate mapping is covered by contract', async () => {
      const dt = createDataTable();
      dt.validationContract = ['items[*].name'];
      dt.columns.push({
        id: 'v-extra',
        name: 'Item0Name',
        type: 'validate',
        mapping: 'items[0].name',
      });
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c2: 'Alice', c3: '', 'v-extra': '' },
        enabled: true,
      };
      mockExpandPattern.mockReturnValue(['items[0].name']);
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ items: [{ name: 'Only' }] }),
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        const table = document.querySelector('.validation-fields-table');
        expect(table).toBeTruthy();
        const rows = table!.querySelectorAll('tbody tr');
        expect(rows.length).toBe(1);
      });
    });

    it('auto-selects fields from validation contract patterns', async () => {
      const dt = createDataTable();
      dt.validationContract = ['items[*].name'];
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      
      mockExpandPattern.mockReturnValue(['items[0].name', 'items[1].name']);
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ items: [{ name: 'ItemA' }, { name: 'ItemB' }] }),
        headers: {},
        timing: { total: 50 },
      });
      
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        const table = document.querySelector('.validation-fields-table');
        expect(table).toBeTruthy();
        const rows = table!.querySelectorAll('tbody tr');
        expect(rows.length).toBe(2);
      });
    });

    it('auto-selects existing validate column mappings', async () => {
      const dt = createDataTable();
      // Validate column mapping without $ prefix for getValueAtJsonPath to resolve
      dt.columns[2] = { ...dt.columns[2], mapping: 'status' };
      // Row with empty validate column - no initial selection
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ status: 'active' }),
        headers: {},
      });
      
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        const table = document.querySelector('.validation-fields-table');
        expect(table).toBeTruthy();
        const rows = table!.querySelectorAll('tbody tr');
        expect(rows.length).toBe(1);
      });
    });

    it('auto-select includes fixed validate paths alongside contract expansion', async () => {
      const dt = createDataTable();
      dt.validationContract = ['items[*].id'];
      dt.columns.push({
        id: 'v-extra',
        name: 'topStatus',
        type: 'validate',
        mapping: 'top',
      });
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c2: 'Alice', c3: '', 'v-extra': '' },
        enabled: true,
      };
      mockExpandPattern.mockImplementation((_parsed: unknown, pattern: string) =>
        (pattern === 'items[*].id' ? ['items[0].id'] : []),
      );
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ top: 'ok', items: [{ id: 7 }] }),
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        const table = document.querySelector('.validation-fields-table');
        expect(table).toBeTruthy();
        expect(table!.querySelectorAll('tbody tr').length).toBe(2);
      });
    });

    it('handles non-JSON response gracefully', async () => {
      const dt = createDataTable();
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: 'plain text response',
        headers: {},
      });
      
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/✓ 200 OK/)).toBeInTheDocument();
      });
    });

    it('auto-select skips fixed validate column when its pattern is covered by validationContract', async () => {
      const dt = createDataTable();
      dt.validationContract = ['items[*].name'];
      dt.columns.push({
        id: 'v-dup',
        name: 'item0name',
        type: 'validate',
        mapping: 'items[0].name',
      });
      const row: DataSourceRow = {
        id: 'r1',
        values: { c1: '1', c2: 'Alice', c3: '', 'v-dup': '' },
        enabled: true,
      };
      mockExpandPattern.mockImplementation(() => ['items[0].name']);
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ items: [{ name: 'Only' }] }),
        headers: {},
      });
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(mockExpandPattern).toHaveBeenCalled();
      });
      const table = document.querySelector('.validation-fields-table');
      expect(table).toBeTruthy();
      expect(table!.querySelectorAll('tbody tr').length).toBe(1);
    });

    it('auto-select does not set expected fields when JSON has no values at validate or contract paths', async () => {
      mockExpandPattern.mockReturnValue([]);
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({}),
        headers: {},
      });
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      render(<DataSourceRowDetailModal {...defaultProps} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/✓ 200 OK/)).toBeInTheDocument();
      });
      expect(document.querySelector('.validation-fields-table')).toBeFalsy();
    });

    it('shows timing info in status', async () => {
      mockProxyFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: '{}',
        headers: {},
        timing: { total: 256 },
      });
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      render(<DataSourceRowDetailModal {...defaultProps} row={row} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Fetch Response'));
      });
      await waitFor(() => {
        expect(screen.getByText(/256ms/)).toBeInTheDocument();
      });
    });
  });

  describe('save dynamic column creation', () => {
    it('creates new column for dynamic pattern field not matching existing columns', async () => {
      const dt = createDataTable();
      dt.validationContract = ['$.items[*].name'];
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('add-field'));
      fireEvent.click(screen.getByText('Save'));
      expect(onSave).toHaveBeenCalled();
    });

    it('normalizes quoted expected value to plain string for new dynamic columns', async () => {
      const dt = createDataTable();
      dt.validationContract = ['$.new'];
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('add-field'));
      fireEvent.click(screen.getByText('Save'));

      const newColumns = onSave.mock.calls[0][1] as Array<{ id: string }>;
      const newColId = newColumns[0].id;
      const savedRow = onSave.mock.calls[0][0] as { values: Record<string, string> };
      expect(savedRow.values[newColId]).toBe('val');
    });

    it('uses fallback column name "field" when jsonPath sanitizes to empty', async () => {
      const dt = createDataTable();
      dt.validationContract = ['$'];
      const row: DataSourceRow = { id: 'r1', values: { c1: '1', c2: 'Alice', c3: '' }, enabled: true };
      const onSave = vi.fn();
      render(<DataSourceRowDetailModal {...defaultProps} dataTable={dt} row={row} onSave={onSave} />);
      await fetchAndOpenMapper();
      fireEvent.click(screen.getByTestId('set-root-path-field'));
      fireEvent.click(screen.getByText('Save'));

      const newColumns = onSave.mock.calls[0][1] as Array<{ name: string }>;
      expect(newColumns[0].name).toBe('field');
    });
  });
});
