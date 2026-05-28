/**
 * CLI SLA evaluation utilities (SLA-E3).
 *
 * Pure functions — no browser/storage dependencies.
 * Mirrors the core logic of src/features/results/utils/slaTargets.ts
 * without importing its storage layer (which uses browser APIs).
 */

import { readFileSync } from 'node:fs';
import type { TestSummary, RequestResult, SlaTarget, SlaMetric } from '../src/shared/types';

// ── Types ──

export type SlaStatus = 'pass' | 'warn' | 'fail' | 'no-data';

export interface SlaCheckResult {
  label: string;
  metric: SlaMetric;
  actual: number | null;
  threshold: string;
  status: SlaStatus;
}

// ── Internal helpers ──

function getMetricFromSummary(metric: SlaMetric, summary: TestSummary): number | null {
  switch (metric) {
    case 'p50':       return summary.p50ResponseTime;
    case 'p95':       return summary.p95ResponseTime;
    case 'p99':       return summary.p99ResponseTime;
    case 'p999':      return summary.p999ResponseTime ?? null;
    case 'avg':       return summary.avgResponseTime;
    case 'tps':       return summary.tps;
    case 'errorRate': return summary.errorRate;
  }
}

function computeGroupMetrics(
  results: RequestResult[],
  name: string,
  groupBy: 'scenarioName' | 'featureGroupName',
): Record<SlaMetric, number> | null {
  const filtered = results.filter((r) => r[groupBy] === name);
  if (filtered.length === 0) return null;

  const durations = filtered.map((r) => r.responseTimeMs).sort((a, b) => a - b);
  const n = durations.length;
  const percentile = (p: number): number => durations[Math.ceil((p / 100) * n) - 1];

  const minTs = filtered.reduce((m, r) => Math.min(m, r.timestamp), Infinity);
  const maxTs = filtered.reduce((m, r) => Math.max(m, r.timestamp + r.responseTimeMs), -Infinity);
  const durationSec = (maxTs - minTs) / 1000;
  const tps = durationSec > 0 ? n / durationSec : 0;

  const errored = filtered.filter((r) => !r.passed).length;
  const errorRate = (errored / n) * 100;

  return {
    p50:       percentile(50),
    p95:       percentile(95),
    p99:       percentile(99),
    p999:      percentile(99.9),
    avg:       durations.reduce((s, v) => s + v, 0) / n,
    tps,
    errorRate,
  };
}

function evaluateOne(target: SlaTarget, actual: number): SlaStatus {
  const { operator, value, warnAt } = target;
  if (operator === 'lte') {
    if (actual > value) return 'fail';
    if (warnAt !== undefined && actual > warnAt) return 'warn';
    return 'pass';
  } else {
    if (actual < value) return 'fail';
    if (warnAt !== undefined && actual < warnAt) return 'warn';
    return 'pass';
  }
}

const METRIC_UNIT: Record<SlaMetric, string> = {
  p50: 'ms', p95: 'ms', p99: 'ms', p999: 'ms', avg: 'ms',
  tps: 'req/s', errorRate: '%',
};

const METRIC_LABEL: Record<SlaMetric, string> = {
  p50: 'P50', p95: 'P95', p99: 'P99', p999: 'P999', avg: 'Avg',
  tps: 'TPS', errorRate: 'Error Rate',
};

function formatThreshold(target: SlaTarget): string {
  const unit = METRIC_UNIT[target.metric];
  const op = target.operator === 'lte' ? '<=' : '>=';
  const warn = target.warnAt !== undefined
    ? ` (warn ${target.operator === 'lte' ? '<=' : '>='} ${target.warnAt}${unit})`
    : '';
  return `${op} ${target.value}${unit}${warn}`;
}

// ── Public API ──

/**
 * Load and validate a JSON SLA targets file.
 * Expected format: SlaTarget[] (see src/shared/types/index.ts).
 */
export function loadSlaTargetFile(filePath: string): SlaTarget[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read SLA config file "${filePath}": ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`SLA config file "${filePath}" is not valid JSON`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`SLA config file "${filePath}" must be a JSON array of SLA targets`);
  }

  for (let i = 0; i < parsed.length; i++) {
    const t = parsed[i] as Record<string, unknown>;
    if (!t.metric || !t.operator || t.value === undefined) {
      throw new Error(
        `SLA target at index ${i} is missing required fields (metric, operator, value)`,
      );
    }
    // Auto-assign id if missing (allows hand-authored JSON without ids)
    if (!t.id) {
      (parsed[i] as Record<string, unknown>).id = `sla-cli-${i}`;
    }
  }

  return parsed as SlaTarget[];
}

