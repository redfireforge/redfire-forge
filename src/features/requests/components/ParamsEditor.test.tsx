/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParamsEditor, toParamEntries, fromParamEntries } from './ParamsEditor';
import type { ParamEntry } from './ParamsEditor';
import type { WorkflowVariableHint } from '@workflow/utils/workflowVariableHints';

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
    expect(screen.getByText('Query Parameters')).toBeTruthy();
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

  it('opens bulk edit mode with current params', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Edit' }));
    expect(screen.getByPlaceholderText(/key=value/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    const textarea = screen.getByPlaceholderText(/key=value/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('page=1\nlimit=10');
  });

  it('applies bulk edit text on Done and returns to table', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Edit' }));
    const textarea = screen.getByPlaceholderText(/key=value/);
    fireEvent.change(textarea, { target: { value: 'foo=bar\nbaz=qux' } });
    // Draft mode — no onChange until Done
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result[0].key).toBe('foo');
    expect(result[0].value).toBe('bar');
    expect(result[1].key).toBe('baz');
    expect(screen.queryByPlaceholderText(/key=value/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Bulk Edit' })).toBeTruthy();
  });

  it('Cancel discards bulk edits and returns to table', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Edit' }));
    const textarea = screen.getByPlaceholderText(/key=value/);
    fireEvent.change(textarea, { target: { value: 'foo=bar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(makeParams());
    expect(screen.queryByPlaceholderText(/key=value/)).toBeNull();
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

  it('calls onChange when value input changes', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    const valueInputs = screen.getAllByPlaceholderText('value');
    fireEvent.change(valueInputs[0], { target: { value: '99' } });
    expect(onChange.mock.calls[0][0][0].value).toBe('99');
  });

  it('updates description field when description column is visible', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByText('Description'));
    const descInputs = document.querySelectorAll('.params-desc-input');
    fireEvent.change(descInputs[0], { target: { value: 'optional note' } });
    expect(onChange.mock.calls[0][0][0].description).toBe('optional note');
  });

  it('includes workflow variable hints in the source map for simple refs', () => {
    const hints: WorkflowVariableHint[] = [{
      ref: 'page',
      label: 'page (this step)',
    }];
    const params = [
      { key: 'page', value: '{{page}}', enabled: true, description: '' },
      { key: 'limit', value: '10', enabled: true, description: '' },
    ];
    render(<ParamsEditor params={params} onChange={vi.fn()} variableHints={hints} />);
    const sources = document.querySelectorAll('.params-source-cell') as NodeListOf<HTMLInputElement>;
    expect(sources[0].value).toBe('This step');
  });

  it('bulk edit treats lines without "=" as key-only rows', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Edit' }));
    const textarea = screen.getByPlaceholderText(/key=value/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'bareKey' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ key: 'bareKey', value: '' });
  });

  it('bulk edit empty text yields a single empty row', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Edit' }));
    const textarea = screen.getByPlaceholderText(/key=value/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange.mock.calls[0][0]).toEqual([
      expect.objectContaining({ key: '', value: '', enabled: true }),
    ]);
  });

  it('shows enable-parameter title when row is disabled', () => {
    const params = [{ key: 'a', value: '1', enabled: false, description: '' }];
    render(<ParamsEditor params={params} onChange={vi.fn()} />);
    const toggle = document.querySelector('.params-toggle') as HTMLLabelElement;
    expect(toggle?.getAttribute('title')).toBe('Enable parameter');
  });

  it('renders a draggable reorder grip per row', () => {
    render(<ParamsEditor params={makeParams()} onChange={vi.fn()} />);
    const grips = document.querySelectorAll('.params-drag-handle');
    expect(grips).toHaveLength(2);
    expect((grips[0] as HTMLElement).getAttribute('draggable')).toBe('true');
    expect(screen.getByLabelText('Reorder parameter 1')).toBeTruthy();
  });

  it('reorders params on drag-and-drop (drag row 0 onto row 1)', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);

    const data: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, val: string) => { data[type] = val; },
      getData: (type: string) => data[type] ?? '',
    };

    const grips = document.querySelectorAll('.params-drag-handle');
    const rows = document.querySelectorAll('.params-row');
    fireEvent.dragStart(grips[0], { dataTransfer });
    fireEvent.dragOver(rows[1], { dataTransfer });
    fireEvent.drop(rows[1], { dataTransfer });

    expect(onChange).toHaveBeenCalledTimes(1);
    const reordered = onChange.mock.calls[0][0] as ParamEntry[];
    expect(reordered.map((p) => p.key)).toEqual(['limit', 'page']);
  });

  it('does not reorder when a param row is dropped onto itself', () => {
    const onChange = vi.fn();
    render(<ParamsEditor params={makeParams()} onChange={onChange} />);

    const data: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, val: string) => { data[type] = val; },
      getData: (type: string) => data[type] ?? '',
    };

    const grips = document.querySelectorAll('.params-drag-handle');
    const rows = document.querySelectorAll('.params-row');
    fireEvent.dragStart(grips[0], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });

    expect(onChange).not.toHaveBeenCalled();
  });
});

