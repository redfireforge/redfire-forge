/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createDefaultLiveDemoPanelGeometry,
  DEMO_LIVE_PANEL_DEFAULT_HEIGHT,
  DEMO_LIVE_PANEL_DEFAULT_WIDTH,
  DEMO_LIVE_PANEL_STORAGE_KEY,
  useLiveDemoPanelLayout,
} from './useLiveDemoPanelLayout';

describe('useLiveDemoPanelLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 900);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses larger default width and height', () => {
    const geom = createDefaultLiveDemoPanelGeometry(1280, 900);
    expect(geom.width).toBe(DEMO_LIVE_PANEL_DEFAULT_WIDTH);
    expect(geom.height).toBe(DEMO_LIVE_PANEL_DEFAULT_HEIGHT);
    expect(geom.left).toBe(1280 - DEMO_LIVE_PANEL_DEFAULT_WIDTH - 16);
    expect(geom.top).toBe(84);
  });

  it('restores saved geometry from localStorage', () => {
    localStorage.setItem(
      DEMO_LIVE_PANEL_STORAGE_KEY,
      JSON.stringify({ top: 120, left: 200, width: 420, height: 460 }),
    );
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    expect(result.current.panelStyle).toMatchObject({
      top: 120,
      left: 200,
      width: 420,
      height: 460,
    });
  });

  it('does not start drag when mousedown is on the lesson name', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    const lessonName = document.createElement('span');
    lessonName.className = 'demo-live-lesson-name';
    panel.appendChild(lessonName);
    Object.defineProperty(result.current.panelRef, 'current', { value: panel, writable: true });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      left: 800,
      width: 400,
      height: 440,
      right: 1200,
      bottom: 840,
      x: 800,
      y: 400,
      toJSON: () => ({}),
    });
    const startTop = result.current.panelStyle.top;

    act(() => {
      result.current.onDragMouseDown({
        preventDefault: vi.fn(),
        clientX: 820,
        clientY: 410,
        target: lessonName,
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 920, clientY: 510 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.top).toBe(startTop);
  });

  it('resizes wider when dragging the right edge', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    Object.defineProperty(result.current.panelRef, 'current', { value: panel, writable: true });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      left: 800,
      width: 400,
      height: 440,
      right: 1200,
      bottom: 840,
      x: 800,
      y: 400,
      toJSON: () => ({}),
    });

    act(() => {
      result.current.onResizeMouseDown('right')({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 1200,
        clientY: 500,
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1230, clientY: 500 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.width).toBe(430);
  });

  it('resizes taller when dragging the top edge', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    Object.defineProperty(result.current.panelRef, 'current', { value: panel, writable: true });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      left: 800,
      width: 400,
      height: 440,
      right: 1200,
      bottom: 840,
      x: 800,
      y: 400,
      toJSON: () => ({}),
    });

    act(() => {
      result.current.onResizeMouseDown('top')({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 900,
        clientY: 400,
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 370 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.height).toBe(470);
    expect(result.current.panelStyle.top).toBe(370);
  });

  it('resizes taller when dragging the bottom edge', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    Object.defineProperty(result.current.panelRef, 'current', { value: panel, writable: true });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      left: 800,
      width: 400,
      height: 440,
      right: 1200,
      bottom: 840,
      x: 800,
      y: 400,
      toJSON: () => ({}),
    });

    act(() => {
      result.current.onResizeMouseDown('bottom')({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 900,
        clientY: 840,
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 870 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.height).toBe(470);
    expect(result.current.panelStyle.top).toBe(400);
  });

  it('resizes wider and taller when dragging the corner', () => {
    const { result } = renderHook(() => useLiveDemoPanelLayout());
    const panel = document.createElement('div');
    Object.defineProperty(result.current.panelRef, 'current', { value: panel, writable: true });
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      left: 800,
      width: 400,
      height: 440,
      right: 1200,
      bottom: 840,
      x: 800,
      y: 400,
      toJSON: () => ({}),
    });

    act(() => {
      result.current.onResizeMouseDown('corner')({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 1200,
        clientY: 840,
      } as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1230, clientY: 870 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.panelStyle.width).toBe(430);
    expect(result.current.panelStyle.height).toBe(470);
  });
});
