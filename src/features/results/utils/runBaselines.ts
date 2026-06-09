/**
 * Run baselines & comparison utilities.
 *
 * Baselines are stored separately from test runs — a lightweight index
 * that references run IDs. The actual run data lives in IndexedDB.
 */

import { readKey, writeKey } from '../../../shared/utils/storage';
import type { TestRun, TestSummary } from '../../../shared/types';

// ── Storage ──

const BASELINES_KEY = 'perf-test-baselines';
const THRESHOLDS_KEY = 'perf-test-regression-thresholds';
const MAX_BASELINES = 10;

export interface BaselineMark {
  runId: string;
  label?: string;
  markedAt: number;
}

export async function loadBaselines(): Promise<BaselineMark[]> {
  try {
    const raw = await readKey(BASELINES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveBaselines(baselines: BaselineMark[]): Promise<void> {
  await writeKey(BASELINES_KEY, JSON.stringify(baselines));
}

export async function markAsBaseline(runId: string, label?: string): Promise<BaselineMark[]> {
  const baselines = await loadBaselines();
  // Don't duplicate
  if (baselines.some((b) => b.runId === runId)) return baselines;
  const entry: BaselineMark = { runId, markedAt: Date.now(), label };
  const next = [entry, ...baselines];
  const capped = next.length > MAX_BASELINES ? next.slice(0, MAX_BASELINES) : next;
  await saveBaselines(capped);
  return capped;
}

export async function unmarkBaseline(runId: string): Promise<BaselineMark[]> {
  const baselines = await loadBaselines();
  const next = baselines.filter((b) => b.runId !== runId);
  await saveBaselines(next);
  return next;
}

export async function renameBaseline(runId: string, label: string): Promise<BaselineMark[]> {
  const baselines = await loadBaselines();
  const next = baselines.map((b) => (b.runId === runId ? { ...b, label } : b));
  await saveBaselines(next);
  return next;
}

export function isBaseline(baselines: BaselineMark[], runId: string): boolean {
  return baselines.some((b) => b.runId === runId);
}

// ── Regression thresholds ──

export interface RegressionThresholds {
  p50Percent: number;
  p95Percent: number;
  p99Percent: number;
  p999Percent: number;
  avgPercent: number;
  errorRateAbsolute: number; // absolute percentage points
  tpsPercent: number;
}

export const DEFAULT_THRESHOLDS: RegressionThresholds = {
  p50Percent: 15,
  p95Percent: 10,
  p99Percent: 15,
  p999Percent: 20,
  avgPercent: 10,
  errorRateAbsolute: 1,
  tpsPercent: 10,
};

// ── Threshold persistence ──

export async function loadRegressionThresholds(): Promise<RegressionThresholds> {
  try {
    const raw = await readKey(THRESHOLDS_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };
    const parsed: Record<string, unknown> = JSON.parse(raw);
    // Only accept finite non-negative numbers; fall back to default for anything else
    const result = { ...DEFAULT_THRESHOLDS };
    for (const [k, v] of Object.entries(parsed)) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_THRESHOLDS, k) && typeof v === 'number' && isFinite(v) && v >= 0) {
        (result as Record<string, number>)[k] = v;
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

export async function saveRegressionThresholds(t: RegressionThresholds): Promise<void> {
  await writeKey(THRESHOLDS_KEY, JSON.stringify(t));
}

export async function resetRegressionThresholds(): Promise<void> {
  await writeKey(THRESHOLDS_KEY, JSON.stringify(DEFAULT_THRESHOLDS));
}

// ── Comparison ──

export interface MetricDelta {
  metric: string;
  baselineValue: number;
  currentValue: number;
  delta: number;       // absolute difference (current - baseline)
  deltaPercent: number; // percentage change
  improved: boolean;    // true if change is favorable
  regressed: boolean;   // true if change exceeds regression threshold
}

export interface ScenarioDelta {
  scenarioName: string;
  featureGroupName?: string;
  baselineAvgTime: number;
  currentAvgTime: number;
  baselineCount: number;
  currentCount: number;
  baselineErrorRate: number;
  currentErrorRate: number;
  timeDelta: number;
  timeDeltaPercent: number;
  regressed: boolean;
}

export interface RegressionAlert {
  metric: string;
  threshold: number;
  actual: number;
  severity: 'warning' | 'critical';
}

export interface RunComparison {
  baselineRun: TestRun;
  currentRun: TestRun;
  metricDeltas: MetricDelta[];
  scenarioDeltas: ScenarioDelta[];
  regressions: RegressionAlert[];
}

/**
 * Compare two runs and produce deltas, per-scenario breakdown, and regression alerts.
 */
export function compareRuns(
  baseline: TestRun,
  current: TestRun,
  thresholds: RegressionThresholds = DEFAULT_THRESHOLDS,
): RunComparison {
  const metricDeltas = computeMetricDeltas(baseline.summary, current.summary, thresholds);
  const scenarioDeltas = computeScenarioDeltas(baseline, current, thresholds);
  const regressions = detectRegressions(metricDeltas, baseline.summary, current.summary, thresholds);

  return {
    baselineRun: baseline,
    currentRun: current,
    metricDeltas,
    scenarioDeltas,
    regressions,
  };
}

function computeMetricDeltas(
  baseline: TestSummary,
  current: TestSummary,
  thresholds: RegressionThresholds,
): MetricDelta[] {
  const deltas: MetricDelta[] = [];

  // For response times: lower is better → improved = delta < 0
  const timeMetrics: Array<{ metric: string; bKey: keyof TestSummary; threshold: number }> = [
    { metric: 'Avg Response Time', bKey: 'avgResponseTime', threshold: thresholds.avgPercent },
    { metric: 'P50 Response Time', bKey: 'p50ResponseTime', threshold: thresholds.p50Percent },
    { metric: 'P95 Response Time', bKey: 'p95ResponseTime', threshold: thresholds.p95Percent },
    { metric: 'P99 Response Time', bKey: 'p99ResponseTime', threshold: thresholds.p99Percent },
    { metric: 'P99.9 Response Time', bKey: 'p999ResponseTime', threshold: thresholds.p999Percent },
    { metric: 'Min Response Time', bKey: 'minResponseTime', threshold: thresholds.avgPercent },
    { metric: 'Max Response Time', bKey: 'maxResponseTime', threshold: thresholds.avgPercent },
  ];

  for (const { metric, bKey, threshold } of timeMetrics) {
    const bVal = (baseline[bKey] as number) ?? 0;
    const cVal = (current[bKey] as number) ?? 0;
    const delta = cVal - bVal;
    const pct = bVal !== 0 ? (delta / bVal) * 100 : 0;
    deltas.push({
      metric,
      baselineValue: bVal,
      currentValue: cVal,
      delta: round2(delta),
      deltaPercent: round2(pct),
      // Keep status symmetric with regression detection:
      // only mark "Improved" when favorable change exceeds the same threshold.
      improved: pct < -threshold,
      regressed: pct > threshold,
    });
  }

  // TPS: higher is better → improved = delta > 0
  {
    const bVal = baseline.tps;
    const cVal = current.tps;
    const delta = cVal - bVal;
    const pct = bVal !== 0 ? (delta / bVal) * 100 : 0;
    deltas.push({
      metric: 'TPS',
      baselineValue: bVal,
      currentValue: cVal,
      delta: round2(delta),
      deltaPercent: round2(pct),
      improved: pct > thresholds.tpsPercent,
      regressed: pct < -thresholds.tpsPercent,
    });
  }

  // Error Rate: lower is better → improved = delta < 0
  {
    const bVal = baseline.errorRate;
    const cVal = current.errorRate;
    const delta = cVal - bVal;
    const pct = bVal !== 0 ? (delta / bVal) * 100 : 0;
    deltas.push({
      metric: 'Error Rate',
      baselineValue: bVal,
      currentValue: cVal,
      delta: round2(delta),
      deltaPercent: round2(pct),
      improved: delta < -thresholds.errorRateAbsolute,
      regressed: delta > thresholds.errorRateAbsolute,
    });
  }

  return deltas;
}

/**
 * Per-scenario comparison: group requests by scenarioName and compute avg time / error rate deltas.
 */
function computeScenarioDeltas(
  baseline: TestRun,
  current: TestRun,
  thresholds: RegressionThresholds,
): ScenarioDelta[] {
  const baselineScenarios = groupByScenario(baseline.results);
  const currentScenarios = groupByScenario(current.results);

  const allNames = new Set([...baselineScenarios.keys(), ...currentScenarios.keys()]);
  const deltas: ScenarioDelta[] = [];

  for (const name of allNames) {
    const bGroup = baselineScenarios.get(name);
    const cGroup = currentScenarios.get(name);

    const bAvg = bGroup ? avg(bGroup.times) : 0;
    const cAvg = cGroup ? avg(cGroup.times) : 0;
    const timeDelta = cAvg - bAvg;
    const timeDeltaPct = bAvg !== 0 ? (timeDelta / bAvg) * 100 : 0;

    deltas.push({
      scenarioName: name,
      featureGroupName: cGroup?.featureGroupName ?? bGroup?.featureGroupName,
      baselineAvgTime: round2(bAvg),
      currentAvgTime: round2(cAvg),
      baselineCount: bGroup?.count ?? 0,
      currentCount: cGroup?.count ?? 0,
      baselineErrorRate: round2(bGroup?.errorRate ?? 0),
      currentErrorRate: round2(cGroup?.errorRate ?? 0),
      timeDelta: round2(timeDelta),
      timeDeltaPercent: round2(timeDeltaPct),
      // Per-scenario comparison is on average response times, so use avgPercent threshold
      // (not p95Percent, which is for the P95 percentile summary metric).
      regressed: timeDeltaPct > thresholds.avgPercent,
    });
  }

  return deltas.sort((a, b) => b.timeDeltaPercent - a.timeDeltaPercent);
}

interface ScenarioGroup {
  times: number[];
  count: number;
  errorCount: number;
  errorRate: number;
  featureGroupName?: string;
}

function groupByScenario(results: TestRun['results']): Map<string, ScenarioGroup> {
  const map = new Map<string, ScenarioGroup>();
  for (const r of results) {
    if (r.cancelled) continue;
    let g = map.get(r.scenarioName);
    if (!g) {
      g = { times: [], count: 0, errorCount: 0, errorRate: 0, featureGroupName: r.featureGroupName };
      map.set(r.scenarioName, g);
    }
    g.times.push(r.responseTimeMs);
    g.count++;
    const isHttp = (r.transportType ?? 'http') === 'http';
    if (isHttp && (r.httpStatus >= 400 || r.httpStatus === 0)) g.errorCount++;
    else if (!isHttp && !r.passed) g.errorCount++;
  }
  for (const g of map.values()) {
    g.errorRate = g.count > 0 ? (g.errorCount / g.count) * 100 : 0;
  }
  return map;
}

function detectRegressions(
  deltas: MetricDelta[],
  baseline: TestSummary,
  current: TestSummary,
  thresholds: RegressionThresholds,
): RegressionAlert[] {
  const alerts: RegressionAlert[] = [];

  for (const d of deltas) {
    if (!d.regressed) continue;

    // Resolve the configured threshold for this specific metric.
    // Used for both severity determination (2x = critical) and the alert display.
    const configuredThreshold = d.metric === 'Error Rate' ? thresholds.errorRateAbsolute
      : d.metric === 'TPS' ? thresholds.tpsPercent
      : d.metric.includes('P99.9') ? thresholds.p999Percent
      : d.metric.includes('P95') ? thresholds.p95Percent
      : d.metric.includes('P99') ? thresholds.p99Percent
      : d.metric.includes('P50') ? thresholds.p50Percent
      : thresholds.avgPercent;

    let severity: 'warning' | 'critical' = 'warning';
    if (d.metric.includes('Response Time') && d.deltaPercent > configuredThreshold * 2) {
      severity = 'critical';
    }
    if (d.metric === 'Error Rate') {
      const errorDelta = current.errorRate - baseline.errorRate;
      if (errorDelta > configuredThreshold * 2) severity = 'critical';
    }
    if (d.metric === 'TPS' && d.deltaPercent < -configuredThreshold * 2) {
      severity = 'critical';
    }

    alerts.push({
      metric: d.metric,
      threshold: configuredThreshold,
      actual: d.metric === 'Error Rate' ? d.delta : Math.abs(d.deltaPercent),
      severity,
    });
  }

  return alerts;
}

// ── Trend Analysis ──

export interface TrendPoint {
  runId: string;
  timestamp: number;
  label?: string;
  tps: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  p999ResponseTime: number;
  errorRate: number;
  totalRequests: number;
}

/**
 * Extract trend data points from a list of runs (newest first → reversed to chronological).
 */
export function computeTrend(runs: TestRun[], baselines: BaselineMark[]): TrendPoint[] {
  return [...runs].reverse().map((r) => {
    const bl = baselines.find((b) => b.runId === r.id);
    return {
      runId: r.id,
      timestamp: r.timestamp,
      label: bl?.label,
      tps: r.summary.tps,
      avgResponseTime: r.summary.avgResponseTime,
      p50ResponseTime: r.summary.p50ResponseTime ?? 0,
      p95ResponseTime: r.summary.p95ResponseTime,
      p99ResponseTime: r.summary.p99ResponseTime,
      p999ResponseTime: r.summary.p999ResponseTime ?? r.summary.p99ResponseTime ?? 0,
      errorRate: r.summary.errorRate,
      totalRequests: r.summary.totalRequests,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return round2(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ── Sprint 2: Trend scoping + per-scenario trend ──

/** Keys of TrendPoint that represent numeric metrics (usable as chart dataKey). */
export type TrendMetric =
  | 'tps'
  | 'avgResponseTime'
  | 'p50ResponseTime'
  | 'p95ResponseTime'
  | 'p99ResponseTime'
  | 'p999ResponseTime'
  | 'errorRate';

/**
 * How to scope the trend to runs comparable to the reference run.
 * - 'all'      — all runs (no filter)
 * - 'service'  — runs sharing the same svcName
 * - 'env'      — runs sharing the same svcName + envName
 * - 'workflow' — runs sharing the same workflowName
 */
export type TrendScope = 'all' | 'service' | 'env' | 'workflow';

/** A single data point for a per-scenario trend series. */
export interface ScenarioTrendPoint {
  timestamp: number;
  runId: string;
  avgTime: number;
  isBaseline: boolean;
}

/**
 * Filter runs to those sharing the same suite context as the reference run.
 * scope='all' returns the original array unchanged (no allocation).
 */
function filterByScope(runs: TestRun[], reference: TestRun, scope: TrendScope): TestRun[] {
  if (scope === 'all') return runs;
  return runs.filter((r) => {
    if (scope === 'service') return r.svcName === reference.svcName;
    if (scope === 'env') return r.envName === reference.envName && r.svcName === reference.svcName;
    if (scope === 'workflow') return r.workflowName === reference.workflowName;
    return true;
  });
}

/**
 * Like computeTrend but limits runs to those that share the same suite context
 * as the reference run (determined by `scope`).
 */
export function computeScopedTrend(
  runs: TestRun[],
  reference: TestRun,
  scope: TrendScope,
  baselines: BaselineMark[],
): TrendPoint[] {
  return computeTrend(filterByScope(runs, reference, scope), baselines);
}

/**
 * Per-scenario trend: one series per unique scenario name across the scoped runs.
 * Returns up to `topN` scenarios ordered by total request count.
 * Keys in the returned map are numeric indices (`s0`, `s1`, ...) — use the parallel
 * `scenarioNames` array (same order) to look up display names.
 */
export function computePerScenarioTrend(
  runs: TestRun[],
  reference: TestRun,
  scope: TrendScope,
  baselines: BaselineMark[],
  topN = 8,
): { seriesKeys: string[]; scenarioNames: string[]; data: Record<string, ScenarioTrendPoint[]> } {
  const baselineIds = new Set(baselines.map((b) => b.runId));
  const filtered = filterByScope(runs, reference, scope);

  // Count total requests per scenario name across all filtered runs
  const scenarioCounts = new Map<string, number>();
  for (const run of filtered) {
    for (const result of run.results) {
      if (result.cancelled) continue;
      scenarioCounts.set(result.scenarioName, (scenarioCounts.get(result.scenarioName) ?? 0) + 1);
    }
  }

  const topScenarios = [...scenarioCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  if (topScenarios.length === 0) return { seriesKeys: [], scenarioNames: [], data: {} };

  // Use safe index-based keys (s0, s1, …) so Recharts dataKey never misparses
  // scenario names that contain dots, slashes, or brackets.
  const seriesKeys = topScenarios.map((_, i) => `s${i}`);
  const data: Record<string, ScenarioTrendPoint[]> = {};
  for (const key of seriesKeys) data[key] = [];

  // Chronological order (oldest first)
  const chronological = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
  for (const run of chronological) {
    const groups = groupByScenario(run.results);
    for (let i = 0; i < topScenarios.length; i++) {
      const g = groups.get(topScenarios[i]);
      if (g) {
        data[seriesKeys[i]].push({
          timestamp: run.timestamp,
          runId: run.id,
          avgTime: avg(g.times),
          isBaseline: baselineIds.has(run.id),
        });
      }
    }
  }

  return { seriesKeys, scenarioNames: topScenarios, data };
}

// ── Sprint 2: Per-run regression status ──

/** Regression status of a run compared to its nearest prior baseline. */
export type RunRegressionStatus = 'pass' | 'warn' | 'critical' | 'no-baseline';

/**
 * Find the most recent baseline run that is chronologically older than `run`.
 */
function findNearestBaseline(
  run: TestRun,
  allRuns: TestRun[],
  baselines: BaselineMark[],
): TestRun | null {
  const baselineIds = new Set(baselines.map((b) => b.runId));
  const isWorkflow = run.config.executionMode === 'workflow';
  // Candidates: baseline runs strictly older than this run AND of the same run-type class
  // (workflow vs non-workflow). Comparing across types produces meaningless regression status.
  const candidates = allRuns.filter(
    (r) => baselineIds.has(r.id) &&
      r.timestamp < run.timestamp &&
      (r.config.executionMode === 'workflow') === isWorkflow,
  );
  if (candidates.length === 0) return null;
  // Most recent candidate
  return candidates.reduce((best, r) => (r.timestamp > best.timestamp ? r : best));
}

/**
 * Compute the regression status of `run` against its nearest prior baseline.
 * Returns 'no-baseline' when no applicable baseline exists.
 */
export function computeRunRegressionStatus(
  run: TestRun,
  allRuns: TestRun[],
  baselines: BaselineMark[],
  thresholds: RegressionThresholds = DEFAULT_THRESHOLDS,
): RunRegressionStatus {
  const nearestBaseline = findNearestBaseline(run, allRuns, baselines);
  if (!nearestBaseline) return 'no-baseline';
  const comparison = compareRuns(nearestBaseline, run, thresholds);
  if (comparison.regressions.some((r) => r.severity === 'critical')) return 'critical';
  if (comparison.regressions.length > 0) return 'warn';
  return 'pass';
}
