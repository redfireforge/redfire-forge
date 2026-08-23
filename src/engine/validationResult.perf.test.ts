import { describe, it, expect } from 'vitest';
import { buildValidationResult } from './validationResult';
import type { ValidationInput } from './validationResult';
import type { Assertion, ExpectedField, ValidationConfig } from '@shared/types';

const SHOULD_RUN = process.env.PERF === '1';

const BODY_STR = JSON.stringify({
  data: {
    id: 'abc123def456',
    name: 'Test User',
    count: 42,
    active: true,
    email: 'user@example.com',
    role: 'admin',
    score: 95.5,
    tags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
    items: [
      { name: 'Widget A', price: 9.99 },
      { name: 'Widget B', price: 19.99 },
      { name: 'Widget C', price: 29.99 },
      { name: 'Widget D', price: 39.99 },
      { name: 'Widget E', price: 49.99 },
    ],
    metadata: { version: '1.0', region: 'us-east' },
    timestamp: '2024-01-01T00:00:00Z',
  },
});
const BODY_OBJ = JSON.parse(BODY_STR);

const RESPONSE_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'x-request-id': 'abc-123',
};

const PRIMARY_ASSERTIONS: Assertion[] = [
  { type: 'status', expected: '200' },
  { type: 'responseTime', maxMs: 500 },
  { type: 'numeric', jsonPath: '$.data.count', operator: '>', value: 0 },
  { type: 'regex', jsonPath: '$.data.id', pattern: '^[a-f0-9]+$' },
  { type: 'existence', jsonPath: '$.data.name', expectExists: true },
];

const PRIMARY_ASSERTIONS_NO_STATUS = PRIMARY_ASSERTIONS.filter(a => a.type !== 'status');

const SELECTIVE_FIELDS: ExpectedField[] = [
  { jsonPath: '$.data.active', expectedValue: 'true', operator: 'equals' },
  { jsonPath: '$.data.role', expectedValue: 'admin', operator: 'equals' },
  { jsonPath: '$.data.score', expectedValue: '95.5', operator: 'greater_than_or_equal' },
  { jsonPath: '$.data.email', expectedValue: 'example', operator: 'contains' },
];

const SELECTIVE_CONFIG: ValidationConfig = {
  mode: 'selective',
  expectedFields: SELECTIVE_FIELDS,
  assertions: PRIMARY_ASSERTIONS,
};

function makeInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
  return {
    httpStatus: 200,
    responseTimeMs: 45.0,
    responseHeaders: {},
    responseBody: BODY_STR,
    responseObj: BODY_OBJ,
    validation: SELECTIVE_CONFIG,
    assertions: PRIMARY_ASSERTIONS,
    ...overrides,
  };
}

function printPerf(label: string, iterations: number, elapsedMs: number) {
  const usPerIter = (elapsedMs * 1000) / iterations;
  console.log(`[PERF] ${label}: ${elapsedMs.toFixed(2)} ms total, ${usPerIter.toFixed(2)} µs/iter (${iterations} iterations)`);
}

