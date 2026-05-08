/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  typeColor,
  TYPE_COLORS,
  getValuePreview,
  bestEffortFormat,
  countTextMatches,
  ChevronIcon,
} from './jsonTreeShared';

describe('TYPE_COLORS', () => {
  it('has correct colors for all four types', () => {
    expect(TYPE_COLORS.string).toBe('#86efac');
    expect(TYPE_COLORS.number).toBe('#fbbf24');
    expect(TYPE_COLORS.boolean).toBe('#c084fc');
    expect(TYPE_COLORS.null).toBe('#f87171');
  });
});

describe('typeColor', () => {
  it('returns mapped color for known types', () => {
    expect(typeColor('string')).toBe('#86efac');
    expect(typeColor('number')).toBe('#fbbf24');
    expect(typeColor('boolean')).toBe('#c084fc');
    expect(typeColor('null')).toBe('#f87171');
  });

  it('returns fallback for object, array, and unknown', () => {
    expect(typeColor('object')).toBe('var(--text-muted)');
    expect(typeColor('array')).toBe('var(--text-muted)');
    expect(typeColor('xyz')).toBe('var(--text-muted)');
  });
});

describe('getValuePreview', () => {
  it('formats objects with key count', () => {
    expect(getValuePreview('object', {}, 3)).toBe('{ 3 keys }');
    expect(getValuePreview('object', {}, 0)).toBe('{ 0 keys }');
  });

  it('formats arrays with item count', () => {
    expect(getValuePreview('array', [], 5)).toBe('[ 5 items ]');
    expect(getValuePreview('array', [], 0)).toBe('[ 0 items ]');
  });

  it('formats short strings with quotes', () => {
    expect(getValuePreview('string', 'hello', 0)).toBe('"hello"');
  });

  it('truncates strings exceeding maxStringLen (default 60)', () => {
    const long = 'a'.repeat(61);
    expect(getValuePreview('string', long, 0)).toBe(`"${'a'.repeat(60)}..."`);
  });

  it('does not truncate strings at exactly maxStringLen', () => {
    const exact = 'x'.repeat(60);
    expect(getValuePreview('string', exact, 0)).toBe(`"${exact}"`);
  });

  it('respects custom maxStringLen', () => {
    expect(getValuePreview('string', 'abcdefghij', 0, 5)).toBe('"abcde..."');
  });

  it('formats null', () => {
    expect(getValuePreview('null', null, 0)).toBe('null');
  });

  it('formats numbers', () => {
    expect(getValuePreview('number', 42, 0)).toBe('42');
    expect(getValuePreview('number', 3.14, 0)).toBe('3.14');
  });

  it('formats booleans', () => {
    expect(getValuePreview('boolean', true, 0)).toBe('true');
    expect(getValuePreview('boolean', false, 0)).toBe('false');
  });
});

describe('bestEffortFormat', () => {
  it('returns pretty-printed JSON when input parses', () => {
    expect(bestEffortFormat('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(bestEffortFormat('[1,2]')).toBe('[\n  1,\n  2\n]');
  });

  it('returns plain text unchanged when it does not look like JSON', () => {
    expect(bestEffortFormat('plain text')).toBe('plain text');
    expect(bestEffortFormat('985')).toBe('985');
    expect(bestEffortFormat('')).toBe('');
  });

  it('formats brace-heavy pseudo-JSON and clamps negative indent on extra closers', () => {
    const out = bestEffortFormat('{}}');
    expect(out).toContain('{');
    expect(out).toContain('}');
    expect(out.split('}').length).toBeGreaterThanOrEqual(3);
  });

  it('handles leading whitespace before a JSON-like opener', () => {
    const out = bestEffortFormat('  \n\t[1,2');
    expect(out.trimStart().startsWith('[')).toBe(true);
  });

  it('respects quoted regions and escapes when not valid JSON', () => {
    const malformed = '{"k":"v\\"x"';
    const out = bestEffortFormat(malformed);
    expect(out).toContain('"');
    expect(out).toContain('k');
  });

  it('adds newlines after commas and spaces after colons in structural scan', () => {
    const out = bestEffortFormat('{a:1,b:2');
    expect(out).toContain(': ');
    expect(out).toContain(',\n');
  });
});

describe('countTextMatches', () => {
  it('returns 0 for empty search term', () => {
    expect(countTextMatches('hello', '')).toBe(0);
  });

  it('returns 0 when there are no matches', () => {
    expect(countTextMatches('hello world', 'xyz')).toBe(0);
  });

  it('counts a single match', () => {
    expect(countTextMatches('hello world', 'world')).toBe(1);
  });

  it('counts multiple non-overlapping matches', () => {
    expect(countTextMatches('aba bab aba', 'aba')).toBe(2);
  });

  it('matches case-insensitively', () => {
    expect(countTextMatches('Hello HELLO hello', 'hel')).toBe(3);
  });
});

describe('ChevronIcon', () => {
  it('renders an svg chevron', () => {
    const { container } = render(React.createElement(ChevronIcon));
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.querySelector('path')).toBeTruthy();
  });
});
