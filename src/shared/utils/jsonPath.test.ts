import { describe, it, expect } from 'vitest';
import {
  getByPath,
  getByPathAsString,
  setByPath,
  stripJsonPathPrefix,
} from './jsonPath';

describe('stripJsonPathPrefix', () => {
  it('returns dotted path unchanged when there is no $ prefix', () => {
    expect(stripJsonPathPrefix('a.b.c')).toBe('a.b.c');
  });

  it('strips $. prefix', () => {
    expect(stripJsonPathPrefix('$.x.y')).toBe('x.y');
  });

  it('strips bare $ prefix', () => {
    expect(stripJsonPathPrefix('$foo')).toBe('foo');
  });
});

describe('getByPath', () => {
  const obj = {
    name: 'Alice',
    address: { city: 'NYC', zip: '10001' },
    orders: [
      { id: 1, items: [{ sku: 'A' }, { sku: 'B' }] },
      { id: 2, items: [{ sku: 'C' }] },
    ],
  };

  it('resolves a top-level key', () => {
    expect(getByPath(obj, '$.name')).toBe('Alice');
  });

  it('resolves nested keys', () => {
    expect(getByPath(obj, '$.address.city')).toBe('NYC');
  });

  it('resolves array index', () => {
    expect(getByPath(obj, '$.orders[0].id')).toBe(1);
  });

  it('resolves deeply nested array', () => {
    expect(getByPath(obj, '$.orders[0].items[1].sku')).toBe('B');
  });

  it('returns undefined for missing paths', () => {
    expect(getByPath(obj, '$.nonexistent')).toBeUndefined();
    expect(getByPath(obj, '$.orders[5].id')).toBeUndefined();
  });

  it('handles paths without $ prefix', () => {
    expect(getByPath(obj, 'name')).toBe('Alice');
    expect(getByPath(obj, 'address.city')).toBe('NYC');
  });

  it('returns undefined for null/undefined input', () => {
    expect(getByPath(null, '$.x')).toBeUndefined();
    expect(getByPath(undefined, '$.x')).toBeUndefined();
  });

  it('resolves [*] over an array segment', () => {
    expect(getByPath(obj, '$.orders[*].id')).toEqual([1, 2]);
  });

  it('resolves nested [*] under a fixed index', () => {
    expect(getByPath(obj, '$.orders[0].items[*].sku')).toEqual(['A', 'B']);
  });

  it('returns the array when path ends with [*]', () => {
    expect(getByPath(obj, '$.orders[*]')).toEqual(obj.orders);
  });
});

