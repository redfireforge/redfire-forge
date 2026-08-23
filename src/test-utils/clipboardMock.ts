/**
 * Shared test helpers for mocking `navigator.clipboard`.
 *
 * Many tests check the clipboard bridge — instead of duplicating the
 * `Object.defineProperty(navigator, 'clipboard', { … })` boilerplate, call
 * `installClipboardMock()` from `beforeEach` and use the returned mock to
 * make assertions.
 *
 * `installEmptyClipboard` is used by tests that need to verify the
 * "clipboard not available" code path; it returns a restore function so the
 * original `navigator.clipboard` can be put back after the test.
 *
 * @example
 * ```ts
 * import { installClipboardMock } from '@test-utils/clipboardMock';
 *
 * let writeText: ReturnType<typeof installClipboardMock>;
 * beforeEach(() => { writeText = installClipboardMock(); });
 * it('copies content', () => {
 *   // ...trigger copy action...
 *   expect(writeText).toHaveBeenCalledWith('expected text');
 * });
 * ```
 */
import { vi } from 'vitest';
import type { Mock } from 'vitest';

export function installClipboardMock(): Mock {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

/**
 * Replace `navigator.clipboard` with an empty object so calls to
 * `writeText`/`readText` are `undefined`. Returns a `restore` function the
 * test should call to put the original clipboard back.
 */
export function installClipboardReadMock(): Mock {
  const readText = vi.fn().mockResolvedValue('');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { readText },
  });
  return readText;
}

export function installEmptyClipboard(): () => void {
  const prev = (navigator as Navigator & { clipboard?: unknown }).clipboard;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {} });
  return () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: prev });
  };
}
