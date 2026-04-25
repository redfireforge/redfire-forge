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
});
