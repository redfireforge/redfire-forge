/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchableVariableSelect from './SearchableVariableSelect';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

const hints: WorkflowVariableHint[] = [
  { ref: 'status', label: 'status (latest)', type: 'number', source: { nodeId: 'n1', nodeLabel: 'GET Users' } },
  { ref: 'userId', label: 'userId (latest)', type: 'string', source: { nodeId: 'n1', nodeLabel: 'GET Users' } },
  { ref: 'reportTitle', label: 'reportTitle', type: 'string', source: { nodeId: 'start', nodeLabel: 'Start' } },
  { ref: 'node:"GET Users".httpStatus', label: 'httpStatus (GET Users)', type: 'number', source: { nodeId: 'n1', nodeLabel: 'GET Users' } },
];

function renderSelect(props: Partial<React.ComponentProps<typeof SearchableVariableSelect>> = {}) {
  const defaults = { hints, value: '', onChange: vi.fn(), 'aria-label': 'Pick variable', ...props };
  return render(<SearchableVariableSelect {...defaults} />);
}

describe('SearchableVariableSelect', () => {
  it('renders a combobox input', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    expect(input).toBeTruthy();
    expect(input.getAttribute('aria-label')).toBe('Pick variable');
  });

  it('shows placeholder when no value is selected', () => {
    renderSelect();
    expect(screen.getByPlaceholderText('— Select variable —')).toBeTruthy();
  });

  it('shows display text when a value is selected', () => {
    renderSelect({ value: 'status' });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toContain('status');
    expect(input.value).toContain('GET Users');
  });

  it('opens dropdown on focus', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('opens dropdown on chevron click', () => {
    const { container } = renderSelect();
    const chevron = container.querySelector('.svs-chevron')!;
    fireEvent.click(chevron);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('shows group headers in dropdown', () => {
    renderSelect();
    fireEvent.focus(screen.getByRole('combobox'));
    const headers = document.querySelectorAll('.svs-group-header');
    const texts = Array.from(headers).map((h) => h.textContent);
    expect(texts).toContain('GET Users');
    expect(texts).toContain('Start');
  });

  it('shows items sorted alphabetically within groups', () => {
    renderSelect();
    fireEvent.focus(screen.getByRole('combobox'));
    const items = document.querySelectorAll('.svs-item-name');
    const getUsers = Array.from(items).map((i) => i.textContent!);
    // GET Users group: httpStatus, status, userId (alpha sort)
    const getUsersItems = getUsers.slice(0, 3);
    expect(getUsersItems).toEqual(['httpStatus', 'status', 'userId']);
  });

  it('shows type badges', () => {
    renderSelect();
    fireEvent.focus(screen.getByRole('combobox'));
    const badges = document.querySelectorAll('.svs-item-type');
    const badgeTexts = Array.from(badges).map((b) => b.textContent);
    expect(badgeTexts).toContain('number');
    expect(badgeTexts).toContain('string');
  });

  it('filters items by query', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'report' } });
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('reportTitle');
  });

  it('shows "No variables match" for unmatched query', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzzznothing' } });
    expect(document.querySelector('.svs-empty')).toBeTruthy();
    expect(document.querySelector('.svs-empty')!.textContent).toContain('No variables match');
  });

  it('calls onChange when an item is clicked', () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    fireEvent.focus(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    fireEvent.mouseDown(options[1]); // click second item
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown after selection', () => {
    renderSelect();
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    const options = screen.getAllByRole('option');
    fireEvent.mouseDown(options[0]);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('navigates with ArrowDown/ArrowUp and selects with Enter', () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Arrow down twice, then Enter
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('navigates up with ArrowUp (does not go below 0)', () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Try going up from 0 — should stay at 0
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown with Escape', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens dropdown with ArrowDown when closed', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    // Don't focus — just keyDown
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('opens dropdown with Enter when closed', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('opens dropdown with Space when closed', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: ' ' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('shows "Custom name…" option when showCustom is true', () => {
    renderSelect({ showCustom: true });
    fireEvent.focus(screen.getByRole('combobox'));
    expect(document.querySelector('.svs-item-custom')).toBeTruthy();
    expect(document.querySelector('.svs-item-custom')!.textContent).toContain('Custom name…');
  });

  it('does not show "Custom name…" when showCustom is false', () => {
    renderSelect({ showCustom: false });
    fireEvent.focus(screen.getByRole('combobox'));
    expect(document.querySelector('.svs-item-custom')).toBeNull();
  });

  it('calls onCustom when "Custom name…" is clicked', () => {
    const onCustom = vi.fn();
    renderSelect({ showCustom: true, onCustom });
    fireEvent.focus(screen.getByRole('combobox'));
    const custom = document.querySelector('.svs-item-custom')!;
    fireEvent.mouseDown(custom);
    expect(onCustom).toHaveBeenCalledTimes(1);
  });

  it('selects "Custom name…" via keyboard', () => {
    const onCustom = vi.fn();
    renderSelect({ showCustom: true, onCustom });
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    // Navigate past all items to Custom option
    for (let i = 0; i <= hints.length; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    }
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCustom).toHaveBeenCalledTimes(1);
  });

  it('applies invalid class when invalid prop is true', () => {
    renderSelect({ invalid: true });
    const input = screen.getByRole('combobox');
    expect(input.className).toContain('wf-input-invalid');
  });

  it('does not apply invalid class when invalid is false', () => {
    renderSelect({ invalid: false });
    const input = screen.getByRole('combobox');
    expect(input.className).not.toContain('wf-input-invalid');
  });

  it('shows checkmark on selected item', () => {
    renderSelect({ value: 'status' });
    fireEvent.focus(screen.getByRole('combobox'));
    const check = document.querySelector('.svs-item-check');
    expect(check).toBeTruthy();
    expect(check!.textContent).toBe('✓');
  });

  it('extracts displayName from node-scoped refs', () => {
    renderSelect({ value: 'node:"GET Users".httpStatus' });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toContain('httpStatus');
    expect(input.value).toContain('GET Users');
  });

  it('filters by source node label', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Start' } });
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('reportTitle');
  });

  it('closes dropdown on outside click', () => {
    renderSelect();
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeTruthy();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('handles hints without source (defaults to Workflow group)', () => {
    const hintsNoSource: WorkflowVariableHint[] = [
      { ref: 'globalVar', label: 'globalVar' },
    ];
    render(
      <SearchableVariableSelect hints={hintsNoSource} value="" onChange={vi.fn()} aria-label="Pick" />,
    );
    fireEvent.focus(screen.getByRole('combobox'));
    const headers = document.querySelectorAll('.svs-group-header');
    expect(headers.length).toBe(1);
    expect(headers[0].textContent).toBe('Workflow');
  });

  it('handles empty hints list', () => {
    render(
      <SearchableVariableSelect hints={[]} value="" onChange={vi.fn()} aria-label="Pick" />,
    );
    fireEvent.focus(screen.getByRole('combobox'));
    expect(document.querySelector('.svs-empty')).toBeTruthy();
  });

  it('highlights item on mouseEnter', () => {
    renderSelect();
    fireEvent.focus(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    fireEvent.mouseEnter(options[2]);
    expect(options[2].getAttribute('data-active')).toBe('true');
  });

  it('toggles dropdown with chevron click', () => {
    const { container } = renderSelect();
    const chevron = container.querySelector('.svs-chevron')!;
    // Open
    fireEvent.click(chevron);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});
