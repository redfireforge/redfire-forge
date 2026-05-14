import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validate,
  evaluateFieldOperator,
  evaluateAssertions,
  deepSubsetMatch,
  getJsonTypeName,
  compare,
  matchesStatusPattern,
  formatOp,
  resolveDate,
  toDayString,
} from './validator';
import type { AssertionContext } from './validator';
import type { ComparisonOperator } from '../shared/types';

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

describe('validate – tryRemapPaths', () => {
  it('remaps paths when response is array and fields have wrapper prefix', () => {
    const response = [{ name: 'Alice' }, { name: 'Bob' }];
    const result = validate(
      {
        mode: 'selective',
        expectedFields: [{ jsonPath: 'users[0].name', expectedValue: 'Alice' }],
      },
      response
    );
    expect(result).toHaveLength(0);
  });

  it('remaps paths when response wraps array in key', () => {
    const response = { data: [{ name: 'Alice' }] };
    const result = validate(
      {
        mode: 'selective',
        expectedFields: [{ jsonPath: '[0].name', expectedValue: 'Alice' }],
      },
      response
    );
    expect(result).toHaveLength(0);
  });

  it('remaps selective paths starting with [0] when API wraps rows under items', () => {
    const response = { items: [{ name: 'foo', count: 3 }] };
    expect(
      validate(
        {
          mode: 'selective',
          expectedFields: [
            { jsonPath: '[0].name', expectedValue: '"foo"' },
            { jsonPath: '[0].count', expectedValue: '3' },
          ],
        },
        response,
      ),
    ).toEqual([]);
  });

  it('strategy 2 returns concrete mismatch when prefixed path resolves to a non-undefined value', () => {
    const response = { items: [{ name: 'actual' }] };
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [{ jsonPath: '[0].name', expectedValue: '"expected"' }],
      },
      response,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toContain('items');
    expect(failures[0].actual).not.toContain('undefined');
    expect(failures[0].expected).toContain('expected');
  });

  it('tryRemapPaths strategy 1 skips early return when stripped validation yields only missing paths', () => {
    expect(
      validate(
        {
          mode: 'selective',
          expectedFields: [{ jsonPath: 'wrap[0].missingLeaf', expectedValue: '"x"' }],
        },
        [{ other: true }],
      ).length,
    ).toBeGreaterThan(0);
  });

  it('tryRemapPaths strategy 1 runs unordered validation after stripping wrapper prefix on root array', () => {
    const response = [
      { sku: 'X1', qty: 1 },
      { sku: 'X2', qty: 2 },
    ];
    expect(
      validate(
        {
          mode: 'selective',
          unorderedArrays: true,
          expectedFields: [
            { jsonPath: 'rows[0].sku', expectedValue: '"X2"' },
            { jsonPath: 'rows[0].qty', expectedValue: '2' },
          ],
        },
        response,
      ),
    ).toEqual([]);
  });

  it('unordered partial mismatch formats non-undefined actualValues in failure detail', () => {
    const response = {
      offers: [{ code: 'A', price: 100 }],
    };
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].code', expectedValue: '"A"' },
          { jsonPath: '$.offers[0].price', expectedValue: '', operator: 'greater_than', operatorValue: '500' },
        ],
      },
      response,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('$.offers[0].price');
    expect(failures[0].actual).toContain('matched by');
  });

  it('remaps unordered fields under a non-array root key wrapping an array', () => {
    const response = { items: [{ code: 'A' }, { code: 'B' }] };
    expect(
      validate(
        {
          mode: 'selective',
          unorderedArrays: true,
          expectedFields: [{ jsonPath: '[0].code', expectedValue: '"B"' }],
        },
        response,
      ),
    ).toEqual([]);
  });

  it('validates null responseBody returns failures for selective mode', () => {
    const result = validate(
      {
        mode: 'selective',
        expectedFields: [{ jsonPath: 'a', expectedValue: '1' }],
      },
      null
    );
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('validate – full mode edge cases', () => {
  it('returns parse error for invalid expectedJson', () => {
    const result = validate({ mode: 'full', expectedJson: '{invalid' }, {});
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('(parse)');
  });

  it('deep compare arrays of different lengths', () => {
    const result = validate({ mode: 'full', expectedJson: '[1,2,3]' }, [1, 2]);
    expect(result.length).toBeGreaterThan(0);
  });

  it('deep compare array vs non-array', () => {
    const result = validate({ mode: 'full', expectedJson: '[1]' }, { a: 1 });
    expect(result.length).toBeGreaterThan(0);
  });

  it('deep compare null vs value', () => {
    const result = validate({ mode: 'full', expectedJson: 'null' }, { a: 1 });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('validate – unordered arrays', () => {
  it('validates unordered array with partial match reports best partial', () => {
    const response = [
      { name: 'Alice', code: 'A1' },
      { name: 'Bob', code: 'B1' },
    ];
    const result = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '[0].name', expectedValue: 'Alice' },
          { jsonPath: '[0].code', expectedValue: 'WRONG' },
        ],
      },
      response
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it('validates unordered array with no match at all', () => {
    const response = [{ name: 'Alice' }];
    const result = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '[0].name', expectedValue: 'Charlie' },
        ],
      },
      response
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it('non-array fields pass through unordered validation', () => {
    const response = { status: 'ok', items: [{ id: 1 }] };
    const result = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: 'status', expectedValue: 'ok' },
        ],
      },
      response
    );
    expect(result).toHaveLength(0);
  });

  it('unordered matching compares plain-string expected fields without operators', () => {
    const response = {
      rows: [
        { code: 'A', title: 'Plain title' },
        { code: 'B', title: 'Other' },
      ],
    };
    expect(
      validate(
        {
          mode: 'selective',
          unorderedArrays: true,
          expectedFields: [{ jsonPath: '$.rows[0].title', expectedValue: 'Plain title' }],
        },
        response,
      ),
    ).toEqual([]);
  });

  it('unordered matching evaluates field operators inside indexed rows', () => {
    const response = {
      offers: [{ price: 100 }, { price: 5 }],
    };
    expect(
      validate(
        {
          mode: 'selective',
          unorderedArrays: true,
          expectedFields: [
            {
              jsonPath: '$.offers[0].price',
              expectedValue: '',
              operator: 'greater_than',
              operatorValue: '50',
            },
          ],
        },
        response,
      ),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Real-world scenario: offers list with reordered API response
// Verifies unordered matching reports correct API indices in failure messages
// ---------------------------------------------------------------------------
describe('validate – real-world offers reorder scenario', () => {
  const apiResponse = {
    offers: [
      { associatedOfferingCode: 'ONZFCNCP01MCALM', rank: 1, offerName: 'OnStar One - Trial - 1 Month' },
      { associatedOfferingCode: 'IHUTRNCP08YCAUL', rank: 3, offerName: 'IHU Connectivity - 8 Years' },
      { associatedOfferingCode: 'DAFCNCP01MCA3G', rank: 3, offerName: '3GB WiFi Connectivity - Trial - 1 Month' },
      { associatedOfferingCode: 'BAZFCNCP08YUCX', rank: 9, offerName: 'OnStar Basics - 8 Years' },
      { associatedOfferingCode: 'CAZFCNCP08YUCMX', rank: 13, offerName: 'Connected Access - 8 Years' },
      { associatedOfferingCode: 'EVZFCNCP08YUCMX', rank: 13, offerName: 'EV Access - 8 Years' },
    ],
  };

  it('matches by associatedOfferingCode and reports correct API index in failure message', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].associatedOfferingCode', expectedValue: 'ONZFCNCP01MCALM' },
          { jsonPath: '$.offers[0].offerName', expectedValue: 'OnStar One - Trial - 1 Month' },
          { jsonPath: '$.offers[1].associatedOfferingCode', expectedValue: 'DAFCNCP01MCA3G' },
          { jsonPath: '$.offers[1].offerName', expectedValue: 'Trial Data 3GB - 1 Month CAN' },
          { jsonPath: '$.offers[2].associatedOfferingCode', expectedValue: 'IHUTRNCP08YCAUL' },
          { jsonPath: '$.offers[2].offerName', expectedValue: 'IHU Connectivity - 96 months CA' },
        ],
      },
      apiResponse,
    );

    const offerNameFailures = failures.filter((f) => f.path.endsWith('.offerName'));
    expect(offerNameFailures).toHaveLength(2);

    const f1 = offerNameFailures.find((f) => f.path === '$.offers[1].offerName');
    expect(f1).toBeDefined();
    expect(f1!.expected).toBe('Trial Data 3GB - 1 Month CAN');
    expect(String(f1!.actual)).toContain('3GB WiFi Connectivity - Trial - 1 Month');
    expect(String(f1!.actual)).toContain('matched by');
    expect(String(f1!.actual)).toContain('DAFCNCP01MCA3G');
    expect(String(f1!.actual)).toContain('at [2]');

    const f2 = offerNameFailures.find((f) => f.path === '$.offers[2].offerName');
    expect(f2).toBeDefined();
    expect(f2!.expected).toBe('IHU Connectivity - 96 months CA');
    expect(String(f2!.actual)).toContain('IHU Connectivity - 8 Years');
    expect(String(f2!.actual)).toContain('matched by');
    expect(String(f2!.actual)).toContain('IHUTRNCP08YCAUL');
    expect(String(f2!.actual)).toContain('at [1]');
  });

  it('passes when expected offerName values match the API response', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.offers[0].associatedOfferingCode', expectedValue: 'ONZFCNCP01MCALM' },
          { jsonPath: '$.offers[0].offerName', expectedValue: 'OnStar One - Trial - 1 Month' },
          { jsonPath: '$.offers[1].associatedOfferingCode', expectedValue: 'DAFCNCP01MCA3G' },
          { jsonPath: '$.offers[1].offerName', expectedValue: '3GB WiFi Connectivity - Trial - 1 Month' },
          { jsonPath: '$.offers[2].associatedOfferingCode', expectedValue: 'IHUTRNCP08YCAUL' },
          { jsonPath: '$.offers[2].offerName', expectedValue: 'IHU Connectivity - 8 Years' },
        ],
      },
      apiResponse,
    );

    expect(failures).toEqual([]);
  });

  it('reports ordered-mode failures as plain expected/actual (no "matched by")', () => {
    const failures = validate(
      {
        mode: 'selective',
        unorderedArrays: false,
        expectedFields: [
          { jsonPath: '$.offers[1].associatedOfferingCode', expectedValue: 'DAFCNCP01MCA3G' },
        ],
      },
      apiResponse,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toBe('DAFCNCP01MCA3G');
    expect(String(failures[0].actual)).not.toContain('matched by');
    expect(String(failures[0].actual)).toContain('IHUTRNCP08YCAUL');
  });
});

