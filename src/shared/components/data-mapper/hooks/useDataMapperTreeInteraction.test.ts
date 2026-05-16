/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { LineFocusNode } from './useDataMapperTreeInteraction';
import { useDataMapperTreeInteraction } from './useDataMapperTreeInteraction';

function defaultDeps() {
  return {
    setFocusRegion: vi.fn(),
    setFocusedPath: vi.fn(),
    rawHandleTreeKeyDown: vi.fn(),
    showMappingLines: false,
    nodeFocusMode: true,
    setLineFocusNode: vi.fn(),
  };
}

function mountPanels() {
  const wrap = document.createElement('div');

  const sourcePanel = document.createElement('div');
  sourcePanel.className = 'dm-panel--source';
  const sourceNode = document.createElement('div');
  sourceNode.className = 'dm-tree-node';
  sourceNode.setAttribute('data-path', '$.source.field');
  sourcePanel.appendChild(sourceNode);

  const fillerSource = document.createElement('div');
  fillerSource.className = 'dm-tree-gap';
  sourcePanel.appendChild(fillerSource);

  const targetPanel = document.createElement('div');
  targetPanel.className = 'dm-panel--target';
  const targetNode = document.createElement('div');
  targetNode.className = 'dm-tree-node';
  targetNode.setAttribute('data-path', '$.target.field');
  targetPanel.appendChild(targetNode);

  const fillerTarget = document.createElement('div');
  fillerTarget.className = 'dm-tree-gap';
  targetPanel.appendChild(fillerTarget);

  wrap.appendChild(sourcePanel);
  wrap.appendChild(targetPanel);
  document.body.appendChild(wrap);

  return {
    wrap,
    sourcePanel,
    targetPanel,
    sourceNode,
    targetNode,
    fillerSource,
    fillerTarget,
    cleanup: () => wrap.remove(),
  };
}

function syntheticMouse(target: EventTarget): React.MouseEvent<HTMLDivElement> {
  return { target } as unknown as React.MouseEvent<HTMLDivElement>;
}

