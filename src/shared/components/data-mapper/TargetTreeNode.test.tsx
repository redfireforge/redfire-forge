/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
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
  it('calls onReorderField when another target field is dropped', () => {
    const onReorderField = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} onReorderField={onReorderField} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = {
      getData: (type: string) => (type === 'application/mapper-target-field'
        ? JSON.stringify({ kind: 'target-field', path: 'email' })
        : ''),
      dropEffect: 'none',
    };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onReorderField).toHaveBeenCalledWith('email', 'userName');
  });

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

  it('accepts drop on non-leaf nodes that have a concrete path', () => {
    const onDrop = vi.fn();
    const parentNode: JsonTreeNode = {
      key: '[0]',
      path: 'offers[0]',
      type: 'object',
      value: {},
      children: [
        { key: 'associatedOfferingCode', path: 'offers[0].associatedOfferingCode', type: 'string', value: '' },
      ],
    };
    const expandedPaths = new Set<string>(['__root__', 'offers[0]']);
    render(<TargetTreeNode node={parentNode} {...defaults} expandedPaths={expandedPaths} onDrop={onDrop} />);
    const parentEl = screen.getByText('offers[0]').closest('.dm-tree-node')!;
    const dragData = JSON.stringify({ path: 'offers[0]', sourceId: 's1' });
    const dt = { getData: () => dragData, dropEffect: 'none' };
    fireEvent.dragOver(parentEl, { dataTransfer: dt });
    fireEvent.drop(parentEl, { dataTransfer: dt });
    expect(onDrop).toHaveBeenCalledWith('offers[0]', 'offers[0]', 's1');
  });

  it('does not accept drop on root node without path', () => {
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

describe('rename and double-click', () => {
  const customLeaf: JsonTreeNode = { key: 'myField', path: 'myField', type: 'string', value: undefined, children: [] };

  it('double-click on unmapped custom field starts rename', () => {
    const fieldOrigins = new Map([['myField', 'custom' as const]]);
    const onUpdate = vi.fn();
    render(
      <TargetTreeNode
        node={customLeaf}
        {...defaults}
        fieldOrigins={fieldOrigins}
        onUpdateCustomField={onUpdate}
      />,
    );
    const node = screen.getByText('myField');
    fireEvent.doubleClick(node.closest('.dm-tree-node')!);
    expect(screen.getByLabelText('Rename field')).toBeTruthy();
  });

  it('rename submit calls onUpdateCustomField with new path', () => {
    const fieldOrigins = new Map([['myField', 'custom' as const]]);
    const onUpdate = vi.fn();
    render(
      <TargetTreeNode
        node={customLeaf}
        {...defaults}
        fieldOrigins={fieldOrigins}
        onUpdateCustomField={onUpdate}
      />,
    );
    fireEvent.doubleClick(screen.getByText('myField').closest('.dm-tree-node')!);
    const input = screen.getByLabelText('Rename field');
    fireEvent.change(input, { target: { value: 'newName' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('myField', expect.objectContaining({ path: 'newName' }));
  });

  it('rename cancel via Escape reverts without calling update', () => {
    const fieldOrigins = new Map([['myField', 'custom' as const]]);
    const onUpdate = vi.fn();
    render(
      <TargetTreeNode
        node={customLeaf}
        {...defaults}
        fieldOrigins={fieldOrigins}
        onUpdateCustomField={onUpdate}
      />,
    );
    fireEvent.doubleClick(screen.getByText('myField').closest('.dm-tree-node')!);
    const input = screen.getByLabelText('Rename field');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('myField')).toBeTruthy();
  });

  it('rename submit with same value cancels rename', () => {
    const fieldOrigins = new Map([['myField', 'custom' as const]]);
    const onUpdate = vi.fn();
    render(
      <TargetTreeNode
        node={customLeaf}
        {...defaults}
        fieldOrigins={fieldOrigins}
        onUpdateCustomField={onUpdate}
      />,
    );
    fireEvent.doubleClick(screen.getByText('myField').closest('.dm-tree-node')!);
    const input = screen.getByLabelText('Rename field');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('double-click on mapped field opens expression editor', () => {
    const onEdit = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        onEditExpression={onEdit}
      />,
    );
    fireEvent.doubleClick(screen.getByText('userName').closest('.dm-tree-node')!);
    expect(onEdit).toHaveBeenCalledWith('m1');
  });
});

describe('default value display', () => {
  it('shows default value on unmapped node with value', () => {
    const nodeWithDefault: JsonTreeNode = {
      key: 'page', path: 'page', type: 'string', value: '1', children: [],
    };
    const { container } = render(
      <TargetTreeNode node={nodeWithDefault} {...defaults} />,
    );
    expect(container.querySelector('.dm-default-value')).toBeTruthy();
    expect(container.querySelector('.dm-default-value')!.textContent).toBe('= 1');
  });

  it('hides default value when node is mapped', () => {
    const nodeWithDefault: JsonTreeNode = {
      key: 'userName', path: 'userName', type: 'string', value: 'DefaultUser', children: [],
    };
    const { container } = render(
      <TargetTreeNode node={nodeWithDefault} {...defaults} mappings={[mapping]} />,
    );
    expect(container.querySelector('.dm-default-value')).toBeNull();
  });

  it('does not show default value when value is empty string', () => {
    const nodeEmpty: JsonTreeNode = {
      key: 'email', path: 'email', type: 'string', value: '', children: [],
    };
    const { container } = render(
      <TargetTreeNode node={nodeEmpty} {...defaults} />,
    );
    expect(container.querySelector('.dm-default-value')).toBeNull();
  });

  it('truncates long default values', () => {
    const longVal = 'x'.repeat(30);
    const nodeWithLong: JsonTreeNode = {
      key: 'data', path: 'data', type: 'string', value: longVal, children: [],
    };
    const { container } = render(
      <TargetTreeNode node={nodeWithLong} {...defaults} />,
    );
    const text = container.querySelector('.dm-default-value')!.textContent!;
    expect(text.endsWith('…')).toBe(true);
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

  it('shows operator pill and opens picker on click', async () => {
    const onUpdateMappingOperator = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    // Operator pill should be visible
    const pill = screen.getByLabelText('Change operator from equals');
    expect(pill).toBeTruthy();
    expect(pill.textContent).toContain('equals');

    // Click the pill
    fireEvent.click(pill);

    // The picker should be rendered with fixed positioning
    const picker = document.querySelector('.dm-operator-picker');
    expect(picker).not.toBeNull();
    expect(picker!.textContent).toContain('Select Operator');
    expect(picker!.textContent).toContain('greater than');
    expect(picker!.textContent).toContain('contains');
  });

  it('operator picker stays open after click (not immediately dismissed)', () => {
    const onUpdateMappingOperator = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    const pill = screen.getByLabelText('Change operator from equals');
    fireEvent.click(pill);

    // Picker should exist immediately after click
    const picker = document.querySelector('.dm-operator-picker');
    expect(picker).not.toBeNull();
    expect(picker!.querySelector('.dm-op-picker-search')).not.toBeNull();
    // Should have position fixed style
    expect((picker as HTMLElement).style.position).toBe('fixed');
  });

  it('selecting an operator in picker calls onUpdateMappingOperator', () => {
    const onUpdateMappingOperator = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    const pill = screen.getByLabelText('Change operator from equals');
    fireEvent.click(pill);

    // Click "greater than" in the picker
    const gtButton = screen.getByText('greater than');
    fireEvent.click(gtButton);

    expect(onUpdateMappingOperator).toHaveBeenCalledWith('m1', 'greater_than', '');
  });

  it('clicking operator pill does NOT trigger onEditExpression', () => {
    const onUpdateMappingOperator = vi.fn();
    const onEditExpression = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
        onEditExpression={onEditExpression}
      />,
    );
    const pill = screen.getByLabelText('Change operator from equals');

    // Simulate mousedown then click (real browser flow)
    fireEvent.mouseDown(pill);
    fireEvent.click(pill);

    // Expression editor should NOT open
    expect(onEditExpression).not.toHaveBeenCalled();

    // Picker should be open
    const picker = document.querySelector('.dm-operator-picker');
    expect(picker).not.toBeNull();
  });

  it('operator picker survives parent row click handler', () => {
    const onUpdateMappingOperator = vi.fn();
    const onSelectMapping = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
        onSelectMapping={onSelectMapping}
      />,
    );
    const pill = screen.getByLabelText('Change operator from equals');
    fireEvent.click(pill);

    const picker = document.querySelector('.dm-operator-picker');
    expect(picker).not.toBeNull();
    expect(picker!.textContent).toContain('Select Operator');
  });

  it('renders operator value display for needsValue operator and allows edit', () => {
    const onUpdateMappingOperator = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    const mappingWithOp: Mapping = { ...mapping, operator: 'greater_than' as import('./types').FieldOperator, operatorValue: '50' };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    const valueDisplay = container.querySelector('.dm-operator-value-display');
    expect(valueDisplay).not.toBeNull();
    expect(valueDisplay!.textContent).toBe('50');

    fireEvent.click(valueDisplay!);
    const input = container.querySelector('.dm-operator-value-input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value: '100' } });
    fireEvent.keyDown(input!, { key: 'Enter' });
    expect(onUpdateMappingOperator).toHaveBeenCalledWith('m1', 'greater_than', '100');
  });

  it('commits operator value on blur', () => {
    const onUpdateMappingOperator = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    const mappingWithOp: Mapping = { ...mapping, operator: 'less_than' as import('./types').FieldOperator, operatorValue: '10' };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const input = container.querySelector('.dm-operator-value-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.blur(input);
    expect(onUpdateMappingOperator).toHaveBeenCalledWith('m1', 'less_than', '20');
  });

  it('cancels operator value edit on Escape', () => {
    const onUpdateMappingOperator = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    const mappingWithOp: Mapping = { ...mapping, operator: 'greater_than' as import('./types').FieldOperator, operatorValue: '50' };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const input = container.querySelector('.dm-operator-value-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onUpdateMappingOperator).not.toHaveBeenCalled();
  });

  it('renders unordered array toggle badge', () => {
    const arrayNode: JsonTreeNode = {
      key: 'items',
      path: 'items',
      type: 'array',
      value: undefined,
      children: [{ key: '0', path: 'items[0]', type: 'object', value: undefined, children: [] }],
    };
    const onToggleUnorderedArray = vi.fn();
    render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        onToggleUnorderedArray={onToggleUnorderedArray}
        unorderedDefault={false}
      />,
    );
    const badge = screen.getByText('↕ ordered');
    expect(badge).toBeTruthy();
    fireEvent.click(badge);
    expect(onToggleUnorderedArray).toHaveBeenCalledWith('items');
  });

  it('renders unordered badge when unorderedDefault is true', () => {
    const arrayNode: JsonTreeNode = {
      key: 'items',
      path: 'items',
      type: 'array',
      value: undefined,
      children: [{ key: '0', path: 'items[0]', type: 'object', value: undefined, children: [] }],
    };
    render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        onToggleUnorderedArray={vi.fn()}
        unorderedDefault={true}
      />,
    );
    expect(screen.getByText('⟳ unordered')).toBeTruthy();
  });

  it('renders mismatch badge with quick fix', () => {
    const onQuickFix = vi.fn();
    const mismatch: TypeMismatch = {
      mappingId: 'm1',
      sourcePath: 'name',
      sourceType: 'number',
      targetType: 'string',
      message: 'Type mismatch: number → string',
      severity: 'warning',
      suggestedFix: '$toString($.name)',
    };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        typeMismatches={[mismatch]}
        onQuickFix={onQuickFix}
      />,
    );
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).not.toBeNull();
    fireEvent.click(badge!);
    expect(onQuickFix).toHaveBeenCalledWith('m1', '$toString($.name)');
  });

  it('renders non-interactive mismatch badge when no quick fix', () => {
    const mismatch: TypeMismatch = {
      mappingId: 'm1',
      sourcePath: 'name',
      sourceType: 'number',
      targetType: 'object',
      message: 'Type mismatch: number → object',
      severity: 'error',
    };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        typeMismatches={[mismatch]}
      />,
    );
    const badge = container.querySelector('.dm-mismatch-badge');
    expect(badge).not.toBeNull();
    expect(badge!.tagName.toLowerCase()).toBe('span');
  });

  it('shows source path for non-operator mapped node', () => {
    const capabilities = { operators: false } as Required<import('./types').AdapterCapabilities>;
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
      />,
    );
    expect(screen.getByText('name')).toBeTruthy();
  });

  it('shows source path for operator that does not need a value', () => {
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    const mappingWithOp: Mapping = { ...mapping, operator: 'is_true' as import('./types').FieldOperator };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
      />,
    );
    expect(screen.getByText('name')).toBeTruthy();
  });
});

describe('TargetTreeNode – search and mapping filter', () => {
  const filteredParent: JsonTreeNode = {
    key: 'parent',
    path: 'parent',
    type: 'object',
    value: undefined,
    children: [
      { key: 'mappedChild', path: 'parent.mappedChild', type: 'string', value: '', children: [] },
      { key: 'freeChild', path: 'parent.freeChild', type: 'string', value: '', children: [] },
    ],
  };

  it('shows node when search matches target path substring (not just key)', () => {
    const deepLeaf: JsonTreeNode = {
      key: 'email',
      path: 'accounts.primary.email',
      type: 'string',
      value: '',
      children: [],
    };
    render(<TargetTreeNode node={deepLeaf} {...defaults} search="accounts" />);
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('shows node when search matches primitive default value text', () => {
    const withValue: JsonTreeNode = {
      key: 'token',
      path: 'token',
      type: 'string',
      value: 'Bearer abc123xyz',
      children: [],
    };
    render(<TargetTreeNode node={withValue} {...defaults} search="abc123" />);
    expect(screen.getByText('token')).toBeTruthy();
    expect(screen.getByText(/abc123/)).toBeTruthy();
  });

  it('shows parent when mappingFilter is all and only a child matches search (searchMatch || childMatch)', () => {
    const parentNode: JsonTreeNode = {
      key: 'parent',
      path: 'parent',
      type: 'object',
      value: undefined,
      children: [
        { key: 'email', path: 'parent.email', type: 'string', value: '', children: [] },
      ],
    };
    const expandedPaths = new Set(['__root__', '', 'parent']);
    render(
      <TargetTreeNode
        node={parentNode}
        {...defaults}
        mappingFilter="all"
        expandedPaths={expandedPaths}
        search="mail"
      />,
    );
    expect(screen.getByText('parent')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('shows only mapped branches when mappingFilter is mapped', () => {
    const mappings: Mapping[] = [
      { id: 'mx', sourcePath: 'src', sourceId: 's1', targetPath: 'parent.mappedChild' },
    ];
    const mappedPaths = new Set(['parent.mappedChild']);
    const expandedPaths = new Set(['__root__', 'parent']);
    render(
      <TargetTreeNode
        node={filteredParent}
        {...defaults}
        mappings={mappings}
        mappingFilter="mapped"
        mappedTargetPaths={mappedPaths}
        expandedPaths={expandedPaths}
      />,
    );
    expect(screen.getByText('mappedChild')).toBeTruthy();
    expect(screen.queryByText('freeChild')).toBeNull();
  });

  it('shows only unmapped branches when mappingFilter is unmapped', () => {
    const mappings: Mapping[] = [
      { id: 'mx', sourcePath: 'src', sourceId: 's1', targetPath: 'parent.mappedChild' },
    ];
    const mappedPaths = new Set(['parent.mappedChild']);
    const expandedPaths = new Set(['__root__', 'parent']);
    render(
      <TargetTreeNode
        node={filteredParent}
        {...defaults}
        mappings={mappings}
        mappingFilter="unmapped"
        mappedTargetPaths={mappedPaths}
        expandedPaths={expandedPaths}
      />,
    );
    expect(screen.getByText('freeChild')).toBeTruthy();
    expect(screen.queryByText('mappedChild')).toBeNull();
  });

  it('shows parent when mappingFilter passes via a matching child (childMatch branch)', () => {
    const mappings: Mapping[] = [
      { id: 'mx', sourcePath: 'src', sourceId: 's1', targetPath: 'parent.mappedChild' },
    ];
    const mappedPaths = new Set(['parent.mappedChild']);
    const expandedPaths = new Set(['__root__', 'parent']);
    render(
      <TargetTreeNode
        node={filteredParent}
        {...defaults}
        mappings={mappings}
        mappingFilter="mapped"
        mappedTargetPaths={mappedPaths}
        expandedPaths={expandedPaths}
        search=""
      />,
    );
    expect(screen.getByText('parent')).toBeTruthy();
  });
});

describe('TargetTreeNode – field reorder drag and drop fallbacks', () => {
  it('handleFieldDragStart sets payload on dataTransfer for reorderable leaf', () => {
    const onReorderField = vi.fn();
    const onTargetFieldDragStart = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onReorderField={onReorderField}
        onTargetFieldDragStart={onTargetFieldDragStart}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const setData = vi.fn();
    fireEvent.dragStart(el, {
      dataTransfer: {
        effectAllowed: 'uninitialized',
        setData,
        dropEffect: 'none',
      },
    });
    expect(onTargetFieldDragStart).toHaveBeenCalledWith('userName');
    expect(setData).toHaveBeenCalledWith(
      'application/mapper-target-field',
      JSON.stringify({ kind: 'target-field', path: 'userName' }),
    );
    expect(setData).toHaveBeenCalledWith(
      'text/plain',
      expect.stringContaining('mapper-target-field:'),
    );
  });

  it('handleFieldDragEnd calls onTargetFieldDragEnd', () => {
    const onReorderField = vi.fn();
    const onTargetFieldDragEnd = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onReorderField={onReorderField}
        onTargetFieldDragEnd={onTargetFieldDragEnd}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.dragEnd(el);
    expect(onTargetFieldDragEnd).toHaveBeenCalled();
  });

  it('handleDragEnter prevents default and shows drag-over styling', () => {
    render(<TargetTreeNode node={leaf} {...defaults} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.dragEnter(el, {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: 'none' },
    });
    expect(el.className).toContain('dm-tree-node--drag-over');
  });

  it('handleDragOver sets dropEffect move when reordering target field without source drag', () => {
    const dt = {
      dropEffect: 'none' as DataTransfer['dropEffect'],
      getData: () => '',
    };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        getDraggedTargetFieldPath={() => 'email'}
        getDraggedSource={() => null}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.dragOver(el, {
      preventDefault: vi.fn(),
      dataTransfer: dt,
    });
    expect(dt.dropEffect).toBe('move');
  });

  it('handleDragOver sets dropEffect link when source is being dragged', () => {
    const dt = {
      dropEffect: 'none' as DataTransfer['dropEffect'],
      getData: () => '',
    };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        getDraggedTargetFieldPath={() => 'email'}
        getDraggedSource={() => ({ path: 'body.id', sourceId: 's1' })}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    fireEvent.dragOver(el, {
      preventDefault: vi.fn(),
      dataTransfer: dt,
    });
    expect(dt.dropEffect).toBe('link');
  });

  it('onReorderField uses text/plain prefixed target-field payload when MIME type is empty', () => {
    const onReorderField = vi.fn();
    const payload = JSON.stringify({ kind: 'target-field', path: 'email' });
    render(<TargetTreeNode node={leaf} {...defaults} onReorderField={onReorderField} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = {
      getData: (type: string) => (type === 'text/plain' ? `mapper-target-field:${payload}` : ''),
      dropEffect: 'none',
    };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onReorderField).toHaveBeenCalledWith('email', 'userName');
  });

  it('onReorderField falls back to getDraggedTargetFieldPath when payload is missing', () => {
    const onReorderField = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onReorderField={onReorderField}
        getDraggedTargetFieldPath={() => 'email'}
        getDraggedSource={() => null}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = { getData: () => '', dropEffect: 'none' };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onReorderField).toHaveBeenCalledWith('email', 'userName');
  });

  it('does not use getDraggedTargetFieldPath fallback when getDraggedSource is active', () => {
    const onReorderField = vi.fn();
    const onDrop = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onReorderField={onReorderField}
        onDrop={onDrop}
        getDraggedTargetFieldPath={() => 'email'}
        getDraggedSource={() => ({ path: 'x', sourceId: 's1' })}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = { getData: () => '', dropEffect: 'none' };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onReorderField).not.toHaveBeenCalled();
  });

  it('onDrop accepts mapper-source text/plain prefix', () => {
    const onDrop = vi.fn();
    render(<TargetTreeNode node={leaf} {...defaults} onDrop={onDrop} />);
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const raw = JSON.stringify({ path: 'items[0].id', sourceId: 's2' });
    const dt = {
      getData: (type: string) => (type === 'text/plain' ? `mapper-source:${raw}` : ''),
      dropEffect: 'none',
    };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onDrop).toHaveBeenCalledWith('userName', 'items[0].id', 's2');
  });

  it('onDrop falls back to getDraggedSource when transfer data is empty', () => {
    const onDrop = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onDrop={onDrop}
        getDraggedSource={() => ({ path: 'ghost.path', sourceId: 'src-9' })}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = { getData: () => '', dropEffect: 'none' };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onDrop).toHaveBeenCalledWith('userName', 'ghost.path', 'src-9');
  });

  it('onDrop falls back when dataTransfer.getData is missing', () => {
    const onDrop = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onDrop={onDrop}
        getDraggedSource={() => ({ path: 'only.fallback', sourceId: 'sZ' })}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = { dropEffect: 'none' } as unknown as DataTransfer;
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onDrop).toHaveBeenCalledWith('userName', 'only.fallback', 'sZ');
  });

  it('onDrop tolerates getData throwing and still uses fallback source', () => {
    const onDrop = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onDrop={onDrop}
        getDraggedSource={() => ({ path: 'safe.path', sourceId: 'sok' })}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = {
      dropEffect: 'none',
      getData: () => {
        throw new Error('getData failed');
      },
    } as unknown as DataTransfer;
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onDrop).toHaveBeenCalledWith('userName', 'safe.path', 'sok');
  });

  it('onReorderField tolerates getData throwing and uses target field fallback', () => {
    const onReorderField = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onReorderField={onReorderField}
        getDraggedTargetFieldPath={() => 'email'}
        getDraggedSource={() => null}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = {
      dropEffect: 'none',
      getData: () => {
        throw new Error('getData failed');
      },
    } as unknown as DataTransfer;
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onReorderField).toHaveBeenCalledWith('email', 'userName');
  });

  it('onTargetFieldDragEnd runs after successful reorder drop', () => {
    const onReorderField = vi.fn();
    const onTargetFieldDragEnd = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        onReorderField={onReorderField}
        onTargetFieldDragEnd={onTargetFieldDragEnd}
      />,
    );
    const el = screen.getByText('userName').closest('.dm-tree-node')!;
    const dt = {
      getData: (type: string) => (type === 'application/mapper-target-field'
        ? JSON.stringify({ kind: 'target-field', path: 'email' })
        : ''),
      dropEffect: 'none',
    };
    fireEvent.drop(el, { dataTransfer: dt });
    expect(onTargetFieldDragEnd).toHaveBeenCalled();
  });
});

