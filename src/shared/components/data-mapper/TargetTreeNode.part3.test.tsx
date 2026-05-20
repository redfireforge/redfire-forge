/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TargetTreeNode from './TargetTreeNode';
import { JsonTreeNode } from '../../utils/jsonTreeModel';
import { Mapping } from './types';
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
