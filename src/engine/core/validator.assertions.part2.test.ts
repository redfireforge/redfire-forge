import { describe, it, expect } from 'vitest';
import { evaluateAssertions } from './validator';
import { Assertion } from '@shared/types';

// ---------------------------------------------------------------------------
// evaluateAssertions – branch coverage for header operators
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