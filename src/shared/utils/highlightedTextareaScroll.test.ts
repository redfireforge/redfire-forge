/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { syncHighlightedTextareaScroll } from './highlightedTextareaScroll';

describe('syncHighlightedTextareaScroll', () => {
  it('no-ops when textarea is null', () => {
    const backdrop = document.createElement('pre');
    expect(() => syncHighlightedTextareaScroll(null, backdrop)).not.toThrow();
  });

  it('no-ops when backdrop is null', () => {
    const textarea = document.createElement('textarea');
    expect(() => syncHighlightedTextareaScroll(textarea, null)).not.toThrow();
  });

  it('copies scroll offsets from textarea to backdrop', () => {
    const textarea = document.createElement('textarea');
    const backdrop = document.createElement('pre');
    textarea.scrollTop = 42;
    textarea.scrollLeft = 17;
    syncHighlightedTextareaScroll(textarea, backdrop);
    expect(backdrop.scrollTop).toBe(42);
    expect(backdrop.scrollLeft).toBe(17);
  });
});
