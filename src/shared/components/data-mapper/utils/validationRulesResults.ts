import type { Assertion } from '../../../types';
import type { LineVerifyResult } from '../ValidationCodeEditor';
import type { AssertionRowVerifyResult } from '../InlineAssertionRow';
import type { VerifyResult } from '../hooks/useValidationVerify';
import { parseDsl } from './validationDsl';

const ASSERTION_KINDS = new Set([
  'length',
  'each',
  'contains_item',
  'subset',
  'type_check',
  'custom',
]);

/**
 * Maps parsed DSL rule lines to Monaco gutter verify results for the Rules modal.
 */
export function buildRulesLineResults(result: VerifyResult, dslText: string): LineVerifyResult[] {
  if (result.status !== 'complete') return [];
  const { rules } = parseDsl(dslText);
  if (rules.length === 0) return [];

  const { fieldResults, assertionResults } = result;

  const lookupField = (p: string) =>
    fieldResults.get(p) ?? fieldResults.get(`$.${p}`) ?? fieldResults.get(p.replace(/^\$\.?/, ''));

  const results: LineVerifyResult[] = [];
  let assertionIdx = 0;

  for (const rule of rules) {
    if (ASSERTION_KINDS.has(rule.kind)) {
      const ar = assertionResults[assertionIdx];
      assertionIdx++;
      if (ar) {
        results.push({
          lineNumber: rule.lineNumber,
          passed: ar.passed,
          actual: ar.actual,
          expected: ar.expected,
        });
      }
    } else {
      const fr = lookupField(rule.path);
      if (fr) {
        results.push({
          lineNumber: rule.lineNumber,
          passed: fr.passed,
          actual: fr.actual,
          expected: fr.expected,
        });
      }
    }
  }
  return results;
}

/**
 * Indexes assertion verify outcomes by their position in the assertions array (for inline rows).
 */
export function buildAssertionVerifyMap(
  result: VerifyResult,
  allAssertions: Assertion[],
): Map<number, AssertionRowVerifyResult> {
  if (result.status !== 'complete') return new Map();
  const map = new Map<number, AssertionRowVerifyResult>();
  for (const ar of result.assertionResults) {
    const idx = allAssertions.indexOf(ar.assertion);
    if (idx >= 0) {
      map.set(idx, { passed: ar.passed, actual: ar.actual, expected: ar.expected });
    }
  }
  return map;
}
