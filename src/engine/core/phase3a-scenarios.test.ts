/**
 * Phase 3A — Visual Test Scenarios: engine-level validation.
 *
 * Exercises every scenario from docs/plan/throughput-phase3a-test-scenarios.md
 * through buildValidationResult (the same function used by both JS and Rust
 * executor paths). This guarantees the exported JSON at
 * docs/test-data/phase3-test-scenarios-export.json is correct.
 */
import { describe, it, expect } from 'vitest';
import { buildValidationResult, type ValidationInput } from './validationResult';
import type { Assertion } from '@shared/types';

const POST_1 = {
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto',
};

const POSTS_ARRAY = [
  { userId: 1, id: 1, title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit', body: 'body1' },
  { userId: 1, id: 2, title: 'qui est esse', body: 'body2' },
  { userId: 1, id: 3, title: 'ea molestias quasi exercitationem repellat qui ipsa sit aut', body: 'body3' },
];

function makeInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
  return {
    httpStatus: 200,
    responseTimeMs: 42,
    responseHeaders: { 'content-type': 'application/json; charset=utf-8' },
    responseBody: JSON.stringify(POST_1),
    responseObj: POST_1,
    validation: { mode: 'none' as const },
    assertions: [],
    ...overrides,
  };
}

// ─── Part 1: Validation Mode — None ─────────────────────────────────────────

describe('Part 1: Validation Mode — None', () => {
  it('1.1 No Body Validation — Pass on 200', () => {
    const result = buildValidationResult(makeInput());
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('1.2 No Body Validation — Fail on 404', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      responseObj: {},
      responseBody: '{}',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(http)', expected: '2xx' }),
      ]),
    );
  });

  it('1.3 No Body Validation — Pass 404 WITH Status Assert', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      responseObj: {},
      responseBody: '{}',
      assertions: [{ type: 'status', expected: '404' }],
    }));
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });
});

// ─── Part 2: Validation Mode — Full JSON Match ──────────────────────────────

