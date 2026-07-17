/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useLiveDemoPanelLayout,
  createDefaultLiveDemoPanelGeometry,
  DEMO_LIVE_PANEL_STORAGE_KEY,
  DEMO_LIVE_PANEL_MIN_WIDTH,
  DEMO_LIVE_PANEL_MIN_HEIGHT,
} from './useLiveDemoPanelLayout';

describe('useLiveDemoPanelLayout — coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 900);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('createDefaultLiveDemoPanelGeometry clamps on small viewports', () => {
    const geom = createDefaultLiveDemoPanelGeometry(320, 400);
    expect(geom.width).toBe(DEMO_LIVE_PANEL_MIN_WIDTH);
    expect(geom.height).toBeLessThanOrEqual(400 - 32);
  });

  it('ignores invalid saved geometry', () => {
    localStorage.setItem(DEMO_LIVE_PANEL_STORAGE_KEY, '{bad');
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    expect(result.current.panelStyle.width).toBeDefined();
  });

  it('supports drag and edge resize interactions', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    panel.getBoundingClientRect = () => ({
      left: 200, top: 100, width: 400, height: 440,
      right: 600, bottom: 540, x: 200, y: 100, toJSON: () => ({}),
    });
    result.current.panelRef.current = panel;

    act(() => {
      result.current.onDragMouseDown({
        target: panel,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 210,
        clientY: 110,
      } as never);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 230, clientY: 130 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    act(() => {
      result.current.onResizeMouseDown('right')({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 600,
        clientY: 200,
      } as never);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 620, clientY: 200 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.width).toBeDefined();
  });

  it('ignores saved geometry with non-numeric fields', () => {
    localStorage.setItem(DEMO_LIVE_PANEL_STORAGE_KEY, JSON.stringify({
      top: 'bad',
      left: 10,
      width: 400,
      height: 440,
    }));
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    expect(result.current.panelStyle.width).toBeDefined();
  });

  it('loads valid saved geometry from localStorage', () => {
    localStorage.setItem(DEMO_LIVE_PANEL_STORAGE_KEY, JSON.stringify({
      top: 50,
      left: 60,
      width: 420,
      height: 460,
    }));
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    expect(result.current.panelStyle.top).toBe(50);
    expect(result.current.panelStyle.left).toBe(60);
  });

  it('skips drag when mousedown target is a button', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    const button = document.createElement('button');
    panel.appendChild(button);
    result.current.panelRef.current = panel;
    const leftBefore = result.current.panelStyle.left;
    act(() => {
      result.current.onDragMouseDown({
        target: button,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 210,
        clientY: 110,
      } as never);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 200 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.panelStyle.left).toBe(leftBefore);
  });

  it('supports top and left edge resize', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    panel.getBoundingClientRect = () => ({
      left: 200, top: 100, width: 400, height: 440,
      right: 600, bottom: 540, x: 200, y: 100, toJSON: () => ({}),
    });
    result.current.panelRef.current = panel;

    act(() => {
      result.current.onResizeMouseDown('left')({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 200,
        clientY: 200,
      } as never);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 180, clientY: 200 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    act(() => {
      result.current.onResizeMouseDown('top')({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 400,
        clientY: 100,
      } as never);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 80 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.width).toBeDefined();
  });

  it('re-clamps geometry on window resize', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    act(() => {
      vi.stubGlobal('innerWidth', 400);
      vi.stubGlobal('innerHeight', 300);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.panelStyle.width).toBeLessThanOrEqual(560);
  });

  it('swallows localStorage quota errors when saving geometry', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    panel.getBoundingClientRect = () => ({
      left: 200, top: 100, width: 400, height: 440,
      right: 600, bottom: 540, x: 200, y: 100, toJSON: () => ({}),
    });
    result.current.panelRef.current = panel;
    expect(() => {
      act(() => {
        result.current.onResizeMouseDown('right')({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 600,
          clientY: 200,
        } as never);
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 620, clientY: 200 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
      });
    }).not.toThrow();
  });

  it('onDragMouseDown skips drag when target is lesson name', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'demo-live-lesson-name';
    panel.appendChild(name);
    result.current.panelRef.current = panel;
    const leftBefore = result.current.panelStyle.left;
    act(() => {
      result.current.onDragMouseDown({
        target: name,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 210,
        clientY: 110,
      } as never);
    });
    expect(result.current.panelStyle.left).toBe(leftBefore);
  });

  it('onDragMouseDown no-ops when panel ref is missing', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    expect(() => {
      act(() => {
        result.current.onDragMouseDown({
          target: document.createElement('div'),
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as never);
      });
    }).not.toThrow();
  });

  it('onResizeMouseDown no-ops when panel ref is missing', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    expect(() => {
      act(() => {
        result.current.onResizeMouseDown('right')({
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as never);
      });
    }).not.toThrow();
  });

  it('ignores saved geometry when only some fields are numeric', () => {
    localStorage.setItem(DEMO_LIVE_PANEL_STORAGE_KEY, JSON.stringify({
      top: 50,
      left: '60',
      width: 420,
      height: 460,
    }));
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    expect(result.current.panelStyle.top).not.toBe(50);
  });

  it('drag clamps panel position at viewport edges', () => {
    vi.stubGlobal('innerWidth', 500);
    vi.stubGlobal('innerHeight', 400);
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    panel.getBoundingClientRect = () => ({
      left: 400, top: 300, width: 400, height: 440,
      right: 800, bottom: 740, x: 400, y: 300, toJSON: () => ({}),
    });
    result.current.panelRef.current = panel;
    act(() => {
      result.current.onDragMouseDown({
        target: panel,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 410,
        clientY: 310,
      } as never);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 900 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.panelStyle.left).toBeLessThanOrEqual(92);
    expect(result.current.panelStyle.top).toBeLessThanOrEqual(400 - DEMO_LIVE_PANEL_MIN_HEIGHT - 8);
  });

  it('does not persist when resize keeps geometry identical', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const before = { ...result.current.panelStyle };

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.panelStyle).toMatchObject(before);
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