/**
 * Evaluate SLA targets against a completed test run.
 *
 * - Aggregate targets (no scenarioName / featureGroupName) → evaluated against TestSummary
 * - Scenario-scoped targets → grouped from RequestResult[] by scenarioName
 * - Feature-group-scoped targets → grouped from RequestResult[] by featureGroupName
 */
export function evaluateCliSla(
  summary: TestSummary,
  results: RequestResult[],
  targets: SlaTarget[],
): SlaCheckResult[] {
  return targets.map((target) => {
    const scopeLabel = target.scenarioName
      ? `[${target.scenarioName}]`
      : target.featureGroupName
      ? `[FG: ${target.featureGroupName}]`
      : '[aggregate]';

    const label =
      (target.label ? `${target.label} ` : `${METRIC_LABEL[target.metric]} `) + scopeLabel;
    const threshold = formatThreshold(target);

    if (target.scenarioName) {
      const metrics = computeGroupMetrics(results, target.scenarioName, 'scenarioName');
      if (!metrics) return { label, metric: target.metric, actual: null, threshold, status: 'no-data' as SlaStatus };
      const actual = metrics[target.metric];
      return { label, metric: target.metric, actual, threshold, status: evaluateOne(target, actual) };
    }

    if (target.featureGroupName) {
      const metrics = computeGroupMetrics(results, target.featureGroupName, 'featureGroupName');
      if (!metrics) return { label, metric: target.metric, actual: null, threshold, status: 'no-data' as SlaStatus };
      const actual = metrics[target.metric];
      return { label, metric: target.metric, actual, threshold, status: evaluateOne(target, actual) };
    }

    // Aggregate: evaluate against TestSummary
    const actual = getMetricFromSummary(target.metric, summary);
    const status: SlaStatus = actual !== null ? evaluateOne(target, actual) : 'no-data';
    return { label, metric: target.metric, actual, threshold, status };
  });
}

/**
 * Derives the worst overall status from a list of checks.
 * Returns null when checks is empty.
 */
export function overallSlaStatus(checks: SlaCheckResult[]): SlaStatus | null {
  if (checks.length === 0) return null;
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  if (checks.some((c) => c.status === 'no-data')) return 'no-data';
  return 'pass';
}

/**
 * Print a formatted SLA evaluation report to stdout.
 * No-ops when quiet is true.
 */
export function printSlaReport(checks: SlaCheckResult[], quiet: boolean): void {
  if (quiet) return;

  const overall = overallSlaStatus(checks);
  const overallIcon = overall === 'pass' ? '✓' : overall === 'warn' ? '⚠' : overall === 'fail' ? '✗' : '?';

  console.log('');
  console.log('  SLA Evaluation:');
  console.log('  ─────────────────────────────────────────────────────────────');

  for (const c of checks) {
    const icon = c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : c.status === 'fail' ? '✗' : '?';
    const unit = METRIC_UNIT[c.metric];
    const actualStr = c.actual !== null ? `${c.actual.toFixed(1)}${unit}` : 'n/a';
    const padded = c.label.padEnd(42);
    console.log(`  ${icon} ${padded} ${actualStr.padStart(12)}  (target: ${c.threshold})`);
  }

  console.log('  ─────────────────────────────────────────────────────────────');

  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const passCount = checks.filter((c) => c.status === 'pass').length;

  if (overall === 'pass') {
    console.log(`  ${overallIcon} SLA: All ${passCount} target${passCount !== 1 ? 's' : ''} passing`);
  } else if (overall === 'warn') {
    const detail = [
      `${warnCount} warning${warnCount !== 1 ? 's' : ''}`,
      passCount > 0 ? `${passCount} passing` : '',
    ].filter(Boolean).join(', ');
    console.log(`  ${overallIcon} SLA: ${detail}`);
  } else if (overall === 'fail') {
    const detail = [
      `${failCount} violation${failCount !== 1 ? 's' : ''}`,
      warnCount > 0 ? `${warnCount} warning${warnCount !== 1 ? 's' : ''}` : '',
      passCount > 0 ? `${passCount} passing` : '',
    ].filter(Boolean).join(', ');
    console.log(`  ${overallIcon} SLA: ${detail}`);
  } else {
    console.log(`  ${overallIcon} SLA: No matching data`);
  }
  console.log('');
}
