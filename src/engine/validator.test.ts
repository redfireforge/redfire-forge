import { describe, it, expect } from 'vitest';
import { getByPath, validate } from './validator';

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
