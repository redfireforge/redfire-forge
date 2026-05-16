/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { usePanelResize } from './usePanelResize';

function stubRect(el: HTMLElement, width: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 100,
    top: 0,
    left: 0,
    right: width,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function buildMapperContainer(bodyWidth: number, sourceW: number, targetW: number, canvasW: number) {
  const container = document.createElement('div');
  const body = document.createElement('div');
  body.className = 'dm-body';
  const w1 = document.createElement('div');
  w1.className = 'dm-panel-wrapper';
  const w2 = document.createElement('div');
  w2.className = 'dm-panel-wrapper';
  const canvas = document.createElement('div');
  canvas.className = 'dm-canvas-wrapper';
  body.append(w1, w2, canvas);
  container.append(body);

  stubRect(body, bodyWidth);
  stubRect(w1, sourceW);
  stubRect(w2, targetW);
  stubRect(canvas, canvasW);

  return { container, body, sourceWrapper: w1, targetWrapper: w2, canvas };
}

function syntheticMouse(clientX: number, preventDefault = vi.fn()): ReactMouseEvent {
  return { preventDefault, clientX } as unknown as ReactMouseEvent;
}

describe('usePanelResize', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('initial state: panel widths null, canvasWidth 120', () => {
    const ref = { current: null };
    const { result } = renderHook(() => usePanelResize(ref));
    expect(result.current.sourcePanelWidth).toBeNull();
    expect(result.current.targetPanelWidth).toBeNull();
    expect(result.current.canvasWidth).toBe(120);
  });

  it('handleResizeStart returns early when containerRef.current is null (no .dm-body)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const ref = { current: null as HTMLDivElement | null };
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(100));
    });

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('handleResizeStart returns early when container has no .dm-body', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const container = document.createElement('div');
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('target', syntheticMouse(50));
    });

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('unmount runs cleanup and removes document listeners when resize was active', () => {
    const { container } = buildMapperContainer(1000, 300, 300, 120);
    document.body.append(container);
    const ref = { current: container };
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { result, unmount } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(200));
    });

    expect(removeSpy).not.toHaveBeenCalled();

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('unmount does not throw when no active resize cleanup', () => {
    const ref = { current: document.createElement('div') };
    const { unmount } = renderHook(() => usePanelResize(ref));
    expect(() => unmount()).not.toThrow();
  });

  it('source drag updates sourcePanelWidth and canvasWidth', () => {
    const { container } = buildMapperContainer(1000, 300, 300, 120);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(200));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, bubbles: true }));
    });

    expect(result.current.sourcePanelWidth).toBe(350);
    expect(result.current.canvasWidth).toBe(70);
    expect(result.current.targetPanelWidth).toBeNull();

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('target drag updates targetPanelWidth and canvasWidth', () => {
    const { container } = buildMapperContainer(1000, 300, 300, 120);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('target', syntheticMouse(200));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, bubbles: true }));
    });

    expect(result.current.targetPanelWidth).toBe(350);
    expect(result.current.canvasWidth).toBe(70);
    expect(result.current.sourcePanelWidth).toBeNull();

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('uses fallback panel width when body and panel rects are zero', () => {
    const { container, sourceWrapper, targetWrapper, canvas } = buildMapperContainer(0, 0, 0, 0);
    stubRect(sourceWrapper, 0);
    stubRect(targetWrapper, 0);
    stubRect(canvas, 0);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(100));
    });

    const fallbackStart = 150 * 2;
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, bubbles: true }));
    });

    expect(result.current.sourcePanelWidth).toBe(fallbackStart + 10);
    expect(result.current.canvasWidth).toBe(120 - 10);

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('uses state canvasWidth when canvas wrapper measures zero', () => {
    const { container, canvas } = buildMapperContainer(800, 200, 200, 0);
    stubRect(canvas, 0);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    expect(result.current.canvasWidth).toBe(120);

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(400));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 410, bubbles: true }));
    });

    expect(result.current.sourcePanelWidth).toBe(210);
    expect(result.current.canvasWidth).toBe(120 - 10);

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('prefers state panel widths over measured when already set', () => {
    const { container } = buildMapperContainer(1000, 300, 300, 120);
    document.body.append(container);
    const ref = { current: container };
    const { result, rerender } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(100));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    rerender();
    expect(result.current.sourcePanelWidth).toBe(350);

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(200));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(result.current.sourcePanelWidth).toBe(370);
  });

  it('starting a new resize removes listeners from the previous session', () => {
    const { container } = buildMapperContainer(1000, 300, 300, 120);
    document.body.append(container);
    const ref = { current: container };
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(0));
    });

    removeSpy.mockClear();

    act(() => {
      result.current.handleResizeStart('target', syntheticMouse(50));
    });

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('calls preventDefault on the mousedown event', () => {
    const { container } = buildMapperContainer(1000, 300, 300, 120);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(0, preventDefault));
    });

    expect(preventDefault).toHaveBeenCalled();
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('treats missing panel wrappers as zero width (uses body fallback)', () => {
    const container = document.createElement('div');
    const body = document.createElement('div');
    body.className = 'dm-body';
    container.append(body);
    stubRect(body, 500);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    const fallbackPanel = 500 * 0.38;

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(100));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, bubbles: true }));
    });

    expect(result.current.sourcePanelWidth).toBe(fallbackPanel + 10);

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('uses only first panel when second wrapper is absent', () => {
    const container = document.createElement('div');
    const body = document.createElement('div');
    body.className = 'dm-body';
    const w1 = document.createElement('div');
    w1.className = 'dm-panel-wrapper';
    const canvas = document.createElement('div');
    canvas.className = 'dm-canvas-wrapper';
    body.append(w1, canvas);
    container.append(body);
    stubRect(body, 600);
    stubRect(w1, 180);
    stubRect(canvas, 100);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('target', syntheticMouse(200));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 190, bubbles: true }));
    });

    const fallbackPanel = 600 * 0.38;
    expect(result.current.targetPanelWidth).toBe(fallbackPanel + 10);
    expect(result.current.canvasWidth).toBe(100 - 10);

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  it('treats missing .dm-canvas-wrapper as zero measured canvas width', () => {
    const container = document.createElement('div');
    const body = document.createElement('div');
    body.className = 'dm-body';
    const w1 = document.createElement('div');
    w1.className = 'dm-panel-wrapper';
    const w2 = document.createElement('div');
    w2.className = 'dm-panel-wrapper';
    body.append(w1, w2);
    container.append(body);
    stubRect(body, 800);
    stubRect(w1, 250);
    stubRect(w2, 250);
    document.body.append(container);
    const ref = { current: container };
    const { result } = renderHook(() => usePanelResize(ref));

    act(() => {
      result.current.handleResizeStart('source', syntheticMouse(300));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 315, bubbles: true }));
    });

    expect(result.current.sourcePanelWidth).toBe(265);
    expect(result.current.canvasWidth).toBe(120 - 15);

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  });

  describe('ResizeObserver container width reset', () => {
    let observeCallback: ResizeObserverCallback;
    let disconnectSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      disconnectSpy = vi.fn();
      vi.stubGlobal('ResizeObserver', class {
        constructor(cb: ResizeObserverCallback) { observeCallback = cb; }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = disconnectSpy;
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('resets panel widths on substantial container resize after user resize', () => {
      const { container } = buildMapperContainer(800, 300, 300, 200);
      document.body.append(container);
      const ref = { current: container };
      const { result } = renderHook(() => usePanelResize(ref));

      act(() => {
        result.current.handleResizeStart('source', syntheticMouse(300));
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, bubbles: true }));
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      expect(result.current.sourcePanelWidth).not.toBeNull();

      act(() => {
        observeCallback([{ contentRect: { width: 800 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
      });

      act(() => {
        observeCallback([{ contentRect: { width: 1200 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
      });

      expect(result.current.sourcePanelWidth).toBeNull();
      expect(result.current.targetPanelWidth).toBeNull();
      expect(result.current.canvasWidth).toBe(120);
    });

    it('does not reset when container resize delta is small', () => {
      const { container } = buildMapperContainer(800, 300, 300, 200);
      document.body.append(container);
      const ref = { current: container };
      const { result } = renderHook(() => usePanelResize(ref));

      act(() => {
        result.current.handleResizeStart('source', syntheticMouse(300));
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, bubbles: true }));
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      const savedWidth = result.current.sourcePanelWidth;

      act(() => {
        observeCallback([{ contentRect: { width: 800 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
      });
      act(() => {
        observeCallback([{ contentRect: { width: 820 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
      });

      expect(result.current.sourcePanelWidth).toBe(savedWidth);
    });

    it('does not reset when user has not manually resized', () => {
      const { container } = buildMapperContainer(800, 300, 300, 200);
      document.body.append(container);
      const ref = { current: container };
      const { result } = renderHook(() => usePanelResize(ref));

      act(() => {
        observeCallback([{ contentRect: { width: 800 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
      });
      act(() => {
        observeCallback([{ contentRect: { width: 1200 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
      });

      expect(result.current.sourcePanelWidth).toBeNull();
      expect(result.current.targetPanelWidth).toBeNull();
    });

    it('handles empty entries array', () => {
      const { container } = buildMapperContainer(800, 300, 300, 200);
      document.body.append(container);
      const ref = { current: container };
      renderHook(() => usePanelResize(ref));

      act(() => {
        observeCallback([], null as unknown as ResizeObserver);
      });
    });

    it('disconnects observer on unmount', () => {
      const { container } = buildMapperContainer(800, 300, 300, 200);
      document.body.append(container);
      const ref = { current: container };
      const { unmount } = renderHook(() => usePanelResize(ref));
      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
