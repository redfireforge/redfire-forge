/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useFloatingPanel, PANEL_LIMITS, computeWorkflowConsoleDemoFloatLayout } from './useFloatingPanel';

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

  it('computeWorkflowConsoleDemoFloatLayout anchors left of canvas', () => {
    const layout = computeWorkflowConsoleDemoFloatLayout({ w: 1280, h: 900 });
    expect(layout.x).toBe(68);
    expect(layout.y).toBe(72);
    expect(layout.w).toBe(486);
    expect(layout.h).toBe(675);
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

  it('respects sidebar CSS variable when initializing float position', () => {
    setViewport(500, 800);
    document.documentElement.style.setProperty('--sidebar-w', '220');
    const { result } = renderHook(() => useFloatingPanel());
    expect(result.current.floatPos.x).toBe(240);
    document.documentElement.style.removeProperty('--sidebar-w');
  });

  it('falls back to default sidebar offset when CSS variable is invalid', () => {
    document.documentElement.style.setProperty('--sidebar-w', 'invalid');
    const { result } = renderHook(() => useFloatingPanel());
    expect(result.current.floatPos.x).toBe(150);
    document.documentElement.style.removeProperty('--sidebar-w');
  });

  it('uses default sidebar width when CSS variable is empty', () => {
    document.documentElement.style.setProperty('--sidebar-w', '');
    const { result } = renderHook(() => useFloatingPanel());
    expect(result.current.floatPos.x).toBeGreaterThanOrEqual(68);
    document.documentElement.style.removeProperty('--sidebar-w');
  });

  it('computeWorkflowConsoleDemoFloatLayout accepts explicit viewport bounds', () => {
    const layout = computeWorkflowConsoleDemoFloatLayout({ w: 1200, h: 800 });
    expect(layout.w).toBeGreaterThanOrEqual(PANEL_LIMITS.MIN_FLOAT_W);
    expect(layout.h).toBeGreaterThanOrEqual(PANEL_LIMITS.MIN_FLOAT_H);
    expect(layout.x).toBeGreaterThanOrEqual(68);
  });

  it('uses parsed sidebar width from CSS variable when set', () => {
    document.documentElement.style.setProperty('--sidebar-w', '200');
    const { result } = renderHook(() => useFloatingPanel());
    expect(result.current.floatPos.x).toBe(220);
    document.documentElement.style.removeProperty('--sidebar-w');
  });

  it('computeWorkflowConsoleDemoFloatLayout uses SSR sidebar fallback without document', () => {
    const doc = globalThis.document;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined });
    try {
      const layout = computeWorkflowConsoleDemoFloatLayout({ w: 1000, h: 800 });
      expect(layout.x).toBe(68);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
    }
  });

  it('computeWorkflowConsoleDemoFloatLayout uses fallback viewport without window', () => {
    const win = globalThis.window;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
    try {
      const layout = computeWorkflowConsoleDemoFloatLayout();
      expect(layout.w).toBeGreaterThanOrEqual(PANEL_LIMITS.MIN_FLOAT_W);
      expect(layout.h).toBeGreaterThanOrEqual(PANEL_LIMITS.MIN_FLOAT_H);
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
    }
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
    // x clamps to sidebar minLeft (68 = 48px activity bar + 20px gutter), y clamps to 0
    expect(result.current.floatPos).toEqual({ x: 68, y: 0 });

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
