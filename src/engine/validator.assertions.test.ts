import { describe, it, expect } from 'vitest';
import {
  evaluateAssertions,
  matchesStatusPattern,
  compare,
  resolveDate,
  toDayString,
  formatOp,
} from './validator';
import type { Assertion } from '../shared/types';

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
describe('evaluateAssertions — date', () => {
  const todayUTC = new Date().toISOString().slice(0, 10);

  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseHeaders: {},
    responseBody: {
      createdAt: '2024-06-15T10:30:00Z',
      expiresAt: '2025-01-01',
      pastDate: '2020-01-01',
      futureDate: '2099-12-31',
      today: todayUTC + 'T00:00:00Z',
      name: 'Alice',
      ts: 1704067200000, // 2024-01-01T00:00:00Z
    },
  };

  it('passes: fixed date equals', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.createdAt', operator: '=', reference: { kind: 'fixed', iso: '2024-06-15' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: after fixed date', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'fixed', iso: '2024-12-31' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: before fixed date', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.pastDate', operator: '>', reference: { kind: 'fixed', iso: '2024-12-31' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toBe('2020-01-01');
  });

  it('passes: today reference equals', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.today', operator: '=', reference: { kind: 'today', timezone: 'utc' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: future date > today', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.futureDate', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: past date > today', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.pastDate', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
  });

  it('passes: != operator', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.createdAt', operator: '!=', reference: { kind: 'fixed', iso: '2024-12-31' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('fails: not a date string', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.name', operator: '=', reference: { kind: 'fixed', iso: '2024-01-01' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toContain('not a date');
  });

  it('fails: path missing', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.missing', operator: '=', reference: { kind: 'today', timezone: 'utc' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].actual).toBe('undefined');
  });

  it('passes: date-only string', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.expiresAt', operator: '=', reference: { kind: 'fixed', iso: '2025-01-01' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: unix timestamp', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.ts', operator: '=', reference: { kind: 'fixed', iso: '2024-01-01' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });

  it('passes: <= operator', () => {
    const r = evaluateAssertions(
      [{ type: 'date', jsonPath: '$.createdAt', operator: '<=', reference: { kind: 'fixed', iso: '2024-06-15' } }],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions — mixed structured assertions
// ---------------------------------------------------------------------------
describe('evaluateAssertions — mixed structured assertions', () => {
  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseHeaders: { 'content-type': 'application/json' },
    responseBody: {
      items: [1, 2, 3],
      price: 19.99,
      createdAt: '2024-06-15',
    },
  };

  it('all pass together', () => {
    const r = evaluateAssertions(
      [
        { type: 'status', expected: '200' },
        { type: 'header', name: 'content-type', operator: 'contains', value: 'json' },
        { type: 'arrayLength', jsonPath: '$.items', operator: '>=', value: 1 },
        { type: 'numeric', jsonPath: '$.price', operator: '>', value: 0 },
        { type: 'date', jsonPath: '$.createdAt', operator: '=', reference: { kind: 'fixed', iso: '2024-06-15' } },
      ] as Assertion[],
      ctx,
    );
    expect(r.failures).toHaveLength(0);
    expect(r.statusAsserted).toBe(true);
  });

  it('partial failures report correct details', () => {
    const r = evaluateAssertions(
      [
        { type: 'status', expected: '200' },
        { type: 'arrayLength', jsonPath: '$.items', operator: '>', value: 10 },
        { type: 'numeric', jsonPath: '$.price', operator: '<', value: 5 },
        { type: 'date', jsonPath: '$.createdAt', operator: '>', reference: { kind: 'fixed', iso: '2025-01-01' } },
      ] as Assertion[],
      ctx,
    );
    expect(r.failures).toHaveLength(3);
    expect(r.failures.map(f => f.path)).toEqual([
      '(arrayLength:$.items)',
      '(numeric:$.price)',
      '(date:$.createdAt)',
    ]);
    expect(r.statusAsserted).toBe(true);
  });

  it('header assertion with invalid regex pattern', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: { 'content-type': 'application/json' },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'regex', value: '[invalid(' }],
      ctx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });

  it('header assertion with unknown operator', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: { 'content-type': 'application/json' },
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'unknown' as 'equals', value: 'test' }],
      ctx
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('unknown operator');
  });

  it('header regex assertion with missing header', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: {},
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-custom', operator: 'regex', value: '.*' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });

  it('header contains assertion with missing header', () => {
    const ctx = {
      httpStatus: 200,
      responseTimeMs: 50,
      responseBody: {},
      responseHeaders: {},
    };
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-custom', operator: 'contains', value: 'test' }],
      ctx
    );
    expect(failures).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions – jsonSchema
// ---------------------------------------------------------------------------
describe('evaluateAssertions – jsonSchema', () => {
  const baseCtx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseHeaders: { 'content-type': 'application/json' },
  };

  it('passes when response matches schema', () => {
    const schema = JSON.stringify({
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { id: 1, name: 'Alice' } },
    );
    expect(failures).toHaveLength(0);
  });

  it('fails on missing required field', () => {
    const schema = JSON.stringify({
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { id: 1 } },
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some(f => f.path.includes('jsonSchema'))).toBe(true);
  });

  it('fails on wrong type', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        age: { type: 'integer' },
      },
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { age: 'not-a-number' } },
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some(f => f.actual.includes('type'))).toBe(true);
  });

  it('fails on additional properties when forbidden', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: { id: { type: 'integer' } },
      additionalProperties: false,
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { id: 1, extra: 'nope' } },
    );
    expect(failures.length).toBeGreaterThan(0);
  });

  it('validates string format (email pass)', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { email: 'alice@example.com' } },
    );
    expect(failures).toHaveLength(0);
  });

  it('validates string format (email fail)', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { email: 'not-an-email' } },
    );
    expect(failures.length).toBeGreaterThan(0);
  });

  it('fails gracefully on invalid schema JSON', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema: '{ broken json' }],
      { ...baseCtx, responseBody: {} },
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(jsonSchema#0)');
    expect(failures[0].expected).toBe('valid JSON Schema');
  });

  it('empty schema {} always passes (any value is valid)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema: '{}' }],
      { ...baseCtx, responseBody: { anything: [1, 2, 3] } },
    );
    expect(failures).toHaveLength(0);
  });

  it('validates nested object schema', () => {
    const schema = JSON.stringify({
      type: 'object',
      required: ['address'],
      properties: {
        address: {
          type: 'object',
          required: ['city', 'zip'],
          properties: {
            city: { type: 'string' },
            zip: { type: 'string' },
          },
        },
      },
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { address: { city: 'NYC' } } },
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some(f => f.path.includes('/address'))).toBe(true);
  });

  it('validates array items schema', () => {
    const schema = JSON.stringify({
      type: 'array',
      items: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
    });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: [{ id: 1 }, { id: 'oops' }] },
    );
    expect(failures.length).toBeGreaterThan(0);
  });

  it('validates enum constraint', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
    });
    const pass = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { status: 'active' } },
    );
    expect(pass.failures).toHaveLength(0);

    const fail = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { status: 'deleted' } },
    );
    expect(fail.failures.length).toBeGreaterThan(0);
  });

  it('validates minimum/maximum constraints', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        score: { type: 'number', minimum: 0, maximum: 100 },
      },
    });
    const pass = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { score: 50 } },
    );
    expect(pass.failures).toHaveLength(0);

    const fail = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { score: 150 } },
    );
    expect(fail.failures.length).toBeGreaterThan(0);
  });

  it('caps errors at 10 for large schemas', () => {
    const properties: Record<string, { type: string }> = {};
    const required: string[] = [];
    for (let i = 0; i < 20; i++) {
      properties[`field_${i}`] = { type: 'integer' };
      required.push(`field_${i}`);
    }
    const schema = JSON.stringify({ type: 'object', properties, required });
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: {} },
    );
    expect(failures.length).toBeLessThanOrEqual(10);
  });

  it('validates date-time format', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
      },
    });
    const pass = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { createdAt: '2024-01-15T10:30:00Z' } },
    );
    expect(pass.failures).toHaveLength(0);

    const fail = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { createdAt: 'not-a-date' } },
    );
    expect(fail.failures.length).toBeGreaterThan(0);
  });

  it('validates uri format', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        website: { type: 'string', format: 'uri' },
      },
    });
    const pass = evaluateAssertions(
      [{ type: 'jsonSchema', schema }],
      { ...baseCtx, responseBody: { website: 'https://example.com' } },
    );
    expect(pass.failures).toHaveLength(0);
  });

  it('disambiguates multiple jsonSchema assertions via indexed paths', () => {
    const passingSchema = JSON.stringify({ type: 'object' });
    const failingSchema = JSON.stringify({
      type: 'object',
      required: ['missing_field'],
      properties: { missing_field: { type: 'string' } },
      additionalProperties: false,
    });
    const { failures } = evaluateAssertions(
      [
        { type: 'jsonSchema', schema: passingSchema },
        { type: 'jsonSchema', schema: failingSchema },
      ],
      { ...baseCtx, responseBody: { id: 1 } },
    );
    const schema0Failures = failures.filter(f => f.path.startsWith('(jsonSchema#0'));
    const schema1Failures = failures.filter(f => f.path.startsWith('(jsonSchema#1'));
    expect(schema0Failures).toHaveLength(0);
    expect(schema1Failures.length).toBeGreaterThan(0);
  });

  it('indexes compile errors per assertion', () => {
    const { failures } = evaluateAssertions(
      [
        { type: 'jsonSchema', schema: '{}' },
        { type: 'jsonSchema', schema: '{bad' },
      ],
      { ...baseCtx, responseBody: {} },
    );
    const schema0Failures = failures.filter(f => f.path.startsWith('(jsonSchema#0'));
    const schema1Failures = failures.filter(f => f.path.startsWith('(jsonSchema#1'));
    expect(schema0Failures).toHaveLength(0);
    expect(schema1Failures).toHaveLength(1);
    expect(schema1Failures[0].path).toBe('(jsonSchema#1)');
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions – bodySize
// ---------------------------------------------------------------------------
describe('evaluateAssertions – bodySize', () => {
  const smallBody = JSON.stringify({ ok: true });
  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseBody: { ok: true },
    responseHeaders: {},
    rawBody: smallBody,
  };

  it('passes when body size is within limit (bytes)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '<=', value: 1000, unit: 'bytes' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('fails when body exceeds byte limit', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '<=', value: 5, unit: 'bytes' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(bodySize)');
  });

  it('supports KB unit', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '<', value: 1, unit: 'kb' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports MB unit', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '<', value: 1, unit: 'mb' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports = operator for exact size', () => {
    const exactSize = new TextEncoder().encode(smallBody).length;
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '=', value: exactSize, unit: 'bytes' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports != operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '!=', value: 0, unit: 'bytes' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports >= operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '>=', value: 1, unit: 'bytes' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports > operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '>', value: 0, unit: 'bytes' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('falls back to JSON.stringify when rawBody is absent', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '>', value: 0, unit: 'bytes' }],
      { httpStatus: 200, responseTimeMs: 50, responseBody: { data: 'test' }, responseHeaders: {} },
    );
    expect(failures).toHaveLength(0);
  });

  it('handles null responseBody gracefully', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'bodySize', operator: '=', value: 0, unit: 'bytes' }],
      { httpStatus: 200, responseTimeMs: 50, responseBody: null, responseHeaders: {} },
    );
    expect(failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateAssertions – datePrecise
// ---------------------------------------------------------------------------
describe('evaluateAssertions – datePrecise', () => {
  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseBody: {
      createdAt: '2024-06-15T10:30:45.123Z',
      updatedAt: '2024-06-15T10:30:45.999Z',
      empty: null,
    },
    responseHeaders: {},
  };

  it('passes with day precision equality', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '=', reference: '2024-06-15T23:59:59Z', precision: 'day' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('fails with day precision when days differ', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '=', reference: '2024-06-16T10:30:45Z', precision: 'day' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(datePrecise:$.createdAt)');
  });

  it('passes with second precision equality', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '=', reference: '2024-06-15T10:30:45.999Z', precision: 'second' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('distinguishes by millisecond precision', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '=', reference: '2024-06-15T10:30:45.999Z', precision: 'millisecond' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('supports > (after) operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '>', reference: '2024-06-14T00:00:00Z', precision: 'day' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports < (before) operator', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '<', reference: '2024-06-16T00:00:00Z', precision: 'day' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports hour precision', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '=', reference: '2024-06-15T10:59:59Z', precision: 'hour' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports minute precision', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '=', reference: '2024-06-15T10:30:59Z', precision: 'minute' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('fails when path is undefined', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.missing', operator: '=', reference: '2024-06-15T10:30:45Z', precision: 'second' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('fails for invalid date at path', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.empty', operator: '=', reference: '2024-06-15T10:30:45Z', precision: 'second' }],
      { ...ctx, responseBody: { empty: 'not-a-date' } },
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('invalid date');
  });

  it('fails for invalid reference date', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'datePrecise', jsonPath: '$.createdAt', operator: '=', reference: 'not-a-date', precision: 'second' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('invalid reference');
  });
});

