/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import { useMapperKeyboard } from './useMapperKeyboard';

function buildDefaultArgs(overrides: Partial<Parameters<typeof useMapperKeyboard>[0]> = {}) {
  const undo = vi.fn();
  const redo = vi.fn();
  const removeMapping = vi.fn();
  const removeMappings = vi.fn();
  const selectMapping = vi.fn();
  const setSelectedIds = vi.fn();
  const sourceSearchRef: RefObject<HTMLInputElement | null> = {
    current: { focus: vi.fn() } as unknown as HTMLInputElement,
  };

  return {
    args: {
      undo,
      redo,
      selectedMappingId: null as string | null,
      removeMapping,
      removeMappings,
      selectMapping,
      editingMappingId: null as string | null,
      selectedIds: new Set<string>(),
      setSelectedIds,
      sourceSearchRef,
      ...overrides,
    },
    undo,
    redo,
    removeMapping,
    removeMappings,
    selectMapping,
    setSelectedIds,
    sourceSearchRef,
  };
}

function dispatchKeyDown(target: EventTarget, init: KeyboardEventInit) {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
}

describe('useMapperKeyboard', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('Cmd+Z triggers undo on non-editable target', () => {
    const { args, undo, redo } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'z', metaKey: true });
    });

    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).not.toHaveBeenCalled();
  });

  it('Ctrl+Z triggers undo (non-Mac path)', () => {
    const { args, undo } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'z', ctrlKey: true });
    });

    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Shift+Z triggers redo', () => {
    const { args, undo, redo } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    });

    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('Delete with selectedIds calls removeMappings and clears selection', () => {
    const selectedIds = new Set(['m1', 'm2']);
    const { args, removeMapping, removeMappings, setSelectedIds } = buildDefaultArgs({
      selectedIds,
    });
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'Delete' });
    });

    expect(removeMappings).toHaveBeenCalledWith(['m1', 'm2']);
    expect(setSelectedIds).toHaveBeenCalledWith(new Set());
    expect(removeMapping).not.toHaveBeenCalled();
  });

  it('Backspace with selectedIds calls removeMappings and clears selection', () => {
    const selectedIds = new Set(['a']);
    const { args, removeMappings, setSelectedIds } = buildDefaultArgs({ selectedIds });
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'Backspace' });
    });

    expect(removeMappings).toHaveBeenCalledWith(['a']);
    expect(setSelectedIds).toHaveBeenCalledWith(new Set());
  });

  it('Delete with selectedMappingId only calls removeMapping when no multi-select', () => {
    const { args, removeMapping, removeMappings } = buildDefaultArgs({
      selectedMappingId: 'solo',
      selectedIds: new Set<string>(),
    });
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'Delete' });
    });

    expect(removeMapping).toHaveBeenCalledWith('solo');
    expect(removeMappings).not.toHaveBeenCalled();
  });

  it('Escape with selectedMappingId clears selection via selectMapping(null)', () => {
    const { args, selectMapping } = buildDefaultArgs({
      selectedMappingId: 'cur',
    });
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'Escape' });
    });

    expect(selectMapping).toHaveBeenCalledWith(null);
  });

  it('/ focuses sourceSearchRef when not editable', () => {
    const { args, sourceSearchRef } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: '/' });
    });

    expect(sourceSearchRef.current?.focus).toHaveBeenCalledTimes(1);
  });

  it('does not focus search when / is pressed on an editable target', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const { args, sourceSearchRef } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(input, { key: '/' });
    });

    expect(sourceSearchRef.current?.focus).not.toHaveBeenCalled();
  });

  it('does not handle shortcuts when editingMappingId is set', () => {
    const { args, undo, redo, removeMapping, selectMapping, sourceSearchRef } = buildDefaultArgs({
      editingMappingId: 'edit-1',
      selectedMappingId: 'm',
      selectedIds: new Set(['x']),
    });
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'z', metaKey: true });
      dispatchKeyDown(window, { key: 'Delete' });
      dispatchKeyDown(window, { key: 'Escape' });
      dispatchKeyDown(window, { key: '/' });
    });

    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    expect(removeMapping).not.toHaveBeenCalled();
    expect(selectMapping).not.toHaveBeenCalled();
    expect(sourceSearchRef.current?.focus).not.toHaveBeenCalled();
  });

  it('does not focus search when / is pressed with Meta or Ctrl', () => {
    const { args, sourceSearchRef } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: '/', metaKey: true });
      dispatchKeyDown(window, { key: '/', ctrlKey: true });
    });

    expect(sourceSearchRef.current?.focus).not.toHaveBeenCalled();
  });

  it('returns early for INPUT target', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const { args, undo } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      input.focus();
      dispatchKeyDown(input, { key: 'z', metaKey: true });
    });

    expect(undo).not.toHaveBeenCalled();
  });

  it('returns early for TEXTAREA target', () => {
    const ta = document.createElement('textarea');
    document.body.append(ta);
    const { args, undo } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      ta.focus();
      dispatchKeyDown(ta, { key: 'z', metaKey: true });
    });

    expect(undo).not.toHaveBeenCalled();
  });

  it('returns early for SELECT target', () => {
    const select = document.createElement('select');
    document.body.append(select);
    const { args, undo } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      select.focus();
      dispatchKeyDown(select, { key: 'Delete' });
    });

    const { removeMapping, removeMappings } = args;
    expect(undo).not.toHaveBeenCalled();
    expect(removeMapping).not.toHaveBeenCalled();
    expect(removeMappings).not.toHaveBeenCalled();
  });

  it('returns early for contentEditable target', () => {
    const div = document.createElement('div');
    document.body.append(div);
    Object.defineProperty(div, 'isContentEditable', {
      configurable: true,
      get: () => true,
    });
    const { args, selectMapping } = buildDefaultArgs({ selectedMappingId: 'keep' });
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(div, { key: 'Escape' });
    });

    expect(selectMapping).not.toHaveBeenCalled();
  });

  it('returns early when .dm-expr-overlay is in the document', () => {
    const overlay = document.createElement('div');
    overlay.className = 'dm-expr-overlay';
    document.body.append(overlay);
    const { args, undo } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'z', metaKey: true });
    });

    expect(undo).not.toHaveBeenCalled();
  });

  it('returns early when .dm-diff-overlay is in the document', () => {
    const overlay = document.createElement('div');
    overlay.className = 'dm-diff-overlay';
    document.body.append(overlay);
    const { args, sourceSearchRef } = buildDefaultArgs();
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: '/' });
    });

    expect(sourceSearchRef.current?.focus).not.toHaveBeenCalled();
  });

  it('Delete is a no-op with no selectedMappingId and empty selectedIds', () => {
    const { args, removeMapping, removeMappings, setSelectedIds } = buildDefaultArgs({
      selectedMappingId: null,
      selectedIds: new Set(),
    });
    renderHook(() => useMapperKeyboard(args));

    act(() => {
      dispatchKeyDown(window, { key: 'Delete' });
    });

    expect(removeMapping).not.toHaveBeenCalled();
    expect(removeMappings).not.toHaveBeenCalled();
    expect(setSelectedIds).not.toHaveBeenCalled();
  });

  it('calls preventDefault for handled shortcuts', () => {
    const { args } = buildDefaultArgs({
      selectedMappingId: 'x',
    });

    renderHook(() => useMapperKeyboard(args));

    let evUndo: KeyboardEvent;
    act(() => {
      evUndo = dispatchKeyDown(window, { key: 'z', metaKey: true });
    });
    expect(evUndo!.defaultPrevented).toBe(true);

    let evDel: KeyboardEvent;
    act(() => {
      evDel = dispatchKeyDown(window, { key: 'Delete' });
    });
    expect(evDel!.defaultPrevented).toBe(true);

    let evEsc: KeyboardEvent;
    act(() => {
      evEsc = dispatchKeyDown(window, { key: 'Escape' });
    });
    expect(evEsc!.defaultPrevented).toBe(true);

    let evSlash: KeyboardEvent;
    act(() => {
      evSlash = dispatchKeyDown(window, { key: '/' });
    });
    expect(evSlash!.defaultPrevented).toBe(true);
  });

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { args } = buildDefaultArgs();
    const { unmount } = renderHook(() => useMapperKeyboard(args));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