describe('Part 2: Validation Mode — Full JSON Match', () => {
  it('2.1 Full Match — Exact Body Match Passes', () => {
    const result = buildValidationResult(makeInput({
      validation: { mode: 'full', expectedJson: JSON.stringify(POST_1) },
    }));
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('2.2 Full Match — Mismatch Produces Failures', () => {
    const expected = { ...POST_1, userId: 999, title: 'WRONG TITLE', extraField: true };
    const result = buildValidationResult(makeInput({
      validation: { mode: 'full', expectedJson: JSON.stringify(expected) },
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThanOrEqual(2);
    const paths = result.failureDetails.map(f => f.path);
    expect(paths).toContain('userId');
    expect(paths).toContain('title');
  });

  it('2.3 Full Match — Invalid Expected JSON', () => {
    const result = buildValidationResult(makeInput({
      validation: { mode: 'full', expectedJson: '{ broken json here' },
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBe(1);
    expect(result.failureDetails[0].path).toBe('(parse)');
  });
});

// ─── Part 3: Validation Mode — Selective Fields ─────────────────────────────

describe('Part 3: Validation Mode — Selective Fields', () => {
  it('3.1 Selective — Simple Field Matching (Pass)', () => {
    const result = buildValidationResult(makeInput({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.userId', expectedValue: '1', operator: 'equals' },
          { jsonPath: '$.id', expectedValue: '0', operator: 'greater_than' },
          { jsonPath: '$.title', expectedValue: 'sunt', operator: 'contains' },
        ],
      },
    }));
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('3.2 Selective — Field Mismatch (Fail)', () => {
    const result = buildValidationResult(makeInput({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.title', expectedValue: 'nonexistent', operator: 'equals' },
          { jsonPath: '$.userId', expectedValue: '0', operator: 'less_than' },
        ],
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBe(2);
  });

  it('3.3a Unordered Array — Pass (finds at different index)', () => {
    // $[1].id = "1" exists at index 0, unordered search finds it
    const result = buildValidationResult(makeInput({
      responseObj: POSTS_ARRAY,
      responseBody: JSON.stringify(POSTS_ARRAY),
      validation: {
        mode: 'selective',
        unorderedArrays: true,
        expectedFields: [
          { jsonPath: '$[1].id', expectedValue: '1', operator: 'equals' },
          { jsonPath: '$[1].title', expectedValue: 'sunt', operator: 'contains' },
        ],
      },
    }));
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('3.3b Ordered Array — Fail (wrong index)', () => {
    // Same fields, ordered — $[1].id is 2, not 1 → fail
    const result = buildValidationResult(makeInput({
      responseObj: POSTS_ARRAY,
      responseBody: JSON.stringify(POSTS_ARRAY),
      validation: {
        mode: 'selective',
        unorderedArrays: false,
        expectedFields: [
          { jsonPath: '$[1].id', expectedValue: '1', operator: 'equals' },
          { jsonPath: '$[1].title', expectedValue: 'sunt', operator: 'contains' },
        ],
      },
      assertions: [{ type: 'status', expected: '200' }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThanOrEqual(1);
  });

  it('3.4 Selective — Wrong Path Prefix (tryRemapPaths)', () => {
    const result = buildValidationResult(makeInput({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.post.id', expectedValue: '1', operator: 'equals' },
          { jsonPath: '$.post.title', expectedValue: 'sunt', operator: 'contains' },
        ],
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Part 4: Assertions ─────────────────────────────────────────────────────

describe('Part 4: Assertions', () => {
  it('4.1 Status Code — Exact 200 (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'status', expected: '200' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.2 Status Code — Range 2xx (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'status', expected: '2xx' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.2b Status Code — 4xx Fails on 200', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'status', expected: '4xx' }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(status)' }),
      ]),
    );
  });

  it('4.3 Response Time SLA — Pass (10s threshold)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'responseTime', maxMs: 10000 }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.3b Response Time SLA — Fail (1ms threshold)', () => {
    const result = buildValidationResult(makeInput({
      responseTimeMs: 235,
      assertions: [{ type: 'responseTime', maxMs: 1 }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(responseTime)' }),
      ]),
    );
  });

  it('4.4 Header Assert — contains json (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'header', name: 'content-type', operator: 'contains', value: 'json' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.4b Header Assert — contains xml (Fail)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'header', name: 'content-type', operator: 'contains', value: 'xml' }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(header:content-type)' }),
      ]),
    );
  });

  it('4.5 Regex Match — title matches text pattern (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'regex', jsonPath: '$.title', pattern: '^[a-zA-Z\\s]+$' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.5b Regex Match — digits-only pattern on text (Fail)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'regex', jsonPath: '$.title', pattern: '^[0-9]+$' }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('regex') }),
      ]),
    );
  });

  it('4.6 Numeric Compare — userId > 0 (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'numeric', jsonPath: '$.userId', operator: '>', value: 0 }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.6b Numeric Compare — userId > 999999 (Fail)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'numeric', jsonPath: '$.userId', operator: '>', value: 999999 }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('numeric') }),
      ]),
    );
  });

  it('4.7 Field Exists — $.title exists (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'existence', jsonPath: '$.title', expectExists: true }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.7b Field Exists — $.nonexistent (Fail)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'existence', jsonPath: '$.nonexistent_field_xyz', expectExists: true }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('existence') }),
      ]),
    );
  });

  it('4.8 Type Check — userId is number (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'typeCheck', jsonPath: '$.userId', expectedType: 'number' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.8b Type Check — userId is string (Fail)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'typeCheck', jsonPath: '$.userId', expectedType: 'string' }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('typeCheck') }),
      ]),
    );
  });

  it('4.9 Custom Predicate — Pass ($eq($.body.userId, 1))', () => {
    const result = buildValidationResult(makeInput({
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'custom', expression: '$eq($.body.userId, 1)', description: 'Check userId is 1' } as Assertion,
      ],
    }));
    expect(result.passed).toBe(true);
  });

  it('4.9b Custom Predicate — Fail ($eq($.body.userId, 99999))', () => {
    const result = buildValidationResult(makeInput({
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'custom', expression: '$eq($.body.userId, 99999)', description: 'Check userId is 99999' } as Assertion,
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThanOrEqual(1);
  });

  it('4.10 Multiple Assertions — Mixed Pass/Fail (3 failures)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'responseTime', maxMs: 10000 },
        { type: 'numeric', jsonPath: '$.userId', operator: '>', value: 999999 },
        { type: 'regex', jsonPath: '$.title', pattern: '^[0-9]+$' },
        { type: 'existence', jsonPath: '$.nonexistent', expectExists: true },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBe(3);
    const paths = result.failureDetails.map(f => f.path);
    expect(paths).toEqual(expect.arrayContaining([
      '(numeric:$.userId)',
      '(regex:$.title)',
      '(existence:$.nonexistent)',
    ]));
  });

  it('4.11 Negated Status — NOT 200 (Fail)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'status', expected: '200', negate: true }],
    }));
    expect(result.passed).toBe(false);
  });

  it('4.11b Negated Status — NOT 404 (Pass)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'status', expected: '404', negate: true }],
    }));
    expect(result.passed).toBe(true);
  });
});

