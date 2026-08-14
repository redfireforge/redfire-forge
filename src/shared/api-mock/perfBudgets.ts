/**
 * API Mock Studio — performance budgets and hot-path helpers (Phase 12A).
 *
 * The budget numbers here are the executable copy of Section 12.3.1 in the
 * plan. Plan and code must be updated together. Values are pure-engine,
 * single-threaded p95 targets on a warm V8, excluding OS socket bind/accept.
 */

export interface PerfBudget {
  /** Human label for the measured operation. */
  label: string;
  /** p95 wall-clock budget in milliseconds. */
  p95Ms: number;
}

export const API_MOCK_PERF_BUDGETS = {
  startup100: { label: 'build+validate 100 routes', p95Ms: 15 },
  startup500: { label: 'build+validate 500 routes', p95Ms: 60 },
  startup2000: { label: 'build+validate 2,000 routes', p95Ms: 250 },
  matchExact2000: { label: 'match exact-heavy, 2,000 routes', p95Ms: 3 },
  matchRegex2000: { label: 'match regex-heavy, 2,000 routes', p95Ms: 8 },
  matchJson2000: { label: 'match JSONPath/json_subset, 2,000 routes', p95Ms: 12 },
  hotCommit2000: { label: 'hot-commit 2,000-route definition', p95Ms: 5 },
  journalAppend: { label: 'journal append at cap', p95Ms: 0.05 },
} as const satisfies Record<string, PerfBudget>;

export type PerfBudgetKey = keyof typeof API_MOCK_PERF_BUDGETS;

export function resolvePerfCiSlack(raw: string | undefined): number {
  if (!raw) return 6;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

/**
 * CI slack multiplier applied to hard p95 assertions so shared runners do not
 * flake. Override with the `APIMOCK_PERF_CI_SLACK` env var. The raw budgets
 * remain the true targets recorded in the plan.
 */
export const PERF_CI_SLACK: number = resolvePerfCiSlack(typeof process !== 'undefined' ? process.env?.APIMOCK_PERF_CI_SLACK : undefined);

/** Compute the p-th percentile (0-100) of a numeric sample using nearest-rank. */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

/**
 * A bounded LRU cache. Used to memoize compiled RegExp objects on the request
 * hot path so repeated matching does not recompile patterns, while capping
 * memory so adversarial unique patterns cannot grow the cache without bound.
 */
export class BoundedCache<K, V> {
  private readonly map = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Refresh recency: delete + re-insert moves key to the end.
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      // size > maxSize guarantees there is at least one key to evict.
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

/**
 * Ceiling on distinct compiled patterns retained across path + predicate
 * matching. Sized above HARD_CEILINGS.maxRoutes (2,000) plus headroom for
 * predicate patterns so a full large route set stays cached across requests.
 */
export const MAX_COMPILED_PATTERNS = 4096;
