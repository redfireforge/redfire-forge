import { describe, it, expect } from 'vitest';
import { canonicalize } from './canonicalize';

describe('canonicalize', () => {
  it('returns primitives unchanged', () => {
    expect(canonicalize(42)).toBe(42);
    expect(canonicalize('hello')).toBe('hello');
    expect(canonicalize(true)).toBe(true);
    expect(canonicalize(null)).toBe(null);
    expect(canonicalize(undefined)).toBe(undefined);
  });

  it('returns arrays with canonicalized elements', () => {
    expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2]); // array order preserved
    expect(canonicalize([{ b: 2, a: 1 }])).toEqual([{ a: 1, b: 2 }]);
  });

  it('sorts object keys alphabetically', () => {
    const input = { c: 3, a: 1, b: 2 };
    const result = canonicalize(input) as Record<string, number>;
    expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('recursively sorts nested object keys', () => {
    const input = { z: { b: 2, a: 1 }, a: { d: 4, c: 3 } };
    const result = canonicalize(input);
    expect(JSON.stringify(result)).toBe('{"a":{"c":3,"d":4},"z":{"a":1,"b":2}}');
  });

  it('handles deeply nested structures', () => {
    const input = { c: { b: { a: 1 } } };
    expect(JSON.stringify(canonicalize(input))).toBe('{"c":{"b":{"a":1}}}');
  });

  it('handles mixed arrays and objects', () => {
    const input = { items: [{ z: 1, a: 2 }, { y: 3, b: 4 }] };
    const result = canonicalize(input);
    expect(JSON.stringify(result)).toBe('{"items":[{"a":2,"z":1},{"b":4,"y":3}]}');
  });

  it('handles empty objects and arrays', () => {
    expect(canonicalize({})).toEqual({});
    expect(canonicalize([])).toEqual([]);
  });

  it('produces stable JSON for objects with different key order', () => {
    const a = { name: 'test', url: '/api', method: 'GET' };
    const b = { method: 'GET', name: 'test', url: '/api' };
    expect(JSON.stringify(canonicalize(a))).toBe(JSON.stringify(canonicalize(b)));
  });
});
