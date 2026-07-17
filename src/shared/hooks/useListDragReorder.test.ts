/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useListDragReorder } from './useListDragReorder';

interface MockDataTransfer {
  effectAllowed: string;
  dropEffect: string;
  setData: (type: string, val: string) => void;
  getData: (type: string) => string;
}

function makeDataTransfer(): MockDataTransfer {
  const store: Record<string, string> = {};
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (type, val) => { store[type] = val; },
    getData: (type) => store[type] ?? '',
  };
}

function dragEvent(dataTransfer: MockDataTransfer) {
  return { dataTransfer, preventDefault: vi.fn() } as unknown as React.DragEvent<HTMLElement>;
}

describe('useListDragReorder', () => {
  it('reorders an item forward (0 -> 2)', () => {
    const onChange = vi.fn();
    const items = ['a', 'b', 'c'];
    const { result } = renderHook(() => useListDragReorder(items, onChange));
    const dt = makeDataTransfer();

    act(() => result.current.onDragStart(dragEvent(dt), 0));
    act(() => result.current.onDrop(dragEvent(dt), 2));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(['b', 'c', 'a']);
  });

  it('reorders an item backward (2 -> 0)', () => {
    const onChange = vi.fn();
    const items = ['a', 'b', 'c'];
    const { result } = renderHook(() => useListDragReorder(items, onChange));
    const dt = makeDataTransfer();

    act(() => result.current.onDragStart(dragEvent(dt), 2));
    act(() => result.current.onDrop(dragEvent(dt), 0));

    expect(onChange.mock.calls[0][0]).toEqual(['c', 'a', 'b']);
  });

  it('does not call onChange when dropping onto the same index', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useListDragReorder(['a', 'b'], onChange));
    const dt = makeDataTransfer();

    act(() => result.current.onDragStart(dragEvent(dt), 1));
    act(() => result.current.onDrop(dragEvent(dt), 1));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('tracks dragging and drag-over state', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useListDragReorder(['a', 'b', 'c'], onChange));
    const dt = makeDataTransfer();

    act(() => result.current.onDragStart(dragEvent(dt), 0));
    expect(result.current.isDragging(0)).toBe(true);

    act(() => result.current.onDragOver(dragEvent(dt), 2));
    expect(result.current.isDragOver(2)).toBe(true);
    expect(result.current.isDragOver(0)).toBe(false);

    act(() => result.current.onDragEnd());
    expect(result.current.isDragging(0)).toBe(false);
    expect(result.current.isDragOver(2)).toBe(false);
  });

  it('does nothing while disabled', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useListDragReorder(['a', 'b'], onChange, { disabled: true }));
    const dt = makeDataTransfer();

    act(() => result.current.onDragStart(dragEvent(dt), 0));
    act(() => result.current.onDrop(dragEvent(dt), 1));

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.isDragging(0)).toBe(false);
  });

  it('falls back to the active drag index when the mime payload is missing', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useListDragReorder(['a', 'b', 'c'], onChange));

    act(() => result.current.onDragStart(dragEvent(makeDataTransfer()), 0));
    // Drop with a transfer that has no stored data — hook uses internal dragIndex.
    act(() => result.current.onDrop(dragEvent(makeDataTransfer()), 2));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(['b', 'c', 'a']);
  });

  it('uses a custom mime type and updates dropEffect during drag over', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useListDragReorder(['a', 'b', 'c'], onChange, { mime: 'application/x-custom-list' }),
    );
    const dt = makeDataTransfer();

    act(() => result.current.onDragStart(dragEvent(dt), 1));
    expect(dt.effectAllowed).toBe('move');
    expect(dt.getData('application/x-custom-list')).toBe('1');

    act(() => result.current.onDragOver(dragEvent(dt), 0));
    expect(dt.dropEffect).toBe('move');

    act(() => result.current.onDrop(dragEvent(dt), 0));
    expect(onChange.mock.calls[0][0]).toEqual(['b', 'a', 'c']);
  });

  it('ignores dragOver when nothing is being dragged or when disabled', () => {
    const onChange = vi.fn();
    const dt = makeDataTransfer();

    const enabled = renderHook(() => useListDragReorder(['a', 'b'], onChange));
    act(() => enabled.result.current.onDragOver(dragEvent(dt), 1));
    expect(enabled.result.current.dragOverIndex).toBeNull();

    const disabled = renderHook(() => useListDragReorder(['a', 'b'], onChange, { disabled: true }));
    act(() => disabled.result.current.onDragStart(dragEvent(dt), 0));
    act(() => disabled.result.current.onDragOver(dragEvent(dt), 1));
    expect(disabled.result.current.dragIndex).toBeNull();
    expect(disabled.result.current.dragOverIndex).toBeNull();
  });

  it('does not reorder when the parsed drag index is invalid or out of bounds', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useListDragReorder(['a', 'b'], onChange));

    const invalidDt = makeDataTransfer();
    invalidDt.setData('application/x-redfire-list-index', 'not-a-number');
    act(() => result.current.onDrop(dragEvent(invalidDt), 1));
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.onDragStart(dragEvent(makeDataTransfer()), 0));
    const oobDt = makeDataTransfer();
    oobDt.setData('application/x-redfire-list-index', '99');
    act(() => result.current.onDrop(dragEvent(oobDt), 1));
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.dragIndex).toBeNull();
    expect(result.current.dragOverIndex).toBeNull();
  });
});
