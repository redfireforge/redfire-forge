/**
 * Shared test utilities for WS/SSE lesson unit tests.
 * Import `makeCtx` in each individual lesson test file.
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
