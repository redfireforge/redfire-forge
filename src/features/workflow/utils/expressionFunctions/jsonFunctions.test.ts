import { describe, it, expect } from 'vitest';
import { jsonFunctions } from './jsonFunctions';

function evalFn(name: string, ...args: unknown[]): unknown {
  const fn = jsonFunctions.find((f) => f.name === name);
  if (!fn) throw new Error(`Function ${name} not found`);
  return fn.evaluate(...args);
}

describe('$jsonpath', () => {
  it('resolves simple dot path', () => {
    expect(evalFn('$jsonpath', { a: { b: 1 } }, 'a.b')).toBe(1);
  });

  it('resolves path from JSON string', () => {
    expect(evalFn('$jsonpath', '{"a":{"b":42}}', 'a.b')).toBe(42);
  });

  it('resolves numeric index', () => {
    expect(evalFn('$jsonpath', { items: ['x', 'y', 'z'] }, 'items.1')).toBe('y');
  });

  it('resolves bracket notation', () => {
    expect(evalFn('$jsonpath', { items: [10, 20, 30] }, 'items[1]')).toBe(20);
  });

  it('returns null for missing path', () => {
    expect(evalFn('$jsonpath', { a: 1 }, 'b.c')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(evalFn('$jsonpath', null, 'a.b')).toBeNull();
  });

  it('returns null for invalid JSON string', () => {
    expect(evalFn('$jsonpath', 'not-json', 'a')).toBeNull();
  });

  it('resolves wildcard $[*].name on array of objects', () => {
    const data = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }];
    expect(evalFn('$jsonpath', data, '$[*].name')).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('resolves wildcard on nested array', () => {
    const data = { items: [{ name: 'Widget' }, { name: 'Gadget' }] };
    expect(evalFn('$jsonpath', data, 'items[*].name')).toEqual(['Widget', 'Gadget']);
  });

  it('resolves wildcard with leading $.', () => {
    const data = { items: [{ price: 10 }, { price: 20 }] };
    expect(evalFn('$jsonpath', data, '$.items[*].price')).toEqual([10, 20]);
  });

  it('resolves wildcard on root array with $[*]', () => {
    const data = [1, 2, 3];
    expect(evalFn('$jsonpath', data, '$[*]')).toEqual([1, 2, 3]);
  });

  it('returns null when wildcard applied to non-array', () => {
    expect(evalFn('$jsonpath', { a: 'string' }, 'a[*]')).toBeNull();
  });

  it('walkJsonPath handles wildcard segment on nested array values', () => {
    expect(evalFn('$jsonpath', [{ x: [10, 20] }, { x: [30] }], '$[*].x[*]')).toEqual([[10, 20], [30]]);
  });

  it('resolves deep wildcard nested.items[*].sub.value', () => {
    const data = { nested: { items: [{ sub: { value: 'A' } }, { sub: { value: 'B' } }] } };
    expect(evalFn('$jsonpath', data, 'nested.items[*].sub.value')).toEqual(['A', 'B']);
  });

  it('resolves path with quoted bracket notation', () => {
    const data = { 'my-key': 42 };
    expect(evalFn('$jsonpath', data, '["my-key"]')).toBe(42);
  });

  it('handles empty path by returning root', () => {
    const data = { a: 1 };
    expect(evalFn('$jsonpath', data, '$')).toEqual({ a: 1 });
  });

  it('returns null for path segment after primitive', () => {
    expect(evalFn('$jsonpath', { a: 1 }, 'a.b')).toBeNull();
  });

  it('parses path with unclosed bracket as literal remainder', () => {
    expect(evalFn('$jsonpath', { a: 1 }, 'a[unclosed')).toBeNull();
  });
});

describe('$count', () => {
  it('counts array elements', () => {
    expect(evalFn('$count', [1, 2, 3])).toBe(3);
  });

  it('counts string length', () => {
    expect(evalFn('$count', 'hello')).toBe(5);
  });

  it('parses JSON array string', () => {
    expect(evalFn('$count', '[1,2]')).toBe(2);
  });

  it('returns string length for JSON object string starting with [', () => {
    // A string like '["not-an-array"]' that parses but not to an array shouldn't return undefined
    const objStr = '{"a":1}';
    expect(evalFn('$count', objStr)).toBe(objStr.length);
  });

  it('returns string length when JSON parse of bracket string yields non-array', () => {
    // Edge: `[` followed by non-JSON should fall through to string length
    expect(evalFn('$count', '[invalid')).toBe(8);
  });
});

describe('$flatten', () => {
  it('flattens nested arrays', () => {
    expect(evalFn('$flatten', [[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
  });

  it('returns empty when flatten input is not array', () => {
    expect(evalFn('$flatten', '{}')).toEqual([]);
  });
});

describe('$keys / $values', () => {
  it('returns keys of object', () => {
    expect(evalFn('$keys', { a: 1, b: 2 })).toEqual(['a', 'b']);
  });

  it('returns values of object', () => {
    expect(evalFn('$values', { a: 1, b: 2 })).toEqual([1, 2]);
  });

  it('parses JSON string for keys', () => {
    expect(evalFn('$keys', '{"x":1}')).toEqual(['x']);
  });
});

describe('$merge', () => {
  it('merges two objects', () => {
    expect(evalFn('$merge', { a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('second object overrides first', () => {
    expect(evalFn('$merge', { a: 1 }, { a: 99 })).toEqual({ a: 99 });
  });

  it('treats JSON array parse as empty object for merge', () => {
    expect(evalFn('$merge', { a: 1 }, '[1,2]')).toEqual({ a: 1 });
    expect(evalFn('$merge', '[1,2]', { b: 2 })).toEqual({ b: 2 });
  });

  it('returns override only when base JSON is invalid', () => {
    expect(evalFn('$merge', 'not-json', { z: 1 })).toEqual({ z: 1 });
  });
});

describe('$type', () => {
  it('returns "number"', () => { expect(evalFn('$type', 42)).toBe('number'); });
  it('returns "string"', () => { expect(evalFn('$type', 'hi')).toBe('string'); });
  it('returns "array"', () => { expect(evalFn('$type', [1])).toBe('array'); });
  it('returns "null"', () => { expect(evalFn('$type', null)).toBe('null'); });
  it('returns "object"', () => { expect(evalFn('$type', {})).toBe('object'); });
});

describe('$sort / $reverse / $unique', () => {
  it('sorts ascending', () => {
    expect(evalFn('$sort', [3, 1, 2])).toEqual([1, 2, 3]);
  });

  it('returns empty when sort input is not array', () => {
    expect(evalFn('$sort', '{}')).toEqual([]);
  });

  it('reverses', () => {
    expect(evalFn('$reverse', [1, 2, 3])).toEqual([3, 2, 1]);
  });

  it('returns empty when reverse input is not array', () => {
    expect(evalFn('$reverse', 'xx')).toEqual([]);
  });

  it('removes duplicates', () => {
    expect(evalFn('$unique', [1, 2, 2, 3])).toEqual([1, 2, 3]);
  });

  it('unique deduplicates equivalent objects', () => {
    expect(evalFn('$unique', [{ a: 1 }, { a: 1 }])).toEqual([{ a: 1 }]);
  });

  it('unique returns empty when input is not array and not JSON array', () => {
    expect(evalFn('$unique', 42)).toEqual([]);
    expect(evalFn('$unique', '{}')).toEqual([]);
  });

  it('unique deduplicates parsed JSON array string', () => {
    expect(evalFn('$unique', '[1,1,2,2]')).toEqual([1, 2]);
  });

  it('unique keeps primitive when set key collision stringifies same', () => {
    expect(evalFn('$unique', [1, '1'])).toEqual([1, '1']);
  });
});

describe('$first / $last / $slice', () => {
  it('first of array', () => { expect(evalFn('$first', [10, 20])).toBe(10); });
  it('last of array', () => { expect(evalFn('$last', [10, 20])).toBe(20); });
  it('slices array', () => { expect(evalFn('$slice', [1, 2, 3, 4], 1, 3)).toEqual([2, 3]); });
  it('first and last character of plain string', () => {
    expect(evalFn('$first', 'abc')).toBe('a');
    expect(evalFn('$last', 'abc')).toBe('c');
  });
  it('first and last from JSON array string', () => {
    expect(evalFn('$first', '[7,8,9]')).toBe(7);
    expect(evalFn('$last', '[7,8,9]')).toBe(9);
  });
  it('first and last fall back for invalid bracket-prefixed strings', () => {
    expect(evalFn('$first', '[broken')).toBe('[');
    expect(evalFn('$last', '[broken')).toBe('n');
  });
  it('returns null for empty array', () => {
    expect(evalFn('$first', [])).toBeNull();
    expect(evalFn('$last', [])).toBeNull();
  });
  it('slice with start only uses single-argument slice', () => {
    expect(evalFn('$slice', [1, 2, 3], 1)).toEqual([2, 3]);
  });

  it('slice returns empty when value is not an array', () => {
    expect(evalFn('$slice', '{}', 0, 1)).toEqual([]);
  });

  it('slice parses JSON array string', () => {
    expect(evalFn('$slice', '[1,2,3,4]', 1, 3)).toEqual([2, 3]);
  });

  it('first returns null when first element is null', () => {
    expect(evalFn('$first', [null])).toBeNull();
    expect(evalFn('$first', '[null]')).toBeNull();
  });

  it('last returns null when last element is null', () => {
    expect(evalFn('$last', [null])).toBeNull();
    expect(evalFn('$last', '[null]')).toBeNull();
  });

  it('first and last of empty string are empty', () => {
    expect(evalFn('$first', '')).toBe('');
    expect(evalFn('$last', '')).toBe('');
  });

  it('slice passes explicit end index including zero', () => {
    expect(evalFn('$slice', [1, 2, 3], 0, 0)).toEqual([]);
  });
});

describe('$parse / $stringify', () => {
  it('parses JSON', () => { expect(evalFn('$parse', '{"a":1}')).toEqual({ a: 1 }); });
  it('stringifies value', () => { expect(evalFn('$stringify', { a: 1 })).toBe('{"a":1}'); });
});
