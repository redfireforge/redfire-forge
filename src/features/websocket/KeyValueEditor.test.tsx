// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyValueEditor } from './KeyValueEditor';
import type { WsKeyValueEntry } from '@shared/websocket/types';

function makeEntries(...keys: string[]): WsKeyValueEntry[] {
  return keys.map((key) => ({ key, value: `val-${key}`, enabled: true }));
}

describe('KeyValueEditor', () => {
  it('renders label and add button', () => {
    render(<KeyValueEditor entries={[]} onChange={vi.fn()} label="Headers" />);
    expect(screen.getByText('Headers')).toBeInTheDocument();
    expect(screen.getByText('+ Add')).toBeInTheDocument();
  });

  it('renders entries with correct values', () => {
    const entries = makeEntries('Authorization', 'Content-Type');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" testIdPrefix="h" />);
    expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('val-Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Content-Type')).toBeInTheDocument();
  });

  it('calls onChange with new empty entry when Add is clicked', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const newEntries = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(newEntries).toHaveLength(2);
    expect(newEntries[1]).toEqual({ key: '', value: '', enabled: true });
  });

  it('calls onChange when key input changes', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    fireEvent.change(screen.getByDisplayValue('X-Key'), { target: { value: 'New-Key' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(updated[0].key).toBe('New-Key');
  });

  it('calls onChange when value input changes', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    fireEvent.change(screen.getByDisplayValue('val-X-Key'), { target: { value: 'new-val' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(updated[0].value).toBe('new-val');
  });

  it('calls onChange when checkbox is toggled', () => {
    const onChange = vi.fn();
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(updated[0].enabled).toBe(false);
  });

  it('calls onChange with entry removed when remove button is clicked', () => {
    const onChange = vi.fn();
    const entries = makeEntries('A', 'B');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    const removeButtons = screen.getAllByRole('button', { name: /remove headers/i });
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const remaining = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].key).toBe('B');
  });

  it('disables inputs and buttons when disabled=true', () => {
    const entries = makeEntries('X-Key');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" disabled />);
    expect(screen.getByText('+ Add')).toBeDisabled();
    expect(screen.getByDisplayValue('X-Key')).toBeDisabled();
    expect(screen.getByDisplayValue('val-X-Key')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /remove headers/i })).toBeDisabled();
  });

  it('renders with custom section/header/label class names', () => {
    const { container } = render(
      <KeyValueEditor
        entries={[]}
        onChange={vi.fn()}
        label="Headers"
        sectionClassName="custom-section"
        headerClassName="custom-header"
        labelClassName="custom-label"
      />,
    );
    expect(container.querySelector('.custom-section')).toBeInTheDocument();
    expect(container.querySelector('.custom-header')).toBeInTheDocument();
    expect(container.querySelector('.custom-label')).toBeInTheDocument();
  });

  it('renders test-id attributes when testIdPrefix is provided', () => {
    const entries = makeEntries('A');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="H" testIdPrefix="my" />);
    expect(screen.getByTestId('my-section')).toBeInTheDocument();
    expect(screen.getByTestId('my-add-btn')).toBeInTheDocument();
    expect(screen.getByTestId('my-row-0')).toBeInTheDocument();
  });

  it('does not render test-id attributes when testIdPrefix is not provided', () => {
    const entries = makeEntries('A');
    const { container } = render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="H" />);
    const section = container.querySelector('.ws-connect-kv-section');
    expect(section).toBeInTheDocument();
    expect(section?.getAttribute('data-testid')).toBeNull();
  });

  it('renders correct aria labels', () => {
    const entries = makeEntries('A');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" />);
    expect(screen.getByLabelText('Add headers')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable headers 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Headers key 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Headers value 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove headers 1')).toBeInTheDocument();
  });

  it('renders an empty-state hint when there are no entries', () => {
    render(<KeyValueEditor entries={[]} onChange={vi.fn()} label="Headers" testIdPrefix="h" />);
    expect(screen.getByTestId('h-empty')).toBeInTheDocument();
    // The table is not rendered while empty.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders a reorder grip per row with an aria label', () => {
    const entries = makeEntries('A', 'B');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" testIdPrefix="h" />);
    expect(screen.getByTestId('h-grip-0')).toBeInTheDocument();
    expect(screen.getByTestId('h-grip-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Reorder headers 1')).toBeInTheDocument();
  });

  it('reorders entries on drag-and-drop (drag row 0 onto row 2)', () => {
    const onChange = vi.fn();
    const entries = makeEntries('A', 'B', 'C');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" testIdPrefix="h" />);

    const data: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, val: string) => { data[type] = val; },
      getData: (type: string) => data[type] ?? '',
    };

    fireEvent.dragStart(screen.getByTestId('h-grip-0'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('h-row-2'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('h-row-2'), { dataTransfer });

    expect(onChange).toHaveBeenCalledTimes(1);
    const reordered = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(reordered.map((e) => e.key)).toEqual(['B', 'C', 'A']);
  });

  it('does not reorder when dropping a row onto itself', () => {
    const onChange = vi.fn();
    const entries = makeEntries('A', 'B');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" testIdPrefix="h" />);

    const data: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, val: string) => { data[type] = val; },
      getData: (type: string) => data[type] ?? '',
    };

    fireEvent.dragStart(screen.getByTestId('h-grip-0'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('h-row-0'), { dataTransfer });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not render a Delete all button when onDeleteAll is omitted', () => {
    render(<KeyValueEditor entries={makeEntries('A')} onChange={vi.fn()} label="Headers" testIdPrefix="h" />);
    expect(screen.queryByTestId('h-delete-all-btn')).not.toBeInTheDocument();
  });

  it('renders Delete all and calls onDeleteAll when there are entries', () => {
    const onDeleteAll = vi.fn();
    render(
      <KeyValueEditor entries={makeEntries('A')} onChange={vi.fn()} onDeleteAll={onDeleteAll} label="Headers" testIdPrefix="h" />,
    );
    fireEvent.click(screen.getByTestId('h-delete-all-btn'));
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
  });

  it('hides Delete all when there are no entries', () => {
    render(<KeyValueEditor entries={[]} onChange={vi.fn()} onDeleteAll={vi.fn()} label="Headers" testIdPrefix="h" />);
    expect(screen.queryByTestId('h-delete-all-btn')).not.toBeInTheDocument();
  });

  it('updates only the targeted row when multiple entries are present', () => {
    const onChange = vi.fn();
    const entries = makeEntries('A', 'B');
    render(<KeyValueEditor entries={entries} onChange={onChange} label="Headers" />);
    fireEvent.change(screen.getByDisplayValue('B'), { target: { value: 'B-updated' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as WsKeyValueEntry[];
    expect(updated[0].key).toBe('A');
    expect(updated[1].key).toBe('B-updated');
  });

  it('renders disabled-entry styling and tooltip when a row is unchecked', () => {
    const entries: WsKeyValueEntry[] = [{ key: 'X', value: '1', enabled: false }];
    const { container } = render(
      <KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" toggleVerb="send" />,
    );
    expect(container.querySelector('.is-disabled-entry')).toBeInTheDocument();
    expect(screen.getByTitle('Disabled — skipped on send')).toBeInTheDocument();
  });

  it('renders enabled-entry tooltip with the default connect verb', () => {
    const entries = makeEntries('X');
    render(<KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" />);
    expect(screen.getByTitle('Enabled — included on connect')).toBeInTheDocument();
  });

  it('renders Delete all without test ids when testIdPrefix is omitted', () => {
    const onDeleteAll = vi.fn();
    render(
      <KeyValueEditor entries={makeEntries('A')} onChange={vi.fn()} onDeleteAll={onDeleteAll} label="Headers" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete all headers/i }));
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
  });

  it('disables Delete all when the editor is disabled', () => {
    render(
      <KeyValueEditor
        entries={makeEntries('A')}
        onChange={vi.fn()}
        onDeleteAll={vi.fn()}
        label="Headers"
        testIdPrefix="h"
        disabled
      />,
    );
    expect(screen.getByTestId('h-delete-all-btn')).toBeDisabled();
  });

  it('applies drag-over and dragging row classes during reorder', () => {
    const entries = makeEntries('A', 'B');
    const { container } = render(
      <KeyValueEditor entries={entries} onChange={vi.fn()} label="Headers" testIdPrefix="h" />,
    );

    const data: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, val: string) => { data[type] = val; },
      getData: (type: string) => data[type] ?? '',
    };

    fireEvent.dragStart(screen.getByTestId('h-grip-0'), { dataTransfer });
    expect(container.querySelector('.is-dragging')).toBeInTheDocument();

    fireEvent.dragOver(screen.getByTestId('h-row-1'), { dataTransfer });
    expect(container.querySelector('.is-drag-over')).toBeInTheDocument();

    fireEvent.dragEnd(screen.getByTestId('h-grip-0'));
  });

  // Batch coverage-gap tests for edge cases and all branches
  it('exercises all component state combinations in batch', () => {
    const onChange = vi.fn();
    const onDeleteAll = vi.fn();

    // Test with multiple entries and all interaction paths
    const entries: WsKeyValueEntry[] = [
      { key: 'Authorization', value: 'Bearer token', enabled: true },
      { key: 'X-Custom', value: 'custom-value', enabled: false },
      { key: 'Content-Type', value: 'application/json', enabled: true },
    ];

    render(
      <KeyValueEditor
        entries={entries}
        onChange={onChange}
        onDeleteAll={onDeleteAll}
        label="Headers"
        testIdPrefix="test"
        toggleVerb="send"
        disabled={false}
      />,
    );

    // Test all input changes
    fireEvent.change(screen.getByLabelText('Headers key 1'), { target: { value: 'Auth' } });
    fireEvent.change(screen.getByLabelText('Headers value 1'), { target: { value: 'New Token' } });
    fireEvent.change(screen.getByLabelText('Headers key 2'), { target: { value: 'X-New' } });
    fireEvent.change(screen.getByLabelText('Headers value 2'), { target: { value: 'new-val' } });

    // Test checkbox toggle multiple times
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    // Test remove buttons
    const removeButtons = screen.getAllByRole('button', { name: /remove headers/i });
    expect(removeButtons.length).toBe(3);

    // Test delete all and add
    fireEvent.click(screen.getByTestId('test-delete-all-btn'));
    fireEvent.click(screen.getByTestId('test-add-btn'));

    expect(onChange.mock.calls.length).toBeGreaterThan(6);
    expect(onDeleteAll).toHaveBeenCalled();
  });

  it('handles disabled state and custom attributes in batch', () => {
    const entries = makeEntries('A', 'B', 'C');
    const { container } = render(
      <KeyValueEditor
        entries={entries}
        onChange={vi.fn()}
        onDeleteAll={vi.fn()}
        label="Params"
        testIdPrefix="p"
        disabled={true}
        toggleVerb="process"
        sectionClassName="custom-section-class"
        headerClassName="custom-header-class"
        labelClassName="custom-label-class"
      />,
    );

    // Test all disabled elements
    const addBtn = screen.getByTestId('p-add-btn');
    const deleteAllBtn = screen.getByTestId('p-delete-all-btn');
    const checkboxes = screen.getAllByRole('checkbox');
    const removeButtons = screen.getAllByRole('button', { name: /remove params/i });

    expect(addBtn).toBeDisabled();
    expect(deleteAllBtn).toBeDisabled();
    checkboxes.forEach((cb) => {
      expect(cb).toBeDisabled();
    });
    removeButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    // Test custom classes applied
    expect(container.querySelector('.custom-section-class')).toBeInTheDocument();
    expect(container.querySelector('.custom-header-class')).toBeInTheDocument();
    expect(container.querySelector('.custom-label-class')).toBeInTheDocument();

    // Test toggleVerb in aria labels
    expect(screen.getAllByTitle('Enabled — included on process').length).toBeGreaterThan(0);
  });

  it('handles drag-drop with multiple row indices in batch', () => {
    const onChange = vi.fn();
    const entries = makeEntries('Alpha', 'Beta', 'Gamma', 'Delta');
    render(
      <KeyValueEditor entries={entries} onChange={onChange} label="Items" testIdPrefix="i" />,
    );

    const data: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, val: string) => { data[type] = val; },
      getData: (type: string) => data[type] ?? '',
    };

    // Test dragging to different positions
    fireEvent.dragStart(screen.getByTestId('i-grip-0'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('i-row-3'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('i-row-3'), { dataTransfer });
    expect(onChange).toHaveBeenCalled();

    // Test dragging middle element
    onChange.mockClear();
    fireEvent.dragStart(screen.getByTestId('i-grip-1'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('i-row-3'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('i-row-3'), { dataTransfer });
    expect(onChange).toHaveBeenCalled();

    // Test self-drop (no-op)
    onChange.mockClear();
    fireEvent.dragStart(screen.getByTestId('i-grip-2'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('i-row-2'), { dataTransfer });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tests all button interactions with and without test ids', () => {
    const onChange = vi.fn();
    const onDeleteAll = vi.fn();

    // Without test ids
    const { rerender } = render(
      <KeyValueEditor
        entries={makeEntries('Item1', 'Item2')}
        onChange={onChange}
        onDeleteAll={onDeleteAll}
        label="Lines"
      />,
    );

    fireEvent.click(screen.getByLabelText('Add lines'));
    fireEvent.click(screen.getByLabelText('Delete all lines'));
    expect(onChange).toHaveBeenCalled();
    expect(onDeleteAll).toHaveBeenCalled();

    // With test ids
    onChange.mockClear();
    onDeleteAll.mockClear();
    rerender(
      <KeyValueEditor
        entries={makeEntries('Item1')}
        onChange={onChange}
        onDeleteAll={onDeleteAll}
        label="Lines"
        testIdPrefix="l"
      />,
    );

    fireEvent.click(screen.getByTestId('l-add-btn'));
    fireEvent.click(screen.getByTestId('l-delete-all-btn'));
    expect(onChange).toHaveBeenCalled();
    expect(onDeleteAll).toHaveBeenCalled();
  });

  it('renders empty and non-empty states with various labels', () => {
    const { rerender } = render(
      <KeyValueEditor entries={[]} onChange={vi.fn()} label="Auth Headers" testIdPrefix="ah" />,
    );

    expect(screen.getByTestId('ah-empty')).toBeInTheDocument();
    expect(screen.getByText(/No auth headers yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    // Switch to non-empty
    rerender(
      <KeyValueEditor
        entries={makeEntries('X-Token')}
        onChange={vi.fn()}
        label="Auth Headers"
        testIdPrefix="ah"
      />,
    );

    expect(screen.queryByTestId('ah-empty')).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});

