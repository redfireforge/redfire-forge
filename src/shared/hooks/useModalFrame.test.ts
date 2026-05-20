/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MouseEvent as ReactMouseEvent } from 'react';
import { useModalFrame } from './useModalFrame';

describe('useModalFrame', () => {
  it('returns draggable header bindings when collapsed', () => {
    const { result } = renderHook(() => useModalFrame());

    expect(result.current.expanded).toBe(false);
    expect(result.current.headerDragStyle).toEqual({ cursor: 'move' });
    expect(typeof result.current.onHeaderMouseDown).toBe('function');
  });

  it('disables header drag bindings when expanded', () => {
    const { result } = renderHook(() => useModalFrame());

    act(() => {
      result.current.toggleExpand();
    });

    expect(result.current.expanded).toBe(true);
    expect(result.current.headerDragStyle).toBeUndefined();
    expect(result.current.onHeaderMouseDown).toBeUndefined();
  });

  it('merges drag positioning into dialog style and clears it after expanding', () => {
    const { result } = renderHook(() => useModalFrame());
    const header = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.appendChild(header);
    document.body.appendChild(dialog);

    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 80,
      width: 640,
      height: 420,
      right: 740,
      bottom: 500,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    } as DOMRect);

    const mousedown = new MouseEvent('mousedown', { clientX: 120, clientY: 100, bubbles: true });
    Object.defineProperty(mousedown, 'target', { value: header });
    Object.defineProperty(mousedown, 'currentTarget', { value: header });
    Object.defineProperty(mousedown, 'preventDefault', { value: vi.fn() });

    act(() => {
      result.current.onHeaderMouseDown?.(mousedown as unknown as ReactMouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 130 }));
    });

    expect(result.current.dialogStyle?.position).toBe('fixed');
    expect(result.current.dialogStyle?.left).toBe(130);
    expect(result.current.dialogStyle?.top).toBe(110);

    act(() => {
      result.current.toggleExpand();
    });

    expect(result.current.dialogStyle?.position).toBeUndefined();
    expect(result.current.dialogStyle?.left).toBeUndefined();
    expect(result.current.dialogStyle?.top).toBeUndefined();

    document.body.removeChild(dialog);
  });
});