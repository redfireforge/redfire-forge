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
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
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
    { metric: 'Min Response Time', bKey: 'minResponseTime', threshold: 999 },
    { metric: 'Max Response Time', bKey: 'maxResponseTime', threshold: 999 },
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
      improved: delta < 0,
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
      improved: delta > 0,
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
      improved: delta < 0,
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
      regressed: timeDeltaPct > thresholds.p95Percent,
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
    let g = map.get(r.scenarioName);
    if (!g) {
      g = { times: [], count: 0, errorCount: 0, errorRate: 0, featureGroupName: r.featureGroupName };
      map.set(r.scenarioName, g);
    }
    g.times.push(r.responseTimeMs);
    g.count++;
    if (r.httpStatus >= 400 || r.httpStatus === 0) g.errorCount++;
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

    let severity: 'warning' | 'critical' = 'warning';
    // Critical if regression is 2x the threshold
    if (d.metric.includes('Response Time') && d.deltaPercent > 0) {
      const thresholdVal = d.metric.includes('P99.9') ? thresholds.p999Percent
        : d.metric.includes('P95') ? thresholds.p95Percent
        : d.metric.includes('P99') ? thresholds.p99Percent
        : d.metric.includes('P50') ? thresholds.p50Percent
        : thresholds.avgPercent;
      if (d.deltaPercent > thresholdVal * 2) severity = 'critical';
    }
    if (d.metric === 'Error Rate') {
      const errorDelta = current.errorRate - baseline.errorRate;
      if (errorDelta > thresholds.errorRateAbsolute * 2) severity = 'critical';
    }
    if (d.metric === 'TPS' && d.deltaPercent < -thresholds.tpsPercent * 2) {
      severity = 'critical';
    }

    alerts.push({
      metric: d.metric,
      threshold: d.metric === 'Error Rate' ? thresholds.errorRateAbsolute : Math.abs(d.deltaPercent),
      actual: d.metric === 'Error Rate' ? d.delta : d.deltaPercent,
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