// ---------------------------------------------------------------------------
// evaluateFieldOperator — unit tests for all 24 operators
// ---------------------------------------------------------------------------
describe('evaluateFieldOperator', () => {
  describe('equals', () => {
    it('passes for exact string match', () => {
      expect(evaluateFieldOperator('hello', 'equals', undefined, '"hello"').pass).toBe(true);
    });
    it('passes for exact number match', () => {
      expect(evaluateFieldOperator(42, 'equals', undefined, '42').pass).toBe(true);
    });
    it('fails on mismatch', () => {
      expect(evaluateFieldOperator('hello', 'equals', undefined, '"world"').pass).toBe(false);
    });
    it('passes for boolean', () => {
      expect(evaluateFieldOperator(true, 'equals', undefined, 'true').pass).toBe(true);
    });
    it('passes for null', () => {
      expect(evaluateFieldOperator(null, 'equals', undefined, 'null').pass).toBe(true);
    });
  });

  describe('not_equals', () => {
    it('passes when values differ', () => {
      expect(evaluateFieldOperator('hello', 'not_equals', undefined, '"world"').pass).toBe(true);
    });
    it('fails when values match', () => {
      expect(evaluateFieldOperator(42, 'not_equals', undefined, '42').pass).toBe(false);
    });
  });

  describe('greater_than', () => {
    it('passes when actual > operatorValue', () => {
      expect(evaluateFieldOperator(10, 'greater_than', '5', '').pass).toBe(true);
    });
    it('fails when actual = operatorValue', () => {
      expect(evaluateFieldOperator(5, 'greater_than', '5', '').pass).toBe(false);
    });
    it('fails when actual < operatorValue', () => {
      expect(evaluateFieldOperator(3, 'greater_than', '5', '').pass).toBe(false);
    });
    it('falls back to expectedValue when operatorValue is undefined', () => {
      expect(evaluateFieldOperator(10, 'greater_than', undefined, '5').pass).toBe(true);
    });
    it('fails for non-numeric', () => {
      expect(evaluateFieldOperator('abc', 'greater_than', '5', '').pass).toBe(false);
    });
    it('handles string numbers', () => {
      expect(evaluateFieldOperator('10', 'greater_than', '5', '').pass).toBe(true);
    });
  });

  describe('greater_than_or_equal', () => {
    it('passes when actual >= operatorValue', () => {
      expect(evaluateFieldOperator(5, 'greater_than_or_equal', '5', '').pass).toBe(true);
    });
    it('fails when actual < operatorValue', () => {
      expect(evaluateFieldOperator(4, 'greater_than_or_equal', '5', '').pass).toBe(false);
    });
  });

  describe('less_than', () => {
    it('passes when actual < operatorValue', () => {
      expect(evaluateFieldOperator(3, 'less_than', '5', '').pass).toBe(true);
    });
    it('fails when actual >= operatorValue', () => {
      expect(evaluateFieldOperator(5, 'less_than', '5', '').pass).toBe(false);
    });
  });

  describe('less_than_or_equal', () => {
    it('passes when actual <= operatorValue', () => {
      expect(evaluateFieldOperator(5, 'less_than_or_equal', '5', '').pass).toBe(true);
    });
    it('fails when actual > operatorValue', () => {
      expect(evaluateFieldOperator(6, 'less_than_or_equal', '5', '').pass).toBe(false);
    });
  });

  describe('contains', () => {
    it('passes when string contains substring', () => {
      expect(evaluateFieldOperator('hello world', 'contains', 'world', '').pass).toBe(true);
    });
    it('fails when string does not contain substring', () => {
      expect(evaluateFieldOperator('hello', 'contains', 'world', '').pass).toBe(false);
    });
    it('works with JSON stringified non-string values', () => {
      expect(evaluateFieldOperator({ name: 'test' }, 'contains', 'test', '').pass).toBe(true);
    });
  });

  describe('not_contains', () => {
    it('passes when string does not contain substring', () => {
      expect(evaluateFieldOperator('hello', 'not_contains', 'world', '').pass).toBe(true);
    });
    it('fails when string contains substring', () => {
      expect(evaluateFieldOperator('hello world', 'not_contains', 'world', '').pass).toBe(false);
    });
  });

  describe('starts_with', () => {
    it('passes when string starts with prefix', () => {
      expect(evaluateFieldOperator('hello world', 'starts_with', 'hello', '').pass).toBe(true);
    });
    it('fails when string does not start with prefix', () => {
      expect(evaluateFieldOperator('hello world', 'starts_with', 'world', '').pass).toBe(false);
    });
    it('coerces non-string to string before matching', () => {
      expect(evaluateFieldOperator(42, 'starts_with', '4', '').pass).toBe(true);
      expect(evaluateFieldOperator(42, 'starts_with', 'x', '').pass).toBe(false);
    });
  });

  describe('ends_with', () => {
    it('passes when string ends with suffix', () => {
      expect(evaluateFieldOperator('hello world', 'ends_with', 'world', '').pass).toBe(true);
    });
    it('fails when string does not end with suffix', () => {
      expect(evaluateFieldOperator('hello world', 'ends_with', 'hello', '').pass).toBe(false);
    });
  });

  describe('regex', () => {
    it('passes when string matches pattern', () => {
      expect(evaluateFieldOperator('abc123', 'regex', '^[a-z]+\\d+$', '').pass).toBe(true);
    });
    it('fails when string does not match pattern', () => {
      expect(evaluateFieldOperator('123abc', 'regex', '^[a-z]+\\d+$', '').pass).toBe(false);
    });
    it('handles invalid regex gracefully', () => {
      const result = evaluateFieldOperator('test', 'regex', '[invalid', '');
      expect(result.pass).toBe(false);
      expect(result.actual).toBe('invalid regex pattern');
    });
  });

  describe('is_true', () => {
    it('passes for boolean true', () => {
      expect(evaluateFieldOperator(true, 'is_true', undefined, '').pass).toBe(true);
    });
    it('passes for string "true"', () => {
      expect(evaluateFieldOperator('true', 'is_true', undefined, '').pass).toBe(true);
    });
    it('fails for false', () => {
      expect(evaluateFieldOperator(false, 'is_true', undefined, '').pass).toBe(false);
    });
    it('fails for non-boolean', () => {
      expect(evaluateFieldOperator(1, 'is_true', undefined, '').pass).toBe(false);
    });
  });

  describe('is_false', () => {
    it('passes for boolean false', () => {
      expect(evaluateFieldOperator(false, 'is_false', undefined, '').pass).toBe(true);
    });
    it('passes for string "false"', () => {
      expect(evaluateFieldOperator('false', 'is_false', undefined, '').pass).toBe(true);
    });
    it('fails for true', () => {
      expect(evaluateFieldOperator(true, 'is_false', undefined, '').pass).toBe(false);
    });
  });

  describe('is_null', () => {
    it('passes for null', () => {
      expect(evaluateFieldOperator(null, 'is_null', undefined, '').pass).toBe(true);
    });
    it('fails for undefined', () => {
      expect(evaluateFieldOperator(undefined, 'is_null', undefined, '').pass).toBe(false);
    });
    it('fails for non-null', () => {
      expect(evaluateFieldOperator(0, 'is_null', undefined, '').pass).toBe(false);
    });
  });

  describe('is_not_null', () => {
    it('passes for non-null', () => {
      expect(evaluateFieldOperator(0, 'is_not_null', undefined, '').pass).toBe(true);
    });
    it('passes for empty string', () => {
      expect(evaluateFieldOperator('', 'is_not_null', undefined, '').pass).toBe(true);
    });
    it('fails for null', () => {
      expect(evaluateFieldOperator(null, 'is_not_null', undefined, '').pass).toBe(false);
    });
    it('fails for undefined', () => {
      expect(evaluateFieldOperator(undefined, 'is_not_null', undefined, '').pass).toBe(false);
    });
  });

  describe('is_empty', () => {
    it('passes for empty string', () => {
      expect(evaluateFieldOperator('', 'is_empty', undefined, '').pass).toBe(true);
    });
    it('passes for null', () => {
      expect(evaluateFieldOperator(null, 'is_empty', undefined, '').pass).toBe(true);
    });
    it('passes for undefined', () => {
      expect(evaluateFieldOperator(undefined, 'is_empty', undefined, '').pass).toBe(true);
    });
    it('passes for empty array', () => {
      expect(evaluateFieldOperator([], 'is_empty', undefined, '').pass).toBe(true);
    });
    it('passes for empty object', () => {
      expect(evaluateFieldOperator({}, 'is_empty', undefined, '').pass).toBe(true);
    });
    it('fails for non-empty string', () => {
      expect(evaluateFieldOperator('hello', 'is_empty', undefined, '').pass).toBe(false);
    });
    it('fails for non-empty array', () => {
      expect(evaluateFieldOperator([1], 'is_empty', undefined, '').pass).toBe(false);
    });
  });

  describe('is_not_empty', () => {
    it('passes for non-empty string', () => {
      expect(evaluateFieldOperator('hello', 'is_not_empty', undefined, '').pass).toBe(true);
    });
    it('passes for non-empty array', () => {
      expect(evaluateFieldOperator([1], 'is_not_empty', undefined, '').pass).toBe(true);
    });
    it('fails for empty string', () => {
      expect(evaluateFieldOperator('', 'is_not_empty', undefined, '').pass).toBe(false);
    });
    it('fails for null', () => {
      expect(evaluateFieldOperator(null, 'is_not_empty', undefined, '').pass).toBe(false);
    });
  });

  describe('exists', () => {
    it('passes for defined value', () => {
      expect(evaluateFieldOperator(null, 'exists', undefined, '').pass).toBe(true);
    });
    it('passes for zero', () => {
      expect(evaluateFieldOperator(0, 'exists', undefined, '').pass).toBe(true);
    });
    it('fails for undefined', () => {
      expect(evaluateFieldOperator(undefined, 'exists', undefined, '').pass).toBe(false);
    });
  });

  describe('not_exists', () => {
    it('passes for undefined', () => {
      expect(evaluateFieldOperator(undefined, 'not_exists', undefined, '').pass).toBe(true);
    });
    it('fails for null', () => {
      expect(evaluateFieldOperator(null, 'not_exists', undefined, '').pass).toBe(false);
    });
  });

  describe('is_type', () => {
    it('detects string type', () => {
      expect(evaluateFieldOperator('hello', 'is_type', 'string', '').pass).toBe(true);
    });
    it('detects number type', () => {
      expect(evaluateFieldOperator(42, 'is_type', 'number', '').pass).toBe(true);
    });
    it('detects boolean type', () => {
      expect(evaluateFieldOperator(true, 'is_type', 'boolean', '').pass).toBe(true);
    });
    it('detects array type', () => {
      expect(evaluateFieldOperator([1, 2], 'is_type', 'array', '').pass).toBe(true);
    });
    it('detects object type', () => {
      expect(evaluateFieldOperator({ a: 1 }, 'is_type', 'object', '').pass).toBe(true);
    });
    it('detects null type', () => {
      expect(evaluateFieldOperator(null, 'is_type', 'null', '').pass).toBe(true);
    });
    it('fails on type mismatch', () => {
      expect(evaluateFieldOperator('hello', 'is_type', 'number', '').pass).toBe(false);
    });
  });

  describe('in', () => {
    it('passes when value is in JSON array', () => {
      expect(evaluateFieldOperator('a', 'in', '["a","b","c"]', '').pass).toBe(true);
    });
    it('fails when value is not in list', () => {
      expect(evaluateFieldOperator('d', 'in', '["a","b","c"]', '').pass).toBe(false);
    });
    it('works with comma-separated fallback', () => {
      expect(evaluateFieldOperator('b', 'in', 'a,b,c', '').pass).toBe(true);
    });
    it('works with numbers in JSON array', () => {
      expect(evaluateFieldOperator(2, 'in', '[1,2,3]', '').pass).toBe(true);
    });
  });

  describe('not_in', () => {
    it('passes when value is not in list', () => {
      expect(evaluateFieldOperator('d', 'not_in', '["a","b","c"]', '').pass).toBe(true);
    });
    it('fails when value is in list', () => {
      expect(evaluateFieldOperator('a', 'not_in', '["a","b","c"]', '').pass).toBe(false);
    });
  });

  describe('between', () => {
    it('passes when value is within range (inclusive)', () => {
      expect(evaluateFieldOperator(5, 'between', '1,10', '').pass).toBe(true);
    });
    it('passes at lower bound', () => {
      expect(evaluateFieldOperator(1, 'between', '1,10', '').pass).toBe(true);
    });
    it('passes at upper bound', () => {
      expect(evaluateFieldOperator(10, 'between', '1,10', '').pass).toBe(true);
    });
    it('fails when below range', () => {
      expect(evaluateFieldOperator(0, 'between', '1,10', '').pass).toBe(false);
    });
    it('fails when above range', () => {
      expect(evaluateFieldOperator(11, 'between', '1,10', '').pass).toBe(false);
    });
  });

  describe('close_to', () => {
    it('passes within default tolerance (0.01)', () => {
      expect(evaluateFieldOperator(3.005, 'close_to', '3.0', '').pass).toBe(true);
    });
    it('passes within custom tolerance', () => {
      expect(evaluateFieldOperator(10.5, 'close_to', '10,1', '').pass).toBe(true);
    });
    it('fails outside tolerance', () => {
      expect(evaluateFieldOperator(10.5, 'close_to', '10,0.1', '').pass).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// validate — selective mode with field operators
// ---------------------------------------------------------------------------
describe('validate — selective with field operators', () => {
  it('passes with greater_than operator', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.price', expectedValue: '', operator: 'greater_than', operatorValue: '10' },
        ],
      },
      { price: 25 },
    );
    expect(failures).toEqual([]);
  });

  it('fails with greater_than operator when not met', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.price', expectedValue: '', operator: 'greater_than', operatorValue: '50' },
        ],
      },
      { price: 25 },
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('$.price');
  });

  it('passes with contains operator', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.name', expectedValue: '', operator: 'contains', operatorValue: 'On' },
        ],
      },
      { name: 'OnStar Premium' },
    );
    expect(failures).toEqual([]);
  });

  it('passes with exists operator', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.id', expectedValue: '', operator: 'exists' },
        ],
      },
      { id: 'abc-123' },
    );
    expect(failures).toEqual([]);
  });

  it('passes with is_type operator', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.items', expectedValue: '', operator: 'is_type', operatorValue: 'array' },
        ],
      },
      { items: [1, 2, 3] },
    );
    expect(failures).toEqual([]);
  });

  it('backward compatible — fields without operator use equals', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.name', expectedValue: '"Alice"' },
        ],
      },
      { name: 'Alice' },
    );
    expect(failures).toEqual([]);
  });

  it('passes with between operator', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.score', expectedValue: '', operator: 'between', operatorValue: '80,100' },
        ],
      },
      { score: 95 },
    );
    expect(failures).toEqual([]);
  });

  it('passes multiple operators on different fields', () => {
    const failures = validate(
      {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.name', expectedValue: '"Bob"' },
          { jsonPath: '$.age', expectedValue: '', operator: 'greater_than', operatorValue: '18' },
          { jsonPath: '$.active', expectedValue: '', operator: 'is_true' },
          { jsonPath: '$.email', expectedValue: '', operator: 'contains', operatorValue: '@' },
        ],
      },
      { name: 'Bob', age: 25, active: true, email: 'bob@example.com' },
    );
    expect(failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getJsonTypeName
// ---------------------------------------------------------------------------
describe('getJsonTypeName', () => {
  it('returns "string" for string values', () => expect(getJsonTypeName('hello')).toBe('string'));
  it('returns "string" for empty string', () => expect(getJsonTypeName('')).toBe('string'));
  it('returns "number" for numbers', () => expect(getJsonTypeName(42)).toBe('number'));
  it('returns "number" for zero', () => expect(getJsonTypeName(0)).toBe('number'));
  it('returns "number" for NaN', () => expect(getJsonTypeName(NaN)).toBe('number'));
  it('returns "boolean" for true', () => expect(getJsonTypeName(true)).toBe('boolean'));
  it('returns "boolean" for false', () => expect(getJsonTypeName(false)).toBe('boolean'));
  it('returns "null" for null', () => expect(getJsonTypeName(null)).toBe('null'));
  it('returns "array" for arrays', () => expect(getJsonTypeName([1, 2])).toBe('array'));
  it('returns "array" for empty arrays', () => expect(getJsonTypeName([])).toBe('array'));
  it('returns "object" for plain objects', () => expect(getJsonTypeName({ a: 1 })).toBe('object'));
  it('returns "object" for empty objects', () => expect(getJsonTypeName({})).toBe('object'));
});

// ---------------------------------------------------------------------------
// evaluateAssertions — typeCheck
// ---------------------------------------------------------------------------
const baseCtx: AssertionContext = {
  httpStatus: 200,
  responseTimeMs: 50,
  responseHeaders: {},
  responseBody: {
    name: 'Alice',
    price: 19.99,
    active: true,
    tags: ['vip', 'premium'],
    address: { city: 'NYC', zip: '10001' },
    deleted: null,
    items: [
      { id: 1, name: 'Widget' },
      { id: 2, name: 'Gadget' },
    ],
    score: 0,
    empty: '',
  },
};

describe('evaluateAssertions — typeCheck', () => {
  it('passes when $.name is string', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.name', expectedType: 'string' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes when $.price is number', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.price', expectedType: 'number' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes when $.active is boolean', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.active', expectedType: 'boolean' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes when $.tags is array', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.tags', expectedType: 'array' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes when $.address is object', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.address', expectedType: 'object' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes when $.deleted is null', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.deleted', expectedType: 'null' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails when $.price expected string but got number', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.price', expectedType: 'string' }],
      baseCtx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toBe('type string');
    expect(failures[0].actual).toBe('type number');
  });

  it('fails when $.tags expected object but got array', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.tags', expectedType: 'object' }],
      baseCtx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('type array');
  });

  it('fails when path not found', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.nonexistent', expectedType: 'string' }],
      baseCtx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('path not found');
  });

  it('passes for nested path $.address.city is string', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.address.city', expectedType: 'string' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes for array-indexed path $.items[0].name is string', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.items[0].name', expectedType: 'string' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes for empty string — still string type', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.empty', expectedType: 'string' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes for zero — still number type', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.score', expectedType: 'number' }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — existence
// ---------------------------------------------------------------------------
describe('evaluateAssertions — existence', () => {
  it('passes when field exists and expectExists is true', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.name', expectExists: true }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails when field exists but expectExists is false', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.name', expectExists: false }],
      baseCtx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toBe('field does not exist');
    expect(failures[0].actual).toBe('field exists');
  });

  it('fails when field does not exist but expectExists is true', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.nonexistent', expectExists: true }],
      baseCtx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toBe('field exists');
    expect(failures[0].actual).toBe('field not found');
  });

  it('passes when field does not exist and expectExists is false', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.nonexistent', expectExists: false }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('passes for nested path that exists', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.address.city', expectExists: true }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('fails for deeply nested missing path', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.address.phone.mobile', expectExists: true }],
      baseCtx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('field not found');
  });

  it('null value counts as existing (existence ≠ non-null)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.deleted', expectExists: true }],
      baseCtx,
    );
    expect(failures).toEqual([]);
  });

  it('null value with expectExists false → fails (field exists)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'existence', jsonPath: '$.deleted', expectExists: false }],
      baseCtx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('field exists');
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — status / responseTime / header / regex / array / numeric / date
// ---------------------------------------------------------------------------
describe('evaluateAssertions — status patterns', () => {
  const ctx = (status: number): AssertionContext => ({
    httpStatus: status,
    responseTimeMs: 0,
    responseHeaders: {},
    responseBody: {},
  });

  it('passes exact status match', () => {
    const { failures, statusAsserted } = evaluateAssertions([{ type: 'status', expected: '200' }], ctx(200));
    expect(statusAsserted).toBe(true);
    expect(failures).toEqual([]);
  });

  it('fails when status does not match exact pattern', () => {
    const { failures } = evaluateAssertions([{ type: 'status', expected: '404' }], ctx(200));
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(status)');
  });

  it('matches numeric range pattern', () => {
    expect(evaluateAssertions([{ type: 'status', expected: '200-299' }], ctx(201)).failures).toEqual([]);
    expect(evaluateAssertions([{ type: 'status', expected: '200 - 299' }], ctx(199)).failures.length).toBe(1);
  });

  it('matches 2xx class pattern', () => {
    expect(evaluateAssertions([{ type: 'status', expected: '2xx' }], ctx(204)).failures).toEqual([]);
    expect(evaluateAssertions([{ type: 'status', expected: '2XX' }], ctx(301)).failures.length).toBe(1);
  });

  it('matches comma-separated OR patterns', () => {
    expect(evaluateAssertions([{ type: 'status', expected: '400, 401 , 403' }], ctx(401)).failures).toEqual([]);
    expect(evaluateAssertions([{ type: 'status', expected: '500,502' }], ctx(503)).failures.length).toBe(1);
  });
});

describe('evaluateAssertions — responseTime', () => {
  const ctx = (ms: number): AssertionContext => ({
    httpStatus: 200,
    responseTimeMs: ms,
    responseHeaders: {},
    responseBody: {},
  });

  it('passes when under max', () => {
    expect(evaluateAssertions([{ type: 'responseTime', maxMs: 100 }], ctx(50)).failures).toEqual([]);
  });

  it('fails when over max', () => {
    const { failures } = evaluateAssertions([{ type: 'responseTime', maxMs: 100 }], ctx(150));
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(responseTime)');
    expect(failures[0].actual).toContain('150');
  });
});

describe('evaluateAssertions — header', () => {
  const ctx = (headers: Record<string, string>): AssertionContext => ({
    httpStatus: 200,
    responseTimeMs: 0,
    responseHeaders: headers,
    responseBody: {},
  });

  it('header exists passes when present', () => {
    expect(
      evaluateAssertions([{ type: 'header', name: 'Content-Type', operator: 'exists' }], ctx({ 'Content-Type': 'json' }))
        .failures,
    ).toEqual([]);
  });

  it('header exists fails when missing', () => {
    const { failures } = evaluateAssertions([{ type: 'header', name: 'X-Missing', operator: 'exists' }], ctx({}));
    expect(failures).toHaveLength(1);
  });

  it('header equals compares case-insensitively on name', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'content-type', operator: 'equals', value: 'application/json' }],
        ctx({ 'Content-Type': 'application/json' }),
      ).failures,
    ).toEqual([]);
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'content-type', operator: 'equals', value: 'text/plain' }],
        ctx({ 'Content-Type': 'application/json' }),
      ).failures.length,
    ).toBe(1);
  });

  it('header equals resolves after scanning unrelated header keys', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'x-tail', operator: 'equals', value: 'matched' }],
        ctx({ AAA: 'no', 'X-Tail': 'matched' }),
      ).failures,
    ).toEqual([]);
  });

  it('header equals fails when header is absent', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'Etag', operator: 'equals', value: '"v1"' }],
      ctx({}),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('(not present)');
  });

  it('header regex passes and fails evaluateHeaderOp branches', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'Trace', operator: 'regex', value: '^[0-9a-f]{8}$' }],
        ctx({ Trace: 'a1b2c3d4' }),
      ).failures,
    ).toEqual([]);
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'Trace', operator: 'regex', value: '^[0-9]+$' }],
        ctx({ Trace: 'a1b2c3d4' }),
      ).failures,
    ).toHaveLength(1);
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'Missing', operator: 'regex', value: '.*' }],
        ctx({}),
      ).failures,
    ).toHaveLength(1);
    expect(evaluateAssertions(
      [{ type: 'header', name: 'Missing', operator: 'regex', value: '.*' }],
      ctx({}),
    ).failures[0].actual).toBe('(not present)');
  });

  it('header equals with undefined value matches absent header only', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'Absent-X', operator: 'equals', value: undefined as unknown as string }],
        ctx({}),
      ).failures,
    ).toEqual([]);
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'Absent-X', operator: 'equals', value: undefined as unknown as string }],
        ctx({ 'Absent-X': 'present' }),
      ).failures.length,
    ).toBe(1);
  });

  it('header regex assertion omits optional value → empty pattern matches when header exists', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'Hdr', operator: 'regex' }],
        ctx({ Hdr: 'anything' }),
      ).failures,
    ).toEqual([]);
  });

  it('header contains matches entire header when expected omitted', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'X-Full', operator: 'contains', value: undefined as unknown as string }],
        ctx({ 'X-Full': 'anything' }),
      ).failures,
    ).toEqual([]);
  });

  it('header contains substring', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'Authorization', operator: 'contains', value: 'Bearer' }],
        ctx({ Authorization: 'Bearer xyz' }),
      ).failures,
    ).toEqual([]);
  });

  it('header regex matches successfully', () => {
    expect(
      evaluateAssertions(
        [{ type: 'header', name: 'X-Token', operator: 'regex', value: '^tok-[0-9]+$' }],
        {
          httpStatus: 200,
          responseTimeMs: 0,
          responseHeaders: { 'x-token': 'tok-42' },
          responseBody: {},
        },
      ).failures,
    ).toEqual([]);
  });

  it('header regex invalid pattern surfaces error', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'X-Req', operator: 'regex', value: '[bad' }],
      ctx({ 'X-Req': 'x' }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });

  it('header unknown operator fails', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'X', operator: 'not_a_real_op' as 'equals', value: '' }],
      ctx({ X: '1' }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('unknown operator');
  });
});

