/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import TargetTreeNode from './TargetTreeNode';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping } from './types';
const leaf: JsonTreeNode = { key: 'userName', path: 'userName', type: 'string', value: '', children: [] };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
