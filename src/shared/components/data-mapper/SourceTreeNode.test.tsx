/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SourceTreeNode from './SourceTreeNode';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';

const leaf: JsonTreeNode = { key: 'name', path: 'name', type: 'string', value: 'Alice', children: [] };
const nested: JsonTreeNode = {
  key: '(root)', path: '', type: 'object', value: undefined,
  children: [
    leaf,
    { key: 'age', path: 'age', type: 'number', value: 42, children: [] },
    {
      key: 'address', path: 'address', type: 'object', value: undefined,
      children: [
        { key: 'city', path: 'address.city', type: 'string', value: 'NYC', children: [] },
      ],
    },
  ],
};

const defaults = {
  depth: 0,
  search: '',
  onDragStart: vi.fn(),
  sourceId: 's1',
  expandedPaths: new Set(['__root__', '', 'address']),
  onToggle: vi.fn(),
};

describe('SourceTreeNode', () => {
  it('renders leaf node with key and value', () => {
    render(<SourceTreeNode node={leaf} {...defaults} />);
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('renders drag handle on leaf nodes', () => {
    render(<SourceTreeNode node={leaf} {...defaults} />);
    expect(screen.getByTitle('Drag to map')).toBeTruthy();
  });

  it('renders type pill', () => {
    render(<SourceTreeNode node={leaf} {...defaults} />);
    expect(screen.getByText('str')).toBeTruthy();
  });

  it('renders nested children when expanded', () => {
    render(<SourceTreeNode node={nested} {...defaults} />);
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('age')).toBeTruthy();
    expect(screen.getByText('city')).toBeTruthy();
  });

  it('hides children when collapsed', () => {
    const collapsed = { ...defaults, expandedPaths: new Set<string>() };
    render(<SourceTreeNode node={nested} {...collapsed} />);
    expect(screen.getByText('(root)')).toBeTruthy();
    expect(screen.queryByText('name')).toBeNull();
  });

  it('fires onToggle when chevron clicked', () => {
    const onToggle = vi.fn();
    render(<SourceTreeNode node={nested} {...defaults} onToggle={onToggle} />);
    fireEvent.click(screen.getAllByLabelText(/Collapse|Expand/)[0]);
    expect(onToggle).toHaveBeenCalledWith('__root__');
  });

  it('fires onDragStart on leaf drag', () => {
    const onDragStart = vi.fn();
    render(<SourceTreeNode node={leaf} {...defaults} onDragStart={onDragStart} />);
    const el = screen.getByText('name').closest('.dm-tree-node')!;
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => { store[k] = v; },
      getData: (k: string) => store[k] ?? '',
      effectAllowed: 'none',
    };
    fireEvent.dragStart(el, { dataTransfer });
    expect(onDragStart).toHaveBeenCalledWith('name', 's1');
    expect(store['application/mapper-source']).toContain('"path":"name"');
  });

  it('fires onDragStart on non-leaf drag when node has a path', () => {
    const parentNode: JsonTreeNode = {
      key: 'payload',
      path: 'payload',
      type: 'object',
      value: undefined,
      children: [{ key: 'x', path: 'payload.x', type: 'number', value: 1, children: [] }],
    };
    const onDragStart = vi.fn();
    render(
      <SourceTreeNode
        node={parentNode}
        {...defaults}
        onDragStart={onDragStart}
        expandedPaths={new Set(['payload'])}
      />,
    );
    const el = screen.getByText('payload').closest('.dm-tree-node')!;
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => { store[k] = v; },
      getData: (k: string) => store[k] ?? '',
      effectAllowed: 'none',
    };
    fireEvent.dragStart(el, { dataTransfer });
    expect(onDragStart).toHaveBeenCalledWith('payload', 's1');
    expect(store['application/mapper-source']).toContain('"path":"payload"');
  });

  it('calls onDragEnd when drag ends on a leaf', () => {
    const onDragEnd = vi.fn();
    render(<SourceTreeNode node={leaf} {...defaults} onDragEnd={onDragEnd} />);
    const el = screen.getByText('name').closest('.dm-tree-node')!;
    fireEvent.dragEnd(el);
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('matches children when parent key does not match search', () => {
    render(<SourceTreeNode node={nested} {...defaults} search="NYC" />);
    expect(screen.getByText('city')).toBeTruthy();
    expect(screen.getByText('NYC')).toBeTruthy();
  });

  it('invokes onToggleSelect when leaf is shift-clicked', () => {
    const onToggleSelect = vi.fn();
    render(<SourceTreeNode node={leaf} {...defaults} onToggleSelect={onToggleSelect} />);
    const el = screen.getByText('name').closest('.dm-tree-node')!;
    fireEvent.click(el, { shiftKey: true });
    expect(onToggleSelect).toHaveBeenCalledWith('name');
  });

  it('invokes onToggleSelect when leaf is meta-clicked', () => {
    const onToggleSelect = vi.fn();
    render(<SourceTreeNode node={leaf} {...defaults} onToggleSelect={onToggleSelect} />);
    const el = screen.getByText('name').closest('.dm-tree-node')!;
    fireEvent.click(el, { metaKey: true });
    expect(onToggleSelect).toHaveBeenCalledWith('name');
  });

  it('invokes onToggleSelect when leaf is ctrl-clicked', () => {
    const onToggleSelect = vi.fn();
    render(<SourceTreeNode node={leaf} {...defaults} onToggleSelect={onToggleSelect} />);
    const el = screen.getByText('name').closest('.dm-tree-node')!;
    fireEvent.click(el, { ctrlKey: true });
    expect(onToggleSelect).toHaveBeenCalledWith('name');
  });

  it('does not toggle selection on plain leaf click without modifier keys', () => {
    const onToggleSelect = vi.fn();
    render(<SourceTreeNode node={leaf} {...defaults} onToggleSelect={onToggleSelect} />);
    const el = screen.getByText('name').closest('.dm-tree-node')!;
    fireEvent.click(el);
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it('does not call onDragEnd when node is not draggable (breaking drift)', () => {
    const onDragEnd = vi.fn();
    const driftMap = new Map([['name', { severity: 'breaking' as const, label: 'Removed' }]]);
    render(<SourceTreeNode node={leaf} {...defaults} driftMap={driftMap} onDragEnd={onDragEnd} />);
    const el = screen.getByText('name').closest('.dm-tree-node')!;
    fireEvent.dragEnd(el);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('uses child key as React key when child path is empty', () => {
    const childNoPath: JsonTreeNode = { key: 'leaf', path: '', type: 'string', value: 'v', children: [] };
    const parent: JsonTreeNode = {
      key: 'parent', path: 'parent', type: 'object', value: undefined, children: [childNoPath],
    };
    const { container } = render(
      <SourceTreeNode node={parent} {...defaults} expandedPaths={new Set(['parent', '__root__'])} />,
    );
    expect(container.querySelector('[data-path=""]')).not.toBeNull();
    expect(screen.getByText('v')).toBeTruthy();
  });

  it('matches leaf by path substring in search', () => {
    const pathLeaf: JsonTreeNode = { key: 'id', path: 'user.profile.id', type: 'string', value: '1', children: [] };
    render(<SourceTreeNode node={pathLeaf} {...defaults} search="profile" />);
    expect(screen.getByText('id')).toBeTruthy();
  });

  it('renders null leaf without sample value text', () => {
    const nullLeaf: JsonTreeNode = { key: 'n', path: 'n', type: 'null', value: null, children: [] };
    const { container } = render(<SourceTreeNode node={nullLeaf} {...defaults} />);
    expect(container.querySelector('.dm-node-sample-value')).toBeNull();
  });

  it('shows fallback type pill for unknown node types', () => {
    const odd = { ...leaf, type: 'bogus' as unknown as JsonTreeNode['type'] };
    render(<SourceTreeNode node={odd} {...defaults} />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders root placeholder when key is empty string', () => {
    const rootBare: JsonTreeNode = { key: '', path: '', type: 'object', value: undefined, children: [leaf] };
    render(<SourceTreeNode node={rootBare} {...defaults} expandedPaths={new Set(['', '__root__'])} />);
    expect(screen.getByText('(root)')).toBeTruthy();
  });

  it('shows short trace values without ellipsis', () => {
    const traceOverlay = new Map([['name', { value: 'abc', isError: false }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />);
    expect(container.querySelector('.dm-trace-value')!.textContent).toBe('abc');
  });

  it('filters nodes by search term', () => {
    render(<SourceTreeNode node={nested} {...defaults} search="city" />);
    expect(screen.getByText('city')).toBeTruthy();
    expect(screen.queryByText('age')).toBeNull();
  });

  it('hides entire tree when search matches nothing', () => {
    const { container } = render(<SourceTreeNode node={nested} {...defaults} search="zzz" />);
    expect(container.innerHTML).toBe('');
  });

  it('hides leaf without children property when search has no match', () => {
    const solo: JsonTreeNode = { key: 'solo', path: 'solo', type: 'string', value: 'v' };
    const { container } = render(<SourceTreeNode node={solo} {...defaults} search="zzz" />);
    expect(container.innerHTML).toBe('');
  });

  it('matches leaf by sample value substring', () => {
    render(<SourceTreeNode node={leaf} {...defaults} search="alic" />);
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('shows count for collapsed object nodes', () => {
    const collapsed = { ...defaults, expandedPaths: new Set<string>() };
    render(<SourceTreeNode node={nested} {...collapsed} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('truncates long values', () => {
    const longVal: JsonTreeNode = {
      key: 'bio', path: 'bio', type: 'string',
      value: 'A'.repeat(50), children: [],
    };
    render(<SourceTreeNode node={longVal} {...defaults} />);
    const valueEl = screen.getByText(/A+…/);
    expect(valueEl.textContent!.length).toBeLessThan(45);
  });

  // ── Drift indicators ──────────────────────────────

  it('renders info drift badge (green dot) for added field', () => {
    const driftMap = new Map([['name', { severity: 'info' as const, label: 'New field' }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} driftMap={driftMap} />);
    const badge = container.querySelector('.dm-drift-badge--info');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('●');
  });

  it('renders warning drift badge (amber) for type-changed field', () => {
    const driftMap = new Map([['name', { severity: 'warning' as const, label: 'Type changed' }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} driftMap={driftMap} />);
    const badge = container.querySelector('.dm-drift-badge--warning');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('⚠');
  });

  it('renders breaking drift (red strikethrough + badge) for removed field', () => {
    const driftMap = new Map([['name', { severity: 'breaking' as const, label: 'Removed' }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} driftMap={driftMap} />);
    const badge = container.querySelector('.dm-drift-badge--breaking');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('✕');
    const key = container.querySelector('.dm-node-key--removed');
    expect(key).not.toBeNull();
  });

  it('applies drift background class to tree node', () => {
    const driftMap = new Map([['name', { severity: 'warning' as const, label: 'Changed' }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} driftMap={driftMap} />);
    const node = container.querySelector('.dm-tree-node--drift-warning');
    expect(node).not.toBeNull();
  });

  it('disables drag on breaking drift nodes', () => {
    const driftMap = new Map([['name', { severity: 'breaking' as const, label: 'Removed' }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} driftMap={driftMap} />);
    const node = container.querySelector('.dm-tree-node--source');
    expect(node!.getAttribute('draggable')).toBe('false');
  });

  it('disables drag on the root source node with empty path', () => {
    const { container } = render(<SourceTreeNode node={nested} {...defaults} />);
    const rootNode = container.querySelector('.dm-tree-node--source[data-path=""]');
    expect(rootNode?.getAttribute('draggable')).toBe('false');
  });

  it('renders no drift badge when no drift map provided', () => {
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} />);
    expect(container.querySelector('.dm-drift-badge')).toBeNull();
  });

  it('passes driftMap to child nodes', () => {
    const driftMap = new Map([['age', { severity: 'info' as const, label: 'New' }]]);
    const { container } = render(<SourceTreeNode node={nested} {...defaults} driftMap={driftMap} />);
    const badges = container.querySelectorAll('.dm-drift-badge--info');
    expect(badges).toHaveLength(1);
  });

  it('matches drift via [*] normalization when tree path uses [0]', () => {
    const arrayChild: JsonTreeNode = {
      key: 'name', path: 'items[0].name', type: 'string', value: 'test', children: [],
    };
    const driftMap = new Map([['items.[*].name', { severity: 'warning' as const, label: 'Type changed' }]]);
    const { container } = render(<SourceTreeNode node={arrayChild} {...defaults} driftMap={driftMap} />);
    expect(container.querySelector('.dm-drift-badge--warning')).not.toBeNull();
  });

  it('matches drift via [*] normalization when tree path uses [*] index', () => {
    const wildcardChild: JsonTreeNode = {
      key: 'name',
      path: 'items[*].name',
      type: 'string',
      value: 'x',
      children: [],
    };
    const driftMap = new Map([['items.[*].name', { severity: 'info' as const, label: 'Array wildcard' }]]);
    const { container } = render(<SourceTreeNode node={wildcardChild} {...defaults} driftMap={driftMap} />);
    expect(container.querySelector('.dm-drift-badge--info')).not.toBeNull();
  });

  it('prefers exact drift map entry over normalized fallback', () => {
    const driftMap = new Map([
      ['items[0].name', { severity: 'info' as const, label: 'Exact slot' }],
      ['items.[*].name', { severity: 'breaking' as const, label: 'Wildcard' }],
    ]);
    const arrayChild: JsonTreeNode = {
      key: 'name', path: 'items[0].name', type: 'string', value: 'v', children: [],
    };
    const { container } = render(<SourceTreeNode node={arrayChild} {...defaults} driftMap={driftMap} />);
    expect(container.querySelector('.dm-drift-badge--info')).not.toBeNull();
    expect(container.querySelector('.dm-drift-badge--breaking')).toBeNull();
    expect(screen.getByLabelText('Exact slot')).toBeTruthy();
  });

  it('sets tree node title to drift label when drift is present', () => {
    const driftMap = new Map([['name', { severity: 'warning' as const, label: 'Schema drift note' }]]);
    render(<SourceTreeNode node={leaf} {...defaults} driftMap={driftMap} />);
    expect(screen.getByTitle('Schema drift note')).toBeTruthy();
  });

  describe('copy-to-clipboard sample value', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'navigator',
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } }),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('writes full leaf value to clipboard when copyable sample is clicked', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      render(<SourceTreeNode node={leaf} {...defaults} />);
      const copyable = document.querySelector('.dm-node-sample-value--copyable');
      expect(copyable).not.toBeNull();
      fireEvent.click(copyable!);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith('Alice');
    });

    it('copies full untruncated string when display is truncated', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const longVal = 'B'.repeat(50);
      const longLeaf: JsonTreeNode = {
        key: 'bio', path: 'bio', type: 'string', value: longVal, children: [],
      };
      render(<SourceTreeNode node={longLeaf} {...defaults} />);
      fireEvent.click(document.querySelector('.dm-node-sample-value--copyable')!);
      expect(writeText).toHaveBeenCalledWith(longVal);
    });

    it('shows Copied! feedback then restores sample text after timeout', () => {
      vi.useFakeTimers();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      render(<SourceTreeNode node={leaf} {...defaults} />);
      fireEvent.click(document.querySelector('.dm-node-sample-value--copyable')!);
      expect(screen.getByText('Copied!')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1200);
      });
      expect(screen.queryByText('Copied!')).toBeNull();
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    it('does not invoke onNodeSelect when sample value is clicked (stopPropagation)', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const onNodeSelect = vi.fn();
      render(<SourceTreeNode node={leaf} {...defaults} onNodeSelect={onNodeSelect} />);
      fireEvent.click(document.querySelector('.dm-node-sample-value--copyable')!);
      expect(onNodeSelect).not.toHaveBeenCalled();
    });
  });

  describe('expand/collapse chrome', () => {
    it('shows Expand on toggle when root branch is collapsed', () => {
      const collapsed = { ...defaults, expandedPaths: new Set<string>() };
      render(<SourceTreeNode node={nested} {...collapsed} />);
      expect(screen.getByLabelText('Expand')).toBeTruthy();
    });

    it('shows Collapse on toggle when nested branches are expanded', () => {
      render(<SourceTreeNode node={nested} {...defaults} />);
      expect(screen.getAllByLabelText('Collapse').length).toBeGreaterThanOrEqual(1);
    });

    it('adds open chevron class when branch is expanded', () => {
      const { container } = render(<SourceTreeNode node={nested} {...defaults} />);
      expect(container.querySelector('.dm-chevron--open')).not.toBeNull();
    });

    it('omits open chevron class when branch is collapsed', () => {
      const collapsed = { ...defaults, expandedPaths: new Set<string>() };
      const { container } = render(<SourceTreeNode node={nested} {...collapsed} />);
      expect(container.querySelector('.dm-chevron--open')).toBeNull();
    });
  });

  describe('node selection and mapping chrome', () => {
    it('invokes onNodeSelect with path and sourceId on plain leaf click', () => {
      const onNodeSelect = vi.fn();
      render(<SourceTreeNode node={leaf} {...defaults} onNodeSelect={onNodeSelect} />);
      fireEvent.click(screen.getByText('name').closest('.dm-tree-node')!);
      expect(onNodeSelect).toHaveBeenCalledWith('name', 's1');
    });

    it('invokes onNodeSelect when parent object row is clicked', () => {
      const onNodeSelect = vi.fn();
      render(<SourceTreeNode node={nested} {...defaults} onNodeSelect={onNodeSelect} />);
      fireEvent.click(screen.getByText('(root)').closest('.dm-tree-node')!);
      expect(onNodeSelect).toHaveBeenCalledWith('', 's1');
    });

    it('marks checkbox checked when selectedPaths contains the leaf path', () => {
      render(
        <SourceTreeNode
          node={leaf}
          {...defaults}
          onToggleSelect={vi.fn()}
          selectedPaths={new Set(['name'])}
        />,
      );
      expect(screen.getByRole('checkbox', { name: /Select name/i })).toBeChecked();
    });

    it('invokes onToggleSelect when checkbox is toggled', () => {
      const onToggleSelect = vi.fn();
      render(<SourceTreeNode node={leaf} {...defaults} onToggleSelect={onToggleSelect} />);
      fireEvent.click(screen.getByRole('checkbox', { name: /Select name/i }));
      expect(onToggleSelect).toHaveBeenCalledWith('name');
    });

    it('does not invoke onNodeSelect when checkbox is clicked', () => {
      const onNodeSelect = vi.fn();
      const onToggleSelect = vi.fn();
      render(
        <SourceTreeNode node={leaf} {...defaults} onNodeSelect={onNodeSelect} onToggleSelect={onToggleSelect} />,
      );
      fireEvent.click(screen.getByRole('checkbox', { name: /Select name/i }));
      expect(onToggleSelect).toHaveBeenCalled();
      expect(onNodeSelect).not.toHaveBeenCalled();
    });

    it('applies focused class when focusedPath matches leaf', () => {
      const { container } = render(<SourceTreeNode node={leaf} {...defaults} focusedPath="name" />);
      expect(container.querySelector('.dm-tree-node--focused')).not.toBeNull();
    });

    it('applies bulk-selected class when selectedNodePath matches leaf', () => {
      const { container } = render(<SourceTreeNode node={leaf} {...defaults} selectedNodePath="name" />);
      expect(container.querySelector('.dm-tree-node--bulk-selected')).not.toBeNull();
    });

    it('applies mapped class when mappedPaths contains leaf path', () => {
      const { container } = render(
        <SourceTreeNode node={leaf} {...defaults} mappedPaths={new Set(['name'])} />,
      );
      expect(container.querySelector('.dm-tree-node--mapped')).not.toBeNull();
    });

    it('applies hover-highlight class when highlightedPaths matches normalized path', () => {
      const { container } = render(
        <SourceTreeNode node={leaf} {...defaults} highlightedPaths={new Set(['name'])} />,
      );
      expect(container.querySelector('.dm-tree-node--hover-highlight')).not.toBeNull();
    });

    it('hides leaf when mappingFilter is mapped and path is absent from mappedPaths', () => {
      const solo: JsonTreeNode = { key: 'solo', path: 'solo', type: 'string', value: 'v', children: [] };
      const { container } = render(
        <SourceTreeNode node={solo} {...defaults} mappingFilter="mapped" mappedPaths={new Set()} />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('shows leaf when mappingFilter is mapped and path is listed in mappedPaths', () => {
      const solo: JsonTreeNode = { key: 'solo', path: 'solo', type: 'string', value: 'v', children: [] };
      render(
        <SourceTreeNode node={solo} {...defaults} mappingFilter="mapped" mappedPaths={new Set(['solo'])} />,
      );
      expect(screen.getByText('solo')).toBeTruthy();
    });

    it('hides mapped leaf when mappingFilter is unmapped', () => {
      const solo: JsonTreeNode = { key: 'solo', path: 'solo', type: 'string', value: 'v', children: [] };
      const { container } = render(
        <SourceTreeNode node={solo} {...defaults} mappingFilter="unmapped" mappedPaths={new Set(['solo'])} />,
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('node types', () => {
    it('renders boolean leaf with bool pill and false value', () => {
      const boolLeaf: JsonTreeNode = {
        key: 'flag', path: 'flag', type: 'boolean', value: false, children: [],
      };
      render(<SourceTreeNode node={boolLeaf} {...defaults} />);
      expect(screen.getByText('bool')).toBeTruthy();
      expect(screen.getByText('false')).toBeTruthy();
    });

    it('renders array container with arr pill', () => {
      const arrNode: JsonTreeNode = {
        key: 'items',
        path: 'items',
        type: 'array',
        value: [],
        children: [{ key: '[0]', path: 'items[0]', type: 'number', value: 1, children: [] }],
      };
      render(<SourceTreeNode node={arrNode} {...defaults} expandedPaths={new Set(['items'])} />);
      expect(screen.getByText('arr')).toBeTruthy();
      expect(screen.getByText('items[0]')).toBeTruthy();
    });

    it('does not render copyable sample when leaf string value is empty', () => {
      const emptyStr: JsonTreeNode = { key: 'e', path: 'e', type: 'string', value: '', children: [] };
      const { container } = render(<SourceTreeNode node={emptyStr} {...defaults} />);
      expect(container.querySelector('.dm-node-sample-value--copyable')).toBeNull();
    });

    it('renders numeric zero as copyable sample text', () => {
      const zeroLeaf: JsonTreeNode = { key: 'z', path: 'z', type: 'number', value: 0, children: [] };
      render(<SourceTreeNode node={zeroLeaf} {...defaults} />);
      expect(screen.getByText('0')).toBeTruthy();
      expect(document.querySelector('.dm-node-sample-value--copyable')).not.toBeNull();
    });
  });
});

describe('trace overlay', () => {
  it('renders trace value when traceOverlay has matching path', () => {
    const traceOverlay = new Map([['name', { value: 'Alice', isError: false }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />);
    expect(container.querySelector('.dm-trace-value--ok')).not.toBeNull();
    expect(container.querySelector('.dm-trace-value')!.textContent).toBe('Alice');
  });

  it('renders error trace value with error styling', () => {
    const traceOverlay = new Map([['name', { value: 'undefined', isError: true }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />);
    expect(container.querySelector('.dm-trace-value--error')).not.toBeNull();
  });

  it('hides sample value when trace value is shown', () => {
    const traceOverlay = new Map([['name', { value: 'runtime-val', isError: false }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />);
    expect(container.querySelector('.dm-node-sample-value')).toBeNull();
    expect(container.querySelector('.dm-trace-value')!.textContent).toBe('runtime-val');
  });

  it('shows sample value when no trace overlay provided', () => {
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} />);
    expect(container.querySelector('.dm-node-sample-value')).not.toBeNull();
  });

  it('truncates long trace values', () => {
    const longVal = 'a'.repeat(30);
    const traceOverlay = new Map([['name', { value: longVal, isError: false }]]);
    const { container } = render(<SourceTreeNode node={leaf} {...defaults} traceOverlay={traceOverlay} />);
    const text = container.querySelector('.dm-trace-value')!.textContent!;
    expect(text.endsWith('…')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(25);
  });

  it('passes traceOverlay to child nodes', () => {
    const traceOverlay = new Map([['age', { value: '30', isError: false }]]);
    const { container } = render(
      <SourceTreeNode node={nested} {...defaults} traceOverlay={traceOverlay} />,
    );
    expect(container.querySelector('.dm-trace-value--ok')).not.toBeNull();
  });
});
