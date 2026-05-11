import { describe, it, expect } from 'vitest';
import { conditionalFunctions } from './conditionalFunctions';

function evalFn(name: string, ...args: unknown[]): unknown {
  const fn = conditionalFunctions.find((f) => f.name === name);
  if (!fn) throw new Error(`Function ${name} not found`);
  return fn.evaluate(...args);
}

describe('conditionalFunctions', () => {
  describe('$default', () => {
    it('returns value when non-empty', () => expect(evalFn('$default', 'hello', 'fallback')).toBe('hello'));
    it('returns fallback for empty string', () => expect(evalFn('$default', '', 'N/A')).toBe('N/A'));
    it('returns fallback for null', () => expect(evalFn('$default', null, 'N/A')).toBe('N/A'));
    it('returns fallback for undefined', () => expect(evalFn('$default', undefined, 'N/A')).toBe('N/A'));
    it('returns 0 as valid value', () => expect(evalFn('$default', 0, 'fallback')).toBe(0));
    it('returns false as valid value', () => expect(evalFn('$default', false, 'fallback')).toBe(false));
  });

  describe('$if', () => {
    it('returns then for truthy string', () => expect(evalFn('$if', 'true', 'yes', 'no')).toBe('yes'));
    it('returns else for "false"', () => expect(evalFn('$if', 'false', 'yes', 'no')).toBe('no'));
    it('returns else for "0"', () => expect(evalFn('$if', '0', 'yes', 'no')).toBe('no'));
    it('returns else for empty string', () => expect(evalFn('$if', '', 'yes', 'no')).toBe('no'));
    it('returns else for "null"', () => expect(evalFn('$if', 'null', 'yes', 'no')).toBe('no'));
    it('returns else for "undefined"', () => expect(evalFn('$if', 'undefined', 'yes', 'no')).toBe('no'));
    it('returns then for non-zero number', () => expect(evalFn('$if', 42, 'yes', 'no')).toBe('yes'));
    it('returns then for non-empty string', () => expect(evalFn('$if', 'anything', 'yes', 'no')).toBe('yes'));
  });

  describe('$isEmpty', () => {
    it('true for empty string', () => expect(evalFn('$isEmpty', '')).toBe(true));
    it('true for null', () => expect(evalFn('$isEmpty', null)).toBe(true));
    it('true for undefined', () => expect(evalFn('$isEmpty', undefined)).toBe(true));
    it('true for empty array', () => expect(evalFn('$isEmpty', [])).toBe(true));
    it('false for non-empty string', () => expect(evalFn('$isEmpty', 'hello')).toBe(false));
    it('false for non-empty array', () => expect(evalFn('$isEmpty', [1])).toBe(false));
    it('false for zero', () => expect(evalFn('$isEmpty', 0)).toBe(false));
  });

  describe('$contains', () => {
    it('returns true when found', () => expect(evalFn('$contains', 'hello world', 'world')).toBe(true));
    it('returns false when not found', () => expect(evalFn('$contains', 'hello', 'xyz')).toBe(false));
    it('is case-sensitive', () => expect(evalFn('$contains', 'Hello', 'hello')).toBe(false));
    it('returns true for empty needle', () => expect(evalFn('$contains', 'anything', '')).toBe(true));
  });

  describe('$matches', () => {
    it('matches simple regex', () => expect(evalFn('$matches', 'abc123', '^[a-z]+\\d+$')).toBe(true));
    it('returns false for non-match', () => expect(evalFn('$matches', '123', '^[a-z]+$')).toBe(false));
    it('returns false for invalid regex', () => expect(evalFn('$matches', 'test', '[')).toBe(false));
    it('matches email-like pattern', () => expect(evalFn('$matches', 'a@b.com', '.+@.+\\..+')).toBe(true));
  });

  describe('$not', () => {
    it('negates truthy', () => expect(evalFn('$not', 'hello')).toBe(false));
    it('negates falsy "false"', () => expect(evalFn('$not', 'false')).toBe(true));
    it('negates empty string', () => expect(evalFn('$not', '')).toBe(true));
    it('negates "0"', () => expect(evalFn('$not', '0')).toBe(true));
    it('negates non-zero number', () => expect(evalFn('$not', 42)).toBe(false));
  });

  describe('$coalesce', () => {
    it('returns first non-empty value', () => expect(evalFn('$coalesce', '', null, 'found')).toBe('found'));
    it('returns first arg if non-empty', () => expect(evalFn('$coalesce', 'first', 'second')).toBe('first'));
    it('returns last arg if all empty', () => expect(evalFn('$coalesce', '', '', 'last')).toBe('last'));
    it('returns null if all null', () => expect(evalFn('$coalesce', null, null)).toBe(null));
    it('returns 0 as valid', () => expect(evalFn('$coalesce', 0, 'fallback')).toBe(0));
  });

  describe('$equals', () => {
    it('equal strings', () => expect(evalFn('$equals', 'hello', 'hello')).toBe(true));
    it('unequal strings', () => expect(evalFn('$equals', 'hello', 'world')).toBe(false));
    it('number string comparison', () => expect(evalFn('$equals', 42, '42')).toBe(true));
    it('case sensitive', () => expect(evalFn('$equals', 'Hello', 'hello')).toBe(false));
  });

  describe('$toBool', () => {
    it('converts true boolean', () => expect(evalFn('$toBool', true)).toBe(true));
    it('converts false boolean', () => expect(evalFn('$toBool', false)).toBe(false));
    it('converts non-zero number', () => expect(evalFn('$toBool', 42)).toBe(true));
    it('converts zero', () => expect(evalFn('$toBool', 0)).toBe(false));
    it('converts "yes" as truthy', () => expect(evalFn('$toBool', 'yes')).toBe(true));
    it('converts "false" as falsy', () => expect(evalFn('$toBool', 'false')).toBe(false));
    it('converts "0" as falsy', () => expect(evalFn('$toBool', '0')).toBe(false));
    it('converts empty string as falsy', () => expect(evalFn('$toBool', '')).toBe(false));
    it('converts null as falsy', () => expect(evalFn('$toBool', null)).toBe(false));
  });

  it('exports all 9 functions', () => {
    expect(conditionalFunctions).toHaveLength(9);
    const names = conditionalFunctions.map((f) => f.name);
    expect(names).toContain('$if');
    expect(names).toContain('$default');
    expect(names).toContain('$toBool');
  });
});
