import { describe, it, expect } from 'vitest';
import type { Assertion } from '../../../types';
import type { VerifyResult } from '../hooks/useValidationVerify';
import { buildAssertionVerifyMap, buildRulesLineResults } from './validationRulesResults';

function incompleteVerify(status: 'idle' | 'running'): VerifyResult {
  return {
    status,
    fieldResults: new Map(),
    assertionResults: [],
    passedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failedMappingIds: new Set(),
    timestamp: 0,
  };
}

function completeVerify(
  fieldResults: VerifyResult['fieldResults'],
  assertionResults: VerifyResult['assertionResults'],
): VerifyResult {
  return {
    status: 'complete',
    fieldResults,
    assertionResults,
    passedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failedMappingIds: new Set(),
    timestamp: 1,
  };
}

describe('buildRulesLineResults', () => {
  it('returns [] when verification status is idle or running', () => {
    const dsl = 'name equals "a"';
    expect(buildRulesLineResults(incompleteVerify('idle'), dsl)).toEqual([]);
    expect(buildRulesLineResults(incompleteVerify('running'), dsl)).toEqual([]);
  });

  it('returns [] when DSL has no parseable rules (empty, comments-only, parse errors)', () => {
    const vr = completeVerify(new Map([['name', { path: 'name', passed: true }]]), []);
    expect(buildRulesLineResults(vr, '')).toEqual([]);
    expect(buildRulesLineResults(vr, '# comment only\n   \n')).toEqual([]);
    expect(buildRulesLineResults(vr, 'bad unknown_operator')).toEqual([]);
  });

  it('maps a field rule when fieldResults key matches the bare path', () => {
    const dsl = 'username equals "alice"';
    const vr = completeVerify(
      new Map([
        ['username', { path: 'username', passed: true, actual: 'alice', expected: '"alice"' }],
      ]),
      [],
    );
    expect(buildRulesLineResults(vr, dsl)).toEqual([
      { lineNumber: 1, passed: true, actual: 'alice', expected: '"alice"' },
    ]);
  });

  it('maps a field rule when map key is $.path and DSL path is bare', () => {
    const dsl = 'items exists';
    const vr = completeVerify(
      new Map([
        ['$.items', { path: '$.items', passed: false, actual: '∅', expected: 'exists' }],
      ]),
      [],
    );
    expect(buildRulesLineResults(vr, dsl)).toEqual([
      { lineNumber: 1, passed: false, actual: '∅', expected: 'exists' },
    ]);
  });

  it('maps a field rule when map key is stripped path and DSL path uses $. prefix', () => {
    const dsl = '$.nested.score equals 1';
    const vr = completeVerify(
      new Map([
        ['nested.score', { path: 'nested.score', passed: true, actual: '1', expected: '1' }],
      ]),
      [],
    );
    expect(buildRulesLineResults(vr, dsl)).toEqual([
      { lineNumber: 1, passed: true, actual: '1', expected: '1' },
    ]);
  });

  it('omits a field rule row when lookupField finds no matching field result', () => {
    const dsl = 'missing equals "x"';
    const vr = completeVerify(new Map(), []);
    expect(buildRulesLineResults(vr, dsl)).toEqual([]);
  });

  it('maps existence-kind rules through field lookup (not assertion index)', () => {
    const dsl = 'err not_exists';
    const vr = completeVerify(
      new Map([['err', { path: 'err', passed: true, actual: '', expected: 'absent' }]]),
      [],
    );
    expect(buildRulesLineResults(vr, dsl)).toEqual([
      { lineNumber: 1, passed: true, actual: '', expected: 'absent' },
    ]);
  });

  it('maps assertion rule kinds to assertionResults in DSL order', () => {
    const dsl = [
      'arr length >= 1',
      'nums each > 0',
      'tags contains_any "z"',
      'cfg subset {"a":1}',
      'flag is_type boolean',
      'ASSERT true',
    ].join('\n');

    const assertionObjs: Assertion[] = [
      { type: 'arrayLength', jsonPath: '$.arr', operator: '>=', value: 1 },
      { type: 'each', jsonPath: '$.nums', fieldPath: '', operator: 'greater_than', value: '0' },
      { type: 'arrayContains', jsonPath: '$.tags', value: 'z', mode: 'any' },
      { type: 'containsSubset', jsonPath: '$.cfg', expected: '{"a":1}' },
      { type: 'typeCheck', jsonPath: '$.flag', expectedType: 'boolean' },
      { type: 'custom', expression: 'true' },
    ];

    const vr = completeVerify(
      new Map(),
      assertionObjs.map((assertion, index) => ({
        assertion,
        index,
        passed: index % 2 === 0,
        actual: `a${index}`,
        expected: `e${index}`,
      })),
    );

    const rows = buildRulesLineResults(vr, dsl);
    expect(rows).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(rows[i].lineNumber).toBe(i + 1);
      expect(rows[i].passed).toBe(i % 2 === 0);
      expect(rows[i].actual).toBe(`a${i}`);
      expect(rows[i].expected).toBe(`e${i}`);
    }
  });

  it('does not push a row when assertion kind rule has no matching assertionResults entry', () => {
    const dsl = ['ASSERT 1', 'ASSERT 2'].join('\n');
    const a: Assertion = { type: 'custom', expression: '1' };
    const vr = completeVerify(new Map(), [{ assertion: a, index: 0, passed: true, actual: 'x', expected: 'y' }]);

    const rows = buildRulesLineResults(vr, dsl);
    expect(rows).toEqual([{ lineNumber: 1, passed: true, actual: 'x', expected: 'y' }]);
  });

  it('still maps following field rules after a missing assertion result', () => {
    const dsl = ['ASSERT 1', 'ASSERT 2', 'title equals "x"'].join('\n');
    const a: Assertion = { type: 'custom', expression: '1' };
    const vr = completeVerify(
      new Map([['title', { path: 'title', passed: false, actual: '', expected: '"x"' }]]),
      [{ assertion: a, index: 0, passed: true }],
    );

    const rows = buildRulesLineResults(vr, dsl);
    expect(rows).toHaveLength(2);
    expect(rows[0].lineNumber).toBe(1);
    expect(rows[1]).toEqual({ lineNumber: 3, passed: false, actual: '', expected: '"x"' });
  });
});

