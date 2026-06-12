/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNextTabIndex, handleTabListArrowKeys } from './tabListKeyboard';

describe('getNextTabIndex', () => {
  it('returns null when there are no tabs', () => {
    expect(getNextTabIndex('ArrowRight', 0, 0)).toBeNull();
    expect(getNextTabIndex('ArrowRight', 2, -1)).toBeNull();
  });

  it('returns null for non-navigation keys', () => {
    expect(getNextTabIndex('Enter', 0, 3)).toBeNull();
    expect(getNextTabIndex(' ', 1, 3)).toBeNull();
    expect(getNextTabIndex('a', 1, 3)).toBeNull();
  });

  it('moves to the next tab on ArrowRight / ArrowDown and wraps', () => {
    expect(getNextTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(getNextTabIndex('ArrowDown', 1, 3)).toBe(2);
    expect(getNextTabIndex('ArrowRight', 2, 3)).toBe(0);
  });

  it('moves to the previous tab on ArrowLeft / ArrowUp and wraps', () => {
    expect(getNextTabIndex('ArrowLeft', 2, 3)).toBe(1);
    expect(getNextTabIndex('ArrowUp', 1, 3)).toBe(0);
    expect(getNextTabIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the first tab on Home and the last on End', () => {
    expect(getNextTabIndex('Home', 2, 4)).toBe(0);
    expect(getNextTabIndex('End', 0, 4)).toBe(3);
  });
});

describe('handleTabListArrowKeys', () => {
  let container: HTMLElement;
  let tabs: HTMLButtonElement[];

  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('role', 'tablist');
    tabs = ['one', 'two', 'three'].map((label, i) => {
      const btn = document.createElement('button');
      btn.setAttribute('role', 'tab');
      btn.textContent = label;
      btn.tabIndex = i === 0 ? 0 : -1;
      container.appendChild(btn);
      return btn;
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function fireKey(key: string) {
    const preventDefault = vi.fn();
    handleTabListArrowKeys({
      key,
      currentTarget: container,
      preventDefault,
    } as unknown as React.KeyboardEvent<HTMLElement>);
    return preventDefault;
  }

  it('moves focus and activates the next tab on ArrowRight', () => {
    tabs[0].focus();
    const onClick = vi.fn();
    tabs[1].addEventListener('click', onClick);
    const preventDefault = fireKey('ArrowRight');
    expect(document.activeElement).toBe(tabs[1]);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('wraps from the last tab back to the first on ArrowRight', () => {
    tabs[2].focus();
    fireKey('ArrowRight');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('jumps to the last tab on End and the first on Home', () => {
    tabs[0].focus();
    fireKey('End');
    expect(document.activeElement).toBe(tabs[2]);
    fireKey('Home');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('is a no-op for non-navigation keys', () => {
    tabs[0].focus();
    const preventDefault = fireKey('Enter');
    expect(document.activeElement).toBe(tabs[0]);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('is a no-op when focus is not on a tab', () => {
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();
    const preventDefault = fireKey('ArrowRight');
    expect(document.activeElement).toBe(outside);
    expect(preventDefault).not.toHaveBeenCalled();
    outside.remove();
  });

  it('is a no-op when the container has no tabs', () => {
    const empty = document.createElement('div');
    document.body.appendChild(empty);
    const preventDefault = vi.fn();
    handleTabListArrowKeys({
      key: 'ArrowRight',
      currentTarget: empty,
      preventDefault,
    } as unknown as React.KeyboardEvent<HTMLElement>);
    expect(preventDefault).not.toHaveBeenCalled();
    empty.remove();
  });
});
