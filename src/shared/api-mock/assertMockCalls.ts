/**
 * Phase 11B — assert mock journal transactions (shared by workflow + CLI).
 */
import type { ApiMockTransactionOutcome, ApiMockTransactionV1 } from './contracts';

export type AssertMockBodyMatch = 'contains' | 'equals' | 'regex';

export interface AssertMockHeaderCriterion {
  key: string;
  value?: string;
}

export function resolveAssertBodyMatch(mode?: AssertMockBodyMatch): AssertMockBodyMatch {
  return mode === 'equals' || mode === 'regex' ? mode : 'contains';
}

export function evaluateAssertBody(
  actual: string | null | undefined,
  expected: string,
  mode: AssertMockBodyMatch = 'contains',
): { ok: boolean; expected: string; actual: string } {
  const preview = (value: string | null | undefined) => value?.slice(0, 100) ?? '(null)';
  if (mode === 'equals') {
    return {
      ok: (actual ?? null) === expected,
      expected: `body equals "${expected.slice(0, 80)}"`,
      actual: `body = "${preview(actual)}"`,
    };
  }
  if (mode === 'regex') {
    try {
      return {
        ok: new RegExp(expected).test(actual ?? ''),
        expected: `body matches /${expected}/`,
        actual: `body = "${preview(actual)}"`,
      };
    } catch {
      return {
        ok: false,
        expected: `body matches /${expected}/`,
        actual: 'invalid regular expression',
      };
    }
  }
  return {
    ok: actual?.includes(expected) ?? false,
    expected: `body contains "${expected.slice(0, 80)}"`,
    actual: `body = "${preview(actual)}"`,
  };
}

export interface AssertMockCallsCriteria {
  serverId: string;
  routeId?: string;
  matchedResponseId?: string;
  expectedOutcome?: ApiMockTransactionOutcome;
  expectedCount?: number;
  expectedMinCount?: number;
  expectedMaxCount?: number;
  expectedStatus?: number;
  /** Body text to check. Match mode is `expectedBodyMatch` (default: contains). */
  expectedBodyContains?: string;
  expectedBodyMatch?: AssertMockBodyMatch;
  /** Preferred: every listed header is checked on the newest matching call. */
  expectedHeaders?: AssertMockHeaderCriterion[];
  /** Legacy single-header fields — used when `expectedHeaders` is empty. */
  expectedHeaderKey?: string;
  expectedHeaderValue?: string;
  expectedLastCallWithinMs?: number;
  nowMs?: number;
}

/** Merge the header list with the legacy single key/value pair. */
export function resolveAssertHeaderCriteria(
  criteria: Pick<AssertMockCallsCriteria, 'expectedHeaders' | 'expectedHeaderKey' | 'expectedHeaderValue'>,
): AssertMockHeaderCriterion[] {
  const fromList = (criteria.expectedHeaders ?? [])
    .map(header => ({
      key: header.key.trim(),
      value: header.value?.trim() || undefined,
    }))
    .filter(header => header.key);
  if (fromList.length > 0) return fromList;
  const legacyKey = criteria.expectedHeaderKey?.trim();
  if (!legacyKey) return [];
  const legacyValue = criteria.expectedHeaderValue?.trim();
  return [{ key: legacyKey, value: legacyValue || undefined }];
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
    const bodyMode = resolveAssertBodyMatch(criteria.expectedBodyMatch);
    const bodyCheck = evaluateAssertBody(
      matching[matching.length - 1]?.response?.body,
      criteria.expectedBodyContains,
      bodyMode,
    );
    if (matching.length === 0) {
      return {
        passed: false,
        expected: bodyCheck.expected,
        actual: 'no matching calls',
        matchingCount: 0,
        matchingIds,
        nearMisses,
      };
    }
    if (!bodyCheck.ok) {
      return {
        passed: false,
        expected: bodyCheck.expected,
        actual: bodyCheck.actual,
        matchingCount: count,
        matchingIds,
        nearMisses,
      };
    }
  }

  const headerChecks = resolveAssertHeaderCriteria(criteria);
  if (headerChecks.length > 0) {
    if (matching.length === 0) {
      return {
        passed: false,
        expected: `header ${headerChecks[0].key} present`,
        actual: 'no matching calls',
        matchingCount: 0,
        matchingIds,
        nearMisses,
      };
    }
    const last = matching[matching.length - 1];
    for (const header of headerChecks) {
      const headerVal = headerValue(last, header.key);
      if (header.value != null && headerVal !== header.value) {
        return {
          passed: false,
          expected: `header ${header.key} = "${header.value}"`,
          actual: `header ${header.key} = "${headerVal ?? '(absent)'}"`,
          matchingCount: count,
          matchingIds,
          nearMisses,
        };
      }
      if (header.value == null && headerVal == null) {
        return {
          passed: false,
          expected: `header ${header.key} present`,
          actual: 'header absent',
          matchingCount: count,
          matchingIds,
          nearMisses,
        };
      }
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
