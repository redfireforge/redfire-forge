/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMapperState } from './useMapperState';
import type { Mapping } from '../types';

function makeMappings(n: number): Mapping[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    sourcePath: `src${i}`,
    sourceId: 's1',
    targetPath: `tgt${i}`,
  }));
}

describe('useMapperState', () => {
  it('starts with empty mappings', () => {
    const { result } = renderHook(() => useMapperState());
    expect(result.current.state.mappings).toEqual([]);
    expect(result.current.state.selectedMappingId).toBeNull();
  });

  it('starts with initial mappings', () => {
    const initial = makeMappings(2);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    expect(result.current.state.mappings).toHaveLength(2);
  });

  it('adds a mapping', () => {
    const { result } = renderHook(() => useMapperState());
    const m: Mapping = { id: '1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' };
    act(() => result.current.addMapping(m));
    expect(result.current.state.mappings).toHaveLength(1);
    expect(result.current.state.mappings[0].id).toBe('1');
  });

  it('removes a mapping', () => {
    const initial = makeMappings(3);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.removeMapping('m1'));
    expect(result.current.state.mappings).toHaveLength(2);
    expect(result.current.state.mappings.find((m) => m.id === 'm1')).toBeUndefined();
  });

  it('clears selected when removing the selected mapping', () => {
    const initial = makeMappings(2);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.selectMapping('m0'));
    expect(result.current.state.selectedMappingId).toBe('m0');
    act(() => result.current.removeMapping('m0'));
    expect(result.current.state.selectedMappingId).toBeNull();
  });

  it('updates a mapping', () => {
    const initial = makeMappings(1);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.updateMapping('m0', { expression: 'toUpper()' }));
    expect(result.current.state.mappings[0].expression).toBe('toUpper()');
    expect(result.current.state.mappings[0].sourcePath).toBe('src0');
  });

  it('sets all mappings', () => {
    const { result } = renderHook(() => useMapperState());
    const newMappings = makeMappings(5);
    act(() => result.current.setMappings(newMappings));
    expect(result.current.state.mappings).toHaveLength(5);
  });

  it('clears all mappings', () => {
    const initial = makeMappings(3);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.clearAll());
    expect(result.current.state.mappings).toEqual([]);
  });

  it('selects a mapping', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.selectMapping('m1'));
    expect(result.current.state.selectedMappingId).toBe('m1');
    act(() => result.current.selectMapping(null));
    expect(result.current.state.selectedMappingId).toBeNull();
  });

  it('sets active source', () => {
    const { result } = renderHook(() => useMapperState({ initialSourceId: 's1' }));
    expect(result.current.state.activeSourceId).toBe('s1');
    act(() => result.current.setActiveSource('s2'));
    expect(result.current.state.activeSourceId).toBe('s2');
  });
});

describe('useMapperState – undo/redo', () => {
  it('starts with no undo/redo', () => {
    const { result } = renderHook(() => useMapperState());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('can undo after adding a mapping', () => {
    const { result } = renderHook(() => useMapperState());
    const m: Mapping = { id: '1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' };
    act(() => result.current.addMapping(m));
    expect(result.current.state.mappings).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.state.mappings).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);
  });

  it('can redo after undo', () => {
    const { result } = renderHook(() => useMapperState());
    const m: Mapping = { id: '1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' };
    act(() => result.current.addMapping(m));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.state.mappings).toHaveLength(1);
  });

  it('redo stack is cleared on new action', () => {
    const { result } = renderHook(() => useMapperState());
    const m1: Mapping = { id: '1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' };
    const m2: Mapping = { id: '2', sourcePath: 'c', sourceId: 's1', targetPath: 'd' };
    act(() => result.current.addMapping(m1));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.addMapping(m2));
    expect(result.current.canRedo).toBe(false);
  });

  it('selection changes do not add to undo stack', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.selectMapping('x'));
    expect(result.current.canUndo).toBe(false);
  });

  it('handles multiple undo/redo steps', () => {
    const { result } = renderHook(() => useMapperState());
    const m1: Mapping = { id: '1', sourcePath: 'a', sourceId: 's1', targetPath: 'b' };
    const m2: Mapping = { id: '2', sourcePath: 'c', sourceId: 's1', targetPath: 'd' };
    act(() => result.current.addMapping(m1));
    act(() => result.current.addMapping(m2));
    expect(result.current.state.mappings).toHaveLength(2);

    act(() => result.current.undo());
    expect(result.current.state.mappings).toHaveLength(1);

    act(() => result.current.undo());
    expect(result.current.state.mappings).toHaveLength(0);

    act(() => result.current.redo());
    expect(result.current.state.mappings).toHaveLength(1);

    act(() => result.current.redo());
    expect(result.current.state.mappings).toHaveLength(2);
  });

  it('undo is no-op when stack is empty', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.undo());
    expect(result.current.state.mappings).toEqual([]);
  });

  it('redo is no-op when stack is empty', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.redo());
    expect(result.current.state.mappings).toEqual([]);
  });
});

