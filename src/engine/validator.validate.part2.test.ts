import { describe, it, expect } from 'vitest';
import { validate, evaluateFieldOperator, evaluateAssertions, getJsonTypeName } from './validator';
// ---------------------------------------------------------------------------
// validate — mode: 'none'
// ---------------------------------------------------------------------------
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
import { baseCtx } from './validator.validate.test-utils';

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