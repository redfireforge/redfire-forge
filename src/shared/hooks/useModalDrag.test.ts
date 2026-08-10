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

  it.each([
    ['label caption', () => {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      label.appendChild(document.createElement('input'));
      label.appendChild(caption);
      return { host: label, target: caption };
    }],
    ['anchor', () => {
      const a = document.createElement('a');
      a.setAttribute('href', '#x');
      return { host: a, target: a };
    }],
    ['opted-out element', () => {
      const el = document.createElement('div');
      el.setAttribute('data-no-drag', '');
      return { host: el, target: el };
    }],
  ])('ignores drag started on a %s', (_name, build) => {
    const { result } = renderHook(() => useModalDrag(true));
    const { host, target } = build();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(host);
    document.body.appendChild(dialog);

    const event = new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true });
    Object.defineProperty(event, 'target', { value: target });
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

    expect(result.current.isDragging).toBe(true);
    expect(result.current.isDragged).toBe(true);
    expect(result.current.modalStyle).toBeDefined();
    expect(result.current.modalStyle?.position).toBe('fixed');
    expect(result.current.modalStyle?.left).toBe(120); // 100 + (170 - 150)
    expect(result.current.modalStyle?.top).toBe(220); // 200 + (240 - 220)
    expect(result.current.overlayStyle).toBeDefined();
    expect(result.current.overlayStyle?.background).toBe('transparent');

    // Simulate mouse up
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    // Position persists, but overlay is interactive again.
    expect(result.current.isDragging).toBe(false);
    expect(result.current.isDragged).toBe(true);
    expect(result.current.overlayStyle).toBeUndefined();

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

  it('anchors modal within a selector region on open', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-testid', 'anchor-region');
    document.body.appendChild(anchor);
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      left: 200, top: 120, width: 1000, height: 700,
      right: 1200, bottom: 820, x: 200, y: 120, toJSON: () => {},
    });

    const modalRef = { current: document.createElement('div') };
    document.body.appendChild(modalRef.current);
    vi.spyOn(modalRef.current, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 920, height: 640,
      right: 920, bottom: 640, x: 0, y: 0, toJSON: () => {},
    });

    const { result } = renderHook(() => useModalDrag(true, {
      modalRef,
      anchor: {
        selector: '[data-testid="anchor-region"]',
        hAlign: 'center',
        vAlign: 'top',
        padding: { top: 4 },
      },
    }));

    expect(result.current.isDragged).toBe(true);
    expect(result.current.modalStyle?.left).toBe(240); // 200 + (1000 - 920) / 2
    expect(result.current.modalStyle?.top).toBe(124); // 120 + 4
    expect(result.current.overlayStyle).toBeUndefined();

    document.body.removeChild(anchor);
    document.body.removeChild(modalRef.current);
  });

  it('supports pointer drag lifecycle', () => {
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

    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true, pointerId: 1 });
    Object.defineProperty(pointerDown, 'target', { value: header });
    Object.defineProperty(pointerDown, 'currentTarget', { value: header });
    Object.defineProperty(pointerDown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onPointerDragStart(pointerDown as unknown as React.PointerEvent);
    });

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 30, clientY: 40, pointerId: 1 }));
    });

    expect(result.current.isDragging).toBe(true);
    expect(result.current.modalStyle?.left).toBe(20);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    });

    expect(result.current.isDragging).toBe(false);
    document.body.removeChild(dialog);
  });

  it('ignores non-primary pointer buttons', () => {
    const { result } = renderHook(() => useModalDrag(true));
    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true, button: 2, pointerId: 2 });
    Object.defineProperty(pointerDown, 'pointerType', { value: 'mouse' });
    Object.defineProperty(pointerDown, 'target', { value: header });
    Object.defineProperty(pointerDown, 'currentTarget', { value: header });
    Object.defineProperty(pointerDown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onPointerDragStart(pointerDown as unknown as React.PointerEvent);
    });

    expect(result.current.isDragged).toBe(false);
    document.body.removeChild(dialog);
  });

  it('anchors with left/right and bottom/center alignment', () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-testid', 'anchor');
    document.body.appendChild(anchor);
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, width: 800, height: 600,
      right: 900, bottom: 650, x: 100, y: 50, toJSON: () => {},
    });

    const modalRef = { current: document.createElement('div') };
    document.body.appendChild(modalRef.current);
    vi.spyOn(modalRef.current, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 200, height: 100,
      right: 200, bottom: 100, x: 0, y: 0, toJSON: () => {},
    });

    const { result: leftResult } = renderHook(() => useModalDrag(true, {
      modalRef,
      anchor: { selector: '[data-testid="anchor"]', hAlign: 'left', vAlign: 'bottom', padding: { left: 8, bottom: 12 } },
    }));
    expect(leftResult.current.modalStyle?.left).toBe(108);
    expect(leftResult.current.modalStyle?.top).toBe(538);

    const { result: centerResult } = renderHook(() => useModalDrag(true, {
      modalRef,
      anchor: { selector: '[data-testid="anchor"]', hAlign: 'right', vAlign: 'center', padding: { right: 6 } },
    }));
    expect(centerResult.current.modalStyle?.left).toBe(694);
    expect(centerResult.current.modalStyle?.top).toBe(300);

    document.body.removeChild(anchor);
    document.body.removeChild(modalRef.current);
  });
});