describe('useMapperState – edge cases', () => {
  it('remove non-existent id is a no-op', () => {
    const initial = makeMappings(2);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.removeMapping('does-not-exist'));
    expect(result.current.state.mappings).toHaveLength(2);
  });

  it('update non-existent id is a no-op', () => {
    const initial = makeMappings(1);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.updateMapping('does-not-exist', { expression: 'x' }));
    expect(result.current.state.mappings[0].expression).toBeUndefined();
  });

  it('setMappings clears selectedMappingId', () => {
    const initial = makeMappings(2);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.selectMapping('m0'));
    expect(result.current.state.selectedMappingId).toBe('m0');
    act(() => result.current.setMappings(makeMappings(3)));
    expect(result.current.state.selectedMappingId).toBeNull();
  });

  it('clearAll clears selectedMappingId', () => {
    const initial = makeMappings(2);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.selectMapping('m1'));
    act(() => result.current.clearAll());
    expect(result.current.state.selectedMappingId).toBeNull();
    expect(result.current.state.mappings).toEqual([]);
  });

  it('undo stack is pruned at MAX_UNDO (50)', () => {
    const { result } = renderHook(() => useMapperState());
    for (let i = 0; i < 55; i++) {
      act(() => result.current.addMapping({
        id: `m${i}`, sourcePath: `s${i}`, sourceId: 's1', targetPath: `t${i}`,
      }));
    }
    expect(result.current.state.mappings).toHaveLength(55);
    let undoCount = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      undoCount++;
      if (undoCount > 60) break;
    }
    expect(undoCount).toBeLessThanOrEqual(50);
  });

  it('undo after clearAll restores mappings', () => {
    const initial = makeMappings(3);
    const { result } = renderHook(() => useMapperState({ initialMappings: initial }));
    act(() => result.current.addMapping({
      id: 'extra', sourcePath: 'x', sourceId: 's1', targetPath: 'y',
    }));
    act(() => result.current.clearAll());
    expect(result.current.state.mappings).toEqual([]);
    act(() => result.current.undo());
    expect(result.current.state.mappings).toHaveLength(4);
  });
});

describe('pending accept/reject', () => {
  it('acceptPending removes isPending flag from a mapping', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({
      id: 'p1', sourcePath: 'a', sourceId: 's1', targetPath: 'b', isPending: true,
    }));
    expect(result.current.hasPending).toBe(true);
    act(() => result.current.acceptPending('p1'));
    expect(result.current.state.mappings[0].isPending).toBe(false);
    expect(result.current.hasPending).toBe(false);
  });

  it('rejectPending removes the mapping entirely', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({
      id: 'p1', sourcePath: 'a', sourceId: 's1', targetPath: 'b', isPending: true,
    }));
    act(() => result.current.rejectPending('p1'));
    expect(result.current.state.mappings).toHaveLength(0);
  });

  it('rejectPending clears selection when rejected mapping was selected', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({
      id: 'p1', sourcePath: 'a', sourceId: 's1', targetPath: 'b', isPending: true,
    }));
    act(() => result.current.selectMapping('p1'));
    expect(result.current.state.selectedMappingId).toBe('p1');
    act(() => result.current.rejectPending('p1'));
    expect(result.current.state.selectedMappingId).toBeNull();
  });

  it('acceptAllPending accepts all pending mappings', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({
      id: 'p1', sourcePath: 'a', sourceId: 's1', targetPath: 'b', isPending: true,
    }));
    act(() => result.current.addMapping({
      id: 'p2', sourcePath: 'c', sourceId: 's1', targetPath: 'd', isPending: true,
    }));
    act(() => result.current.addMapping({
      id: 'n1', sourcePath: 'e', sourceId: 's1', targetPath: 'f',
    }));
    act(() => result.current.acceptAllPending());
    expect(result.current.state.mappings).toHaveLength(3);
    expect(result.current.state.mappings.every((m) => !m.isPending)).toBe(true);
  });

  it('rejectAllPending removes only pending mappings', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({
      id: 'p1', sourcePath: 'a', sourceId: 's1', targetPath: 'b', isPending: true,
    }));
    act(() => result.current.addMapping({
      id: 'n1', sourcePath: 'c', sourceId: 's1', targetPath: 'd',
    }));
    act(() => result.current.rejectAllPending());
    expect(result.current.state.mappings).toHaveLength(1);
    expect(result.current.state.mappings[0].id).toBe('n1');
  });

  it('removeMappings removes multiple mappings at once', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({ id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'x' }));
    act(() => result.current.addMapping({ id: 'm2', sourcePath: 'b', sourceId: 's1', targetPath: 'y' }));
    act(() => result.current.addMapping({ id: 'm3', sourcePath: 'c', sourceId: 's1', targetPath: 'z' }));
    expect(result.current.state.mappings).toHaveLength(3);

    act(() => result.current.removeMappings(['m1', 'm3']));
    expect(result.current.state.mappings).toHaveLength(1);
    expect(result.current.state.mappings[0].id).toBe('m2');
  });

  it('removeMappings clears selectedMappingId if removed', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({ id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'x' }));
    act(() => result.current.addMapping({ id: 'm2', sourcePath: 'b', sourceId: 's1', targetPath: 'y' }));
    act(() => result.current.selectMapping('m1'));
    expect(result.current.state.selectedMappingId).toBe('m1');

    act(() => result.current.removeMappings(['m1']));
    expect(result.current.state.selectedMappingId).toBeNull();
  });

  it('removeMappings is undoable', () => {
    const { result } = renderHook(() => useMapperState());
    act(() => result.current.addMapping({ id: 'm1', sourcePath: 'a', sourceId: 's1', targetPath: 'x' }));
    act(() => result.current.addMapping({ id: 'm2', sourcePath: 'b', sourceId: 's1', targetPath: 'y' }));
    act(() => result.current.removeMappings(['m1', 'm2']));
    expect(result.current.state.mappings).toHaveLength(0);

    act(() => result.current.undo());
    expect(result.current.state.mappings).toHaveLength(2);
  });
});
