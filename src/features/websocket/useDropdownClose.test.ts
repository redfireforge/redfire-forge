// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDropdownClose } from './useDropdownClose';

describe('useDropdownClose', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a ref object', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDropdownClose(false, onClose));
    expect(result.current).toHaveProperty('current');
  });

  it('does not add listeners when isOpen is false', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const onClose = vi.fn();
    renderHook(() => useDropdownClose(false, onClose));
    expect(addSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('adds mousedown and keydown listeners when isOpen is true', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const onClose = vi.fn();
    renderHook(() => useDropdownClose(true, onClose));
    expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('calls onClose on Escape keydown', () => {
    const onClose = vi.fn();
    renderHook(() => useDropdownClose(true, onClose));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on non-Escape keydown', () => {
    const onClose = vi.fn();
    renderHook(() => useDropdownClose(true, onClose));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on outside mousedown when ref is attached', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDropdownClose(true, onClose));

    // Attach a DOM element to the ref so outside-click detection works
    const container = document.createElement('div');
    document.body.appendChild(container);
    (result.current as React.MutableRefObject<HTMLDivElement | null>).current = container;

    // Click on document body (outside the container)
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    act(() => {
      outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    document.body.removeChild(container);
    document.body.removeChild(outsideEl);
  });

  it('does not call onClose on mousedown inside ref element', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDropdownClose(true, onClose));

    // Create and attach a DOM element to the ref
    const container = document.createElement('div');
    const child = document.createElement('span');
    container.appendChild(child);
    document.body.appendChild(container);
    (result.current as React.MutableRefObject<HTMLDivElement | null>).current = container;

    act(() => {
      container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Click on child element inside container
    act(() => {
      child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it('removes listeners on cleanup', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useDropdownClose(true, onClose));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes listeners when isOpen changes to false', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ isOpen }) => useDropdownClose(isOpen, onClose),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false });
    expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
