/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo';
import type { Node, Edge } from '@xyflow/react';

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
