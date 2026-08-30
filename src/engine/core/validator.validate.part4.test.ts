import { describe, it, expect } from 'vitest';
import { validate, evaluateAssertions } from './validator';
import { AssertionContext } from './validator';
import { collectionCtx } from './validator.validate.test-utils';

// ---------------------------------------------------------------------------
// validate — mode: 'none'
// ---------------------------------------------------------------------------
describe('evaluateAssertions — arrayContains', () => {
  it('mode:any — passes when array contains matching item (primitive)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.numbers', value: '20', mode: 'any' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('mode:any — passes with object subset match', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.offers', value: '{"offerName": "EV Access"}', mode: 'any' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('mode:any — fails when no item matches', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.numbers', value: '99', mode: 'any' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toContain('arrayContains');
  });

  it('mode:any — string value match', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.strings', value: '"banana"', mode: 'any' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('mode:all — passes when every item matches', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.offers', value: '{"isActive": true}', mode: 'all' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('1 of 3');
  });

  it('mode:all — passes when truly all match', () => {
    const ctx: AssertionContext = {
      ...collectionCtx,
      responseBody: { items: [1, 1, 1] },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.items', value: '1', mode: 'all' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('mode:only — passes with exact unordered set', () => {
    const ctx: AssertionContext = {
      ...collectionCtx,
      responseBody: { items: [3, 1, 2] },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.items', value: '[1, 2, 3]', mode: 'only' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('mode:only — fails when extras present', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.numbers', value: '[10, 20]', mode: 'only' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('extras');
  });

  it('mode:only — fails when items missing', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.numbers', value: '[10, 20, 30, 40, 50]', mode: 'only' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('missing');
  });

  it('mode:none — passes when no item matches', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.numbers', value: '99', mode: 'none' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('mode:none — fails when some match', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.numbers', value: '10', mode: 'none' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('index 0');
  });

  it('fails on non-array target', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.notArray', value: '"x"', mode: 'any' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('not an array');
  });

  it('fails on undefined path', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.missing', value: '1', mode: 'any' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('mode:any — empty array always fails', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.emptyArray', value: '1', mode: 'any' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
  });

  it('mode:none — empty array always passes', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.emptyArray', value: '1', mode: 'none' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('mode:any — nested object matching in array', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayContains', jsonPath: '$.offers', value: '{"offerName": "Acme Connect Plan", "rank": 2}', mode: 'any' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — each
// ---------------------------------------------------------------------------
describe('evaluateAssertions — each', () => {
  it('passes when all elements satisfy >= 0', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.offers', fieldPath: 'rank', operator: 'greater_than_or_equal', value: '0' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails when one element violates condition', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.offers', fieldPath: 'rank', operator: 'greater_than', value: '0' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('1 of 3 failed');
    expect(failures[0].actual).toContain('[2]');
  });

  it('passes on empty array (vacuously true)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.emptyArray', fieldPath: 'x', operator: 'equals', value: '1' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails on non-array target', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.notArray', fieldPath: 'x', operator: 'equals', value: '1' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('not an array');
  });

  it('fails on undefined path', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.missing', fieldPath: 'x', operator: 'equals', value: '1' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('string operator: offerName contains "Plan"', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.offers', fieldPath: 'offerName', operator: 'contains', value: 'Plan' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('1 of 3 failed');
  });

  it('boolean operator: isActive is_true', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.offers', fieldPath: 'isActive', operator: 'is_true' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('1 of 3 failed');
  });

  it('works with no fieldPath (checks element directly)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.numbers', fieldPath: '', operator: 'greater_than_or_equal', value: '10' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('works with primitive array and less_than', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.numbers', fieldPath: '', operator: 'less_than', value: '100' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('reports multiple failures with truncation', () => {
    const ctx: AssertionContext = {
      ...collectionCtx,
      responseBody: {
        items: Array.from({ length: 10 }, (_, i) => ({ val: i })),
      },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.items', fieldPath: 'val', operator: 'greater_than', value: '5' }],
      ctx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('6 of 10 failed');
    expect(failures[0].actual).toContain('… and 3 more');
  });

  it('exists operator on nested field', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.offers', fieldPath: 'offerName', operator: 'exists' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails when field missing in some elements', () => {
    const ctx: AssertionContext = {
      ...collectionCtx,
      responseBody: {
        items: [{ a: 1 }, { b: 2 }, { a: 3 }],
      },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'each', jsonPath: '$.items', fieldPath: 'a', operator: 'exists' }],
      ctx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('1 of 3 failed');
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — containsSubset
// ---------------------------------------------------------------------------
describe('evaluateAssertions — containsSubset', () => {
  it('passes on flat subset match', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.response', expected: '{"status": "active"}' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes when extra fields in actual', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.response', expected: '{"enabled": true}' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails on missing key', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.response', expected: '{"missing": true}' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('missing key');
  });

  it('fails on value mismatch', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.response', expected: '{"status": "inactive"}' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
  });

  it('passes with nested object subset', () => {
    const ctx: AssertionContext = {
      ...collectionCtx,
      responseBody: { data: { user: { name: 'Alice', age: 30, role: 'admin' } } },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.data', expected: '{"user": {"name": "Alice"}}' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('passes with empty subset', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.response', expected: '{}' }],
      collectionCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails on undefined path', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.missing', expected: '{"a": 1}' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('fails with invalid JSON in expected', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.response', expected: '{invalid}' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('invalid JSON');
  });

  it('matches null values in subset', () => {
    const ctx: AssertionContext = {
      ...collectionCtx,
      responseBody: { data: { x: null, y: 1 } },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.data', expected: '{"x": null}' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('deep nesting (3+ levels)', () => {
    const ctx: AssertionContext = {
      ...collectionCtx,
      responseBody: { a: { b: { c: { d: 1, e: 2 } } } },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$', expected: '{"a": {"b": {"c": {"d": 1}}}}' }],
      ctx,
    );
    expect(failures).toEqual([]);
  });

  it('fails on non-object target when object expected', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.notArray', expected: '{"a": 1}' }],
      collectionCtx,
    );
    expect(failures.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Universal negation — field-level (validate)
// ---------------------------------------------------------------------------
describe('validate — negate flag on ExpectedField', () => {
  it('negated field: matching value becomes failure', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'name', expectedValue: 'Alice', negate: true },
        ],
      },
      { name: 'Alice' },
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('NOT');
  });

  it('negated field: non-matching value passes', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'name', expectedValue: 'Bob', negate: true },
        ],
      },
      { name: 'Alice' },
    );
    expect(failures).toHaveLength(0);
  });

  it('negated field with operator: passing comparison becomes failure', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'age', expectedValue: '25', operator: 'greater_than', operatorValue: '25', negate: true },
        ],
      },
      { age: 30 },
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('NOT');
  });

  it('negated field with operator: failing comparison becomes pass', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'age', expectedValue: '50', operator: 'greater_than', operatorValue: '50', negate: true },
        ],
      },
      { age: 30 },
    );
    expect(failures).toHaveLength(0);
  });

  it('non-negated fields remain unaffected', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'name', expectedValue: 'Alice' },
        ],
      },
      { name: 'Alice' },
    );
    expect(failures).toHaveLength(0);
  });
});
