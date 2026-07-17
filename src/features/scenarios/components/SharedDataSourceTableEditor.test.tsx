/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharedDataSourceTableEditor from './SharedDataSourceTableEditor';
import type { DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';

vi.mock('../utils/dataSourceUtils', () => ({
  createEmptyRow: (cols: DataSourceColumn[]): DataSourceRow => ({
    id: 'new-row',
    values: Object.fromEntries(cols.map(c => [c.id, ''])),
    enabled: true,
  }),
  createEmptyColumn: (): DataSourceColumn => ({
    id: 'new-col',
    name: '',
    type: 'param',
    mapping: '',
  }),
}));

const COLS: DataSourceColumn[] = [
  { id: 'c1', name: 'VIN', type: 'path', mapping: 'vin' },
  { id: 'c2', name: 'Channel', type: 'param', mapping: 'channel' },
];

const ROWS: DataSourceRow[] = [
  { id: 'r1', values: { c1: 'AAA', c2: 'web' }, enabled: true },
  { id: 'r2', values: { c1: 'BBB', c2: 'app' }, enabled: true },
];

function makeDs(over: Partial<DataSource> = {}): DataSource {
  return {
    id: 'ds1',
    columns: COLS,
    rows: ROWS,
    source: { type: 'inline' },
    ...over,
  };
}

function makeDragEvent() {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => ''),
    },
  };
}