describe('buildAssertionVerifyMap', () => {
  it('returns empty map when verification is not complete', () => {
    const a: Assertion = { type: 'custom', expression: 'x' };
    expect(buildAssertionVerifyMap(incompleteVerify('idle'), [a]).size).toBe(0);
    expect(buildAssertionVerifyMap(incompleteVerify('running'), [a]).size).toBe(0);
  });

  it('maps array indices to row verify results when assertion identity matches', () => {
    const a0: Assertion = { type: 'custom', expression: 'x' };
    const a1: Assertion = { type: 'custom', expression: 'y' };
    const vr = completeVerify(new Map(), [
      { assertion: a0, index: 0, passed: true, actual: '1', expected: '2' },
      { assertion: a1, index: 1, passed: false, actual: 'p', expected: 'q' },
    ]);

    const map = buildAssertionVerifyMap(vr, [a0, a1]);
    expect(map.get(0)).toEqual({ passed: true, actual: '1', expected: '2' });
    expect(map.get(1)).toEqual({ passed: false, actual: 'p', expected: 'q' });
  });

  it('skips entries when assertion is not in allAssertions (indexOf === -1)', () => {
    const inArray: Assertion = { type: 'custom', expression: 'listed' };
    const notInArray: Assertion = { type: 'custom', expression: 'ghost' };
    const vr = completeVerify(new Map(), [{ assertion: notInArray, index: 0, passed: true }]);

    expect(buildAssertionVerifyMap(vr, [inArray]).size).toBe(0);
  });

  it('uses first index when the same assertion reference appears twice in allAssertions', () => {
    const shared: Assertion = { type: 'custom', expression: 'dup' };
    const vr = completeVerify(new Map(), [{ assertion: shared, index: 0, passed: false, actual: 'n', expected: 'o' }]);

    const map = buildAssertionVerifyMap(vr, [shared, shared]);
    expect(map.size).toBe(1);
    expect(map.get(0)).toEqual({ passed: false, actual: 'n', expected: 'o' });
  });

  it('returns empty map when assertionResults is empty', () => {
    const a: Assertion = { type: 'custom', expression: 'x' };
    expect(buildAssertionVerifyMap(completeVerify(new Map(), []), [a]).size).toBe(0);
  });
});
