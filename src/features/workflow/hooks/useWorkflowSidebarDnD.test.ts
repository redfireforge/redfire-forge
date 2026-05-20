/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { Workflow, WorkflowFolder } from '../types/workflow';
import { computeDropZone, useWorkflowSidebarDnD } from './useWorkflowSidebarDnD';
import { DropZone } from './useWorkflowSidebarDnD';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkflow(overrides: Partial<Workflow> & { id: string }): Workflow {
  const now = Date.now();
  return {
    name: overrides.id,
    variables: {},
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<WorkflowFolder> & { id: string }): WorkflowFolder {
  return {
    name: overrides.id,
    order: 0,
    ...overrides,
  };
}

function eltWithRect(rect: { top: number; left?: number; width?: number; height: number }) {
  const el = document.createElement('div');
  const w = rect.width ?? 100;
  const h = rect.height;
  el.getBoundingClientRect = () =>
    ({
      top: rect.top,
      left: rect.left ?? 0,
      right: (rect.left ?? 0) + w,
      bottom: rect.top + h,
      width: w,
      height: h,
      x: rect.left ?? 0,
      y: rect.top,
      toJSON: () => '',
    }) as DOMRect;
  return el;
}

function createDragEvent(partial: {
  clientY: number;
  currentTarget?: HTMLElement;
  relatedTarget?: HTMLElement | null;
}): React.DragEvent {
  const dt = {
    effectAllowed: 'uninitialized',
    dropEffect: 'none' as DataTransfer['dropEffect'],
    setData: vi.fn(),
    clearData: vi.fn(),
    getData: vi.fn(),
    types: [] as readonly string[],
    files: {} as unknown as FileList,
    items: {} as unknown as DataTransferItemList,
    clear: vi.fn(),
    setDragImage: vi.fn(),
  };
  return {
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    currentTarget: partial.currentTarget ?? eltWithRect({ top: 0, height: 100 }),
    clientY: partial.clientY,
    clientX: 0,
    relatedTarget: partial.relatedTarget ?? null,
    dataTransfer: dt as unknown as DataTransfer,
    nativeEvent: {} as DragEvent,
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    persist: () => {},
  } as unknown as React.DragEvent;
}

describe('computeDropZone', () => {
  it('zones folder targets into above / inside / below by vertical thirds', () => {
    const el = eltWithRect({ top: 100, height: 100 });
    expect(computeDropZone(createDragEvent({ clientY: 110, currentTarget: el }), 'folder')).toBe('above'); // top 25%
    expect(computeDropZone(createDragEvent({ clientY: 145, currentTarget: el }), 'folder')).toBe('inside'); // middle
    expect(computeDropZone(createDragEvent({ clientY: 185, currentTarget: el }), 'folder')).toBe('below'); // bottom 25%
  });

  it('zones workflow targets into above vs below by midpoint', () => {
    const el = eltWithRect({ top: 0, height: 100 });
    expect(computeDropZone(createDragEvent({ clientY: 40, currentTarget: el }), 'workflow')).toBe('above');
    expect(computeDropZone(createDragEvent({ clientY: 60, currentTarget: el }), 'workflow')).toBe('below');
  });
});

describe('useWorkflowSidebarDnD', () => {
  /** Shared ref mutated in beforeEach — each test attaches the same `<div>` */
  const listRef = React.createRef<HTMLDivElement>();

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    const list = document.createElement('div');
    list.scrollTop = 100;
    list.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 200,
        bottom: 500,
        width: 200,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => '',
      }) as DOMRect;
    document.body.appendChild(list);
    (listRef as React.MutableRefObject<HTMLDivElement | null>).current = list;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function renderDnD(extra?: Partial<Parameters<typeof useWorkflowSidebarDnD>[0]>) {
    const folders: WorkflowFolder[] = [
      makeFolder({ id: 'root-a', order: 0 }),
      makeFolder({ id: 'child-b', parentId: 'root-a', order: 0 }),
      makeFolder({ id: 'sibling-c', parentId: 'root-a', order: 1 }),
    ];
    const workflows: Workflow[] = [
      makeWorkflow({ id: 'w1', folderId: 'root-a', folderOrder: 0 }),
    ];
    const setMultiSelected = vi.fn();
    const props = {
      folders,
      workflows,
      multiSelected: new Set<string>(),
      setMultiSelected,
      listRef,
      ...extra,
    };
    const hook = renderHook(() => useWorkflowSidebarDnD(props));
    return { ...hook, folders, workflows, setMultiSelected, props };
  }

  it('initial state has null dragSource and dropTarget', () => {
    const { result } = renderDnD();
    expect(result.current.dragSource).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it('handleDragStart sets dragSource and configures dataTransfer', () => {
    const { result } = renderDnD();
    const ev = createDragEvent({ clientY: 0 });
    act(() => {
      result.current.handleDragStart(ev, 'workflow', 'w1');
    });
    expect(result.current.dragSource).toEqual({ type: 'workflow', id: 'w1' });
    expect(ev.dataTransfer.effectAllowed).toBe('move');
    expect(ev.dataTransfer.setData).toHaveBeenCalledWith('text/plain', JSON.stringify({ type: 'workflow', id: 'w1' }));
  });

  it('handleDragEnd clears drag state via clearDragState', () => {
    const { result } = renderDnD();
    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'root-a');
    });
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 'sibling-c', zone: 'inside' });
    });
    expect(result.current.dragSource).not.toBeNull();
    act(() => {
      result.current.handleDragEnd();
    });
    expect(result.current.dragSource).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it('getDropClass returns wf-drop-above, wf-drop-below, wf-drop-inside, or empty string', () => {
    const { result } = renderDnD();

    expect(result.current.getDropClass('workflow', 'x')).toBe('');

    act(() => {
      result.current.setDropTarget({ type: 'workflow', id: 'w9', zone: 'above' });
    });
    expect(result.current.getDropClass('workflow', 'w9')).toBe('wf-drop-above');
    act(() => {
      result.current.setDropTarget({ type: 'workflow', id: 'w9', zone: 'below' });
    });
    expect(result.current.getDropClass('workflow', 'w9')).toBe('wf-drop-below');
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 'f1', zone: 'inside' });
    });
    expect(result.current.getDropClass('folder', 'f1')).toBe('wf-drop-inside');

    expect(result.current.getDropClass('workflow', 'f1')).toBe('');
  });

  it('handleDragOver clears dropTarget when dragging folder onto itself', () => {
    const folders = [
      makeFolder({ id: 'f1', order: 0 }),
      makeFolder({ id: 'f2', order: 1 }),
    ];
    const { result } = renderDnD({ folders });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'f1');
    });

    const el = eltWithRect({ top: 0, height: 40 });
    const ev = createDragEvent({ clientY: 25, currentTarget: el });

    act(() => {
      result.current.handleDragOver(ev, 'folder', 'f1');
    });

    expect(ev.dataTransfer.dropEffect).toBe('none');
    expect(result.current.dropTarget).toBeNull();
  });

  it('handleDragOver clears dropTarget when target is descendant of dragged folder', () => {
    const folders = [
      makeFolder({ id: 'parent', order: 0 }),
      makeFolder({ id: 'child', parentId: 'parent', order: 0 }),
    ];
    const { result } = renderDnD({ folders });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'parent');
    });
    const ev = createDragEvent({ clientY: 24, currentTarget: eltWithRect({ top: 0, height: 100 }) });
    act(() => {
      result.current.handleDragOver(ev, 'folder', 'child');
    });
    expect(ev.dataTransfer.dropEffect).toBe('none');
    expect(result.current.dropTarget).toBeNull();
  });

  it('handleDrop calls onMoveWorkflowToFolder with resolved destination', () => {
    const onMoveWorkflowToFolder = vi.fn();
    const workflows = [
      makeWorkflow({ id: 'wf', folderId: 'root-a' }),
    ];
    const { result } = renderDnD({
      workflows,
      onMoveWorkflowToFolder,
    });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'wf');
    });
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 'child-b', zone: 'inside' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });

    expect(onMoveWorkflowToFolder).toHaveBeenCalledWith('wf', 'child-b');
  });

  it('handleDrop uses onMoveWorkflowsToFolder when multiSelected includes source', () => {
    const onMoveWorkflowsToFolder = vi.fn();
    const workflows = [
      makeWorkflow({ id: 'a' }),
      makeWorkflow({ id: 'b' }),
    ];
    const { result } = renderDnD({
      workflows,
      multiSelected: new Set(['a', 'b']),
      onMoveWorkflowsToFolder,
    });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'a');
    });
    act(() => {
      result.current.setDropTarget({ type: 'workflow', id: 'b', zone: 'below' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });

    expect(onMoveWorkflowsToFolder).toHaveBeenCalledWith(['a', 'b'], workflows[1].folderId ?? null);
  });

  it('handleDrop moves folder inside another folder', () => {
    const onMoveFolder = vi.fn();
    const folders = [
      makeFolder({ id: 'tgt', order: 0 }),
      makeFolder({ id: 'mov', order: 1 }),
    ];
    const { result } = renderDnD({
      folders,
      onMoveFolder,
    });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'mov');
    });
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 'tgt', zone: 'inside' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });

    expect(onMoveFolder).toHaveBeenCalledWith('mov', 'tgt', 0);
  });

  it('handleDrop moves folder above sibling (reorder)', () => {
    const onMoveFolder = vi.fn();
    const folders = [
      makeFolder({ id: 'p', order: 0 }),
      makeFolder({ id: 'mov', parentId: 'p', order: 0 }),
      makeFolder({ id: 't', parentId: 'p', order: 1 }),
    ];
    const { result } = renderDnD({ folders, onMoveFolder });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'mov');
    });
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 't', zone: 'above' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });

    const siblingsSorted = folders.filter((f) => (f.parentId ?? null) === 'p' && f.id !== 'mov').sort((a, b) => a.order - b.order);
    const tgtIdx = siblingsSorted.findIndex((f) => f.id === 't');
    expect(onMoveFolder).toHaveBeenCalledWith('mov', 'p', tgtIdx);
  });

  it('handleDrop moves folder onto unfiled zone', () => {
    const onMoveFolder = vi.fn();
    const folders = [
      makeFolder({ id: 'only-root', parentId: undefined, order: 0 }),
      makeFolder({ id: 'nested', parentId: 'only-root', order: 0 }),
    ];
    const { result } = renderDnD({ folders, onMoveFolder });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'nested');
    });
    act(() => {
      result.current.setDropTarget({ type: 'unfiled', id: 'sidebar-unfiled', zone: 'inside' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });

    const rootsExcludingSrc = folders.filter((f) => !f.parentId && f.id !== 'nested');
    expect(onMoveFolder).toHaveBeenCalledWith('nested', null, rootsExcludingSrc.length);
  });

  it('schedule onSetFolderCollapsed when hovering collapsed folder zone inside', () => {
    const onSetFolderCollapsed = vi.fn();
    const workflows = [
      makeWorkflow({ id: 'wf', folderId: 'collapse-me' }),
    ];
    const folders = [
      makeFolder({ id: 'collapse-me', order: 0, collapsed: true }),
    ];

    const { result } = renderDnD({
      folders,
      workflows,
      onSetFolderCollapsed,
    });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'wf');
    });
    const zoneEl = eltWithRect({ top: 0, height: 100 });
    const ev = createDragEvent({ clientY: 55, currentTarget: zoneEl });
    act(() => {
      result.current.handleDragOver(ev, 'folder', 'collapse-me');
    });

    vi.advanceTimersByTime(499);
    expect(onSetFolderCollapsed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onSetFolderCollapsed).toHaveBeenCalledWith('collapse-me', false);
  });

  it('handleDragLeave clears dropTarget when leaving to outside; keeps when moving to child', () => {
    const { result } = renderDnD();
    act(() => {
      result.current.setDropTarget({ type: 'workflow', id: 'w1', zone: 'above' });
    });

    const inner = document.createElement('div');
    const deeper = document.createElement('span');
    inner.appendChild(deeper);
    document.body.appendChild(inner);

    act(() => {
      result.current.handleDragLeave({
        stopPropagation: vi.fn(),
        currentTarget: inner,
        relatedTarget: deeper,
      } as unknown as React.DragEvent);
    });
    expect(result.current.dropTarget).not.toBeNull();

    act(() => {
      result.current.handleDragLeave({
        stopPropagation: vi.fn(),
        currentTarget: inner,
        relatedTarget: null,
      } as unknown as React.DragEvent);
    });
    expect(result.current.dropTarget).toBeNull();
  });

  it('handleDragOver is a no-op when dragSource is null', () => {
    const { result } = renderDnD();
    const ev = createDragEvent({
      clientY: 80,
      currentTarget: eltWithRect({ top: 0, height: 120 }),
    });
    act(() => {
      result.current.handleDragOver(ev, 'workflow', 'w1');
    });
    expect(result.current.dropTarget).toBeNull();
  });

  it('does not attach edge scroll timers when listRef.current is null', () => {
    const nullRef = { current: null as HTMLDivElement | null };
    const onMoveWorkflowToFolder = vi.fn();
    const wf = makeWorkflow({ id: 'solo' });
    const { result } = renderHook(() =>
      useWorkflowSidebarDnD({
        folders: [makeFolder({ id: 'f1', order: 0 })],
        workflows: [wf],
        multiSelected: new Set(),
        setMultiSelected: vi.fn(),
        listRef: nullRef as React.RefObject<HTMLDivElement | null>,
        onMoveWorkflowToFolder,
      }),
    );

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'solo');
    });
    const ev = createDragEvent({ clientY: 80, currentTarget: eltWithRect({ top: 0, height: 40 }) });
    act(() => {
      result.current.handleDragOver(ev, 'folder', 'f1');
    });
    /** list container absent — hover still validates and sets a drop stripe */
    expect(result.current.dropTarget).toEqual(expect.objectContaining({ type: 'folder', id: 'f1' }));
  });

  it('edge scroll adjusts list scrollTop upward near top zone and clears in middle zone', () => {
    const { result } = renderDnD();

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'w1');
    });

    vi.spyOn(listRef.current!, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      bottom: 200,
      right: 200,
      width: 200,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    act(() => {
      result.current.handleDragOver(createDragEvent({ clientY: 14 }), 'folder', 'root-a');
    });
    vi.advanceTimersByTime(32);
    expect(listRef.current!.scrollTop).toBeLessThan(100);

    act(() => {
      result.current.handleDragOver(createDragEvent({ clientY: 100 }), 'folder', 'root-a');
    });
    vi.advanceTimersByTime(20);
    expect(listRef.current!.scrollTop).toBe(92);
  });

  it('edge scroll adjusts scrollTop downward near bottom zone', () => {
    listRef.current!.scrollTop = 0;
    const { result } = renderDnD();
    vi.spyOn(listRef.current!, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      bottom: 80,
      right: 200,
      width: 200,
      height: 80,
      x: 0,
      y: 0,
      toJSON: () => '',
    } as DOMRect);

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'w1');
    });
    act(() => {
      result.current.handleDragOver(createDragEvent({ clientY: 78 }), 'folder', 'child-b');
    });
    vi.advanceTimersByTime(32);
    expect(listRef.current!.scrollTop).toBeGreaterThan(0);
  });

  it('handleDragStart serializes multiIds when dragging one of several selected workflows', () => {
    const setMs = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowSidebarDnD({
        folders: [],
        workflows: [
          makeWorkflow({ id: 'a' }),
          makeWorkflow({ id: 'b' }),
        ],
        multiSelected: new Set(['a', 'b']),
        setMultiSelected: setMs,
        listRef,
      }),
    );
    const ev = createDragEvent({ clientY: 0 });
    act(() => {
      result.current.handleDragStart(ev, 'workflow', 'a');
    });
    expect(setMs).not.toHaveBeenCalled();
    expect(JSON.parse(ev.dataTransfer.setData.mock.calls.find((c) => c[0] === 'text/plain')![1])).toEqual({
      type: 'workflow',
      id: 'a',
      multiIds: expect.arrayContaining(['a', 'b']),
    });
  });

  it('handleDragStart clears multi-select when dragging a workflow not included in bulk selection', () => {
    const setMs = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowSidebarDnD({
        folders: [],
        workflows: [
          makeWorkflow({ id: 'a' }),
          makeWorkflow({ id: 'z' }),
        ],
        multiSelected: new Set(['a', 'b']),
        setMultiSelected: setMs,
        listRef,
      }),
    );
    const ev = createDragEvent({ clientY: 0 });
    act(() => {
      result.current.handleDragStart(ev, 'workflow', 'z');
    });
    expect(setMs).toHaveBeenCalledWith(new Set());
  });

  it('handleDrop with missing dragSource or dropTarget clears state without move callbacks', () => {
    const onMoveWorkflowToFolder = vi.fn();
    const { result } = renderDnD({ onMoveWorkflowToFolder });

    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });
    expect(onMoveWorkflowToFolder).not.toHaveBeenCalled();

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'w1');
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });
    expect(onMoveWorkflowToFolder).not.toHaveBeenCalled();
    expect(result.current.dragSource).toBeNull();
  });

  it('bulk workflow move falls back to onMoveWorkflowToFolder when batch callback absent', () => {
    const onMoveWorkflowToFolder = vi.fn();
    const workflows = [
      makeWorkflow({ id: 'a' }),
      makeWorkflow({ id: 'b' }),
    ];
    const { result } = renderDnD({
      workflows,
      multiSelected: new Set(['a', 'b']),
      onMoveWorkflowToFolder,
    });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'a');
    });
    act(() => {
      result.current.setDropTarget({ type: 'workflow', id: 'b', zone: 'below' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });

    expect(onMoveWorkflowToFolder).toHaveBeenCalledTimes(1);
    expect(onMoveWorkflowToFolder).toHaveBeenCalledWith('a', null);
  });

  it('resolveTargetFolderId covers folder reorder zone, workflows, and fallback null', () => {
    const folders = [
      makeFolder({ id: 'tgt', parentId: 'roots', order: 0 }),
    ];
    const workflows = [
      makeWorkflow({ id: 'wf1', folderId: 'tgt' }),
    ];
    const { result } = renderDnD({ folders, workflows });

    expect(result.current.resolveTargetFolderId('folder', 'tgt', 'inside')).toBe('tgt');
    expect(result.current.resolveTargetFolderId('folder', 'tgt', 'above')).toBe('roots');
    expect(result.current.resolveTargetFolderId('workflow', 'wf1', 'below')).toBe('tgt');
    expect(result.current.resolveTargetFolderId('workflow', 'missing', 'inside')).toBeNull();

    /** Unknown target kinds used by UI resolve to null (e.g. unfiled) */
    expect(result.current.resolveTargetFolderId('unfiled', 'u1', 'inside')).toBeNull();

    /** Folder target missing → null parent resolve */
    const { result: r2 } = renderDnD({ folders: [], workflows });
    expect(r2.current.resolveTargetFolderId('folder', 'nope', 'above')).toBeNull();
  });

  it('folder reorder with zone below uses insertIdx tgtIdx + 1', () => {
    const onMoveFolder = vi.fn();
    const folders = [
      makeFolder({ id: 'p', order: 0 }),
      makeFolder({ id: 'bottom', parentId: 'p', order: 0 }),
      makeFolder({ id: 'middle', parentId: 'p', order: 1 }),
      makeFolder({ id: 'top', parentId: 'p', order: 2 }),
    ];

    const { result } = renderDnD({
      folders,
      onMoveFolder,
    });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'bottom');
    });
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 'middle', zone: 'below' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });

    const siblingsExSrc = folders
      .filter((f) => (f.parentId ?? null) === 'p' && f.id !== 'bottom')
      .sort((a, b) => a.order - b.order);
    const idx = siblingsExSrc.findIndex((f) => f.id === 'middle');
    expect(onMoveFolder).toHaveBeenCalledWith('bottom', 'p', idx + 1);
  });

  it('workflow drop onto target type unfiled resolves folderId null', () => {
    const onMoveWorkflowToFolder = vi.fn();
    const { result } = renderDnD({
      workflows: [
        makeWorkflow({ id: 'mov', folderId: 'child-b' }),
      ],
      onMoveWorkflowToFolder,
    });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'mov');
    });
    act(() => {
      result.current.setDropTarget({ type: 'unfiled', id: 'ghost', zone: 'inside' });
    });
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });
    expect(onMoveWorkflowToFolder).toHaveBeenCalledWith('mov', null);
  });

  it('does not invoke onMoveFolder when folder dragged but handler missing', () => {
    const { result } = renderDnD();
    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'root-a');
    });
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 'child-b', zone: 'inside' });
    });

    /** No throw — handler optional */
    act(() => {
      result.current.handleDrop(createDragEvent({ clientY: 0 }));
    });
    expect(result.current.dragSource).toBeNull();
  });

  it('collapsed-folder auto-expand timer is cleared when leaving inside zone before fire', () => {
    const onSetFolderCollapsed = vi.fn();
    const folders = [makeFolder({ id: 'c', order: 0, collapsed: true })];
    const workflows = [makeWorkflow({ id: 'w', folderId: 'c' })];
    const { result } = renderDnD({ folders, workflows, onSetFolderCollapsed });

    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'workflow', 'w');
    });

    act(() => {
      result.current.handleDragOver(createDragEvent({ clientY: 60, currentTarget: eltWithRect({ top: 0, height: 100 }) }), 'folder', 'c');
    });
    /** Move to sibling row (above stripe) clears timer branch */
    act(() => {
      result.current.handleDragOver(createDragEvent({ clientY: 15, currentTarget: eltWithRect({ top: 0, height: 100 }) }), 'folder', 'root-a');
    });
    vi.advanceTimersByTime(600);
    expect(onSetFolderCollapsed).not.toHaveBeenCalled();
  });

  it('clearDragState is exposed for manual reset', () => {
    const { result } = renderDnD();
    act(() => {
      result.current.handleDragStart(createDragEvent({ clientY: 0 }), 'folder', 'child-b');
    });
    act(() => {
      result.current.clearDragState();
    });
    expect(result.current.dragSource).toBeNull();
  });

  it('getDropClass returns empty for unknown DropZone sentinel', () => {
    const { result } = renderDnD();
    act(() => {
      result.current.setDropTarget({ type: 'folder', id: 'x', zone: 'invalid' as DropZone });
    });
    expect(result.current.getDropClass('folder', 'x')).toBe('');
  });

  it('computeDropZone folder boundary: strictly above 75% height is below stripe', () => {
    const el = eltWithRect({ top: 0, height: 80 }); /* threshold y > 60 → below */
    expect(computeDropZone(createDragEvent({ clientY: 59.999, currentTarget: el }), 'folder')).toBe('inside');
    expect(computeDropZone(createDragEvent({ clientY: 60.001, currentTarget: el }), 'folder')).toBe('below');
  });
});
