import { describe, it, expect } from 'vitest';
import { stringFunctions } from './stringFunctions';

function evalFn(name: string, ...args: unknown[]): unknown {
  const fn = stringFunctions.find((f) => f.name === name);
  if (!fn) throw new Error(`Function ${name} not found`);
  return fn.evaluate(...args);
}

describe('stringFunctions', () => {
  describe('$upper', () => {
    it('converts to uppercase', () => expect(evalFn('$upper', 'hello')).toBe('HELLO'));
    it('handles empty string', () => expect(evalFn('$upper', '')).toBe(''));
    it('handles number input', () => expect(evalFn('$upper', 42)).toBe('42'));
    it('handles null', () => expect(evalFn('$upper', null)).toBe(''));
  });

  describe('$lower', () => {
    it('converts to lowercase', () => expect(evalFn('$lower', 'HELLO')).toBe('hello'));
    it('handles mixed case', () => expect(evalFn('$lower', 'HeLLo WoRLd')).toBe('hello world'));
    it('handles null', () => expect(evalFn('$lower', null)).toBe(''));
  });

  describe('$trim', () => {
    it('trims whitespace', () => expect(evalFn('$trim', '  hi  ')).toBe('hi'));
    it('trims tabs and newlines', () => expect(evalFn('$trim', '\t\nhello\n\t')).toBe('hello'));
    it('handles already trimmed', () => expect(evalFn('$trim', 'clean')).toBe('clean'));
  });

  describe('$length', () => {
    it('returns string length', () => expect(evalFn('$length', 'hello')).toBe(5));
    it('returns array length', () => expect(evalFn('$length', [1, 2, 3])).toBe(3));
    it('returns 0 for empty string', () => expect(evalFn('$length', '')).toBe(0));
    it('returns 0 for empty array', () => expect(evalFn('$length', [])).toBe(0));
    it('handles null', () => expect(evalFn('$length', null)).toBe(0));
  });

  describe('$concat', () => {
    it('concatenates two strings', () => expect(evalFn('$concat', 'hello', ' world')).toBe('hello world'));
    it('concatenates three values', () => expect(evalFn('$concat', 'a', 'b', 'c')).toBe('abc'));
    it('handles number coercion', () => expect(evalFn('$concat', 'val:', 42)).toBe('val:42'));
    it('handles single arg', () => expect(evalFn('$concat', 'only')).toBe('only'));
  });

  describe('$substring', () => {
    it('extracts with start and length', () => expect(evalFn('$substring', 'hello', 1, 3)).toBe('ell'));
    it('extracts from start without length', () => expect(evalFn('$substring', 'hello', 2)).toBe('llo'));
    it('returns empty when start exceeds length', () => expect(evalFn('$substring', 'hi', 10)).toBe(''));
    it('handles zero start', () => expect(evalFn('$substring', 'abc', 0, 1)).toBe('a'));
  });

  describe('$replace', () => {
    it('replaces all occurrences', () => expect(evalFn('$replace', 'aaa', 'a', 'b')).toBe('bbb'));
    it('replaces substring', () => expect(evalFn('$replace', 'hello world', 'world', 'there')).toBe('hello there'));
    it('handles no match', () => expect(evalFn('$replace', 'hello', 'xyz', 'abc')).toBe('hello'));
    it('handles empty search', () => expect(evalFn('$replace', 'ab', '', '-')).toBe('a-b'));
  });

  describe('$split', () => {
    it('splits by comma', () => expect(evalFn('$split', 'a,b,c', ',')).toEqual(['a', 'b', 'c']));
    it('splits by space', () => expect(evalFn('$split', 'hello world', ' ')).toEqual(['hello', 'world']));
    it('returns single-element array when delimiter not found', () => expect(evalFn('$split', 'abc', ',')).toEqual(['abc']));
  });

  describe('$join', () => {
    it('joins array with delimiter', () => expect(evalFn('$join', ['a', 'b', 'c'], '-')).toBe('a-b-c'));
    it('joins with empty delimiter', () => expect(evalFn('$join', ['x', 'y'], '')).toBe('xy'));
    it('wraps non-array in array', () => expect(evalFn('$join', 'solo', ',')).toBe('solo'));
    it('handles empty array', () => expect(evalFn('$join', [], ',')).toBe(''));
  });

  describe('$startsWith', () => {
    it('returns true for matching prefix', () => expect(evalFn('$startsWith', 'hello world', 'hello')).toBe(true));
    it('returns false for non-matching prefix', () => expect(evalFn('$startsWith', 'hello', 'world')).toBe(false));
    it('returns true for empty prefix', () => expect(evalFn('$startsWith', 'anything', '')).toBe(true));
  });

  describe('$endsWith', () => {
    it('returns true for matching suffix', () => expect(evalFn('$endsWith', 'hello world', 'world')).toBe(true));
    it('returns false for non-matching suffix', () => expect(evalFn('$endsWith', 'hello', 'xyz')).toBe(false));
  });

  describe('$padStart', () => {
    it('pads with specified character', () => expect(evalFn('$padStart', '42', 5, '0')).toBe('00042'));
    it('pads with space by default', () => expect(evalFn('$padStart', 'hi', 5)).toBe('   hi'));
    it('no padding when already long enough', () => expect(evalFn('$padStart', 'hello', 3, '0')).toBe('hello'));
    it('falls back to space when pad is empty string', () => expect(evalFn('$padStart', 'hi', 5, '')).toBe('   hi'));
  });

  describe('$padEnd', () => {
    it('pads with specified character', () => expect(evalFn('$padEnd', 'hi', 5, '.')).toBe('hi...'));
    it('pads with space by default', () => expect(evalFn('$padEnd', 'hi', 5)).toBe('hi   '));
  });

  describe('$repeat', () => {
    it('repeats string', () => expect(evalFn('$repeat', 'ab', 3)).toBe('ababab'));
    it('returns empty for zero count', () => expect(evalFn('$repeat', 'x', 0)).toBe(''));
    it('handles negative count', () => expect(evalFn('$repeat', 'x', -1)).toBe(''));
    it('handles fractional count', () => expect(evalFn('$repeat', 'x', 2.9)).toBe('xx'));
  });

  describe('$indexOf', () => {
    it('returns index of substring', () => expect(evalFn('$indexOf', 'hello world', 'world')).toBe(6));
    it('returns -1 when not found', () => expect(evalFn('$indexOf', 'hello', 'xyz')).toBe(-1));
    it('returns 0 for empty search', () => expect(evalFn('$indexOf', 'anything', '')).toBe(0));
  });

  describe('$toString', () => {
    it('converts number', () => expect(evalFn('$toString', 42)).toBe('42'));
    it('converts boolean', () => expect(evalFn('$toString', true)).toBe('true'));
    it('handles null', () => expect(evalFn('$toString', null)).toBe(''));
    it('handles undefined', () => expect(evalFn('$toString', undefined)).toBe(''));
    it('converts string identity', () => expect(evalFn('$toString', 'hello')).toBe('hello'));
  });

  it('exports all 16 functions', () => {
    expect(stringFunctions).toHaveLength(16);
    const names = stringFunctions.map((f) => f.name);
    expect(names).toContain('$upper');
    expect(names).toContain('$toString');
    expect(names).toContain('$join');
  });
});
