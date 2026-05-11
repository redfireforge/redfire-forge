/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TargetTreeNode from './TargetTreeNode';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping } from './types';
import type { TypeMismatch } from './utils/typeMismatch';

const leaf: JsonTreeNode = { key: 'userName', path: 'userName', type: 'string', value: '', children: [] };
const nested: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    leaf,
    { key: 'email', path: 'email', type: 'string', value: '', children: [] },
  ],
};

const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };

const defaults = {
  depth: 0,
  search: '',
  mappings: [] as Mapping[],
  onDrop: vi.fn(),
  expandedPaths: new Set(['__root__', '']),
  onToggle: vi.fn(),
  selectedMappingId: null,
  onSelectMapping: vi.fn(),
};

describe('TargetTreeNode', () => {
  it('renders leaf node with key', () => {
    render(<TargetTreeNode node={leaf} {...defaults} />);
    expect(screen.getByText('userName')).toBeTruthy();
  });

  it('shows "Drop here" hint on unmapped leaf', () => {
    render(<TargetTreeNode node={leaf} {...defaults} />);
    expect(screen.getByText('Drop here')).toBeTruthy();
  });

  it('shows mapped indicator when mapping exists', () => {
    const { container } = render(<TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} />);
    expect(container.querySelector('.dm-mapped-badge')).toBeTruthy();
    expect(screen.getByText('←')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.queryByText('Drop here')).toBeNull();
  });

  it('shows "fx" pill for expression mappings', () => {
    const exprMapping = { ...mapping, expression: '$upper($.name)' };
    const { container } = render(<TargetTreeNode node={leaf} {...defaults} mappings={[exprMapping]} />);
    expect(container.querySelector('.dm-mapped-fx-pill')).toBeTruthy();
    expect(container.querySelector('.dm-mapped-fx-pill')!.textContent).toBe('fx');
  });

  it('toggles selection on click', () => {
    const onSelect = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} onSelectMapping={onSelect} />);
    fireEvent.click(screen.getByText('userName').closest('.dm-tree-node')!);
    expect(onSelect).toHaveBeenCalledWith('m1');
  });

  it('deselects when already selected', () => {
    const onSelect = vi.fn();
    render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} selectedMappingId="m1" onSelectMapping={onSelect} />,
    );
    fireEvent.click(screen.getByText('userName').closest('.dm-tree-node')!);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('fires onEditExpression on double-click', () => {
    const onEdit = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} onEditExpression={onEdit} />);
    fireEvent.doubleClick(screen.getByText('userName').closest('.dm-tree-node')!);
    expect(onEdit).toHaveBeenCalledWith('m1');
  });

  it('renders children when expanded', () => {
    render(<TargetTreeNode node={nested} {...defaults} />);
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('hides children when collapsed', () => {
    const collapsed = { ...defaults, expandedPaths: new Set<string>() };
    render(<TargetTreeNode node={nested} {...collapsed} />);
    expect(screen.getByText('(root)')).toBeTruthy();
    expect(screen.queryByText('userName')).toBeNull();
  });

  it('filters by search', () => {
    render(<TargetTreeNode node={nested} {...defaults} search="email" />);
    expect(screen.getByText('email')).toBeTruthy();
    expect(screen.queryByText('userName')).toBeNull();
  });

  it('adds drag-over class on dragOver', () => {
    render(<TargetTreeNode node={leaf} {...defaults} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.dragOver(el, { dataTransfer: { dropEffect: 'none' } });
    expect(el.className).toContain('dm-tree-node--drag-over');
  });

  it('removes drag-over class on dragLeave', () => {
    render(<TargetTreeNode node={leaf} {...defaults} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.dragOver(el, { dataTransfer: { dropEffect: 'none' } });
    fireEvent.dragLeave(el);
    expect(el.className).not.toContain('dm-tree-node--drag-over');
  });

  it('shows warning mismatch badge', () => {
    const mapping: Mapping = { id: 'm1', sourcePath: 'price', sourceId: 's1', targetPath: 'userName' };
    const mismatch: TypeMismatch = {
      mappingId: 'm1', sourcePath: 'price', targetPath: 'userName',
      sourceType: 'number', targetType: 'string',
      severity: 'warning', message: 'Source is number, target expects string.',
      suggestedFix: '$toString($.price)',
    };
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} typeMismatches={[mismatch]} />,
    );
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('⚠');
    expect(badge?.className).toContain('dm-mismatch--warning');
  });

  it('shows info mismatch badge for structural mismatches', () => {
    const mapping: Mapping = { id: 'm1', sourcePath: 'tags', sourceId: 's1', targetPath: 'userName' };
    const mismatch: TypeMismatch = {
      mappingId: 'm1', sourcePath: 'tags', targetPath: 'userName',
      sourceType: 'array', targetType: 'string',
      severity: 'info', message: 'Source is array, target expects string.',
    };
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} typeMismatches={[mismatch]} />,
    );
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('ℹ');
    expect(badge?.className).toContain('dm-mismatch--info');
  });

  it('calls onQuickFix when clicking warning badge with suggested fix', () => {
    const mapping: Mapping = { id: 'm1', sourcePath: 'price', sourceId: 's1', targetPath: 'userName' };
    const mismatch: TypeMismatch = {
      mappingId: 'm1', sourcePath: 'price', targetPath: 'userName',
      sourceType: 'number', targetType: 'string',
      severity: 'warning', message: 'Source is number.',
      suggestedFix: '$toString($.price)',
    };
    const onQuickFix = vi.fn();
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} typeMismatches={[mismatch]} onQuickFix={onQuickFix} />,
    );
    const badge = container.querySelector('.dm-mismatch-badge')!;
    fireEvent.click(badge);
    expect(onQuickFix).toHaveBeenCalledWith('m1', '$toString($.price)');
  });

  it('does not show mismatch badge when no mismatch exists', () => {
    const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} typeMismatches={[]} />,
    );
    expect(container.querySelector('.dm-mismatch-badge')).toBeNull();
  });
});

