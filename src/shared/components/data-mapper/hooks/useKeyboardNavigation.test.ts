/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from './useKeyboardNavigation';

function createContainer() {
  const container = document.createElement('div');

  const sourcePanel = document.createElement('div');
  sourcePanel.className = 'dm-panel--source';

  const node1 = document.createElement('div');
  node1.className = 'dm-tree-node';
  node1.setAttribute('data-path', 'name');
  node1.setAttribute('tabindex', '-1');
  node1.focus = function () {
    (this as HTMLElement).setAttribute('tabindex', '0');
  };
  sourcePanel.appendChild(node1);

  const node2 = document.createElement('div');
  node2.className = 'dm-tree-node';
  node2.setAttribute('data-path', 'age');
  node2.setAttribute('tabindex', '-1');
  node2.focus = function () {
    (this as HTMLElement).setAttribute('tabindex', '0');
  };
  sourcePanel.appendChild(node2);

  const targetPanel = document.createElement('div');
  targetPanel.className = 'dm-panel--target';

  const tNode1 = document.createElement('div');
  tNode1.className = 'dm-tree-node';
  tNode1.setAttribute('data-path', 'userName');
  tNode1.setAttribute('tabindex', '-1');
  tNode1.focus = function () {
    (this as HTMLElement).setAttribute('tabindex', '0');
  };
  targetPanel.appendChild(tNode1);

  container.appendChild(sourcePanel);
  container.appendChild(targetPanel);
  document.body.appendChild(container);

  return { container, cleanup: () => document.body.removeChild(container) };
}

