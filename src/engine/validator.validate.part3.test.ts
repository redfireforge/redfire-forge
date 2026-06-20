import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateFieldOperator, evaluateAssertions, deepSubsetMatch, getJsonTypeName, compare, matchesStatusPattern, formatOp, resolveDate, toDayString, } from './validator';
import { AssertionContext } from './validator';
import { ComparisonOperator } from '../shared/types';
import { baseCtx } from './validator.validate.test-utils';

// ---------------------------------------------------------------------------
// validate — mode: 'none'
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
      d1: '2026-06-21',
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
// collectionCtx is imported from validator.validate.test-utils
