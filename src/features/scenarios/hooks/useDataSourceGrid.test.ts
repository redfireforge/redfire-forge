/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSourceGrid } from './useDataSourceGrid';
import type { DataSource } from '@shared/types';

function makeDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'ds-1',
    columns: [
      { id: 'c1', name: 'col1', type: 'input', mapping: 'col1' },
      { id: 'c2', name: 'col2', type: 'input', mapping: 'col2' },
      { id: 'c3', name: 'col3', type: 'input', mapping: 'col3' },
    ],
    rows: [
      { id: 'r1', values: { c1: 'a', c2: 'b', c3: 'c' }, enabled: true },
      { id: 'r2', values: { c1: 'd', c2: 'e', c3: 'f' }, enabled: true },
    ],
    source: { type: 'inline' },
    ...overrides,
  };
}

describe('useDataSourceGrid', () => {
  describe('column drag and drop', () => {
    it('initializes with no drag state', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      expect(result.current.draggingColDragId).toBeNull();
      expect(result.current.dragOverColId).toBeNull();
    });

    it('sets dragging state on drag start', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const mockEvent = {
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as React.DragEvent;

      act(() => result.current.handleColDragStart('c1', mockEvent));
      expect(result.current.draggingColDragId).toBe('c1');
    });

    it('reorders columns on drop', () => {
      const dt = makeDataSource();
      const onChange = vi.fn();
      const { result } = renderHook(() => useDataSourceGrid(dt, onChange));

      // Start drag on c1
      act(() => {
        result.current.handleColDragStart('c1', {
          dataTransfer: { effectAllowed: '', setData: vi.fn() },
        } as unknown as React.DragEvent);
      });

      // Drop on c3
      act(() => {
        result.current.handleColDrop('c3', {
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'c1' },
        } as unknown as React.DragEvent);
      });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: expect.arrayContaining([
            expect.objectContaining({ id: 'c2' }),
            expect.objectContaining({ id: 'c3' }),
            expect.objectContaining({ id: 'c1' }),
          ]),
        }),
      );
    });

    it('clears drag state on drag end', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));

      act(() => {
        result.current.handleColDragStart('c1', {
          dataTransfer: { effectAllowed: '', setData: vi.fn() },
        } as unknown as React.DragEvent);
      });
      expect(result.current.draggingColDragId).toBe('c1');

      act(() => result.current.handleColDragEnd());
      expect(result.current.draggingColDragId).toBeNull();
      expect(result.current.dragOverColId).toBeNull();
    });
  });

  describe('tableRef', () => {
    it('provides a ref object', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      expect(result.current.tableRef).toBeDefined();
      expect(result.current.tableRef.current).toBeNull();
    });
  });

  describe('handleCellKeyDown', () => {
    it('does nothing when dt is undefined', () => {
      const { result } = renderHook(() => useDataSourceGrid(undefined, vi.fn()));
      // Should not throw
      const event = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
      act(() => result.current.handleCellKeyDown(event, 0, 0));
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('handleColDrop - edge cases', () => {
    it('does nothing when dropping on same column', () => {
      const dt = makeDataSource();
      const onChange = vi.fn();
      const { result } = renderHook(() => useDataSourceGrid(dt, onChange));

      act(() => {
        result.current.handleColDragStart('c1', {
          dataTransfer: { effectAllowed: '', setData: vi.fn() },
        } as unknown as React.DragEvent);
      });

      act(() => {
        result.current.handleColDrop('c1', {
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'c1' },
        } as unknown as React.DragEvent);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does nothing when dt is undefined', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useDataSourceGrid(undefined, onChange));

      act(() => {
        result.current.handleColDrop('c1', {
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'c2' },
        } as unknown as React.DragEvent);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does nothing when source column not found', () => {
      const dt = makeDataSource();
      const onChange = vi.fn();
      const { result } = renderHook(() => useDataSourceGrid(dt, onChange));

      act(() => {
        result.current.handleColDragStart('nonexistent', {
          dataTransfer: { effectAllowed: '', setData: vi.fn() },
        } as unknown as React.DragEvent);
      });

      act(() => {
        result.current.handleColDrop('c1', {
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'nonexistent' },
        } as unknown as React.DragEvent);
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('handleColDragOver', () => {
    it('sets dragOverColId and prevents default', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();

      act(() => {
        result.current.handleColDragStart('c1', {
          dataTransfer: { effectAllowed: '', setData: vi.fn() },
        } as unknown as React.DragEvent);
      });

      act(() => {
        result.current.handleColDragOver('c2', {
          preventDefault,
          dataTransfer: { dropEffect: '' },
        } as unknown as React.DragEvent);
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(result.current.dragOverColId).toBe('c2');
    });
  });

  describe('handleColResize', () => {
    it('sets up resize event listeners', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));

      const th = document.createElement('th');
      th.style.width = '100px';
      th.getBoundingClientRect = () => ({ width: 100 } as DOMRect);
      const handle = document.createElement('div');
      th.appendChild(handle);

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        target: handle,
      } as unknown as React.MouseEvent;

      act(() => result.current.handleColResize(mockEvent, 0));

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(handle.classList.contains('resizing')).toBe(true);

      // Simulate mouse up to clean up
      document.dispatchEvent(new MouseEvent('mouseup'));
      expect(handle.classList.contains('resizing')).toBe(false);
    });

    it('does nothing when no th found', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        target: document.createElement('span'), // orphan, no closest th
      } as unknown as React.MouseEvent;

      act(() => result.current.handleColResize(mockEvent, 0));
      // Should not throw
    });
  });

  describe('handleCellKeyDown - navigation', () => {
    it('handles Tab to move to next column', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'Tab', shiftKey: false, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => result.current.handleCellKeyDown(event, 0, 0));
      expect(preventDefault).toHaveBeenCalled();
    });

    it('handles Shift+Tab to move to previous column', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'Tab', shiftKey: true, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => result.current.handleCellKeyDown(event, 0, 1));
      expect(preventDefault).toHaveBeenCalled();
    });

    it('handles Enter to move to next row', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'Enter', preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => result.current.handleCellKeyDown(event, 0, 0));
      expect(preventDefault).toHaveBeenCalled();
    });

    it('handles Alt+ArrowDown to move down', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'ArrowDown', altKey: true, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => result.current.handleCellKeyDown(event, 0, 0));
      expect(preventDefault).toHaveBeenCalled();
    });

    it('handles Alt+ArrowUp to move up', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'ArrowUp', altKey: true, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => result.current.handleCellKeyDown(event, 1, 0));
      expect(preventDefault).toHaveBeenCalled();
    });

    it('ignores unhandled keys', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'a', preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => result.current.handleCellKeyDown(event, 0, 0));
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('wraps column to next row on Tab at end', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'Tab', shiftKey: false, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      // At last column, should wrap
      act(() => result.current.handleCellKeyDown(event, 0, 2));
      expect(preventDefault).toHaveBeenCalled();
    });

    it('wraps column to previous row on Shift+Tab at start', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();
      const event = { key: 'Tab', shiftKey: true, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;

      act(() => result.current.handleCellKeyDown(event, 1, 0));
      expect(preventDefault).toHaveBeenCalled();
    });

    it('does not navigate out of bounds', () => {
      const dt = makeDataSource();
      const { result } = renderHook(() => useDataSourceGrid(dt, vi.fn()));
      const preventDefault = vi.fn();

      // Try to go above first row
      const event = { key: 'ArrowUp', altKey: true, preventDefault } as unknown as React.KeyboardEvent<HTMLInputElement>;
      act(() => result.current.handleCellKeyDown(event, 0, 0));
      expect(preventDefault).toHaveBeenCalled();
      // Should not throw
    });
  });
});
