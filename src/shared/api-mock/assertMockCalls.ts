/**
 * Phase 11B — assert mock journal transactions (shared by workflow + CLI).
 */
import type { ApiMockTransactionOutcome, ApiMockTransactionV1 } from './contracts';

export interface AssertMockCallsCriteria {
  serverId: string;
  routeId?: string;
  matchedResponseId?: string;
  expectedOutcome?: ApiMockTransactionOutcome;
  expectedCount?: number;
  expectedMinCount?: number;
  expectedMaxCount?: number;
  expectedStatus?: number;
  expectedBodyContains?: string;
  expectedHeaderKey?: string;
  expectedHeaderValue?: string;
  expectedLastCallWithinMs?: number;
  nowMs?: number;
}

export interface AssertMockCallsResult {
  passed: boolean;
  expected: string;
  actual: string;
  matchingCount: number;
  matchingIds: string[];
  nearMisses: string[];
}

function headerValue(tx: ApiMockTransactionV1, key: string): string | undefined {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(tx.request.headers ?? {})) {
    if (k.toLowerCase() === lower) return Array.isArray(v) ? v[0] : String(v);
  }
  return undefined;
}

function collectNearMisses(transactions: ApiMockTransactionV1[], criteria: AssertMockCallsCriteria): string[] {
  const notes: string[] = [];
  for (const tx of transactions) {
    if (tx.serverId !== criteria.serverId) continue;
    const bits: string[] = [`${tx.request.method} ${tx.request.path} (${tx.outcome})`];
    if (criteria.routeId && tx.matchedRouteId !== criteria.routeId) {
      bits.push(`route=${tx.matchedRouteId ?? 'none'}≠${criteria.routeId}`);
    }
    if (criteria.matchedResponseId && tx.matchedResponseId !== criteria.matchedResponseId) {
      bits.push(`variant=${tx.matchedResponseId ?? 'none'}≠${criteria.matchedResponseId}`);
    }
    if (criteria.expectedStatus != null && tx.response?.status !== criteria.expectedStatus) {
      bits.push(`status=${tx.response?.status ?? 'n/a'}≠${criteria.expectedStatus}`);
    }
    if (criteria.expectedOutcome && tx.outcome !== criteria.expectedOutcome) {
      bits.push(`outcome=${tx.outcome}≠${criteria.expectedOutcome}`);
    }
    const explanationMisses = tx.explanation?.nearMisses ?? [];
    for (const nm of explanationMisses.slice(0, 2)) {
      const firstFail = nm.failedPredicates[0]?.reason ?? `distance ${nm.missDistance}`;
      bits.push(`${nm.routeName || nm.routeId}: ${firstFail}`);
    }
    if (bits.length > 1) notes.push(bits.join(' · '));
    if (notes.length >= 5) break;
  }
  return notes;
}

/** Filter + evaluate journal transactions against assert criteria. */
export function assertMockCalls(
  transactions: ApiMockTransactionV1[],
  criteria: AssertMockCallsCriteria,
): AssertMockCallsResult {
  const matching = transactions.filter(tx => {
    if (tx.serverId !== criteria.serverId) return false;
    if (criteria.routeId && tx.matchedRouteId !== criteria.routeId) return false;
    if (criteria.matchedResponseId && tx.matchedResponseId !== criteria.matchedResponseId) return false;
    if (criteria.expectedStatus != null && tx.response?.status !== criteria.expectedStatus) return false;
    if (criteria.expectedOutcome && tx.outcome !== criteria.expectedOutcome) return false;
    return true;
  });

  const count = matching.length;
  const matchingIds = matching.map(t => t.id);
  const nearMisses = collectNearMisses(transactions, criteria);

  if (criteria.expectedCount != null && count !== criteria.expectedCount) {
    return {
      passed: false,
      expected: `count = ${criteria.expectedCount}`,
      actual: `count = ${count}`,
      matchingCount: count,
      matchingIds,
      nearMisses,
    };
  }
  if (criteria.expectedMinCount != null && count < criteria.expectedMinCount) {
    return {
      passed: false,
      expected: `count >= ${criteria.expectedMinCount}`,
      actual: `count = ${count}`,
      matchingCount: count,
      matchingIds,
      nearMisses,
    };
  }
  if (criteria.expectedMaxCount != null && count > criteria.expectedMaxCount) {
    return {
      passed: false,
      expected: `count <= ${criteria.expectedMaxCount}`,
      actual: `count = ${count}`,
      matchingCount: count,
      matchingIds,
      nearMisses,
    };
  }

  if (criteria.expectedLastCallWithinMs != null) {
    if (matching.length === 0) {
      return {
        passed: false,
        expected: `last call within ${criteria.expectedLastCallWithinMs}ms`,
        actual: 'no matching calls',
        matchingCount: 0,
        matchingIds,
        nearMisses,
      };
    }
    const last = matching[matching.length - 1];
    const age = (criteria.nowMs ?? Date.now()) - new Date(last.receivedAt).getTime();
    if (!Number.isFinite(age) || age > criteria.expectedLastCallWithinMs) {
      return {
        passed: false,
        expected: `last call within ${criteria.expectedLastCallWithinMs}ms`,
        actual: `last call age = ${Number.isFinite(age) ? Math.round(age) : '?'}ms`,
        matchingCount: count,
        matchingIds,
        nearMisses,
      };
    }
  }

  if (criteria.expectedBodyContains) {
    if (matching.length === 0) {
      return {
        passed: false,
        expected: `body contains "${criteria.expectedBodyContains}"`,
        actual: 'no matching calls',
        matchingCount: 0,
        matchingIds,
        nearMisses,
      };
    }
    const last = matching[matching.length - 1];
    if (!last.response?.body?.includes(criteria.expectedBodyContains)) {
      return {
        passed: false,
        expected: `body contains "${criteria.expectedBodyContains}"`,
        actual: `body = "${last.response?.body?.slice(0, 100) ?? '(null)'}"`,
        matchingCount: count,
        matchingIds,
        nearMisses,
      };
    }
  }

  if (criteria.expectedHeaderKey) {
    if (matching.length === 0) {
      return {
        passed: false,
        expected: `header ${criteria.expectedHeaderKey} present`,
        actual: 'no matching calls',
        matchingCount: 0,
        matchingIds,
        nearMisses,
      };
    }
    const last = matching[matching.length - 1];
    const headerVal = headerValue(last, criteria.expectedHeaderKey);
    if (criteria.expectedHeaderValue != null && headerVal !== criteria.expectedHeaderValue) {
      return {
        passed: false,
        expected: `header ${criteria.expectedHeaderKey} = "${criteria.expectedHeaderValue}"`,
        actual: `header ${criteria.expectedHeaderKey} = "${headerVal ?? '(absent)'}"`,
        matchingCount: count,
        matchingIds,
        nearMisses,
      };
    }
    if (criteria.expectedHeaderValue == null && headerVal == null) {
      return {
        passed: false,
        expected: `header ${criteria.expectedHeaderKey} present`,
        actual: 'header absent',
        matchingCount: count,
        matchingIds,
        nearMisses,
      };
    }
  }

  return {
    passed: true,
    expected: 'assertions satisfied',
    actual: `count = ${count}`,
    matchingCount: count,
    matchingIds,
    nearMisses: [],
  };
}
