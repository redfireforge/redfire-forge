/**
 * Rolling match-duration window and local diagnostic helpers (no payloads).
 */
import type { ApiMockLocalDiagnosticsV1, ApiMockRouteV1, ApiMockTransactionOutcome } from './contracts';
import { countLeaves } from './predicateTree';
import { percentile } from '../utils/percentiles';

const WINDOW = 100;

export const OUTCOME_KEYS: ApiMockTransactionOutcome[] = [
  'matched', 'ambiguous', 'unmatched', 'fault', 'error', 'proxied',
];

export function emptyOutcomeCounts(): Record<ApiMockTransactionOutcome, number> {
  return { matched: 0, ambiguous: 0, unmatched: 0, fault: 0, error: 0, proxied: 0 };
}

export function countRoutePredicates(routes: ApiMockRouteV1[]): number {
  return routes.reduce((n, route) => n + countLeaves(route.predicates), 0);
}

export function summarizeMatchDurations(samples: number[]): ApiMockLocalDiagnosticsV1['matchDuration'] {
  if (samples.length === 0) return { lastMs: 0, p95Ms: 0, count: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    lastMs: samples[samples.length - 1],
    p95Ms: percentile(sorted, 0.95),
    count: samples.length,
  };
}

/** Bounded duration + outcome counters for one mock listener. */
export class ListenerDiagnosticsCollector {
  private readonly samples: number[] = [];
  private readonly outcomes = emptyOutcomeCounts();
  private templateErrors = 0;

  recordMatch(durationMs: number, outcome: ApiMockTransactionOutcome): void {
    this.samples.push(Math.max(0, durationMs));
    if (this.samples.length > WINDOW) this.samples.shift();
    this.outcomes[outcome] += 1;
  }

  addTemplateErrors(count: number): void {
    if (count > 0) this.templateErrors += count;
  }

  snapshot(): Pick<ApiMockLocalDiagnosticsV1, 'matchDuration' | 'outcomes' | 'templateErrors'> {
    return {
      matchDuration: summarizeMatchDurations(this.samples),
      outcomes: { ...this.outcomes },
      templateErrors: this.templateErrors,
    };
  }

  reset(): void {
    this.samples.length = 0;
    Object.assign(this.outcomes, emptyOutcomeCounts());
    this.templateErrors = 0;
  }
}