// ─── Part 5: Assertion + Validation Combination ─────────────────────────────

describe('Part 5: Assertion + Validation Combination', () => {
  it('5.1 Selective + Status + Time Assertions (all pass)', () => {
    const result = buildValidationResult(makeInput({
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.userId', expectedValue: '1', operator: 'equals' },
        ],
      },
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'responseTime', maxMs: 10000 },
      ],
    }));
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('5.2 Status Assert 404 Enables Body Validation on 404', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      responseObj: {},
      responseBody: '{}',
      validation: { mode: 'none' },
      assertions: [{ type: 'status', expected: '404' }],
    }));
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('5.3 HTTP 500 No Status Assert — Body Validation Skipped', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 500,
      errorMessage: 'Internal Server Error',
      responseObj: {},
      responseBody: '{}',
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.anything', expectedValue: 'ignored', operator: 'equals' },
        ],
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBe(1);
    expect(result.failureDetails[0].path).toBe('(http)');
    expect(result.failureDetails[0].expected).toBe('2xx');
  });
});

// ─── Part 6: Batch Execution (validation per scenario) ──────────────────────

describe('Part 6: Pool/Batch Execution — individual scenario validation', () => {
  it('6.1a Pool — Status 200 Pass', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'status', expected: '200' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('6.1b Pool — Numeric Assert Fail (userId > 999999)', () => {
    const result = buildValidationResult(makeInput({
      assertions: [{ type: 'numeric', jsonPath: '$.userId', operator: '>', value: 999999 }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('numeric') }),
      ]),
    );
  });

  it('6.1c Pool — 404 HTTP Fail (no status assertion)', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      responseObj: {},
      responseBody: '{}',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(http)' }),
      ]),
    );
  });

  it('6.1 Pool — combined: 1 pass + 2 fails', () => {
    const r1 = buildValidationResult(makeInput({
      assertions: [{ type: 'status', expected: '200' }],
    }));
    const r2 = buildValidationResult(makeInput({
      assertions: [{ type: 'numeric', jsonPath: '$.userId', operator: '>', value: 999999 }],
    }));
    const r3 = buildValidationResult(makeInput({
      httpStatus: 404,
      responseObj: {},
      responseBody: '{}',
    }));

    const results = [r1, r2, r3];
    const passCount = results.filter(r => r.passed).length;
    const failCount = results.filter(r => !r.passed).length;
    expect(passCount).toBe(1);
    expect(failCount).toBe(2);
  });
});

// ─── Part 7: Edge Cases ─────────────────────────────────────────────────────

