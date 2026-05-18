/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDockResize } from './useDockResize';
import type { RefObject } from 'react';

function createContainerRef(overrides: Partial<{
  dockRect: { height: number };
  containerRect: { height: number };
}> = {}): RefObject<HTMLDivElement | null> {
  const dockRect = overrides.dockRect ?? { height: 200 };
  const containerRect = overrides.containerRect ?? { height: 800 };

  const dockEl = { getBoundingClientRect: () => dockRect };
  const containerEl = {
    querySelector: (sel: string) => sel === '.dm-bottom-utility-dock' ? dockEl : null,
    getBoundingClientRect: () => containerRect,
  } as unknown as HTMLDivElement;

  return { current: containerEl };
}

describe('useDockResize', () => {
  it('initializes with null dockHeight and collapsed=false', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useDockResize(ref));
    expect(result.current.dockHeight).toBeNull();
    expect(result.current.panelsCollapsed).toBe(false);
  });

  it('togglePanelsCollapsed flips the collapsed state', () => {
    const ref = createContainerRef();
    const { result } = renderHook(() => useDockResize(ref));
    expect(result.current.panelsCollapsed).toBe(false);
    act(() => result.current.togglePanelsCollapsed());
    expect(result.current.panelsCollapsed).toBe(true);
    act(() => result.current.togglePanelsCollapsed());
    expect(result.current.panelsCollapsed).toBe(false);
  });

  it('handleDockResizeStart attaches mousemove/mouseup and adjusts height on drag', () => {
    const ref = createContainerRef({ containerRect: { height: 800 } });
    const { result } = renderHook(() => useDockResize(ref));

    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const mouseDown = {
      clientY: 400,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => result.current.handleDockResizeStart(mouseDown));
    expect(mouseDown.preventDefault).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

    const onMove = addSpy.mock.calls.find(c => c[0] === 'mousemove')![1] as (ev: MouseEvent) => void;
    const onUp = addSpy.mock.calls.find(c => c[0] === 'mouseup')![1] as () => void;

    act(() => onMove({ clientY: 350 } as MouseEvent));
    expect(result.current.dockHeight).toBe(250);

    act(() => onUp());
    expect(removeSpy).toHaveBeenCalledWith('mousemove', onMove);
    expect(removeSpy).toHaveBeenCalledWith('mouseup', onUp);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('clamps drag height to min/max bounds', () => {
    const ref = createContainerRef({ containerRect: { height: 400 } });
    const { result } = renderHook(() => useDockResize(ref));

    const addSpy = vi.spyOn(document, 'addEventListener');

    act(() => result.current.handleDockResizeStart({
      clientY: 200, preventDefault: vi.fn(),
    } as unknown as React.MouseEvent));

    const onMove = addSpy.mock.calls.find(c => c[0] === 'mousemove')![1] as (ev: MouseEvent) => void;

    act(() => onMove({ clientY: -1000 } as MouseEvent));
    expect(result.current.dockHeight).toBe(300);

    act(() => onMove({ clientY: 2000 } as MouseEvent));
    expect(result.current.dockHeight).toBe(80);

    addSpy.mockRestore();
  });

  it('uses null ref gracefully with fallback dimensions', () => {
    const ref = { current: null } as RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useDockResize(ref));

    const addSpy = vi.spyOn(document, 'addEventListener');

    act(() => result.current.handleDockResizeStart({
      clientY: 300, preventDefault: vi.fn(),
    } as unknown as React.MouseEvent));

    const onMove = addSpy.mock.calls.find(c => c[0] === 'mousemove')![1] as (ev: MouseEvent) => void;
    act(() => onMove({ clientY: 250 } as MouseEvent));
    expect(result.current.dockHeight).toBe(250);

    addSpy.mockRestore();
  });
});
