import { describe, it, expect } from 'vitest';
import { evaluateAssertions } from './validator';
// ---------------------------------------------------------------------------
// evaluateAssertions – branch coverage for header operators
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
