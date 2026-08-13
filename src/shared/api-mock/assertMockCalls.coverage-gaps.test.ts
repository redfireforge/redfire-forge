import { describe, expect, it } from 'vitest';
import { assertMockCalls } from './assertMockCalls';
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
      method: 'GET', path: '/x', rawPath: '/x', query: {}, headers: { 'x-trace': ['1'], authorization: 'Bearer tok' },
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
      status: 200, headers: { Authorization: 'Bearer tok' }, cookies: [], body: '{"ok":true}',
      bodyTruncated: false, durationMs: 5, generationAtResponse: 1,
    },
    durationMs: 5,
    ...overrides,
  };
}

describe('assertMockCalls coverage gaps', () => {
  it('filters by route, variant, and status', () => {
    const pass = assertMockCalls([tx()], {
      serverId: 'srv-1',
      routeId: 'r1',
      matchedResponseId: 'v1',
      expectedStatus: 200,
      expectedCount: 1,
    });
    expect(pass.passed).toBe(true);

    const fail = assertMockCalls([tx({ matchedRouteId: 'other' })], {
      serverId: 'srv-1',
      routeId: 'r1',
      expectedCount: 1,
    });
    expect(fail.matchingCount).toBe(0);
  });

  it('fails max count and min count thresholds', () => {
    const maxFail = assertMockCalls([tx(), tx({ id: 'tx-2' })], {
      serverId: 'srv-1',
      expectedMaxCount: 1,
    });
    expect(maxFail.passed).toBe(false);
    expect(maxFail.expected).toContain('<=');

    const minFail = assertMockCalls([], { serverId: 'srv-1', expectedMinCount: 1 });
    expect(minFail.passed).toBe(false);
  });

  it('validates recency, body, and headers on the last match', () => {
    const recent = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedLastCallWithinMs: 60_000,
      nowMs: Date.parse(ts) + 1000,
    });
    expect(recent.passed).toBe(true);

    const noMatches = assertMockCalls([], {
      serverId: 'srv-1',
      expectedLastCallWithinMs: 100,
    });
    expect(noMatches.actual).toBe('no matching calls');

    const headerValueFail = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedHeaderKey: 'Authorization',
      expectedHeaderValue: 'wrong',
    });
    expect(headerValueFail.passed).toBe(false);

    const headerMissing = assertMockCalls([tx({
      request: { ...tx().request, headers: {} },
      response: { ...tx().response!, headers: {} },
    })], {
      serverId: 'srv-1',
      expectedHeaderKey: 'Authorization',
    });
    expect(headerMissing.passed).toBe(false);
    expect(headerMissing.actual).toBe('header absent');
  });

  it('builds near misses for route, variant, status, and explanation distance', () => {
    const notes = assertMockCalls([
      tx({
        matchedRouteId: 'wrong',
        matchedResponseId: 'wrong',
        response: { ...tx().response!, status: 500 },
        explanation: {
          ...tx().explanation!,
          nearMisses: [{ routeId: 'r9', missDistance: 2, failedPredicates: [] }],
        },
      }),
      tx({ serverId: 'other' }),
    ], {
      serverId: 'srv-1',
      routeId: 'r1',
      matchedResponseId: 'v1',
      expectedStatus: 200,
      expectedCount: 1,
    });
    expect(notes.nearMisses.some(n => n.includes('route='))).toBe(true);
    expect(notes.nearMisses.some(n => n.includes('variant='))).toBe(true);
    expect(notes.nearMisses.some(n => n.includes('status='))).toBe(true);
    expect(notes.nearMisses.some(n => n.includes('distance 2'))).toBe(true);
  });

  it('reads scalar header values and passes body contains checks', () => {
    const pass = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedBodyContains: 'ok',
      expectedHeaderKey: 'Authorization',
      expectedHeaderValue: 'Bearer tok',
    });
    expect(pass.passed).toBe(true);
    expect(pass.nearMisses).toEqual([]);
  });

  it('reports non-finite last-call age and null response bodies', () => {
    const badAge = assertMockCalls([tx({ receivedAt: 'not-a-date' })], {
      serverId: 'srv-1',
      expectedLastCallWithinMs: 100,
      nowMs: Date.parse(ts),
    });
    expect(badAge.actual).toContain('?');

    const nullBody = assertMockCalls([tx({ response: { ...tx().response!, body: null } })], {
      serverId: 'srv-1',
      expectedBodyContains: 'x',
    });
    expect(nullBody.actual).toContain('(null)');
  });

  it('passes when only header presence is required and caps near-miss notes', () => {
    const presence = assertMockCalls([tx()], {
      serverId: 'srv-1',
      expectedHeaderKey: 'authorization',
    });
    expect(presence.passed).toBe(true);

    const many = Array.from({ length: 6 }, (_, i) => tx({
      id: `tx-${i}`,
      matchedRouteId: `wrong-${i}`,
    }));
    const capped = assertMockCalls(many, {
      serverId: 'srv-1',
      routeId: 'r1',
      expectedCount: 6,
    });
    expect(capped.nearMisses.length).toBeLessThanOrEqual(5);
  });

  it('excludes transactions that fail variant or status filters', () => {
    const variantMiss = assertMockCalls([tx({ matchedResponseId: 'other' })], {
      serverId: 'srv-1',
      matchedResponseId: 'v1',
      expectedCount: 1,
    });
    expect(variantMiss.matchingCount).toBe(0);

    const statusMiss = assertMockCalls([tx({ response: { ...tx().response!, status: 500 } })], {
      serverId: 'srv-1',
      expectedStatus: 200,
      expectedCount: 1,
    });
    expect(statusMiss.matchingCount).toBe(0);
  });
});
