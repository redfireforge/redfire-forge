/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSourceRows } from './useDataSourceRows';
import type { DataSource } from '../../../shared/types';

vi.mock('uuid', () => ({ v4: () => `uuid-${Math.random().toString(36).slice(2, 8)}` }));

function makeDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'ds1',
    columns: [
      { id: 'c1', name: 'vin', type: 'param', mapping: 'vin' },
      { id: 'c2', name: 'channel', type: 'param', mapping: 'channel' },
    ],
    rows: [
      { id: 'r1', values: { c1: 'AAA', c2: 'WEB' }, enabled: true },
      { id: 'r2', values: { c1: 'BBB', c2: 'DEALER' }, enabled: true },
      { id: 'r3', values: { c1: 'CCC', c2: 'MOBILE' }, enabled: false },
    ],
    source: { type: 'inline' },
    ...overrides,
  };
}

describe('useDataSourceRows', () => {
  describe('Row CRUD', () => {
    it('addRow appends a new empty row', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.addRow());
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows).toHaveLength(4);
      expect(updated.rows[3].values.c1).toBe('');
      expect(updated.rows[3].enabled).toBe(true);
    });

    it('addSampleRow appends a sample row', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.addSampleRow());
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[3].isSample).toBe(true);
    });

    it('removeRow removes and keeps at least one row', () => {
      const onChange = vi.fn();
      const ds = makeDataSource({ rows: [{ id: 'r1', values: { c1: 'A', c2: 'B' }, enabled: true }] });
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.removeRow('r1'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows).toHaveLength(1);
      expect(updated.rows[0].id).not.toBe('r1'); // new empty row
    });

    it('moveRow swaps rows', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.moveRow('r2', 'up'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].id).toBe('r2');
      expect(updated.rows[1].id).toBe('r1');
    });

    it('duplicateRow creates a copy after the source', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.duplicateRow('r1'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows).toHaveLength(4);
      expect(updated.rows[1].values.c1).toBe('AAA');
      expect(updated.rows[1].id).not.toBe('r1');
    });

    it('toggleRow flips enabled', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.toggleRow('r1'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].enabled).toBe(false);
    });

    it('toggleRow does not disable sample rows', () => {
      const onChange = vi.fn();
      const ds = makeDataSource({ rows: [{ id: 'r1', values: { c1: 'A', c2: 'B' }, enabled: true, isSample: true }] });
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.toggleRow('r1'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('toggleSample flips isSample', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.toggleSample('r1'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].isSample).toBe(true);
    });

    it('updateCell updates a specific cell value', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.updateCell('r1', 'c1', 'ZZZ'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].values.c1).toBe('ZZZ');
    });

    it('updateRowLabel sets the label', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.updateRowLabel('r1', 'My Row'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].label).toBe('My Row');
    });

    it('updateRowNote sets the note', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.updateRowNote('r1', 'some note'));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].note).toBe('some note');
    });

    it('updateRowNote clears note when empty', () => {
      const onChange = vi.fn();
      const ds = makeDataSource({ rows: [{ id: 'r1', values: { c1: 'A', c2: 'B' }, enabled: true, note: 'old' }] });
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.updateRowNote('r1', ''));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].note).toBeUndefined();
    });

    it('deleteAllRows resets to one empty row', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.deleteAllRows());
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows).toHaveLength(1);
      expect(updated.rows[0].values.c1).toBe('');
    });
  });

  describe('Bulk operations', () => {
    it('selectAll selects all rows', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.selectAll());
      expect(result.current.selectedRows.size).toBe(3);
    });

    it('clearSelection empties selection', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.selectAll());
      act(() => result.current.clearSelection());
      expect(result.current.selectedRows.size).toBe(0);
    });

    it('bulkEnable enables selected rows and clears selection', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      // Select r3 (disabled)
      act(() => {
        result.current.handleRowSelect('r3', { shiftKey: false, ctrlKey: false, metaKey: false } as unknown as React.MouseEvent);
      });
      act(() => result.current.bulkEnable(true));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[2].enabled).toBe(true);
      expect(result.current.selectedRows.size).toBe(0);
    });

    it('bulkDelete removes selected rows', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => result.current.selectAll());
      act(() => result.current.bulkDelete());
      const updated = onChange.mock.calls[0][0] as DataSource;
      // All deleted → replaced with one empty row
      expect(updated.rows).toHaveLength(1);
      expect(updated.rows[0].values.c1).toBe('');
    });

    it('bulkDuplicate duplicates selected rows', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      act(() => {
        result.current.handleRowSelect('r1', { shiftKey: false, ctrlKey: false, metaKey: false } as unknown as React.MouseEvent);
      });
      act(() => result.current.bulkDuplicate());
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows).toHaveLength(4);
      expect(updated.rows[1].values.c1).toBe('AAA');
      expect(updated.rows[1].id).not.toBe('r1');
    });
  });

  describe('Search / sort / filter', () => {
    it('filteredSortedRows filters by search query', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.setSearchQuery('BBB'));
      expect(result.current.filteredSortedRows).toHaveLength(1);
      expect(result.current.filteredSortedRows[0].id).toBe('r2');
    });

    it('filteredSortedRows sorts by column', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.handleSortColumn('c1'));
      const ids = result.current.filteredSortedRows.map(r => r.id);
      expect(ids).toEqual(['r1', 'r2', 'r3']); // AAA, BBB, CCC ascending
    });

    it('handleSortColumn toggles direction on repeated click', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.handleSortColumn('c1'));
      expect(result.current.sortDir).toBe('asc');
      act(() => result.current.handleSortColumn('c1'));
      expect(result.current.sortDir).toBe('desc');
    });

    it('filteredSortedRows filters by tag', () => {
      const ds = makeDataSource({
        rows: [
          { id: 'r1', values: { c1: 'A', c2: 'B' }, enabled: true, tags: ['smoke'] },
          { id: 'r2', values: { c1: 'C', c2: 'D' }, enabled: true },
        ],
      });
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.setFilterTag('smoke'));
      expect(result.current.filteredSortedRows).toHaveLength(1);
      expect(result.current.filteredSortedRows[0].id).toBe('r1');
    });

    it('filteredSortedRows filters untagged', () => {
      const ds = makeDataSource({
        rows: [
          { id: 'r1', values: { c1: 'A', c2: 'B' }, enabled: true, tags: ['smoke'] },
          { id: 'r2', values: { c1: 'C', c2: 'D' }, enabled: true },
        ],
      });
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.setFilterTag('__untagged__'));
      expect(result.current.filteredSortedRows).toHaveLength(1);
      expect(result.current.filteredSortedRows[0].id).toBe('r2');
    });

    it('sample rows sort to top', () => {
      const ds = makeDataSource({
        rows: [
          { id: 'r1', values: { c1: 'A', c2: 'B' }, enabled: true },
          { id: 'r2', values: { c1: 'C', c2: 'D' }, enabled: true, isSample: true },
        ],
      });
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      expect(result.current.filteredSortedRows[0].id).toBe('r2');
    });
  });

  describe('enabledCount', () => {
    it('counts enabled rows', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      expect(result.current.enabledCount).toBe(2);
    });
  });

  describe('no dataSource', () => {
    it('operations are no-ops when dataSource is undefined', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: undefined, onChange }));
      act(() => result.current.addRow());
      act(() => result.current.removeRow('x'));
      act(() => result.current.moveRow('x', 'up'));
      expect(onChange).not.toHaveBeenCalled();
      expect(result.current.filteredSortedRows).toEqual([]);
      expect(result.current.enabledCount).toBe(0);
    });
  });

  describe('handleRowSelect', () => {
    it('selects a single row on plain click', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.handleRowSelect('r2', { shiftKey: false, ctrlKey: false, metaKey: false } as unknown as React.MouseEvent));
      expect(result.current.selectedRows.has('r2')).toBe(true);
      expect(result.current.selectedRows.size).toBe(1);
    });

    it('selects range with shift click', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      // First plain click on r1
      act(() => result.current.handleRowSelect('r1', { shiftKey: false, ctrlKey: false, metaKey: false } as unknown as React.MouseEvent));
      // Shift+click on r3
      act(() => result.current.handleRowSelect('r3', { shiftKey: true, ctrlKey: false, metaKey: false } as unknown as React.MouseEvent));
      expect(result.current.selectedRows.has('r1')).toBe(true);
      expect(result.current.selectedRows.has('r2')).toBe(true);
      expect(result.current.selectedRows.has('r3')).toBe(true);
      expect(result.current.selectedRows.size).toBe(3);
    });

    it('toggles individual row with ctrl click', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.handleRowSelect('r1', { shiftKey: false, ctrlKey: false, metaKey: false } as unknown as React.MouseEvent));
      // Ctrl+click r2 to add to selection
      act(() => result.current.handleRowSelect('r2', { shiftKey: false, ctrlKey: true, metaKey: false } as unknown as React.MouseEvent));
      expect(result.current.selectedRows.has('r1')).toBe(true);
      expect(result.current.selectedRows.has('r2')).toBe(true);
      // Ctrl+click r1 to deselect it
      act(() => result.current.handleRowSelect('r1', { shiftKey: false, ctrlKey: true, metaKey: false } as unknown as React.MouseEvent));
      expect(result.current.selectedRows.has('r1')).toBe(false);
      expect(result.current.selectedRows.has('r2')).toBe(true);
    });

    it('toggles individual row with meta click', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      act(() => result.current.handleRowSelect('r1', { shiftKey: false, ctrlKey: false, metaKey: true } as unknown as React.MouseEvent));
      expect(result.current.selectedRows.has('r1')).toBe(true);
    });
  });

  describe('bulkDuplicate', () => {
    it('duplicates selected rows after the last selected', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      // Select r1 and r2
      act(() => result.current.selectAll());
      // Actually just select r1 and r2 manually
      act(() => result.current.handleRowSelect('r1', { shiftKey: false, ctrlKey: false, metaKey: false } as unknown as React.MouseEvent));
      act(() => result.current.handleRowSelect('r2', { shiftKey: false, ctrlKey: true, metaKey: false } as unknown as React.MouseEvent));
      act(() => result.current.bulkDuplicate());
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows.length).toBe(5); // 3 original + 2 duplicated
      expect(result.current.selectedRows.size).toBe(0);
    });
  });

  describe('drag and drop', () => {
    it('handleDragStart sets dragRowId and dataTransfer', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      const mockEvent = {
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as React.DragEvent;
      act(() => result.current.handleDragStart('r1', mockEvent));
      expect(result.current.dragRowId).toBe('r1');
      expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
      expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'r1');
    });

    it('handleDragOver prevents default and sets dropEffect', () => {
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange: vi.fn() }));
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: '' },
      } as unknown as React.DragEvent;
      act(() => result.current.handleDragOver(mockEvent));
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.dataTransfer.dropEffect).toBe('move');
    });

    it('handleDrop reorders row from drag source to target', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      // Start drag from r1
      const startEvent = { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as unknown as React.DragEvent;
      act(() => result.current.handleDragStart('r1', startEvent));
      // Drop on r3
      const dropEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      act(() => result.current.handleDrop('r3', dropEvent));
      const updated = onChange.mock.calls[0][0] as DataSource;
      expect(updated.rows[0].id).toBe('r2');
      expect(updated.rows[1].id).toBe('r3');
      expect(updated.rows[2].id).toBe('r1');
      expect(result.current.dragRowId).toBeNull();
    });

    it('handleDrop does nothing when same row', () => {
      const onChange = vi.fn();
      const ds = makeDataSource();
      const { result } = renderHook(() => useDataSourceRows({ dataSource: ds, onChange }));
      const startEvent = { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as unknown as React.DragEvent;
      act(() => result.current.handleDragStart('r1', startEvent));
      const dropEvent = { preventDefault: vi.fn() } as unknown as React.DragEvent;
      act(() => result.current.handleDrop('r1', dropEvent));
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
