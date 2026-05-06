/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo';
import type { Node, Edge } from '@xyflow/react';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  let nodes: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, data: {} }];
  let edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

  return renderHook(() =>
    useUndoRedo(
      () => nodes,
      () => edges,
      (n: Node[]) => { nodes = n; },
      (e: Edge[]) => { edges = e; },
    ),
  );
}

describe('useUndoRedo', () => {
  it('starts with empty undo/redo stacks', () => {
    const { result } = setup();
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(false);
  });

  it('takeSnapshot enables undo', () => {
    const { result } = setup();
    act(() => result.current.takeSnapshot('Add node'));
    expect(result.current.canUndo()).toBe(true);
    expect(result.current.canRedo()).toBe(false);
  });

  it('undo restores previous state and returns label', () => {
    const { result } = setup();
    act(() => result.current.takeSnapshot('Add node'));
    let label: string | null = null;
    act(() => { label = result.current.undo(); });
    expect(label).toBe('Add node');
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(true);
  });

  it('undo returns null when stack is empty', () => {
    const { result } = setup();
    let label: string | null = null;
    act(() => { label = result.current.undo(); });
    expect(label).toBeNull();
  });

  it('redo restores undone state and returns label', () => {
    const { result } = setup();
    act(() => result.current.takeSnapshot('Move node'));
    act(() => { result.current.undo(); });
    let label: string | null = null;
    act(() => { label = result.current.redo(); });
    expect(label).toBe('Move node');
    expect(result.current.canUndo()).toBe(true);
    expect(result.current.canRedo()).toBe(false);
  });

  it('redo returns null when stack is empty', () => {
    const { result } = setup();
    let label: string | null = null;
    act(() => { label = result.current.redo(); });
    expect(label).toBeNull();
  });

  it('takeSnapshot clears redo stack', () => {
    const { result } = setup();
    act(() => result.current.takeSnapshot('First'));
    act(() => { result.current.undo(); });
    expect(result.current.canRedo()).toBe(true);
    act(() => result.current.takeSnapshot('Second'));
    expect(result.current.canRedo()).toBe(false);
  });

  it('clear resets both stacks', () => {
    const { result } = setup();
    act(() => result.current.takeSnapshot('A'));
    act(() => result.current.takeSnapshot('B'));
    act(() => { result.current.undo(); });
    act(() => result.current.clear());
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(false);
  });

  it('respects max undo limit of 50', () => {
    const { result } = setup();
    for (let i = 0; i < 55; i++) {
      act(() => result.current.takeSnapshot(`Snap ${i}`));
    }
    // Should still be able to undo, but only up to 50 times
    let count = 0;
    while (result.current.canUndo()) {
      act(() => { result.current.undo(); });
      count++;
    }
    expect(count).toBe(50);
  });

  it('multiple undo/redo cycle works correctly', () => {
    const { result } = setup();
    act(() => result.current.takeSnapshot('Step 1'));
    act(() => result.current.takeSnapshot('Step 2'));
    act(() => result.current.takeSnapshot('Step 3'));

    // Undo all three
    let label: string | null;
    act(() => { label = result.current.undo(); });
    expect(label!).toBe('Step 3');
    act(() => { label = result.current.undo(); });
    expect(label!).toBe('Step 2');

    // Redo one
    act(() => { label = result.current.redo(); });
    expect(label!).toBe('Step 2');

    // Should still be able to redo one more
    expect(result.current.canRedo()).toBe(true);
    act(() => { label = result.current.redo(); });
    expect(label!).toBe('Step 3');
    expect(result.current.canRedo()).toBe(false);
  });

  it('persists undo stack to localStorage after debounce when workflowId is set', () => {
    vi.useFakeTimers();
    let nodes: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, data: {} }];
    let edges: Edge[] = [];
    const { result, rerender } = renderHook(
      (wfId: string | null) =>
        useUndoRedo(
          () => nodes,
          () => edges,
          (n: Node[]) => { nodes = n; },
          (e: Edge[]) => { edges = e; },
          wfId,
        ),
      { initialProps: 'wf-1' as string | null },
    );
    act(() => result.current.takeSnapshot('snap'));
    act(() => { vi.advanceTimersByTime(600); });
    const raw = localStorage.getItem('perf-test-wf-undo-wf-1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe('snap');
    rerender(null);
    act(() => result.current.takeSnapshot('orphan'));
    act(() => { vi.advanceTimersByTime(600); });
    expect(localStorage.getItem('perf-test-wf-undo-wf-1')).toBeTruthy();
  });

  it('loads persisted stack when workflowId is provided', () => {
    const snap = {
      nodes: [{ id: 'n1', position: { x: 1, y: 2 }, data: {} }],
      edges: [] as Edge[],
      label: 'restored',
    };
    localStorage.setItem('perf-test-wf-undo-wf-load', JSON.stringify([snap]));
    let nodes: Node[] = [{ id: 'x', position: { x: 0, y: 0 }, data: {} }];
    let edges: Edge[] = [];
    const { result } = renderHook(() =>
      useUndoRedo(
        () => nodes,
        () => edges,
        (n: Node[]) => { nodes = n; },
        (e: Edge[]) => { edges = e; },
        'wf-load',
      ),
    );
    expect(result.current.canUndo()).toBe(true);
    act(() => { result.current.undo(); });
    expect(nodes[0]?.id).toBe('n1');
  });

  it('treats invalid persisted JSON as empty stack', () => {
    localStorage.setItem('perf-test-wf-undo-wf-bad', '{not json');
    const { result } = renderHook(() =>
      useUndoRedo(() => [], () => [], () => {}, () => {}, 'wf-bad'),
    );
    expect(result.current.canUndo()).toBe(false);
  });

  it('ignores localStorage setItem failures when persisting', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const { result } = renderHook(() =>
      useUndoRedo(
        () => [{ id: 'a', position: { x: 0, y: 0 }, data: {} }],
        () => [],
        () => {},
        () => {},
        'wf-quota',
      ),
    );
    act(() => result.current.takeSnapshot('x'));
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.canUndo()).toBe(true);
    spy.mockRestore();
  });

  it('clear swallows removeItem errors', () => {
    const { result } = renderHook(() =>
      useUndoRedo(() => [], () => [], () => {}, () => {}, 'wf-rm'),
    );
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('nope'); });
    act(() => result.current.takeSnapshot('a'));
    act(() => { result.current.clear(); });
    expect(result.current.canUndo()).toBe(false);
    spy.mockRestore();
  });

  it('uses structuredClone for deep copies (mutations do not affect snapshots)', () => {
    let nodes: Node[] = [{ id: 'n1', position: { x: 0, y: 0 }, data: { nested: { val: 1 } } }];
    let edges: Edge[] = [];
    const { result } = renderHook(() =>
      useUndoRedo(
        () => nodes,
        () => edges,
        (n: Node[]) => { nodes = n; },
        (e: Edge[]) => { edges = e; },
      ),
    );
    act(() => result.current.takeSnapshot('Before mutation'));
    // Mutate original data
    nodes[0].data.nested.val = 999;
    act(() => { result.current.undo(); });
    // Restored data should have the original value, not the mutated one
    expect(nodes[0].data.nested.val).toBe(1);
  });
});
