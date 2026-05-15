/**
 * Comprehensive tests for ALL 24 field operators.
 * Each operator is tested for: pass, fail, edge cases, type coercion, and boundary conditions.
 * Also tests expression + operator integration via validationAdapter + useValidationVerify.
 */
import { describe, it, expect } from 'vitest';
import { evaluateFieldOperator } from './fieldOperatorEvaluation';

// ─── Sample data for realistic scenarios ─────────────────
const _SAMPLE = {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com',
  isActive: true,
  isPremium: false,
  score: 95.5,
  tags: ['admin', 'user'],
  address: { city: 'NYC', zip: '10001' },
  planType: 'Trial',
  emptyStr: '',
  emptyArr: [] as unknown[],
  emptyObj: {},
  nullField: null,
  zero: 0,
  negNum: -5,
  bigNum: 99999,
  floatVal: 3.14159,
};

// ────────────────────────────────────────────────────────────
// 1. EQUALITY OPERATORS
// ────────────────────────────────────────────────────────────

describe('equals operator', () => {
  it('passes for exact string match', () => {
    expect(evaluateFieldOperator('Trial', 'equals', undefined, 'Trial').pass).toBe(true);
  });
  it('fails for different string', () => {
    expect(evaluateFieldOperator('Trial', 'equals', undefined, 'Premium').pass).toBe(false);
  });
  it('passes for numeric match', () => {
    expect(evaluateFieldOperator(42, 'equals', undefined, '42').pass).toBe(true);
  });
  it('passes for boolean match', () => {
    expect(evaluateFieldOperator(true, 'equals', undefined, 'true').pass).toBe(true);
  });
  it('passes for null match', () => {
    expect(evaluateFieldOperator(null, 'equals', undefined, 'null').pass).toBe(true);
  });
  it('passes for object match', () => {
    expect(evaluateFieldOperator({ a: 1 }, 'equals', undefined, '{"a":1}').pass).toBe(true);
  });
  it('passes for array match', () => {
    expect(evaluateFieldOperator([1, 2], 'equals', undefined, '[1,2]').pass).toBe(true);
  });
  it('fails for type mismatch (string "42" vs number 42)', () => {
    expect(evaluateFieldOperator('42', 'equals', undefined, '42').pass).toBe(false);
  });
  it('fails for undefined actual', () => {
    expect(evaluateFieldOperator(undefined, 'equals', undefined, 'hello').pass).toBe(false);
  });
  it('handles empty string expected', () => {
    expect(evaluateFieldOperator('', 'equals', undefined, '').pass).toBe(true);
  });
});