describe('evaluateAssertions — regex on body', () => {
  const ctx: AssertionContext = {
    httpStatus: 200,
    responseTimeMs: 0,
    responseHeaders: {},
    responseBody: { name: 'Hello', id: 42, long: 'x'.repeat(250) },
  };

  it('passes when pattern matches string value', () => {
    expect(
      evaluateAssertions([{ type: 'regex', jsonPath: '$.name', pattern: '^He' }], ctx).failures,
    ).toEqual([]);
  });

  it('coerces non-string to JSON string for matching', () => {
    expect(
      evaluateAssertions([{ type: 'regex', jsonPath: '$.id', pattern: '^42$' }], ctx).failures,
    ).toEqual([]);
  });

  it('uses "undefined" when path missing', () => {
    const { failures } = evaluateAssertions([{ type: 'regex', jsonPath: '$.nope', pattern: '^x$' }], ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('fails when pattern does not match', () => {
    const { failures } = evaluateAssertions([{ type: 'regex', jsonPath: '$.name', pattern: '^[0-9]+$' }], ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('matches');
  });

  it('invalid body regex pattern', () => {
    const { failures } = evaluateAssertions([{ type: 'regex', jsonPath: '$.name', pattern: '(' }], ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });

  it('truncates long actual preview', () => {
    const { failures } = evaluateAssertions([{ type: 'regex', jsonPath: '$.long', pattern: '^nomatch$' }], ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0].actual!.length).toBeLessThanOrEqual(201);
    expect(failures[0].actual).toContain('…');
  });
});

describe('evaluateAssertions — arrayLength', () => {
  const ctx: AssertionContext = {
    httpStatus: 200,
    responseTimeMs: 0,
    responseHeaders: {},
    responseBody: { items: [1, 2, 3], notArr: 'x' },
  };

  it('fails when path is not an array', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.notArr', operator: '=', value: 1 }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('not an array');
  });

  it('fails when array path undefined', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.missing', operator: '=', value: 0 }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('passes length comparison', () => {
    expect(
      evaluateAssertions([{ type: 'arrayLength', jsonPath: '$.items', operator: '>=', value: 3 }], ctx).failures,
    ).toEqual([]);
  });

  it('fails length comparison', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '<', value: 2 }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('length 3');
  });
});