// ---------------------------------------------------------------------------
// Universal negation (negate flag)
// ---------------------------------------------------------------------------
describe('evaluateAssertions — negate flag', () => {
  const ctx = {
    httpStatus: 200,
    responseTimeMs: 50,
    responseBody: { name: 'Alice', age: 30, items: [1, 2, 3] },
    responseHeaders: { 'content-type': 'application/json' },
  };

  it('negate: passing status becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'status', expected: '200', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('NOT');
  });

  it('negate: failing status becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'status', expected: '404', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: passing responseTime becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 1000, negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate: failing responseTime becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 10, negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: passing numeric becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.age', operator: '=', value: 30, negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate: failing numeric becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'numeric', jsonPath: '$.age', operator: '=', value: 99, negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: passing regex becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.name', pattern: 'Alice', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate: failing regex becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.name', pattern: '^Bob$', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: passing arrayLength becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '=', value: 3, negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate: failing arrayLength becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'arrayLength', jsonPath: '$.items', operator: '=', value: 10, negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: passing header becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'contains', value: 'json', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate: failing header becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'equals', value: 'text/html', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: passing typeCheck becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.name', expectedType: 'string', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate: failing typeCheck becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'typeCheck', jsonPath: '$.name', expectedType: 'number', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: non-negated assertions still work normally', () => {
    const { failures } = evaluateAssertions(
      [
        { type: 'status', expected: '200' },
        { type: 'numeric', jsonPath: '$.age', operator: '=', value: 30 },
      ],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: invalid regex pattern still fails (config error)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.name', pattern: '[invalid', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });

  it('negate: invalid JSON schema still fails (config error)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'jsonSchema', schema: '{not valid json', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('negate: containsSubset with invalid expected JSON still fails (config error)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'containsSubset', jsonPath: '$.name', expected: '{bad json', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toBe('valid JSON subset');
  });
});