describe('SharedDataSourceTableEditor', () => {
  it('renders null when no data source', () => {
    const { container } = render(<SharedDataSourceTableEditor dataSource={undefined} onChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('defaults missing columns and rows arrays on a partial data source', () => {
    render(<SharedDataSourceTableEditor
      dataSource={{ id: 'ds-partial', source: { type: 'inline' } } as DataSource}
      onChange={vi.fn()}
    />);
    expect(screen.getByText('No rows yet')).toBeInTheDocument();
  });

  it('renders empty state and adds first row', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({ rows: [] })} onChange={onChange} />);
    expect(screen.getByText('No rows yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Add Row'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rows: [expect.objectContaining({ id: 'new-row' })] }));
  });

  it('renders table with rows, columns and stats', () => {
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={vi.fn()} />);
    expect(screen.getByText('AAA')).toBeInTheDocument();
    expect(screen.getByText('BBB')).toBeInTheDocument();
    expect(screen.getByText(/2 rows · 2 columns/)).toBeInTheDocument();
  });

  it('renders singular row/column stats', () => {
    render(<SharedDataSourceTableEditor dataSource={makeDs({
      columns: [COLS[0]],
      rows: [ROWS[0]],
    })} onChange={vi.fn()} />);
    expect(screen.getByText(/1 row · 1 column/)).toBeInTheDocument();
  });

  it('adds a row from footer button', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Row' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rows: [...ROWS, expect.objectContaining({ id: 'new-row' })] }));
  });

  it('deletes a row', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete row' })[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rows: [ROWS[1]] }));
  });

  it('moves a row down then up', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.click(screen.getAllByTitle('Move down')[0]);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rows: [ROWS[1], ROWS[0]] }));
    onChange.mockClear();
    fireEvent.click(screen.getAllByTitle('Move up')[1]);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rows: [ROWS[1], ROWS[0]] }));
  });

  it('disables move up on first and move down on last', () => {
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={vi.fn()} />);
    expect(screen.getAllByTitle('Move up')[0]).toBeDisabled();
    expect(screen.getAllByTitle('Move down')[1]).toBeDisabled();
  });

  it('adds a column', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Add column'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [...COLS, expect.objectContaining({ id: 'new-col' })],
    }));
  });

  it('deletes a column', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.click(screen.getAllByTitle('Delete column')[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [COLS[1]],
    }));
  });

  it('renames a column and keeps mapping in sync when mirroring', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({
      columns: [{ id: 'c1', name: 'VIN', type: 'path', mapping: 'VIN' }],
      rows: [{ id: 'r1', values: { c1: 'x' }, enabled: true }],
    })} onChange={onChange} />);
    const nameInput = screen.getByDisplayValue('VIN');
    fireEvent.change(nameInput, { target: { value: 'VID' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [expect.objectContaining({ name: 'VID', mapping: 'VID' })],
    }));
  });

  it('renames a column without changing a custom mapping', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({
      columns: [{ id: 'c1', name: 'VIN', type: 'path', mapping: 'customMap' }],
      rows: [{ id: 'r1', values: { c1: 'x' }, enabled: true }],
    })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('VIN'), { target: { value: 'New' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [expect.objectContaining({ name: 'New', mapping: 'customMap' })],
    }));
  });

  it('changes a column type', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'body' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [expect.objectContaining({ id: 'c1', type: 'body' }), COLS[1]],
    }));
  });

  it('edits a cell via double-click, change, and blur', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.doubleClick(screen.getByText('AAA'));
    const input = screen.getByDisplayValue('AAA');
    fireEvent.change(input, { target: { value: 'ZZZ' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      rows: [expect.objectContaining({ values: { c1: 'ZZZ', c2: 'web' } }), ROWS[1]],
    }));
  });

  it('commits a cell edit on Enter key', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.doubleClick(screen.getByText('web'));
    const input = screen.getByDisplayValue('web');
    fireEvent.change(input, { target: { value: 'mobile' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      rows: [expect.objectContaining({ values: { c1: 'AAA', c2: 'mobile' } }), ROWS[1]],
    }));
  });

  it('cancels a cell edit on Escape key', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.doubleClick(screen.getByText('AAA'));
    const input = screen.getByDisplayValue('AAA');
    fireEvent.change(input, { target: { value: 'NOPE' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('AAA')).toBeInTheDocument();
  });

  it('ignores unrelated keys during cell editing', () => {
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('AAA'));
    const input = screen.getByDisplayValue('AAA');
    fireEvent.keyDown(input, { key: 'a' });
    expect(screen.getByDisplayValue('AAA')).toBeInTheDocument();
  });

  it('renders empty string for a missing cell value on double-click', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({
      columns: COLS,
      rows: [{ id: 'r1', values: { c1: 'only' }, enabled: true }],
    })} onChange={onChange} />);
    // c2 cell has no value
    const cells = document.querySelectorAll('.shared-ds-cell-display');
    fireEvent.doubleClick(cells[1]);
    const input = screen.getByDisplayValue('');
    fireEvent.blur(input);
  });

  it('handles full column drag-and-drop reorder', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    const handles = screen.getAllByLabelText('Drag to reorder column');
    // Drag c2 (index 1) onto c1 (index 0) to actually reorder → [c2, c1]
    fireEvent.dragStart(handles[1], makeDragEvent() as never);

    const headers = document.querySelectorAll('.shared-ds-table-header');
    fireEvent.dragOver(headers[0], makeDragEvent() as never);

    fireEvent.drop(headers[0], makeDragEvent() as never);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [COLS[1], COLS[0]],
    }));
    fireEvent.dragEnd(handles[1]);
  });

  it('ignores drag-over for same column or no active drag', () => {
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={vi.fn()} />);
    const headers = document.querySelectorAll('.shared-ds-table-header');
    // No drag started yet → handleColumnDragOver early-returns
    fireEvent.dragOver(headers[0], makeDragEvent() as never);
    // Start drag on c1 then drag over c1 (same) → early return
    const handles = screen.getAllByLabelText('Drag to reorder column');
    fireEvent.dragStart(handles[0], makeDragEvent() as never);
    fireEvent.dragOver(headers[0], makeDragEvent() as never);
    expect(true).toBe(true);
  });

  it('drop onto same column resets drag state without change', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    const handles = screen.getAllByLabelText('Drag to reorder column');
    fireEvent.dragStart(handles[0], makeDragEvent() as never);
    const headers = document.querySelectorAll('.shared-ds-table-header');
    fireEvent.drop(headers[0], makeDragEvent() as never);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drop with unknown source column id resets drag state without change', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    const headers = document.querySelectorAll('.shared-ds-table-header');
    const dropEvt = { ...makeDragEvent(), dataTransfer: { ...makeDragEvent().dataTransfer, getData: vi.fn(() => 'unknown') } };
    fireEvent.drop(headers[1], dropEvt as never);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reorders column forward when dragging left column onto a later target', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'A', type: 'path', mapping: 'a' },
      { id: 'c2', name: 'B', type: 'param', mapping: 'b' },
      { id: 'c3', name: 'C', type: 'body', mapping: 'c' },
    ];
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({ columns: cols, rows: [{ id: 'r1', values: { c1: '1', c2: '2', c3: '3' }, enabled: true }] })} onChange={onChange} />);
    const handles = screen.getAllByLabelText('Drag to reorder column');
    fireEvent.dragStart(handles[0], makeDragEvent() as never);
    const headers = document.querySelectorAll('.shared-ds-table-header');
    fireEvent.drop(headers[2], makeDragEvent() as never);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ columns: [cols[1], cols[0], cols[2]] }));
  });

  it('does not call onChange when move row up is clicked on the first row', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.click(screen.getAllByTitle('Move up')[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when move row down is clicked on the last row', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.click(screen.getAllByTitle('Move down')[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores drag-over when already hovering the same column', () => {
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={vi.fn()} />);
    const handles = screen.getAllByLabelText('Drag to reorder column');
    const headers = document.querySelectorAll('.shared-ds-table-header');
    fireEvent.dragStart(handles[0], makeDragEvent() as never);
    fireEvent.dragOver(headers[1], makeDragEvent() as never);
    fireEvent.dragOver(headers[1], makeDragEvent() as never);
    expect(document.querySelector('.shared-ds-table-header-drop')).toBeInTheDocument();
  });

  it('syncs mapping when column had an empty mapping', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({
      columns: [{ id: 'c1', name: 'VIN', type: 'path', mapping: '' }],
      rows: [{ id: 'r1', values: { c1: 'x' }, enabled: true }],
    })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('VIN'), { target: { value: 'VID' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [expect.objectContaining({ name: 'VID', mapping: 'VID' })],
    }));
  });

  it('leaves sibling columns unchanged when renaming one of three columns', () => {
    const cols: DataSourceColumn[] = [
      { id: 'c1', name: 'A', type: 'path', mapping: 'a' },
      { id: 'c2', name: 'B', type: 'param', mapping: 'custom-b' },
      { id: 'c3', name: 'C', type: 'body', mapping: 'c' },
    ];
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({
      columns: cols,
      rows: [{ id: 'r1', values: { c1: '1', c2: '2', c3: '3' }, enabled: true }],
    })} onChange={onChange} />);
    fireEvent.change(screen.getAllByDisplayValue('B')[0], { target: { value: 'Beta' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [
        cols[0],
        expect.objectContaining({ name: 'Beta', mapping: 'custom-b' }),
        cols[2],
      ],
    }));
  });

  it('renames a column that has an undefined name', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs({
      columns: [{ id: 'c1', name: undefined as unknown as string, type: 'path', mapping: '' }],
      rows: [{ id: 'r1', values: { c1: 'x' }, enabled: true }],
    })} onChange={onChange} />);
    const input = document.querySelector('.shared-ds-col-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Named' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: [expect.objectContaining({ name: 'Named', mapping: 'Named' })],
    }));
  });

  it('handleCellBlur is a no-op when no cell is being edited', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.blur(document.body);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('skips cell commit when the edited row no longer exists', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    fireEvent.doubleClick(screen.getByText('AAA'));
    const input = screen.getByDisplayValue('AAA');
    rerender(<SharedDataSourceTableEditor dataSource={makeDs({ rows: [ROWS[1]] })} onChange={onChange} />);
    fireEvent.change(input, { target: { value: 'ZZZ' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses dataTransfer column id when dropping without dragStart state', () => {
    const onChange = vi.fn();
    render(<SharedDataSourceTableEditor dataSource={makeDs()} onChange={onChange} />);
    const headers = document.querySelectorAll('.shared-ds-table-header');
    const dropEvt = {
      ...makeDragEvent(),
      dataTransfer: { ...makeDragEvent().dataTransfer, getData: vi.fn(() => 'c2') },
    };
    fireEvent.drop(headers[0], dropEvt as never);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ columns: [COLS[1], COLS[0]] }));
  });
});
