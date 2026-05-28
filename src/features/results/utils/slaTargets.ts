/**
 * SLA Targets — persistent absolute performance thresholds.
 *
 * Unlike regression detection (relative, run-to-run), SLA targets are
 * absolute contracts: "P95 must always be ≤ 800 ms", "TPS must always be ≥ 50".
 * Targets are embedded in `TestConfig.slaTargets` at run time (definition-first),
 * or stored per-run (`sla-targets-run-{runId}`) for ad-hoc post-run overrides.
 */

import type { TestSummary, RequestResult, SlaMetric, SlaTarget, TestRun } from '../../../shared/types';
import { readKey, writeKey } from '../../../shared/utils/storage';

// Re-export shared types so callers can import from either location.
export type { SlaMetric, SlaTarget } from '../../../shared/types';

// ── Storage keys ──

const SLA_TARGETS_RUN_KEY = (runId: string): string =>
  `sla-targets-run-${runId}`;

// ── Types ──

/** Result of evaluating a single SlaTarget against a live TestSummary. */
export type SlaStatus = 'pass' | 'warn' | 'fail' | 'no-data';

export interface SlaCheck {
  target: SlaTarget;
  /** null when the metric is absent from the summary (e.g. p999 on old runs). */
  actual: number | null;
  status: SlaStatus;
}

// ── Per-scenario computation ──

/**
 * Per-scenario aggregate metrics computed from RequestResult[].
 * Extends Record<SlaMetric, number> so that fields can be indexed by
 * SlaMetric keys directly (field names match SlaMetric union values exactly).
 */
export interface ScenarioMetrics extends Record<SlaMetric, number> {
  scenarioName: string;
  /** Total result count for this scenario across all iterations/VUs. */
  count: number;
}

/**
 * Internal: computes aggregate metrics from a pre-filtered set of results.
 * The `label` is stored in `scenarioName` (works for both scenario names and FG names).
 */
function computeMetricsFromResults(
  filtered: RequestResult[],
  label: string,
): ScenarioMetrics {
  const durations = filtered.map((r) => r.responseTimeMs).sort((a, b) => a - b);
  const n = durations.length;

  const percentile = (p: number): number =>
    durations[Math.ceil((p / 100) * n) - 1];

  // Use .reduce() to avoid RangeError with spread on large arrays
  const minTs = filtered.reduce((m, r) => Math.min(m, r.timestamp), Infinity);
  const maxTs = filtered.reduce(
    (m, r) => Math.max(m, r.timestamp + r.responseTimeMs),
    -Infinity,
  );
  const durationSec = (maxTs - minTs) / 1000;
  const tps = durationSec > 0 ? n / durationSec : 0;

  const errored = filtered.filter((r) => !r.passed).length;
  const errorRate = (errored / n) * 100;

  return {
    scenarioName: label,
    count: n,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    p999: percentile(99.9),
    avg: durations.reduce((s, v) => s + v, 0) / n,
    tps,
    errorRate,
  };
}

/**
 * Computes aggregate metrics for one scenario by grouping RequestResult[].
 * Returns null when no results match the given scenarioName.
 *
 * Field usage from RequestResult:
 *   responseTimeMs — latency in ms (not responseTime)
 *   timestamp      — request start time in ms epoch (not startTime)
 *   passed         — boolean success flag (not success)
 */
export function computeScenarioMetrics(
  results: RequestResult[],
  scenarioName: string,
): ScenarioMetrics | null {
  const filtered = results.filter((r) => r.scenarioName === scenarioName);
  if (filtered.length === 0) return null;
  return computeMetricsFromResults(filtered, scenarioName);
}

/**
 * Returns all unique scenario names present in a result set.
 * scenarioName is a required string on RequestResult — no cast needed.
 */
export function extractScenarioNames(results: RequestResult[]): string[] {
  return [...new Set(results.map((r) => r.scenarioName))];
}

/**
 * Maps a SlaMetric key to its value in a ScenarioMetrics object.
 * Works because ScenarioMetrics field names match SlaMetric union values exactly.
 */
function getScenarioMetricValue(metric: SlaMetric, m: ScenarioMetrics): number {
  return m[metric];
}

