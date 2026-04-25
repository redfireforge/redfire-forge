/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalDrag } from './useModalDrag';

describe('useModalDrag', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns isDragged=false initially', () => {
    const { result } = renderHook(() => useModalDrag(true));
    expect(result.current.isDragged).toBe(false);
    expect(result.current.overlayStyle).toBeUndefined();
    expect(result.current.modalStyle).toBeUndefined();
  });

  it('provides an onDragStart callback', () => {
    const { result } = renderHook(() => useModalDrag(true));
    expect(typeof result.current.onDragStart).toBe('function');
  });

  it('resets drag position when open changes', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useModalDrag(open),
      { initialProps: { open: true } },
    );
    expect(result.current.isDragged).toBe(false);
    rerender({ open: false });
    expect(result.current.isDragged).toBe(false);
    rerender({ open: true });
    expect(result.current.isDragged).toBe(false);
  });

  it('ignores drag on interactive elements (button)', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const button = document.createElement('button');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(button);
    document.body.appendChild(dialog);

    const event = new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true });
    Object.defineProperty(event, 'target', { value: button });
    Object.defineProperty(event, 'currentTarget', { value: dialog });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onDragStart(event as unknown as React.MouseEvent);
    });

    expect(result.current.isDragged).toBe(false);
    document.body.removeChild(dialog);
  });

  it('starts dragging from a valid header element', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    // Mock getBoundingClientRect
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 200, width: 400, height: 300,
      right: 500, bottom: 500, x: 100, y: 200, toJSON: () => {},
    });

    const mousedown = new MouseEvent('mousedown', { clientX: 150, clientY: 220, bubbles: true });
    Object.defineProperty(mousedown, 'target', { value: header });
    Object.defineProperty(mousedown, 'currentTarget', { value: header });
    Object.defineProperty(mousedown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onDragStart(mousedown as unknown as React.MouseEvent);
    });

    // Simulate mouse move
    act(() => {
      const moveEvent = new MouseEvent('mousemove', { clientX: 170, clientY: 240 });
      window.dispatchEvent(moveEvent);
    });

    expect(result.current.isDragged).toBe(true);
    expect(result.current.modalStyle).toBeDefined();
    expect(result.current.modalStyle?.position).toBe('fixed');
    expect(result.current.modalStyle?.left).toBe(120); // 100 + (170 - 150)
    expect(result.current.modalStyle?.top).toBe(220); // 200 + (240 - 220)
    expect(result.current.overlayStyle).toBeDefined();
    expect(result.current.overlayStyle?.pointerEvents).toBe('none');

    // Simulate mouse up
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    // isDragged should remain true (position persists until reset)
    expect(result.current.isDragged).toBe(true);

    document.body.removeChild(dialog);
  });

  it('removes event listeners on mouseup', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 400, height: 300,
      right: 400, bottom: 300, x: 0, y: 0, toJSON: () => {},
    });

    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const mousedown = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
    Object.defineProperty(mousedown, 'target', { value: header });
    Object.defineProperty(mousedown, 'currentTarget', { value: header });
    Object.defineProperty(mousedown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onDragStart(mousedown as unknown as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

    document.body.removeChild(dialog);
  });

  it('ignores drag when no [role=dialog] ancestor exists', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    document.body.appendChild(header);

    const mousedown = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
    Object.defineProperty(mousedown, 'target', { value: header });
    Object.defineProperty(mousedown, 'currentTarget', { value: header });
    Object.defineProperty(mousedown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onDragStart(mousedown as unknown as React.MouseEvent);
    });

    expect(result.current.isDragged).toBe(false);
    document.body.removeChild(header);
  });
});
