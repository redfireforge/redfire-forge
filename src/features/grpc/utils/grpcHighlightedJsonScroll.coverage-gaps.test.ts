/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { syncHighlightedJsonScrollPosition } from './grpcHighlightedJsonScroll';

describe('grpcHighlightedJsonScroll coverage gaps', () => {
  it('no-ops when textarea or backdrop refs are missing', () => {
    expect(() => syncHighlightedJsonScrollPosition(null, null)).not.toThrow();
    expect(() => syncHighlightedJsonScrollPosition(document.createElement('textarea'), null)).not.toThrow();
    expect(() => syncHighlightedJsonScrollPosition(null, document.createElement('pre'))).not.toThrow();
  });

  it('syncs backdrop scroll position from textarea', () => {
    const textarea = document.createElement('textarea');
    const backdrop = document.createElement('pre');
    Object.defineProperty(textarea, 'scrollTop', { value: 42, writable: true, configurable: true });
    Object.defineProperty(textarea, 'scrollLeft', { value: 12, writable: true, configurable: true });
    Object.defineProperty(backdrop, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(backdrop, 'scrollLeft', { value: 0, writable: true, configurable: true });

    syncHighlightedJsonScrollPosition(textarea, backdrop);

    expect(backdrop.scrollTop).toBe(42);
    expect(backdrop.scrollLeft).toBe(12);
  });
});
