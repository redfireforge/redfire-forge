import { describe, it, expect } from 'vitest';
import { getByPath } from './validator';

// ---------------------------------------------------------------------------
// getByPath
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// getByPath – edge branches
// ---------------------------------------------------------------------------
describe('getByPath edge cases', () => {
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
    // "[0" without closing bracket — tokenizer breaks, returns tokens up to that point
    expect(getByPath(obj, '$.a[0')).toEqual([1, 2]);
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
});

// ---------------------------------------------------------------------------
// Additional branch coverage tests
// ---------------------------------------------------------------------------

describe('getByPath – edge cases', () => {
  it('returns root object for $ path', () => {
    const obj = { a: 1 };
    expect(getByPath(obj, '$')).toEqual({ a: 1 });
  });

  it('handles [*] on non-array returns undefined', () => {
    expect(getByPath({ a: 'hello' }, 'a[*]')).toBeUndefined();
  });

  it('handles .length on arrays', () => {
    expect(getByPath([1, 2, 3], 'length')).toBe(3);
  });

  it('handles path with unclosed bracket gracefully', () => {
    // unclosed bracket causes tokenizer to break early, returns root
    expect(getByPath({ a: 1 }, '[unclosed')).toEqual({ a: 1 });
  });

  it('handles walkPath on primitive', () => {
    expect(getByPath('hello', 'length')).toBeUndefined();
  });

  it('handles non-numeric key on array', () => {
    expect(getByPath([1, 2, 3], 'foo')).toBeUndefined();
  });

  it('handles [*] at last position returns full array', () => {
    expect(getByPath({ items: [1, 2, 3] }, 'items[*]')).toEqual([1, 2, 3]);
  });
});