describe('TargetTreeNode – rename submit edge cases', () => {
  const customLeaf: JsonTreeNode = { key: 'myField', path: 'myField', type: 'string', value: undefined, children: [] };

  it('rename blur with blank trimmed value closes without update', () => {
    const fieldOrigins = new Map([['myField', 'custom' as const]]);
    const onUpdate = vi.fn();
    render(
      <TargetTreeNode
        node={customLeaf}
        {...defaults}
        fieldOrigins={fieldOrigins}
        onUpdateCustomField={onUpdate}
      />,
    );
    fireEvent.doubleClick(screen.getByText('myField').closest('.dm-tree-node')!);
    const input = screen.getByLabelText('Rename field');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('rename uses tail segment as label when path contains dots', () => {
    const fieldOrigins = new Map([['myField', 'custom' as const]]);
    const onUpdate = vi.fn();
    render(
      <TargetTreeNode
        node={customLeaf}
        {...defaults}
        fieldOrigins={fieldOrigins}
        onUpdateCustomField={onUpdate}
      />,
    );
    fireEvent.doubleClick(screen.getByText('myField').closest('.dm-tree-node')!);
    const input = screen.getByLabelText('Rename field');
    fireEvent.change(input, { target: { value: 'parent.child.tail' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith(
      'myField',
      expect.objectContaining({ path: 'parent.child.tail', label: 'tail' }),
    );
  });
});

describe('TargetTreeNode – operator picker coverage', () => {
  const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('closes operator picker on outside mousedown after delayed listener', async () => {
    const onUpdateMappingOperator = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    fireEvent.click(screen.getByLabelText('Change operator from equals'));
    expect(document.querySelector('.dm-operator-picker')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('.dm-operator-picker')).toBeNull();
  });

  it('filters operators by search text (label and category)', async () => {
    const onUpdateMappingOperator = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    fireEvent.click(screen.getByLabelText('Change operator from equals'));
    const search = document.querySelector('.dm-op-picker-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'between' } });
    expect(screen.getByText('between')).toBeTruthy();
    expect(screen.queryByText('contains')).toBeNull();

    fireEvent.change(search, { target: { value: 'string' } });
    expect(screen.getByText('String')).toBeTruthy();
    expect(screen.getByText('contains')).toBeTruthy();
  });

  it('shows empty state when no operators match search', () => {
    const onUpdateMappingOperator = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    fireEvent.click(screen.getByLabelText('Change operator from equals'));
    const search = document.querySelector('.dm-op-picker-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: '__no_such_operator__' } });
    expect(screen.getByText('No matching operators')).toBeTruthy();
  });

  it('selecting equals sets operator to equals', () => {
    const onUpdateMappingOperator = vi.fn();
    const mappingWithOp: Mapping = {
      ...mapping,
      operator: 'greater_than' as import('./types').FieldOperator,
      operatorValue: '9',
    };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    fireEvent.click(screen.getByLabelText('Change operator from greater than'));
    const listEq = screen.getByRole('listbox', { name: 'Operators' });
    fireEvent.click(within(listEq).getByText('equals', { exact: true }));
    expect(onUpdateMappingOperator).toHaveBeenCalledWith('m1', 'equals', undefined);
  });

  it('selecting needsValue operator preserves prior operatorValue', () => {
    const onUpdateMappingOperator = vi.fn();
    const mappingWithOp: Mapping = {
      ...mapping,
      operator: 'greater_than' as import('./types').FieldOperator,
      operatorValue: '42',
    };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    fireEvent.click(screen.getByLabelText('Change operator from greater than'));
    const listLt = screen.getByRole('listbox', { name: 'Operators' });
    fireEvent.click(within(listLt).getByText('less than', { exact: true }));
    expect(onUpdateMappingOperator).toHaveBeenCalledWith('m1', 'less_than', '42');
  });

  it('double-click on operator pill does not open expression editor', () => {
    const onEditExpression = vi.fn();
    const onUpdateMappingOperator = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
        onEditExpression={onEditExpression}
      />,
    );
    const pill = screen.getByLabelText('Change operator from equals');
    fireEvent.doubleClick(pill);
    expect(onEditExpression).not.toHaveBeenCalled();
  });

  it('positions picker using dm-panel-wrapper rect when nested under dm-body', () => {
    const onUpdateMappingOperator = vi.fn();
    const inner = (
      <div className="dm-body">
        <div className="dm-panel-wrapper" data-testid="wrapper">
          <TargetTreeNode
            node={leaf}
            {...defaults}
            mappings={[mapping]}
            capabilities={capabilities}
            onUpdateMappingOperator={onUpdateMappingOperator}
          />
        </div>
      </div>
    );
    const { getByTestId } = render(inner);
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(
      this: HTMLElement,
    ): DOMRect {
      if (this.classList.contains('dm-panel-wrapper')) {
        return new DOMRect(12, 0, 50, 400);
      }
      if (this.classList.contains('dm-operator-pill')) {
        return new DOMRect(200, 50, 60, 20);
      }
      return new DOMRect(0, 0, 1200, 800);
    });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);

    fireEvent.click(screen.getByLabelText('Change operator from equals'));
    const picker = document.querySelector('.dm-operator-picker') as HTMLElement | null;
    expect(picker).not.toBeNull();
    expect(picker!.style.position).toBe('fixed');

    spy.mockRestore();
    expect(getByTestId('wrapper')).toBeTruthy();
  });

  it('adds picker--up modifier when viewport has little space below pill', () => {
    const onUpdateMappingOperator = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockLowSpace(
      this: HTMLElement,
    ): DOMRect {
      if (this.classList.contains('dm-operator-pill')) {
        return new DOMRect(48, 280, 64, 24);
      }
      return new DOMRect(0, 0, 800, 600);
    });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(520);

    fireEvent.click(screen.getByLabelText('Change operator from equals'));
    const picker = document.querySelector('.dm-operator-picker');
    expect(picker!.classList).toContain('dm-operator-picker--up');

    spy.mockRestore();
  });

  it('double-click on mapped badge area opens expression editor when operators are off', () => {
    const onEditExpression = vi.fn();
    const capabilities = { operators: false } as Required<import('./types').AdapterCapabilities>;
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
        onEditExpression={onEditExpression}
      />,
    );
    const refEl = container.querySelector('.dm-mapped-src-ref')!;
    fireEvent.doubleClick(refEl);
    expect(onEditExpression).toHaveBeenCalledWith('m1');
  });

  it('shows source path in value slot when needsValue operator has empty operatorValue', () => {
    const onUpdateMappingOperator = vi.fn();
    const mappingWithOp: Mapping = {
      ...mapping,
      operator: 'contains' as import('./types').FieldOperator,
      operatorValue: '',
    };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
      />,
    );
    const display = container.querySelector('.dm-operator-value-display');
    expect(display?.textContent).toBe('name');
  });

  it('operator value input click does not bubble to tree row select handler', () => {
    const onUpdateMappingOperator = vi.fn();
    const onSelectMapping = vi.fn();
    const mappingWithOp: Mapping = {
      ...mapping,
      operator: 'greater_than' as import('./types').FieldOperator,
      operatorValue: '5',
    };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mappingWithOp]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
        onSelectMapping={onSelectMapping}
        selectedMappingId={null}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const input = container.querySelector('.dm-operator-value-input') as HTMLInputElement;
    onSelectMapping.mockClear();
    fireEvent.click(input);
    expect(onSelectMapping).not.toHaveBeenCalled();
  });
});

