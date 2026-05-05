/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParamsEditor, toParamEntries, fromParamEntries } from './ParamsEditor';
import type { ParamEntry } from './ParamsEditor';

function makeParams(overrides?: Partial<ParamEntry>[]): ParamEntry[] {
  const defaults: ParamEntry[] = [
    { key: 'page', value: '1', enabled: true, description: '' },
    { key: 'limit', value: '10', enabled: true, description: '' },
  ];
  if (!overrides) return defaults;
  return overrides.map((o, i) => ({ ...defaults[i % defaults.length], ...o }));
}

describe('toParamEntries', () => {
  it('returns a single empty row for empty array', () => {
    const result = toParamEntries([]);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('');
    expect(result[0].enabled).toBe(true);
  });

  it('maps KeyValue[] to ParamEntry[] with enabled=true', () => {
    const result = toParamEntries([{ key: 'a', value: 'b' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'a', value: 'b', enabled: true, description: '' });
  });
});

describe('fromParamEntries', () => {
  it('filters out disabled entries', () => {
    const result = fromParamEntries([
      { key: 'a', value: '1', enabled: false, description: '' },
      { key: 'b', value: '2', enabled: true, description: '' },
    ]);
    expect(result).toEqual([{ key: 'b', value: '2' }]);
  });

  it('filters out entries with empty key', () => {
    const result = fromParamEntries([
      { key: '', value: '1', enabled: true, description: '' },
      { key: 'b', value: '2', enabled: true, description: '' },
    ]);
    expect(result).toEqual([{ key: 'b', value: '2' }]);
  });
});

describe('ParamsEditor', () => {
  it('renders section label and active count badge', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    expect(screen.getByText('QUERY PARAMETERS')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // badge for 2 active params
  });

  it('renders parameter name inputs', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('page')).toBeTruthy();
    expect(screen.getByDisplayValue('limit')).toBeTruthy();
  });

  it('calls onChange when name input changes', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('page'), { target: { value: 'offset' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0];
    expect(updated[0].key).toBe('offset');
  });

  it('adds a row when Add button is clicked', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(3);
  });

  it('deletes all rows when Delete all is clicked', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByText('Delete all'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('');
  });

  it('removes a specific row when delete button is clicked', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    expect(onChange.mock.calls[0][0][0].key).toBe('limit');
  });

  it('toggles bulk edit mode', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Bulk Edit'));
    expect(screen.getByPlaceholderText(/key=value/)).toBeTruthy();
  });

  it('bulk edit textarea shows current params', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Bulk Edit'));
    const textarea = screen.getByPlaceholderText(/key=value/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('page=1\nlimit=10');
  });

  it('parses bulk edit text on change', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByText('Bulk Edit'));
    const textarea = screen.getByPlaceholderText(/key=value/);
    fireEvent.change(textarea, { target: { value: 'foo=bar\nbaz=qux' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result[0].key).toBe('foo');
    expect(result[0].value).toBe('bar');
    expect(result[1].key).toBe('baz');
  });

  it('toggles description column', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Description'));
    const descInputs = document.querySelectorAll('.params-desc-input');
    expect(descInputs.length).toBe(2);
  });

  it('toggles enable/disable checkbox', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.params-toggle input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].enabled).toBe(false);
  });

  it('renders Insert… button when onInsertVariable is provided', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} onInsertVariable={vi.fn()} />);
    const insertBtns = screen.getAllByText('Insert…');
    expect(insertBtns.length).toBe(2);
  });

  it('calls onInsertVariable with row index when Insert… is clicked', () => {
    const onInsert = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} onInsertVariable={onInsert} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);
    expect(onInsert).toHaveBeenCalledWith(0, 'page');
  });

  it('Import from URL calls onImportFromUrl callback', () => {
    const onImport = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} onImportFromUrl={onImport} />);
    fireEvent.click(screen.getByText('Import from URL'));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('hides Import from URL button when onImportFromUrl is not provided', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    expect(screen.queryByText('Import from URL')).toBeNull();
  });

  it('shows no badge when no active params', () => {
    render(<ParamsEditor params={[{ key: '', value: '', enabled: true, description: '' }]} onChange={vi.fn()} />);
    expect(screen.getByText('QUERY PARAMETERS')).toBeTruthy();
    expect(document.querySelector('.tab-badge')).toBeNull();
  });
});
