import { describe, it, expect } from 'vitest';
import { matchesStatusPattern, evaluateAssertions, type AssertionContext } from './validator';
import type { Assertion } from '../types';

function ctx(overrides: Partial<AssertionContext> = {}): AssertionContext {
  return {
    httpStatus: 200,
    responseTimeMs: 150,
    responseHeaders: { 'content-type': 'application/json; charset=utf-8', 'x-request-id': 'abc-123' },
    responseBody: { name: 'Alice', age: 30, items: [1, 2, 3] },
    ...overrides,
  };
}

describe('matchesStatusPattern', () => {
  it('matches exact status code', () => {
    expect(matchesStatusPattern(200, '200')).toBe(true);
    expect(matchesStatusPattern(201, '200')).toBe(false);
    expect(matchesStatusPattern(404, '404')).toBe(true);
  });

  it('matches class pattern (Nxx)', () => {
    expect(matchesStatusPattern(200, '2xx')).toBe(true);
    expect(matchesStatusPattern(201, '2xx')).toBe(true);
    expect(matchesStatusPattern(299, '2xx')).toBe(true);
    expect(matchesStatusPattern(301, '2xx')).toBe(false);
    expect(matchesStatusPattern(404, '4xx')).toBe(true);
    expect(matchesStatusPattern(500, '5xx')).toBe(true);
  });

  it('matches range pattern', () => {
    expect(matchesStatusPattern(200, '200-299')).toBe(true);
    expect(matchesStatusPattern(299, '200-299')).toBe(true);
    expect(matchesStatusPattern(300, '200-299')).toBe(false);
    expect(matchesStatusPattern(201, '200 - 204')).toBe(true);
  });

  it('matches comma-separated list', () => {
    expect(matchesStatusPattern(200, '200,201,204')).toBe(true);
    expect(matchesStatusPattern(204, '200,201,204')).toBe(true);
    expect(matchesStatusPattern(400, '200,201,204')).toBe(false);
  });

  it('matches mixed patterns', () => {
    expect(matchesStatusPattern(200, '2xx,301')).toBe(true);
    expect(matchesStatusPattern(301, '2xx,301')).toBe(true);
    expect(matchesStatusPattern(404, '2xx,301')).toBe(false);
  });

  it('handles whitespace', () => {
    expect(matchesStatusPattern(200, ' 200 ')).toBe(true);
    expect(matchesStatusPattern(200, ' 2xx ')).toBe(true);
  });
});

describe('evaluateAssertions — status', () => {
  it('passes when status matches', () => {
    const { failures, statusAsserted } = evaluateAssertions(
      [{ type: 'status', expected: '200' }],
      ctx(),
    );
    expect(failures).toEqual([]);
    expect(statusAsserted).toBe(true);
  });

  it('fails when status does not match', () => {
    const { failures, statusAsserted } = evaluateAssertions(
      [{ type: 'status', expected: '201' }],
      ctx(),
    );
    expect(statusAsserted).toBe(true);
    expect(failures).toEqual([{ path: '(status)', expected: '201', actual: '200' }]);
  });

  it('supports class pattern (4xx)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'status', expected: '4xx' }],
      ctx({ httpStatus: 404 }),
    );
    expect(failures).toEqual([]);
  });

  it('allows asserting error status codes', () => {
    const { failures, statusAsserted } = evaluateAssertions(
      [{ type: 'status', expected: '404' }],
      ctx({ httpStatus: 404 }),
    );
    expect(failures).toEqual([]);
    expect(statusAsserted).toBe(true);
  });
});

describe('evaluateAssertions — responseTime', () => {
  it('passes when under threshold', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 500 }],
      ctx({ responseTimeMs: 150 }),
    );
    expect(failures).toEqual([]);
  });

  it('passes at exact threshold', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 150 }],
      ctx({ responseTimeMs: 150 }),
    );
    expect(failures).toEqual([]);
  });

  it('fails when over threshold', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 100 }],
      ctx({ responseTimeMs: 150 }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(responseTime)');
    expect(failures[0].expected).toBe('≤ 100ms');
    expect(failures[0].actual).toBe('150ms');
  });
});

describe('evaluateAssertions — header', () => {
  it('equals operator matches exactly', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-request-id', operator: 'equals' as const, value: 'abc-123' }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('equals operator is case-insensitive on header name', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'X-Request-ID', operator: 'equals' as const, value: 'abc-123' }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('equals operator fails on mismatch', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-request-id', operator: 'equals' as const, value: 'xyz' }],
      ctx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(header:x-request-id)');
  });

  it('contains operator matches substring', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'contains' as const, value: 'json' }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('contains operator fails when not found', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'content-type', operator: 'contains' as const, value: 'xml' }],
      ctx(),
    );
    expect(failures).toHaveLength(1);
  });

  it('exists operator passes when header present', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'Content-Type', operator: 'exists' as const }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('exists operator fails when header missing', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-custom', operator: 'exists' as const }],
      ctx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toBe('header exists');
  });

  it('regex operator matches pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-request-id', operator: 'regex' as const, value: '^abc-\\d+$' }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('regex operator fails on invalid pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'header', name: 'x-request-id', operator: 'regex' as const, value: '[invalid' }],
      ctx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });
});

describe('evaluateAssertions — regex on JSON path', () => {
  it('matches string value against pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.name', pattern: '^[A-Z][a-z]+$' }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('fails when pattern does not match', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.name', pattern: '^\\d+$' }],
      ctx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(regex:$.name)');
    expect(failures[0].expected).toBe('matches /^\\d+$/');
    expect(failures[0].actual).toBe('Alice');
  });

  it('handles non-string values (serializes to JSON)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.age', pattern: '30' }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('handles undefined path gracefully', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.nonExistent', pattern: '^[A-Z]' }],
      ctx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('undefined');
  });

  it('handles array path', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.items', pattern: '\\[1,2,3\\]' }],
      ctx(),
    );
    expect(failures).toEqual([]);
  });

  it('reports invalid regex pattern', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'regex', jsonPath: '$.name', pattern: '[invalid' }],
      ctx(),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('invalid regex pattern');
  });
});

describe('evaluateAssertions — multiple assertions', () => {
  it('runs all assertions and collects all failures', () => {
    const assertions: Assertion[] = [
      { type: 'status', expected: '201' },
      { type: 'responseTime', maxMs: 100 },
      { type: 'header', name: 'x-missing', operator: 'exists' },
    ];
    const { failures, statusAsserted } = evaluateAssertions(assertions, ctx());
    expect(statusAsserted).toBe(true);
    expect(failures).toHaveLength(3);
    expect(failures.map(f => f.path)).toEqual(['(status)', '(responseTime)', '(header:x-missing)']);
  });

  it('returns empty failures when all pass', () => {
    const assertions: Assertion[] = [
      { type: 'status', expected: '2xx' },
      { type: 'responseTime', maxMs: 1000 },
      { type: 'header', name: 'content-type', operator: 'contains', value: 'json' },
      { type: 'regex', jsonPath: '$.name', pattern: 'Alice' },
    ];
    const { failures } = evaluateAssertions(assertions, ctx());
    expect(failures).toEqual([]);
  });

  it('statusAsserted is false when no status assertion', () => {
    const { statusAsserted } = evaluateAssertions(
      [{ type: 'responseTime', maxMs: 1000 }],
      ctx(),
    );
    expect(statusAsserted).toBe(false);
  });
});
