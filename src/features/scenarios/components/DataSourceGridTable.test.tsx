/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceGridTable, { type DataSourceGridTableProps } from './DataSourceGridTable';

function makeProps(overrides: Partial<DataSourceGridTableProps> = {}): DataSourceGridTableProps {
  const dt = {
    columns: [
      { id: 'c1', name: 'status', type: 'validate', mapping: 'status' },
      { id: 'c2', name: '', type: 'param', mapping: '' },
    ],
    rows: [
      {
        id: 'r1',
        enabled: true,
        isSample: true,
        note: '',
        values: { c1: 'ok' },
        tags: ['one'],
      },
    ],
  } as unknown as DataSourceGridTableProps['dt'];

  return {
    tableRef: { current: null },
    dt,
    linkedSharedDs: null,
    dragOverColId: null,
    handleColDragStart: vi.fn(),
    handleColDragOver: vi.fn(),
    handleColDragEnd: vi.fn(),
    handleColDrop: vi.fn(),
    editingColId: null,
    setEditingColId: vi.fn(),
    updateColumn: vi.fn(),
    removeColumn: vi.fn(),
    sortCol: null,
    sortDir: 'asc',
    handleSortColumn: vi.fn(),
    handleColResize: vi.fn(),
    filteredRows: dt.rows,
    selectedRows: new Set<string>(),
    dragRowId: null,
    handleRowSelect: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleDragStart: vi.fn(),
    setDragRowId: vi.fn(),
    toggleRow: vi.fn(),
    setEditingRowId: vi.fn(),
    fetchRowResponse: vi.fn().mockResolvedValue(undefined),
    fetchingRowId: null,
    toggleSample: vi.fn(),
    duplicateRow: vi.fn(),
    editingNoteRowId: null,
    setEditingNoteRowId: vi.fn(),
    updateRowNote: vi.fn(),
    removeRow: vi.fn(),
    editingTagRowId: null,
    setEditingTagRowId: vi.fn(),
    tagInput: '',
    setTagInput: vi.fn(),
    removeTagFromRow: vi.fn(),
    addTagToRow: vi.fn(),
    updateRowLabel: vi.fn(),
    updateCell: vi.fn(),
    handleCellKeyDown: vi.fn(),
    moveRow: vi.fn(),
    ...overrides,
  };
}

describe('DataSourceGridTable', () => {
  it('shows drag-over class on matching column and hides for others', () => {
    const props = makeProps({ dragOverColId: 'c1' });
    const { container } = render(<DataSourceGridTable {...props} />);
    const headers = container.querySelectorAll('th.data-source-th');
    const colHeaders = Array.from(headers).filter((h) => h.querySelector('.data-source-col-header'));
    expect(colHeaders[0].className).toContain('col-drag-over');
    expect(colHeaders[1].className).not.toContain('col-drag-over');
  });

  it('closes rename editor on Enter key only', () => {
    const setEditingColId = vi.fn();
    const props = makeProps({ editingColId: 'c1', setEditingColId });
    render(<DataSourceGridTable {...props} />);
    const input = document.querySelector('.data-source-col-name-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'A' });
    expect(setEditingColId).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(setEditingColId).toHaveBeenCalledWith(null);
  });

  it('renders validate mapping with and without dollar prefix correctly', () => {
    const dt = {
      columns: [
        { id: 'c1', name: 'v1', type: 'validate', mapping: 'status' },
        { id: 'c2', name: 'v2', type: 'validate', mapping: '$.ready' },
      ],
      rows: [{ id: 'r1', enabled: true, values: { c1: 'a', c2: 'b' } }],
    } as unknown as DataSourceGridTableProps['dt'];

    const props = makeProps({ dt, filteredRows: dt.rows });
    render(<DataSourceGridTable {...props} />);
    const mappings = screen.getAllByTestId('ds-col-mapping').map((el) => el.textContent);
    expect(mappings).toContain('$.status');
    expect(mappings).toContain('$.ready');
  });

  it('keeps note editor open on non-Enter key', () => {
    const setEditingNoteRowId = vi.fn();
    const props = makeProps({ editingNoteRowId: 'r1', setEditingNoteRowId });
    render(<DataSourceGridTable {...props} />);
    const noteInput = document.querySelector('.data-source-note-input') as HTMLInputElement;
    fireEvent.keyDown(noteInput, { key: 'Tab' });
    expect(setEditingNoteRowId).not.toHaveBeenCalled();
  });

  it('tag editor Escape clears and closes editor', () => {
    const setEditingTagRowId = vi.fn();
    const setTagInput = vi.fn();
    const props = makeProps({ editingTagRowId: 'r1', setEditingTagRowId, setTagInput, tagInput: 'newTag' });
    render(<DataSourceGridTable {...props} />);
    const tagInputEl = document.querySelector('.data-source-tag-input') as HTMLInputElement;
    fireEvent.keyDown(tagInputEl, { key: 'Escape' });
    expect(setEditingTagRowId).toHaveBeenCalledWith(null);
    expect(setTagInput).toHaveBeenCalledWith('');
  });

  it('uses empty string fallback when cell value is missing', () => {
    const dt = {
      columns: [{ id: 'c1', name: 'status', type: 'validate', mapping: 'status' }],
      rows: [{ id: 'r1', enabled: true, values: {} }],
    } as unknown as DataSourceGridTableProps['dt'];

    const props = makeProps({ dt, filteredRows: dt.rows });
    render(<DataSourceGridTable {...props} />);
    const input = document.querySelector('.data-source-cell-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('hides row action column when linked shared data source is present', () => {
    const props = makeProps({ linkedSharedDs: { id: 'shared-1', name: 's' } as unknown as DataSourceGridTableProps['linkedSharedDs'] });
    const { container } = render(<DataSourceGridTable {...props} />);
    expect(container.querySelector('.data-source-td-actions')).toBeNull();
  });
});
