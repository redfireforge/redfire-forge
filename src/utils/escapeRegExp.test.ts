import { describe, it, expect } from 'vitest';
import { escapeRegExp } from './helpers';

describe('escapeRegExp', () => {
  it('escapes dots', () => {
    expect(escapeRegExp('a.b')).toBe('a\\.b');
  });

  it('escapes asterisks', () => {
    expect(escapeRegExp('a*b')).toBe('a\\*b');
  });

  it('escapes plus signs', () => {
    expect(escapeRegExp('a+b')).toBe('a\\+b');
  });

  it('escapes question marks', () => {
    expect(escapeRegExp('a?b')).toBe('a\\?b');
  });

  it('escapes caret and dollar sign', () => {
    expect(escapeRegExp('^start$')).toBe('\\^start\\$');
  });

  it('escapes curly braces', () => {
    expect(escapeRegExp('{3}')).toBe('\\{3\\}');
  });

  it('escapes parentheses', () => {
    expect(escapeRegExp('(group)')).toBe('\\(group\\)');
  });

  it('escapes pipe', () => {
    expect(escapeRegExp('a|b')).toBe('a\\|b');
  });

  it('escapes square brackets', () => {
    expect(escapeRegExp('[abc]')).toBe('\\[abc\\]');
  });

  it('escapes backslash', () => {
    expect(escapeRegExp('a\\b')).toBe('a\\\\b');
  });

  it('returns plain text unchanged', () => {
    expect(escapeRegExp('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeRegExp('')).toBe('');
  });

  it('produces a pattern that matches the literal input', () => {
    const literal = 'price is $9.99 (USD)';
    const escaped = escapeRegExp(literal);
    const re = new RegExp(escaped);
    expect(re.test(literal)).toBe(true);
    expect(re.test('price is 99')).toBe(false);
  });
});