describe('inline remove button', () => {
  it('shows inline remove button on mapped node when onRemoveMapping is provided', () => {
    const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };
    const onRemove = vi.fn();
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} onRemoveMapping={onRemove} />,
    );
    const btn = container.querySelector('.dm-inline-remove');
    expect(btn).toBeTruthy();
  });

  it('calls onRemoveMapping when inline remove is clicked', () => {
    const mapping: Mapping = { id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' };
    const onRemove = vi.fn();
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} onRemoveMapping={onRemove} />,
    );
    const btn = container.querySelector('.dm-inline-remove')!;
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalledWith('m1');
  });

  it('does not show inline remove on unmapped nodes', () => {
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[]} onRemoveMapping={vi.fn()} />,
    );
    expect(container.querySelector('.dm-inline-remove')).toBeNull();
  });
});

describe('TargetTreeNode – drop handling', () => {
  it('calls onDrop with parsed drag data on drop', () => {
    const onDrop = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} onDrop={onDrop} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none' };
    fireEvent.dragOver(el, { dataTransfer: dt });
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onDrop).toHaveBeenCalledWith('userName', 'name', 's1');
  });

  it('handles invalid drag data gracefully', () => {
    const onDrop = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} onDrop={onDrop} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = { getData: () => 'not json', dropEffect: 'none' };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('does not accept drop on non-leaf (parent) nodes', () => {
    const onDrop = vi.fn();
    render(<TargetTreeNode node={nested} {...defaults} onDrop={onDrop} />);
    const rootEl = screen.getByText('(root)').closest('.dm-tree-node')!;
    const dragData = JSON.stringify({ path: 'name', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none' };
    fireEvent.drop(rootEl, { dataTransfer: dt });
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe('TargetTreeNode – toggle', () => {
  it('calls onToggle with __root__ for root node', () => {
    const onToggle = vi.fn();
    render(<TargetTreeNode node={nested} {...defaults} onToggle={onToggle} />);
    const toggleBtn = screen.getByLabelText('Collapse');
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledWith('__root__');
  });

  it('shows child count when collapsed', () => {
    const collapsed = { ...defaults, expandedPaths: new Set<string>() };
    render(<TargetTreeNode node={nested} {...collapsed} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('does not call onSelectMapping on unmapped node click', () => {
    const onSelect = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} onSelectMapping={onSelect} />);
    fireEvent.click(screen.getByText('userName').closest('.dm-tree-node')!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onEditExpression on unmapped double-click', () => {
    const onEdit = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} onEditExpression={onEdit} />);
    fireEvent.doubleClick(screen.getByText('userName').closest('.dm-tree-node')!);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('returns null when node does not match search', () => {
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} search="nonexistent" />,
    );
    expect(container.querySelector('.dm-tree-node')).toBeNull();
  });
});

describe('trace overlay', () => {
  it('renders trace value on target node when traceOverlay has matching path', () => {
    const traceOverlay = new Map([['userName', { value: 'Alice', isError: false }]]);
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />,
    );
    expect(container.querySelector('.dm-trace-value--ok')).not.toBeNull();
    expect(container.querySelector('.dm-trace-value')!.textContent).toBe('= Alice');
  });

  it('renders error trace value with error styling on target', () => {
    const traceOverlay = new Map([['userName', { value: 'undefined', isError: true }]]);
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />,
    );
    expect(container.querySelector('.dm-trace-value--error')).not.toBeNull();
  });

  it('does not render trace value when traceOverlay is not provided', () => {
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} />,
    );
    expect(container.querySelector('.dm-trace-value')).toBeNull();
  });

  it('truncates long trace values on target', () => {
    const longVal = 'b'.repeat(30);
    const traceOverlay = new Map([['userName', { value: longVal, isError: false }]]);
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />,
    );
    const text = container.querySelector('.dm-trace-value')!.textContent!;
    expect(text.startsWith('=')).toBe(true);
    expect(text.endsWith('…')).toBe(true);
  });

  it('passes traceOverlay to child nodes', () => {
    const traceOverlay = new Map([['email', { value: 'alice@test.com', isError: false }]]);
    const { container } = render(
      <TargetTreeNode node={nested} {...defaults} traceOverlay={traceOverlay} />,
    );
    expect(container.querySelector('.dm-trace-value--ok')).not.toBeNull();
  });
});
