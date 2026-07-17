/**
 * subscriptionAssertions.test.ts — Sprint 8 (2C-5)
 *
 * Unit tests for the subscription assertion evaluation engine.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateSingleAssertion,
  evaluateMessageAssertions,
  buildAssertionResultMap,
  aggregateAssertionResults,
  isNoValueOperator,
  ASSERTION_OPERATORS,
} from './subscriptionAssertions';
import type { GraphqlSubscriptionAssertion, GraphqlSubscriptionMessage } from '../../../shared/types/graphql';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeMessage(id: string, data: unknown): GraphqlSubscriptionMessage {
  return {
    id,
    sessionId: 'sess-1',
    index: 1,
    direction: 'in',
    timestampMs: Date.now(),
    offsetMs: 0,
    data,
    transport: 'graphql-transport-ws',
  };
}

function makeAssertion(
  id: string,
  jsonPath: string,
  operator: string,
  expected: unknown = '',
): GraphqlSubscriptionAssertion {
  return { id, jsonPath, operator, expected, description: '' };
}

// ─── isNoValueOperator ────────────────────────────────────────────────────────

describe('isNoValueOperator', () => {
  it('returns true for is_null', () => expect(isNoValueOperator('is_null')).toBe(true));
  it('returns true for is_not_null', () => expect(isNoValueOperator('is_not_null')).toBe(true));
  it('returns true for is_empty', () => expect(isNoValueOperator('is_empty')).toBe(true));
  it('returns true for is_not_empty', () => expect(isNoValueOperator('is_not_empty')).toBe(true));
  it('returns true for exists', () => expect(isNoValueOperator('exists')).toBe(true));
  it('returns true for not_exists', () => expect(isNoValueOperator('not_exists')).toBe(true));
  it('returns true for is_true', () => expect(isNoValueOperator('is_true')).toBe(true));
  it('returns true for is_false', () => expect(isNoValueOperator('is_false')).toBe(true));
  it('returns false for equals', () => expect(isNoValueOperator('equals')).toBe(false));
  it('returns false for contains', () => expect(isNoValueOperator('contains')).toBe(false));
});

// ─── ASSERTION_OPERATORS ──────────────────────────────────────────────────────

describe('ASSERTION_OPERATORS', () => {
  it('exports at least 10 operators', () => expect(ASSERTION_OPERATORS.length).toBeGreaterThanOrEqual(10));
  it('all entries have value and label strings', () => {
    for (const op of ASSERTION_OPERATORS) {
      expect(typeof op.value).toBe('string');
      expect(typeof op.label).toBe('string');
    }
  });
});

// ─── evaluateSingleAssertion ──────────────────────────────────────────────────

describe('evaluateSingleAssertion', () => {
  it('passes when $.data.name equals "Alice"', () => {
    const msg = makeMessage('m1', { name: 'Alice' });
    const assertion = makeAssertion('a1', '$.name', 'equals', 'Alice');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(true);
    expect(result.assertionId).toBe('a1');
  });

  it('fails when $.data.name equals "Bob" but value is "Alice"', () => {
    const msg = makeMessage('m1', { name: 'Alice' });
    const assertion = makeAssertion('a1', '$.name', 'equals', 'Bob');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(false);
  });

  it('passes is_not_null for existing field', () => {
    const msg = makeMessage('m1', { status: 'ACTIVE' });
    const assertion = makeAssertion('a1', '$.status', 'is_not_null');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(true);
  });

  it('passes is_null for null field', () => {
    const msg = makeMessage('m1', { deleted: null });
    const assertion = makeAssertion('a1', '$.deleted', 'is_null');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(true);
  });

  it('passes contains for substring match', () => {
    const msg = makeMessage('m1', { text: 'Hello World' });
    const assertion = makeAssertion('a1', '$.text', 'contains', 'World');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(true);
  });

  it('passes greater_than for numeric comparison', () => {
    const msg = makeMessage('m1', { count: 42 });
    const assertion = makeAssertion('a1', '$.count', 'greater_than', '10');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(true);
  });

  it('fails greater_than when value is lower', () => {
    const msg = makeMessage('m1', { count: 5 });
    const assertion = makeAssertion('a1', '$.count', 'greater_than', '10');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(false);
  });

  it('passes not_exists for missing path', () => {
    const msg = makeMessage('m1', { a: 1 });
    const assertion = makeAssertion('a1', '$.b', 'not_exists');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(result.pass).toBe(true);
  });

  it('returns actual and expected strings', () => {
    const msg = makeMessage('m1', { x: 5 });
    const assertion = makeAssertion('a1', '$.x', 'equals', '5');
    const result = evaluateSingleAssertion(msg, assertion);
    expect(typeof result.actual).toBe('string');
    expect(typeof result.expected).toBe('string');
  });
});

// ─── evaluateMessageAssertions ────────────────────────────────────────────────

describe('evaluateMessageAssertions', () => {
  it('returns empty results when no assertions', () => {
    const msg = makeMessage('m1', { x: 1 });
    const result = evaluateMessageAssertions(msg, []);
    expect(result.total).toBe(0);
    expect(result.passCount).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('returns correct passCount when all pass', () => {
    const msg = makeMessage('m1', { x: 1, y: 'hello' });
    const assertions = [
      makeAssertion('a1', '$.x', 'equals', '1'),
      makeAssertion('a2', '$.y', 'equals', 'hello'),
    ];
    const result = evaluateMessageAssertions(msg, assertions);
    expect(result.total).toBe(2);
    expect(result.passCount).toBe(2);
  });

  it('returns correct passCount when some fail', () => {
    const msg = makeMessage('m1', { x: 99 });
    const assertions = [
      makeAssertion('a1', '$.x', 'equals', '1'),
      makeAssertion('a2', '$.x', 'is_not_null'),
    ];
    const result = evaluateMessageAssertions(msg, assertions);
    expect(result.total).toBe(2);
    expect(result.passCount).toBe(1);
  });

  it('attaches messageId to the result', () => {
    const msg = makeMessage('msg-xyz', { x: 1 });
    const result = evaluateMessageAssertions(msg, [makeAssertion('a1', '$.x', 'equals', '1')]);
    expect(result.messageId).toBe('msg-xyz');
  });
});

// ─── buildAssertionResultMap ──────────────────────────────────────────────────

describe('buildAssertionResultMap', () => {
  it('returns empty map when no assertions', () => {
    const messages = [makeMessage('m1', { x: 1 })];
    const map = buildAssertionResultMap(messages, []);
    expect(map.size).toBe(0);
  });

  it('returns empty map when no messages', () => {
    const assertions = [makeAssertion('a1', '$.x', 'is_not_null')];
    const map = buildAssertionResultMap([], assertions);
    expect(map.size).toBe(0);
  });

  it('creates an entry per message', () => {
    const messages = [makeMessage('m1', { x: 1 }), makeMessage('m2', { x: 2 })];
    const assertions = [makeAssertion('a1', '$.x', 'is_not_null')];
    const map = buildAssertionResultMap(messages, assertions);
    expect(map.size).toBe(2);
    expect(map.has('m1')).toBe(true);
    expect(map.has('m2')).toBe(true);
  });

  it('evaluation is correct per message', () => {
    const messages = [
      makeMessage('m1', { status: 'OK' }),
      makeMessage('m2', { status: 'FAIL' }),
    ];
    const assertions = [makeAssertion('a1', '$.status', 'equals', 'OK')];
    const map = buildAssertionResultMap(messages, assertions);
    expect(map.get('m1')!.passCount).toBe(1);
    expect(map.get('m2')!.passCount).toBe(0);
  });
});

// ─── aggregateAssertionResults ────────────────────────────────────────────────

describe('aggregateAssertionResults', () => {
  it('returns all-zero aggregate for empty map', () => {
    const agg = aggregateAssertionResults(new Map());
    expect(agg.totalPassed).toBe(0);
    expect(agg.totalFailed).toBe(0);
    expect(agg.totalMessages).toBe(0);
    expect(agg.messagesAllPass).toBe(0);
  });

  it('counts pass/fail correctly', () => {
    const messages = [
      makeMessage('m1', { x: 1 }),
      makeMessage('m2', { x: 0 }),
    ];
    const assertions = [makeAssertion('a1', '$.x', 'equals', '1')];
    const map = buildAssertionResultMap(messages, assertions);
    const agg = aggregateAssertionResults(map);
    expect(agg.totalPassed).toBe(1);
    expect(agg.totalFailed).toBe(1);
    expect(agg.totalMessages).toBe(2);
    expect(agg.messagesAllPass).toBe(1);
  });

  it('messagesAllPass equals totalMessages when all pass', () => {
    const messages = [makeMessage('m1', { x: 1 }), makeMessage('m2', { x: 1 })];
    const assertions = [makeAssertion('a1', '$.x', 'equals', '1')];
    const map = buildAssertionResultMap(messages, assertions);
    const agg = aggregateAssertionResults(map);
    expect(agg.messagesAllPass).toBe(2);
    expect(agg.totalMessages).toBe(2);
  });

  it('skips entries with zero assertions', () => {
    const map = new Map([
      ['m1', { messageId: 'm1', results: [], passCount: 0, total: 0 }],
    ]);
    const agg = aggregateAssertionResults(map);
    expect(agg.totalMessages).toBe(0);
    expect(agg.totalRuns).toBe(0);
  });
});