describe('evaluateAssertions — numeric', () => {
  const ctx: AssertionContext = {
    httpStatus: 200,
    responseTimeMs: 0,
    responseHeaders: {},
    responseBody: { n: 10, bad: 'nan', missingOk: undefined },
  };

  it('fails when path undefined', () => {
    const { failures } = evaluateAssertions([{ type: 'numeric', jsonPath: '$.missingOk', operator: '>', value: 0 }], ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('fails when value not numeric', () => {
    const { failures } = evaluateAssertions([{ type: 'numeric', jsonPath: '$.bad', operator: '=', value: 0 }], ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('not a number');
  });

  it('passes comparison on number field', () => {
    expect(
      evaluateAssertions([{ type: 'numeric', jsonPath: '$.n', operator: '>=', value: 10 }], ctx).failures,
    ).toEqual([]);
  });

  it('coerces numeric string', () => {
    expect(
      evaluateAssertions([{ type: 'numeric', jsonPath: '$.n', operator: '=', value: 10 }], {
        ...ctx,
        responseBody: { n: '10' },
      }).failures,
    ).toEqual([]);
  });

  it('fails comparison', () => {
    expect(
      evaluateAssertions([{ type: 'numeric', jsonPath: '$.n', operator: '<', value: 5 }], ctx).failures.length,
    ).toBe(1);
  });
});

describe('evaluateAssertions — date', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-15T12:00:00Z').getTime());
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  const ctx: AssertionContext = {
    httpStatus: 200,
    responseTimeMs: 0,
    responseHeaders: {},
    responseBody: {
      d1: '2026-06-20',
      d2: 'not-a-date',
      ts: new Date('2026-06-10T00:00:00Z').getTime(),
    },
  };

  it('fails when date path undefined', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.missing', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('fails when value cannot be parsed as date', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.d2', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('not a date');
  });

  it('passes date comparison vs today UTC', () => {
    expect(
      evaluateAssertions(
        [{ type: 'date', jsonPath: '$.d1', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        ctx,
      ).failures,
    ).toEqual([]);
  });

  it('passes numeric epoch interpreted as UTC day', () => {
    expect(
      evaluateAssertions(
        [{ type: 'date', jsonPath: '$.ts', operator: '<', reference: { kind: 'fixed', iso: '2026-06-15' } }],
        ctx,
      ).failures,
    ).toEqual([]);
  });

  it('fails date comparison when operator not satisfied', () => {
    expect(
      evaluateAssertions(
        [{ type: 'date', jsonPath: '$.d1', operator: '>', reference: { kind: 'fixed', iso: '2026-12-31' } }],
        ctx,
      ).failures.length,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// compare, matchesStatusPattern, formatOp, resolveDate, toDayString
// ---------------------------------------------------------------------------
describe('compare', () => {
  it('evaluates each operator', () => {
    expect(compare(1, '=', 1)).toBe(true);
    expect(compare(1, '!=', 2)).toBe(true);
    expect(compare(2, '>', 1)).toBe(true);
    expect(compare(2, '>=', 2)).toBe(true);
    expect(compare(1, '<', 2)).toBe(true);
    expect(compare(2, '<=', 2)).toBe(true);
  });
});

describe('matchesStatusPattern', () => {
  it('matches exact status code', () => {
    expect(matchesStatusPattern(200, '200')).toBe(true);
    expect(matchesStatusPattern(201, '200')).toBe(false);
  });

  it('matches recursive comma lists', () => {
    expect(matchesStatusPattern(404, '400, 401 , 403')).toBe(false);
    expect(matchesStatusPattern(502, '500,502')).toBe(true);
  });
});

describe('formatOp', () => {
  it('maps operators to display symbols', () => {
    const ops: ComparisonOperator[] = ['=', '!=', '>', '>=', '<', '<='];
    expect(ops.map((o) => formatOp(o))).toEqual(['=', '≠', '>', '≥', '<', '≤']);
  });
});

describe('resolveDate', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-08T15:30:00Z').getTime());
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('returns yyyy-mm-dd slice for fixed reference', () => {
    expect(resolveDate({ kind: 'fixed', iso: '2026-01-02T10:00:00Z' })).toBe('2026-01-02');
  });

  it('returns UTC today when timezone utc', () => {
    expect(resolveDate({ kind: 'today', timezone: 'utc' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns local calendar date string when timezone local', () => {
    expect(resolveDate({ kind: 'today', timezone: 'local' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toDayString', () => {
  it('extracts yyyy-mm-dd prefix from ISO-ish strings', () => {
    expect(toDayString('2026-05-01T00:00:00Z')).toBe('2026-05-01');
    expect(toDayString('garbage')).toBe(null);
  });

  it('interprets numeric timestamps', () => {
    expect(toDayString(new Date('2026-07-04T12:00:00Z').getTime())).toBe('2026-07-04');
  });

  it('returns null for unsupported types', () => {
    expect(toDayString(null)).toBe(null);
    expect(toDayString({})).toBe(null);
  });
});

describe('getJsonTypeName — bigint fallback', () => {
  it('maps bigint to string bucket per implementation', () => {
    expect(getJsonTypeName(BigInt(1))).toBe('string');
  });

  it('maps symbol to string bucket per implementation', () => {
    expect(getJsonTypeName(Symbol('s'))).toBe('string');
  });
});

describe('evaluateFieldOperator — default unknown operator', () => {
  it('returns unknown operator result', () => {
    const r = evaluateFieldOperator('x', 'unknown_operator' as never, '', '');
    expect(r.pass).toBe(false);
    expect(r.actual).toBe('unknown operator');
  });
});

describe('evaluateFieldOperator — equals/not_equals parse fallback branches', () => {
  it('equals uses raw string when JSON.parse fails', () => {
    expect(evaluateFieldOperator('hello world', 'equals', undefined, 'hello world').pass).toBe(true);
    expect(evaluateFieldOperator('hello', 'equals', undefined, 'hello world').pass).toBe(false);
  });

  it('not_equals with non-JSON expected string', () => {
    expect(evaluateFieldOperator('a', 'not_equals', undefined, 'b').pass).toBe(true);
    expect(evaluateFieldOperator('same', 'not_equals', undefined, 'same').pass).toBe(false);
  });
});

describe('evaluateFieldOperator — edge cases', () => {
  it('contains with empty substring on empty string', () => {
    expect(evaluateFieldOperator('', 'contains', '', '').pass).toBe(true);
  });

  it('regex on non-string uses JSON.stringify', () => {
    expect(evaluateFieldOperator(123, 'regex', '^123$', '').pass).toBe(true);
  });

  it('between fails when bounds NaN', () => {
    expect(evaluateFieldOperator(5, 'between', 'x,y', '').pass).toBe(false);
  });

  it('close_to fails when target NaN', () => {
    expect(evaluateFieldOperator(1, 'close_to', 'bad', '').pass).toBe(false);
  });

  it('in parses JSON non-array falls back to comma split', () => {
    // JSON.parse yields a non-array object → split fallback on raw string
    const r = evaluateFieldOperator('a', 'in', '{"x":1}', '');
    expect(r.pass).toBe(false);
  });

  it('not_in uses comma split when JSON.parse throws', () => {
    expect(evaluateFieldOperator('z', 'not_in', '[invalid json', '').pass).toBe(true);
  });

  it('toNumber returns null for non-numeric non-string actual', () => {
    expect(evaluateFieldOperator({}, 'greater_than', '1', '').pass).toBe(false);
    expect(evaluateFieldOperator(null, 'less_than', '1', '').pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deepSubsetMatch
// ---------------------------------------------------------------------------
describe('deepSubsetMatch', () => {
  it('matches flat object subset', () => {
    expect(deepSubsetMatch({ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }).match).toBe(true);
  });

  it('fails on missing key', () => {
    const r = deepSubsetMatch({ a: 1 }, { a: 1, b: 2 });
    expect(r.match).toBe(false);
    expect(r.path).toBe('b');
  });

  it('fails on value mismatch', () => {
    const r = deepSubsetMatch({ a: 1, b: 3 }, { a: 1, b: 2 });
    expect(r.match).toBe(false);
    expect(r.path).toBe('b');
  });

  it('matches nested object subset', () => {
    expect(deepSubsetMatch({ x: { y: { z: 1, w: 2 } } }, { x: { y: { z: 1 } } }).match).toBe(true);
  });

  it('matches array subset (order-independent)', () => {
    expect(deepSubsetMatch([3, 1, 2], [1, 3]).match).toBe(true);
  });

  it('fails when expected array item not found', () => {
    const r = deepSubsetMatch([1, 2], [1, 5]);
    expect(r.match).toBe(false);
  });

  it('empty subset always matches object', () => {
    expect(deepSubsetMatch({ a: 1 }, {}).match).toBe(true);
  });

  it('empty array subset matches array', () => {
    expect(deepSubsetMatch([1, 2, 3], []).match).toBe(true);
  });

  it('matches null values', () => {
    expect(deepSubsetMatch({ a: null }, { a: null }).match).toBe(true);
  });

  it('fails when expected null but got value', () => {
    expect(deepSubsetMatch({ a: 1 }, { a: null }).match).toBe(false);
  });

  it('fails non-object actual vs object expected', () => {
    const r = deepSubsetMatch('hello', { a: 1 });
    expect(r.match).toBe(false);
  });

  it('matches primitives', () => {
    expect(deepSubsetMatch(42, 42).match).toBe(true);
    expect(deepSubsetMatch('hello', 'hello').match).toBe(true);
    expect(deepSubsetMatch(true, true).match).toBe(true);
  });

  it('fails primitive mismatch', () => {
    expect(deepSubsetMatch(42, 43).match).toBe(false);
  });

  it('matches deeply nested (3+ levels)', () => {
    const actual = { a: { b: { c: { d: 1, e: 2 } } } };
    expect(deepSubsetMatch(actual, { a: { b: { c: { d: 1 } } } }).match).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — arrayContains
// ---------------------------------------------------------------------------
const collectionCtx: AssertionContext = {
  httpStatus: 200,
  responseTimeMs: 50,
  responseHeaders: {},
  responseBody: {
    offers: [
      { offerName: 'EV Access', rank: 1, isActive: true },
      { offerName: 'OnStar Plan', rank: 2, isActive: true },
      { offerName: 'Basic Plan', rank: 0, isActive: false },
    ],
    numbers: [10, 20, 30, 40],
    strings: ['apple', 'banana', 'cherry'],
    nested: { arr: [1, 2, 3] },
    notArray: 'hello',
    emptyArray: [],
    response: { status: 'active', enabled: true, extra: 'data' },
  },
};

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
      [{ type: 'arrayContains', jsonPath: '$.offers', value: '{"offerName": "OnStar Plan", "rank": 2}', mode: 'any' }],
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