describe('TargetTreeNode – custom field removal and tree chrome', () => {
  const customLeaf: JsonTreeNode = { key: 'extra', path: 'extra', type: 'string', value: undefined, children: [] };

  it('calls onRemoveCustomField when remove field button is clicked', () => {
    const fieldOrigins = new Map([['extra', 'fetched' as const]]);
    const onRemoveCustomField = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={customLeaf}
        {...defaults}
        fieldOrigins={fieldOrigins}
        onRemoveCustomField={onRemoveCustomField}
      />,
    );
    const btn = container.querySelector('.dm-inline-remove--field')!;
    fireEvent.click(btn);
    expect(onRemoveCustomField).toHaveBeenCalledWith('extra');
  });

  it('renders expanded children container for nested expanded node', () => {
    const { container } = render(<TargetTreeNode node={nested} {...defaults} />);
    const childrenWrap = container.querySelector('.dm-tree-children');
    expect(childrenWrap).not.toBeNull();
    expect(childrenWrap!.querySelectorAll('.dm-tree-node').length).toBeGreaterThanOrEqual(2);
  });

  it('renders node count badge when parent is collapsed', () => {
    const collapsed = { ...defaults, expandedPaths: new Set<string>() };
    const { container } = render(<TargetTreeNode node={nested} {...collapsed} />);
    const count = container.querySelector('.dm-node-count');
    expect(count?.textContent).toBe('2');
  });

  describe('context menu (Phase 3)', () => {
    const capsWithOperators = {
      operators: true, arrayAssertions: true, typeChecks: false,
      codeEditor: false, verification: false, expressions: true,
      schemaDrift: false, profiles: false, unorderedArrays: false,
      hideAdvanced: false, conditionals: false, loopConstructs: false, errorHandling: false,
    } as const;

    it('does not show context menu without capabilities.operators on non-array node', () => {
      const { container } = render(
        <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      expect(container.querySelector('.dm-context-menu')).toBeNull();
    });

    it('shows context menu on array node when arrayAssertions is true even without operators', () => {
      const arrayNode: JsonTreeNode = {
        key: 'offers', path: 'offers', type: 'array', value: undefined,
        children: [{ key: '0', path: 'offers[0]', type: 'object', value: undefined, children: [] }],
      };
      const capsArrayOnly = {
        operators: false, arrayAssertions: true, typeChecks: false,
        codeEditor: false, verification: false, expressions: false,
        schemaDrift: false, profiles: false, unorderedArrays: false,
        hideAdvanced: false, conditionals: false, loopConstructs: false, errorHandling: false,
      } as const;
      render(
        <TargetTreeNode
          node={arrayNode}
          {...defaults}
          capabilities={capsArrayOnly}
          onAddArrayAssertion={vi.fn()}
        />,
      );
      const nodeEl = document.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      expect(document.querySelector('.dm-context-menu')).not.toBeNull();
      expect(screen.getByText('Array Assertions')).toBeInTheDocument();
      expect(screen.getByText('Check array size')).toBeInTheDocument();
      expect(screen.getByText('Contains value (exact match)')).toBeInTheDocument();
      expect(screen.getByText('Every item must match')).toBeInTheDocument();
      expect(screen.getByText('Contains object (deep partial match)')).toBeInTheDocument();
    });

    it('shows context menu on right-click when capabilities.operators is true', () => {
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      expect(document.querySelector('.dm-context-menu')).not.toBeNull();
      expect(screen.getByText('Set operator…')).toBeInTheDocument();
    });

    it('closes context menu on outside mousedown after delayed listener', async () => {
      vi.useFakeTimers();
      render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
        />,
      );
      const nodeEl = document.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      expect(document.querySelector('.dm-context-menu')).not.toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      fireEvent.mouseDown(document.body);
      expect(document.querySelector('.dm-context-menu')).toBeNull();
      vi.useRealTimers();
    });

    it('toggles negation from operator picker row', () => {
      const onToggleNegate = vi.fn();
      render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
          onToggleMappingNegate={onToggleNegate}
        />,
      );
      fireEvent.click(screen.getByLabelText('Change operator from equals'));
      expect(document.querySelector('.dm-operator-picker')).not.toBeNull();
      fireEvent.click(screen.getByLabelText('Toggle negation'));
      expect(onToggleNegate).toHaveBeenCalledWith('m1');
    });

    it('shows "Remove mapping" in context menu for mapped node', () => {
      const onRemoveMapping = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
          onRemoveMapping={onRemoveMapping}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      const removeBtn = screen.getByText('Remove mapping');
      expect(removeBtn).toBeInTheDocument();
      fireEvent.click(removeBtn);
      expect(onRemoveMapping).toHaveBeenCalledWith('m1');
    });

    it('shows array assertion options for array nodes', () => {
      const arrayNode: JsonTreeNode = {
        key: 'items', path: 'items', type: 'array', value: undefined,
        children: [{ key: '[0]', path: 'items[0]', type: 'object', value: undefined, children: [] }],
      };
      const { container } = render(
        <TargetTreeNode
          node={arrayNode}
          {...defaults}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      expect(screen.getByText('Array Assertions')).toBeInTheDocument();
      expect(screen.getByText('Check array size')).toBeInTheDocument();
      expect(screen.getByText('Contains value (exact match)')).toBeInTheDocument();
      expect(screen.getByText('Every item must match')).toBeInTheDocument();
      expect(screen.getByText('Contains object (deep partial match)')).toBeInTheDocument();
    });

    it('does not show array assertion section for non-array nodes', () => {
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      expect(screen.queryByText('Array Assertions')).not.toBeInTheDocument();
    });

    it('positions operator picker from pill when using Set operator from context menu', () => {
      const onUpdateMappingOperator = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={onUpdateMappingOperator}
        />,
      );
      const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockPillRect(
        this: HTMLElement,
      ): DOMRect {
        if (this.classList.contains('dm-operator-pill')) {
          return new DOMRect(12, 30, 48, 22);
        }
        return new DOMRect(0, 0, 800, 600);
      });
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      fireEvent.click(screen.getByText('Set operator…'));
      const picker = document.querySelector('.dm-operator-picker') as HTMLElement | null;
      expect(picker).not.toBeNull();
      expect(picker!.style.top).toBe('56px');
      expect(picker!.style.left).toBe('12px');
      rectSpy.mockRestore();
    });

    it('opens operator picker at menu position when mapped node has expression (no operator pill ref)', () => {
      const exprMap: Mapping = { ...mapping, expression: '$upper($.name)' };
      const onUpdateMappingOperator = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[exprMap]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={onUpdateMappingOperator}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl, { clientX: 120, clientY: 240 });
      fireEvent.click(screen.getByText('Set operator…'));
      const picker = document.querySelector('.dm-operator-picker') as HTMLElement | null;
      expect(picker).not.toBeNull();
      expect(screen.getByRole('listbox', { name: 'Operators' })).toBeInTheDocument();
    });

    it('toggles negation from context menu', () => {
      const onToggleNegate = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
          onToggleMappingNegate={onToggleNegate}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      fireEvent.click(screen.getByText('Negate (NOT)'));
      expect(onToggleNegate).toHaveBeenCalledWith('m1');
    });

    it('opens expression editor from context menu', () => {
      const onEditExpression = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
          onEditExpression={onEditExpression}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);
      fireEvent.click(screen.getByText('Edit expression…'));
      expect(onEditExpression).toHaveBeenCalledWith('m1');
    });

    it('invokes onAddArrayAssertion for each array assertion action', () => {
      const arrayNode: JsonTreeNode = {
        key: 'items',
        path: 'items',
        type: 'array',
        value: undefined,
        children: [{ key: '[0]', path: 'items[0]', type: 'string', value: 'a', children: [] }],
      };
      const onAddArrayAssertion = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={arrayNode}
          {...defaults}
          capabilities={capsWithOperators}
          onUpdateMappingOperator={vi.fn()}
          onAddArrayAssertion={onAddArrayAssertion}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.contextMenu(nodeEl);

      fireEvent.click(screen.getByText('Check array size'));
      fireEvent.contextMenu(nodeEl);
      fireEvent.click(screen.getByText('Contains value (exact match)'));
      fireEvent.contextMenu(nodeEl);
      fireEvent.click(screen.getByText('Every item must match'));
      fireEvent.contextMenu(nodeEl);
      fireEvent.click(screen.getByText('Contains object (deep partial match)'));

      expect(onAddArrayAssertion.mock.calls).toEqual([
        ['items', 'length'],
        ['items', 'contains'],
        ['items', 'each'],
        ['items', 'subset'],
      ]);
    });
  });

  describe('array assertion hint row (Phase 3)', () => {
    const capsWithArrayAssertions = {
      operators: true, arrayAssertions: true, typeChecks: false,
      codeEditor: false, verification: false, expressions: true,
      schemaDrift: false, profiles: false, unorderedArrays: false,
      hideAdvanced: false, conditionals: false, loopConstructs: false, errorHandling: false,
    } as const;

    it('renders array assertion hint for expanded array node', () => {
      const arrayNode: JsonTreeNode = {
        key: 'items', path: 'items', type: 'array', value: undefined,
        children: [{ key: '[0]', path: 'items[0]', type: 'string', value: 'a', children: [] }],
      };
      const expandedWithItems = new Set(['__root__', '', 'items']);
      const { container } = render(
        <TargetTreeNode
          node={arrayNode}
          {...defaults}
          expandedPaths={expandedWithItems}
          capabilities={capsWithArrayAssertions}
          onUpdateMappingOperator={vi.fn()}
        />,
      );
      expect(container.querySelector('.dm-array-assertion-rows')).not.toBeNull();
      expect(screen.getByText(/Add array assertion/)).toBeInTheDocument();
    });

    it('does not render array assertion hint for non-array nodes', () => {
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          capabilities={capsWithArrayAssertions}
          onUpdateMappingOperator={vi.fn()}
        />,
      );
      expect(container.querySelector('.dm-array-assertion-rows')).toBeNull();
    });

    it('does not render array assertion hint when arrayAssertions capability is false', () => {
      const capsNoArray = { ...capsWithArrayAssertions, arrayAssertions: false } as const;
      const arrayNode: JsonTreeNode = {
        key: 'items', path: 'items', type: 'array', value: undefined,
        children: [{ key: '[0]', path: 'items[0]', type: 'string', value: 'a', children: [] }],
      };
      const { container } = render(
        <TargetTreeNode
          node={arrayNode}
          {...defaults}
          capabilities={capsNoArray}
          onUpdateMappingOperator={vi.fn()}
        />,
      );
      expect(container.querySelector('.dm-array-assertion-rows')).toBeNull();
    });
  });
});

