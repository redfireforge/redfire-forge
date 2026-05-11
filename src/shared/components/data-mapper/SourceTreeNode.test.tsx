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

  it('renders type badge', () => {
    render(<SourceTreeNode node={leaf} {...defaults} />);
    expect(screen.getByText('Aa')).toBeTruthy();
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

  it('filters nodes by search term', () => {
    render(<SourceTreeNode node={nested} {...defaults} search="city" />);
    expect(screen.getByText('city')).toBeTruthy();
    expect(screen.queryByText('age')).toBeNull();
  });

  it('hides entire tree when search matches nothing', () => {
    const { container } = render(<SourceTreeNode node={nested} {...defaults} search="zzz" />);
    expect(container.innerHTML).toBe('');
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
});
