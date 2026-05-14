import { describe, it, expect } from 'vitest';
import { arrayFunctions } from './arrayFunctions';
import { evaluateExpression } from '../expressionEvaluator';

function fn(name: string) {
  const f = arrayFunctions.find((af) => af.name === name);
  if (!f) throw new Error(`Function ${name} not found`);
  return f.evaluate;
}

function eval$(expr: string, vars?: Record<string, unknown>) {
  const ctx = vars ? {
    resolveVariable: (name: string) => {
      if (name in vars) return vars[name];
      const dotIdx = name.indexOf('.');
      if (dotIdx > 0) {
        const root = name.slice(0, dotIdx);
        if (root in vars) {
          const val = vars[root];
          const path = name.slice(dotIdx + 1);
          let cur: unknown = val;
          for (const part of path.split('.')) {
            if (cur == null || typeof cur !== 'object') return undefined;
            cur = (cur as Record<string, unknown>)[part];
          }
          return cur;
        }
      }
      return undefined;
    },
  } : {};
  return evaluateExpression(expr, ctx).value;
}

describe('arrayFunctions', () => {
  it('exports 13 functions', () => {
    expect(arrayFunctions).toHaveLength(13);
  });

  describe('$sum', () => {
    it('sums numeric array', () => expect(fn('$sum')([1, 2, 3, 4])).toBe(10));
    it('returns 0 for empty array', () => expect(fn('$sum')([])).toBe(0));
    it('coerces string numbers', () => expect(fn('$sum')(['10', '20', '30'])).toBe(60));
    it('treats non-numeric as 0', () => expect(fn('$sum')([1, 'foo', 3])).toBe(4));
    it('handles null input', () => expect(fn('$sum')(null)).toBe(0));
    it('wraps single value', () => expect(fn('$sum')(5)).toBe(5));
    it('parses JSON string arrays', () => expect(fn('$sum')('[1, 2, 3]')).toBe(6));
    it('handles invalid JSON string gracefully', () => expect(fn('$sum')('[invalid')).toBe(0));
  });

  describe('$average', () => {
    it('calculates mean', () => expect(fn('$average')([10, 20, 30])).toBe(20));
    it('returns 0 for empty array', () => expect(fn('$average')([])).toBe(0));
    it('handles single element', () => expect(fn('$average')([7])).toBe(7));
    it('handles decimal results', () => expect(fn('$average')([1, 2])).toBe(1.5));
    it('handles null input', () => expect(fn('$average')(null)).toBe(0));
    it('parses JSON string arrays', () => expect(fn('$average')('[10, 20, 30]')).toBe(20));
  });

  describe('$groupBy', () => {
    const items = [
      { status: 'active', name: 'Alice' },
      { status: 'inactive', name: 'Bob' },
      { status: 'active', name: 'Carol' },
    ];

    it('groups by a key field', () => {
      const result = fn('$groupBy')(items, 'status') as Record<string, unknown[]>;
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['active']).toHaveLength(2);
      expect(result['inactive']).toHaveLength(1);
    });

    it('handles empty array', () => {
      expect(fn('$groupBy')([], 'key')).toEqual({});
    });

    it('handles missing key (groups under empty string)', () => {
      const result = fn('$groupBy')([{ a: 1 }, { a: 2 }], 'missing') as Record<string, unknown[]>;
      expect(result['']).toHaveLength(2);
    });

    it('handles nested keys', () => {
      const data = [
        { meta: { type: 'A' }, val: 1 },
        { meta: { type: 'B' }, val: 2 },
        { meta: { type: 'A' }, val: 3 },
      ];
      const result = fn('$groupBy')(data, 'meta.type') as Record<string, unknown[]>;
      expect(result['A']).toHaveLength(2);
      expect(result['B']).toHaveLength(1);
    });

    it('handles null input', () => {
      expect(fn('$groupBy')(null, 'key')).toEqual({});
    });

    it('parses JSON string input', () => {
      const json = JSON.stringify([{ status: 'a' }, { status: 'b' }, { status: 'a' }]);
      const result = fn('$groupBy')(json, 'status') as Record<string, unknown[]>;
      expect(result['a']).toHaveLength(2);
      expect(result['b']).toHaveLength(1);
    });
  });

  describe('$any', () => {
    const items = [{ rank: 3 }, { rank: 7 }, { rank: 1 }];

    it('returns true when any match', () => {
      expect(fn('$any')(items, 'rank', '>', 5)).toBe(true);
    });

    it('returns false when none match', () => {
      expect(fn('$any')(items, 'rank', '>', 10)).toBe(false);
    });

    it('works with equality', () => {
      expect(fn('$any')(items, 'rank', '=', 7)).toBe(true);
    });

    it('works with contains operator', () => {
      const strings = [{ name: 'hello' }, { name: 'world' }];
      expect(fn('$any')(strings, 'name', 'contains', 'ell')).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(fn('$any')([], 'rank', '>', 0)).toBe(false);
    });
  });

  describe('$all', () => {
    it('returns true when all match', () => {
      const items = [{ rank: 7 }, { rank: 9 }, { rank: 11 }];
      expect(fn('$all')(items, 'rank', '>', 5)).toBe(true);
    });

    it('returns false when some don\'t match', () => {
      const items = [{ rank: 7 }, { rank: 3 }, { rank: 11 }];
      expect(fn('$all')(items, 'rank', '>', 5)).toBe(false);
    });

    it('returns true for empty array (vacuous truth)', () => {
      expect(fn('$all')([], 'rank', '>', 5)).toBe(true);
    });

    it('works with not_equals', () => {
      const items = [{ status: 'active' }, { status: 'active' }];
      expect(fn('$all')(items, 'status', '!=', 'inactive')).toBe(true);
    });

    it('works with starts_with', () => {
      const items = [{ name: 'hello' }, { name: 'hey' }];
      expect(fn('$all')(items, 'name', 'starts_with', 'he')).toBe(true);
    });
  });

  describe('$map (lambda)', () => {
    it('maps with identity', () => {
      expect(eval$('$map([1,2,3], x => x)')).toEqual([1, 2, 3]);
    });
    it('maps with transformation', () => {
      expect(eval$('$map([1,2,3], x => $multiply(x, 2))')).toEqual([2, 4, 6]);
    });
    it('maps strings', () => {
      expect(eval$('$map(["a","b","c"], x => $upper(x))')).toEqual(['A', 'B', 'C']);
    });
    it('maps with index parameter', () => {
      expect(eval$('$map(["x","y"], (item, idx) => idx)')).toEqual([0, 1]);
    });
    it('maps objects with dot-path', () => {
      const vars = { items: [{ name: 'Alice' }, { name: 'Bob' }] };
      expect(eval$('$map(items, u => u.name)', vars)).toEqual(['Alice', 'Bob']);
    });
    it('returns empty for empty array', () => {
      expect(eval$('$map([], x => x)')).toEqual([]);
    });
    it('returns array unchanged without lambda', () => {
      expect(fn('$map')([1, 2], 'notALambda')).toEqual([1, 2]);
    });
  });

  describe('$filter (lambda)', () => {
    it('filters by numeric predicate', () => {
      expect(eval$('$filter([1,2,3,4,5], x => $gt(x, 3))')).toEqual([4, 5]);
    });
    it('filters by truthy property', () => {
      const vars = {
        items: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
          { name: 'Carol', active: true },
        ],
      };
      expect(eval$('$filter(items, u => u.active)', vars)).toEqual([
        { name: 'Alice', active: true },
        { name: 'Carol', active: true },
      ]);
    });
    it('returns empty when nothing matches', () => {
      expect(eval$('$filter([1,2,3], x => $gt(x, 10))')).toEqual([]);
    });
    it('returns all when everything matches', () => {
      expect(eval$('$filter([1,2,3], x => $gt(x, 0))')).toEqual([1, 2, 3]);
    });
  });

  describe('$reduce (lambda)', () => {
    it('sums array', () => {
      expect(eval$('$reduce([1,2,3,4], (acc, x) => $add(acc, x), 0)')).toBe(10);
    });
    it('concatenates strings', () => {
      expect(eval$('$reduce(["a","b","c"], (acc, x) => $concat(acc, x), "")')).toBe('abc');
    });
    it('uses first element when no initial', () => {
      expect(eval$('$reduce([10,20,30], (acc, x) => $add(acc, x))')).toBe(60);
    });
    it('returns initial for empty array', () => {
      expect(eval$('$reduce([], (acc, x) => $add(acc, x), 42)')).toBe(42);
    });
  });

  describe('$sortBy (lambda)', () => {
    it('sorts numbers ascending', () => {
      expect(eval$('$sortBy([3,1,4,1,5], x => x)')).toEqual([1, 1, 3, 4, 5]);
    });
    it('sorts objects by property', () => {
      const vars = { items: [{ n: 3 }, { n: 1 }, { n: 2 }] };
      expect(eval$('$sortBy(items, x => x.n)', vars)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    });
    it('handles empty array', () => {
      expect(eval$('$sortBy([], x => x)')).toEqual([]);
    });
  });

  describe('$minBy / $maxBy (lambda)', () => {
    it('finds min', () => {
      const vars = { items: [{ s: 85 }, { s: 42 }, { s: 97 }] };
      expect(eval$('$minBy(items, x => x.s)', vars)).toEqual({ s: 42 });
    });
    it('finds max', () => {
      const vars = { items: [{ s: 85 }, { s: 42 }, { s: 97 }] };
      expect(eval$('$maxBy(items, x => x.s)', vars)).toEqual({ s: 97 });
    });
    it('returns null for empty array', () => {
      expect(eval$('$minBy([], x => x)')).toBeNull();
      expect(eval$('$maxBy([], x => x)')).toBeNull();
    });
  });

  describe('$distinctBy (lambda)', () => {
    it('deduplicates by key', () => {
      const vars = {
        items: [{ id: 1, n: 'a' }, { id: 2, n: 'b' }, { id: 1, n: 'c' }],
      };
      expect(eval$('$distinctBy(items, x => x.id)', vars)).toEqual([
        { id: 1, n: 'a' }, { id: 2, n: 'b' },
      ]);
    });
    it('preserves first occurrence', () => {
      expect(eval$('$distinctBy([3,1,2,1,3], x => x)')).toEqual([3, 1, 2]);
    });
  });

  describe('$zip (lambda)', () => {
    it('zips without function', () => {
      expect(eval$('$zip([1,2,3], ["a","b","c"])')).toEqual([[1, 'a'], [2, 'b'], [3, 'c']]);
    });
    it('zips with function', () => {
      expect(eval$('$zip([1,2], [10,20], (a, b) => $add(a, b))')).toEqual([11, 22]);
    });
    it('truncates to shorter', () => {
      expect(eval$('$zip([1,2,3], ["a","b"])')).toEqual([[1, 'a'], [2, 'b']]);
    });
  });

  describe('internal helper coverage', () => {
    describe('$any / $all with bracket-notation paths', () => {
      it('$any supports bracket notation in field path', () => {
        const items = [{ data: [{ score: 10 }] }, { data: [{ score: 20 }] }];
        expect(fn('$any')(items, 'data[0].score', '>', 15)).toBe(true);
      });

      it('$all with bracket notation', () => {
        const items = [{ items: [5] }, { items: [10] }];
        expect(fn('$all')(items, 'items[0]', '>=', 5)).toBe(true);
      });

      it('$groupBy with bracket notation key', () => {
        const data = [{ tags: ['a'] }, { tags: ['b'] }, { tags: ['a'] }];
        const result = fn('$groupBy')(data, 'tags[0]') as Record<string, unknown[]>;
        expect(result['a']).toHaveLength(2);
        expect(result['b']).toHaveLength(1);
      });
    });

    describe('compareValues edge cases', () => {
      it('$any with <= operator', () => {
        const items = [{ v: 3 }, { v: 5 }, { v: 7 }];
        expect(fn('$any')(items, 'v', '<=', 3)).toBe(true);
      });

      it('$any with < operator', () => {
        const items = [{ v: 3 }, { v: 5 }];
        expect(fn('$any')(items, 'v', '<', 4)).toBe(true);
      });

      it('$any with ends_with operator', () => {
        const items = [{ name: 'hello' }, { name: 'world' }];
        expect(fn('$any')(items, 'name', 'ends_with', 'rld')).toBe(true);
      });

      it('$any with == (alias for =)', () => {
        const items = [{ status: 'done' }];
        expect(fn('$any')(items, 'status', '==', 'done')).toBe(true);
      });

      it('$any with equals alias', () => {
        const items = [{ n: 1 }];
        expect(fn('$any')(items, 'n', 'equals', 1)).toBe(true);
      });

      it('$any with <> (alias for !=)', () => {
        const items = [{ v: 'a' }];
        expect(fn('$any')(items, 'v', '<>', 'b')).toBe(true);
      });

      it('$any with not_equals', () => {
        const items = [{ v: 'a' }];
        expect(fn('$any')(items, 'v', 'not_equals', 'b')).toBe(true);
      });

      it('$any with unknown operator returns false', () => {
        const items = [{ v: 1 }];
        expect(fn('$any')(items, 'v', 'bogus', 1)).toBe(false);
      });

      it('compareValues numeric comparison with non-numeric values', () => {
        const items = [{ v: 'abc' }];
        expect(fn('$any')(items, 'v', '>', 0)).toBe(false);
      });

      it('compareValues with empty string operands', () => {
        const items = [{ v: '' }];
        expect(fn('$any')(items, 'v', '>', 0)).toBe(false);
      });
    });

    describe('$filter with index parameter', () => {
      it('filter uses index in predicate', () => {
        expect(eval$('$filter([10,20,30,40], (item, idx) => $eq(idx, 1))')).toEqual([20]);
      });
    });

    describe('$reduce without lambda', () => {
      it('returns initial when fn is not lambda', () => {
        expect(fn('$reduce')([1, 2, 3], 'notALambda', 99)).toBe(99);
      });

      it('returns null when no initial and not lambda', () => {
        expect(fn('$reduce')([1, 2, 3], 'notALambda')).toBeNull();
      });
    });

    describe('$sortBy / $minBy / $maxBy without lambda', () => {
      it('$sortBy returns array unchanged without lambda', () => {
        expect(fn('$sortBy')([3, 1, 2], 'notALambda')).toEqual([3, 1, 2]);
      });

      it('$minBy returns null without lambda', () => {
        expect(fn('$minBy')([1, 2], 'notALambda')).toBeNull();
      });

      it('$maxBy returns null without lambda', () => {
        expect(fn('$maxBy')([1, 2], 'notALambda')).toBeNull();
      });

      it('$distinctBy returns array unchanged without lambda', () => {
        expect(fn('$distinctBy')([1, 2, 2], 'notALambda')).toEqual([1, 2, 2]);
      });
    });

    describe('$sortBy null key handling', () => {
      it('handles null keys in sort', () => {
        const vars = { items: [{ n: null }, { n: 2 }, { n: 1 }] };
        const result = eval$('$sortBy(items, x => x.n)', vars);
        expect(result).toHaveLength(3);
      });
    });
  });
});