describe('useKeyboardNavigation', () => {
  it('initializes with source focus region', () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
    expect(result.current.focusRegion).toBe('source');
    expect(result.current.focusedPath).toBeNull();
  });

  it('setFocusRegion changes region', () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => { result.current.setFocusRegion('target'); });
    expect(result.current.focusRegion).toBe('target');

    act(() => { result.current.setFocusRegion('source'); });
    expect(result.current.focusRegion).toBe('source');
  });

  it('handleTreeKeyDown ArrowDown moves focus to next node', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const expandedPaths = new Set(['__root__']);
    const onToggle = () => {};

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    expect(result.current.focusedPath).toBe('name');

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    expect(result.current.focusedPath).toBe('age');

    cleanup();
  });

  it('handleTreeKeyDown ArrowUp moves focus to previous node', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const expandedPaths = new Set(['__root__']);
    const onToggle = () => {};

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    // Move to second node first
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });
    expect(result.current.focusedPath).toBe('age');

    // Move back up
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowUp', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });
    expect(result.current.focusedPath).toBe('name');

    cleanup();
  });

  it('Home and End keys jump to first and last nodes', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const expandedPaths = new Set(['__root__']);
    const onToggle = () => {};

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'End', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });
    expect(result.current.focusedPath).toBe('age');

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Home', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });
    expect(result.current.focusedPath).toBe('name');

    cleanup();
  });

  it('does nothing when disabled', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref, disabled: true }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });

    expect(result.current.focusedPath).toBeNull();

    cleanup();
  });

  it('no-ops when container has no tree panel', () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(),
        () => {},
      );
    });
    expect(result.current.focusedPath).toBeNull();
  });

  it('no-ops when focusNodeByPath container ref is null', () => {
    const { container, cleanup } = createContainer();
    const ref: { current: HTMLDivElement | null } = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
    act(() => {
      ref.current = null;
      result.current.handleTreeKeyDown(
        { key: 'Home', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });
    ref.current = container;
    cleanup();
  });

  it('Arrow keys no-op when visible node list is empty', () => {
    const container = document.createElement('div');
    const panel = document.createElement('div');
    panel.className = 'dm-panel--source';
    container.appendChild(panel);
    document.body.appendChild(container);
    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(),
        () => {},
      );
    });
    expect(result.current.focusedPath).toBeNull();
    document.body.removeChild(container);
  });

  it('ArrowRight calls onToggle for collapsed nodes', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const expandedPaths = new Set<string>();
    let toggled = '';
    const onToggle = (path: string) => { toggled = path; };

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowRight', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    expect(toggled).toBe('name');

    cleanup();
  });

  it('ArrowLeft calls onToggle for expanded nodes', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const expandedPaths = new Set(['name']);
    let toggled = '';
    const onToggle = (path: string) => { toggled = path; };

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowLeft', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    expect(toggled).toBe('name');
    cleanup();
  });

  it('ArrowRight does not toggle already-expanded nodes', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const expandedPaths = new Set(['name']);
    let toggled = '';
    const onToggle = (path: string) => { toggled = path; };

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowRight', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    expect(toggled).toBe('');
    cleanup();
  });

  it('ArrowRight on root node normalizes empty path to __root__', () => {
    const container = document.createElement('div');
    const sourcePanel = document.createElement('div');
    sourcePanel.className = 'dm-panel--source';
    const rootNode = document.createElement('div');
    rootNode.className = 'dm-tree-node';
    rootNode.setAttribute('data-path', '');
    rootNode.setAttribute('tabindex', '-1');
    rootNode.focus = function () { (this as HTMLElement).setAttribute('tabindex', '0'); };
    sourcePanel.appendChild(rootNode);
    container.appendChild(sourcePanel);
    document.body.appendChild(container);

    const ref = { current: container };
    const expandedPaths = new Set<string>();
    let toggled = '';
    const onToggle = (path: string) => { toggled = path; };

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });
    expect(result.current.focusedPath).toBe('');

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowRight', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    expect(toggled).toBe('__root__');
    document.body.removeChild(container);
  });

  it('ArrowLeft on root node normalizes empty path to __root__', () => {
    const container = document.createElement('div');
    const sourcePanel = document.createElement('div');
    sourcePanel.className = 'dm-panel--source';
    const rootNode = document.createElement('div');
    rootNode.className = 'dm-tree-node';
    rootNode.setAttribute('data-path', '');
    rootNode.setAttribute('tabindex', '-1');
    rootNode.focus = function () { (this as HTMLElement).setAttribute('tabindex', '0'); };
    sourcePanel.appendChild(rootNode);
    container.appendChild(sourcePanel);
    document.body.appendChild(container);

    const ref = { current: container };
    const expandedPaths = new Set(['__root__']);
    let toggled = '';
    const onToggle = (path: string) => { toggled = path; };

    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowLeft', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        expandedPaths,
        onToggle,
      );
    });

    expect(toggled).toBe('__root__');
    document.body.removeChild(container);
  });

  it('Tab cycles focus region from source to target', () => {
    const { container, cleanup } = createContainer();
    const sourceTree = document.createElement('div');
    sourceTree.className = 'dm-tree-container';
    container.querySelector('.dm-panel--source')!.appendChild(sourceTree);
    const targetTree = document.createElement('div');
    targetTree.className = 'dm-tree-container';
    targetTree.setAttribute('tabindex', '-1');
    targetTree.focus = function () { (this as HTMLElement).setAttribute('tabindex', '0'); };
    container.querySelector('.dm-panel--target')!.appendChild(targetTree);

    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    expect(result.current.focusRegion).toBe('source');

    const treeNode = document.createElement('div');
    treeNode.className = 'dm-tree-node';
    sourceTree.appendChild(treeNode);

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Tab', shiftKey: false, preventDefault: () => {}, target: treeNode } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });

    expect(result.current.focusRegion).toBe('target');
    expect(result.current.focusedPath).toBeNull();

    cleanup();
  });

  it('Tab advances from target panel to source', () => {
    const { container, cleanup } = createContainer();
    const sourceTree = document.createElement('div');
    sourceTree.className = 'dm-tree-container';
    sourceTree.setAttribute('tabindex', '-1');
    sourceTree.focus = function () { (this as HTMLElement).setAttribute('tabindex', '0'); };
    container.querySelector('.dm-panel--source')!.appendChild(sourceTree);
    const targetTree = document.createElement('div');
    targetTree.className = 'dm-tree-container';
    container.querySelector('.dm-panel--target')!.appendChild(targetTree);

    const treeNode = document.createElement('div');
    treeNode.className = 'dm-tree-node';
    targetTree.appendChild(treeNode);

    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => { result.current.setFocusRegion('target'); });

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Tab', shiftKey: false, preventDefault: () => {}, target: treeNode } as unknown as React.KeyboardEvent,
        'target',
        new Set(['__root__']),
        () => {},
      );
    });

    expect(result.current.focusRegion).toBe('source');

    cleanup();
  });

  it('Shift+Tab cycles focus region from target to source', () => {
    const { container, cleanup } = createContainer();
    const sourceTree = document.createElement('div');
    sourceTree.className = 'dm-tree-container';
    sourceTree.setAttribute('tabindex', '-1');
    sourceTree.focus = function () { (this as HTMLElement).setAttribute('tabindex', '0'); };
    container.querySelector('.dm-panel--source')!.appendChild(sourceTree);
    const targetTree = document.createElement('div');
    targetTree.className = 'dm-tree-container';
    container.querySelector('.dm-panel--target')!.appendChild(targetTree);

    const treeNode = document.createElement('div');
    treeNode.className = 'dm-tree-node';
    targetTree.appendChild(treeNode);

    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => { result.current.setFocusRegion('target'); });

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Tab', shiftKey: true, preventDefault: () => {}, target: treeNode } as unknown as React.KeyboardEvent,
        'target',
        new Set(['__root__']),
        () => {},
      );
    });

    expect(result.current.focusRegion).toBe('source');
    expect(result.current.focusedPath).toBeNull();

    cleanup();
  });

  it('Tab advances region even when next panel has no tree container', () => {
    const { container, cleanup } = createContainer();
    const sourceTree = document.createElement('div');
    sourceTree.className = 'dm-tree-container';
    const treeNode = document.createElement('div');
    treeNode.className = 'dm-tree-node';
    sourceTree.appendChild(treeNode);
    container.querySelector('.dm-panel--source')!.appendChild(sourceTree);

    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Tab', shiftKey: false, preventDefault: () => {}, target: treeNode } as unknown as React.KeyboardEvent,
        'source',
        new Set(),
        () => {},
      );
    });
    expect(result.current.focusRegion).toBe('target');
    cleanup();
  });

  it('Tab outside tree does not intercept (no keyboard trap)', () => {
    const { container, cleanup } = createContainer();
    const sourceTree = document.createElement('div');
    sourceTree.className = 'dm-tree-container';
    container.querySelector('.dm-panel--source')!.appendChild(sourceTree);
    const targetTree = document.createElement('div');
    targetTree.className = 'dm-tree-container';
    container.querySelector('.dm-panel--target')!.appendChild(targetTree);

    const toolbarEl = document.createElement('button');
    toolbarEl.className = 'dm-toolbar-btn';
    container.appendChild(toolbarEl);

    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Tab', shiftKey: false, preventDefault: () => {}, target: toolbarEl } as unknown as React.KeyboardEvent,
        'source',
        new Set(),
        () => {},
      );
    });

    expect(result.current.focusRegion).toBe('source');

    cleanup();
  });

  it('Tab clears last focused node when switching panels', () => {
    const { container, cleanup } = createContainer();
    const sourceTree = document.createElement('div');
    sourceTree.className = 'dm-tree-container';
    container.querySelector('.dm-panel--source')!.appendChild(sourceTree);
    const targetTree = document.createElement('div');
    targetTree.className = 'dm-tree-container';
    targetTree.setAttribute('tabindex', '-1');
    targetTree.focus = function () { (this as HTMLElement).setAttribute('tabindex', '0'); };
    container.querySelector('.dm-panel--target')!.appendChild(targetTree);

    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    const treeNode = document.createElement('div');
    treeNode.className = 'dm-tree-node';
    sourceTree.appendChild(treeNode);

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });
    const sourceFirst = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]') as HTMLElement;
    expect(sourceFirst.getAttribute('tabindex')).toBe('0');

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Tab', shiftKey: false, preventDefault: () => {}, target: treeNode } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });

    expect(sourceFirst.hasAttribute('tabindex')).toBe(false);
    expect(result.current.focusedPath).toBeNull();

    cleanup();
  });

  it('focusNodeByPath falls back when CSS.escape is unavailable', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const css = globalThis.CSS;
    vi.stubGlobal('CSS', { ...css, escape: undefined as unknown as typeof css.escape });
    try {
      const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
      act(() => {
        result.current.handleTreeKeyDown(
          { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
          'source',
          new Set(['__root__']),
          () => {},
        );
      });
      expect(result.current.focusedPath).toBe('name');
    } finally {
      vi.unstubAllGlobals();
    }
    cleanup();
  });

  it('ArrowRight does not toggle when no tree node is focused', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    let toggled = false;
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowRight', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(['name']),
        () => { toggled = true; },
      );
    });
    expect(toggled).toBe(false);
    cleanup();
  });

  it('does not strip tabindex when Home keeps focus on the same node', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));

    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });
    const nameEl = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]') as HTMLElement;
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'Home', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });
    expect(result.current.focusedPath).toBe('name');
    expect(nameEl.getAttribute('tabindex')).toBe('0');

    cleanup();
  });

  it('ArrowLeft does not toggle when focused node is collapsed', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    let toggled = false;
    const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set(['__root__']),
        () => {},
      );
    });
    act(() => {
      result.current.handleTreeKeyDown(
        { key: 'ArrowLeft', preventDefault: () => {} } as unknown as React.KeyboardEvent,
        'source',
        new Set([]),
        () => { toggled = true; },
      );
    });
    expect(toggled).toBe(false);
    cleanup();
  });

  it('End skips focus when last visible node lacks a path attribute', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const ageNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="age"]')!;
    const spy = vi.spyOn(ageNode, 'getAttribute').mockImplementation((name: string) => {
      if (name === 'data-path') return null;
      return HTMLElement.prototype.getAttribute.call(ageNode, name);
    });
    try {
      const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
      act(() => {
        result.current.handleTreeKeyDown(
          { key: 'End', preventDefault: () => {} } as unknown as React.KeyboardEvent,
          'source',
          new Set(['__root__']),
          () => {},
        );
      });
      expect(result.current.focusedPath).toBeNull();
    } finally {
      spy.mockRestore();
    }
    cleanup();
  });

  it('Home skips focus when first visible node lacks a path attribute', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const nameNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]')!;
    const spy = vi.spyOn(nameNode, 'getAttribute').mockImplementation((name: string) => {
      if (name === 'data-path') return null;
      return HTMLElement.prototype.getAttribute.call(nameNode, name);
    });
    try {
      const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
      act(() => {
        result.current.handleTreeKeyDown(
          { key: 'Home', preventDefault: () => {} } as unknown as React.KeyboardEvent,
          'source',
          new Set(['__root__']),
          () => {},
        );
      });
      expect(result.current.focusedPath).toBeNull();
    } finally {
      spy.mockRestore();
    }
    cleanup();
  });

  it('skips focus when data-path resolves empty on visible node', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const nameNode = container.querySelector('.dm-panel--source .dm-tree-node[data-path="name"]')!;
    const spy = vi.spyOn(nameNode, 'getAttribute').mockImplementation((name: string) => {
      if (name === 'data-path') return null;
      return HTMLElement.prototype.getAttribute.call(nameNode, name);
    });
    try {
      const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
      act(() => {
        result.current.handleTreeKeyDown(
          { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
          'source',
          new Set(['__root__']),
          () => {},
        );
      });
      expect(result.current.focusedPath).toBeNull();
    } finally {
      spy.mockRestore();
    }
    cleanup();
  });

  it('skips focus when tree node selector finds no element', () => {
    const { container, cleanup } = createContainer();
    const ref = { current: container };
    const spy = vi.spyOn(container, 'querySelector').mockImplementation(function (this: HTMLElement, sel: string) {
      if (typeof sel === 'string' && sel.includes('.dm-tree-node[data-path=')) {
        return null;
      }
      return HTMLElement.prototype.querySelector.call(this, sel);
    });
    try {
      const { result } = renderHook(() => useKeyboardNavigation({ containerRef: ref }));
      act(() => {
        result.current.handleTreeKeyDown(
          { key: 'ArrowDown', preventDefault: () => {} } as unknown as React.KeyboardEvent,
          'source',
          new Set(['__root__']),
          () => {},
        );
      });
      expect(result.current.focusedPath).toBeNull();
    } finally {
      spy.mockRestore();
    }
    cleanup();
  });
});
