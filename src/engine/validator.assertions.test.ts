import { describe, it, expect } from 'vitest';
import {
  evaluateAssertions,
  matchesStatusPattern,
  compare,
  resolveDate,
  toDayString,
  formatOp,
} from './validator';
import type { Assertion } from '@shared/types';

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

// ---------------------------------------------------------------------------
// Additional branch coverage tests
// ---------------------------------------------------------------------------

describe('evaluateAssertions – header operator edge cases', () => {
  const baseCtx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseBody: {},
    responseHeaders: { 'X-Custom': 'hello-world' },
  };

  it('header contains operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'X-Custom', operator: 'contains', value: 'hello' } as Assertion],
      baseCtx
    );
    expect(failures).toHaveLength(0);
  });

  it('header contains fails when header missing', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'Missing', operator: 'contains', value: 'x' } as Assertion],
      baseCtx
    );
    expect(failures).toHaveLength(1);
  });

  it('header regex operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'X-Custom', operator: 'regex', value: 'hello.*' } as Assertion],
      baseCtx
    );
    expect(failures).toHaveLength(0);
  });

  it('header regex with invalid pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'X-Custom', operator: 'regex', value: '[invalid' } as Assertion],
      baseCtx
    );
    expect(failures).toHaveLength(1);
  });

  it('header unknown operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'X-Custom', operator: 'unknown-op', value: 'x' } as Assertion],
      baseCtx
    );
    expect(failures).toHaveLength(1);
  });

  it('header regex fails when header missing', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'Missing', operator: 'regex', value: '.*' } as Assertion],
      baseCtx
    );
    expect(failures).toHaveLength(1);
  });

  it('regex assertion with invalid regex pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$', pattern: '[invalid' } as Assertion],
      baseCtx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('invalid regex');
  });

  it('regex assertion with non-string value uses JSON.stringify', () => {
    const ctx = { ...baseCtx, responseBody: { count: 42 } };
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: 'count', pattern: '^42$' } as Assertion],
      ctx
    );
    expect(failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// compare()
// ---------------------------------------------------------------------------
describe('compare()', () => {
  it('= returns true for equal values', () => {
    expect(compare(5, '=', 5)).toBe(true);
  });

  it('= returns false for unequal values', () => {
    expect(compare(5, '=', 6)).toBe(false);
  });

  it('!= returns true for unequal values', () => {
    expect(compare(5, '!=', 6)).toBe(true);
  });

  it('!= returns false for equal values', () => {
    expect(compare(5, '!=', 5)).toBe(false);
  });

  it('> returns false at boundary', () => {
    expect(compare(5, '>', 5)).toBe(false);
  });

  it('> returns true when greater', () => {
    expect(compare(6, '>', 5)).toBe(true);
  });

  it('>= returns true at boundary', () => {
    expect(compare(5, '>=', 5)).toBe(true);
  });

  it('< returns false at boundary', () => {
    expect(compare(5, '<', 5)).toBe(false);
  });

  it('< returns true when less', () => {
    expect(compare(4, '<', 5)).toBe(true);
  });

  it('<= returns true at boundary', () => {
    expect(compare(5, '<=', 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toDayString()
// ---------------------------------------------------------------------------
describe('toDayString()', () => {
  it('extracts day from ISO string', () => {
    expect(toDayString('2024-12-31T10:00:00Z')).toBe('2024-12-31');
  });

  it('handles date-only string', () => {
    expect(toDayString('2024-12-31')).toBe('2024-12-31');
  });

  it('converts unix timestamp (ms)', () => {
    // 2024-01-01T00:00:00Z
    expect(toDayString(1704067200000)).toBe('2024-01-01');
  });

  it('returns null for non-date string', () => {
    expect(toDayString('hello')).toBe(null);
  });

  it('returns null for null/undefined', () => {
    expect(toDayString(null)).toBe(null);
    expect(toDayString(undefined)).toBe(null);
  });

  it('returns null for object', () => {
    expect(toDayString({ date: '2024-01-01' })).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// resolveDate()
// ---------------------------------------------------------------------------
describe('resolveDate()', () => {
  it('returns fixed ISO date truncated to day', () => {
    expect(resolveDate({ kind: 'fixed', iso: '2024-06-15T12:30:00Z' })).toBe('2024-06-15');
  });

  it('returns fixed date-only string as-is', () => {
    expect(resolveDate({ kind: 'fixed', iso: '2024-06-15' })).toBe('2024-06-15');
  });

  it('returns today UTC as YYYY-MM-DD', () => {
    const result = resolveDate({ kind: 'today', timezone: 'utc' });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe(new Date().toISOString().slice(0, 10));
  });

  it('returns today local as YYYY-MM-DD', () => {
    const result = resolveDate({ kind: 'today', timezone: 'local' });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// formatOp()
// ---------------------------------------------------------------------------
describe('formatOp()', () => {
  it('maps all operators', () => {
    expect(formatOp('=')).toBe('=');
    expect(formatOp('!=')).toBe('≠');
    expect(formatOp('>')).toBe('>');
    expect(formatOp('>=')).toBe('≥');
    expect(formatOp('<')).toBe('<');
    expect(formatOp('<=')).toBe('≤');
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — arrayLength
// ---------------------------------------------------------------------------
describe('evaluateAssertions — arrayLength', () => {
  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseHeaders: {},
    responseBody: {
      items: [1, 2, 3],
      name: 'Alice',
      nested: { results: [{ id: 1 }, { id: 2 }] },
      empty: [],
    },
  };

  it('passes: array length = 3', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '=', value: 3 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: array length >= 2', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '>=', value: 2 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: array length < 10', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '<', value: 10 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: array length > 5', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '>', value: 5 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].path).toBe('(arrayLength:$.items)');
    expect(r.failures[0].actual).toBe('length 3');
  });

  it('fails: not an array', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.name', operator: '=', value: 1 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toContain('not an array');
  });

  it('fails: path not found', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.missing', operator: '=', value: 0 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toBe('undefined');
  });

  it('passes: empty array = 0', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.empty', operator: '=', value: 0 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: nested array path', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.nested.results', operator: '=', value: 2 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: != operator when equal', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '!=', value: 3 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
  });

  it('passes: != operator when not equal', () => {
    const r = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '!=', value: 5 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — numeric
// ---------------------------------------------------------------------------
describe('evaluateAssertions — numeric', () => {
  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseHeaders: {},
    responseBody: {
      price: 19.99,
      count: 5,
      zero: 0,
      negative: -5,
      strNum: '42.5',
      strBad: 'abc',
      name: 'Alice',
    },
  };

  it('passes: equals', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.price', operator: '=', value: 19.99 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: greater than', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.price', operator: '>', value: 10 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: less than or equal', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.count', operator: '<=', value: 5 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: less than at boundary', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.count', operator: '<', value: 5 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toBe('5');
  });

  it('passes: not equals', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.count', operator: '!=', value: 0 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: path missing', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.missing', operator: '=', value: 0 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toBe('undefined');
  });

  it('passes: zero value', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.zero', operator: '=', value: 0 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: negative number', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.negative', operator: '<', value: 0 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: string-encoded number', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.strNum', operator: '=', value: 42.5 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: string-encoded NaN', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.strBad', operator: '=', value: 0 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toContain('not a number');
  });

  it('passes: >= at boundary', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.count', operator: '>=', value: 5 }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: > at boundary', () => {
    const r = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.count', operator: '>', value: 5 }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — date
// ---------------------------------------------------------------------------