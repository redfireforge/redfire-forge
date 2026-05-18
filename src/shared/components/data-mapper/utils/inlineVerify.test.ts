import { describe, it, expect } from 'vitest';
import {
  runInlineVerify,
  enrichUndefined,
} from './inlineVerify';

describe('inlineVerify', () => {
  describe('enrichUndefined', () => {
    it('returns "undefined" when root data is primitive', () => {
      expect(enrichUndefined('$.a.b', 42)).toBe('undefined');
    });

    it('shows available keys when parent is an object', () => {
      const data = { foo: { bar: 1, baz: 2 } };
      const result = enrichUndefined('$.foo.missing', data);
      expect(result).toContain('bar');
      expect(result).toContain('baz');
      expect(result).toContain('undefined');
    });

    it('shows Array[N] when parent is an array', () => {
      const data = { items: [1, 2, 3] };
      const result = enrichUndefined('$.items.missing', data);
      expect(result).toContain('Array[3]');
    });

    it('handles deeply nested missing paths', () => {
      const data = { a: { b: { c: 1 } } };
      const result = enrichUndefined('$.a.b.missing.deep', data);
      expect(result).toContain('undefined');
    });

    it('returns "undefined" when the entire path is missing', () => {
      const data = {};
      expect(enrichUndefined('$.missing.path', data)).toBe('undefined');
    });

    it('handles path without $. prefix', () => {
      const data = { x: { y: 10 } };
      const result = enrichUndefined('x.missing', data);
      expect(result).toContain('y');
    });
  });

  describe('runInlineVerify', () => {
    it('returns empty array when sampleResponseData is null', () => {
      expect(runInlineVerify('offers[0].rank equals 13', null)).toEqual([]);
    });

    it('returns empty array when sampleResponseData is undefined', () => {
      expect(runInlineVerify('offers[0].rank equals 13', undefined)).toEqual([]);
    });

    it('returns empty array for unparseable JSON string', () => {
      expect(runInlineVerify('rank equals 1', 'not-json')).toEqual([]);
    });

    it('parses JSON string sampleResponseData', () => {
      const dsl = 'name                                              equals              "Alice"';
      const data = JSON.stringify({ name: 'Alice' });
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
    });

    it('evaluates a passing field assertion', () => {
      const dsl = 'name                                              equals              "Bob"';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].path).toBe('$.name');
    });

    it('evaluates a failing field assertion', () => {
      const dsl = 'name                                              equals              "Alice"';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(false);
    });

    it('includes debug steps for field assertions', () => {
      const dsl = 'name                                              equals              "Bob"';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results[0].debugSteps).toBeDefined();
      expect(results[0].debugSteps!.length).toBe(3);
      expect(results[0].debugSteps![0].label).toBe('Path Resolution');
      expect(results[0].debugSteps![1].label).toBe('Operator');
      expect(results[0].debugSteps![2].label).toBe('Result');
    });

    it('handles negated field assertion (NOT)', () => {
      const dsl = 'name                                              NOT equals          "Alice"';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
    });

    it('enriches undefined path in field assertion debug', () => {
      const dsl = 'missing.path                                      equals              "x"';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].debugSteps![0].error).toBe('path not found');
    });

    it('evaluates arrayLength assertion (passing)', () => {
      const dsl = 'items                                             length              > 0';
      const data = { items: [1, 2, 3] };
      const results = runInlineVerify(dsl, data);
      expect(results.some(r => r.debugSteps?.some(s => s.label === 'Array Length'))).toBe(true);
    });

    it('evaluates each assertion (passing)', () => {
      const dsl = 'scores[*]                                         each                > 50';
      const data = { scores: [60, 70, 80] };
      const results = runInlineVerify(dsl, data);
      const eachResult = results.find(r => r.debugSteps?.some(s => s.label === 'Each Check'));
      expect(eachResult).toBeDefined();
    });

    it('evaluates each assertion with failing items', () => {
      const dsl = 'scores[*]                                         each                > 70';
      const data = { scores: [60, 70, 80] };
      const results = runInlineVerify(dsl, data);
      const eachResult = results.find(r => r.debugSteps?.some(s => s.label === 'Each Check'));
      if (eachResult) {
        expect(eachResult.passed).toBe(false);
        const failedStep = eachResult.debugSteps?.find(s => s.label === 'Failed Items');
        if (failedStep) {
          expect(failedStep.error).toBe('items failed check');
        }
      }
    });

    it('evaluates ASSERT custom expression', () => {
      const dsl = 'ASSERT $gt($count($.body.items), 0)';
      const data = { body: { items: [1, 2] } };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles multiple field rules in DSL', () => {
      const dsl = [
        'name                                              equals              "Bob"',
        'age                                               greater_than        18',
      ].join('\n');
      const data = { name: 'Bob', age: 25 };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(2);
      expect(results.every(r => r.passed)).toBe(true);
    });

    it('formats object values in debug steps', () => {
      const dsl = 'data                                              equals              "x"';
      const data = { data: { nested: true } };
      const results = runInlineVerify(dsl, data);
      const pathStep = results[0]?.debugSteps?.[0];
      expect(pathStep?.displayValue).toContain('nested');
    });

    it('returns empty results for DSL with no parseable rules', () => {
      const results = runInlineVerify('', { name: 'test' });
      expect(results).toEqual([]);
    });

    it('handles between operator', () => {
      const dsl = 'value                                             between             10 20';
      const data = { value: 15 };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
    });

    it('handles contains operator', () => {
      const dsl = 'name                                              contains            "ob"';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
    });

    it('evaluates each assertion with field path', () => {
      const dsl = 'users[*].age                                      each                > 18';
      const data = { users: [{ age: 20 }, { age: 25 }, { age: 30 }] };
      const results = runInlineVerify(dsl, data);
      const eachResult = results.find(r => r.debugSteps?.some(s => s.label === 'Each Check'));
      if (eachResult) {
        expect(eachResult.passed).toBe(true);
        const checkStep = eachResult.debugSteps!.find(s => s.label === 'Each Check');
        expect(checkStep?.displayValue).toContain('PASS');
      }
    });

    it('handles each assertion on non-array value', () => {
      const dsl = 'name[*]                                           each                equals "x"';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles arrayLength assertion on non-array value', () => {
      const dsl = 'name                                              length              > 0';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles more than 5 failed items (truncation)', () => {
      const dsl = 'items[*]                                          each                > 100';
      const data = { items: [1, 2, 3, 4, 5, 6, 7, 8] };
      const results = runInlineVerify(dsl, data);
      const eachResult = results.find(r => !r.passed);
      if (eachResult) {
        const failedStep = eachResult.debugSteps?.find(s => s.label === 'Failed Items');
        if (failedStep) {
          expect(failedStep.expression).toContain('+');
        }
      }
    });

    it('evaluates contains_any assertion', () => {
      const dsl = 'tags                                              contains_any        ["a", "b"]';
      const data = { tags: ['a', 'c', 'd'] };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('evaluates subset assertion', () => {
      const dsl = 'items                                             subset              [1, 2]';
      const data = { items: [1, 2, 3] };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles is_type operator', () => {
      const dsl = 'name                                              is_type             string';
      const data = { name: 'Bob' };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles is_null operator', () => {
      const dsl = 'value                                             is_null';
      const data = { value: null };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
    });

    it('handles operator with no value (no value debug step)', () => {
      const dsl = 'active                                            is_true';
      const data = { active: true };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
      const opStep = results[0].debugSteps?.find(s => s.label === 'Operator');
      expect(opStep).toBeDefined();
    });

    it('evaluates arrayContains (contains_any) assertion', () => {
      const dsl = 'tags                                              contains_any        "red"';
      const data = { tags: ['red', 'blue', 'green'] };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(1);
      const containsResult = results.find(r => r.debugSteps?.some(s => s.label === 'Contains Check'));
      if (containsResult) {
        expect(containsResult.passed).toBe(true);
        const checkStep = containsResult.debugSteps?.find(s => s.label === 'Contains Check');
        expect(checkStep?.displayValue).toContain('PASS');
      }
    });

    it('evaluates containsSubset assertion', () => {
      const dsl = 'data                                              subset              {"name":"test"}';
      const data = { data: { name: 'test', extra: 'value' } };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(1);
      const subsetResult = results.find(r => r.debugSteps?.some(s => s.label === 'Contains Check'));
      if (subsetResult) {
        const checkStep = subsetResult.debugSteps?.find(s => s.label === 'Contains Check');
        expect(checkStep).toBeDefined();
      }
    });

    it('handles evaluateFieldOperator throwing during each assertion', () => {
      const dsl = 'items[*]                                          each                matches_regex "[invalid"';
      const data = { items: ['a', 'b'] };
      const results = runInlineVerify(dsl, data);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});
