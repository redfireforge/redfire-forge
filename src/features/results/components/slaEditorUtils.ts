/**
 * Shared SLA editor utilities — constants and validation extracted from
 * SlaTargetEditor to satisfy react-refresh/only-export-components.
 */
import type { SlaTarget, SlaMetric } from '../utils/slaTargets';

export interface RowError {
  value?: string;
  warnAt?: string;
}

export const METRIC_OPTIONS: SlaMetric[] = ['p95', 'p99', 'p50', 'p999', 'avg', 'tps', 'errorRate'];

export function validateRow(t: SlaTarget): RowError {
  const err: RowError = {};

  if (!Number.isFinite(t.value) || t.value < 0) {
    err.value = 'Must be a non-negative number';
  }

  if (t.warnAt !== undefined) {
    if (!Number.isFinite(t.warnAt) || t.warnAt < 0) {
      err.warnAt = 'Must be a non-negative number';
    } else if (t.operator === 'lte' && t.warnAt >= t.value) {
      err.warnAt = `Must be less than ${t.value} (fail threshold)`;
    } else if (t.operator === 'gte' && t.warnAt <= t.value) {
      err.warnAt = `Must be greater than ${t.value} (fail threshold)`;
    }
  }

  return err;
}