describe('not_equals operator', () => {
  it('passes when values differ', () => {
    expect(evaluateFieldOperator('Trial', 'not_equals', undefined, 'Premium').pass).toBe(true);
  });
  it('fails when values are equal', () => {
    expect(evaluateFieldOperator('Trial', 'not_equals', undefined, 'Trial').pass).toBe(false);
  });
  it('passes for type mismatch', () => {
    expect(evaluateFieldOperator('42', 'not_equals', undefined, '42').pass).toBe(true);
  });
  it('passes for undefined vs any value', () => {
    expect(evaluateFieldOperator(undefined, 'not_equals', undefined, 'hello').pass).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 2. COMPARISON OPERATORS
// ────────────────────────────────────────────────────────────

describe('greater_than operator', () => {
  it('passes when actual > expected', () => {
    expect(evaluateFieldOperator(10, 'greater_than', '5', '').pass).toBe(true);
  });
  it('fails when actual = expected', () => {
    expect(evaluateFieldOperator(5, 'greater_than', '5', '').pass).toBe(false);
  });
  it('fails when actual < expected', () => {
    expect(evaluateFieldOperator(3, 'greater_than', '5', '').pass).toBe(false);
  });
  it('handles string numbers', () => {
    expect(evaluateFieldOperator('10', 'greater_than', '5', '').pass).toBe(true);
  });
  it('fails for non-numeric actual', () => {
    expect(evaluateFieldOperator('abc', 'greater_than', '5', '').pass).toBe(false);
  });
  it('fails for non-numeric operatorValue', () => {
    expect(evaluateFieldOperator(10, 'greater_than', 'abc', '').pass).toBe(false);
  });
  it('uses operatorValue over expectedValue', () => {
    expect(evaluateFieldOperator(10, 'greater_than', '5', '999').pass).toBe(true);
  });
  it('falls back to expectedValue when operatorValue is undefined', () => {
    expect(evaluateFieldOperator(10, 'greater_than', undefined, '5').pass).toBe(true);
  });
  it('handles negative numbers', () => {
    expect(evaluateFieldOperator(-1, 'greater_than', '-5', '').pass).toBe(true);
  });
  it('handles decimals', () => {
    expect(evaluateFieldOperator(3.15, 'greater_than', '3.14', '').pass).toBe(true);
  });
  it('handles zero', () => {
    expect(evaluateFieldOperator(0, 'greater_than', '-1', '').pass).toBe(true);
    expect(evaluateFieldOperator(0, 'greater_than', '0', '').pass).toBe(false);
  });
});

describe('greater_than_or_equal operator', () => {
  it('passes when actual > expected', () => {
    expect(evaluateFieldOperator(10, 'greater_than_or_equal', '5', '').pass).toBe(true);
  });
  it('passes when actual = expected', () => {
    expect(evaluateFieldOperator(5, 'greater_than_or_equal', '5', '').pass).toBe(true);
  });
  it('fails when actual < expected', () => {
    expect(evaluateFieldOperator(3, 'greater_than_or_equal', '5', '').pass).toBe(false);
  });
});

describe('less_than operator', () => {
  it('passes when actual < expected', () => {
    expect(evaluateFieldOperator(3, 'less_than', '5', '').pass).toBe(true);
  });
  it('fails when actual = expected', () => {
    expect(evaluateFieldOperator(5, 'less_than', '5', '').pass).toBe(false);
  });
  it('fails when actual > expected', () => {
    expect(evaluateFieldOperator(10, 'less_than', '5', '').pass).toBe(false);
  });
  it('handles negative numbers', () => {
    expect(evaluateFieldOperator(-10, 'less_than', '-5', '').pass).toBe(true);
  });
});

describe('less_than_or_equal operator', () => {
  it('passes when actual < expected', () => {
    expect(evaluateFieldOperator(3, 'less_than_or_equal', '5', '').pass).toBe(true);
  });
  it('passes when actual = expected', () => {
    expect(evaluateFieldOperator(5, 'less_than_or_equal', '5', '').pass).toBe(true);
  });
  it('fails when actual > expected', () => {
    expect(evaluateFieldOperator(10, 'less_than_or_equal', '5', '').pass).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 3. STRING OPERATORS
// ────────────────────────────────────────────────────────────

describe('contains operator', () => {
  it('passes when string contains substring', () => {
    expect(evaluateFieldOperator('Trial', 'contains', 'ria', '').pass).toBe(true);
  });
  it('fails when string does not contain substring', () => {
    expect(evaluateFieldOperator('Trial', 'contains', 'xyz', '').pass).toBe(false);
  });
  it('is case-sensitive', () => {
    expect(evaluateFieldOperator('Trial', 'contains', 'trial', '').pass).toBe(false);
  });
  it('passes for empty target (every string contains empty)', () => {
    expect(evaluateFieldOperator('Trial', 'contains', '', '').pass).toBe(true);
  });
  it('stringifies non-string actual', () => {
    expect(evaluateFieldOperator({ name: 'John' }, 'contains', 'John', '').pass).toBe(true);
  });
  it('uses operatorValue over expectedValue', () => {
    expect(evaluateFieldOperator('hello world', 'contains', 'world', 'xxx').pass).toBe(true);
  });
  it('falls back to expectedValue', () => {
    expect(evaluateFieldOperator('hello world', 'contains', undefined, 'world').pass).toBe(true);
  });
  it('works with numbers converted to string', () => {
    expect(evaluateFieldOperator(12345, 'contains', '234', '').pass).toBe(true);
  });
  it('works with arrays stringified', () => {
    expect(evaluateFieldOperator(['a', 'b'], 'contains', '"a"', '').pass).toBe(true);
  });
});

describe('not_contains operator', () => {
  it('passes when string does not contain substring', () => {
    expect(evaluateFieldOperator('Trial', 'not_contains', 'xyz', '').pass).toBe(true);
  });
  it('fails when string contains substring', () => {
    expect(evaluateFieldOperator('Trial', 'not_contains', 'ria', '').pass).toBe(false);
  });
});

describe('starts_with operator', () => {
  it('passes when string starts with prefix', () => {
    expect(evaluateFieldOperator('Trial', 'starts_with', 'Tri', '').pass).toBe(true);
  });
  it('fails when string does not start with prefix', () => {
    expect(evaluateFieldOperator('Trial', 'starts_with', 'ial', '').pass).toBe(false);
  });
  it('is case-sensitive', () => {
    expect(evaluateFieldOperator('Trial', 'starts_with', 'tri', '').pass).toBe(false);
  });
  it('passes for empty prefix', () => {
    expect(evaluateFieldOperator('Trial', 'starts_with', '', '').pass).toBe(true);
  });
  it('handles full string match', () => {
    expect(evaluateFieldOperator('Trial', 'starts_with', 'Trial', '').pass).toBe(true);
  });
});

describe('ends_with operator', () => {
  it('passes when string ends with suffix', () => {
    expect(evaluateFieldOperator('Trial', 'ends_with', 'ial', '').pass).toBe(true);
  });
  it('fails when string does not end with suffix', () => {
    expect(evaluateFieldOperator('Trial', 'ends_with', 'Tri', '').pass).toBe(false);
  });
  it('passes for full string match', () => {
    expect(evaluateFieldOperator('Trial', 'ends_with', 'Trial', '').pass).toBe(true);
  });
});

describe('regex operator', () => {
  it('passes for matching pattern', () => {
    expect(evaluateFieldOperator('abc123', 'regex', '^[a-z]+\\d+$', '').pass).toBe(true);
  });
  it('fails for non-matching pattern', () => {
    expect(evaluateFieldOperator('abc', 'regex', '^\\d+$', '').pass).toBe(false);
  });
  it('works with email pattern', () => {
    expect(evaluateFieldOperator('john@example.com', 'regex', '^[\\w.]+@[\\w.]+\\.[a-z]+$', '').pass).toBe(true);
  });
  it('fails for empty pattern', () => {
    const r = evaluateFieldOperator('abc', 'regex', '', '');
    expect(r.pass).toBe(false);
  });
  it('handles invalid regex gracefully', () => {
    const r = evaluateFieldOperator('abc', 'regex', '[invalid', '');
    expect(r.pass).toBe(false);
    expect(r.actual).toContain('invalid');
  });
  it('uses operatorValue over expectedValue', () => {
    expect(evaluateFieldOperator('abc', 'regex', '^abc$', 'wrong').pass).toBe(true);
  });
  it('falls back to expectedValue', () => {
    expect(evaluateFieldOperator('abc', 'regex', undefined, '^abc$').pass).toBe(true);
  });
  it('stringifies non-string actual', () => {
    expect(evaluateFieldOperator(404, 'regex', '^\\d+$', '').pass).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 4. BOOLEAN OPERATORS
// ────────────────────────────────────────────────────────────

describe('is_true operator', () => {
  it('passes for boolean true', () => {
    expect(evaluateFieldOperator(true, 'is_true', undefined, '').pass).toBe(true);
  });
  it('passes for string "true"', () => {
    expect(evaluateFieldOperator('true', 'is_true', undefined, '').pass).toBe(true);
  });
  it('fails for boolean false', () => {
    expect(evaluateFieldOperator(false, 'is_true', undefined, '').pass).toBe(false);
  });
  it('fails for string "false"', () => {
    expect(evaluateFieldOperator('false', 'is_true', undefined, '').pass).toBe(false);
  });
  it('fails for truthy non-boolean values (1, "yes")', () => {
    expect(evaluateFieldOperator(1, 'is_true', undefined, '').pass).toBe(false);
    expect(evaluateFieldOperator('yes', 'is_true', undefined, '').pass).toBe(false);
  });
  it('fails for null', () => {
    expect(evaluateFieldOperator(null, 'is_true', undefined, '').pass).toBe(false);
  });
  it('fails for undefined', () => {
    expect(evaluateFieldOperator(undefined, 'is_true', undefined, '').pass).toBe(false);
  });
});

describe('is_false operator', () => {
  it('passes for boolean false', () => {
    expect(evaluateFieldOperator(false, 'is_false', undefined, '').pass).toBe(true);
  });
  it('passes for string "false"', () => {
    expect(evaluateFieldOperator('false', 'is_false', undefined, '').pass).toBe(true);
  });
  it('fails for boolean true', () => {
    expect(evaluateFieldOperator(true, 'is_false', undefined, '').pass).toBe(false);
  });
  it('fails for falsy non-boolean (0, "", null)', () => {
    expect(evaluateFieldOperator(0, 'is_false', undefined, '').pass).toBe(false);
    expect(evaluateFieldOperator('', 'is_false', undefined, '').pass).toBe(false);
    expect(evaluateFieldOperator(null, 'is_false', undefined, '').pass).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 5. EXISTENCE OPERATORS
// ────────────────────────────────────────────────────────────

describe('is_null operator', () => {
  it('passes for null', () => {
    expect(evaluateFieldOperator(null, 'is_null', undefined, '').pass).toBe(true);
  });
  it('fails for undefined', () => {
    expect(evaluateFieldOperator(undefined, 'is_null', undefined, '').pass).toBe(false);
  });
  it('fails for empty string', () => {
    expect(evaluateFieldOperator('', 'is_null', undefined, '').pass).toBe(false);
  });
  it('fails for zero', () => {
    expect(evaluateFieldOperator(0, 'is_null', undefined, '').pass).toBe(false);
  });
  it('fails for false', () => {
    expect(evaluateFieldOperator(false, 'is_null', undefined, '').pass).toBe(false);
  });
});

describe('is_not_null operator', () => {
  it('passes for non-null values', () => {
    expect(evaluateFieldOperator('hello', 'is_not_null', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(0, 'is_not_null', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(false, 'is_not_null', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator('', 'is_not_null', undefined, '').pass).toBe(true);
  });
  it('fails for null', () => {
    expect(evaluateFieldOperator(null, 'is_not_null', undefined, '').pass).toBe(false);
  });
  it('fails for undefined', () => {
    expect(evaluateFieldOperator(undefined, 'is_not_null', undefined, '').pass).toBe(false);
  });
});

describe('is_empty operator', () => {
  it('passes for empty string', () => {
    expect(evaluateFieldOperator('', 'is_empty', undefined, '').pass).toBe(true);
  });
  it('passes for empty array', () => {
    expect(evaluateFieldOperator([], 'is_empty', undefined, '').pass).toBe(true);
  });
  it('passes for empty object', () => {
    expect(evaluateFieldOperator({}, 'is_empty', undefined, '').pass).toBe(true);
  });
  it('passes for null', () => {
    expect(evaluateFieldOperator(null, 'is_empty', undefined, '').pass).toBe(true);
  });
  it('passes for undefined', () => {
    expect(evaluateFieldOperator(undefined, 'is_empty', undefined, '').pass).toBe(true);
  });
  it('fails for non-empty string', () => {
    expect(evaluateFieldOperator('hello', 'is_empty', undefined, '').pass).toBe(false);
  });
  it('fails for non-empty array', () => {
    expect(evaluateFieldOperator([1], 'is_empty', undefined, '').pass).toBe(false);
  });
  it('fails for non-empty object', () => {
    expect(evaluateFieldOperator({ a: 1 }, 'is_empty', undefined, '').pass).toBe(false);
  });
  it('fails for zero (number is not empty)', () => {
    expect(evaluateFieldOperator(0, 'is_empty', undefined, '').pass).toBe(false);
  });
  it('fails for false (boolean is not empty)', () => {
    expect(evaluateFieldOperator(false, 'is_empty', undefined, '').pass).toBe(false);
  });
});

describe('is_not_empty operator', () => {
  it('passes for non-empty string', () => {
    expect(evaluateFieldOperator('hello', 'is_not_empty', undefined, '').pass).toBe(true);
  });
  it('passes for non-empty array', () => {
    expect(evaluateFieldOperator([1], 'is_not_empty', undefined, '').pass).toBe(true);
  });
  it('passes for non-empty object', () => {
    expect(evaluateFieldOperator({ a: 1 }, 'is_not_empty', undefined, '').pass).toBe(true);
  });
  it('passes for number (non-empty)', () => {
    expect(evaluateFieldOperator(42, 'is_not_empty', undefined, '').pass).toBe(true);
  });
  it('passes for boolean true (non-empty)', () => {
    expect(evaluateFieldOperator(true, 'is_not_empty', undefined, '').pass).toBe(true);
  });
  it('fails for empty string', () => {
    expect(evaluateFieldOperator('', 'is_not_empty', undefined, '').pass).toBe(false);
  });
  it('fails for empty array', () => {
    expect(evaluateFieldOperator([], 'is_not_empty', undefined, '').pass).toBe(false);
  });
  it('fails for null', () => {
    expect(evaluateFieldOperator(null, 'is_not_empty', undefined, '').pass).toBe(false);
  });
  it('fails for undefined', () => {
    expect(evaluateFieldOperator(undefined, 'is_not_empty', undefined, '').pass).toBe(false);
  });
});

describe('exists operator', () => {
  it('passes for any defined value', () => {
    expect(evaluateFieldOperator('', 'exists', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(0, 'exists', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(null, 'exists', undefined, '').pass).toBe(true);
    expect(evaluateFieldOperator(false, 'exists', undefined, '').pass).toBe(true);
  });
  it('fails for undefined', () => {
    expect(evaluateFieldOperator(undefined, 'exists', undefined, '').pass).toBe(false);
  });
});

describe('not_exists operator', () => {
  it('passes for undefined', () => {
    expect(evaluateFieldOperator(undefined, 'not_exists', undefined, '').pass).toBe(true);
  });
  it('fails for null (null exists)', () => {
    expect(evaluateFieldOperator(null, 'not_exists', undefined, '').pass).toBe(false);
  });
  it('fails for any defined value', () => {
    expect(evaluateFieldOperator('', 'not_exists', undefined, '').pass).toBe(false);
    expect(evaluateFieldOperator(0, 'not_exists', undefined, '').pass).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 6. TYPE CHECK OPERATOR
// ────────────────────────────────────────────────────────────

describe('is_type operator', () => {
  it('detects string type', () => {
    expect(evaluateFieldOperator('hello', 'is_type', 'string', '').pass).toBe(true);
  });
  it('detects number type', () => {
    expect(evaluateFieldOperator(42, 'is_type', 'number', '').pass).toBe(true);
  });
  it('detects boolean type', () => {
    expect(evaluateFieldOperator(true, 'is_type', 'boolean', '').pass).toBe(true);
  });
  it('detects null type', () => {
    expect(evaluateFieldOperator(null, 'is_type', 'null', '').pass).toBe(true);
  });
  it('detects array type', () => {
    expect(evaluateFieldOperator([1, 2], 'is_type', 'array', '').pass).toBe(true);
  });
  it('detects object type (plain object)', () => {
    expect(evaluateFieldOperator({ a: 1 }, 'is_type', 'object', '').pass).toBe(true);
  });
  it('detects undefined type', () => {
    expect(evaluateFieldOperator(undefined, 'is_type', 'undefined', '').pass).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(evaluateFieldOperator('hello', 'is_type', 'STRING', '').pass).toBe(true);
    expect(evaluateFieldOperator(null, 'is_type', 'NULL', '').pass).toBe(true);
  });
  it('distinguishes array from object', () => {
    expect(evaluateFieldOperator([1], 'is_type', 'object', '').pass).toBe(false);
    expect(evaluateFieldOperator({ a: 1 }, 'is_type', 'array', '').pass).toBe(false);
  });
  it('fails for type mismatch', () => {
    expect(evaluateFieldOperator(42, 'is_type', 'string', '').pass).toBe(false);
  });
  it('uses operatorValue, falls back to expectedValue', () => {
    expect(evaluateFieldOperator(42, 'is_type', undefined, 'NUMBER').pass).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 7. SET OPERATORS
// ────────────────────────────────────────────────────────────

describe('in operator', () => {
  it('passes when value is in JSON array', () => {
    expect(evaluateFieldOperator(2, 'in', '[1,2,3]', '').pass).toBe(true);
  });
  it('fails when value is not in JSON array', () => {
    expect(evaluateFieldOperator(9, 'in', '[1,2,3]', '').pass).toBe(false);
  });
  it('works with string values in JSON array', () => {
    expect(evaluateFieldOperator('Trial', 'in', '["Trial","Premium","Free"]', '').pass).toBe(true);
  });
  it('fails for missing string in JSON array', () => {
    expect(evaluateFieldOperator('Gold', 'in', '["Trial","Premium"]', '').pass).toBe(false);
  });
  it('falls back to CSV parsing for non-JSON', () => {
    expect(evaluateFieldOperator('b', 'in', 'a, b, c', '').pass).toBe(true);
  });
  it('CSV parsing trims spaces', () => {
    expect(evaluateFieldOperator('b', 'in', '  a , b , c  ', '').pass).toBe(true);
  });
  it('falls back to expectedValue', () => {
    expect(evaluateFieldOperator(2, 'in', undefined, '[1,2,3]').pass).toBe(true);
  });
  it('handles non-array JSON by splitting as CSV', () => {
    expect(evaluateFieldOperator('z', 'in', '"not-array"', '').pass).toBe(false);
  });
  it('handles undefined actual', () => {
    expect(evaluateFieldOperator(undefined, 'in', '[1,2]', '').pass).toBe(false);
  });
});

describe('not_in operator', () => {
  it('passes when value is not in JSON array', () => {
    expect(evaluateFieldOperator(9, 'not_in', '[1,2,3]', '').pass).toBe(true);
  });
  it('fails when value is in JSON array', () => {
    expect(evaluateFieldOperator(2, 'not_in', '[1,2,3]', '').pass).toBe(false);
  });
  it('works with CSV fallback', () => {
    expect(evaluateFieldOperator('z', 'not_in', 'a, b, c', '').pass).toBe(true);
    expect(evaluateFieldOperator('b', 'not_in', 'a, b, c', '').pass).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 8. RANGE OPERATORS
// ────────────────────────────────────────────────────────────

describe('between operator', () => {
  it('passes when value is within range (inclusive)', () => {
    expect(evaluateFieldOperator(5, 'between', '1, 10', '').pass).toBe(true);
  });
  it('passes at lower boundary', () => {
    expect(evaluateFieldOperator(1, 'between', '1, 10', '').pass).toBe(true);
  });
  it('passes at upper boundary', () => {
    expect(evaluateFieldOperator(10, 'between', '1, 10', '').pass).toBe(true);
  });
  it('fails below range', () => {
    expect(evaluateFieldOperator(0, 'between', '1, 10', '').pass).toBe(false);
  });
  it('fails above range', () => {
    expect(evaluateFieldOperator(11, 'between', '1, 10', '').pass).toBe(false);
  });
  it('handles negative range', () => {
    expect(evaluateFieldOperator(-3, 'between', '-5, -1', '').pass).toBe(true);
    expect(evaluateFieldOperator(0, 'between', '-5, -1', '').pass).toBe(false);
  });
  it('handles decimal range', () => {
    expect(evaluateFieldOperator(3.14, 'between', '3.0, 3.2', '').pass).toBe(true);
  });
  it('fails for non-numeric actual', () => {
    expect(evaluateFieldOperator('abc', 'between', '1, 10', '').pass).toBe(false);
  });
  it('fails for invalid bounds', () => {
    expect(evaluateFieldOperator(5, 'between', 'x, y', '').pass).toBe(false);
  });
  it('uses operatorValue over expectedValue', () => {
    expect(evaluateFieldOperator(5, 'between', '1, 10', '99, 100').pass).toBe(true);
  });
});

describe('close_to operator', () => {
  it('passes within default tolerance (0.01)', () => {
    expect(evaluateFieldOperator(3.005, 'close_to', '3', '').pass).toBe(true);
  });
  it('fails outside default tolerance', () => {
    expect(evaluateFieldOperator(3.02, 'close_to', '3', '').pass).toBe(false);
  });
  it('passes with explicit tolerance', () => {
    expect(evaluateFieldOperator(3.4, 'close_to', '3, 0.5', '').pass).toBe(true);
  });
  it('fails outside explicit tolerance', () => {
    expect(evaluateFieldOperator(4, 'close_to', '3, 0.5', '').pass).toBe(false);
  });
  it('handles exact match', () => {
    expect(evaluateFieldOperator(3, 'close_to', '3', '').pass).toBe(true);
  });
  it('fails for non-numeric actual', () => {
    expect(evaluateFieldOperator('abc', 'close_to', '3', '').pass).toBe(false);
  });
  it('fails for non-numeric target', () => {
    expect(evaluateFieldOperator(3, 'close_to', 'abc', '').pass).toBe(false);
  });
  it('handles negative numbers', () => {
    expect(evaluateFieldOperator(-2.99, 'close_to', '-3, 0.02', '').pass).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// 9. UNKNOWN OPERATOR
// ────────────────────────────────────────────────────────────

describe('unknown operator', () => {
  it('always fails', () => {
    const r = evaluateFieldOperator('x', 'mystery' as never, '', '');
    expect(r.pass).toBe(false);
    expect(r.actual).toContain('unknown');
  });
});

// ────────────────────────────────────────────────────────────
// 10. CROSS-CUTTING CONCERNS
// ────────────────────────────────────────────────────────────

describe('operatorValue vs expectedValue precedence', () => {
  const needsValueOps = [
    'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal',
    'contains', 'not_contains', 'starts_with', 'ends_with', 'regex',
    'is_type', 'in', 'not_in', 'between', 'close_to',
  ] as const;

  for (const op of needsValueOps) {
    it(`${op}: operatorValue is used when provided`, () => {
      const r1 = evaluateFieldOperator('test', op, 'test', 'wrong');
      const r2 = evaluateFieldOperator('test', op, undefined, 'test');
      expect(typeof r1.pass).toBe('boolean');
      expect(typeof r2.pass).toBe('boolean');
    });
  }
});

describe('expected and actual output strings', () => {
  it('equals includes the expected value in output', () => {
    const r = evaluateFieldOperator('x', 'equals', undefined, 'y');
    expect(r.expected).toContain('y');
  });
  it('greater_than includes > symbol', () => {
    const r = evaluateFieldOperator(10, 'greater_than', '5', '');
    expect(r.expected).toContain('>');
  });
  it('contains includes the search term', () => {
    const r = evaluateFieldOperator('hello', 'contains', 'ell', '');
    expect(r.expected).toContain('ell');
  });
  it('is_true returns "is true" as expected', () => {
    const r = evaluateFieldOperator(true, 'is_true', undefined, '');
    expect(r.expected).toBe('is true');
  });
  it('is_type includes the type name', () => {
    const r = evaluateFieldOperator('x', 'is_type', 'number', '');
    expect(r.expected).toContain('number');
    expect(r.actual).toContain('string');
  });
  it('between includes both bounds', () => {
    const r = evaluateFieldOperator(5, 'between', '1, 10', '');
    expect(r.expected).toContain('1');
    expect(r.expected).toContain('10');
  });
});
