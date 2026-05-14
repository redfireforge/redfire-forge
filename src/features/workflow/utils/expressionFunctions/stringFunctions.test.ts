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

  describe('$substringBefore', () => {
    it('returns substring before separator', () => expect(evalFn('$substringBefore', 'hello-world', '-')).toBe('hello'));
    it('returns full string when separator not found', () => expect(evalFn('$substringBefore', 'hello', '-')).toBe('hello'));
    it('handles multiple separators (first match)', () => expect(evalFn('$substringBefore', 'a-b-c', '-')).toBe('a'));
    it('returns empty for separator at start', () => expect(evalFn('$substringBefore', '-hello', '-')).toBe(''));
    it('handles null input', () => expect(evalFn('$substringBefore', null, '-')).toBe(''));
  });

  describe('$substringAfter', () => {
    it('returns substring after separator', () => expect(evalFn('$substringAfter', 'hello-world', '-')).toBe('world'));
    it('returns empty when separator not found', () => expect(evalFn('$substringAfter', 'hello', '-')).toBe(''));
    it('handles multiple separators (after first)', () => expect(evalFn('$substringAfter', 'a-b-c', '-')).toBe('b-c'));
    it('returns rest for separator at start', () => expect(evalFn('$substringAfter', '-hello', '-')).toBe('hello'));
    it('handles null input', () => expect(evalFn('$substringAfter', null, '-')).toBe(''));
  });

  describe('$capitalize', () => {
    it('capitalizes first letter', () => expect(evalFn('$capitalize', 'hello world')).toBe('Hello world'));
    it('handles empty string', () => expect(evalFn('$capitalize', '')).toBe(''));
    it('handles already capitalized', () => expect(evalFn('$capitalize', 'Hello')).toBe('Hello'));
    it('handles single character', () => expect(evalFn('$capitalize', 'a')).toBe('A'));
    it('handles null', () => expect(evalFn('$capitalize', null)).toBe(''));
  });

  describe('$camelCase', () => {
    it('converts space-separated', () => expect(evalFn('$camelCase', 'hello world')).toBe('helloWorld'));
    it('converts hyphen-separated', () => expect(evalFn('$camelCase', 'foo-bar-baz')).toBe('fooBarBaz'));
    it('converts underscore-separated', () => expect(evalFn('$camelCase', 'get_user_name')).toBe('getUserName'));
    it('handles PascalCase input', () => expect(evalFn('$camelCase', 'PascalCase')).toBe('pascalCase'));
    it('handles empty string', () => expect(evalFn('$camelCase', '')).toBe(''));
    it('handles single word', () => expect(evalFn('$camelCase', 'hello')).toBe('hello'));
  });

  describe('$snakeCase', () => {
    it('converts camelCase', () => expect(evalFn('$snakeCase', 'helloWorld')).toBe('hello_world'));
    it('converts space-separated', () => expect(evalFn('$snakeCase', 'foo bar baz')).toBe('foo_bar_baz'));
    it('converts hyphen-separated', () => expect(evalFn('$snakeCase', 'get-user-name')).toBe('get_user_name'));
    it('handles PascalCase', () => expect(evalFn('$snakeCase', 'PascalCase')).toBe('pascal_case'));
    it('handles empty string', () => expect(evalFn('$snakeCase', '')).toBe(''));
    it('handles already snake_case', () => expect(evalFn('$snakeCase', 'already_snake')).toBe('already_snake'));
  });

  describe('$kebabCase', () => {
    it('converts camelCase', () => expect(evalFn('$kebabCase', 'helloWorld')).toBe('hello-world'));
    it('converts PascalCase', () => expect(evalFn('$kebabCase', 'HelloWorldTest')).toBe('hello-world-test'));
    it('converts space-separated', () => expect(evalFn('$kebabCase', 'foo bar baz')).toBe('foo-bar-baz'));
    it('handles empty string', () => expect(evalFn('$kebabCase', '')).toBe(''));
    it('handles already kebab-case', () => expect(evalFn('$kebabCase', 'already-kebab')).toBe('already-kebab'));
  });

  describe('$isAlpha', () => {
    it('returns true for alphabetic string', () => expect(evalFn('$isAlpha', 'Hello')).toBe(true));
    it('returns false for alphanumeric', () => expect(evalFn('$isAlpha', 'Hello123')).toBe(false));
    it('returns false for empty string', () => expect(evalFn('$isAlpha', '')).toBe(false));
    it('returns false for spaces', () => expect(evalFn('$isAlpha', 'Hello World')).toBe(false));
    it('handles single char', () => expect(evalFn('$isAlpha', 'a')).toBe(true));
  });

  describe('$isNumeric', () => {
    it('returns true for integer string', () => expect(evalFn('$isNumeric', '123')).toBe(true));
    it('returns true for decimal string', () => expect(evalFn('$isNumeric', '12.34')).toBe(true));
    it('returns true for negative number', () => expect(evalFn('$isNumeric', '-5')).toBe(true));
    it('returns false for alphabetic', () => expect(evalFn('$isNumeric', 'abc')).toBe(false));
    it('returns false for empty string', () => expect(evalFn('$isNumeric', '')).toBe(false));
    it('returns false for mixed', () => expect(evalFn('$isNumeric', '12abc')).toBe(false));
    it('returns false for Infinity', () => expect(evalFn('$isNumeric', 'Infinity')).toBe(false));
  });

  describe('$trimStart', () => {
    it('removes leading whitespace', () => expect(evalFn('$trimStart', '  hello  ')).toBe('hello  '));
    it('preserves trailing whitespace', () => expect(evalFn('$trimStart', '  hello')).toBe('hello'));
    it('handles no whitespace', () => expect(evalFn('$trimStart', 'hello')).toBe('hello'));
    it('handles empty string', () => expect(evalFn('$trimStart', '')).toBe(''));
  });

  describe('$trimEnd', () => {
    it('removes trailing whitespace', () => expect(evalFn('$trimEnd', '  hello  ')).toBe('  hello'));
    it('preserves leading whitespace', () => expect(evalFn('$trimEnd', 'hello  ')).toBe('hello'));
    it('handles no whitespace', () => expect(evalFn('$trimEnd', 'hello')).toBe('hello'));
    it('handles empty string', () => expect(evalFn('$trimEnd', '')).toBe(''));
  });

  describe('$scan', () => {
    it('finds all regex matches', () => expect(evalFn('$scan', 'a1b2c3', '[0-9]+')).toEqual(['1', '2', '3']));
    it('finds word matches', () => expect(evalFn('$scan', 'hello world', '[a-z]+')).toEqual(['hello', 'world']));
    it('returns empty array for no matches', () => expect(evalFn('$scan', 'hello', '[0-9]+')).toEqual([]));
    it('handles invalid regex gracefully', () => expect(evalFn('$scan', 'test', '[')).toEqual([]));
    it('handles empty string', () => expect(evalFn('$scan', '', 'abc')).toEqual([]));
  });

  it('exports all 31 functions', () => {
    expect(stringFunctions).toHaveLength(31);
    const names = stringFunctions.map((f) => f.name);
    expect(names).toContain('$upper');
    expect(names).toContain('$toString');
    expect(names).toContain('$join');
    expect(names).toContain('$substringBefore');
    expect(names).toContain('$substringAfter');
    expect(names).toContain('$capitalize');
    expect(names).toContain('$camelCase');
    expect(names).toContain('$snakeCase');
    expect(names).toContain('$kebabCase');
    expect(names).toContain('$isAlpha');
    expect(names).toContain('$isNumeric');
    expect(names).toContain('$trimStart');
    expect(names).toContain('$trimEnd');
    expect(names).toContain('$scan');
    expect(names).toContain('$ltrimStr');
    expect(names).toContain('$rtrimStr');
    expect(names).toContain('$capture');
    expect(names).toContain('$indices');
  });

  describe('$ltrimStr', () => {
    it('removes prefix from start', () => expect(evalFn('$ltrimStr', '/api/users', '/api')).toBe('/users'));
    it('returns unchanged if prefix not present', () => expect(evalFn('$ltrimStr', 'hello', 'xyz')).toBe('hello'));
    it('removes only first occurrence', () => expect(evalFn('$ltrimStr', '/api/api/test', '/api')).toBe('/api/test'));
    it('handles empty prefix', () => expect(evalFn('$ltrimStr', 'hello', '')).toBe('hello'));
    it('handles exact match', () => expect(evalFn('$ltrimStr', 'abc', 'abc')).toBe(''));
    it('handles empty string', () => expect(evalFn('$ltrimStr', '', 'abc')).toBe(''));
  });

  describe('$rtrimStr', () => {
    it('removes suffix from end', () => expect(evalFn('$rtrimStr', 'file.json', '.json')).toBe('file'));
    it('returns unchanged if suffix not present', () => expect(evalFn('$rtrimStr', 'hello', 'xyz')).toBe('hello'));
    it('removes only last occurrence', () => expect(evalFn('$rtrimStr', 'test.json.json', '.json')).toBe('test.json'));
    it('handles empty suffix', () => expect(evalFn('$rtrimStr', 'hello', '')).toBe('hello'));
    it('handles exact match', () => expect(evalFn('$rtrimStr', 'abc', 'abc')).toBe(''));
    it('handles empty string', () => expect(evalFn('$rtrimStr', '', 'abc')).toBe(''));
  });

  describe('$capture', () => {
    it('extracts named capture groups', () => {
      expect(evalFn('$capture', '2024-01-15', '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})'))
        .toEqual({ year: '2024', month: '01', day: '15' });
    });
    it('returns empty object when no match', () => {
      expect(evalFn('$capture', 'no-match', '(?<num>\\d+)')).toEqual({});
    });
    it('returns empty object for regex without named groups', () => {
      expect(evalFn('$capture', 'hello 123', '(\\d+)')).toEqual({});
    });
    it('returns empty object for invalid regex', () => {
      expect(evalFn('$capture', 'test', '[')).toEqual({});
    });
    it('handles partial captures', () => {
      expect(evalFn('$capture', 'abc@domain.com', '(?<user>[^@]+)@(?<domain>.+)'))
        .toEqual({ user: 'abc', domain: 'domain.com' });
    });
    it('handles empty input string', () => {
      expect(evalFn('$capture', '', '(?<x>.+)')).toEqual({});
    });
  });

  describe('$indices', () => {
    it('finds all positions of substring', () => {
      expect(evalFn('$indices', 'abcabc', 'bc')).toEqual([1, 4]);
    });
    it('finds overlapping positions', () => {
      expect(evalFn('$indices', 'aaa', 'aa')).toEqual([0, 1]);
    });
    it('returns empty array when not found', () => {
      expect(evalFn('$indices', 'hello', 'xyz')).toEqual([]);
    });
    it('handles single character search', () => {
      expect(evalFn('$indices', 'banana', 'a')).toEqual([1, 3, 5]);
    });
    it('returns empty array for empty search', () => {
      expect(evalFn('$indices', 'hello', '')).toEqual([]);
    });
    it('returns empty array for empty string', () => {
      expect(evalFn('$indices', '', 'abc')).toEqual([]);
    });
    it('handles search string equal to input', () => {
      expect(evalFn('$indices', 'abc', 'abc')).toEqual([0]);
    });
  });
});
