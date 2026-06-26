/**
 * Shared test utilities for WS/SSE lesson unit tests.
 * Import `makeCtx` and `makeVisible` in each individual lesson test file.
 */
import { vi } from 'vitest';
import type { DemoActionContext } from '../../types';

export function makeCtx(): DemoActionContext {
  return {
    navigateToTab: vi.fn(),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    delay: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * jsdom does not do layout, so getBoundingClientRect() always returns zero.
 * firstVisible/firstVisibleEl skip elements with zero dimensions.
 * Call makeVisible(el) on any element that should be found by those helpers.
 */
export function makeVisible(el: Element): void {
  (el as HTMLElement).getBoundingClientRect = () => ({
    width: 100,
    height: 20,
    top: 0,
    left: 0,
    right: 100,
    bottom: 20,
    x: 0,
    y: 0,
    toJSON: () => '{}',
  } as DOMRect);
}
