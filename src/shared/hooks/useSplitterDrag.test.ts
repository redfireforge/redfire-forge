/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSplitterDrag } from './useSplitterDrag';

// Simulate MouseEvent with clientX
function mouseEvent(type: string, clientX: number): MouseEvent {
  return new MouseEvent(type, { clientX, bubbles: true });
}

describe('useSplitterDrag', () => {
  afterEach(() => {
    // Clean up body styles
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('returns a function', () => {
    const setWidth = vi.fn();
    const { result } = renderHook(() => useSplitterDrag(300, setWidth, 100, 600));
    expect(typeof result.current).toBe('function');
  });

  it('dragging left increases width (default direction)', () => {
    const setWidth = vi.fn();
    const { result } = renderHook(() => useSplitterDrag(300, setWidth, 100, 600));

    // Simulate mousedown
    const fakeEvent = { clientX: 500, preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current(fakeEvent));
    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(document.body.style.cursor).toBe('col-resize');

    // Simulate mousemove to the left (increases width for direction='left')
    act(() => {
      document.dispatchEvent(mouseEvent('mousemove', 450));
    });
    expect(setWidth).toHaveBeenCalledWith(350); // 300 + (500 - 450) = 350

    // Simulate mouseup
    act(() => {
      document.dispatchEvent(mouseEvent('mouseup', 450));
    });
    expect(document.body.style.cursor).toBe('');
  });

  it('dragging right increases width when direction is right', () => {
    const setWidth = vi.fn();
    const { result } = renderHook(() => useSplitterDrag(300, setWidth, 100, 600, 'right'));

    const fakeEvent = { clientX: 500, preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current(fakeEvent));

    act(() => {
      document.dispatchEvent(mouseEvent('mousemove', 550));
    });
    expect(setWidth).toHaveBeenCalledWith(350); // 300 + (550 - 500) = 350
  });

  it('clamps to min width', () => {
    const setWidth = vi.fn();
    const { result } = renderHook(() => useSplitterDrag(150, setWidth, 100, 600));

    const fakeEvent = { clientX: 500, preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current(fakeEvent));

    // Move right past 0 (reduces width for direction='left')
    act(() => {
      document.dispatchEvent(mouseEvent('mousemove', 600));
    });
    // 150 + (500 - 600) = 50, clamped to min 100
    expect(setWidth).toHaveBeenCalledWith(100);
  });

  it('clamps to max width', () => {
    const setWidth = vi.fn();
    const { result } = renderHook(() => useSplitterDrag(500, setWidth, 100, 600));

    const fakeEvent = { clientX: 500, preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current(fakeEvent));

    act(() => {
      document.dispatchEvent(mouseEvent('mousemove', 200));
    });
    // 500 + (500 - 200) = 800, clamped to max 600
    expect(setWidth).toHaveBeenCalledWith(600);
  });

  it('cleans up event listeners on mouseup', () => {
    const setWidth = vi.fn();
    const { result } = renderHook(() => useSplitterDrag(300, setWidth, 100, 600));

    const fakeEvent = { clientX: 500, preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current(fakeEvent));

    act(() => {
      document.dispatchEvent(mouseEvent('mouseup', 500));
    });

    // After mouseup, further moves should not update
    setWidth.mockClear();
    act(() => {
      document.dispatchEvent(mouseEvent('mousemove', 400));
    });
    expect(setWidth).not.toHaveBeenCalled();
  });

  it('sets body styles during drag', () => {
    const setWidth = vi.fn();
    const { result } = renderHook(() => useSplitterDrag(300, setWidth, 100, 600));

    const fakeEvent = { clientX: 500, preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current(fakeEvent));

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    act(() => {
      document.dispatchEvent(mouseEvent('mouseup', 500));
    });

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });
});
