/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { selectOption, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
import DataSourcePastePreview from './DataSourcePastePreview';
import type { DataSourceColumn } from '@shared/types';

const existingColumns: DataSourceColumn[] = [
  { id: 'col-userid', name: 'userId', type: 'path', mapping: 'userId' },
  { id: 'col-status', name: 'status', type: 'param', mapping: 'status' },
];

describe('DataSourcePastePreview', () => {
  it('renders header with row count (plural)', () => {
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['userId'], rows: [['1'], ['2']] }}
        existingColumns={existingColumns}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 rows detected/)).toBeInTheDocument();
  });

  it('renders singular wording for one row', () => {
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['userId'], rows: [['1']] }}
        existingColumns={existingColumns}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 row detected/)).toBeInTheDocument();
  });

  it('auto-maps headers matching an existing column by name', () => {
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['userId', 'unknown'], rows: [['1', 'x']] }}
        existingColumns={existingColumns}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(getCustomSelectValue(document.body, 0)).toBe('userId');
    expect(getCustomSelectValue(document.body, 1)).toBe('+ New Column');
  });

  it('limits preview to 5 rows and shows the more indicator', () => {
    const rows = Array.from({ length: 8 }, (_, i) => [String(i)]);
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['userId'], rows }}
        existingColumns={existingColumns}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/…and 3 more rows/)).toBeInTheDocument();
  });

  it('confirms with mapped columns only (no new columns)', () => {
    const onConfirm = vi.fn();
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['userId', 'status'], rows: [['1', 'active'], ['2', 'inactive']] }}
        existingColumns={existingColumns}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Append Rows'));
    const [rows, newCols] = onConfirm.mock.calls[0];
    expect(newCols).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0].values['col-userid']).toBe('1');
    expect(rows[0].values['col-status']).toBe('active');
    expect(rows[0].enabled).toBe(true);
  });

  it('creates new columns for __new__ mappings and fills missing cells', () => {
    const onConfirm = vi.fn();
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['brandNew'], rows: [['v1'], []] }}
        existingColumns={existingColumns}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Append Rows'));
    const [rows, newCols] = onConfirm.mock.calls[0];
    expect(newCols).toHaveLength(1);
    expect(newCols[0].name).toBe('brandNew');
    expect(newCols[0].type).toBe('param');
    const newColId = newCols[0].id;
    expect(rows[0].values[newColId]).toBe('v1');
    expect(rows[1].values[newColId]).toBe('');
  });

  it('updates mapping via select change', () => {
    const onConfirm = vi.fn();
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['foo'], rows: [['bar']] }}
        existingColumns={existingColumns}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    selectOption(document.body, 'status');
    expect(getCustomSelectValue(document.body, 0)).toBe('status');
    fireEvent.click(screen.getByText('Append Rows'));
    const [rows, newCols] = onConfirm.mock.calls[0];
    expect(newCols).toBeUndefined();
    expect(rows[0].values['col-status']).toBe('bar');
  });

  it('cancels', () => {
    const onCancel = vi.fn();
    render(
      <DataSourcePastePreview
        pasteData={{ headers: ['foo'], rows: [['bar']] }}
        existingColumns={existingColumns}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
