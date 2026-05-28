/**
 * Shared DOM mocks for tests running under jsdom.
 *
 * jsdom does not implement several browser APIs that production components
 * rely on. These helpers patch the prototypes once per test file (preferably
 * inside `beforeAll`) so individual tests can be written against the real DOM
 * APIs without scattered boilerplate.
 *
 * @example
 * ```ts
 * import { stubScrollIntoView } from '../test-utils/domMocks';
 *
 * beforeAll(() => stubScrollIntoView());
 * ```
 */
/* v8 ignore start -- test infrastructure, not production code */
import { vi } from 'vitest';

/**
 * Patch `Element.prototype.scrollIntoView` with a `vi.fn()` stub. Returns the
 * mock so tests can assert on call args / counts when needed.
 */
export function stubScrollIntoView(): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  Element.prototype.scrollIntoView = fn as unknown as typeof Element.prototype.scrollIntoView;
  return fn;
}

/**
 * Install a no-op ResizeObserver on the global scope. jsdom does not implement
 * ResizeObserver; many libraries (ReactFlow, Monaco, etc.) require it during
 * mount.
 */
/* v8 ignore start */
export function stubResizeObserver(): void {
  class MockResizeObserver {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
/* v8 ignore stop */

/** jsdom lacks DataTransfer — minimal stub for drag events */
export function mockDataTransfer(): DataTransfer {
  const data = new Map<string, string>();
  let dropEffect = 'none';
  return {
    effectAllowed: 'all',
    get dropEffect() {
      return dropEffect;
    },
    set dropEffect(v: string) {
      dropEffect = v;
    },
    setData: (k: string, v: string) => {
      data.set(k, v);
    },
    getData: (k: string) => data.get(k) ?? '',
    clear: () => {
      data.clear();
    },
  } as unknown as DataTransfer;
}
/* v8 ignore stop */
