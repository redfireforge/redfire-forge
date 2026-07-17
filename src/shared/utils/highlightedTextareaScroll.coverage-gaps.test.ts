/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { syncHighlightedTextareaScroll } from './highlightedTextareaScroll';

describe('highlightedTextareaScroll coverage gaps', () => {
  it('no-ops when textarea or backdrop is null', () => {
    expect(() => syncHighlightedTextareaScroll(null, null)).not.toThrow();
    const backdrop = document.createElement('pre');
    expect(() => syncHighlightedTextareaScroll(null, backdrop)).not.toThrow();
    const textarea = document.createElement('textarea');
    expect(() => syncHighlightedTextareaScroll(textarea, null)).not.toThrow();
  });

  it('mirrors textarea scroll onto the backdrop', () => {
    const textarea = document.createElement('textarea');
    const backdrop = document.createElement('pre');
    textarea.scrollTop = 42;
    textarea.scrollLeft = 7;
    syncHighlightedTextareaScroll(textarea, backdrop);
    expect(backdrop.scrollTop).toBe(42);
    expect(backdrop.scrollLeft).toBe(7);
  });
});