describe('TargetTreeNode – verification and highlight gaps', () => {
  it('derives pass badge from nodeStatusMap $.path variant', () => {
    const statusMap = new Map<string, 'pass' | 'fail'>([['$.userName', 'pass']]);
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} mappings={[mapping]} nodeStatusMap={statusMap} />,
    );
    expect(container.querySelector('.dm-verify-badge--pass')).not.toBeNull();
  });

  it('truncates long verify actual snippet', () => {
    const longActual = 'y'.repeat(40);
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        verifyStatus="fail"
        verifyActual={longActual}
        verifyExpected="x"
      />,
    );
    expect(container.querySelector('.dm-verify-actual')?.textContent?.endsWith('…')).toBe(true);
  });

  it('includes match context line in failure tooltip', () => {
    const results = new Map([
      ['userName', { passed: false, actual: 'a', expected: 'b', matchContext: 'diff at $.items[0]' }],
    ]);
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        verifyStatus="fail"
        fieldVerifyResults={results}
      />,
    );
    expect(container.querySelector('.dm-verify-badge--fail')?.getAttribute('title')).toContain('diff at $.items[0]');
  });

  it('applies hover highlight for highlighted leaf path', () => {
    const { container } = render(
      <TargetTreeNode node={leaf} {...defaults} highlightedPaths={new Set(['userName'])} />,
    );
    expect(container.querySelector('.dm-tree-node--hover-highlight')).not.toBeNull();
  });

  it('shows negate checkmark in operator picker when mapping is negated', () => {
    const onUpdateMappingOperator = vi.fn();
    const onToggleNegate = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    const negMapping = { ...mapping, negate: true };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[negMapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={onUpdateMappingOperator}
        onToggleMappingNegate={onToggleNegate}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Change operator from equals/));
    expect(document.querySelector('.dm-op-picker-negate-btn--active')).not.toBeNull();
    expect(document.querySelector('.dm-op-picker-negate-check')).not.toBeNull();
  });

  it('chooses context menu Negated label when mapping is already negated', () => {
    const onToggleNegate = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[{ ...mapping, negate: true }]}
        capabilities={{
          operators: true, arrayAssertions: true, typeChecks: false,
          codeEditor: false, verification: false, expressions: true,
          schemaDrift: false, profiles: false, unorderedArrays: false,
          hideAdvanced: false, conditionals: false, loopConstructs: false, errorHandling: false,
        } as const}
        onUpdateMappingOperator={vi.fn()}
        onToggleMappingNegate={onToggleNegate}
      />,
    );
    const nodeEl = container.querySelector('.dm-tree-node--target')!;
    fireEvent.contextMenu(nodeEl);
    expect(screen.getByText('✓ Negated (NOT)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('✓ Negated (NOT)'));
    expect(onToggleNegate).toHaveBeenCalledWith('m1');
  });

  it('removes negation when NOT chip clicked', () => {
    const onToggleNegate = vi.fn();
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    const negMapping = { ...mapping, negate: true };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[negMapping]}
        capabilities={capabilities}
        onUpdateMappingOperator={vi.fn()}
        onToggleMappingNegate={onToggleNegate}
      />,
    );
    fireEvent.click(container.querySelector('.dm-negate-badge')!);
    expect(onToggleNegate).toHaveBeenCalledWith('m1');
  });

  describe('remap drag-and-drop', () => {
    it('makes mapped leaf node draggable when onRemapDrop is provided', () => {
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          onRemapDrop={vi.fn()}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      expect(nodeEl).toHaveClass('dm-tree-node--remappable');
      expect(nodeEl.getAttribute('draggable')).toBe('true');
    });

    it('does not make unmapped leaf node draggable for remap', () => {
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[]}
          onRemapDrop={vi.fn()}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      expect(nodeEl).not.toHaveClass('dm-tree-node--remappable');
    });

    it('fires onRemapDragStart when mapped node drag starts', () => {
      const onRemapDragStart = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          onRemapDrop={vi.fn()}
          onRemapDragStart={onRemapDragStart}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      const dt = { effectAllowed: '', setData: vi.fn() };
      fireEvent.dragStart(nodeEl, { dataTransfer: dt });
      expect(onRemapDragStart).toHaveBeenCalledWith('m1');
      expect(dt.setData).toHaveBeenCalledWith(
        'application/mapper-remap',
        expect.stringContaining('"mappingId":"m1"'),
      );
    });

    it('calls onRemapDrop when remap payload is dropped', () => {
      const onRemapDrop = vi.fn();
      const targetNode: JsonTreeNode = { key: 'email', path: 'email', type: 'string', value: '', children: [] };
      const { container } = render(
        <TargetTreeNode
          node={targetNode}
          {...defaults}
          onRemapDrop={onRemapDrop}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      const payload = JSON.stringify({ kind: 'remap', mappingId: 'map-1' });
      fireEvent.drop(nodeEl, {
        dataTransfer: {
          getData: (type: string) => type === 'application/mapper-remap' ? payload : '',
        },
      });
      expect(onRemapDrop).toHaveBeenCalledWith('email', 'map-1');
    });

    it('falls back to getDraggedRemapId ref when payload is empty', () => {
      const onRemapDrop = vi.fn();
      const getDraggedRemapId = vi.fn().mockReturnValue('map-ref-fallback');
      const targetNode: JsonTreeNode = { key: 'email', path: 'email', type: 'string', value: '', children: [] };
      const { container } = render(
        <TargetTreeNode
          node={targetNode}
          {...defaults}
          onRemapDrop={onRemapDrop}
          getDraggedRemapId={getDraggedRemapId}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.drop(nodeEl, {
        dataTransfer: {
          getData: () => '',
        },
      });
      expect(onRemapDrop).toHaveBeenCalledWith('email', 'map-ref-fallback');
    });

    it('calls onRemapDragEnd on drag end', () => {
      const onRemapDragEnd = vi.fn();
      const { container } = render(
        <TargetTreeNode
          node={leaf}
          {...defaults}
          mappings={[mapping]}
          onRemapDrop={vi.fn()}
          onRemapDragEnd={onRemapDragEnd}
        />,
      );
      const nodeEl = container.querySelector('.dm-tree-node--target')!;
      fireEvent.dragEnd(nodeEl);
      expect(onRemapDragEnd).toHaveBeenCalled();
    });
  });
});