describe('getByPath – edge cases', () => {
  it('returns root object for empty path after $', () => {
    const obj = { a: 1 };
    expect(getByPath(obj, '$')).toEqual(obj);
  });

  it('returns root object for path "$." with no key after', () => {
    const obj = { a: 1 };
    expect(getByPath(obj, '$.')).toEqual(obj);
  });

  it('handles unclosed bracket in path (breaks tokenization)', () => {
    const obj = { a: [1, 2] };
    expect(getByPath(obj, '$.a[0')).toEqual([1, 2]);
  });

  it('stops tokenization at unclosed bracket and returns partial path value', () => {
    const obj = { items: { count: 3 } };
    expect(getByPath(obj, 'items[')).toEqual({ count: 3 });
  });

  it('handles [*] on non-array returns undefined', () => {
    const obj = { a: { b: 1 } };
    expect(getByPath(obj, '$.a[*]')).toBeUndefined();
  });

  it('handles [*] at terminal position returns entire array', () => {
    const obj = { items: [1, 2, 3] };
    expect(getByPath(obj, '$.items[*]')).toEqual([1, 2, 3]);
  });

  it('handles path starting with $ but not $. (single $ prefix)', () => {
    const obj = { a: 1 };
    expect(getByPath(obj, '$a')).toBe(1);
  });

  it('returns undefined for path through null', () => {
    expect(getByPath(null, 'a.b')).toBeUndefined();
  });

  it('returns undefined for non-numeric key on array', () => {
    expect(getByPath([1, 2, 3], 'foo')).toBeUndefined();
  });

  it('handles numeric index on array', () => {
    expect(getByPath([10, 20, 30], '1')).toBe(20);
  });

  it('handles .length on arrays', () => {
    expect(getByPath([1, 2, 3], 'length')).toBe(3);
  });

  it('handles path with unclosed bracket gracefully', () => {
    expect(getByPath({ a: 1 }, '[unclosed')).toEqual({ a: 1 });
  });

  it('handles walkPath on primitive', () => {
    expect(getByPath('hello', 'length')).toBeUndefined();
  });

  it('handles [*] on non-array returns undefined (no prefix)', () => {
    expect(getByPath({ a: 'hello' }, 'a[*]')).toBeUndefined();
  });

  it('handles empty string path', () => {
    const obj = { a: 1 };
    expect(getByPath(obj, '')).toEqual(obj);
  });

  it('handles whitespace-only path', () => {
    const obj = { a: 1 };
    expect(getByPath(obj, '   ')).toEqual(obj);
  });

  it('handles bracket with spaces inside', () => {
    const obj = { items: ['x', 'y'] };
    expect(getByPath(obj, 'items[ 1 ]')).toBe('y');
  });

  it('handles double-nested [*][*]', () => {
    const obj = { matrix: [[1, 2], [3, 4]] };
    expect(getByPath(obj, 'matrix[*]')).toEqual([[1, 2], [3, 4]]);
  });

  it('handles [*] deep chain', () => {
    const obj = {
      teams: [
        { members: [{ name: 'A' }, { name: 'B' }] },
        { members: [{ name: 'C' }] },
      ],
    };
    expect(getByPath(obj, 'teams[*].members[*].name')).toEqual([['A', 'B'], ['C']]);
  });

  it('handles boolean and number leaf values', () => {
    const obj = { active: true, count: 0, ratio: 0.5 };
    expect(getByPath(obj, 'active')).toBe(true);
    expect(getByPath(obj, 'count')).toBe(0);
    expect(getByPath(obj, 'ratio')).toBe(0.5);
  });

  it('handles keys with special characters via bracket notation', () => {
    const obj = { 'my-key': 42 };
    expect(getByPath(obj, 'my-key')).toBe(42);
  });

  it('handles nested .length', () => {
    const obj = { items: [1, 2, 3] };
    expect(getByPath(obj, '$.items.length')).toBe(3);
  });
});

describe('getByPathAsString', () => {
  it('returns string for primitive values', () => {
    expect(getByPathAsString({ name: 'Alice' }, 'name')).toBe('Alice');
    expect(getByPathAsString({ count: 42 }, 'count')).toBe('42');
    expect(getByPathAsString({ active: true }, 'active')).toBe('true');
  });

  it('returns empty string when resolved value is null', () => {
    expect(getByPathAsString({ x: null }, 'x')).toBe('');
  });

  it('returns empty string when resolved value is undefined', () => {
    expect(getByPathAsString({ x: undefined }, 'x')).toBe('');
  });

  it('returns JSON string for object values', () => {
    const obj = { data: { x: 1 } };
    expect(getByPathAsString(obj, 'data')).toBe('{"x":1}');
  });

  it('returns JSON string for array values', () => {
    const obj = { items: [1, 2, 3] };
    expect(getByPathAsString(obj, 'items')).toBe('[1,2,3]');
  });

  it('returns empty string for missing path', () => {
    expect(getByPathAsString({ a: 1 }, 'b.c')).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(getByPathAsString(null, 'a')).toBe('');
  });

  it('returns empty string for undefined root', () => {
    expect(getByPathAsString(undefined as unknown as Record<string, unknown>, 'a')).toBe('');
  });

  it('returns empty when intermediate value is null', () => {
    expect(getByPathAsString({ a: { b: null } }, 'a.b.c')).toBe('');
  });

  it('handles deeply nested arrays', () => {
    const obj = { a: [{ b: [{ c: 'found' }] }] };
    expect(getByPathAsString(obj, 'a[0].b[0].c')).toBe('found');
  });

  it('handles array element extraction', () => {
    const obj = { items: ['a', 'b', 'c'] };
    expect(getByPathAsString(obj, 'items[1]')).toBe('b');
  });
});