describe.skipIf(!SHOULD_RUN)('JS Validation Performance Benchmarks', () => {
  it('Benchmark A: selective + 5 assertions (10K)', () => {
    const input = makeInput();
    const iterations = 10_000;

    for (let i = 0; i < 100; i++) buildValidationResult(input);

    const start = performance.now();
    let passCount = 0;
    for (let i = 0; i < iterations; i++) {
      const r = buildValidationResult(input);
      if (r.passed) passCount++;
    }
    const elapsed = performance.now() - start;

    expect(passCount).toBe(iterations);
    printPerf('JS Benchmark A (selective + 5 assertions)', iterations, elapsed);
  });

  it('Benchmark B: full pipeline + JSON.parse (10K)', () => {
    const iterations = 10_000;

    for (let i = 0; i < 100; i++) {
      const obj = JSON.parse(BODY_STR);
      buildValidationResult(makeInput({ responseObj: obj }));
    }

    const start = performance.now();
    let passCount = 0;
    for (let i = 0; i < iterations; i++) {
      const obj = JSON.parse(BODY_STR);
      const r = buildValidationResult(makeInput({ responseObj: obj }));
      if (r.passed) passCount++;
    }
    const elapsed = performance.now() - start;

    expect(passCount).toBe(iterations);
    printPerf('JS Benchmark B (full pipeline + JSON.parse)', iterations, elapsed);
  });

  it('Benchmark C: mixed 70/30 pass/fail (10K)', () => {
    const inputPass = makeInput();
    const inputFail = makeInput({
      httpStatus: 500,
      assertions: PRIMARY_ASSERTIONS_NO_STATUS,
    });
    const iterations = 10_000;

    for (let i = 0; i < 100; i++) {
      buildValidationResult(i % 10 < 7 ? inputPass : inputFail);
    }

    const start = performance.now();
    let passCount = 0;
    let failCount = 0;
    for (let i = 0; i < iterations; i++) {
      const r = buildValidationResult(i % 10 < 7 ? inputPass : inputFail);
      if (r.passed) passCount++; else failCount++;
    }
    const elapsed = performance.now() - start;

    expect(passCount).toBe(7000);
    expect(failCount).toBe(3000);
    printPerf('JS Benchmark C (mixed 70/30 pass/fail)', iterations, elapsed);
  });

  it('Benchmark D: full mode — deep compare (5K)', () => {
    const input = makeInput({
      validation: {
        mode: 'full',
        expectedJson: BODY_STR,
        assertions: [
          { type: 'status', expected: '200' },
          { type: 'responseTime', maxMs: 500 },
        ],
      },
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'responseTime', maxMs: 500 },
      ],
    });
    const iterations = 5_000;

    for (let i = 0; i < 100; i++) buildValidationResult(input);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const r = buildValidationResult(input);
      expect(r.passed).toBe(true);
    }
    const elapsed = performance.now() - start;

    printPerf('JS Benchmark D (full mode — deep compare)', iterations, elapsed);
  });

  it('Benchmark E: heavy assertions — schema+subset+each (2K)', () => {
    const schema = JSON.stringify({
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          required: ['id', 'count'],
          properties: { id: { type: 'string' }, count: { type: 'number' } },
        },
      },
    });
    const heavyAssertions: Assertion[] = [
      { type: 'jsonSchema', schema },
      { type: 'containsSubset', jsonPath: '$.data', expected: '{"active":true,"role":"admin"}' },
      { type: 'each', jsonPath: '$.data.items', fieldPath: 'price', operator: 'greater_than', value: '0' },
      { type: 'arrayContains', jsonPath: '$.data.tags', value: 'alpha', mode: 'any' },
      { type: 'arrayLength', jsonPath: '$.data.tags', operator: '=', value: 5 },
    ];
    const input = makeInput({
      validation: { mode: 'none', assertions: heavyAssertions },
      assertions: heavyAssertions,
    });
    const iterations = 2_000;

    for (let i = 0; i < 100; i++) buildValidationResult(input);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const r = buildValidationResult(input);
      expect(r.passed).toBe(true);
    }
    const elapsed = performance.now() - start;

    printPerf('JS Benchmark E (heavy assertions)', iterations, elapsed);
  });

  it('Benchmark F: selective + unorderedArrays (5K)', () => {
    const input = makeInput({
      validation: {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$.data.items[0].name', expectedValue: 'Widget C', operator: 'equals' },
          { jsonPath: '$.data.items[0].price', expectedValue: '29.99', operator: 'equals' },
          { jsonPath: '$.data.items[1].name', expectedValue: 'Widget A', operator: 'equals' },
        ],
        assertions: [
          { type: 'status', expected: '200' },
          { type: 'responseTime', maxMs: 500 },
        ],
      },
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'responseTime', maxMs: 500 },
      ],
    });
    const iterations = 5_000;

    for (let i = 0; i < 100; i++) buildValidationResult(input);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const r = buildValidationResult(input);
      expect(r.passed).toBe(true);
    }
    const elapsed = performance.now() - start;

    printPerf('JS Benchmark F (selective + unorderedArrays)', iterations, elapsed);
  });

  it('Benchmark G: header+date+typeCheck+bodySize+datePrecise (5K)', () => {
    const gAssertions: Assertion[] = [
      { type: 'header', name: 'content-type', operator: 'contains', value: 'json' },
      { type: 'date', jsonPath: '$.data.timestamp', operator: '<=', reference: { kind: 'fixed', iso: '2025-01-01' } },
      { type: 'typeCheck', jsonPath: '$.data.count', expectedType: 'number' },
      { type: 'bodySize', operator: '<', value: 10, unit: 'kb' },
      { type: 'datePrecise', jsonPath: '$.data.timestamp', operator: '<=', reference: '2025-01-01T00:00:00Z', precision: 'day' },
    ];
    const input = makeInput({
      responseHeaders: RESPONSE_HEADERS,
      validation: { mode: 'none', assertions: gAssertions },
      assertions: gAssertions,
    });
    const iterations = 5_000;

    for (let i = 0; i < 100; i++) buildValidationResult(input);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const r = buildValidationResult(input);
      expect(r.passed).toBe(true);
    }
    const elapsed = performance.now() - start;

    printPerf('JS Benchmark G (header+date+typeCheck+bodySize+datePrecise)', iterations, elapsed);
  });
});
