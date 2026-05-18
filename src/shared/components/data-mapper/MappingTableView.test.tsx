/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MappingTableView from './MappingTableView';
import type { Mapping, MapperSource } from './types';

function makeSources(sampleData: unknown = { name: 'Alice', age: 30 }): MapperSource[] {
  return [{ id: 's1', label: 'Source', sampleData }];
}

function makeMapping(overrides: Partial<Mapping> & { id: string; targetPath: string }): Mapping {
  return { sourcePath: 'name', sourceId: 's1', ...overrides };
}

describe('MappingTableView', () => {
  it('shows empty state when no mappings', () => {
    render(
      <MappingTableView mappings={[]} sources={makeSources()} activeSourceId="s1" />,
    );
    expect(screen.getByText(/No mappings yet/)).toBeTruthy();
  });

  it('renders list rows for simple mappings', () => {
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'userName', sourcePath: 'name' }),
      makeMapping({ id: 'm2', targetPath: 'userAge', sourcePath: 'age' }),
    ];
    render(
      <MappingTableView mappings={mappings} sources={makeSources()} activeSourceId="s1" />,
    );
    expect(screen.getByText('userName')).toBeTruthy();
    expect(screen.getByText('userAge')).toBeTruthy();
    expect(screen.getByText('"Alice"')).toBeTruthy();
    expect(screen.getByText('"30"')).toBeTruthy();
  });

  it('shows dash when expected value is empty', () => {
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'missing', sourcePath: 'nonexistent' }),
    ];
    render(
      <MappingTableView mappings={mappings} sources={makeSources()} activeSourceId="s1" />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('uses expression instead of sourcePath when available', () => {
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'out', sourcePath: 'name', expression: 'age' }),
    ];
    render(
      <MappingTableView mappings={mappings} sources={makeSources()} activeSourceId="s1" />,
    );
    expect(screen.getByText('"30"')).toBeTruthy();
  });

  it('calls onSelectMapping when row is clicked', () => {
    const onSelect = vi.fn();
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'userName', sourcePath: 'name' }),
    ];
    render(
      <MappingTableView
        mappings={mappings}
        sources={makeSources()}
        activeSourceId="s1"
        onSelectMapping={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('userName'));
    expect(onSelect).toHaveBeenCalledWith('m1');
  });

  it('highlights selected row', () => {
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'userName', sourcePath: 'name' }),
    ];
    const { container } = render(
      <MappingTableView
        mappings={mappings}
        sources={makeSources()}
        activeSourceId="s1"
        selectedMappingId="m1"
      />,
    );
    const row = container.querySelector('.dm-table-row--selected');
    expect(row).toBeTruthy();
  });

  it('calls onRemoveMapping and stops propagation', () => {
    const onRemove = vi.fn();
    const onSelect = vi.fn();
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'userName', sourcePath: 'name' }),
    ];
    render(
      <MappingTableView
        mappings={mappings}
        sources={makeSources()}
        activeSourceId="s1"
        onRemoveMapping={onRemove}
        onSelectMapping={onSelect}
      />,
    );
    const deleteBtn = screen.getByLabelText('Remove mapping userName');
    fireEvent.click(deleteBtn);
    expect(onRemove).toHaveBeenCalledWith('m1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not render delete button when onRemoveMapping is not provided', () => {
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'userName', sourcePath: 'name' }),
    ];
    const { container } = render(
      <MappingTableView
        mappings={mappings}
        sources={makeSources()}
        activeSourceId="s1"
      />,
    );
    expect(container.querySelector('.dm-table-delete-btn')).toBeNull();
  });

  it('stringifies non-string values from source data', () => {
    const sources = makeSources({ info: { nested: true } });
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'out', sourcePath: 'info' }),
    ];
    render(
      <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
    );
    expect(screen.getByText('"{"nested":true}"')).toBeTruthy();
  });

  it('handles null sampleData gracefully', () => {
    const sources = makeSources(null);
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'out', sourcePath: 'name' }),
    ];
    render(
      <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('falls back to first source when activeSourceId is not found', () => {
    const mappings: Mapping[] = [
      makeMapping({ id: 'm1', targetPath: 'out', sourcePath: 'name' }),
    ];
    render(
      <MappingTableView
        mappings={mappings}
        sources={makeSources()}
        activeSourceId="nonexistent"
      />,
    );
    expect(screen.getByText('"Alice"')).toBeTruthy();
  });

  describe('pivot layout', () => {
    function makeArrayMappings(): { mappings: Mapping[]; sources: MapperSource[] } {
      const sources = makeSources({
        items: [
          { name: 'A', price: 10 },
          { name: 'B', price: 20 },
        ],
      });
      const mappings: Mapping[] = [
        makeMapping({ id: 'm1', targetPath: 'items[0].name', sourcePath: 'items[0].name' }),
        makeMapping({ id: 'm2', targetPath: 'items[0].price', sourcePath: 'items[0].price' }),
        makeMapping({ id: 'm3', targetPath: 'items[1].name', sourcePath: 'items[1].name' }),
        makeMapping({ id: 'm4', targetPath: 'items[1].price', sourcePath: 'items[1].price' }),
      ];
      return { mappings, sources };
    }

    it('shows pivot toggle for array-like mappings', () => {
      const { mappings, sources } = makeArrayMappings();
      render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      expect(screen.getByRole('tab', { name: 'List' })).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'Table' })).toBeTruthy();
    });

    it('shows row count in list mode', () => {
      const { mappings, sources } = makeArrayMappings();
      render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      expect(screen.getByText('4 rows')).toBeTruthy();
    });

    it('shows dimension count in pivot mode', () => {
      const { mappings, sources } = makeArrayMappings();
      render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      expect(screen.getByText('2 × 2')).toBeTruthy();
    });

    it('renders pivot table with header, rows and cells', () => {
      const { mappings, sources } = makeArrayMappings();
      const { container } = render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      const table = container.querySelector('.validation-fields-pivot-table');
      expect(table).toBeTruthy();
      expect(screen.getByText('items')).toBeTruthy();
      expect(screen.getByText('#0')).toBeTruthy();
      expect(screen.getByText('#1')).toBeTruthy();
      expect(screen.getByText('name')).toBeTruthy();
      expect(screen.getByText('price')).toBeTruthy();
    });

    it('shows empty cell marker for missing pivot data', () => {
      const sources = makeSources({
        items: [{ name: 'A', price: 10 }, { name: 'B' }],
      });
      const mappings: Mapping[] = [
        makeMapping({ id: 'm1', targetPath: 'items[0].name', sourcePath: 'items[0].name' }),
        makeMapping({ id: 'm2', targetPath: 'items[0].price', sourcePath: 'items[0].price' }),
        makeMapping({ id: 'm3', targetPath: 'items[1].name', sourcePath: 'items[1].name' }),
      ];
      const { container } = render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      const empties = container.querySelectorAll('.validation-fields-pivot-empty');
      expect(empties.length).toBeGreaterThan(0);
    });

    it('shows dash for empty cell value in pivot mode', () => {
      const sources = makeSources({
        items: [{ name: 'A', val: '' }],
      });
      const mappings: Mapping[] = [
        makeMapping({ id: 'm1', targetPath: 'items[0].name', sourcePath: 'items[0].name' }),
        makeMapping({ id: 'm2', targetPath: 'items[0].val', sourcePath: 'items[0].val' }),
      ];
      render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('switches back to list mode', () => {
      const { mappings, sources } = makeArrayMappings();
      const { container } = render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      expect(container.querySelector('.validation-fields-pivot-table')).toBeTruthy();
      fireEvent.click(screen.getByRole('tab', { name: 'List' }));
      expect(container.querySelector('.validation-fields-pivot-table')).toBeNull();
    });

    it('singular row text for single mapping', () => {
      const sources = makeSources({ items: [{ name: 'A' }, { name: 'B' }] });
      const mappings: Mapping[] = [
        makeMapping({ id: 'm1', targetPath: 'items[0].name', sourcePath: 'items[0].name' }),
      ];
      render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      expect(screen.getByText('1 row')).toBeTruthy();
    });

    it('does not show pivot toggle for non-array paths', () => {
      const mappings: Mapping[] = [
        makeMapping({ id: 'm1', targetPath: 'user.name', sourcePath: 'name' }),
        makeMapping({ id: 'm2', targetPath: 'user.age', sourcePath: 'age' }),
      ];
      render(
        <MappingTableView mappings={mappings} sources={makeSources()} activeSourceId="s1" />,
      );
      expect(screen.queryByRole('tab', { name: 'Table' })).toBeNull();
    });

    it('handles root-level paths in pivot (no dot)', () => {
      const sources = makeSources({ a: 1, b: 2 });
      const mappings: Mapping[] = [
        makeMapping({ id: 'm1', targetPath: 'a', sourcePath: 'a' }),
        makeMapping({ id: 'm2', targetPath: 'b', sourcePath: 'b' }),
      ];
      render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      expect(screen.queryByRole('tab', { name: 'Table' })).toBeNull();
    });

    it('renders non-index row key as label when not matching bracket pattern', () => {
      const sources = makeSources({
        group: { sub: { x: 1 } },
        other: { sub: { x: 2 } },
      });
      const mappings: Mapping[] = [
        makeMapping({ id: 'm1', targetPath: 'group.sub.x', sourcePath: 'group.sub.x' }),
        makeMapping({ id: 'm2', targetPath: 'other.sub.x', sourcePath: 'other.sub.x' }),
      ];
      const { container } = render(
        <MappingTableView mappings={mappings} sources={sources} activeSourceId="s1" />,
      );
      expect(container.querySelector('.validation-fields-pivot-table')).toBeNull();
    });
  });
});
