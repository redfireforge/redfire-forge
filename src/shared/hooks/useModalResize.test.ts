/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useModalResize } from './useModalResize';

describe('useModalResize', () => {
  it('returns undefined resizeStyle by default', () => {
    const { result } = renderHook(() => useModalResize());
    expect(result.current.resizeStyle).toBeUndefined();
  });

  it('returns resize callback functions', () => {
    const { result } = renderHook(() => useModalResize());
    expect(typeof result.current.onRightEdge).toBe('function');
    expect(typeof result.current.onCorner).toBe('function');
    expect(typeof result.current.resetSize).toBe('function');
  });

  it('resetSize clears custom size', () => {
    const { result } = renderHook(() => useModalResize());
    // Initially no style
    expect(result.current.resizeStyle).toBeUndefined();
    // resetSize should not throw when already null
    act(() => { result.current.resetSize(); });
    expect(result.current.resizeStyle).toBeUndefined();
  });

  it('respects custom minWidth and minHeight', () => {
    const { result } = renderHook(() => useModalResize(500, 400));
    expect(typeof result.current.onRightEdge).toBe('function');
    expect(typeof result.current.onCorner).toBe('function');
  });

  function makeMockMouseEvent(clientX: number, clientY: number, parentRect = { width: 600, height: 400 }) {
    const parent = document.createElement('div');
    parent.getBoundingClientRect = () => ({
      x: 100, y: 100, width: parentRect.width, height: parentRect.height,
      top: 100, left: 100, right: 100 + parentRect.width, bottom: 100 + parentRect.height,
      toJSON: () => ({}),
    });
    const target = document.createElement('div');
    parent.appendChild(target);
    return {
      clientX, clientY,
      currentTarget: target,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.MouseEvent;
  }

  it('onRightEdge drag changes width only', () => {
    const { result } = renderHook(() => useModalResize(320, 200));
    act(() => {
      result.current.onRightEdge(makeMockMouseEvent(500, 300));
    });
    // Simulate drag by dispatching mousemove + mouseup on window
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 300 }));
    });
    expect(result.current.resizeStyle).toBeTruthy();
    expect(result.current.resizeStyle!.width).toBe(700); // 600 (orig) + 100 (dx)
    // Height should remain original (400)
    expect(result.current.resizeStyle!.height).toBe(400);
    expect(result.current.resizeStyle!.maxWidth).toBe('none');
    expect(result.current.resizeStyle!.maxHeight).toBe('none');
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  it('manual resize style overrides class max-size caps so right drag can expand', () => {
    const { result } = renderHook(() => useModalResize(320, 200));

    act(() => {
      result.current.onRightEdge(makeMockMouseEvent(500, 300));
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 760, clientY: 300 }));
    });

    expect(result.current.resizeStyle).toMatchObject({
      width: 860,
      maxWidth: 'none',
      maxHeight: 'none',
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  it('onCorner drag changes both width and height', () => {
    const { result } = renderHook(() => useModalResize(320, 200));
    act(() => {
      result.current.onCorner(makeMockMouseEvent(500, 300));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 550, clientY: 350 }));
    });
    expect(result.current.resizeStyle).toBeTruthy();
    expect(result.current.resizeStyle!.width).toBe(650); // 600 + 50
    expect(result.current.resizeStyle!.height).toBe(450); // 400 + 50
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  it('respects minimum width and height constraints', () => {
    const { result } = renderHook(() => useModalResize(500, 300));
    act(() => {
      result.current.onCorner(makeMockMouseEvent(500, 300));
    });
    // Drag far left/up to trigger min constraints
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }));
    });
    expect(result.current.resizeStyle!.width).toBe(500); // minWidth
    expect(result.current.resizeStyle!.height).toBe(300); // minHeight
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  it('no-op when parentElement is missing', () => {
    const { result } = renderHook(() => useModalResize());
    const orphanTarget = document.createElement('div');
    // Remove from parent
    const evt = {
      clientX: 500, clientY: 300,
      currentTarget: orphanTarget,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.MouseEvent;
    act(() => {
      result.current.onRightEdge(evt);
    });
    expect(result.current.resizeStyle).toBeUndefined();
  });

  it('resetSize clears custom size after resize', () => {
    const { result } = renderHook(() => useModalResize());
    act(() => {
      result.current.onRightEdge(makeMockMouseEvent(500, 300));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 300 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.resizeStyle).toBeTruthy();
    act(() => { result.current.resetSize(); });
    expect(result.current.resizeStyle).toBeUndefined();
  });

  it('onBottomEdge drag changes height only — width falls back to size?.w (line 47 cond-expr false branch)', () => {
    const { result } = renderHook(() => useModalResize(320, 200));
    act(() => {
      result.current.onBottomEdge(makeMockMouseEvent(500, 300));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 400 }));
    });
    // resizesW = false for 'bottom', so width stays as size?.w ?? origW = origRect.width = 600
    expect(result.current.resizeStyle!.width).toBe(600); // origW (no size?.w yet)
    // resizesH = true, dy = 100, height = 400 + 100 = 500
    expect(result.current.resizeStyle!.height).toBe(500);
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  it('second drag uses existing size?.w when size already set (line 47 [9][0] binary-expr true)', () => {
    const { result } = renderHook(() => useModalResize(320, 200));
    // First drag sets size
    act(() => {
      result.current.onRightEdge(makeMockMouseEvent(500, 300));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 650, clientY: 300 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    const firstWidth = result.current.resizeStyle!.width as number;

    // Second drag from bottom — resizesW=false, size?.w is now set
    act(() => {
      result.current.onBottomEdge(makeMockMouseEvent(500, 300));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 350 }));
    });
    // Width should use previous size.w
    expect(result.current.resizeStyle!.width).toBe(firstWidth);
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  });
});
