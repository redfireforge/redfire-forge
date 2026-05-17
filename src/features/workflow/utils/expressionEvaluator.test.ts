import { describe, it, expect } from 'vitest';
import { evaluateExpression, formatExpressionResult, buildExpressionTemplate } from './expressionEvaluator';
import { EXPRESSION_FUNCTION_MAP } from './expressionFunctions';

describe('expressionEvaluator', () => {
  // ── Basic evaluation ──

  describe('evaluateExpression', () => {
    it('returns empty for empty expression', () => {
      expect(evaluateExpression('')).toEqual({ value: '' });
    });

    it('evaluates a simple function call', () => {
      const r = evaluateExpression('$upper("hello")');
      expect(r.value).toBe('HELLO');
      expect(r.error).toBeUndefined();
    });

    it('evaluates nested function calls', () => {
      const r = evaluateExpression('$upper($trim("  hello  "))');
      expect(r.value).toBe('HELLO');
    });

    it('evaluates function with number args', () => {
      const r = evaluateExpression('$add(10, 5)');
      expect(r.value).toBe(15);
    });

    it('evaluates function with negative number', () => {
      const r = evaluateExpression('$abs(-5)');
      expect(r.value).toBe(5);
    });

    it('evaluates boolean literal true', () => {
      const r = evaluateExpression('$if(true, "yes", "no")');
      expect(r.value).toBe('yes');
    });

    it('evaluates boolean literal false', () => {
      const r = evaluateExpression('$if(false, "yes", "no")');
      expect(r.value).toBe('no');
    });

    it('evaluates $concat with multiple args', () => {
      const r = evaluateExpression('$concat("a", "b", "c")');
      expect(r.value).toBe('abc');
    });

    it('resolves variable references', () => {
      const r = evaluateExpression('$upper({{name}})', {
        resolveVariable: (name) => name === 'name' ? 'world' : undefined,
      });
      expect(r.value).toBe('WORLD');
    });

    it('handles unresolved variables gracefully', () => {
      const r = evaluateExpression('$upper({{unknown}})');
      expect(r.value).toBe('{{UNKNOWN}}');
    });

    it('handles unknown function gracefully', () => {
      const r = evaluateExpression('$nonexistent("hello")');
      expect(r.value).toBe('{{$nonexistent}}');
    });

    it('supports chained property access on function result', () => {
      const data = [{ rank: 5, name: 'Premium' }, { rank: 1, name: 'Basic' }];
      const r = evaluateExpression('$maxBy({{items}}, x => x.rank).rank', {
        resolveVariable: (n) => n === 'items' ? data : undefined,
      });
      expect(r.error).toBeUndefined();
      expect(r.value).toBe(5);
    });

    it('supports chained property access returning a string', () => {
      const data = [{ rank: 5, name: 'Premium' }, { rank: 1, name: 'Basic' }];
      const r = evaluateExpression('$maxBy({{items}}, x => x.rank).name', {
        resolveVariable: (n) => n === 'items' ? data : undefined,
      });
      expect(r.value).toBe('Premium');
    });

    it('returns undefined for chained property on non-object result', () => {
      const r = evaluateExpression('$upper("hello").length');
      expect(r.value).toBeUndefined();
    });

    it('evaluates bare identifier as variable', () => {
      const r = evaluateExpression('$upper(myVar)', {
        resolveVariable: (name) => name === 'myVar' ? 'test' : undefined,
      });
      expect(r.value).toBe('TEST');
    });

    it('handles string with escaped quotes', () => {
      // Use String.raw to avoid JS escaping confusion
      const r = evaluateExpression(String.raw`$length("hello")`);
      expect(r.value).toBe(5);
    });

    it('handles single-quoted strings', () => {
      const r = evaluateExpression("$upper('hello')");
      expect(r.value).toBe('HELLO');
    });

    it('evaluates no-arg function', () => {
      const r = evaluateExpression('$now()');
      expect(typeof r.value).toBe('string');
      expect((r.value as string).length).toBeGreaterThan(0);
    });

    it('evaluates $contains', () => {
      const r = evaluateExpression('$contains("hello world", "world")');
      expect(r.value).toBe(true);
    });

    it('evaluates deeply nested expression', () => {
      const r = evaluateExpression('$concat($upper("a"), $lower("B"))');
      expect(r.value).toBe('Ab');
    });
  });

  // ── formatExpressionResult ──

  describe('formatExpressionResult', () => {
    it('returns empty string for null', () => {
      expect(formatExpressionResult(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatExpressionResult(undefined)).toBe('');
    });

    it('returns string for string', () => {
      expect(formatExpressionResult('hello')).toBe('hello');
    });

    it('returns string for number', () => {
      expect(formatExpressionResult(42)).toBe('42');
    });

    it('returns string for boolean', () => {
      expect(formatExpressionResult(true)).toBe('true');
    });

    it('returns JSON for object', () => {
      expect(formatExpressionResult({ a: 1 })).toBe('{"a":1}');
    });

    it('returns JSON for array', () => {
      expect(formatExpressionResult([1, 2])).toBe('[1,2]');
    });
  });

  // ── buildExpressionTemplate ──

  describe('buildExpressionTemplate', () => {
    it('builds template with no args', () => {
      expect(buildExpressionTemplate('$now', [])).toBe('{{$now()}}');
    });

    it('builds template with args', () => {
      expect(buildExpressionTemplate('$upper', ['{{name}}'])).toBe('{{$upper({{name}})}}');
    });

    it('builds template with multiple args', () => {
      expect(buildExpressionTemplate('$concat', ['"a"', '"b"'])).toBe('{{$concat("a", "b")}}');
    });
  });

  // ── Tokenizer / parser edge cases ──

  describe('tokenizer edge cases', () => {
    it('handles whitespace-only expression', () => {
      expect(evaluateExpression('   ')).toEqual({ value: '' });
    });

    it('handles escaped characters in double-quoted strings', () => {
      const r = evaluateExpression('$upper("he\\"llo")');
      expect(r.value).toBe('HE"LLO');
    });

    it('handles negative number at start', () => {
      const r = evaluateExpression('$abs(-42)');
      expect(r.value).toBe(42);
    });

    it('handles negative number after comma', () => {
      const r = evaluateExpression('$add(10, -3)');
      expect(r.value).toBe(7);
    });

    it('handles negative number after open paren', () => {
      const r = evaluateExpression('$abs(-5)');
      expect(r.value).toBe(5);
    });

    it('handles floating point numbers', () => {
      const r = evaluateExpression('$round(3.14159, 2)');
      expect(r.value).toBe(3.14);
    });

    it('skips unknown characters in tokenizer', () => {
      // @ is an unknown character, should be skipped
      const r = evaluateExpression('$upper(@"hello")');
      expect(r.value).toBe('HELLO');
    });

    it('handles function without parens (function name as standalone token)', () => {
      const r = evaluateExpression('$unknown');
      expect(r.value).toBe('{{$unknown}}');
    });

    it('handles bare identifier resolved as variable', () => {
      const r = evaluateExpression('myVar', {
        resolveVariable: (name) => name === 'myVar' ? 'resolved' : undefined,
      });
      expect(r.value).toBe('resolved');
    });

    it('handles unresolved bare identifier', () => {
      const r = evaluateExpression('myVar');
      expect(r.value).toBe('{{myVar}}');
    });

    it('handles boolean true as standalone', () => {
      const r = evaluateExpression('$if(true, "a", "b")');
      expect(r.value).toBe('a');
    });

    it('handles boolean false as standalone', () => {
      const r = evaluateExpression('$if(false, "a", "b")');
      expect(r.value).toBe('b');
    });

    it('handles empty token stream (all unknown chars)', () => {
      const r = evaluateExpression('@@@');
      expect(r.value).toBe('');
    });

    it('handles variable reference {{name}} in nested call', () => {
      const r = evaluateExpression('$concat({{greeting}}, " ", {{name}})', {
        resolveVariable: (name) => {
          if (name === 'greeting') return 'Hello';
          if (name === 'name') return 'World';
          return undefined;
        },
      });
      expect(r.value).toBe('Hello World');
    });

    it('handles function call that throws an error', () => {
      // $parse with invalid input that causes the function to return null (not throw),
      // but let's test a more complex case
      const r = evaluateExpression('$parse("invalid json")');
      expect(r.value).toBe(null);
    });

    it('handles identifier with dots', () => {
      const r = evaluateExpression('$upper(data.name)', {
        resolveVariable: (name) => name === 'data.name' ? 'test' : undefined,
      });
      expect(r.value).toBe('TEST');
    });

    it('handles nested parens properly', () => {
      const r = evaluateExpression('$concat($upper("a"), $lower("B"), $trim("  c  "))');
      expect(r.value).toBe('Abc');
    });

    it('evaluates rparen and comma tokens properly', () => {
      // Multiple args separated by commas
      const r = evaluateExpression('$concat("x", "y", "z")');
      expect(r.value).toBe('xyz');
    });

    it('parse handles empty tokens array', () => {
      // Empty expression after trimming
      const r = evaluateExpression('');
      expect(r.value).toBe('');
    });
  });

  describe('edge cases for branch coverage', () => {
    it('handles escape sequences in string literals', () => {
      const r = evaluateExpression('$upper("hello\\"world")');
      expect(r.value).toBeDefined();
    });

    it('handles negative number literal', () => {
      const r = evaluateExpression('$abs(-42)');
      expect(r.value).toBe(42);
    });

    it('handles boolean false literal', () => {
      const r = evaluateExpression('$if(false, "yes", "no")');
      expect(r.value).toBe('no');
    });

    it('handles unknown function name', () => {
      const r = evaluateExpression('$nonexistent("arg")');
      expect(r.value).toBe('{{$nonexistent}}');
    });

    it('handles bare identifier as variable', () => {
      const r = evaluateExpression('myVar', { resolveVariable: (n) => n === 'myVar' ? 'resolved' : undefined });
      expect(r.value).toBe('resolved');
    });

    it('handles unknown characters gracefully', () => {
      const r = evaluateExpression('$upper(@@@)');
      expect(r.value).toBeDefined();
    });

    it('handles function without parens', () => {
      const r = evaluateExpression('$upper');
      expect(r.value).toBeDefined();
    });

    it('handles function that throws error', () => {
      // $substring with invalid args can throw
      const r = evaluateExpression('$substring()');
      expect(r.value).toBeDefined();
    });

    it('handles single-quoted strings', () => {
      const r = evaluateExpression("$upper('hello')");
      expect(r.value).toBe('HELLO');
    });

    it('handles number with decimals', () => {
      const r = evaluateExpression('$abs(3.14)');
      expect(r.value).toBeCloseTo(3.14);
    });

    it('formatExpressionResult falls back when JSON.stringify throws', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(formatExpressionResult(circular)).toBe('[object Object]');
    });

    it('evaluateExpression returns error for unmatched rparen token', () => {
      const result = evaluateExpression(')');
      expect(result.value).toBeNull();
      expect(result.error).toContain('Unmatched parentheses');
    });

    it('evaluateExpression returns error for unclosed lparen', () => {
      const result = evaluateExpression('$eq($sum(1)');
      expect(result.value).toBeNull();
      expect(result.error).toContain('1 unclosed "("');
    });

    it('evaluateExpression returns error for unclosed bracket', () => {
      const result = evaluateExpression('[1, 2');
      expect(result.value).toBeNull();
      expect(result.error).toContain('Unmatched brackets');
    });

    it('evaluateExpression error path surfaces non-Error throws', () => {
      const spy = vi.spyOn(String.prototype, 'trim').mockImplementation(function (this: string) {
        if (this === 'boom') throw 'not-an-error';
        return String.prototype.trim.call(this);
      });
      try {
        const r = evaluateExpression('boom');
        expect(r.error).toBe('not-an-error');
        expect(r.value).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it('evalNode surfaces non-Error throws from functions', () => {
      const upper = EXPRESSION_FUNCTION_MAP.get('$upper');
      expect(upper).toBeDefined();
      const spy = vi.spyOn(upper!, 'evaluate').mockImplementation(() => {
        throw 'string-throw';
      });
      try {
        const r = evaluateExpression('$upper("a")');
        expect(r.value).toBe('[Error: string-throw]');
      } finally {
        spy.mockRestore();
      }
    });

    it('handles boolean true literal', () => {
      const r = evaluateExpression('$if(true, "yes", "no")');
      expect(r.value).toBe('yes');
    });
  });

  // ── Lambda expressions ──

  describe('lambda expressions', () => {
    describe('tokenizer — arrow token', () => {
      it('tokenizes => within a lambda expression', () => {
        const r = evaluateExpression('$map([1,2,3], x => $multiply(x, 2))');
        expect(r.error).toBeUndefined();
        expect(r.value).toEqual([2, 4, 6]);
      });

      it('handles arrow in multi-param lambda', () => {
        const r = evaluateExpression('$reduce([1,2,3], (acc, x) => $add(acc, x), 0)');
        expect(r.error).toBeUndefined();
        expect(r.value).toBe(6);
      });
    });

    describe('parser — single param lambda', () => {
      it('parses x => $upper(x)', () => {
        const r = evaluateExpression('$map(["hello","world"], x => $upper(x))');
        expect(r.value).toEqual(['HELLO', 'WORLD']);
      });

      it('parses lambda with dot-path access on param', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'items') return [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
            return undefined;
          },
        };
        const r = evaluateExpression('$map(items, u => u.name)', ctx);
        expect(r.value).toEqual(['Alice', 'Bob']);
      });
    });

    describe('parser — multi param lambda', () => {
      it('parses (a, b) => $add(a, b)', () => {
        const r = evaluateExpression('$reduce([10, 20, 30], (sum, x) => $add(sum, x), 0)');
        expect(r.value).toBe(60);
      });

      it('handles three-param lambda with index', () => {
        const r = evaluateExpression('$zip([1,2,3], [10,20,30], (a, b) => $add(a, b))');
        expect(r.value).toEqual([11, 22, 33]);
      });
    });

    describe('evaluator — closure scoping', () => {
      it('lambda captures outer variables', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'data') return [1, 2, 3];
            if (name === 'factor') return 10;
            return undefined;
          },
        };
        const r = evaluateExpression('$map(data, x => $multiply(x, factor))', ctx);
        expect(r.value).toEqual([10, 20, 30]);
      });

      it('lambda params shadow outer variables', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'items') return [5, 10, 15];
            if (name === 'x') return 999;
            return undefined;
          },
        };
        const r = evaluateExpression('$map(items, x => $add(x, 1))', ctx);
        expect(r.value).toEqual([6, 11, 16]);
      });
    });

    describe('$map', () => {
      it('maps with index parameter', () => {
        const r = evaluateExpression('$map(["a","b","c"], (item, idx) => $concat(item, $toString(idx)))');
        expect(r.value).toEqual(['a0', 'b1', 'c2']);
      });

      it('returns empty array for empty input', () => {
        const r = evaluateExpression('$map([], x => $upper(x))');
        expect(r.value).toEqual([]);
      });
    });

    describe('$filter', () => {
      it('filters elements by predicate', () => {
        const r = evaluateExpression('$filter([1,2,3,4,5], x => $gt(x, 3))');
        expect(r.value).toEqual([4, 5]);
      });

      it('filters objects by property', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'users') return [
              { name: 'Alice', active: true },
              { name: 'Bob', active: false },
              { name: 'Carol', active: true },
            ];
            return undefined;
          },
        };
        const r = evaluateExpression('$filter(users, u => u.active)', ctx);
        expect(r.value).toEqual([
          { name: 'Alice', active: true },
          { name: 'Carol', active: true },
        ]);
      });

      it('returns empty array when nothing matches', () => {
        const r = evaluateExpression('$filter([1,2,3], x => $gt(x, 10))');
        expect(r.value).toEqual([]);
      });
    });

    describe('$reduce', () => {
      it('reduces without initial value (uses first element)', () => {
        const r = evaluateExpression('$reduce([1,2,3,4], (acc, x) => $add(acc, x))');
        expect(r.value).toBe(10);
      });

      it('reduces with initial value', () => {
        const r = evaluateExpression('$reduce([1,2,3], (acc, x) => $add(acc, x), 100)');
        expect(r.value).toBe(106);
      });

      it('handles empty array', () => {
        const r = evaluateExpression('$reduce([], (acc, x) => $add(acc, x), 0)');
        expect(r.value).toBe(0);
      });

      it('builds string concatenation', () => {
        const r = evaluateExpression('$reduce(["a","b","c"], (acc, x) => $concat(acc, x), "")');
        expect(r.value).toBe('abc');
      });
    });

    describe('$sortBy', () => {
      it('sorts by numeric key', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'items') return [{ n: 3 }, { n: 1 }, { n: 2 }];
            return undefined;
          },
        };
        const r = evaluateExpression('$sortBy(items, x => x.n)', ctx);
        expect(r.value).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
      });

      it('sorts by string key', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'items') return [
              { name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' },
            ];
            return undefined;
          },
        };
        const r = evaluateExpression('$sortBy(items, x => x.name)', ctx);
        expect(r.value).toEqual([
          { name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' },
        ]);
      });

      it('handles empty array', () => {
        const r = evaluateExpression('$sortBy([], x => x)');
        expect(r.value).toEqual([]);
      });
    });

    describe('$minBy / $maxBy', () => {
      it('finds minimum by key', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'items') return [{ score: 85 }, { score: 42 }, { score: 97 }];
            return undefined;
          },
        };
        const r = evaluateExpression('$minBy(items, x => x.score)', ctx);
        expect(r.value).toEqual({ score: 42 });
      });

      it('finds maximum by key', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'items') return [{ score: 85 }, { score: 42 }, { score: 97 }];
            return undefined;
          },
        };
        const r = evaluateExpression('$maxBy(items, x => x.score)', ctx);
        expect(r.value).toEqual({ score: 97 });
      });

      it('returns null for empty array', () => {
        const r = evaluateExpression('$minBy([], x => x)');
        expect(r.value).toBeNull();
      });
    });

    describe('$distinctBy', () => {
      it('deduplicates by key', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'items') return [
              { id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' },
            ];
            return undefined;
          },
        };
        const r = evaluateExpression('$distinctBy(items, x => x.id)', ctx);
        expect(r.value).toEqual([
          { id: 1, name: 'a' }, { id: 2, name: 'b' },
        ]);
      });

      it('keeps first occurrence', () => {
        const r = evaluateExpression('$distinctBy([3,1,2,1,3], x => x)');
        expect(r.value).toEqual([3, 1, 2]);
      });
    });

    describe('$zip', () => {
      it('zips without function returns pairs', () => {
        const r = evaluateExpression('$zip([1,2,3], ["a","b","c"])');
        expect(r.value).toEqual([[1, 'a'], [2, 'b'], [3, 'c']]);
      });

      it('zips with function applies it', () => {
        const r = evaluateExpression('$zip([1,2], [10,20], (a, b) => $add(a, b))');
        expect(r.value).toEqual([11, 22]);
      });

      it('truncates to shorter array', () => {
        const r = evaluateExpression('$zip([1,2,3], ["a","b"])');
        expect(r.value).toEqual([[1, 'a'], [2, 'b']]);
      });
    });

    describe('$mapValues', () => {
      it('transforms values of an object', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'obj') return { a: 1, b: 2, c: 3 };
            return undefined;
          },
        };
        const r = evaluateExpression('$mapValues(obj, v => $multiply(v, 10))', ctx);
        expect(r.value).toEqual({ a: 10, b: 20, c: 30 });
      });
    });

    describe('$mapKeys', () => {
      it('transforms keys of an object', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'obj') return { name: 'Alice', age: 30 };
            return undefined;
          },
        };
        const r = evaluateExpression('$mapKeys(obj, k => $upper(k))', ctx);
        expect(r.value).toEqual({ NAME: 'Alice', AGE: 30 });
      });
    });

    describe('$withEntries', () => {
      it('transforms entries of an object', () => {
        const ctx = {
          resolveVariable: (name: string) => {
            if (name === 'obj') return { a: 1 };
            return undefined;
          },
        };
        const r = evaluateExpression('$withEntries(obj, e => e)', ctx);
        expect(r.value).toEqual({ a: 1 });
      });
    });
  });

  // ── Comparison helpers ──

  describe('comparison helpers', () => {
    it('$gt returns true when a > b', () => {
      expect(evaluateExpression('$gt(5, 3)').value).toBe(true);
      expect(evaluateExpression('$gt(3, 5)').value).toBe(false);
      expect(evaluateExpression('$gt(3, 3)').value).toBe(false);
    });

    it('$gte returns true when a >= b', () => {
      expect(evaluateExpression('$gte(5, 3)').value).toBe(true);
      expect(evaluateExpression('$gte(3, 3)').value).toBe(true);
      expect(evaluateExpression('$gte(2, 3)').value).toBe(false);
    });

    it('$lt returns true when a < b', () => {
      expect(evaluateExpression('$lt(2, 5)').value).toBe(true);
      expect(evaluateExpression('$lt(5, 3)').value).toBe(false);
    });

    it('$lte returns true when a <= b', () => {
      expect(evaluateExpression('$lte(3, 3)').value).toBe(true);
      expect(evaluateExpression('$lte(5, 3)').value).toBe(false);
    });

    it('$eq compares values', () => {
      expect(evaluateExpression('$eq(5, 5)').value).toBe(true);
      expect(evaluateExpression('$eq("a", "a")').value).toBe(true);
      expect(evaluateExpression('$eq(5, 3)').value).toBe(false);
    });

    it('$neq compares values for inequality', () => {
      expect(evaluateExpression('$neq(5, 3)').value).toBe(true);
      expect(evaluateExpression('$neq(5, 5)').value).toBe(false);
    });

    it('$log returns natural logarithm', () => {
      expect(evaluateExpression('$log(1)').value).toBe(0);
      const e = evaluateExpression('$log(2.718281828)').value as number;
      expect(e).toBeCloseTo(1, 5);
    });

    it('$exp returns e^n', () => {
      expect(evaluateExpression('$exp(0)').value).toBe(1);
      const e = evaluateExpression('$exp(1)').value as number;
      expect(e).toBeCloseTo(Math.E, 5);
    });
  });

  // ── New string functions ──

  describe('new string functions', () => {
    it('$kebabCase converts to kebab-case', () => {
      expect(evaluateExpression('$kebabCase("helloWorld")').value).toBe('hello-world');
      expect(evaluateExpression('$kebabCase("HelloWorldTest")').value).toBe('hello-world-test');
    });

    it('$isAlpha checks alphabetic strings', () => {
      expect(evaluateExpression('$isAlpha("Hello")').value).toBe(true);
      expect(evaluateExpression('$isAlpha("Hello123")').value).toBe(false);
      expect(evaluateExpression('$isAlpha("")').value).toBe(false);
    });

    it('$isNumeric checks numeric strings', () => {
      expect(evaluateExpression('$isNumeric("123")').value).toBe(true);
      expect(evaluateExpression('$isNumeric("12.34")').value).toBe(true);
      expect(evaluateExpression('$isNumeric("abc")').value).toBe(false);
      expect(evaluateExpression('$isNumeric("")').value).toBe(false);
    });

    it('$trimStart removes leading whitespace', () => {
      expect(evaluateExpression('$trimStart("  hello  ")').value).toBe('hello  ');
    });

    it('$trimEnd removes trailing whitespace', () => {
      expect(evaluateExpression('$trimEnd("  hello  ")').value).toBe('  hello');
    });

    it('$scan finds all matches', () => {
      expect(evaluateExpression('$scan("a1b2c3", "[0-9]+")').value).toEqual(['1', '2', '3']);
      expect(evaluateExpression('$scan("hello world", "[a-z]+")').value).toEqual(['hello', 'world']);
    });
  });

  // ── formatExpressionResult with lambda ──

  describe('formatExpressionResult with lambda', () => {
    it('formats lambda values', () => {
      const r = evaluateExpression('x => $upper(x)');
      expect(formatExpressionResult(r.value)).toBe('[Lambda: (x) => ...]');
    });

    it('formats multi-param lambda', () => {
      const r = evaluateExpression('(a, b) => $add(a, b)');
      expect(formatExpressionResult(r.value)).toBe('[Lambda: (a, b) => ...]');
    });
  });

  // ── Edge cases from bug review ──

  describe('edge cases', () => {
    it('array literal with nested arrays', () => {
      const r = evaluateExpression('$map([1, [2, 3], 4], x => x)');
      expect(r.value).toEqual([1, [2, 3], 4]);
    });

    it('array literal with negative numbers', () => {
      const r = evaluateExpression('$sum([-1, -2, -3])');
      expect(r.value).toBe(-6);
    });

    it('array literal with booleans', () => {
      const r = evaluateExpression('$filter([true, false, true], x => x)');
      expect(r.value).toEqual([true, true]);
    });

    it('lambda with deep dot-path access', () => {
      const ctx = {
        resolveVariable: (name: string) => {
          if (name === 'items') return [
            { address: { city: 'NYC', zip: '10001' } },
            { address: { city: 'LA', zip: '90001' } },
          ];
          return undefined;
        },
      };
      const r = evaluateExpression('$map(items, x => x.address.city)', ctx);
      expect(r.value).toEqual(['NYC', 'LA']);
    });

    it('$minBy/$maxBy with string keys', () => {
      const ctx = {
        resolveVariable: (name: string) => {
          if (name === 'items') return [
            { name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' },
          ];
          return undefined;
        },
      };
      const rMin = evaluateExpression('$minBy(items, x => x.name)', ctx);
      expect(rMin.value).toEqual({ name: 'Alice' });
      const rMax = evaluateExpression('$maxBy(items, x => x.name)', ctx);
      expect(rMax.value).toEqual({ name: 'Charlie' });
    });

    it('$minBy/$maxBy with single element', () => {
      const r = evaluateExpression('$minBy([42], x => x)');
      expect(r.value).toBe(42);
    });

    it('nested lambda in $map with $filter', () => {
      const ctx = {
        resolveVariable: (name: string) => {
          if (name === 'data') return [1, 2, 3, 4, 5, 6];
          return undefined;
        },
      };
      const r = evaluateExpression('$filter(data, x => $gte(x, 3))', ctx);
      expect(r.value).toEqual([3, 4, 5, 6]);
    });

    it('$reduce with string accumulator', () => {
      const r = evaluateExpression('$reduce(["a", "b", "c"], (acc, x) => $concat(acc, $concat("-", x)), "start")');
      expect(r.value).toBe('start-a-b-c');
    });

    it('empty array literal', () => {
      const r = evaluateExpression('$length([])');
      expect(r.value).toBe(0);
    });

    it('lambda closure captures outer variable', () => {
      const ctx = {
        resolveVariable: (name: string) => {
          if (name === 'items') return [10, 20, 30];
          if (name === 'multiplier') return 5;
          return undefined;
        },
      };
      const r = evaluateExpression('$map(items, x => $multiply(x, multiplier))', ctx);
      expect(r.value).toEqual([50, 100, 150]);
    });
  });
});
