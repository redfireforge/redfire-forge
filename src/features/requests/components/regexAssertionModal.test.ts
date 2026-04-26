import { describe, it, expect } from 'vitest';
import { resolveValue, testPattern, PATTERN_LIBRARY } from './regexAssertionUtils';

const SAMPLE_JSON = JSON.stringify({
  id: 'abc-123',
  name: 'Alice',
  age: 30,
  active: true,
  email: 'alice@example.com',
  url: 'https://example.com/api',
  created: '2024-06-15T10:30:00Z',
  tags: ['admin', 'user'],
  address: {
    city: 'Portland',
    zip: '97201',
  },
  offers: [
    { offerName: 'Connected Access - 8 Years', rank: 13 },
    { offerName: '3GB WiFi Connectivity - Trial', rank: 3 },
  ],
});

describe('resolveValue', () => {
  it('resolves a top-level string', () => {
    expect(resolveValue(SAMPLE_JSON, '$.name')).toBe('Alice');
  });

  it('resolves a top-level number as JSON string', () => {
    expect(resolveValue(SAMPLE_JSON, '$.age')).toBe('30');
  });

  it('resolves a boolean', () => {
    expect(resolveValue(SAMPLE_JSON, '$.active')).toBe('true');
  });

  it('resolves nested path', () => {
    expect(resolveValue(SAMPLE_JSON, '$.address.city')).toBe('Portland');
  });

  it('resolves array element', () => {
    expect(resolveValue(SAMPLE_JSON, '$.offers[0].offerName')).toBe('Connected Access - 8 Years');
  });

  it('resolves entire array as serialized JSON', () => {
    const val = resolveValue(SAMPLE_JSON, '$.tags');
    expect(val).toBe('["admin","user"]');
  });

  it('resolves entire object as serialized JSON', () => {
    const val = resolveValue(SAMPLE_JSON, '$.address');
    expect(val).toContain('"city":"Portland"');
  });

  it('returns undefined for non-existent path', () => {
    expect(resolveValue(SAMPLE_JSON, '$.nonExistent')).toBeUndefined();
  });

  it('returns undefined for deep non-existent path', () => {
    expect(resolveValue(SAMPLE_JSON, '$.address.state')).toBeUndefined();
  });

  it('returns undefined for empty json', () => {
    expect(resolveValue('', '$.name')).toBeUndefined();
  });

  it('returns undefined for empty path', () => {
    expect(resolveValue(SAMPLE_JSON, '')).toBeUndefined();
  });

  it('returns undefined for invalid json', () => {
    expect(resolveValue('not json', '$.name')).toBeUndefined();
  });

  it('handles path without $ prefix', () => {
    expect(resolveValue(SAMPLE_JSON, 'name')).toBe('Alice');
  });

  it('resolves array index at root', () => {
    const arrJson = JSON.stringify(['a', 'b', 'c']);
    expect(resolveValue(arrJson, '$[0]')).toBe('a');
  });
});

