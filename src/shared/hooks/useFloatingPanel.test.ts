/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useFloatingPanel, PANEL_LIMITS } from './useFloatingPanel';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

function mockMouseEvent(
  clientX: number,
  clientY: number,
  target?: HTMLElement,
): ReactMouseEvent {
  return {
    clientX,
    clientY,
    target: target ?? document.createElement('div'),
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as React.MouseEvent;
}

describe('useFloatingPanel', () => {
  beforeEach(() => {
    setViewport(1000, 800);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  afterEach(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('initializes docked and floating state from defaults', () => {
    const { result } = renderHook(() => useFloatingPanel());
    expect(result.current.dockedHeight).toBe(200);
    expect(result.current.floatPos).toEqual({ x: 150, y: 80 });
    expect(result.current.floatSize).toEqual({ w: 450, h: 480 });
  });

  it('uses custom options for initial state', () => {
    const { result } = renderHook(() =>
      useFloatingPanel({ defaultDockedHeight: 260, floatWidthRatio: 0.5, floatHeightRatio: 0.5 }),
    );
    expect(result.current.dockedHeight).toBe(260);
    expect(result.current.floatSize).toEqual({ w: 500, h: 400 });
  });

  it('resizes docked panel and clamps within min/max limits', () => {
    const { result } = renderHook(() => useFloatingPanel({ defaultDockedHeight: 200 }));

    act(() => {
      result.current.onDockedResizeStart(mockMouseEvent(300, 300));
    });
    expect(document.body.style.cursor).toBe('row-resize');
    expect(document.body.style.userSelect).toBe('none');

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: -100, bubbles: true }));
    });
    expect(result.current.dockedHeight).toBe(PANEL_LIMITS.MAX_DOCKED_H);

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 1200, bubbles: true }));
    });
    expect(result.current.dockedHeight).toBe(PANEL_LIMITS.MIN_DOCKED_H);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('ignores floating drag start from interactive elements', () => {
    const { result } = renderHook(() => useFloatingPanel());
    const startPos = result.current.floatPos;

    const button = document.createElement('button');
    act(() => {
      result.current.onFloatDragStart(mockMouseEvent(200, 200, button));
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 400, bubbles: true }));
    });

    expect(result.current.floatPos).toEqual(startPos);
    expect(document.body.style.cursor).toBe('');
  });

  it('drags floating panel and clamps position to viewport bounds', () => {
    const { result } = renderHook(() => useFloatingPanel());

    act(() => {
      result.current.onFloatDragStart(mockMouseEvent(100, 100));
    });
    expect(document.body.style.cursor).toBe('grabbing');

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: -1000, clientY: -1000, bubbles: true }));
    });
    expect(result.current.floatPos).toEqual({ x: 0, y: 0 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 2000, clientY: 2000, bubbles: true }));
    });
    expect(result.current.floatPos).toEqual({ x: 550, y: 320 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('resizes floating panel from corner with viewport and min constraints', () => {
    const { result } = renderHook(() => useFloatingPanel());

    act(() => {
      result.current.onFloatResizeStart(mockMouseEvent(200, 200));
    });
    expect(document.body.style.cursor).toBe('nwse-resize');

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 3000, clientY: 3000, bubbles: true }));
    });
    expect(result.current.floatSize).toEqual({ w: 850, h: 720 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: -3000, clientY: -3000, bubbles: true }));
    });
    expect(result.current.floatSize.w).toBe(PANEL_LIMITS.MIN_FLOAT_W);
    expect(result.current.floatSize.h).toBe(PANEL_LIMITS.MIN_FLOAT_H);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('resizes floating panel from right edge with min and viewport constraints', () => {
    const { result } = renderHook(() => useFloatingPanel());

    act(() => {
      result.current.onRightEdgeResizeStart(mockMouseEvent(200, 200));
    });
    expect(document.body.style.cursor).toBe('ew-resize');

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 3000, bubbles: true }));
    });
    expect(result.current.floatSize.w).toBe(850);

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: -3000, bubbles: true }));
    });
    expect(result.current.floatSize.w).toBe(PANEL_LIMITS.MIN_FLOAT_W);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(document.body.style.cursor).toBe('');
  });
});
