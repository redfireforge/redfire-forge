/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
