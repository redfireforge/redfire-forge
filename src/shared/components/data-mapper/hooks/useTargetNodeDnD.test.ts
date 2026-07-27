/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTargetNodeDnD } from './useTargetNodeDnD';

function makeDragEvent(overrides: Partial<Record<string, unknown>> = {}): React.DragEvent {
  const dataStore = new Map<string, string>();
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn((type: string, val: string) => dataStore.set(type, val)),
      getData: vi.fn((type: string) => dataStore.get(type) ?? ''),
    },
    ...overrides,
  } as unknown as React.DragEvent;
}

function baseOpts() {
  return {
    nodePath: 'root.child',
    isLeaf: true,
    mappingId: undefined as string | undefined,
    onDrop: vi.fn(),
    onReorderField: vi.fn(),
    onRemapDrop: vi.fn(),
    onTargetFieldDragStart: vi.fn(),
    onTargetFieldDragEnd: vi.fn(),
    onRemapDragStart: vi.fn(),
    onRemapDragEnd: vi.fn(),
    getDraggedTargetFieldPath: vi.fn(() => null),
    getDraggedSource: vi.fn(() => null),
    getDraggedRemapId: vi.fn(() => null),
  };
}

describe('useTargetNodeDnD', () => {
  it('returns initial state with no drag over', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    expect(result.current.dragOver).toBe(false);
    expect(result.current.canDrag).toBe(true);
    expect(result.current.canRemapDrag).toBe(false);
  });

  it('canRemapDrag is true when leaf has mapping and onRemapDrop', () => {
    const opts = { ...baseOpts(), mappingId: 'map-1' };
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    expect(result.current.canRemapDrag).toBe(true);
  });

  it('canDrag is false for non-leaf without reorder', () => {
    const opts = { ...baseOpts(), isLeaf: false, onReorderField: undefined };
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    expect(result.current.canDrag).toBe(false);
  });

  it('handleNodeDragStart fires field drag for leaf with reorder', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleNodeDragStart(e); });
    expect(opts.onTargetFieldDragStart).toHaveBeenCalledWith('root.child');
    expect(e.dataTransfer.setData).toHaveBeenCalled();
  });

  it('handleNodeDragStart fires remap drag for leaf with mapping and no reorder', () => {
    const opts = { ...baseOpts(), mappingId: 'map-1', onReorderField: undefined };
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleNodeDragStart(e); });
    expect(opts.onRemapDragStart).toHaveBeenCalledWith('map-1');
  });

  it('handleNodeDragEnd calls both end callbacks', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    act(() => { result.current.handleNodeDragEnd(); });
    expect(opts.onTargetFieldDragEnd).toHaveBeenCalled();
    expect(opts.onRemapDragEnd).toHaveBeenCalled();
  });

  it('handleDragOver sets dragOver and prevents default', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleDragOver(e); });
    expect(result.current.dragOver).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('handleDragOver skips when nodePath is empty', () => {
    const opts = { ...baseOpts(), nodePath: '' };
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleDragOver(e); });
    expect(result.current.dragOver).toBe(false);
  });

  it('handleDragEnter sets dragOver true', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleDragEnter(e); });
    expect(result.current.dragOver).toBe(true);
  });

  it('handleDragLeave sets dragOver false', () => {
    const opts = baseOpts();
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    act(() => { result.current.handleDragOver(makeDragEvent()); });
    expect(result.current.dragOver).toBe(true);
    act(() => { result.current.handleDragLeave(); });
    expect(result.current.dragOver).toBe(false);
  });

  it('handleDrop with source data calls onDrop', () => {
    const opts = baseOpts();
    opts.getDraggedSource.mockReturnValue({ path: '$.body.x', sourceId: 's1' });
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleDrop(e); });
    expect(opts.onDrop).toHaveBeenCalledWith('root.child', '$.body.x', 's1');
    expect(result.current.dragOver).toBe(false);
  });

  it('handleDrop with target-field data calls onReorderField', () => {
    const opts = baseOpts();
    const payload = JSON.stringify({ kind: 'target-field', path: 'root.other' });
    const e = makeDragEvent();
    (e.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
      if (type === 'application/mapper-target-field') return payload;
      return '';
    });
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    act(() => { result.current.handleDrop(e); });
    expect(opts.onReorderField).toHaveBeenCalledWith('root.other', 'root.child');
  });

  it('handleDrop with remap data calls onRemapDrop', () => {
    const opts = { ...baseOpts(), onReorderField: undefined, mappingId: 'map-1' };
    const payload = JSON.stringify({ kind: 'remap', mappingId: 'map-99' });
    const e = makeDragEvent();
    (e.dataTransfer.getData as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
      if (type === 'application/mapper-remap') return payload;
      return '';
    });
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    act(() => { result.current.handleDrop(e); });
    expect(opts.onRemapDrop).toHaveBeenCalledWith('root.child', 'map-99');
  });

  it('handleDrop does nothing when nodePath is empty', () => {
    const opts = { ...baseOpts(), nodePath: '' };
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleDrop(e); });
    expect(opts.onDrop).not.toHaveBeenCalled();
    expect(opts.onReorderField).not.toHaveBeenCalled();
  });

  it('handleDrop uses fallback getDraggedTargetFieldPath when no data transfer', () => {
    const opts = baseOpts();
    opts.getDraggedTargetFieldPath.mockReturnValue('root.from');
    const e = makeDragEvent();
    (e.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    act(() => { result.current.handleDrop(e); });
    expect(opts.onReorderField).toHaveBeenCalledWith('root.from', 'root.child');
  });

  it('handleDrop uses fallback getDraggedRemapId when no data transfer', () => {
    const opts = { ...baseOpts(), onReorderField: undefined, mappingId: 'map-1' };
    opts.getDraggedRemapId.mockReturnValue('remap-fallback');
    const e = makeDragEvent();
    (e.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('');
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    act(() => { result.current.handleDrop(e); });
    expect(opts.onRemapDrop).toHaveBeenCalledWith('root.child', 'remap-fallback');
  });

  it('handleDragOver sets move effect when remap drag active', () => {
    const opts = baseOpts();
    opts.getDraggedRemapId.mockReturnValue('remap-x');
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleDragOver(e); });
    expect(e.dataTransfer.dropEffect).toBe('move');
  });

  it('handleDragOver sets link effect when source drag active', () => {
    const opts = baseOpts();
    opts.getDraggedSource.mockReturnValue({ path: 'a', sourceId: 'b' });
    const { result } = renderHook(() => useTargetNodeDnD(opts));
    const e = makeDragEvent();
    act(() => { result.current.handleDragOver(e); });
    expect(e.dataTransfer.dropEffect).toBe('link');
  });
});
