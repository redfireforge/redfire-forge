import { describe, expect, it } from 'vitest';
import { buildClosestMatchDebugBody } from './closestMatchDebug';
import type { ApiMockMatchExplanationV1 } from './contracts';
import { DEFAULT_UNMATCHED_RESPONSE } from './defaults';

function explanation(nearMisses: ApiMockMatchExplanationV1['nearMisses'] = []): ApiMockMatchExplanationV1 {
  return {
    normalizedRequest: {
      method: 'GET',
      path: '/users/42',
      decodedPath: '/users/42',
      pathSegments: ['users', '42'],
      query: {},
      headerKeys: [],
      cookieKeys: [],
      bodySizeBytes: 0,
    },
    candidates: [],
    policyDecision: {
      policy: 'highest_priority',
      equalPriorityPolicy: 'reject',
      matchedCount: 0,
      highestPriority: 0,
      tiedAtHighest: 0,
      outcome: 'unmatched',
    },
    nearMisses,
  };
}

describe('buildClosestMatchDebugBody', () => {
  it('includes sanitized near-miss details', () => {
    const body = buildClosestMatchDebugBody(
      explanation([{
        routeId: 'r1',
        routeName: 'Users',
        missDistance: 1,
        failedPredicates: [{ predicateId: 'p1', source: 'header', reason: 'missing X-Tenant' }],
      }]),
      DEFAULT_UNMATCHED_RESPONSE,
    );
    expect(body.status).toBe(404);
    expect(body.contentType).toBe('application/json');
    const parsed = JSON.parse(body.body) as { mode: string; nearMisses: Array<{ routeName: string }> };
    expect(parsed.mode).toBe('closest_match_debug');
    expect(parsed.nearMisses[0].routeName).toBe('Users');
  });

  it('handles empty near-miss list', () => {
    const body = buildClosestMatchDebugBody(explanation(), DEFAULT_UNMATCHED_RESPONSE);
    const parsed = JSON.parse(body.body) as { nearMissCount: number; hint: string };
    expect(parsed.nearMissCount).toBe(0);
    expect(parsed.hint).toMatch(/No near-miss/i);
  });

  it('caps near misses, uses fallback status, and sets the populated hint', () => {
    const misses = Array.from({ length: 7 }, (_, i) => ({
      routeId: `r${i}`,
      routeName: `Route ${i}`,
      missDistance: i + 1,
      failedPredicates: Array.from({ length: 10 }, (_, j) => ({
        predicateId: `p${j}`,
        source: 'header' as const,
        reason: `reason-${j}`,
      })),
    }));
    const body = buildClosestMatchDebugBody(explanation(misses), { ...DEFAULT_UNMATCHED_RESPONSE, status: 0 });
    expect(body.status).toBe(404);
    const parsed = JSON.parse(body.body) as { nearMissCount: number; nearMisses: unknown[]; hint: string };
    expect(parsed.nearMissCount).toBe(7);
    expect(parsed.nearMisses).toHaveLength(5);
    expect(parsed.hint).toMatch(/Closest candidates/);
  });
});