/** Internal: evaluate SlaTargets against a ScenarioMetrics object. */
function evaluateSlaFromMetrics(
  metrics: ScenarioMetrics,
  targets: SlaTarget[],
): SlaCheck[] {
  return targets.map((target) => {
    const actual = getScenarioMetricValue(target.metric, metrics);
    return { target, actual, status: evaluateOne(target, actual) };
  });
}

/**
 * Evaluates SLA targets against a specific scenario's computed metrics.
 * Only targets whose scenarioName matches the scenario are evaluated.
 * Targets without scenarioName (aggregate fallbacks) are excluded here —
 * they are evaluated separately via evaluateSla() against TestSummary.
 */
export function evaluateSlaForScenario(
  scenarioMetrics: ScenarioMetrics,
  targets: SlaTarget[],
): SlaCheck[] {
  const scenarioTargets = targets.filter(
    (t) => t.scenarioName === scenarioMetrics.scenarioName,
  );
  return evaluateSlaFromMetrics(scenarioMetrics, scenarioTargets);
}

// ── Metadata constants ──

export const SLA_METRIC_LABELS: Record<SlaMetric, string> = {
  p50: 'P50 Response Time',
  p95: 'P95 Response Time',
  p99: 'P99 Response Time',
  p999: 'P99.9 Response Time',
  avg: 'Avg Response Time',
  tps: 'TPS',
  errorRate: 'Error Rate',
};

export const SLA_METRIC_UNITS: Record<SlaMetric, string> = {
  p50: 'ms',
  p95: 'ms',
  p99: 'ms',
  p999: 'ms',
  avg: 'ms',
  tps: '',
  errorRate: '%',
};

/** Default operator for each metric — reflects which direction is "better". */
export const SLA_METRIC_DEFAULT_OPERATOR: Record<SlaMetric, 'lte' | 'gte'> = {
  p50: 'lte',
  p95: 'lte',
  p99: 'lte',
  p999: 'lte',
  avg: 'lte',
  tps: 'gte',
  errorRate: 'lte',
};

// ── Evaluation ──

function getActualValue(metric: SlaMetric, summary: TestSummary): number | null {
  switch (metric) {
    case 'p50': return summary.p50ResponseTime;
    case 'p95': return summary.p95ResponseTime;
    case 'p99': return summary.p99ResponseTime;
    case 'p999': return summary.p999ResponseTime ?? null;
    case 'avg': return summary.avgResponseTime;
    case 'tps': return summary.tps;
    case 'errorRate': return summary.errorRate;
  }
}

function evaluateOne(target: SlaTarget, actual: number): SlaStatus {
  const { operator, value, warnAt } = target;

  if (operator === 'lte') {
    if (actual > value) return 'fail';
    if (warnAt !== undefined && actual > warnAt) return 'warn';
    return 'pass';
  } else {
    // gte
    if (actual < value) return 'fail';
    if (warnAt !== undefined && actual < warnAt) return 'warn';
    return 'pass';
  }
}

/**
 * Evaluate all SLA targets against a TestSummary.
 * Returns one SlaCheck per target, in the same order as the input array.
 */
export function evaluateSla(summary: TestSummary, targets: SlaTarget[]): SlaCheck[] {
  return targets.map((target) => {
    const actual = getActualValue(target.metric, summary);
    if (actual === null) {
      return { target, actual: null, status: 'no-data' };
    }
    return { target, actual, status: evaluateOne(target, actual) };
  });
}

/**
 * Derives the worst overall status from a set of checks.
 * fail > warn > no-data > pass.
 * Returns null when checks is empty (used to hide the SLA panel).
 */
export function overallSlaStatus(checks: SlaCheck[]): SlaStatus | null {
  if (checks.length === 0) return null;
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  if (checks.some((c) => c.status === 'no-data')) return 'no-data';
  return 'pass';
}

// ── Storage ──

// Per-run-scoped ad-hoc targets (keyed by runId, for post-run SLA overrides).

