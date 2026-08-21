import { describe, expect, it } from 'vitest';
import {
  assertMockCalls,
  evaluateAssertBody,
  resolveAssertBodyMatch,
  resolveAssertHeaderCriteria,
} from './assertMockCalls';
import type { ApiMockTransactionV1 } from './contracts';

const ts = '2026-08-12T12:00:00.000Z';

function tx(overrides: Partial<ApiMockTransactionV1> = {}): ApiMockTransactionV1 {
  return {
    id: 'tx-1',
    serverId: 'srv-1',
    generation: 1,
    receivedAt: ts,
    completedAt: ts,
    request: {
      method: 'GET', path: '/x', rawPath: '/x', query: {}, headers: { 'x-trace': ['1'] },
      cookies: {}, body: null, bodyTruncated: false, receivedAt: ts,
    },
    outcome: 'matched',
    matchedRouteId: 'r1',
    matchedResponseId: 'v1',
    explanation: {
      normalizedRequest: {
        method: 'GET', path: '/x', decodedPath: '/x', pathSegments: ['x'],
        query: {}, headerKeys: [], cookieKeys: [], bodySizeBytes: 0,
      },
      candidates: [],
      policyDecision: {
        policy: 'highest_priority', equalPriorityPolicy: 'reject',
        matchedCount: 1, highestPriority: 10, tiedAtHighest: 1, outcome: 'matched',
      },
      nearMisses: [{
        routeId: 'r2', routeName: 'Other', missDistance: 1,
        failedPredicates: [{ predicateId: 'p1', source: 'header', reason: 'missing X-Auth' }],
      }],
    },
    response: {
      status: 200, headers: {}, cookies: [], body: '{"ok":true}',
      bodyTruncated: false, durationMs: 5, generationAtResponse: 1,
    },
    durationMs: 5,
    ...overrides,
  };
}

describe('assertMockCalls', () => {
  it('passes min count and captures matching ids', () => {
    const result = assertMockCalls([tx(), tx({ id: 'tx-2' })], {
      serverId: 'srv-1',
      expectedMinCount: 2,
    });
    expect(result.passed).toBe(true);
    expect(result.matchingIds).toEqual(['tx-1', 'tx-2']);
  });

  it('filters by expected outcome', () => {
    const pass = assertMockCalls([tx()], { serverId: 'srv-1', expectedOutcome: 'matched', expectedMinCount: 1 });
    expect(pass.passed).toBe(true);
    const fail = assertMockCalls([tx({ outcome: 'unmatched' })], { serverId: 'srv-1', expectedOutcome: 'matched', expectedMinCount: 1 });
    expect(fail.passed).toBe(false);
    expect(fail.nearMisses.some(n => n.includes('outcome='))).toBe(true);
  });

  it('fails count with near misses', () => {
    const result = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedCount: 2,
    });
    expect(result.passed).toBe(false);
    expect(result.expected).toContain('count = 2');
    expect(result.nearMisses.some(n => n.includes('Other'))).toBe(true);
  });

  it('checks body and last-call window', () => {
    const now = Date.parse(ts) + 100;
    const bodyFail = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedBodyContains: 'missing',
    });
    expect(bodyFail.passed).toBe(false);

    const ageFail = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedLastCallWithinMs: 10,
      nowMs: now,
    });
    expect(ageFail.passed).toBe(false);
  });

  it('fails body and header checks when there are no matching calls', () => {
    expect(assertMockCalls([], { serverId: 'srv-1', expectedBodyContains: 'ok' }).passed).toBe(false);
    expect(assertMockCalls([], { serverId: 'srv-1', expectedHeaderKey: 'Authorization' }).passed).toBe(false);
    expect(assertMockCalls([], { serverId: 'srv-1', expectedHeaderKey: 'Authorization' }).actual).toBe('no matching calls');
  });

  it('checks every listed request header', () => {
    const withBoth = tx({
      request: { ...tx().request, headers: { 'x-id': ['abc'], 'x-trace': ['1'] } },
    });
    expect(assertMockCalls([withBoth], {
      serverId: 'srv-1',
      expectedHeaders: [
        { key: 'X-Id', value: 'abc' },
        { key: 'X-Trace', value: '1' },
      ],
    }).passed).toBe(true);

    const missingSecond = assertMockCalls([withBoth], {
      serverId: 'srv-1',
      expectedHeaders: [
        { key: 'X-Id', value: 'abc' },
        { key: 'Authorization', value: 'Bearer' },
      ],
    });
    expect(missingSecond.passed).toBe(false);
    expect(missingSecond.expected).toContain('Authorization');
  });

  it('prefers expectedHeaders over the legacy single pair', () => {
    expect(resolveAssertHeaderCriteria({
      expectedHeaders: [{ key: ' X-Id ', value: ' abc ' }, { key: '', value: 'skip' }],
      expectedHeaderKey: 'Legacy',
      expectedHeaderValue: 'old',
    })).toEqual([{ key: 'X-Id', value: 'abc' }]);
    expect(resolveAssertHeaderCriteria({
      expectedHeaderKey: 'Authorization',
      expectedHeaderValue: '  ',
    })).toEqual([{ key: 'Authorization' }]);
  });

  it('matches body with contains, equals, and regex', () => {
    expect(resolveAssertBodyMatch(undefined)).toBe('contains');
    expect(evaluateAssertBody('{"ok":true}', 'ok').ok).toBe(true);
    expect(evaluateAssertBody('{"ok":true}', '{"ok":true}', 'equals').ok).toBe(true);
    expect(evaluateAssertBody('{"ok":true}', '{"ok":false}', 'equals').ok).toBe(false);
    expect(evaluateAssertBody('{"id":"12"}', '"id":\\s*"\\d+"', 'regex').ok).toBe(true);
    expect(evaluateAssertBody('{"id":"12"}', '(', 'regex').actual).toBe('invalid regular expression');

    const exactFail = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedBodyContains: '{"ok":false}',
      expectedBodyMatch: 'equals',
    });
    expect(exactFail.passed).toBe(false);
    expect(exactFail.expected).toContain('body equals');
  });
});