describe('PATTERN_LIBRARY', () => {
  it('has at least 10 patterns', () => {
    expect(PATTERN_LIBRARY.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry has required fields', () => {
    for (const entry of PATTERN_LIBRARY) {
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(typeof entry.pattern).toBe('string');
    }
  });

  it('patterns with content are valid regex', () => {
    for (const entry of PATTERN_LIBRARY) {
      if (entry.pattern) {
        expect(() => new RegExp(entry.pattern)).not.toThrow();
      }
    }
  });

  it('specific patterns match expected samples', () => {
    const uuid = PATTERN_LIBRARY.find(p => p.name === 'UUID v4')!;
    expect(new RegExp(uuid.pattern).test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(new RegExp(uuid.pattern).test('not-a-uuid')).toBe(false);

    const email = PATTERN_LIBRARY.find(p => p.name === 'Email address')!;
    expect(new RegExp(email.pattern).test('alice@example.com')).toBe(true);
    expect(new RegExp(email.pattern).test('no-at-sign')).toBe(false);

    const url = PATTERN_LIBRARY.find(p => p.name === 'URL (http/https)')!;
    expect(new RegExp(url.pattern).test('https://example.com')).toBe(true);
    expect(new RegExp(url.pattern).test('ftp://example.com')).toBe(false);

    const isoDate = PATTERN_LIBRARY.find(p => p.name === 'ISO date (YYYY-MM-DD)')!;
    expect(new RegExp(isoDate.pattern).test('2024-06-15')).toBe(true);

    const notEmpty = PATTERN_LIBRARY.find(p => p.name === 'Not empty')!;
    expect(new RegExp(notEmpty.pattern).test('hello')).toBe(true);
    expect(new RegExp(notEmpty.pattern).test('')).toBe(false);

    const posInt = PATTERN_LIBRARY.find(p => p.name === 'Positive integer')!;
    expect(new RegExp(posInt.pattern).test('42')).toBe(true);
    expect(new RegExp(posInt.pattern).test('0')).toBe(false);
    expect(new RegExp(posInt.pattern).test('-5')).toBe(false);

    const boolP = PATTERN_LIBRARY.find(p => p.name === 'Boolean (true/false)')!;
    expect(new RegExp(boolP.pattern).test('true')).toBe(true);
    expect(new RegExp(boolP.pattern).test('false')).toBe(true);
    expect(new RegExp(boolP.pattern).test('yes')).toBe(false);

    const nonEmptyArr = PATTERN_LIBRARY.find(p => p.name === 'Array is non-empty')!;
    expect(new RegExp(nonEmptyArr.pattern).test('[1,2,3]')).toBe(true);
    expect(new RegExp(nonEmptyArr.pattern).test('[]')).toBe(false);
  });

  it('has unique names', () => {
    const names = PATTERN_LIBRARY.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers expected categories', () => {
    const cats = new Set(PATTERN_LIBRARY.map(p => p.category));
    expect(cats.has('Text')).toBe(true);
    expect(cats.has('Identifiers')).toBe(true);
    expect(cats.has('Formats')).toBe(true);
    expect(cats.has('Numbers')).toBe(true);
    expect(cats.has('Arrays')).toBe(true);
  });
});

describe('testPattern', () => {
  it('returns match for simple text', () => {
    const r = testPattern('hello', 'say hello world');
    expect(r.valid).toBe(true);
    expect(r.matches).toBe(true);
    expect(r.matchDetails?.[0]).toBe('hello');
  });

  it('returns no match when pattern does not match', () => {
    const r = testPattern('xyz', 'hello world');
    expect(r.valid).toBe(true);
    expect(r.matches).toBe(false);
  });

  it('handles anchored patterns', () => {
    expect(testPattern('^hello', 'hello world').matches).toBe(true);
    expect(testPattern('^hello', 'say hello').matches).toBe(false);
    expect(testPattern('world$', 'hello world').matches).toBe(true);
    expect(testPattern('world$', 'world peace').matches).toBe(false);
  });

  it('handles exact match pattern', () => {
    expect(testPattern('^exact$', 'exact').matches).toBe(true);
    expect(testPattern('^exact$', 'not exact').matches).toBe(false);
  });

  it('returns invalid for bad regex', () => {
    const r = testPattern('[invalid', 'test');
    expect(r.valid).toBe(false);
    expect(r.matches).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('returns no match for empty pattern', () => {
    const r = testPattern('', 'something');
    expect(r.valid).toBe(true);
    expect(r.matches).toBe(false);
  });

  it('matches with character classes', () => {
    expect(testPattern('^\\d+$', '12345').matches).toBe(true);
    expect(testPattern('^\\d+$', 'abc').matches).toBe(false);
  });

  it('matches alternation patterns', () => {
    expect(testPattern('^(true|false)$', 'true').matches).toBe(true);
    expect(testPattern('^(true|false)$', 'false').matches).toBe(true);
    expect(testPattern('^(true|false)$', 'maybe').matches).toBe(false);
  });

  it('provides matchDetails with index', () => {
    const r = testPattern('world', 'hello world');
    expect(r.matchDetails?.index).toBe(6);
  });

  it('handles special regex characters in values', () => {
    const r = testPattern('\\[1\\]', 'array[1]');
    expect(r.valid).toBe(true);
    expect(r.matches).toBe(true);
  });

  it('matches case-sensitive by default', () => {
    expect(testPattern('^Hello$', 'Hello').matches).toBe(true);
    expect(testPattern('^Hello$', 'hello').matches).toBe(false);
  });

  it('handles dot-star wildcard', () => {
    expect(testPattern('he.*ld', 'hello world').matches).toBe(true);
    expect(testPattern('he.*ld', 'hey world').matches).toBe(true);
    expect(testPattern('he.*ld', 'xyz').matches).toBe(false);
  });
});

describe('resolveValue edge cases', () => {
  it('resolves null value as "null"', () => {
    const json = JSON.stringify({ val: null });
    expect(resolveValue(json, '$.val')).toBe('null');
  });

  it('resolves zero as "0"', () => {
    const json = JSON.stringify({ val: 0 });
    expect(resolveValue(json, '$.val')).toBe('0');
  });

  it('resolves false as "false"', () => {
    const json = JSON.stringify({ val: false });
    expect(resolveValue(json, '$.val')).toBe('false');
  });

  it('resolves empty string', () => {
    const json = JSON.stringify({ val: '' });
    expect(resolveValue(json, '$.val')).toBe('');
  });

  it('resolves nested array index', () => {
    const json = JSON.stringify({ a: { b: [10, 20, 30] } });
    expect(resolveValue(json, '$.a.b[2]')).toBe('30');
  });

  it('handles traversal through non-object', () => {
    const json = JSON.stringify({ val: 'text' });
    expect(resolveValue(json, '$.val.deep')).toBeUndefined();
  });

  it('handles path with just $', () => {
    const json = JSON.stringify({ a: 1 });
    const val = resolveValue(json, '$');
    expect(val).toContain('"a":1');
  });

  it('resolves deeply nested path', () => {
    const json = JSON.stringify({ a: { b: { c: { d: 'deep' } } } });
    expect(resolveValue(json, '$.a.b.c.d')).toBe('deep');
  });

  it('resolves empty array as "[]"', () => {
    const json = JSON.stringify({ arr: [] });
    expect(resolveValue(json, '$.arr')).toBe('[]');
  });

  it('resolves empty object as "{}"', () => {
    const json = JSON.stringify({ obj: {} });
    expect(resolveValue(json, '$.obj')).toBe('{}');
  });
});

describe('resolveValue + regex matching (integration)', () => {
  it('matches Connected Access in offers array', () => {
    const val = resolveValue(SAMPLE_JSON, '$.offers');
    expect(val).toBeDefined();
    expect(new RegExp('Connected Access').test(val!)).toBe(true);
  });

  it('matches specific offer name by index', () => {
    const val = resolveValue(SAMPLE_JSON, '$.offers[0].offerName');
    expect(val).toBe('Connected Access - 8 Years');
    expect(new RegExp('^Connected Access').test(val!)).toBe(true);
  });

  it('validates email format on resolved value', () => {
    const val = resolveValue(SAMPLE_JSON, '$.email');
    const emailPattern = PATTERN_LIBRARY.find(p => p.name === 'Email address')!.pattern;
    expect(new RegExp(emailPattern).test(val!)).toBe(true);
  });

  it('validates URL format on resolved value', () => {
    const val = resolveValue(SAMPLE_JSON, '$.url');
    const urlPattern = PATTERN_LIBRARY.find(p => p.name === 'URL (http/https)')!.pattern;
    expect(new RegExp(urlPattern).test(val!)).toBe(true);
  });

  it('validates ISO datetime on resolved value', () => {
    const val = resolveValue(SAMPLE_JSON, '$.created');
    const dtPattern = PATTERN_LIBRARY.find(p => p.name === 'ISO datetime')!.pattern;
    expect(new RegExp(dtPattern).test(val!)).toBe(true);
  });
});
