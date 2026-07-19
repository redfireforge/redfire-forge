/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTabDragReorder } from './useTabDragReorder';

interface MockDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  types: string[];
  setData: (type: string, value: string) => void;
  getData: (type: string) => string;
}

function makeDataTransfer(): MockDataTransfer {
  const store: Record<string, string> = {};
  return {
    effectAllowed: '',
    dropEffect: '',
    types: [],
    setData(type, value) {
      store[type] = value;
      this.types = Object.keys(store);
    },
    getData(type) {
      return store[type] ?? '';
    },
  };
}

function makeDragEvent(
  dataTransfer: MockDataTransfer,
  clientX = 0,
): React.DragEvent<HTMLElement> {
  return {
    dataTransfer,
    clientX,
    preventDefault: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => ({ left: 100, width: 100 }),
    },
  } as unknown as React.DragEvent<HTMLElement>;
}

describe('useTabDragReorder', () => {
  it('tracks drag state and computes the drop side', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useTabDragReorder({ mimeType: 'application/x-redfire-tab', isEditing: false, onReorder }),
    );
    const dt = makeDataTransfer();

    act(() => result.current.handleDragStart(makeDragEvent(dt), 1, 'tab-1'));
    expect(dt.effectAllowed).toBe('move');
    expect(dt.getData('application/x-redfire-tab')).toBe('1');
    expect(result.current.draggingTabId).toBe('tab-1');

    act(() => result.current.handleDragOver(makeDragEvent(dt, 120), 'tab-1'));
    expect(result.current.dragOverTabId).toBeNull();

    act(() => result.current.handleDragOver(makeDragEvent(dt, 120), 'tab-2'));
    expect(result.current.dragOverTabId).toBe('tab-2');
    expect(result.current.dropSide).toBe('before');
    expect(result.current.dropClassFor('tab-2')).toBe('studio-tab-drop-before');

    act(() => result.current.handleDragOver(makeDragEvent(dt, 180), 'tab-2'));
    expect(result.current.dropSide).toBe('after');
    expect(result.current.dropClassFor('tab-2')).toBe('studio-tab-drop-after');

    act(() => result.current.handleDragLeave(makeDragEvent(dt), 'tab-2'));
    expect(result.current.dragOverTabId).toBeNull();
    expect(result.current.dropSide).toBeNull();

    act(() => result.current.handleDrop(makeDragEvent(dt, 180), 2));
    expect(onReorder).toHaveBeenCalledWith(1, 2);

    act(() => result.current.handleDragEnd());
    expect(result.current.draggingTabId).toBeNull();
    expect(result.current.dragOverTabId).toBeNull();
    expect(result.current.dropSide).toBeNull();
  });

  it('ignores same-tab drag-over and drop events without valid source data', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useTabDragReorder({ mimeType: 'application/x-redfire-tab', isEditing: false, onReorder }),
    );
    const dt = makeDataTransfer();
    dt.setData('application/x-redfire-tab', '1');

    act(() => result.current.handleDragStart(makeDragEvent(dt), 1, 'tab-1'));
    act(() => result.current.handleDragOver(makeDragEvent(dt, 120), 'tab-1'));
    expect(result.current.dragOverTabId).toBeNull();

    const emptyDt = makeDataTransfer();
    act(() => result.current.handleDrop(makeDragEvent(emptyDt, 120), 2));
    act(() => result.current.handleDrop(makeDragEvent(dt, 120), 0));
    expect(onReorder).toHaveBeenCalledWith(1, 0);

    const invalidDt = makeDataTransfer();
    invalidDt.setData('application/x-redfire-tab', 'not-a-number');
    act(() => result.current.handleDrop(makeDragEvent(invalidDt, 120), 2));
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it('blocks drag start while editing and ignores unrelated drops', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useTabDragReorder({ mimeType: 'application/x-redfire-tab', isEditing: true, onReorder }),
    );
    const dt = makeDataTransfer();

    const dragStart = makeDragEvent(dt);
    act(() => result.current.handleDragStart(dragStart, 0, 'tab-0'));
    expect(dragStart.preventDefault).toHaveBeenCalled();
    expect(result.current.draggingTabId).toBeNull();

    const foreignDt = makeDataTransfer();
    foreignDt.types = ['application/x-other-tab'];
    act(() => result.current.handleDragOver(makeDragEvent(foreignDt, 120), 'tab-2'));
    expect(result.current.dragOverTabId).toBeNull();

    const noopDt = makeDataTransfer();
    noopDt.setData('application/x-redfire-tab', 'not-a-number');
    act(() => result.current.handleDrop(makeDragEvent(noopDt, 120), 2));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('returns an empty drop class when no tab is targeted', () => {
    const { result } = renderHook(() =>
      useTabDragReorder({ mimeType: 'application/x-redfire-tab', isEditing: false }),
    );

    expect(result.current.dropClassFor('tab-1')).toBe('');
  });
});