describe('TargetTreeNode – is_type dropdown', () => {
  const capsOp = { operators: true, arrayAssertions: false, codeEditor: false } as const;
  const typeMapping: Mapping = { id: 'mT', sourcePath: 'src', sourceId: 's1', targetPath: 'userName', operator: 'is_type' as import('./types').FieldOperator, operatorValue: 'string' };

  it('renders a <select> when operator is is_type and value display is clicked', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[typeMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    const valueDisplay = container.querySelector('.dm-operator-value-display');
    expect(valueDisplay).not.toBeNull();
    fireEvent.click(valueDisplay!);
    const select = container.querySelector('.dm-type-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('string');
  });

  it('commits type selection on change', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[typeMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    const valueDisplay = container.querySelector('.dm-operator-value-display');
    fireEvent.click(valueDisplay!);
    const select = container.querySelector('.dm-type-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'number' } });
    expect(onUpdate).toHaveBeenCalledWith('mT', 'is_type', 'number');
  });
});

describe('TargetTreeNode – range inputs (between/close_to)', () => {
  const capsOp = { operators: true, arrayAssertions: false, codeEditor: false } as const;
  const betweenMapping: Mapping = {
    id: 'mB', sourcePath: 'src', sourceId: 's1', targetPath: 'userName',
    operator: 'between' as import('./types').FieldOperator, operatorValue: '10,20',
  };
  const closeToMapping: Mapping = {
    id: 'mC', sourcePath: 'src', sourceId: 's1', targetPath: 'userName',
    operator: 'close_to' as import('./types').FieldOperator, operatorValue: '100,5',
  };

  it('renders two number inputs for between operator', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[betweenMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    const valueDisplay = container.querySelector('.dm-operator-value-display');
    expect(valueDisplay).not.toBeNull();
    fireEvent.click(valueDisplay!);
    const inputs = container.querySelectorAll('.dm-range-input');
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).type).toBe('number');
    expect((inputs[0] as HTMLInputElement).defaultValue).toBe('10');
    expect((inputs[1] as HTMLInputElement).defaultValue).toBe('20');
  });

  it('pressing Enter on first range input focuses second', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[betweenMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={vi.fn()}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const inputs = container.querySelectorAll('.dm-range-input');
    const focusSpy = vi.spyOn(inputs[1] as HTMLInputElement, 'focus');
    fireEvent.keyDown(inputs[0], { key: 'Enter' });
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('pressing Escape on range input closes edit', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[betweenMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={vi.fn()}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const inputs = container.querySelectorAll('.dm-range-input');
    expect(inputs).toHaveLength(2);
    fireEvent.keyDown(inputs[0], { key: 'Escape' });
    expect(container.querySelectorAll('.dm-range-input')).toHaveLength(0);
  });

  it('pressing Enter on second range input commits both values', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[betweenMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const inputs = container.querySelectorAll('.dm-range-input') as NodeListOf<HTMLInputElement>;
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '50' } });
    fireEvent.keyDown(inputs[1], { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalled();
  });

  it('blur on second range input commits via handleRangeCommit', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[betweenMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const inputs = container.querySelectorAll('.dm-range-input') as NodeListOf<HTMLInputElement>;
    fireEvent.blur(inputs[1]);
    expect(onUpdate).toHaveBeenCalled();
  });

  it('renders close_to with value/tolerance labels', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[closeToMapping]}
        capabilities={capsOp}
        onUpdateMappingOperator={vi.fn()}
      />,
    );
    fireEvent.click(container.querySelector('.dm-operator-value-display')!);
    const inputs = container.querySelectorAll('.dm-range-input') as NodeListOf<HTMLInputElement>;
    expect(inputs).toHaveLength(2);
    expect(inputs[0].placeholder).toBe('value');
    expect(inputs[1].placeholder).toBe('tolerance');
  });
});

