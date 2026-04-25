import { describe, it, expect } from 'vitest';
import { getByPath, validate, evaluateAssertions, matchesStatusPattern } from './validator';
import type { Assertion } from '../types';

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
// validate — mode: 'none'
// ---------------------------------------------------------------------------
describe('validate — none mode', () => {
  it('returns empty array when mode is none', () => {
    expect(validate({ mode: 'none' }, { any: 'data' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validate — mode: 'full'
// ---------------------------------------------------------------------------
describe('validate — full match', () => {
  it('passes when response matches expected JSON exactly', () => {
    const expected = { name: 'Alice', age: 30 };
    const failures = validate(
      { mode: 'full', expectedJson: JSON.stringify(expected) },
      { name: 'Alice', age: 30 }
    );
    expect(failures).toEqual([]);
  });

  it('passes regardless of key order', () => {
    const failures = validate(
      { mode: 'full', expectedJson: '{"b":2,"a":1}' },
      { a: 1, b: 2 }
    );
    expect(failures).toEqual([]);
  });

  it('detects value mismatches', () => {
    const failures = validate(
      { mode: 'full', expectedJson: '{"name":"Alice"}' },
      { name: 'Bob' }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('name');
  });

  it('detects missing keys', () => {
    const failures = validate(
      { mode: 'full', expectedJson: '{"name":"Alice","age":30}' },
      { name: 'Alice' }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('age');
  });

  it('detects extra keys', () => {
    const failures = validate(
      { mode: 'full', expectedJson: '{"name":"Alice"}' },
      { name: 'Alice', extra: true }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('extra');
  });

  it('handles invalid expected JSON gracefully', () => {
    const failures = validate(
      { mode: 'full', expectedJson: 'not valid json' },
      { name: 'Alice' }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('(parse)');
  });

  it('returns empty when expectedJson is missing', () => {
    expect(validate({ mode: 'full' }, { any: 'data' })).toEqual([]);
  });

  it('handles nested object comparison', () => {
    const expected = { data: { items: [1, 2, 3] } };
    const actual = { data: { items: [1, 2, 4] } };
    const failures = validate(
      { mode: 'full', expectedJson: JSON.stringify(expected) },
      actual
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('data.items[2]');
  });

  it('detects array length mismatch', () => {
    const failures = validate(
      { mode: 'full', expectedJson: '{"items":[1,2]}' },
      { items: [1, 2, 3] }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('items[2]');
  });
});

// ---------------------------------------------------------------------------
// validate — mode: 'selective' (ordered)
// ---------------------------------------------------------------------------
describe('validate — selective (ordered)', () => {
  const response = {
    status: 'ok',
    data: { id: 123, name: 'Widget', price: 9.99 },
    meta: { count: 1 },
  };

  it('passes when all fields match', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.status', expectedValue: '"ok"' },
          { jsonPath: '$.data.id', expectedValue: '123' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('detects value mismatch', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.data.name', expectedValue: '"Gadget"' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('$.data.name');
    expect(failures[0].expected).toBe('"Gadget"');
  });

  it('detects missing field', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.data.nonexistent', expectedValue: '"x"' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('undefined');
  });

  it('returns empty when no expectedFields', () => {
    expect(validate({ mode: 'selective', expectedFields: [] }, response)).toEqual([]);
    expect(validate({ mode: 'selective' }, response)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validate — selective with unordered arrays
// ---------------------------------------------------------------------------
describe('validate — selective (unordered arrays)', () => {
  const response = {
    offers: [
      { offerCode: 'X1', offerName: 'Premium', price: 100 },
      { offerCode: 'X2', offerName: 'Basic', price: 50 },
      { offerCode: 'X3', offerName: 'Gold', price: 200 },
    ],
  };

  it('matches items regardless of index order', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].offerCode', expectedValue: '"X2"' },
          { jsonPath: '$.offers[0].offerName', expectedValue: '"Basic"' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('matches multiple rows in any order', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].offerCode', expectedValue: '"X3"' },
          { jsonPath: '$.offers[0].offerName', expectedValue: '"Gold"' },
          { jsonPath: '$.offers[1].offerCode', expectedValue: '"X1"' },
          { jsonPath: '$.offers[1].offerName', expectedValue: '"Premium"' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('reports failure when a row has partial match', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].offerCode', expectedValue: '"X1"' },
          { jsonPath: '$.offers[0].offerName', expectedValue: '"WRONG"' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('$.offers[0].offerName');
  });

  it('reports failure when no matching item exists', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].offerCode', expectedValue: '"MISSING"' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
  });

  it('validates non-array fields normally alongside unordered', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].offerCode', expectedValue: '"X1"' },
          { jsonPath: '$.offers[0].offerName', expectedValue: '"Premium"' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validate — path remapping strategies
// ---------------------------------------------------------------------------
describe('validate — path remapping', () => {
  it('attempts remapping when all fields resolve to undefined', () => {
    const response = { data: { id: 42, name: 'ok', extra: 'val' } };
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.id', expectedValue: '42' },
          { jsonPath: '$.name', expectedValue: '"WRONG"' },
        ],
      },
      response
    );
    expect(failures.length).toBeGreaterThan(0);
    const nameFailure = failures.find(f => f.path === '$.name');
    expect(nameFailure).toBeDefined();
    expect(nameFailure!.actual).not.toContain('undefined');
  });

  it('returns original failures when remapping does not help', () => {
    const response = { unrelated: 'data' };
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.deep.nested.path', expectedValue: '"x"' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('undefined');
  });

  it('correctly resolves direct paths without remapping', () => {
    const response = { data: { id: 42, status: 'active' } };
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.data.id', expectedValue: '42' },
          { jsonPath: '$.data.status', expectedValue: '"active"' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('remaps when response is array — strips common first segment', () => {
    const response = [
      { offerCode: 'X1', price: 100 },
      { offerCode: 'X2', price: 50 },
    ];
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'offers[0].offerCode', expectedValue: '"X1"' },
          { jsonPath: 'offers[0].price', expectedValue: '100' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('remaps with prefix strategy — paths need wrapping', () => {
    const response = { result: [{ id: 1 }, { id: 2 }] };
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '[0].id', expectedValue: '1' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('remaps with direct nested value strategy', () => {
    const response = { wrapper: { id: 42, name: 'ok' } };
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: 'id', expectedValue: '42' },
          { jsonPath: 'name', expectedValue: '"ok"' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('returns original failures when response is primitive', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.x', expectedValue: '1' },
        ],
      },
      42
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('undefined');
  });

  it('remaps array with unorderedArrays flag', () => {
    const response = [
      { code: 'A', name: 'Alpha' },
      { code: 'B', name: 'Beta' },
    ];
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: 'items[0].code', expectedValue: '"B"' },
          { jsonPath: 'items[0].name', expectedValue: '"Beta"' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });
});

describe('validate — unordered partial match details', () => {
  it('reports best partial match index in failure message', () => {
    const response = {
      items: [
        { code: 'A', name: 'Alpha', value: 100 },
        { code: 'B', name: 'Beta', value: 200 },
      ],
    };
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.items[0].code', expectedValue: '"B"' },
          { jsonPath: '$.items[0].name', expectedValue: '"Beta"' },
          { jsonPath: '$.items[0].value', expectedValue: '999' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('matched by');
  });

  it('reports "no matching item" when no partial match exists', () => {
    const response = { items: [{ code: 'A' }, { code: 'B' }] };
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.items[0].code', expectedValue: '"Z"' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
    expect(failures[0].actual).toContain('no matching item');
  });

  it('reports failures when array is empty in unordered mode', () => {
    const response = { items: [] };
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.items[0].code', expectedValue: '"A"' },
        ],
      },
      response
    );
    expect(failures.length).toBe(1);
  });

  it('validates non-array fields alongside unordered array fields', () => {
    const response = { total: 5, items: [{ code: 'A' }] };
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.total', expectedValue: '5' },
          { jsonPath: '$.items[0].code', expectedValue: '"A"' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });

  it('handles expectedValue parse fallback for non-JSON strings', () => {
    const response = { items: [{ code: 'hello world' }] };
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.items[0].code', expectedValue: 'hello world' },
        ],
      },
      response
    );
    expect(failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions – branch coverage for header operators
// ---------------------------------------------------------------------------
describe('evaluateAssertions', () => {
  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseBody: { key: 'value' },
    responseHeaders: { 'content-type': 'application/json', 'x-id': 'abc-123' },
  };

  it('handles unknown header operator (default branch)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'startsWith', value: 'app' } as unknown as Assertion],
      ctx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('unknown operator');
  });

  it('handles invalid regex in header regex operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'regex', value: '[invalid' }],
      ctx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });

  it('handles invalid regex in regex assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.key', pattern: '[bad' }],
      ctx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });

  it('header exists assertion succeeds', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'exists' }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });

  it('header exists assertion fails for missing header', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-missing', operator: 'exists' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });

  it('header contains assertion', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'contains', value: 'json' }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });

  it('header contains fails when not present', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-missing', operator: 'contains', value: 'x' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });

  it('header regex assertion succeeds', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-id', operator: 'regex', value: '^abc-\\d+$' }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });

  it('header regex assertion fails on non-matching header', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-id', operator: 'regex', value: '^xyz' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });

  it('header regex fails when header missing', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-missing', operator: 'regex', value: '.*' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });

  it('sets statusAsserted when status assertion is present', () => {
    const { statusAsserted } = evaluateAssertions(
      [{ type: 'status', expected: '200' }],
      ctx
    );
    expect(statusAsserted).toBe(true);
  });

  it('responseTime assertion fails when too slow', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 10 }],
      { ...ctx, responseTimeMs: 100 }
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(responseTime)');
  });
});

// ---------------------------------------------------------------------------
// validate – deepCompare branch: expected array vs non-array actual
// ---------------------------------------------------------------------------
describe('validate deepCompare edge cases', () => {
  it('reports failure when expected array but actual is non-array (full mode)', () => {
    const failures = validate(
      {
        mode: 'full',
        expectedJson: JSON.stringify({ items: ['a', 'b'] }),
      },
      { items: 'not-array' }
    );
    expect(failures.length).toBeGreaterThan(0);
  });

  it('compares matching arrays element-by-element (full mode)', () => {
    const failures = validate(
      {
        mode: 'full',
        expectedJson: JSON.stringify({ items: ['a', 'b'] }),
      },
      { items: ['a', 'b'] }
    );
    expect(failures).toHaveLength(0);
  });

  it('reports mismatch when arrays differ in length (full mode)', () => {
    const failures = validate(
      {
        mode: 'full',
        expectedJson: JSON.stringify({ items: ['a', 'b', 'c'] }),
      },
      { items: ['a'] }
    );
    expect(failures.length).toBeGreaterThan(0);
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
// deepCompare – additional edge branches
// ---------------------------------------------------------------------------
describe('deepCompare via validate', () => {
  it('reports null actual vs non-null expected', () => {
    const failures = validate(
      { mode: 'full', expectedJson: JSON.stringify({ key: 'value' }) },
      { key: null }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('key');
  });

  it('reports primitive mismatch at nested path', () => {
    const failures = validate(
      { mode: 'full', expectedJson: JSON.stringify({ a: { b: 1 } }) },
      { a: { b: 2 } }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('a.b');
  });

  it('reports extra keys in actual object', () => {
    const failures = validate(
      { mode: 'full', expectedJson: JSON.stringify({ a: 1 }) },
      { a: 1, b: 2 }
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('b');
  });

  it('compares arrays of different lengths', () => {
    const failures = validate(
      { mode: 'full', expectedJson: JSON.stringify([1, 2, 3]) },
      [1, 2]
    );
    expect(failures.length).toBe(1);
  });

  it('reports root primitive mismatch', () => {
    const failures = validate(
      { mode: 'full', expectedJson: '"hello"' },
      'world'
    );
    expect(failures.length).toBe(1);
    expect(failures[0].path).toBe('(root)');
  });
});

// ---------------------------------------------------------------------------
// matchesStatusPattern
// ---------------------------------------------------------------------------
describe('matchesStatusPattern', () => {
  it('matches exact status number', () => {
    expect(matchesStatusPattern(200, '200')).toBe(true);
    expect(matchesStatusPattern(404, '200')).toBe(false);
  });

  it('matches range pattern', () => {
    expect(matchesStatusPattern(200, '200-299')).toBe(true);
    expect(matchesStatusPattern(300, '200-299')).toBe(false);
    expect(matchesStatusPattern(250, '200-299')).toBe(true);
  });

  it('matches class pattern like 2xx', () => {
    expect(matchesStatusPattern(200, '2xx')).toBe(true);
    expect(matchesStatusPattern(201, '2xx')).toBe(true);
    expect(matchesStatusPattern(301, '2xx')).toBe(false);
    expect(matchesStatusPattern(500, '5xx')).toBe(true);
  });

  it('matches comma-separated patterns', () => {
    expect(matchesStatusPattern(200, '200,201,202')).toBe(true);
    expect(matchesStatusPattern(201, '200,201,202')).toBe(true);
    expect(matchesStatusPattern(404, '200,201,202')).toBe(false);
  });

  it('matches comma-separated mixed patterns', () => {
    expect(matchesStatusPattern(200, '2xx,404')).toBe(true);
    expect(matchesStatusPattern(404, '2xx,404')).toBe(true);
    expect(matchesStatusPattern(500, '2xx,404')).toBe(false);
  });

  it('handles whitespace in pattern', () => {
    expect(matchesStatusPattern(200, ' 200 ')).toBe(true);
    expect(matchesStatusPattern(200, ' 200 - 299 ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — additional regex branches
// ---------------------------------------------------------------------------
describe('evaluateAssertions — regex assertion edge cases', () => {
  it('regex assertion on undefined jsonPath value uses "undefined" string', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: { key: 'value' },
      responseHeaders: {},
    };
    // Pattern that won't match "undefined"
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.nonexistent', pattern: '^\\d+$' }],
      ctx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('regex assertion on object value stringifies it', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: { data: { nested: true } },
      responseHeaders: {},
    };
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.data', pattern: '.*nested.*' }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });

  it('regex assertion on number value', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: { count: 42 },
      responseHeaders: {},
    };
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.count', pattern: '^\\d+$' }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });

  it('regex assertion truncates long actual values', () => {
    const longString = 'x'.repeat(300);
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: { data: longString },
      responseHeaders: {},
    };
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.data', pattern: '^y' }],
      ctx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual.length).toBeLessThanOrEqual(201); // 200 + '…'
  });

  it('status assertion fails for mismatched status', () => {
    const ctx = {
      httpStatus: 500,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: {},
    };
    const { failures, statusAsserted } = evaluateAssertions(
      [{ type: 'status', expected: '200' }],
      ctx
    );
    expect(statusAsserted).toBe(true);
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(status)');
    expect(failures[0].actual).toBe('500');
  });

  it('responseTime assertion passes when within limit', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: {},
    };
    const { failures } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 100 }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });

  it('header equals assertion succeeds', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: { 'content-type': 'application/json' },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'equals', value: 'application/json' }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });

  it('header equals assertion fails on mismatch', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: { 'content-type': 'text/html' },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'equals', value: 'application/json' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });

  it('header contains fails when substring not found', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: { 'content-type': 'text/html' },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'contains', value: 'json' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });

  it('header case-insensitive lookup', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: { 'Content-Type': 'application/json' },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'equals', value: 'application/json' }],
      ctx
    );
    expect(failures).toHaveLength(0);
  });
});