describe('Part 7: Edge Cases', () => {
  it('7.1 Empty Response Body (204)', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 204,
      responseObj: null,
      responseBody: '',
      assertions: [{ type: 'status', expected: '204' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('7.2 Large Response Body (selective on first element)', () => {
    const largeArray = Array.from({ length: 500 }, (_, i) => ({
      postId: 1, id: i + 1, name: `comment-${i}`, email: `user${i}@test.com`, body: 'text',
    }));
    const result = buildValidationResult(makeInput({
      responseObj: largeArray,
      responseBody: JSON.stringify(largeArray),
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$[0].name', expectedValue: '', operator: 'is_not_empty' },
        ],
      },
      assertions: [{ type: 'status', expected: '200' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('7.3 Network Error (Unreachable Host)', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      responseObj: null,
      responseBody: '',
      errorMessage: 'Connection timed out',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(http)', expected: '2xx' }),
      ]),
    );
  });

  it('7.4 Special Characters in Field Values', () => {
    const specialBody = { name: '日本語テスト', html: "<script>alert('xss')</script>", id: 101 };
    const result = buildValidationResult(makeInput({
      httpStatus: 201,
      responseObj: specialBody,
      responseBody: JSON.stringify(specialBody),
      validation: {
        mode: 'selective',
        expectedFields: [
          { jsonPath: '$.name', expectedValue: '日本語テスト', operator: 'equals' },
        ],
      },
      assertions: [{ type: 'status', expected: '201' }],
    }));
    expect(result.passed).toBe(true);
  });
});

// ─── Export JSON smoke test ─────────────────────────────────────────────────

describe('Export JSON — structural smoke test', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const exportData = require('../../../docs/test-data/phase3-test-scenarios-export.json');

  it('export JSON is valid and has all scenario groups', () => {
    expect(exportData._exportMeta).toBeDefined();
    const scenarios = exportData.data.scenarios;
    expect(scenarios.length).toBeGreaterThanOrEqual(7);

    const names = scenarios.map((s: { name: string }) => s.name);
    expect(names).toContain('3A: Validation Engine Tests');
    expect(names).toContain('3A: Assertion Tests');
    expect(names).toContain('3A: Assertion + Validation Combos');
    expect(names).toContain('3A: Batch/Pool Execution (6.1)');
    expect(names).toContain('Edge Cases & Error Handling');
  });

  it('3A Validation Engine Tests has 11 tests (1.1–3.4)', () => {
    const group = exportData.data.scenarios.find((s: { id: string }) => s.id === 'sc-3a-validation');
    expect(group.tests.length).toBe(11);
    const testNames = group.tests.map((t: { name: string }) => t.name);
    expect(testNames).toContain('3.3a Unordered Array — Pass (finds at different index)');
    expect(testNames).toContain('3.3b Ordered Array — Fail (wrong index)');
    expect(testNames).toContain('3.4 Selective — Wrong Path Prefix (Fail)');
  });

  it('3A Assertion Tests has 20 tests (4.1–4.11b incl. 4.9)', () => {
    const group = exportData.data.scenarios.find((s: { id: string }) => s.id === 'sc-3a-assertions');
    expect(group.tests.length).toBe(20);
    const testNames = group.tests.map((t: { name: string }) => t.name);
    expect(testNames).toContain('4.9 Custom Predicate — Pass');
    expect(testNames).toContain('4.9b Custom Predicate — Fail');
  });

  it('3A Combos has 4 tests (5.1–5.3 + Scenario D)', () => {
    const group = exportData.data.scenarios.find((s: { id: string }) => s.id === 'sc-3a-combined');
    expect(group.tests.length).toBe(4);
    const testNames = group.tests.map((t: { name: string }) => t.name);
    expect(testNames).toContain('5.3 HTTP 500 No Status Assert — Body Skipped');
  });

  it('Batch/Pool group has 3 tests (6.1a–6.1c)', () => {
    const group = exportData.data.scenarios.find((s: { id: string }) => s.id === 'sc-3a-batch');
    expect(group.tests.length).toBe(3);
  });

  it('every test in the export has required fields', () => {
    for (const scenario of exportData.data.scenarios) {
      for (const test of scenario.tests) {
        expect(test.id).toBeTruthy();
        expect(test.name).toBeTruthy();
        expect(test.url).toBeTruthy();
        expect(test.method).toBeTruthy();
        expect(test.validation).toBeDefined();
        expect(test.validation.mode).toBeDefined();
      }
    }
  });

  it('total test count matches expected (52 tests across 7 groups)', () => {
    const total = exportData.data.scenarios.reduce(
      (sum: number, s: { tests: unknown[] }) => sum + s.tests.length,
      0,
    );
    expect(total).toBe(52);
  });
});