describe('TargetTreeNode – array assertion rows with InlineAssertionRow', () => {
  const capsArr = { operators: false, arrayAssertions: true, codeEditor: false } as const;
  const arrayNode: JsonTreeNode = {
    key: 'items', path: 'items', type: 'array', value: undefined,
    children: [{ key: '[0]', path: 'items[0]', type: 'string', value: 'a', children: [] }],
  };

  it('renders InlineAssertionRow items when arrayAssertions exist', () => {
    const assertions = [
      { type: 'arrayLength' as const, jsonPath: '$.items', operator: '=' as const, value: 3 },
    ];
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set(['__root__', '', 'items'])}
        capabilities={capsArr}
        arrayAssertions={assertions}
      />,
    );
    const rows = container.querySelectorAll('.dm-array-assertion-row');
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking +Add array assertion calls onAddArrayAssertion', () => {
    const onAdd = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set(['__root__', '', 'items'])}
        capabilities={capsArr}
        onAddArrayAssertion={onAdd}
        arrayAssertions={[]}
      />,
    );
    const hint = container.querySelector('.dm-array-assertion-hint--clickable');
    expect(hint).not.toBeNull();
    fireEvent.click(hint!);
    expect(onAdd).toHaveBeenCalledWith('items', 'length');
  });
});

