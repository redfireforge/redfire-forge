/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TargetTreeNode from './TargetTreeNode';
import { JsonTreeNode } from '../../utils/jsonTreeModel';
import { Mapping } from './types';
import { TypeMismatch } from './utils/typeMismatch';

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

  it('renders verify status pass badge', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        verifyStatus="pass"
      />,
    );
    expect(container.querySelector('.dm-verify-badge--pass')).toBeTruthy();
  });

  it('renders verify status fail badge with actual value', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        verifyStatus="fail"
        verifyActual="unexpected_value"
      />,
    );
    expect(container.querySelector('.dm-verify-badge--fail')).toBeTruthy();
    expect(screen.getByText(/Got:/)).toBeTruthy();
  });

  it('renders negate badge on mapping', () => {
    const negatedMapping: Mapping = { ...mapping, negate: true };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[negatedMapping]}
        capabilities={{ operators: true } as Required<import('./types').AdapterCapabilities>}
        onUpdateMappingOperator={vi.fn()}
      />,
    );
    expect(container.querySelector('.dm-negate-badge')).toBeTruthy();
  });

  it('calls onToggleMappingNegate when negate badge clicked', () => {
    const onToggleMappingNegate = vi.fn();
    const negatedMapping: Mapping = { ...mapping, negate: true };
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[negatedMapping]}
        capabilities={{ operators: true } as Required<import('./types').AdapterCapabilities>}
        onUpdateMappingOperator={vi.fn()}
        onToggleMappingNegate={onToggleMappingNegate}
      />,
    );
    const badge = container.querySelector('.dm-negate-badge');
    fireEvent.click(badge!);
    expect(onToggleMappingNegate).toHaveBeenCalledWith('m1');
  });

  it('renders fetched origin badge', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        fieldOrigins={new Map([[leaf.path, 'fetched']])}
      />,
    );
    expect(container.querySelector('.dm-origin-badge--fetched')).toBeTruthy();
  });

  it('opens context menu on right-click', () => {
    const capabilities = { operators: true } as Required<import('./types').AdapterCapabilities>;
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        capabilities={capabilities}
      />,
    );
    const nodeRow = screen.getByText('userName').closest('.dm-tree-node');
    fireEvent.contextMenu(nodeRow!);
    expect(document.querySelector('.dm-context-menu')).toBeTruthy();
  });

  it('filters out node when mappingFilter is mapped but node has no mapping', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[]}
        mappingFilter="mapped"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows node when mappingFilter is mapped and node has mapping', () => {
    const { container } = render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        mappings={[mapping]}
        mappedTargetPaths={new Set([leaf.path])}
        mappingFilter="mapped"
      />,
    );
    expect(container.querySelector('.dm-tree-node')).toBeTruthy();
  });

  it('renders array node with unordered toggle', () => {
    const arrayNode: JsonTreeNode = { key: 'items', path: 'items', type: 'array', value: undefined, children: [leaf] };
    const onToggleUnorderedArray = vi.fn();
    render(
      <TargetTreeNode
        node={arrayNode}
        {...defaults}
        onToggleUnorderedArray={onToggleUnorderedArray}
      />,
    );
    expect(screen.getByText('items')).toBeTruthy();
  });

  it('handles double-click to start rename on custom field', () => {
    const onUpdateCustomField = vi.fn();
    render(
      <TargetTreeNode
        node={leaf}
        {...defaults}
        fieldOrigins={new Map([[leaf.path, 'custom']])}
        onUpdateCustomField={onUpdateCustomField}
      />,
    );
    const nodeRow = screen.getByText('userName').closest('.dm-tree-node');
    fireEvent.doubleClick(nodeRow!);
    expect(document.querySelector('.dm-rename-input')).toBeTruthy();
  });
});
