/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalDrag } from './useModalDrag';

describe('useModalDrag coverage gaps', () => {
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
});