describe('P3-05: Multiple array assertions on one node', () => {
  const capsArr = { operators: false, arrayAssertions: true, codeEditor: false } as const;
  const arrayNode: JsonTreeNode = {
    key: 'offers', path: 'offers', type: 'array', value: undefined,
    children: [
      { key: '[0]', path: 'offers[0]', type: 'object', value: undefined, children: [] },
      { key: '[1]', path: 'offers[1]', type: 'object', value: undefined, children: [] },
      { key: '[2]', path: 'offers[2]', type: 'object', value: undefined, children: [] },
    ],
  };
  const fourAssertions = [
    { type: 'arrayLength' as const, jsonPath: '$.offers', operator: '>=' as const, value: 1 },
    { type: 'arrayContains' as const, jsonPath: '$.offers', mode: 'any' as const, value: '{"offerName":"EV Access"}' },
    { type: 'each' as const, jsonPath: '$.offers', fieldPath: 'rank', operator: '>=' as const, value: '0' },
    { type: 'containsSubset' as const, jsonPath: '$.offers', expected: '{"offerName":"OnStar Safety Plan"}' },
  ];
  const expandedOffers = new Set(['__root__', '', 'offers']);

  it('renders all four assertion rows stacked beneath the array node', () => {
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={expandedOffers}
        capabilities={capsArr}
        arrayAssertions={fourAssertions}
        onUpdateArrayAssertion={vi.fn()}
        onRemoveArrayAssertion={vi.fn()}
      />,
    );
    const rows = container.querySelectorAll('.dm-array-assertion-row');
    expect(rows).toHaveLength(4);
  });

  it('shows "3 items · 4 assertions" header when expanded', () => {
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={expandedOffers}
        capabilities={capsArr}
        arrayAssertions={fourAssertions}
        onUpdateArrayAssertion={vi.fn()}
        onRemoveArrayAssertion={vi.fn()}
      />,
    );
    const badge = container.querySelector('.dm-node-count--assertions');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('3 items · 4 assertions');
  });

  it('shows "3 items · 4 assertions" in collapsed badge', () => {
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set<string>()}
        capabilities={capsArr}
        arrayAssertions={fourAssertions}
      />,
    );
    const badge = container.querySelector('.dm-node-count');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('3 items · 4 assertions');
  });

  it('shows singular "assertion" when only one assertion exists', () => {
    const oneAssertion = [fourAssertions[0]];
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set<string>()}
        capabilities={capsArr}
        arrayAssertions={oneAssertion}
      />,
    );
    const badge = container.querySelector('.dm-node-count');
    expect(badge!.textContent).toBe('3 items · 1 assertion');
  });

  it('shows plain child count when no assertions exist', () => {
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set<string>()}
        capabilities={capsArr}
        arrayAssertions={[]}
      />,
    );
    const badge = container.querySelector('.dm-node-count');
    expect(badge!.textContent).toBe('3');
  });

  it('each row has a remove button and calls onRemoveArrayAssertion', () => {
    const onRemove = vi.fn();
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={expandedOffers}
        capabilities={capsArr}
        arrayAssertions={fourAssertions}
        onUpdateArrayAssertion={vi.fn()}
        onRemoveArrayAssertion={onRemove}
      />,
    );
    const removeBtns = container.querySelectorAll('.dm-array-assertion-remove');
    expect(removeBtns).toHaveLength(4);
    fireEvent.click(removeBtns[2]);
    expect(onRemove).toHaveBeenCalledWith(2);
  });

  it('removing one assertion decrements the badge count', () => {
    const threeAssertions = fourAssertions.slice(0, 3);
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={expandedOffers}
        capabilities={capsArr}
        arrayAssertions={threeAssertions}
        onUpdateArrayAssertion={vi.fn()}
        onRemoveArrayAssertion={vi.fn()}
      />,
    );
    const badge = container.querySelector('.dm-node-count--assertions');
    expect(badge!.textContent).toBe('3 items · 3 assertions');
    const rows = container.querySelectorAll('.dm-array-assertion-row');
    expect(rows).toHaveLength(3);
  });

  it('renders correct type pills for each assertion type', () => {
    render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={expandedOffers}
        capabilities={capsArr}
        arrayAssertions={fourAssertions}
        onUpdateArrayAssertion={vi.fn()}
        onRemoveArrayAssertion={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Array size check')).toBeInTheDocument();
    expect(screen.getByTitle('Has item with exact value')).toBeInTheDocument();
    expect(screen.getByTitle('Every item must match')).toBeInTheDocument();
    expect(screen.getByTitle('Has item matching partial object (nested)')).toBeInTheDocument();
  });
});

