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
});
