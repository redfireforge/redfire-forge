/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildContextMenuItems, useTabContextMenu } from './TabContextMenu';

describe('useTabContextMenu', () => {
  it('returns null render output before a menu is opened', () => {
    const { result } = renderHook(() => useTabContextMenu());

    expect(result.current.menuState).toBeNull();
    expect(result.current.renderMenu([], vi.fn())).toBeNull();
  });

  it('opens, renders, and closes the menu', () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useTabContextMenu());

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 42,
      clientY: 84,
    } as unknown as React.MouseEvent;

    act(() => result.current.openMenu('tab-1', event));

    expect(result.current.menuState).toEqual({ tabId: 'tab-1', x: 42, y: 84 });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();

    const menu = result.current.renderMenu(
      [
        { id: 'rename', label: 'Rename Tab' },
        { id: 'danger', label: 'Danger', danger: true, dividerBefore: true },
      ],
      onAction,
    );

    render(<>{menu}</>);

    expect(screen.getByTestId('studio-tab-ctx-menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Danger' })).toHaveClass('studio-tab-ctx-item--danger');
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename Tab' }));
    expect(onAction).toHaveBeenCalledWith('rename');

    act(() => result.current.closeMenu());
    expect(result.current.menuState).toBeNull();
  });

  it('closes via outside click and handles viewport overflow repositioning', () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useTabContextMenu());

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 500,
      clientY: 500,
    } as unknown as React.MouseEvent;

    act(() => result.current.openMenu('tab-2', event));

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 180 });

    const original = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'studio-tab-ctx-menu') {
        return {
          x: 0,
          y: 0,
          width: 120,
          height: 80,
          top: 500,
          left: 500,
          right: 260,
          bottom: 220,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return original.call(this);
    });

    const menu = result.current.renderMenu([{ id: 'rename', label: 'Rename Tab' }], onAction);
    render(<>{menu}</>);

    const menuEl = screen.getByTestId('studio-tab-ctx-menu');
    expect(menuEl.style.left).toBe('76px');
    expect(menuEl.style.top).toBe('96px');

    fireEvent.mouseDown(document.body);
    expect(result.current.menuState).toBeNull();
  });

  it('buildContextMenuItems applies expected disabled states', () => {
    const items = buildContextMenuItems({
      tabId: 'tab-x',
      tabLabel: 'X',
      tabIndex: 2,
      totalTabs: 3,
      canDuplicate: false,
      canClose: false,
    });

    expect(items.find((item) => item.id === 'duplicate')?.disabled).toBe(true);
    expect(items.find((item) => item.id === 'close')?.disabled).toBe(true);
    expect(items.find((item) => item.id === 'close-right')?.disabled).toBe(true);
  });
});