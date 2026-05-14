import { describe, it, expect } from 'vitest';
import { objectFunctions } from './objectFunctions';
import { evaluateExpression } from '../expressionEvaluator';

function eval$(expr: string, vars?: Record<string, unknown>) {
  const ctx = vars ? {
    resolveVariable: (name: string) => {
      if (name in vars) return vars[name];
      return undefined;
    },
  } : {};
  return evaluateExpression(expr, ctx).value;
}

function fn(name: string) {
  const f = objectFunctions.find((of) => of.name === name);
  if (!f) throw new Error(`Function ${name} not found`);
  return f.evaluate;
}

describe('objectFunctions', () => {
  it('exports 8 functions', () => {
    expect(objectFunctions).toHaveLength(8);
  });

  describe('$has', () => {
    it('returns true when key exists', () => {
      expect(fn('$has')({ name: 'Alice', age: 30 }, 'name')).toBe(true);
    });

    it('returns false when key is missing', () => {
      expect(fn('$has')({ name: 'Alice' }, 'email')).toBe(false);
    });

    it('returns true for key with undefined value', () => {
      expect(fn('$has')({ x: undefined }, 'x')).toBe(true);
    });

    it('handles null input gracefully', () => {
      expect(fn('$has')(null, 'key')).toBe(false);
    });

    it('handles non-object input', () => {
      expect(fn('$has')('string', 'length')).toBe(false);
    });

    it('parses JSON string objects', () => {
      expect(fn('$has')('{"name":"Alice","age":30}', 'name')).toBe(true);
      expect(fn('$has')('{"name":"Alice"}', 'email')).toBe(false);
    });
  });

  describe('$toEntries', () => {
    it('converts object to entries', () => {
      const result = fn('$toEntries')({ a: 1, b: 2 }) as { key: string; value: unknown }[];
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ key: 'a', value: 1 });
      expect(result[1]).toEqual({ key: 'b', value: 2 });
    });

    it('handles empty object', () => {
      expect(fn('$toEntries')({})).toEqual([]);
    });

    it('handles null input', () => {
      expect(fn('$toEntries')(null)).toEqual([]);
    });

    it('preserves complex values', () => {
      const result = fn('$toEntries')({ data: [1, 2, 3] }) as { key: string; value: unknown }[];
      expect(result[0]).toEqual({ key: 'data', value: [1, 2, 3] });
    });
  });

  describe('$fromEntries', () => {
    it('converts entries back to object', () => {
      const entries = [{ key: 'a', value: 1 }, { key: 'b', value: 2 }];
      expect(fn('$fromEntries')(entries)).toEqual({ a: 1, b: 2 });
    });

    it('handles empty array', () => {
      expect(fn('$fromEntries')([])).toEqual({});
    });

    it('handles non-array input', () => {
      expect(fn('$fromEntries')('not array')).toEqual({});
    });

    it('skips entries without key', () => {
      const entries = [{ key: 'a', value: 1 }, { value: 2 }];
      expect(fn('$fromEntries')(entries)).toEqual({ a: 1 });
    });

    it('handles null entries in array', () => {
      const entries = [{ key: 'x', value: 10 }, null, { key: 'y', value: 20 }];
      expect(fn('$fromEntries')(entries)).toEqual({ x: 10, y: 20 });
    });
  });

  describe('$pick', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };

    it('picks specified keys', () => {
      expect(fn('$pick')(obj, 'a,c')).toEqual({ a: 1, c: 3 });
    });

    it('ignores missing keys', () => {
      expect(fn('$pick')(obj, 'a,z')).toEqual({ a: 1 });
    });

    it('handles spaces in key list', () => {
      expect(fn('$pick')(obj, 'a, b, c')).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('returns empty for empty keys', () => {
      expect(fn('$pick')(obj, '')).toEqual({});
    });

    it('handles null input', () => {
      expect(fn('$pick')(null, 'a')).toEqual({});
    });

    it('parses JSON string objects', () => {
      expect(fn('$pick')('{"a":1,"b":2,"c":3}', 'a,c')).toEqual({ a: 1, c: 3 });
    });
  });

  describe('$omit', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };

    it('omits specified keys', () => {
      expect(fn('$omit')(obj, 'b,d')).toEqual({ a: 1, c: 3 });
    });

    it('ignores non-existent keys', () => {
      expect(fn('$omit')(obj, 'z')).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    it('handles spaces in key list', () => {
      expect(fn('$omit')(obj, 'a, b')).toEqual({ c: 3, d: 4 });
    });

    it('returns full object for empty keys', () => {
      expect(fn('$omit')(obj, '')).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    it('handles null input', () => {
      expect(fn('$omit')(null, 'a')).toEqual({});
    });

    it('parses JSON string objects', () => {
      expect(fn('$omit')('{"a":1,"b":2,"c":3}', 'b')).toEqual({ a: 1, c: 3 });
    });
  });

  describe('$mapValues (lambda)', () => {
    it('transforms values', () => {
      const vars = { obj: { a: 1, b: 2, c: 3 } };
      expect(eval$('$mapValues(obj, v => $multiply(v, 10))', vars)).toEqual({ a: 10, b: 20, c: 30 });
    });
    it('handles empty object', () => {
      const vars = { obj: {} };
      expect(eval$('$mapValues(obj, v => v)', vars)).toEqual({});
    });
    it('returns object unchanged without lambda', () => {
      expect(fn('$mapValues')({ a: 1 }, 'notALambda')).toEqual({ a: 1 });
    });
  });

  describe('$mapKeys (lambda)', () => {
    it('transforms keys', () => {
      const vars = { obj: { name: 'Alice', age: 30 } };
      expect(eval$('$mapKeys(obj, k => $upper(k))', vars)).toEqual({ NAME: 'Alice', AGE: 30 });
    });
    it('handles empty object', () => {
      const vars = { obj: {} };
      expect(eval$('$mapKeys(obj, k => k)', vars)).toEqual({});
    });
  });

  describe('$withEntries (lambda)', () => {
    it('passes through with identity', () => {
      const vars = { obj: { a: 1, b: 2 } };
      expect(eval$('$withEntries(obj, e => e)', vars)).toEqual({ a: 1, b: 2 });
    });
    it('returns object unchanged without lambda', () => {
      expect(fn('$withEntries')({ a: 1 }, 'notALambda')).toEqual({ a: 1 });
    });
  });
});
