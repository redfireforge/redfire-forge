import { describe, expect, it } from 'vitest';
import { escapeHtml, highlightJsonHtml } from './jsonHighlightHtml';

describe('escapeHtml', () => {
  it('escapes ampersand, less-than, greater-than', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('highlightJsonHtml', () => {
  it('wraps object keys and primitive values in span classes', () => {
    const input = `{
  "name": "alice",
  "n": 42,
  "ok": true,
  "x": null
}`;
    const out = highlightJsonHtml(input);
    expect(out).toContain('class="json-hl-key">"name"</span>');
    expect(out).toContain('class="json-hl-str">"alice"</span>');
    expect(out).toContain('class="json-hl-num">42</span>');
    expect(out).toContain('class="json-hl-kw">true</span>');
    expect(out).toContain('class="json-hl-kw">null</span>');
  });

  it('escapes raw HTML in JSON string values before highlighting', () => {
    const input = '{"evil": "<script>"}';
    const out = highlightJsonHtml(input);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });
});
