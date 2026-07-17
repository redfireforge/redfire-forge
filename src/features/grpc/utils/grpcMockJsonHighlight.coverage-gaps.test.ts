import { describe, expect, it } from 'vitest';
import { highlightJsonTokens } from './grpcMockJsonHighlight';

describe('grpcMockJsonHighlight coverage gaps', () => {
  it('highlights JSON keys, values, numbers, booleans, null, and punctuation', () => {
    const json = '{"name":"grpc","count":42,"ok":true,"empty":null,[1,2]}';
    const html = highlightJsonTokens(json);

    expect(html).toContain('<span class="grpc-json-key">"name"</span>');
    expect(html).toContain('<span class="grpc-json-str">"grpc"</span>');
    expect(html).toContain('<span class="grpc-json-num">42</span>');
    expect(html).toContain('<span class="grpc-json-bool">true</span>');
    expect(html).toContain('<span class="grpc-json-null">null</span>');
    expect(html).toContain('<span class="grpc-json-punc">{</span>');
    expect(html).toContain('<span class="grpc-json-punc">:</span>');
    expect(html).toContain('<span class="grpc-json-punc">,</span>');
    expect(html).toContain('<span class="grpc-json-punc">[</span>');
    expect(html).toContain('<span class="grpc-json-punc">]</span>');
  });

  it('escapes HTML entities and preserves trailing whitespace', () => {
    const json = '{"unsafe":"<script>&amp;"}  \n';
    const html = highlightJsonTokens(json);

    expect(html).toContain('&lt;script&gt;&amp;amp;');
    expect(html).not.toContain('<script>');
    expect(html.endsWith('  \n')).toBe(true);
  });

  it('returns escaped plain text when no tokens match', () => {
    expect(highlightJsonTokens('   ')).toBe('   ');
    expect(highlightJsonTokens('&<>')).toBe('&amp;&lt;&gt;');
  });

  it('highlights negative and scientific notation numbers', () => {
    const html = highlightJsonTokens('{"delta":-1.5,"exp":2e3}');
    expect(html).toContain('<span class="grpc-json-num">-1.5</span>');
    expect(html).toContain('<span class="grpc-json-num">2e3</span>');
  });

  it('highlights false boolean distinctly from true', () => {
    const html = highlightJsonTokens('{"enabled":false}');
    expect(html).toContain('<span class="grpc-json-bool">false</span>');
  });

  it('escapes leading whitespace before the first token and omits trailing slice when input ends on a token', () => {
    const withLeading = '  {"k":1}';
    const leadingHtml = highlightJsonTokens(withLeading);
    expect(leadingHtml.startsWith('  ')).toBe(true);
    expect(leadingHtml).toContain('<span class="grpc-json-key">"k"</span>');

    const exactEnd = '{"done":true}';
    const endHtml = highlightJsonTokens(exactEnd);
    expect(endHtml).toContain('<span class="grpc-json-bool">true</span>');
    expect(endHtml.endsWith('</span>')).toBe(true);
  });
});
