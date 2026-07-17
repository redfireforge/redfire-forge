/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModalEscapeClose } from './useModalEscapeClose';

describe('useModalEscapeClose', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderHook(() => useModalEscapeClose(onClose));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn();
    renderHook(() => useModalEscapeClose(onClose));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useModalEscapeClose(onClose));
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('updates handler when onClose changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useModalEscapeClose(fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('calls stopPropagation when capture option is true', () => {
    const onClose = vi.fn();
    renderHook(() => useModalEscapeClose(onClose, { capture: true }));
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    document.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call stopPropagation when capture option is false', () => {
    const onClose = vi.fn();
    renderHook(() => useModalEscapeClose(onClose, { capture: false }));
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    document.dispatchEvent(event);
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
