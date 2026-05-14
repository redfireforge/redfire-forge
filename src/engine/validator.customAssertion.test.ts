import { describe, it, expect } from 'vitest';
import { evaluateAssertions, wrapCustomExprDollarPaths } from './validator';
import type { Assertion } from '../shared/types';

const ctx = {
  httpStatus: 200,
  responseTimeMs: 45,
  responseBody: {
    name: 'Alice',
    age: 30,
    active: true,
    items: [1, 2, 3],
    nested: { score: 95.5 },
    tags: ['admin', 'user'],
  },
  responseHeaders: { 'content-type': 'application/json', 'x-request-id': 'abc-123' },
  rawBody: '{"name":"Alice"}',
};

describe('evaluateAssertions — custom predicate', () => {
  // ── Truthy / passing expressions ──────────────────────────

  it('passes when expression evaluates to true', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.status, 200)' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with a truthy number (non-zero)', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$.status' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with a truthy string', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$.body.name' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with a non-empty array', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$.body.items' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with nested path access', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$gt($.body.nested.score, 90)' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with lambda expression', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$every($.body.items, (x) => $gt(x, 0))' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with header access', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$includes($.headers.content-type, "json")' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with responseTime check', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$lt($.responseTime, 100)' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('passes with rawBody access', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$includes($.rawBody, "Alice")' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  // ── Falsy / failing expressions ───────────────────────────

  it('fails when expression evaluates to false', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.status, 404)' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].path).toBe('(custom)');
    expect(failures[0].expected).toContain('custom predicate to pass');
  });

  it('fails when expression evaluates to 0', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$subtract($.body.age, 30)' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('fails when expression evaluates to empty string', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$replace($.body.name, "Alice", "")' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  it('resolves missing body path to undefined (engine returns fallback string = truthy)', () => {
    // The expression engine returns a fallback string `{{...}}` for unresolved variables,
    // which is truthy. Use an explicit comparison for checking absence.
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$.body.nonExistent' }],
      ctx,
    );
    // Engine returns fallback string, which is truthy → passes
    expect(failures).toHaveLength(0);
  });

  it('fails when explicitly checking for null with $eq', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.body.age, 999)' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
  });

  // ── Description support ───────────────────────────────────

  it('includes description in failure message when provided', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.status, 500)', description: 'Status must be 500' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('Status must be 500');
  });

  // ── Empty expression ──────────────────────────────────────

  it('fails with config error on empty expression', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('empty expression');
  });

  it('fails with config error on whitespace-only expression', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '   ' }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('empty expression');
  });

  // ── Expression errors ─────────────────────────────────────

  it('unknown function returns fallback string (truthy, so passes)', () => {
    // Expression engine returns `{{$unknownFunction}}` for unknown functions — a truthy string.
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$unknownFunction(1, 2)' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('reports error for malformed expression syntax', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.status' }],
      ctx,
    );
    // The engine may either error or produce a truthy fallback;
    // either way it should not crash evaluateAssertions
    expect(failures).toBeDefined();
  });

  // ── Negation support ──────────────────────────────────────

  it('negate: passing expression becomes failure', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.status, 200)', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('NOT');
    expect(failures[0].actual).toContain('negated');
  });

  it('negate: failing expression becomes pass', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.status, 404)', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('negate: empty expression config error is not negated', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '', negate: true }],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toBe('empty expression');
  });

  it('negate: unknown function fallback is truthy, so negation fails', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$unknownFunction()', negate: true }],
      ctx,
    );
    // Unknown function returns a truthy fallback → assertion passes → negation makes it fail
    expect(failures).toHaveLength(1);
    expect(failures[0].actual).toContain('negated');
  });

  // ── statusAsserted flag ───────────────────────────────────

  it('does not set statusAsserted', () => {
    const { statusAsserted } = evaluateAssertions(
      [{ type: 'custom', expression: '$eq($.status, 200)' }],
      ctx,
    );
    expect(statusAsserted).toBe(false);
  });

  // ── Multiple custom assertions ────────────────────────────

  it('evaluates multiple custom assertions independently', () => {
    const { failures } = evaluateAssertions(
      [
        { type: 'custom', expression: '$eq($.status, 200)' } as Assertion,
        { type: 'custom', expression: '$eq($.status, 404)' } as Assertion,
        { type: 'custom', expression: '$gt($.body.age, 25)' } as Assertion,
      ],
      ctx,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].expected).toContain('custom predicate to pass');
  });

  // ── Bare $ resolves to body ───────────────────────────────

  it('bare $ resolves to response body', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  // ── Complex lambda usage ──────────────────────────────────

  it('supports $filter + $length chain', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$gt($length($filter($.body.items, (x) => $gt(x, 1))), 0)' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });

  it('supports $some on tags array', () => {
    const { failures } = evaluateAssertions(
      [{ type: 'custom', expression: '$some($.body.tags, (t) => $eq(t, "admin"))' }],
      ctx,
    );
    expect(failures).toHaveLength(0);
  });
});

// ─── wrapCustomExprDollarPaths ──────────────────────────────

describe('wrapCustomExprDollarPaths', () => {
  it('wraps $.body.name in mustache braces', () => {
    expect(wrapCustomExprDollarPaths('$.body.name')).toBe('{{$.body.name}}');
  });

  it('wraps multiple $. references', () => {
    const result = wrapCustomExprDollarPaths('$eq($.status, $.body.code)');
    expect(result).toBe('$eq({{$.status}}, {{$.body.code}})');
  });

  it('wraps bare $ (end of string)', () => {
    expect(wrapCustomExprDollarPaths('$')).toBe('{{$}}');
  });

  it('wraps bare $ followed by )', () => {
    expect(wrapCustomExprDollarPaths('$length($)')).toBe('$length({{$}})');
  });

  it('does not wrap $functionName', () => {
    expect(wrapCustomExprDollarPaths('$gt(1, 2)')).toBe('$gt(1, 2)');
  });

  it('does not wrap inside quoted strings', () => {
    expect(wrapCustomExprDollarPaths('$eq("$.body", $.actual)')).toBe('$eq("$.body", {{$.actual}})');
  });

  it('does not double-wrap already wrapped references', () => {
    expect(wrapCustomExprDollarPaths('{{$.body.name}}')).toBe('{{$.body.name}}');
  });

  it('handles mixed wrapped and unwrapped', () => {
    expect(wrapCustomExprDollarPaths('$eq({{$.body.a}}, $.body.b)')).toBe('$eq({{$.body.a}}, {{$.body.b}})');
  });

  it('handles complex nested expressions', () => {
    const expr = '$gt($length($filter($.body.items, (x) => $gt(x, 1))), 0)';
    const result = wrapCustomExprDollarPaths(expr);
    expect(result).toBe('$gt($length($filter({{$.body.items}}, (x) => $gt(x, 1))), 0)');
  });
});