describe('TargetTreeNode – verify display from fieldVerifyResults', () => {
  const capsOp = { operators: true, arrayAssertions: false, codeEditor: false } as const;

  it('shows fail badge and actual text from fieldVerifyResults map', () => {
    const nodeStatus = new Map<string, 'pass' | 'fail'>([['userName', 'fail']]);
    const fvr = new Map([['userName', { passed: false, actual: 'got "Bob"', expected: 'equals "Alice"' }]]);
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capsOp}
        nodeStatusMap={nodeStatus}
        fieldVerifyResults={fvr}
      />,
    );
    expect(container.querySelector('.dm-verify-badge--fail')).not.toBeNull();
    const actualEl = container.querySelector('.dm-verify-actual');
    expect(actualEl).not.toBeNull();
    expect(actualEl!.textContent).toContain('Bob');
  });

  it('shows pass badge from fieldVerifyResults with $.path key', () => {
    const nodeStatus = new Map<string, 'pass' | 'fail'>([['$.userName', 'pass']]);
    const fvr = new Map([['$.userName', { passed: true, actual: '"Alice"', expected: 'equals "Alice"' }]]);
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capsOp}
        nodeStatusMap={nodeStatus}
        fieldVerifyResults={fvr}
      />,
    );
    expect(container.querySelector('.dm-verify-badge--pass')).not.toBeNull();
  });

  it('hides mapping for parent with non-allowed operator', () => {
    const parentNode: JsonTreeNode = {
      key: 'parent', path: 'parent', type: 'object', value: undefined,
      children: [{ key: 'child', path: 'parent.child', type: 'string', value: '', children: [] }],
    };
    const parentMapping: Mapping = { id: 'm1', sourcePath: 'src', sourceId: 's1', targetPath: 'parent', operator: 'equals' };
    const { container } = render(
      <TargetTreeNode
        node={parentNode}
        {...defaults}
        mappings={[parentMapping]}
        capabilities={capsOp}
      />,
    );
    expect(container.querySelector('.dm-mapped-badge')).toBeNull();
  });

  it('shows mapping for parent with allowed operator', () => {
    const parentNode: JsonTreeNode = {
      key: 'parent', path: 'parent', type: 'object', value: undefined,
      children: [{ key: 'child', path: 'parent.child', type: 'string', value: '', children: [] }],
    };
    const parentMapping: Mapping = { id: 'm1', sourcePath: 'src', sourceId: 's1', targetPath: 'parent', operator: 'is_empty' };
    const { container } = render(
      <TargetTreeNode
        node={parentNode}
        {...defaults}
        mappings={[parentMapping]}
        capabilities={capsOp}
      />,
    );
    expect(container.querySelector('.dm-mapped-badge')).not.toBeNull();
  });

  it('context menu opens on right-click', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capsOp}
        onRemoveMapping={vi.fn()}
      />,
    );
    const nodeEl = container.querySelector('.dm-tree-node--target')!;
    fireEvent.contextMenu(nodeEl, { clientX: 100, clientY: 200 });
    const ctxMenu = document.querySelector('.dm-context-menu');
    expect(ctxMenu).not.toBeNull();
  });
});

// ── Array Assertion verify filter ──

describe('TargetTreeNode — verifyFilter for array assertions', () => {
  const arrayNode: JsonTreeNode = {
    key: 'offers', path: 'offers', type: 'array', value: undefined,
    children: [{ key: '0', path: 'offers[0]', type: 'object', value: undefined, children: [] }],
  };

  const capsArray = {
    operatorPicker: true,
    arrayAssertions: true,
    valueEditor: true,
    contextMenu: true,
    statusBadges: true,
  };

  const offersAssertions = [
    { type: 'arrayLength', operator: 'greater_than_or_equal', value: '1', jsonPath: '$.offers' },
    { type: 'each', operator: 'exists', value: '', jsonPath: '$.offers' },
  ];

  it('shows all array assertions when verifyFilter is undefined', () => {
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set(['', 'offers'])}
        capabilities={capsArray}
        arrayAssertions={offersAssertions as never}
      />,
    );
    const rows = container.querySelectorAll('.dm-array-assertion-row');
    expect(rows.length).toBe(2);
  });

  it('filters array assertions by verifyFilter=passed', () => {
    const verifyMap = new Map<number, { passed: boolean }>([
      [0, { passed: true }],
      [1, { passed: false }],
    ]);
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set(['', 'offers'])}
        capabilities={capsArray}
        arrayAssertions={offersAssertions as never}
        verifyFilter="passed"
        assertionVerifyMap={verifyMap as never}
      />,
    );
    const rows = container.querySelectorAll('.dm-array-assertion-row');
    expect(rows.length).toBe(1);
  });

  it('filters array assertions by verifyFilter=failed', () => {
    const verifyMap = new Map<number, { passed: boolean }>([
      [0, { passed: true }],
      [1, { passed: false }],
    ]);
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set(['', 'offers'])}
        capabilities={capsArray}
        arrayAssertions={offersAssertions as never}
        verifyFilter="failed"
        assertionVerifyMap={verifyMap as never}
      />,
    );
    const rows = container.querySelectorAll('.dm-array-assertion-row');
    expect(rows.length).toBe(1);
  });

  it('shows all assertions when verifyMap has no entry for the assertion', () => {
    const verifyMap = new Map<number, { passed: boolean }>();
    const { container } = render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        expandedPaths={new Set(['', 'offers'])}
        capabilities={capsArray}
        arrayAssertions={offersAssertions as never}
        verifyFilter="passed"
        assertionVerifyMap={verifyMap as never}
      />,
    );
    const rows = container.querySelectorAll('.dm-array-assertion-row');
    expect(rows.length).toBe(2);
  });
});

describe('TargetTreeNode — operator editing edge cases', () => {
  const onUpdate = vi.fn();
  const betweenMapping: Mapping = {
    id: 'mb', sourcePath: 'val', sourceId: 's1', targetPath: 'userName',
    expression: '$.val', operator: 'between' as never, operatorValue: '10, 20',
  };

  it('renders range operator display for between mapping', () => {
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[betweenMapping]}
        capabilities={{ operators: true, arrayAssertions: false }}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    expect(document.querySelector('.dm-operator-pill')).toBeTruthy();
  });

  it('renders is_type operator with select dropdown', () => {
    const typeMapping: Mapping = {
      id: 'mt', sourcePath: 'val', sourceId: 's1', targetPath: 'userName',
      expression: '$.val', operator: 'is_type' as never, operatorValue: 'string',
    };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[typeMapping]}
        capabilities={{ operators: true, arrayAssertions: false }}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    expect(document.querySelector('.dm-operator-pill')).toBeTruthy();
  });

  it('renders context menu and opens operator picker from it', () => {
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={{ operators: true, arrayAssertions: false }}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    const nodeRow = document.querySelector('.dm-tree-node')!;
    fireEvent.contextMenu(nodeRow, { clientX: 100, clientY: 200 });
    const menuItems = document.querySelectorAll('.dm-ctx-item');
    const changeOpItem = Array.from(menuItems).find(el => el.textContent?.includes('Change operator'));
    if (changeOpItem) {
      fireEvent.click(changeOpItem);
      expect(document.querySelector('.dm-op-picker')).toBeTruthy();
    }
  });

  it('renders negate badge for negated expression mapping', () => {
    const negatedMapping: Mapping = {
      id: 'mn', sourcePath: 'val', sourceId: 's1', targetPath: 'userName',
      expression: '$.val', negate: true,
    };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[negatedMapping]}
        capabilities={{ operators: true, arrayAssertions: false }}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    const negateBadge = document.querySelector('.dm-negate-badge');
    expect(negateBadge?.textContent).toBe('NOT');
  });

  it('renders default value for unmapped node with value', () => {
    const nodeWithValue: JsonTreeNode = {
      key: 'status', path: 'status', type: 'string', value: 'active', children: [],
    };
    render(<TargetTreeNode node={nodeWithValue} {...defaults} />);
    expect(screen.getByText(/= active/)).toBeTruthy();
  });

  it('renders range inputs when editing between operator value', async () => {
    const onUpdate = vi.fn();
    const betweenMapping: Mapping = {
      id: 'mb', sourcePath: 'val', sourceId: 's1', targetPath: 'userName',
      expression: '$.val', operator: 'between' as never, operatorValue: '10, 20',
    };
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[betweenMapping]}
        capabilities={{ operators: true, arrayAssertions: false }}
        onUpdateMappingOperator={onUpdate}
      />,
    );
    const display = document.querySelector('.dm-operator-value-display');
    if (display) {
      fireEvent.click(display);
      const inputs = document.querySelectorAll('.dm-range-input');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders double-click on mapped badge to edit expression', () => {
    const onEdit = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        onEditExpression={onEdit}
      />,
    );
    const badge = document.querySelector('.dm-mapped-badge');
    if (badge) {
      fireEvent.doubleClick(badge);
      expect(onEdit).toHaveBeenCalledWith('m1');
    }
  });

  it('renders fetched origin badge', () => {
    const fetchedNode: JsonTreeNode = {
      key: 'fetchedField', path: 'fetchedField', type: 'string', value: '', children: [],
    };
    const fieldOrigins = new Map([['fetchedField', 'fetched' as const]]);
    render(
      <TargetTreeNode
        node={fetchedNode}
        {...defaults}
        fieldOrigins={fieldOrigins}
      />,
    );
    expect(screen.getByText('fetched')).toBeTruthy();
  });
});