describe('useDataMapperTreeInteraction', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('starts with null hover state', () => {
    const deps = defaultDeps();
    const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

    expect(result.current.hoveredNodePath).toBeNull();
    expect(result.current.hoveredNodeRegion).toBeNull();
  });

  describe('clearHover', () => {
    it('clears hoveredNodePath and hoveredNodeRegion', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(sourceNode.firstChild ?? sourceNode));
      });
      expect(result.current.hoveredNodePath).toBe('$.source.field');
      expect(result.current.hoveredNodeRegion).toBe('source');

      act(() => {
        result.current.clearHover();
      });
      expect(result.current.hoveredNodePath).toBeNull();
      expect(result.current.hoveredNodeRegion).toBeNull();

      cleanup();
    });
  });

  describe('handleTreeNodeHover', () => {
    it('sets hover on source tree node', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(sourceNode));
      });

      expect(result.current.hoveredNodePath).toBe('$.source.field');
      expect(result.current.hoveredNodeRegion).toBe('source');

      cleanup();
    });

    it('sets hover on target tree node', () => {
      const deps = defaultDeps();
      const { targetNode, cleanup } = mountPanels();
      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(targetNode));
      });

      expect(result.current.hoveredNodePath).toBe('$.target.field');
      expect(result.current.hoveredNodeRegion).toBe('target');

      cleanup();
    });

    it('clears hover when moving over non-node area', () => {
      const deps = defaultDeps();
      const { sourceNode, fillerSource, cleanup } = mountPanels();
      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(sourceNode));
      });
      expect(result.current.hoveredNodePath).toBeTruthy();

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(fillerSource));
      });
      expect(result.current.hoveredNodePath).toBeNull();
      expect(result.current.hoveredNodeRegion).toBeNull();

      cleanup();
    });

    it('returns early without updating hover when tree node has no resolvable panel region', () => {
      const deps = defaultDeps();
      const orphan = document.createElement('div');
      orphan.className = 'dm-tree-node';
      orphan.setAttribute('data-path', '$.orphan');
      document.body.appendChild(orphan);

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(orphan));
      });

      expect(result.current.hoveredNodePath).toBeNull();
      expect(result.current.hoveredNodeRegion).toBeNull();

      orphan.remove();
    });

    it('returns early when data-path resolves to null via getAttribute override', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      vi.spyOn(sourceNode, 'getAttribute').mockImplementation((qualifiedName) =>
        qualifiedName === 'data-path' ? null : HTMLElement.prototype.getAttribute.call(sourceNode, qualifiedName),
      );

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(sourceNode));
      });

      expect(result.current.hoveredNodePath).toBeNull();
      cleanup();
    });

    it('handles target missing closest (optional chaining)', () => {
      const deps = defaultDeps();
      const bare = document.createElement('span');
      delete (bare as unknown as { closest?: typeof bare.closest }).closest;

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(bare));
      });

      expect(result.current.hoveredNodePath).toBeNull();
      expect(result.current.hoveredNodeRegion).toBeNull();
    });
  });

  describe('handleBodyMouseLeave', () => {
    it('clears hover state', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(sourceNode));
      });
      expect(result.current.hoveredNodePath).toBeTruthy();

      act(() => {
        result.current.handleBodyMouseLeave();
      });
      expect(result.current.hoveredNodePath).toBeNull();
      expect(result.current.hoveredNodeRegion).toBeNull();

      cleanup();
    });
  });

  describe('handleTreeNodeClickForKeyboard', () => {
    it('focuses source node and updates keyboard region/path', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      const focusSpy = vi.spyOn(sourceNode, 'focus').mockImplementation(() => {});

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForKeyboard(syntheticMouse(sourceNode));
      });

      expect(deps.setFocusRegion).toHaveBeenCalledWith('source');
      expect(deps.setFocusedPath).toHaveBeenCalledWith('$.source.field');
      expect(sourceNode.getAttribute('tabindex')).toBe('0');
      expect(focusSpy).toHaveBeenCalledTimes(1);

      cleanup();
      focusSpy.mockRestore();
    });

    it('focuses target node and updates keyboard region/path', () => {
      const deps = defaultDeps();
      const { targetNode, cleanup } = mountPanels();
      vi.spyOn(targetNode, 'focus').mockImplementation(() => {});

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForKeyboard(syntheticMouse(targetNode));
      });

      expect(deps.setFocusRegion).toHaveBeenCalledWith('target');
      expect(deps.setFocusedPath).toHaveBeenCalledWith('$.target.field');

      cleanup();
    });

    it('skips when click target is inside interactive element', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      const btn = document.createElement('button');
      btn.textContent = 'Expand';
      sourceNode.appendChild(btn);

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForKeyboard(syntheticMouse(btn));
      });

      expect(deps.setFocusRegion).not.toHaveBeenCalled();
      expect(deps.setFocusedPath).not.toHaveBeenCalled();

      cleanup();
    });

    it('returns early when closest tree node cannot be resolved', () => {
      const deps = defaultDeps();
      const { fillerSource, cleanup } = mountPanels();
      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForKeyboard(syntheticMouse(fillerSource));
      });

      expect(deps.setFocusRegion).not.toHaveBeenCalled();
      cleanup();
    });

    it('returns early when target has no closest method', () => {
      const deps = defaultDeps();
      const bare = document.createElement('span');
      delete (bare as unknown as { closest?: typeof bare.closest }).closest;

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForKeyboard(syntheticMouse(bare));
      });

      expect(deps.setFocusRegion).not.toHaveBeenCalled();
    });

    it('returns early when data-path attribute resolves to null', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      vi.spyOn(sourceNode, 'getAttribute').mockImplementation((qualifiedName) =>
        qualifiedName === 'data-path' ? null : HTMLElement.prototype.getAttribute.call(sourceNode, qualifiedName),
      );

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForKeyboard(syntheticMouse(sourceNode));
      });

      expect(deps.setFocusRegion).not.toHaveBeenCalled();
      cleanup();
    });

    it('returns early when tree node is not inside source/target panel', () => {
      const deps = defaultDeps();
      const orphan = document.createElement('div');
      orphan.className = 'dm-tree-node';
      orphan.setAttribute('data-path', '$.x');
      document.body.appendChild(orphan);

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForKeyboard(syntheticMouse(orphan));
      });

      expect(deps.setFocusRegion).not.toHaveBeenCalled();

      orphan.remove();
    });
  });

  describe('handleTreeNodeClickForLineFocus', () => {
    it('does nothing when showMappingLines is true', () => {
      const deps = defaultDeps();
      deps.showMappingLines = true;
      const { sourceNode, cleanup } = mountPanels();

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(sourceNode));
      });

      expect(deps.setLineFocusNode).not.toHaveBeenCalled();
      cleanup();
    });

    it('does nothing when nodeFocusMode is false', () => {
      const deps = defaultDeps();
      deps.nodeFocusMode = false;
      const { sourceNode, cleanup } = mountPanels();

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(sourceNode));
      });

      expect(deps.setLineFocusNode).not.toHaveBeenCalled();
      cleanup();
    });

    it('skips interactive controls inside tree node', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      const input = document.createElement('input');
      sourceNode.appendChild(input);

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(input));
      });

      expect(deps.setLineFocusNode).not.toHaveBeenCalled();
      cleanup();
    });

    it('sets line focus node on source panel click', () => {
      const deps = defaultDeps();
      const setLineFocusNode = vi.fn((updater: React.SetStateAction<LineFocusNode>) => {
        if (typeof updater === 'function') {
          updater(null);
        }
      });
      const { sourceNode, cleanup } = mountPanels();

      const { result } = renderHook(() =>
        useDataMapperTreeInteraction({ ...deps, setLineFocusNode }),
      );

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(sourceNode));
      });

      expect(setLineFocusNode).toHaveBeenCalledTimes(1);
      const updater = setLineFocusNode.mock.calls[0][0] as (prev: LineFocusNode) => LineFocusNode;
      expect(updater(null)).toEqual({ region: 'source', path: '$.source.field' });

      cleanup();
    });

    it('toggles line focus off when clicking the same node again', () => {
      const deps = defaultDeps();
      const prev: LineFocusNode = { region: 'source', path: '$.source.field' };
      const setLineFocusNode = vi.fn((updater: React.SetStateAction<LineFocusNode>) => {
        if (typeof updater === 'function') {
          updater(prev);
        }
      });
      const { sourceNode, cleanup } = mountPanels();

      const { result } = renderHook(() =>
        useDataMapperTreeInteraction({ ...deps, setLineFocusNode }),
      );

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(sourceNode));
      });

      const updater = setLineFocusNode.mock.calls[0][0] as (p: LineFocusNode) => LineFocusNode;
      expect(updater(prev)).toBeNull();

      cleanup();
    });

    it('updates line focus when clicking a different node', () => {
      const deps = defaultDeps();
      const prev: LineFocusNode = { region: 'source', path: '$.other' };
      const setLineFocusNode = vi.fn((updater: React.SetStateAction<LineFocusNode>) => {
        if (typeof updater === 'function') {
          updater(prev);
        }
      });
      const { sourceNode, cleanup } = mountPanels();

      const { result } = renderHook(() =>
        useDataMapperTreeInteraction({ ...deps, setLineFocusNode }),
      );

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(sourceNode));
      });

      const updater = setLineFocusNode.mock.calls[0][0] as (p: LineFocusNode) => LineFocusNode;
      expect(updater(prev)).toEqual({ region: 'source', path: '$.source.field' });

      cleanup();
    });

    it('returns early when click is outside tree node', () => {
      const deps = defaultDeps();
      const { fillerTarget, cleanup } = mountPanels();

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(fillerTarget));
      });

      expect(deps.setLineFocusNode).not.toHaveBeenCalled();
      cleanup();
    });

    it('returns early when line-focus tree node lacks data-path value', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      vi.spyOn(sourceNode, 'getAttribute').mockImplementation((qualifiedName) =>
        qualifiedName === 'data-path' ? null : HTMLElement.prototype.getAttribute.call(sourceNode, qualifiedName),
      );

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(sourceNode));
      });

      expect(deps.setLineFocusNode).not.toHaveBeenCalled();
      cleanup();
    });

    it('returns early when tree node is not under source or target panel', () => {
      const deps = defaultDeps();
      const orphan = document.createElement('div');
      orphan.className = 'dm-tree-node';
      orphan.setAttribute('data-path', '$.orphan');
      document.body.appendChild(orphan);

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(orphan));
      });

      expect(deps.setLineFocusNode).not.toHaveBeenCalled();

      orphan.remove();
    });

    it('classifies target panel region via dm-panel--target', () => {
      const deps = defaultDeps();
      const setLineFocusNode = vi.fn((updater: React.SetStateAction<LineFocusNode>) => {
        if (typeof updater === 'function') {
          updater(null);
        }
      });
      const { targetNode, cleanup } = mountPanels();

      const { result } = renderHook(() =>
        useDataMapperTreeInteraction({ ...deps, setLineFocusNode }),
      );

      act(() => {
        result.current.handleTreeNodeClickForLineFocus(syntheticMouse(targetNode));
      });

      const updater = setLineFocusNode.mock.calls[0][0] as (prev: LineFocusNode) => LineFocusNode;
      expect(updater(null)).toEqual({ region: 'target', path: '$.target.field' });

      cleanup();
    });
  });

  describe('handleTreeKeyDown', () => {
    it('clears hover then delegates to rawHandleTreeKeyDown', () => {
      const deps = defaultDeps();
      const { sourceNode, cleanup } = mountPanels();
      const expandedPaths = new Set<string>(['__root__']);
      const onToggle = vi.fn();
      const keyEv = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

      const { result } = renderHook(() => useDataMapperTreeInteraction(deps));

      act(() => {
        result.current.handleTreeNodeHover(syntheticMouse(sourceNode));
      });
      expect(result.current.hoveredNodePath).toBeTruthy();

      act(() => {
        result.current.handleTreeKeyDown(keyEv, 'source', expandedPaths, onToggle);
      });

      expect(result.current.hoveredNodePath).toBeNull();
      expect(result.current.hoveredNodeRegion).toBeNull();
      expect(deps.rawHandleTreeKeyDown).toHaveBeenCalledWith(keyEv, 'source', expandedPaths, onToggle);

      cleanup();
    });
  });
});