export async function loadRunSlaTargets(runId: string): Promise<SlaTarget[]> {
  try {
    const raw = await readKey(SLA_TARGETS_RUN_KEY(runId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SlaTarget[]) : [];
  } catch {
    return [];
  }
}

export async function saveRunSlaTargets(
  runId: string,
  targets: SlaTarget[],
): Promise<void> {
  await writeKey(SLA_TARGETS_RUN_KEY(runId), JSON.stringify(targets));
}

/**
 * Resolves which SLA targets apply to a given test run.
 *
 * Priority:
 *   1. Run-level — embedded in `config.slaTargets` at execution time (read-only in Results view).
 *   2. Per-run ad-hoc — stored post-run via the Results view editor (editable).
 *
 * Returns null when no targets are configured — the SLA panel shows empty state.
 */
export async function resolveTargetsForRun(
  testRun: TestRun,
): Promise<{ targets: SlaTarget[]; scope: 'run' | null } | null> {
  // 1. Run-level (embedded in config at execution time — read-only in Results view)
  if (testRun.config.slaTargets && testRun.config.slaTargets.length > 0) {
    return { targets: testRun.config.slaTargets, scope: 'run' };
  }

  // 2. Per-run ad-hoc storage (post-run targets set from the Results view editor).
  const runTargets = await loadRunSlaTargets(testRun.id);
  if (runTargets.length > 0) {
    return { targets: runTargets, scope: null };
  }

  return null; // no SLA configured — honest empty state
}

/**
 * Computes the overall SLA status for a test run by evaluating all applicable
 * targets (aggregate + per-scenario + per-feature-group) against the run's data.
 *
 * Returns null when no SLA targets are configured for the run. Returns the
 * worst status ('fail' > 'warn' > 'no-data' > 'pass') across all evaluated checks.
 *
 * Designed for use in run-list indicators — pass `testRun.results` directly to
 * avoid an extra async storage read.
 */
export async function computeRunSlaStatus(
  testRun: TestRun,
  results: RequestResult[],
): Promise<SlaStatus | null> {
  const resolved = await resolveTargetsForRun(testRun);
  if (!resolved) return null;

  const { targets } = resolved;

  // Aggregate targets (no scenarioName, no featureGroupName)
  const aggregateTargets = targets.filter(
    (t) => t.scenarioName === undefined && t.featureGroupName === undefined,
  );
  const allChecks: SlaCheck[] = evaluateSla(testRun.summary, aggregateTargets);

  // Scenario-specific targets
  const scenarioNames = extractScenarioNames(results);
  for (const name of scenarioNames) {
    const metrics = computeScenarioMetrics(results, name);
    if (metrics) {
      allChecks.push(...evaluateSlaForScenario(metrics, targets));
    }
  }

  // Feature-group-scoped targets (SLA-C3)
  const fgNames = [
    ...new Set(
      targets
        .filter((t) => t.featureGroupName && !t.scenarioName)
        .map((t) => t.featureGroupName!),
    ),
  ];
  for (const fgName of fgNames) {
    const fgMetrics = computeFeatureGroupMetrics(results, fgName);
    if (fgMetrics) {
      allChecks.push(...evaluateSlaForFeatureGroup(fgMetrics, targets));
    }
  }

  return overallSlaStatus(allChecks);
}

// ── Feature-group computation (SLA-C3) ──

/**
 * Computes aggregate metrics for all results belonging to a named feature group.
 * Returns null when no results match the given featureGroupName.
 *
 * The returned ScenarioMetrics stores the feature group name in the scenarioName
 * field so it can be passed to the internal evaluateSlaFromMetrics helper.
 */
export function computeFeatureGroupMetrics(
  results: RequestResult[],
  featureGroupName: string,
): ScenarioMetrics | null {
  const filtered = results.filter((r) => r.featureGroupName === featureGroupName);
  if (filtered.length === 0) return null;
  return computeMetricsFromResults(filtered, featureGroupName);
}

/**
 * Evaluates SLA targets against a specific feature group's computed metrics.
 * Only targets whose featureGroupName matches are evaluated.
 */
export function evaluateSlaForFeatureGroup(
  fgMetrics: ScenarioMetrics,
  targets: SlaTarget[],
): SlaCheck[] {
  const fgTargets = targets.filter(
    (t) => t.featureGroupName === fgMetrics.scenarioName,
  );
  return evaluateSlaFromMetrics(fgMetrics, fgTargets);
}

// ── SLA Tree (SLA-C3) ──

export interface SlaScenarioNode {
  scenarioName: string;
  /** Worst status across all checks for this scenario. null when checks is empty. */
  status: SlaStatus | null;
  /** SLA checks for scenario-scoped targets evaluated against this scenario's metrics. */
  checks: SlaCheck[];
}

export interface SlaFeatureNode {
  /**
   * Feature group name. Empty string '' represents ungrouped scenarios
   * (results with no featureGroupName or scenarios referenced only in targets).
   */
  featureGroupName: string;
  /** Worst status across feature-level checks + all child scenario checks. */
  status: SlaStatus | null;
  /** SLA checks for feature-group-scoped targets (targets with this featureGroupName). */
  featureChecks: SlaCheck[];
  /** Scenario nodes belonging to this feature group, sorted alphabetically. */
  scenarios: SlaScenarioNode[];
}

export interface SlaTree {
  /** Feature-group nodes. Named groups sorted alphabetically; '' (ungrouped) last. */
  featureNodes: SlaFeatureNode[];
  /**
   * Per-scenario nodes derived from aggregate targets when no per-test SLA targets exist
   * (e.g. CLI-imported runs). Evaluated the same way as featureNodes but not counted in
   * the summary pill totals — they provide drill-down context, not additional rule checks.
   */
  derivedFeatureNodes: SlaFeatureNode[];
  /** Run-aggregate checks (targets with no scenarioName and no featureGroupName). */
  aggregateChecks: SlaCheck[];
  /** Overall status for aggregate checks only. null when no aggregate targets. */
  aggregateStatus: SlaStatus | null;
  /** Worst status across all nodes (aggregate + features + scenarios). null when targets is empty. */
  overall: SlaStatus | null;
}

/**
 * Evaluates all SLA targets and returns a structured Feature → Scenario → Check tree.
 *
 * Target scope partitioning:
 *   - Aggregate:     no scenarioName, no featureGroupName → evaluated against TestSummary
 *   - Feature-group: featureGroupName set, no scenarioName → evaluated via computeFeatureGroupMetrics
 *   - Scenario:      scenarioName set → evaluated via computeScenarioMetrics
 *
 * Only scenarios and feature groups with at least one configured SLA target appear in
 * the tree. Feature group membership is derived from RequestResult.featureGroupName;
 * scenarios without a feature group (or referenced only in targets) go into '' (ungrouped).
 */
export function evaluateSlaTree(
  results: RequestResult[],
  summary: TestSummary,
  targets: SlaTarget[],
): SlaTree {
  if (targets.length === 0) {
    return { featureNodes: [], derivedFeatureNodes: [], aggregateChecks: [], aggregateStatus: null, overall: null };
  }

  // Partition targets by scope
  const aggregateTargets = targets.filter((t) => !t.scenarioName && !t.featureGroupName);
  const fgScopedTargets = targets.filter((t) => !!t.featureGroupName && !t.scenarioName);
  const scenarioScopedTargets = targets.filter((t) => !!t.scenarioName);

  // Evaluate aggregate targets against the run summary
  const aggregateChecks = evaluateSla(summary, aggregateTargets);
  const aggregateStatus = overallSlaStatus(aggregateChecks);

  // Build full scenario → featureGroup mapping from results
  const scenarioToFg = new Map<string, string>();
  for (const r of results) {
    if (!scenarioToFg.has(r.scenarioName)) {
      scenarioToFg.set(r.scenarioName, r.featureGroupName ?? '');
    }
  }
  // Also map scenarios referenced only in targets (not yet in results)
  for (const t of scenarioScopedTargets) {
    if (!scenarioToFg.has(t.scenarioName!)) {
      scenarioToFg.set(t.scenarioName!, '');
    }
  }

  // Collect FG keys that have at least one target (FG-scoped or scenario-scoped)
  const relevantFgKeys = new Set<string>();
  for (const t of fgScopedTargets) relevantFgKeys.add(t.featureGroupName!);
  for (const t of scenarioScopedTargets) {
    relevantFgKeys.add(scenarioToFg.get(t.scenarioName!) ?? '');
  }

  // Set of scenario names with at least one scenario-scoped target
  const scenariosWithTargets = new Set(scenarioScopedTargets.map((t) => t.scenarioName!));

  // Build feature nodes
  const featureNodes: SlaFeatureNode[] = [...relevantFgKeys].map((fgKey) => {
    // Feature-level checks for this FG
    const thisFgTargets = fgScopedTargets.filter((t) => t.featureGroupName === fgKey);
    const fgMetrics = fgKey ? computeFeatureGroupMetrics(results, fgKey) : null;
    const featureChecks: SlaCheck[] = fgMetrics
      ? evaluateSlaFromMetrics(fgMetrics, thisFgTargets)
      : thisFgTargets.map((t) => ({ target: t, actual: null, status: 'no-data' as SlaStatus }));

    // Scenarios in this FG that have at least one SLA target, sorted alphabetically
    const scenariosInFg = [...scenarioToFg.entries()]
      .filter(([sc, fg]) => fg === fgKey && scenariosWithTargets.has(sc))
      .map(([sc]) => sc)
      .sort();

    const scenarios: SlaScenarioNode[] = scenariosInFg.map((scenarioName) => {
      const thisScTargets = scenarioScopedTargets.filter((t) => t.scenarioName === scenarioName);
      const metrics = computeScenarioMetrics(results, scenarioName);
      const checks: SlaCheck[] = metrics
        ? evaluateSlaFromMetrics(metrics, thisScTargets)
        : thisScTargets.map((t) => ({ target: t, actual: null, status: 'no-data' as SlaStatus }));
      return {
        scenarioName,
        status: overallSlaStatus(checks),
        checks,
      };
    });

    const allFgChecks = [...featureChecks, ...scenarios.flatMap((s) => s.checks)];
    return {
      featureGroupName: fgKey,
      status: overallSlaStatus(allFgChecks),
      featureChecks,
      scenarios,
    };
  });

  // Sort: named groups alphabetically first, '' (ungrouped) last
  featureNodes.sort((a, b) => {
    if (a.featureGroupName === '' && b.featureGroupName !== '') return 1;
    if (a.featureGroupName !== '' && b.featureGroupName === '') return -1;
    return a.featureGroupName.localeCompare(b.featureGroupName);
  });

  // Derive per-scenario nodes from aggregate targets when no scenario/FG targets exist.
  // This gives aggregate-only runs (e.g. CLI imports) the same expandable scenario tree
  // as fully-configured Scenario Builder runs, without creating extra "rule" checks.
  const derivedFeatureNodes: SlaFeatureNode[] = [];
  if (featureNodes.length === 0 && aggregateTargets.length > 0) {
    const scenarioNames = [...new Set(results.map((r) => r.scenarioName).filter(Boolean))].sort();
    if (scenarioNames.length > 0) {
      const derivedScenarios: SlaScenarioNode[] = scenarioNames.map((scenarioName) => {
        const metrics = computeScenarioMetrics(results, scenarioName);
        const checks: SlaCheck[] = metrics
          ? evaluateSlaFromMetrics(metrics, aggregateTargets)
          : aggregateTargets.map((t) => ({ target: t, actual: null, status: 'no-data' as SlaStatus }));
        return { scenarioName, status: overallSlaStatus(checks), checks };
      });
      derivedFeatureNodes.push({
        featureGroupName: '',
        status: overallSlaStatus(derivedScenarios.flatMap((s) => s.checks)),
        featureChecks: [],
        scenarios: derivedScenarios,
      });
    }
  }

  // Overall status across everything
  const allChecks = [
    ...aggregateChecks,
    ...featureNodes.flatMap((fn) => [...fn.featureChecks, ...fn.scenarios.flatMap((s) => s.checks)]),
  ];
  const overall = overallSlaStatus(allChecks);

  return { featureNodes, derivedFeatureNodes, aggregateChecks, aggregateStatus, overall };
}