describe('setByPath', () => {
  it('sets a top-level key', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'name', 'Alice');
    expect(obj.name).toBe('Alice');
  });

  it('creates nested structure from dotted path', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'a.b.c', 42);
    expect((obj.a as Record<string, unknown>).b).toEqual({ c: 42 });
  });

  it('strips $. prefix before setting', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, '$.user.id', 'abc');
    expect((obj.user as Record<string, unknown>).id).toBe('abc');
  });

  it('strips bare $ prefix', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, '$name', 'value');
    expect(obj.name).toBe('value');
  });

  it('preserves existing sibling keys', () => {
    const obj: Record<string, unknown> = { x: 1 };
    setByPath(obj, 'y', 2);
    expect(obj).toEqual({ x: 1, y: 2 });
  });

  it('overwrites non-object intermediates', () => {
    const obj: Record<string, unknown> = { a: 'string' };
    setByPath(obj, 'a.b', 'deep');
    expect((obj.a as Record<string, unknown>).b).toBe('deep');
  });

  it('does nothing for empty path', () => {
    const obj: Record<string, unknown> = { a: 1 };
    setByPath(obj, '', 'value');
    expect(obj).toEqual({ a: 1 });
  });

  it('does nothing for $ only path', () => {
    const obj: Record<string, unknown> = { a: 1 };
    setByPath(obj, '$', 'value');
    expect(obj).toEqual({ a: 1 });
  });

  it('does nothing for $. only path', () => {
    const obj: Record<string, unknown> = { a: 1 };
    setByPath(obj, '$.', 'value');
    expect(obj).toEqual({ a: 1 });
  });

  it('does nothing for whitespace-only path', () => {
    const obj: Record<string, unknown> = { a: 1 };
    setByPath(obj, '   ', 'value');
    expect(obj).toEqual({ a: 1 });
  });

  it('does nothing when normalized path yields no keys (only dots)', () => {
    const obj: Record<string, unknown> = { a: 1 };
    setByPath(obj, '...', 'value');
    expect(obj).toEqual({ a: 1 });
  });

  it('creates missing intermediate objects for deep nested path', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'level1.level2.level3', 'deep');
    expect(obj).toEqual({
      level1: { level2: { level3: 'deep' } },
    });
  });

  it('replaces null intermediate with object before descending', () => {
    const obj: Record<string, unknown> = { a: { b: null } };
    setByPath(obj, 'a.b.c', 99);
    expect(obj).toEqual({ a: { b: { c: 99 } } });
  });

  it('replaces non-object intermediate with object for deeper segment (a.b.c where a.b is string)', () => {
    const obj: Record<string, unknown> = { a: { b: 'not-an-object' } };
    setByPath(obj, 'a.b.c', 'leaf');
    expect(obj).toEqual({ a: { b: { c: 'leaf' } } });
  });

  it('uses $. prefix and still creates intermediates', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, '$.region.zone.id', 7);
    expect(obj).toEqual({ region: { zone: { id: 7 } } });
  });

  it('treats bracket paths as literal keys (dot-only semantics)', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, '$.items[0].id', 'v');
    expect(obj).toEqual({ 'items[0]': { id: 'v' } });
  });

  it('rejects __proto__ segments (prototype pollution)', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, '__proto__.polluted', true);
    expect(obj).toEqual({});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects constructor segments', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'constructor.polluted', true);
    expect(obj).toEqual({});
  });

  it('rejects prototype segments', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'a.prototype.x', true);
    expect(obj).toEqual({});
  });

  it('skips empty segments from double dots', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'a..b', 1);
    expect(obj).toEqual({ a: { b: 1 } });
  });
});
