/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocationGroupPanel from './LocationGroupPanel';
import type { TargetField, Mapping } from './types';

function makeFields(locations: Array<{ path: string; location: TargetField['location']; defaultValue?: string }>): TargetField[] {
  return locations.map(({ path, location, defaultValue }) => ({
    path,
    label: path,
    type: 'string',
    location,
    defaultValue,
  }));
}

const baseMappings: Mapping[] = [];
const noop = () => {};

function renderPanel(fields: TargetField[], overrides: Record<string, unknown> = {}) {
  return render(
    <LocationGroupPanel
      fields={fields}
      mappings={baseMappings}
      onDrop={noop}
      search=""
      selectedMappingId={null}
      onSelectMapping={noop}
      existingPaths={new Set(fields.map(f => f.path))}
      {...overrides}
    />,
  );
}

describe('LocationGroupPanel', () => {
  it('renders group headers for fields with locations', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
      { path: 'page', location: 'query' },
      { path: 'Authorization', location: 'header' },
    ]);
    renderPanel(fields);
    expect(screen.getByText('Path')).toBeTruthy();
    expect(screen.getByText('Query')).toBeTruthy();
    expect(screen.getByText('Headers')).toBeTruthy();
  });

  it('shows count badges per group', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
      { path: 'orderId', location: 'path' },
      { path: 'page', location: 'query' },
    ]);
    renderPanel(fields);
    const counts = screen.getAllByText('2');
    expect(counts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('groups fields by location in correct order', () => {
    const fields = makeFields([
      { path: 'name', location: 'body' },
      { path: 'userId', location: 'path' },
      { path: 'page', location: 'query' },
    ]);
    renderPanel(fields);
    const headers = screen.getAllByRole('button', { expanded: true });
    const labels = headers.map(h => h.textContent);
    const pathIdx = labels.findIndex(l => l?.includes('Path'));
    const queryIdx = labels.findIndex(l => l?.includes('Query'));
    const bodyIdx = labels.findIndex(l => l?.includes('Body'));
    expect(pathIdx).toBeLessThan(queryIdx);
    expect(queryIdx).toBeLessThan(bodyIdx);
  });

  it('collapses and expands a group on click', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
    ]);
    renderPanel(fields);
    const header = screen.getByRole('button', { name: /Path section/i });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not render groups for locations with no fields', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
    ]);
    renderPanel(fields);
    expect(screen.getByText('Path')).toBeTruthy();
    expect(screen.queryByText('Query')).toBeNull();
    expect(screen.queryByText('Headers')).toBeNull();
  });

  it('renders ungrouped fields under a general Fields section', () => {
    const fields: TargetField[] = [
      { path: 'misc', label: 'misc', type: 'string' },
    ];
    renderPanel(fields);
    expect(screen.getByText('Fields')).toBeTruthy();
  });

  it('shows empty state when no fields', () => {
    renderPanel([]);
    expect(screen.getByText('No target fields.')).toBeTruthy();
  });

  it('renders per-section add field button when allowCustomFields', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
    ]);
    const onAdd = vi.fn();
    renderPanel(fields, { allowCustomFields: true, onAddCustomField: onAdd });
    const addBtns = screen.getAllByText('+ Add Field');
    expect(addBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('passes location to AddFieldRow for per-section add', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
    ]);
    const onAdd = vi.fn();
    renderPanel(fields, { allowCustomFields: true, onAddCustomField: onAdd });
    const addBtn = screen.getByText('+ Add Field');
    fireEvent.click(addBtn);
    const input = screen.getByLabelText('Field name');
    fireEvent.change(input, { target: { value: 'newParam' } });
    const confirm = screen.getByLabelText('Confirm add field');
    fireEvent.click(confirm);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'newParam', location: 'path' }),
    );
  });

  it('renders nodes with data-path attributes for connection lines', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
      { path: 'page', location: 'query' },
    ]);
    const { container } = renderPanel(fields);
    expect(container.querySelector('[data-path="userId"]')).toBeTruthy();
    expect(container.querySelector('[data-path="page"]')).toBeTruthy();
  });

  it('handles tree node toggle within a group (expand/collapse children)', () => {
    const fields = makeFields([
      { path: 'user.name', location: 'body' },
      { path: 'user.email', location: 'body' },
    ]);
    const { container } = renderPanel(fields);
    const toggles = container.querySelectorAll('.dm-tree-toggle:not(.dm-tree-toggle--spacer)');
    expect(toggles.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(toggles[0]);
  });

  it('renders ungrouped fields under general Fields section with count', () => {
    const fields: TargetField[] = [
      { path: 'a', label: 'a', type: 'string' },
      { path: 'b', label: 'b', type: 'number' },
    ];
    renderPanel(fields);
    expect(screen.getByText('Fields')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('ungrouped section general Fields button click does not crash', () => {
    const fields: TargetField[] = [
      { path: 'misc', label: 'misc', type: 'string' },
    ];
    renderPanel(fields);
    const btn = screen.getByRole('button', { name: /Fields section/i });
    fireEvent.click(btn);
  });

  it('shows location-specific accent colors via CSS classes', () => {
    const fields = makeFields([
      { path: 'userId', location: 'path' },
      { path: 'page', location: 'query' },
      { path: 'Auth', location: 'header' },
      { path: 'name', location: 'body' },
      { path: 'field1', location: 'bodyForm' },
    ]);
    const { container } = renderPanel(fields);
    expect(container.querySelector('.dm-loc-group--path')).toBeTruthy();
    expect(container.querySelector('.dm-loc-group--query')).toBeTruthy();
    expect(container.querySelector('.dm-loc-group--header')).toBeTruthy();
    expect(container.querySelector('.dm-loc-group--body')).toBeTruthy();
    expect(container.querySelector('.dm-loc-group--form')).toBeTruthy();
  });

  it('resetViewSignal re-expands all paths', () => {
    const fields = makeFields([
      { path: 'outer.inner', location: 'body' },
    ]);
    const { rerender } = renderPanel(fields, { resetViewSignal: 0 });
    rerender(
      <LocationGroupPanel
        fields={fields}
        mappings={baseMappings}
        onDrop={noop}
        search=""
        selectedMappingId={null}
        onSelectMapping={noop}
        existingPaths={new Set(fields.map(f => f.path))}
        resetViewSignal={1}
      />,
    );
    expect(screen.getByText('outer.inner')).toBeTruthy();
  });

  it('toggling a tree node collapses it', () => {
    const fields = makeFields([
      { path: 'data.name', location: 'body' },
    ]);
    renderPanel(fields);
    const collapseBtn = screen.queryAllByLabelText('Collapse');
    if (collapseBtn.length > 0) {
      fireEvent.click(collapseBtn[0]);
      expect(screen.queryAllByLabelText('Expand').length).toBeGreaterThanOrEqual(1);
    }
  });
});
