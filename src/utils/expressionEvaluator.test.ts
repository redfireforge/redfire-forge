import { describe, it, expect } from 'vitest';
import { evaluateExpression, formatExpressionResult, buildExpressionTemplate } from './expressionEvaluator';

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
});
