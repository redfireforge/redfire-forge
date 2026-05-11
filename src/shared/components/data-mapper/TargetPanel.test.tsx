/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TargetPanel from './TargetPanel';
import type { MapperTarget, Mapping } from './types';

const target: MapperTarget = {
  label: 'Output',
  sampleData: { userName: '', email: '', address: { city: '' } },
};

const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };

function renderPanel(overrides?: Partial<Parameters<typeof TargetPanel>[0]>) {
  const defaults = {
    target,
    mappings: [] as Mapping[],
    onDrop: vi.fn(),
    selectedMappingId: null,
    onSelectMapping: vi.fn(),
  };
  return render(<TargetPanel {...defaults} {...overrides} />);
}

describe('TargetPanel', () => {
  it('renders target tree from sampleData', () => {
    renderPanel();
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('shows "Target" panel title', () => {
    renderPanel();
    expect(screen.getByText('Target')).toBeTruthy();
  });

  it('shows mapped badge when mappings exist', () => {
    renderPanel({ mappings: [mapping] });
    expect(screen.getByText('1 mapped')).toBeTruthy();
  });

  it('hides mapped badge when no mappings', () => {
    renderPanel();
    expect(screen.queryByText(/mapped/)).toBeNull();
  });

  it('shows empty state when no sampleData', () => {
    renderPanel({ target: { label: 'Empty', sampleData: null } });
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });

  it('filters by search', () => {
    renderPanel();
    const input = screen.getByPlaceholderText('Search fields…');
    fireEvent.change(input, { target: { value: 'email' } });
    expect(screen.getByText('email')).toBeTruthy();
    expect(screen.queryByText('userName')).toBeNull();
  });

  it('clears search on × click', () => {
    renderPanel();
    const input = screen.getByPlaceholderText('Search fields…');
    fireEvent.change(input, { target: { value: 'email' } });
    fireEvent.click(screen.getByText('×'));
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('expands all nodes on ⊞ click', () => {
    renderPanel();
    fireEvent.click(screen.getByTitle('Expand all'));
    expect(screen.getByText('city')).toBeTruthy();
  });

  it('collapses all on ⊟ click', () => {
    renderPanel();
    fireEvent.click(screen.getByTitle('Expand all'));
    fireEvent.click(screen.getByTitle('Collapse all'));
    expect(screen.queryByText('city')).toBeNull();
  });

  it('shows mapped indicator on mapped fields', () => {
    renderPanel({ mappings: [mapping] });
    fireEvent.click(screen.getByTitle('Expand all'));
    expect(screen.getByText(/← name/)).toBeTruthy();
  });

  it('fires onEditExpression on double-click of mapped field', () => {
    const onEdit = vi.fn();
    renderPanel({ mappings: [mapping], onEditExpression: onEdit });
    fireEvent.click(screen.getByTitle('Expand all'));
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.doubleClick(el);
    expect(onEdit).toHaveBeenCalledWith('m1');
  });

  it('passes onRemoveMapping through to TargetTreeNode', () => {
    const onRemove = vi.fn();
    const { container } = renderPanel({
      mappings: [mapping],
      onRemoveMapping: onRemove,
    });
    fireEvent.click(screen.getByTitle('Expand all'));
    const removeBtn = container.querySelector('.dm-inline-remove');
    expect(removeBtn).toBeTruthy();
  });

  it('shows empty state when target has no sample data', () => {
    const emptyTarget = { label: 'Vars', sampleData: undefined, allowCustomFields: false };
    const { container } = renderPanel({ target: emptyTarget as typeof target });
    expect(container.querySelector('.dm-empty-state')).toBeTruthy();
    expect(container.querySelector('.dm-empty-state')!.textContent).toContain('No target schema');
  });

  it('handles invalid JSON sampleData gracefully', () => {
    renderPanel({ target: { label: 'Bad', sampleData: '{not valid json' } });
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });

  it('handles string sampleData (JSON.parse branch)', () => {
    renderPanel({ target: { label: 'StringTarget', sampleData: '{"output":"value"}' } });
    expect(screen.getByText('output')).toBeTruthy();
  });

  it('toggles a node path between expanded and collapsed', () => {
    renderPanel();
    fireEvent.click(screen.getByTitle('Expand all'));
    expect(screen.getByText('city')).toBeTruthy();
    const toggleBtns = screen.getAllByLabelText('Collapse');
    fireEvent.click(toggleBtns[toggleBtns.length - 1]);
    expect(screen.queryByText('city')).toBeNull();
  });

  it('passes typeMismatches and onQuickFix through', () => {
    const onQuickFix = vi.fn();
    const mismatches = [{ mappingId: 'm1', sourceType: 'string', targetType: 'number', severity: 'warning' as const, message: 'Type mismatch', suggestedFix: '$parseInt($.name)' }];
    const { container } = renderPanel({
      mappings: [mapping],
      typeMismatches: mismatches,
      onQuickFix,
    });
    fireEvent.click(screen.getByTitle('Expand all'));
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).toBeTruthy();
  });

  it('handles expand all when tree is null (no-op)', () => {
    renderPanel({ target: { label: 'Empty', sampleData: null } });
    fireEvent.click(screen.getByTitle('Expand all'));
    expect(screen.getByText(/No target schema/)).toBeTruthy();
  });
});
