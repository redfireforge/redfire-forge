/**
 * subscriptionAssertions.ts — Sprint 8 (2C-5)
 *
 * Evaluation engine for subscription message assertions.
 *
 * Each assertion defines a JSONPath expression, an operator (from the shared
 * `evaluateFieldOperator` engine), and an expected value. The engine extracts
 * the value from the message's `data` field and evaluates the assertion.
 *
 * Designed to be pure and side-effect free so it can run inside `useMemo`.
 */

import { evaluateFieldOperator } from '@engine/fieldOperatorEvaluation';
import { getByPath } from '@shared/utils/jsonPath';
import type { FieldOperator } from '@shared/types';
import type { GraphqlSubscriptionAssertion, GraphqlSubscriptionMessage } from '@shared/types/graphql';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssertionResult {
  /** ID of the assertion this result corresponds to */
  assertionId: string;
  /** Whether the assertion passed */
  pass: boolean;
  /** Human-readable stringified actual value */
  actual: string;
  /** Human-readable description of the expected condition */
  expected: string;
}

export interface MessageAssertionResults {
  /** ID of the subscription message */
  messageId: string;
  /** Per-assertion results in the same order as the assertions array */
  results: AssertionResult[];
  /** Number of passing assertions for this message */
  passCount: number;
  /** Total assertions evaluated */
  total: number;
}

/** Aggregate pass/fail summary across all evaluated messages. */
export interface AssertionAggregate {
  /** Number of (message × assertion) pairs that passed */
  totalPassed: number;
  /** Number of (message × assertion) pairs that failed */
  totalFailed: number;
  /** Total (message × assertion) evaluations */
  totalRuns: number;
  /** Number of messages where ALL assertions passed */
  messagesAllPass: number;
  /** Total messages evaluated */
  totalMessages: number;
}

// ─── Operators that do not use an expected value ─────────────────────────────

const NO_VALUE_OPERATORS = new Set<string>([
  'is_null', 'is_not_null', 'is_empty', 'is_not_empty',
  'exists', 'not_exists', 'is_true', 'is_false',
]);

/** Returns true when the operator does not require an expected value input. */
export function isNoValueOperator(operator: string): boolean {
  return NO_VALUE_OPERATORS.has(operator);
}

// ─── Subset of operators exposed in the assertion panel UI ───────────────────

export const ASSERTION_OPERATORS: Array<{ value: FieldOperator; label: string }> = [
  { value: 'equals',              label: 'equals' },
  { value: 'not_equals',          label: 'not equals' },
  { value: 'contains',            label: 'contains' },
  { value: 'not_contains',        label: 'not contains' },
  { value: 'starts_with',         label: 'starts with' },
  { value: 'ends_with',           label: 'ends with' },
  { value: 'regex',               label: 'matches regex' },
  { value: 'greater_than',        label: 'greater than' },
  { value: 'less_than',           label: 'less than' },
  { value: 'is_null',             label: 'is null' },
  { value: 'is_not_null',         label: 'is not null' },
  { value: 'is_empty',            label: 'is empty' },
  { value: 'is_not_empty',        label: 'is not empty' },
  { value: 'exists',              label: 'exists' },
  { value: 'not_exists',          label: 'not exists' },
];

// ─── Core evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate a single assertion against one message.
 *
 * Extracts the value at `assertion.jsonPath` from `message.data`, then runs
 * `evaluateFieldOperator` with the assertion's operator and expected value.
 */
export function evaluateSingleAssertion(
  message: GraphqlSubscriptionMessage,
  assertion: GraphqlSubscriptionAssertion,
): AssertionResult {
  const raw = getByPath(message.data, assertion.jsonPath);
  const expectedStr = isNoValueOperator(assertion.operator)
    ? ''
    : String(assertion.expected ?? '');
  const result = evaluateFieldOperator(
    raw,
    assertion.operator as FieldOperator,
    undefined,
    expectedStr,
  );
  return {
    assertionId: assertion.id,
    pass:        result.pass,
    actual:      result.actual,
    expected:    result.expected,
  };
}

/**
 * Evaluate all assertions against a single message.
 * Returns a `MessageAssertionResults` with per-assertion details and totals.
 */
export function evaluateMessageAssertions(
  message: GraphqlSubscriptionMessage,
  assertions: GraphqlSubscriptionAssertion[],
): MessageAssertionResults {
  if (!assertions.length) {
    return { messageId: message.id, results: [], passCount: 0, total: 0 };
  }
  const results = assertions.map((a) => evaluateSingleAssertion(message, a));
  const passCount = results.filter((r) => r.pass).length;
  return { messageId: message.id, results, passCount, total: assertions.length };
}

/**
 * Build a Map<messageId, MessageAssertionResults> for an array of messages.
 *
 * Suitable for passing directly to `GraphqlSubscriptionLog` as a prop.
 * Pure function — safe to call inside `useMemo`.
 */
export function buildAssertionResultMap(
  messages: GraphqlSubscriptionMessage[],
  assertions: GraphqlSubscriptionAssertion[],
): Map<string, MessageAssertionResults> {
  const map = new Map<string, MessageAssertionResults>();
  if (!assertions.length) return map;
  for (const msg of messages) {
    map.set(msg.id, evaluateMessageAssertions(msg, assertions));
  }
  return map;
}

/**
 * Aggregate assertion results across all evaluated messages.
 *
 * @param resultMap  Output of `buildAssertionResultMap`.
 */
export function aggregateAssertionResults(
  resultMap: Map<string, MessageAssertionResults>,
): AssertionAggregate {
  let totalPassed = 0;
  let totalFailed = 0;
  let totalRuns = 0;
  let messagesAllPass = 0;
  let totalMessages = 0;

  for (const entry of resultMap.values()) {
    if (entry.total === 0) continue;
    totalMessages++;
    totalPassed += entry.passCount;
    totalFailed += entry.total - entry.passCount;
    totalRuns   += entry.total;
    if (entry.passCount === entry.total) messagesAllPass++;
  }

  return { totalPassed, totalFailed, totalRuns, messagesAllPass, totalMessages };
}
