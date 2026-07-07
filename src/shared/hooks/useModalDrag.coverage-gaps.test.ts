/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalDrag } from './useModalDrag';

describe('useModalDrag coverage gaps', () => {
  it('ignores non-primary mouse pointer drags', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    const pointerDown = new PointerEvent('pointerdown', {
      pointerType: 'mouse',
      button: 1,
      clientX: 10,
      clientY: 10,
      bubbles: true,
    });
    Object.defineProperty(pointerDown, 'target', { value: header });
    Object.defineProperty(pointerDown, 'currentTarget', { value: header });

    act(() => {
      result.current.onPointerDragStart(pointerDown as unknown as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(false);
    expect(result.current.isDragged).toBe(false);
    document.body.removeChild(dialog);
  });

  it('does not start drag when current target is not inside a dialog', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    document.body.appendChild(header);

    const mouseDown = new MouseEvent('mousedown', { clientX: 20, clientY: 20, bubbles: true });
    const preventDefault = vi.fn();
    Object.defineProperty(mouseDown, 'target', { value: header });
    Object.defineProperty(mouseDown, 'currentTarget', { value: header });
    Object.defineProperty(mouseDown, 'preventDefault', { value: preventDefault });

    act(() => {
      result.current.onDragStart(mouseDown as unknown as React.MouseEvent);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.isDragging).toBe(false);
    expect(result.current.modalStyle).toBeUndefined();
    document.body.removeChild(header);
  });

  it('reuses an existing drag position as the next drag origin', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 80, top: 60, width: 400, height: 300,
      right: 480, bottom: 360, x: 80, y: 60, toJSON: () => {},
    });

    const startDrag = (clientX: number, clientY: number) => {
      const mousedown = new MouseEvent('mousedown', { clientX, clientY, bubbles: true });
      Object.defineProperty(mousedown, 'target', { value: header });
      Object.defineProperty(mousedown, 'currentTarget', { value: header });
      Object.defineProperty(mousedown, 'preventDefault', { value: vi.fn() });
      act(() => {
        result.current.onDragStart(mousedown as unknown as React.MouseEvent);
      });
    };

    startDrag(100, 80);
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.modalStyle?.left).toBe(100);

    startDrag(130, 110);
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 130 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.modalStyle?.left).toBe(120);

    document.body.removeChild(dialog);
  });

  it('skips anchor positioning when the modal ref is missing', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-testid', 'missing-modal-anchor');
    document.body.appendChild(anchor);

    const { result } = renderHook(() => useModalDrag(true, {
      modalRef: { current: null },
      anchor: { selector: '[data-testid="missing-modal-anchor"]' },
    }));

    expect(result.current.isDragged).toBe(false);
    document.body.removeChild(anchor);
  });

  it('skips anchor positioning when anchor selector does not resolve', () => {
    const modalRef = { current: document.createElement('div') };
    document.body.appendChild(modalRef.current);

    const { result } = renderHook(() => useModalDrag(true, {
      modalRef,
      anchor: { selector: '[data-testid="missing-anchor"]' },
    }));

    expect(result.current.isDragged).toBe(false);
    expect(result.current.modalStyle).toBeUndefined();
    document.body.removeChild(modalRef.current);
  });

  it('ignores pointer cancel events after pointer drag starts', () => {
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

    const pointerDown = new PointerEvent('pointerdown', { clientX: 5, clientY: 5, bubbles: true, pointerId: 9 });
    Object.defineProperty(pointerDown, 'target', { value: header });
    Object.defineProperty(pointerDown, 'currentTarget', { value: header });
    Object.defineProperty(pointerDown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onPointerDragStart(pointerDown as unknown as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 9 }));
    });

    expect(result.current.isDragging).toBe(false);
    document.body.removeChild(dialog);
  });

  it('keeps the same anchored position when layout recomputes to identical coordinates', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-testid', 'stable-anchor');
    document.body.appendChild(anchor);
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      left: 10, top: 20, width: 300, height: 200,
      right: 310, bottom: 220, x: 10, y: 20, toJSON: () => {},
    });

    const modalRef = { current: document.createElement('div') };
    document.body.appendChild(modalRef.current);
    vi.spyOn(modalRef.current, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 100, height: 80,
      right: 100, bottom: 80, x: 0, y: 0, toJSON: () => {},
    });

    const { result, rerender } = renderHook(
      ({ open }) => useModalDrag(open, {
        modalRef,
        anchor: { selector: '[data-testid="stable-anchor"]', hAlign: 'center', vAlign: 'top' },
      }),
      { initialProps: { open: true } },
    );

    const firstLeft = result.current.modalStyle?.left;
    rerender({ open: true });
    expect(result.current.modalStyle?.left).toBe(firstLeft);

    document.body.removeChild(anchor);
    document.body.removeChild(modalRef.current);
  });

  it('keeps anchored style when anchor selector changes but computed position is identical', () => {
    const anchorA = document.createElement('div');
    anchorA.setAttribute('data-testid', 'stable-anchor-a');
    document.body.appendChild(anchorA);
    vi.spyOn(anchorA, 'getBoundingClientRect').mockReturnValue({
      left: 20, top: 30, width: 280, height: 160,
      right: 300, bottom: 190, x: 20, y: 30, toJSON: () => {},
    });

    const anchorB = document.createElement('div');
    anchorB.setAttribute('data-testid', 'stable-anchor-b');
    document.body.appendChild(anchorB);
    vi.spyOn(anchorB, 'getBoundingClientRect').mockReturnValue({
      left: 20, top: 30, width: 280, height: 160,
      right: 300, bottom: 190, x: 20, y: 30, toJSON: () => {},
    });

    const modalRef = { current: document.createElement('div') };
    document.body.appendChild(modalRef.current);
    vi.spyOn(modalRef.current, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 120, height: 90,
      right: 120, bottom: 90, x: 0, y: 0, toJSON: () => {},
    });

    const { result, rerender } = renderHook(
      ({ selector }) => useModalDrag(true, {
        modalRef,
        anchor: { selector, hAlign: 'center', vAlign: 'top' },
      }),
      { initialProps: { selector: '[data-testid="stable-anchor-a"]' } },
    );

    const firstStyle = result.current.modalStyle;
    rerender({ selector: '[data-testid="stable-anchor-b"]' });
    expect(result.current.modalStyle).toEqual(firstStyle);

    document.body.removeChild(anchorA);
    document.body.removeChild(anchorB);
    document.body.removeChild(modalRef.current);
  });

  it('uses default anchor alignment and padding when not provided', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-testid', 'default-anchor');
    document.body.appendChild(anchor);
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      left: 40, top: 50, width: 260, height: 180,
      right: 300, bottom: 230, x: 40, y: 50, toJSON: () => {},
    });

    const modalRef = { current: document.createElement('div') };
    document.body.appendChild(modalRef.current);
    vi.spyOn(modalRef.current, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 100, height: 80,
      right: 100, bottom: 80, x: 0, y: 0, toJSON: () => {},
    });

    const { result } = renderHook(() => useModalDrag(true, {
      modalRef,
      anchor: { selector: '[data-testid="default-anchor"]' },
    }));

    expect(result.current.modalStyle?.left).toBe(120);
    expect(result.current.modalStyle?.top).toBe(50);
    expect(result.current.modalStyle).not.toHaveProperty('width');

    document.body.removeChild(anchor);
    document.body.removeChild(modalRef.current);
  });

  it('supports right and bottom anchor alignment with padding offsets', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-testid', 'edge-anchor');
    document.body.appendChild(anchor);
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 200, width: 300, height: 220,
      right: 400, bottom: 420, x: 100, y: 200, toJSON: () => {},
    });

    const modalRef = { current: document.createElement('div') };
    document.body.appendChild(modalRef.current);
    vi.spyOn(modalRef.current, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 120, height: 80,
      right: 120, bottom: 80, x: 0, y: 0, toJSON: () => {},
    });

    const { result } = renderHook(() => useModalDrag(true, {
      modalRef,
      anchor: {
        selector: '[data-testid="edge-anchor"]',
        hAlign: 'right',
        vAlign: 'bottom',
        padding: { right: 10, bottom: 12 },
      },
    }));

    expect(result.current.modalStyle?.left).toBe(270);
    expect(result.current.modalStyle?.top).toBe(328);

    document.body.removeChild(anchor);
    document.body.removeChild(modalRef.current);
  });

  it('ignores drag starts from a text node inside a button control', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    const button = document.createElement('button');
    const label = document.createTextNode('Drag blocked');
    button.appendChild(label);
    header.appendChild(button);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    const mouseDown = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
    const preventDefault = vi.fn();
    Object.defineProperty(mouseDown, 'target', { value: label });
    Object.defineProperty(mouseDown, 'currentTarget', { value: header });
    Object.defineProperty(mouseDown, 'preventDefault', { value: preventDefault });

    act(() => {
      result.current.onDragStart(mouseDown as unknown as React.MouseEvent);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
    expect(result.current.modalStyle).toBeUndefined();

    document.body.removeChild(dialog);
  });

  it('clamps drag position to the viewport when constrained', () => {
    const { result } = renderHook(() => useModalDrag(true, {
      constrainToViewport: true,
      viewportPadding: 12,
    }));

    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 50, top: 40, width: 200, height: 150,
      right: 250, bottom: 190, x: 50, y: 40, toJSON: () => {},
    });

    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 260 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 230 });

    const mouseDown = new MouseEvent('mousedown', { clientX: 60, clientY: 50, bubbles: true });
    Object.defineProperty(mouseDown, 'target', { value: header });
    Object.defineProperty(mouseDown, 'currentTarget', { value: header });
    Object.defineProperty(mouseDown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onDragStart(mouseDown as unknown as React.MouseEvent);
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500 }));
    });

    expect(result.current.modalStyle?.left).toBe(48);
    expect(result.current.modalStyle?.top).toBe(68);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
    document.body.removeChild(dialog);
  });

  it('guards mouse-move updates when drag state has already been cleared', () => {
    const added = new Map<string, EventListener>();
    const addSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (typeof listener === 'function') {
        added.set(type, listener as EventListener);
      }
    });
    const removeSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});

    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 300, height: 200,
      right: 300, bottom: 200, x: 0, y: 0, toJSON: () => {},
    });

    const down = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
    Object.defineProperty(down, 'target', { value: header });
    Object.defineProperty(down, 'currentTarget', { value: header });
    Object.defineProperty(down, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onDragStart(down as unknown as React.MouseEvent);
    });

    const move = added.get('mousemove');
    const up = added.get('mouseup');
    expect(move).toBeTypeOf('function');
    expect(up).toBeTypeOf('function');

    act(() => {
      up?.(new MouseEvent('mouseup'));
      move?.(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }));
    });

    expect(result.current.isDragging).toBe(false);
    expect(removeSpy).toHaveBeenCalled();

    document.body.removeChild(dialog);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
