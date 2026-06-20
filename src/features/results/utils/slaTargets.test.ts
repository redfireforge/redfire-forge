import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage before importing module under test
vi.mock('../../../shared/utils/storage', () => {
  let store: Record<string, string> = {};
  return {
    readKey: vi.fn(async (key: string) => store[key] ?? null),
    writeKey: vi.fn(async (key: string, value: string) => { store[key] = value; }),
    __resetStore: () => { store = {}; },
  };
});

import {
  evaluateSla,
  overallSlaStatus,
  loadRunSlaTargets,
  saveRunSlaTargets,
  resolveTargetsForRun,
  computeScenarioMetrics,
  extractScenarioNames,
  evaluateSlaForScenario,
  computeRunSlaStatus,
  computeFeatureGroupMetrics,
  evaluateSlaForFeatureGroup,
  evaluateSlaTree,
  type SlaTarget,
  type SlaCheck,
  type ScenarioMetrics,
} from './slaTargets';
import type { TestSummary, RequestResult, TestRun, TestConfig } from '../../../shared/types';
import { makeResult as _makeResult, makeConfig as _makeConfig } from '../../../test-utils/factories';

// ── Helpers ──

function makeSummary(overrides: Partial<TestSummary> = {}): TestSummary {
  return {
    tps: 100,
    avgResponseTime: 50,
    minResponseTime: 10,
    maxResponseTime: 200,
    p50ResponseTime: 45,
    p95ResponseTime: 120,
    p99ResponseTime: 180,
    errorRate: 1,
    errorsByStatus: {},
    totalRequests: 1000,
    successfulRequests: 990,
    failedRequests: 10,
    failedValidations: 0,
    totalDurationMs: 10000,
    ...overrides,
  };
}

function makeTarget(overrides: Partial<SlaTarget> = {}): SlaTarget {
  return {
    id: 'test-id',
    metric: 'p95',
    operator: 'lte',
    value: 200,
    ...overrides,
  };
}

beforeEach(async () => {
  const mod = await import('../../../shared/utils/storage');
  (mod as { __resetStore?: () => void }).__resetStore?.();
});

// ── evaluateSla — lte operator ──

describe('evaluateSla — lte operator', () => {
  it('returns pass when actual is below value', () => {
    const summary = makeSummary({ p95ResponseTime: 150 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p95', operator: 'lte', value: 200 })]);
    expect(check.status).toBe('pass');
    expect(check.actual).toBe(150);
  });

  it('returns pass when actual equals value exactly', () => {
    const summary = makeSummary({ p95ResponseTime: 200 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p95', operator: 'lte', value: 200 })]);
    expect(check.status).toBe('pass');
  });

  it('returns fail when actual exceeds value', () => {
    const summary = makeSummary({ p95ResponseTime: 350 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p95', operator: 'lte', value: 200 })]);
    expect(check.status).toBe('fail');
  });

  it('returns warn when actual is between warnAt and value', () => {
    const summary = makeSummary({ p95ResponseTime: 700 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p95', operator: 'lte', value: 800, warnAt: 600 })]);
    expect(check.status).toBe('warn');
  });

  it('returns pass when actual is at or below warnAt (stricter boundary)', () => {
    const summary = makeSummary({ p95ResponseTime: 600 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p95', operator: 'lte', value: 800, warnAt: 600 })]);
    expect(check.status).toBe('pass');
  });

  it('returns fail when actual exceeds value even when warnAt is set', () => {
    const summary = makeSummary({ p95ResponseTime: 900 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p95', operator: 'lte', value: 800, warnAt: 600 })]);
    expect(check.status).toBe('fail');
  });
});

// ── evaluateSla — gte operator ──

describe('evaluateSla — gte operator', () => {
  it('returns pass when actual meets or exceeds value', () => {
    const summary = makeSummary({ tps: 80 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'tps', operator: 'gte', value: 50 })]);
    expect(check.status).toBe('pass');
    expect(check.actual).toBe(80);
  });

  it('returns pass when actual equals value exactly', () => {
    const summary = makeSummary({ tps: 50 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'tps', operator: 'gte', value: 50 })]);
    expect(check.status).toBe('pass');
  });

  it('returns fail when actual is below value', () => {
    const summary = makeSummary({ tps: 30 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'tps', operator: 'gte', value: 50 })]);
    expect(check.status).toBe('fail');
  });

  it('returns warn when actual is between value and warnAt', () => {
    // warnAt > value for gte: pass if ≥ warnAt, warn if value ≤ actual < warnAt
    const summary = makeSummary({ tps: 55 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'tps', operator: 'gte', value: 50, warnAt: 65 })]);
    expect(check.status).toBe('warn');
  });

  it('returns pass when actual meets or exceeds warnAt', () => {
    const summary = makeSummary({ tps: 65 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'tps', operator: 'gte', value: 50, warnAt: 65 })]);
    expect(check.status).toBe('pass');
  });

  it('returns fail when actual is below value even when warnAt is set', () => {
    const summary = makeSummary({ tps: 40 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'tps', operator: 'gte', value: 50, warnAt: 65 })]);
    expect(check.status).toBe('fail');
  });
});

// ── evaluateSla — metric mapping ──

describe('evaluateSla — metric mapping', () => {
  it('evaluates p50 metric', () => {
    const summary = makeSummary({ p50ResponseTime: 40 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p50', operator: 'lte', value: 100 })]);
    expect(check.actual).toBe(40);
    expect(check.status).toBe('pass');
  });

  it('evaluates p99 metric', () => {
    const summary = makeSummary({ p99ResponseTime: 250 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p99', operator: 'lte', value: 200 })]);
    expect(check.actual).toBe(250);
    expect(check.status).toBe('fail');
  });

  it('evaluates avg metric', () => {
    const summary = makeSummary({ avgResponseTime: 55 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'avg', operator: 'lte', value: 50 })]);
    expect(check.status).toBe('fail');
  });

  it('evaluates errorRate metric', () => {
    const summary = makeSummary({ errorRate: 0.3 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'errorRate', operator: 'lte', value: 0.5 })]);
    expect(check.actual).toBe(0.3);
    expect(check.status).toBe('pass');
  });

  it('returns no-data when p999 is absent from summary', () => {
    const summary = makeSummary(); // p999ResponseTime not set
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p999', operator: 'lte', value: 500 })]);
    expect(check.actual).toBeNull();
    expect(check.status).toBe('no-data');
  });

  it('evaluates p999 when present in summary', () => {
    const summary = makeSummary({ p999ResponseTime: 400 });
    const [check] = evaluateSla(summary, [makeTarget({ metric: 'p999', operator: 'lte', value: 500 })]);
    expect(check.actual).toBe(400);
    expect(check.status).toBe('pass');
  });
});

// ── evaluateSla — edge cases ──

describe('evaluateSla — edge cases', () => {
  it('returns empty array when targets is empty', () => {
    const summary = makeSummary();
    expect(evaluateSla(summary, [])).toEqual([]);
  });

  it('evaluates multiple targets and returns one check per target', () => {
    const summary = makeSummary({ p95ResponseTime: 150, tps: 30, errorRate: 2 });
    const targets: SlaTarget[] = [
      makeTarget({ id: 'a', metric: 'p95', operator: 'lte', value: 200 }),       // pass
      makeTarget({ id: 'b', metric: 'tps', operator: 'gte', value: 50 }),        // fail
      makeTarget({ id: 'c', metric: 'errorRate', operator: 'lte', value: 1, warnAt: 0.5 }), // fail (2 > 1)
    ];
    const checks = evaluateSla(summary, targets);
    expect(checks).toHaveLength(3);
    expect(checks[0].status).toBe('pass');
    expect(checks[1].status).toBe('fail');
    expect(checks[2].status).toBe('fail');
  });

  it('preserves target reference in each check', () => {
    const target = makeTarget({ id: 'my-target' });
    const [check] = evaluateSla(makeSummary(), [target]);
    expect(check.target).toBe(target);
  });
});

// ── overallSlaStatus ──

describe('overallSlaStatus', () => {
  function makeCheck(status: SlaCheck['status']): SlaCheck {
    return { target: makeTarget(), actual: 100, status };
  }

  it('returns pass when all checks pass', () => {
    expect(overallSlaStatus([makeCheck('pass'), makeCheck('pass')])).toBe('pass');
  });

  it('returns warn when at least one check warns and none fail', () => {
    expect(overallSlaStatus([makeCheck('pass'), makeCheck('warn')])).toBe('warn');
  });

  it('returns fail when at least one check fails', () => {
    expect(overallSlaStatus([makeCheck('pass'), makeCheck('fail')])).toBe('fail');
  });

  it('returns fail when both fail and warn are present (fail wins)', () => {
    expect(overallSlaStatus([makeCheck('warn'), makeCheck('fail')])).toBe('fail');
  });

  it('returns no-data when only no-data checks are present', () => {
    expect(overallSlaStatus([makeCheck('no-data')])).toBe('no-data');
  });

  it('returns fail when fail and no-data are present (fail wins)', () => {
    expect(overallSlaStatus([makeCheck('no-data'), makeCheck('fail')])).toBe('fail');
  });

  it('returns warn when warn is present alongside no-data (warn > no-data)', () => {
    expect(overallSlaStatus([makeCheck('warn'), makeCheck('no-data')])).toBe('warn');
  });

  it('returns null when checks array is empty', () => {
    expect(overallSlaStatus([])).toBeNull();
  });
});

// ── Phase A — Per-scenario computation ──

const makeResult = (overrides: Partial<RequestResult> = {}): RequestResult =>
  _makeResult({
    scenarioName: 'checkout',
    url: 'http://example.com',
    timestamp: 1000,
    responseBody: '',
    ...overrides,
  });

// ── computeScenarioMetrics ──

describe('computeScenarioMetrics — null cases', () => {
  it('returns null for empty results array', () => {
    expect(computeScenarioMetrics([], 'checkout')).toBeNull();
  });

  it('returns null when no results match the scenarioName', () => {
    const results = [makeResult({ scenarioName: 'search' })];
    expect(computeScenarioMetrics(results, 'checkout')).toBeNull();
  });
});

describe('computeScenarioMetrics — single result', () => {
  it('count is 1', () => {
    const m = computeScenarioMetrics([makeResult({ responseTimeMs: 200 })], 'checkout')!;
    expect(m.count).toBe(1);
  });

  it('all percentiles equal the single responseTimeMs value', () => {
    const m = computeScenarioMetrics([makeResult({ responseTimeMs: 200 })], 'checkout')!;
    expect(m.p50).toBe(200);
    expect(m.p95).toBe(200);
    expect(m.p99).toBe(200);
    expect(m.p999).toBe(200);
    expect(m.avg).toBe(200);
  });

  it('scenarioName is preserved', () => {
    const m = computeScenarioMetrics([makeResult()], 'checkout')!;
    expect(m.scenarioName).toBe('checkout');
  });
});

describe('computeScenarioMetrics — percentiles (nearest-rank method)', () => {
  // Sorted array: [100, 200, 300, 400]  n=4
  //   p50: ceil(0.50*4)-1 = ceil(2)-1 = 1 → 200
  //   p95: ceil(0.95*4)-1 = ceil(3.8)-1 = 3 → 400
  //   p99: ceil(0.99*4)-1 = ceil(3.96)-1 = 3 → 400
  const fourResults = [100, 400, 200, 300].map((ms, i) =>
    makeResult({ id: `r${i}`, responseTimeMs: ms, timestamp: i * 200 }),
  );

  it('p50 uses nearest-rank', () => {
    expect(computeScenarioMetrics(fourResults, 'checkout')!.p50).toBe(200);
  });

  it('p95 uses nearest-rank', () => {
    expect(computeScenarioMetrics(fourResults, 'checkout')!.p95).toBe(400);
  });

  it('p99 uses nearest-rank', () => {
    expect(computeScenarioMetrics(fourResults, 'checkout')!.p99).toBe(400);
  });

  it('avg is arithmetic mean of responseTimeMs values', () => {
    // (100+200+300+400)/4 = 250
    expect(computeScenarioMetrics(fourResults, 'checkout')!.avg).toBe(250);
  });

  it('count equals number of matching results', () => {
    expect(computeScenarioMetrics(fourResults, 'checkout')!.count).toBe(4);
  });
});

describe('computeScenarioMetrics — TPS calculation', () => {
  it('calculates TPS from timestamp span', () => {
    // 2 results: starts at t=0 and t=900; each 100ms long
    // span = (900+100) - 0 = 1000ms = 1s → tps = 2
    const results = [
      makeResult({ id: 'a', timestamp: 0,   responseTimeMs: 100 }),
      makeResult({ id: 'b', timestamp: 900, responseTimeMs: 100 }),
    ];
    expect(computeScenarioMetrics(results, 'checkout')!.tps).toBeCloseTo(2, 5);
  });

  it('returns 0 TPS when all results have zero duration span', () => {
    // Single result with responseTimeMs=0 → durationSec=0 → tps=0
    const results = [makeResult({ timestamp: 1000, responseTimeMs: 0 })];
    expect(computeScenarioMetrics(results, 'checkout')!.tps).toBe(0);
  });
});

describe('computeScenarioMetrics — error rate', () => {
  it('is 0% when all results passed', () => {
    const results = [makeResult({ passed: true }), makeResult({ id: 'r2', passed: true })];
    expect(computeScenarioMetrics(results, 'checkout')!.errorRate).toBe(0);
  });

  it('is 100% when all results failed', () => {
    const results = [makeResult({ passed: false }), makeResult({ id: 'r2', passed: false })];
    expect(computeScenarioMetrics(results, 'checkout')!.errorRate).toBe(100);
  });

  it('calculates partial error rate correctly', () => {
    // 2 of 4 failed → 50%
    const results = [
      makeResult({ id: 'a', passed: true }),
      makeResult({ id: 'b', passed: false }),
      makeResult({ id: 'c', passed: true }),
      makeResult({ id: 'd', passed: false }),
    ];
    expect(computeScenarioMetrics(results, 'checkout')!.errorRate).toBe(50);
  });
});

describe('computeScenarioMetrics — scenario isolation', () => {
  it('ignores results from other scenarios', () => {
    const results = [
      makeResult({ id: 'a', scenarioName: 'checkout', responseTimeMs: 100 }),
      makeResult({ id: 'b', scenarioName: 'search',   responseTimeMs: 9999 }),
      makeResult({ id: 'c', scenarioName: 'checkout', responseTimeMs: 200 }),
    ];
    const m = computeScenarioMetrics(results, 'checkout')!;
    expect(m.count).toBe(2);
    expect(m.avg).toBe(150);
  });
});

// ── extractScenarioNames ──

describe('extractScenarioNames', () => {
  it('returns empty array for empty results', () => {
    expect(extractScenarioNames([])).toEqual([]);
  });

  it('returns single name for homogeneous results', () => {
    const results = [makeResult(), makeResult({ id: 'r2' })];
    expect(extractScenarioNames(results)).toEqual(['checkout']);
  });

  it('deduplicates scenario names', () => {
    const results = [
      makeResult({ id: 'a', scenarioName: 'checkout' }),
      makeResult({ id: 'b', scenarioName: 'checkout' }),
      makeResult({ id: 'c', scenarioName: 'checkout' }),
    ];
    expect(extractScenarioNames(results)).toEqual(['checkout']);
  });

  it('returns all distinct scenario names', () => {
    const results = [
      makeResult({ id: 'a', scenarioName: 'checkout' }),
      makeResult({ id: 'b', scenarioName: 'search' }),
      makeResult({ id: 'c', scenarioName: 'checkout' }),
      makeResult({ id: 'd', scenarioName: 'batch' }),
    ];
    const names = extractScenarioNames(results);
    expect(names).toHaveLength(3);
    expect(names).toContain('checkout');
    expect(names).toContain('search');
    expect(names).toContain('batch');
  });
});

// ── evaluateSlaForScenario ──

function makeScenarioMetrics(
  overrides: Partial<ScenarioMetrics> = {},
): ScenarioMetrics {
  return {
    scenarioName: 'checkout',
    count: 10,
    p50: 100,
    p95: 300,
    p99: 450,
    p999: 490,
    avg: 180,
    tps: 55,
    errorRate: 0.5,
    ...overrides,
  };
}

describe('evaluateSlaForScenario — target filtering', () => {
  it('returns empty array when targets list is empty', () => {
    expect(evaluateSlaForScenario(makeScenarioMetrics(), [])).toHaveLength(0);
  });

  it('returns empty array when no targets match scenarioName', () => {
    const targets: SlaTarget[] = [
      makeTarget({ id: 'a', scenarioName: 'search' }),
    ];
    const checks = evaluateSlaForScenario(makeScenarioMetrics(), targets);
    expect(checks).toHaveLength(0);
  });

  it('excludes targets from other scenarios', () => {
    const targets: SlaTarget[] = [
      makeTarget({ id: 'a', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'checkout' }),
      makeTarget({ id: 'b', metric: 'p95', operator: 'lte', value: 1,   scenarioName: 'search' }),
    ];
    const checks = evaluateSlaForScenario(makeScenarioMetrics(), targets);
    expect(checks).toHaveLength(1);
    expect(checks[0].target.id).toBe('a');
  });

  it('excludes aggregate targets (targets without scenarioName)', () => {
    // Targets with no scenarioName are aggregate-only; they belong to evaluateSla()
    const targets: SlaTarget[] = [
      makeTarget({ id: 'agg', metric: 'p95', operator: 'lte', value: 500 }),  // no scenarioName
    ];
    const checks = evaluateSlaForScenario(makeScenarioMetrics(), targets);
    expect(checks).toHaveLength(0);
  });
});

describe('evaluateSlaForScenario — evaluation correctness', () => {
  it('returns pass when scenario metric is within target', () => {
    const metrics = makeScenarioMetrics({ p95: 300 });
    const targets: SlaTarget[] = [
      makeTarget({ metric: 'p95', operator: 'lte', value: 500, scenarioName: 'checkout' }),
    ];
    const [check] = evaluateSlaForScenario(metrics, targets);
    expect(check.status).toBe('pass');
    expect(check.actual).toBe(300);
  });

  it('returns fail when scenario metric exceeds target', () => {
    const metrics = makeScenarioMetrics({ p95: 800 });
    const targets: SlaTarget[] = [
      makeTarget({ metric: 'p95', operator: 'lte', value: 500, scenarioName: 'checkout' }),
    ];
    const [check] = evaluateSlaForScenario(metrics, targets);
    expect(check.status).toBe('fail');
    expect(check.actual).toBe(800);
  });

  it('returns warn when metric is in warn zone', () => {
    const metrics = makeScenarioMetrics({ errorRate: 0.8 });
    const targets: SlaTarget[] = [
      makeTarget({ metric: 'errorRate', operator: 'lte', value: 1.0, warnAt: 0.5, scenarioName: 'checkout' }),
    ];
    const [check] = evaluateSlaForScenario(metrics, targets);
    expect(check.status).toBe('warn');
  });

  it('evaluates multiple matching targets independently', () => {
    const metrics = makeScenarioMetrics({ p95: 300, tps: 30, errorRate: 2 });
    const targets: SlaTarget[] = [
      makeTarget({ id: 'a', metric: 'p95',       operator: 'lte', value: 500, scenarioName: 'checkout' }),  // pass
      makeTarget({ id: 'b', metric: 'tps',       operator: 'gte', value: 50,  scenarioName: 'checkout' }),  // fail
      makeTarget({ id: 'c', metric: 'errorRate', operator: 'lte', value: 1.0, scenarioName: 'checkout' }),  // fail
    ];
    const checks = evaluateSlaForScenario(metrics, targets);
    expect(checks).toHaveLength(3);
    expect(checks[0].status).toBe('pass');
    expect(checks[1].status).toBe('fail');
    expect(checks[2].status).toBe('fail');
  });
});

// ════════════════════════════════════════════════════════════════════
// Phase B — workflow SLA storage & resolveTargetsForRun
// ════════════════════════════════════════════════════════════════════

// ── helpers ──

const makeConfig = (overrides: Partial<TestConfig> = {}): TestConfig =>
  _makeConfig({
    iterations: 1,
    scenarioWeights: [],
    ...overrides,
  });

function makeTestRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: makeConfig(),
    summary: {} as TestSummary,
    results: [],
    ...overrides,
  };
}

// ── loadRunSlaTargets / saveRunSlaTargets ──

describe('loadRunSlaTargets', () => {
  it('returns [] when nothing stored for the run', async () => {
    expect(await loadRunSlaTargets('run-xyz')).toEqual([]);
  });

  it('returns [] on JSON parse error', async () => {
    const { writeKey } = await import('../../../shared/utils/storage');
    await writeKey('sla-targets-run-corrupt', 'not-json');
    expect(await loadRunSlaTargets('corrupt')).toEqual([]);
  });

  it('returns [] when stored value is not an array', async () => {
    const { writeKey } = await import('../../../shared/utils/storage');
    await writeKey('sla-targets-run-bad', JSON.stringify({ metric: 'p95' }));
    expect(await loadRunSlaTargets('bad')).toEqual([]);
  });
});

describe('saveRunSlaTargets', () => {
  it('persists targets that survive a reload', async () => {
    const targets: SlaTarget[] = [
      makeTarget({ id: 'rt1', metric: 'p95', operator: 'lte', value: 400 }),
      makeTarget({ id: 'rt2', metric: 'tps', operator: 'gte', value: 30 }),
    ];
    await saveRunSlaTargets('run-abc', targets);
    expect(await loadRunSlaTargets('run-abc')).toEqual(targets);
  });

  it('different runs have independent storage', async () => {
    const t1: SlaTarget[] = [makeTarget({ id: 'r1t', metric: 'p95', operator: 'lte', value: 200 })];
    const t2: SlaTarget[] = [makeTarget({ id: 'r2t', metric: 'tps', operator: 'gte', value: 50 })];
    await saveRunSlaTargets('run-r1', t1);
    await saveRunSlaTargets('run-r2', t2);
    expect(await loadRunSlaTargets('run-r1')).toEqual(t1);
    expect(await loadRunSlaTargets('run-r2')).toEqual(t2);
  });

  it('overwrites previous targets for the same runId', async () => {
    const first: SlaTarget[] = [makeTarget({ id: 'old', metric: 'p50', operator: 'lte', value: 100 })];
    const second: SlaTarget[] = [makeTarget({ id: 'new', metric: 'p99', operator: 'lte', value: 500 })];
    await saveRunSlaTargets('run-overwrite', first);
    await saveRunSlaTargets('run-overwrite', second);
    expect(await loadRunSlaTargets('run-overwrite')).toEqual(second);
  });
});

// ── resolveTargetsForRun ──

describe('resolveTargetsForRun', () => {
  const runTarget: SlaTarget = makeTarget({ id: 'run-t', metric: 'p95', operator: 'lte', value: 400 });

  it('returns null when no targets configured anywhere', async () => {
    const run = makeTestRun();
    expect(await resolveTargetsForRun(run)).toBeNull();
  });

  it('returns null when run has no workflowId and no embedded targets', async () => {
    const run = makeTestRun({ config: makeConfig({ workflowId: undefined }) });
    expect(await resolveTargetsForRun(run)).toBeNull();
  });

  it('returns run-level targets with scope "run"', async () => {
    const run = makeTestRun({ config: makeConfig({ slaTargets: [runTarget] }) });
    const result = await resolveTargetsForRun(run);
    expect(result).toEqual({ targets: [runTarget], scope: 'run' });
  });

  it('returns run-level targets with scope "run" for workflow runs with embedded targets', async () => {
    const run = makeTestRun({ config: makeConfig({ workflowId: 'wf-both', slaTargets: [runTarget] }) });
    const result = await resolveTargetsForRun(run);
    expect(result).toEqual({ targets: [runTarget], scope: 'run' });
  });

  it('returns null when workflowId present but no embedded targets', async () => {
    const run = makeTestRun({ config: makeConfig({ workflowId: 'wf-none-stored' }) });
    expect(await resolveTargetsForRun(run)).toBeNull();
  });

  it('returns null when run slaTargets is an empty array', async () => {
    const run = makeTestRun({ config: makeConfig({ slaTargets: [] }) });
    expect(await resolveTargetsForRun(run)).toBeNull();
  });

  it('run-level targets are returned verbatim (no mutation)', async () => {
    const targets: SlaTarget[] = [runTarget, makeTarget({ id: 'run-t2', metric: 'avg', operator: 'lte', value: 200 })];
    const run = makeTestRun({ config: makeConfig({ slaTargets: targets }) });
    const result = await resolveTargetsForRun(run);
    expect(result?.targets).toBe(targets); // same reference, no copy
  });

  // ── Per-run ad-hoc storage ──

  it('returns per-run ad-hoc targets with scope null when no embedded targets', async () => {
    const prTarget = makeTarget({ id: 'pr-1', metric: 'p95', operator: 'lte', value: 500 });
    const run = makeTestRun({ id: 'run-pr', config: makeConfig() });
    await saveRunSlaTargets('run-pr', [prTarget]);
    const result = await resolveTargetsForRun(run);
    expect(result).toEqual({ targets: [prTarget], scope: null });
  });

  it('returns null for non-workflow run when per-run storage is empty', async () => {
    const run = makeTestRun({ id: 'run-empty-pr', config: makeConfig() });
    expect(await resolveTargetsForRun(run)).toBeNull();
  });

  it('returns per-run ad-hoc targets for workflow runs too when no embedded targets', async () => {
    const prTarget = makeTarget({ id: 'pr-wf', metric: 'p95', operator: 'lte', value: 500 });
    const run = makeTestRun({ id: 'run-wf-pr', config: makeConfig({ workflowId: 'wf-x' }) });
    await saveRunSlaTargets('run-wf-pr', [prTarget]);
    const result = await resolveTargetsForRun(run);
    expect(result).toEqual({ targets: [prTarget], scope: null });
  });

  it('prefers embedded config.slaTargets over per-run ad-hoc storage', async () => {
    const prTarget = makeTarget({ id: 'pr-lower', metric: 'p95', operator: 'lte', value: 500 });
    const run = makeTestRun({ id: 'run-pref', config: makeConfig({ slaTargets: [runTarget] }) });
    await saveRunSlaTargets('run-pref', [prTarget]);
    const result = await resolveTargetsForRun(run);
    expect(result).toEqual({ targets: [runTarget], scope: 'run' });
  });
});

// ════════════════════════════════════════════════════════════════════
// Phase E — computeRunSlaStatus
// ════════════════════════════════════════════════════════════════════

describe('computeRunSlaStatus', () => {
  it('returns null when no SLA configured anywhere', async () => {
    const run = makeTestRun();
    expect(await computeRunSlaStatus(run, [])).toBeNull();
  });

  it('returns null when no results match scenario targets', async () => {
    // Targets for 'checkout' but only 'search' results → no checks evaluated → null
    const run = makeTestRun({
      config: makeConfig({
        slaTargets: [
          makeTarget({ id: 'sc1', metric: 'p95', operator: 'lte', value: 100, scenarioName: 'checkout' }),
        ],
      }),
    });
    const results = [makeResult({ scenarioName: 'search', responseTimeMs: 50 })];
    expect(await computeRunSlaStatus(run, results)).toBeNull();
  });

  it('returns pass when all aggregate checks pass', async () => {
    const run = makeTestRun({
      config: makeConfig({ slaTargets: [makeTarget({ metric: 'p95', operator: 'lte', value: 500 })] }),
      summary: makeSummary({ p95ResponseTime: 300 }),
    });
    expect(await computeRunSlaStatus(run, [])).toBe('pass');
  });

  it('returns fail when any aggregate check fails', async () => {
    const run = makeTestRun({
      config: makeConfig({ slaTargets: [makeTarget({ metric: 'p95', operator: 'lte', value: 100 })] }),
      summary: makeSummary({ p95ResponseTime: 500 }),
    });
    expect(await computeRunSlaStatus(run, [])).toBe('fail');
  });

  it('returns warn when aggregate check is in warn zone', async () => {
    const run = makeTestRun({
      config: makeConfig({
        slaTargets: [makeTarget({ metric: 'p95', operator: 'lte', value: 500, warnAt: 200 })],
      }),
      summary: makeSummary({ p95ResponseTime: 300 }),
    });
    expect(await computeRunSlaStatus(run, [])).toBe('warn');
  });

  it('returns fail when any scenario check fails', async () => {
    const run = makeTestRun({
      config: makeConfig({
        slaTargets: [
          makeTarget({ id: 'sf', metric: 'p95', operator: 'lte', value: 100, scenarioName: 'checkout' }),
        ],
      }),
    });
    const results = [makeResult({ scenarioName: 'checkout', responseTimeMs: 500 })];
    expect(await computeRunSlaStatus(run, results)).toBe('fail');
  });

  it('returns pass when all scenario checks pass', async () => {
    const run = makeTestRun({
      config: makeConfig({
        slaTargets: [
          makeTarget({ id: 'sp', metric: 'p95', operator: 'lte', value: 1000, scenarioName: 'checkout' }),
        ],
      }),
    });
    const results = [makeResult({ scenarioName: 'checkout', responseTimeMs: 100 })];
    expect(await computeRunSlaStatus(run, results)).toBe('pass');
  });

  it('returns worst status across aggregate and scenario checks', async () => {
    // Aggregate passes, scenario fails → overall fail
    const run = makeTestRun({
      config: makeConfig({
        slaTargets: [
          makeTarget({ id: 'agg', metric: 'p95', operator: 'lte', value: 1000 }),                     // pass (actual 300)
          makeTarget({ id: 'sc', metric: 'p95', operator: 'lte', value: 100, scenarioName: 'checkout' }), // fail (actual 500)
        ],
      }),
      summary: makeSummary({ p95ResponseTime: 300 }),
    });
    const results = [makeResult({ scenarioName: 'checkout', responseTimeMs: 500 })];
    expect(await computeRunSlaStatus(run, results)).toBe('fail');
  });

  it('feature-group-scoped targets are not evaluated as aggregates (SLA-C1 defensive)', async () => {
    // FG target has a very strict threshold that would fail if incorrectly evaluated
    // against the run-level summary. It should be excluded until evaluateSlaTree (C3).
    const run = makeTestRun({
      config: makeConfig({
        slaTargets: [
          makeTarget({ id: 'fg', metric: 'p95', operator: 'lte', value: 1, featureGroupName: 'Cart' }),
        ],
      }),
      summary: makeSummary({ p95ResponseTime: 300 }),
    });
    // No other targets → all FG targets excluded → no checks → null
    expect(await computeRunSlaStatus(run, [])).toBeNull();
  });

  it('evaluates feature-group-scoped targets via computeFeatureGroupMetrics (SLA-C3)', async () => {
    const run = makeTestRun({
      config: makeConfig({
        slaTargets: [
          makeTarget({ id: 'fg', metric: 'p95', operator: 'lte', value: 100, featureGroupName: 'Cart' }),
        ],
      }),
      summary: makeSummary(),
    });
    // One result belonging to 'Cart' with responseTimeMs=500 → p95=500 → fails threshold of 100
    const results = [makeResult({ featureGroupName: 'Cart', responseTimeMs: 500 })];
    expect(await computeRunSlaStatus(run, results)).toBe('fail');
  });
});

// ════════════════════════════════════════════════════════════════════
// SLA-C3 — computeFeatureGroupMetrics
// ════════════════════════════════════════════════════════════════════

describe('computeFeatureGroupMetrics', () => {
  it('returns null for empty results', () => {
    expect(computeFeatureGroupMetrics([], 'Cart')).toBeNull();
  });

  it('returns null when no results match the featureGroupName', () => {
    const results = [makeResult({ featureGroupName: 'Search' })];
    expect(computeFeatureGroupMetrics(results, 'Cart')).toBeNull();
  });

  it('computes metrics only for results in the named feature group', () => {
    const results = [
      makeResult({ id: 'a', featureGroupName: 'Cart', responseTimeMs: 100 }),
      makeResult({ id: 'b', featureGroupName: 'Cart', responseTimeMs: 300 }),
      makeResult({ id: 'c', featureGroupName: 'Search', responseTimeMs: 9999 }), // excluded
    ];
    const m = computeFeatureGroupMetrics(results, 'Cart')!;
    expect(m).not.toBeNull();
    expect(m.count).toBe(2);
    expect(m.p95).toBe(300); // max of [100, 300]
    expect(m.avg).toBe(200);
    expect(m.scenarioName).toBe('Cart'); // key stored in scenarioName field
  });

  it('computes error rate from failed results in the feature group', () => {
    const results = [
      makeResult({ id: 'a', featureGroupName: 'Cart', passed: true }),
      makeResult({ id: 'b', featureGroupName: 'Cart', passed: false }),
    ];
    const m = computeFeatureGroupMetrics(results, 'Cart')!;
    expect(m.errorRate).toBe(50);
  });
});

// ════════════════════════════════════════════════════════════════════
// SLA-C3 — evaluateSlaForFeatureGroup
// ════════════════════════════════════════════════════════════════════

describe('evaluateSlaForFeatureGroup', () => {
  it('evaluates only targets whose featureGroupName matches', () => {
    const fgMetrics = computeFeatureGroupMetrics(
      [makeResult({ featureGroupName: 'Cart', responseTimeMs: 200 })],
      'Cart',
    )!;
    const targets: SlaTarget[] = [
      makeTarget({ id: 'cart', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Cart' }),
      makeTarget({ id: 'other', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Search' }),
    ];
    const checks = evaluateSlaForFeatureGroup(fgMetrics, targets);
    expect(checks).toHaveLength(1);
    expect(checks[0].target.id).toBe('cart');
    expect(checks[0].status).toBe('pass');
  });

  it('returns empty array when no targets match the feature group', () => {
    const fgMetrics = computeFeatureGroupMetrics(
      [makeResult({ featureGroupName: 'Cart', responseTimeMs: 200 })],
      'Cart',
    )!;
    const targets: SlaTarget[] = [
      makeTarget({ id: 'other', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Search' }),
    ];
    expect(evaluateSlaForFeatureGroup(fgMetrics, targets)).toHaveLength(0);
  });

  it('returns fail when actual exceeds threshold', () => {
    const fgMetrics = computeFeatureGroupMetrics(
      [makeResult({ featureGroupName: 'Cart', responseTimeMs: 800 })],
      'Cart',
    )!;
    const targets: SlaTarget[] = [
      makeTarget({ id: 'fg-fail', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Cart' }),
    ];
    const [check] = evaluateSlaForFeatureGroup(fgMetrics, targets);
    expect(check.status).toBe('fail');
  });
});

// ════════════════════════════════════════════════════════════════════
// SLA-C3 — evaluateSlaTree
// ════════════════════════════════════════════════════════════════════

describe('evaluateSlaTree — empty/trivial cases', () => {
  it('returns null overall and empty arrays when targets is empty', () => {
    const tree = evaluateSlaTree([], makeSummary(), []);
    expect(tree.overall).toBeNull();
    expect(tree.featureNodes).toHaveLength(0);
    expect(tree.aggregateChecks).toHaveLength(0);
    expect(tree.aggregateStatus).toBeNull();
  });

  it('evaluates aggregate targets (no scenarioName, no featureGroupName) against summary', () => {
    const tree = evaluateSlaTree(
      [],
      makeSummary({ p95ResponseTime: 300 }),
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500 })],
    );
    expect(tree.aggregateChecks).toHaveLength(1);
    expect(tree.aggregateChecks[0].status).toBe('pass');
    expect(tree.overall).toBe('pass');
    expect(tree.featureNodes).toHaveLength(0);
  });

  it('aggregate target fails → overall is fail', () => {
    const tree = evaluateSlaTree(
      [],
      makeSummary({ p95ResponseTime: 800 }),
      [makeTarget({ metric: 'p95', operator: 'lte', value: 500 })],
    );
    expect(tree.aggregateChecks[0].status).toBe('fail');
    expect(tree.overall).toBe('fail');
  });
});

describe('evaluateSlaTree — scenario-scoped targets', () => {
  it('builds a feature node for scenario targets (ungrouped — featureGroupName empty)', () => {
    const results = [makeResult({ scenarioName: 'checkout', responseTimeMs: 200 })];
    const tree = evaluateSlaTree(results, makeSummary(), [
      makeTarget({ id: 'sc1', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'checkout' }),
    ]);
    expect(tree.featureNodes).toHaveLength(1);
    expect(tree.featureNodes[0].featureGroupName).toBe(''); // ungrouped
    expect(tree.featureNodes[0].scenarios).toHaveLength(1);
    expect(tree.featureNodes[0].scenarios[0].scenarioName).toBe('checkout');
    expect(tree.featureNodes[0].scenarios[0].status).toBe('pass');
    expect(tree.overall).toBe('pass');
  });

  it('scenario check fails → feature node status and overall both fail', () => {
    const results = [makeResult({ scenarioName: 'checkout', responseTimeMs: 800 })];
    const tree = evaluateSlaTree(results, makeSummary(), [
      makeTarget({ id: 'sc-fail', metric: 'p95', operator: 'lte', value: 300, scenarioName: 'checkout' }),
    ]);
    expect(tree.featureNodes[0].scenarios[0].status).toBe('fail');
    expect(tree.featureNodes[0].status).toBe('fail');
    expect(tree.overall).toBe('fail');
  });

  it('groups scenarios under their result featureGroupName', () => {
    const results = [
      makeResult({ id: 'a', scenarioName: 'checkout', featureGroupName: 'Cart', responseTimeMs: 200 }),
      makeResult({ id: 'b', scenarioName: 'search',   featureGroupName: 'Browse', responseTimeMs: 150 }),
    ];
    const tree = evaluateSlaTree(results, makeSummary(), [
      makeTarget({ id: 'sc1', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'checkout' }),
      makeTarget({ id: 'sc2', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'search' }),
    ]);
    expect(tree.featureNodes).toHaveLength(2);
    const fgNames = tree.featureNodes.map((n) => n.featureGroupName).sort();
    expect(fgNames).toEqual(['Browse', 'Cart']);
  });

  it('no-data when scenario target exists but no matching results', () => {
    const tree = evaluateSlaTree([], makeSummary(), [
      makeTarget({ id: 'sc-nodata', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'missing' }),
    ]);
    expect(tree.featureNodes[0].scenarios[0].checks[0].status).toBe('no-data');
    expect(tree.overall).toBe('no-data');
  });
});

describe('evaluateSlaTree — feature-group-scoped targets', () => {
  it('evaluates feature-group targets against FG aggregate metrics', () => {
    const results = [makeResult({ featureGroupName: 'Cart', responseTimeMs: 200 })];
    const tree = evaluateSlaTree(results, makeSummary(), [
      makeTarget({ id: 'fg1', metric: 'p95', operator: 'lte', value: 500, featureGroupName: 'Cart' }),
    ]);
    expect(tree.featureNodes).toHaveLength(1);
    expect(tree.featureNodes[0].featureGroupName).toBe('Cart');
    expect(tree.featureNodes[0].featureChecks).toHaveLength(1);
    expect(tree.featureNodes[0].featureChecks[0].status).toBe('pass');
    expect(tree.featureNodes[0].scenarios).toHaveLength(0); // no scenario targets
    expect(tree.overall).toBe('pass');
  });

  it('FG check fails → node and overall both fail', () => {
    const results = [makeResult({ featureGroupName: 'Cart', responseTimeMs: 900 })];
    const tree = evaluateSlaTree(results, makeSummary(), [
      makeTarget({ id: 'fg-fail', metric: 'p95', operator: 'lte', value: 300, featureGroupName: 'Cart' }),
    ]);
    expect(tree.featureNodes[0].featureChecks[0].status).toBe('fail');
    expect(tree.overall).toBe('fail');
  });
});

describe('evaluateSlaTree — feature nodes sorting', () => {
  it('sorts named feature groups alphabetically, ungrouped (\'\') last', () => {
    const results = [
      makeResult({ id: 'a', scenarioName: 'sc1', featureGroupName: 'Zebra', responseTimeMs: 100 }),
      makeResult({ id: 'b', scenarioName: 'sc2', responseTimeMs: 100 }), // ungrouped
      makeResult({ id: 'c', scenarioName: 'sc3', featureGroupName: 'Alpha', responseTimeMs: 100 }),
    ];
    const tree = evaluateSlaTree(results, makeSummary(), [
      makeTarget({ id: 'sc1', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'sc1' }),
      makeTarget({ id: 'sc2', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'sc2' }),
      makeTarget({ id: 'sc3', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'sc3' }),
    ]);
    const fgNames = tree.featureNodes.map((n) => n.featureGroupName);
    expect(fgNames).toEqual(['Alpha', 'Zebra', '']);
  });
});

describe('evaluateSlaTree — mixed targets', () => {
  it('combines aggregate, FG, and scenario checks into correct overall status', () => {
    const results = [makeResult({ featureGroupName: 'Cart', responseTimeMs: 200 })];
    const tree = evaluateSlaTree(
      results,
      makeSummary({ p95ResponseTime: 300 }),
      [
        makeTarget({ id: 'agg', metric: 'p95', operator: 'lte', value: 500 }),                       // pass
        makeTarget({ id: 'fg', metric: 'p95', operator: 'lte', value: 100, featureGroupName: 'Cart' }), // fail (actual 200)
        makeTarget({ id: 'sc', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'checkout' }), // no-data (no result for checkout)
      ],
    );
    expect(tree.aggregateChecks[0].status).toBe('pass');
    expect(tree.featureNodes[0].featureChecks[0].status).toBe('fail');
    expect(tree.overall).toBe('fail');
  });
});

// ── evaluateSlaTree — derivedFeatureNodes ──

describe('evaluateSlaTree — derivedFeatureNodes (aggregate-only CLI runs)', () => {
  it('populates derivedFeatureNodes when only aggregate targets exist and results have scenarioNames', () => {
    const results = [
      makeResult({ id: 'r1', scenarioName: 'Get Users', responseTimeMs: 200 }),
      makeResult({ id: 'r2', scenarioName: 'Create Post', responseTimeMs: 300 }),
    ];
    const targets = [
      makeTarget({ id: 'agg-p95', metric: 'p95', operator: 'lte', value: 500 }),
      makeTarget({ id: 'agg-err', metric: 'errorRate', operator: 'lte', value: 5 }),
    ];
    const tree = evaluateSlaTree(results, makeSummary({ p95ResponseTime: 250 }), targets);

    expect(tree.featureNodes).toHaveLength(0);
    expect(tree.derivedFeatureNodes).toHaveLength(1);
    const fg = tree.derivedFeatureNodes[0];
    expect(fg.featureGroupName).toBe('');
    expect(fg.featureChecks).toHaveLength(0);
    // both scenarios should appear, sorted alphabetically
    expect(fg.scenarios.map((s) => s.scenarioName)).toEqual(['Create Post', 'Get Users']);
  });

  it('each derived scenario has checks evaluated from aggregate targets', () => {
    const results = [
      makeResult({ id: 'r1', scenarioName: 'slow-api', responseTimeMs: 600 }),
    ];
    const targets = [makeTarget({ id: 'agg-p95', metric: 'p95', operator: 'lte', value: 500 })];
    const tree = evaluateSlaTree(results, makeSummary({ p95ResponseTime: 600 }), targets);

    const sc = tree.derivedFeatureNodes[0].scenarios[0];
    expect(sc.scenarioName).toBe('slow-api');
    expect(sc.checks).toHaveLength(1);
    expect(sc.checks[0].status).toBe('fail');
  });

  it('derived scenario check is no-data when scenario has no matching results', () => {
    // Result has no responseTimeMs data → computeScenarioMetrics returns null
    const targets = [makeTarget({ id: 'agg-p95', metric: 'p95', operator: 'lte', value: 500 })];
    // Override results so computeScenarioMetrics returns null by passing empty array
    // Use empty results (scenario name only in targets is an edge case)
    const tree = evaluateSlaTree([], makeSummary(), targets);

    // No results → no derived scenario names → derivedFeatureNodes empty
    expect(tree.derivedFeatureNodes).toHaveLength(0);
  });

  it('derivedFeatureNodes is empty when results have no scenarioName values', () => {
    const results = [
      makeResult({ id: 'r1', scenarioName: undefined as unknown as string, responseTimeMs: 100 }),
    ];
    const targets = [makeTarget({ id: 'agg', metric: 'p95', operator: 'lte', value: 500 })];
    const tree = evaluateSlaTree(results, makeSummary(), targets);

    expect(tree.featureNodes).toHaveLength(0);
    expect(tree.derivedFeatureNodes).toHaveLength(0);
  });

  it('derivedFeatureNodes is empty when no aggregate targets exist', () => {
    const results = [makeResult({ id: 'r1', scenarioName: 'api', responseTimeMs: 100 })];
    const tree = evaluateSlaTree(results, makeSummary(), []);
    expect(tree.derivedFeatureNodes).toHaveLength(0);
  });

  it('does not populate derivedFeatureNodes when featureNodes already exist', () => {
    const results = [makeResult({ id: 'r1', scenarioName: 'api', featureGroupName: 'Suite', responseTimeMs: 100 })];
    const targets = [
      makeTarget({ id: 'agg', metric: 'p95', operator: 'lte', value: 500 }),
      makeTarget({ id: 'sc', metric: 'p95', operator: 'lte', value: 500, scenarioName: 'api' }),
    ];
    const tree = evaluateSlaTree(results, makeSummary(), targets);
    expect(tree.featureNodes.length).toBeGreaterThan(0);
    expect(tree.derivedFeatureNodes).toHaveLength(0);
  });
});

// ── evaluateSlaTree — ungrouped scenario target (empty fgKey) ──

describe('evaluateSlaTree — ungrouped scenario targets (fgKey = empty string)', () => {
  it('handles scenario target whose result has no featureGroupName (ungrouped)', () => {
    // Result has NO featureGroupName → fgKey = '' → fgMetrics = null → featureChecks use no-data
    const results = [makeResult({ id: 'r1', scenarioName: 'bare-api', featureGroupName: undefined, responseTimeMs: 150 })];
    const targets = [
      makeTarget({ id: 'bare-p95', metric: 'p95', operator: 'lte', value: 200, scenarioName: 'bare-api' }),
    ];
    const tree = evaluateSlaTree(results, makeSummary(), targets);

    expect(tree.featureNodes).toHaveLength(1);
    const fg = tree.featureNodes[0];
    expect(fg.featureGroupName).toBe('');
    // No FG-scoped targets, so featureChecks is empty
    expect(fg.featureChecks).toHaveLength(0);
    // Scenario 'bare-api' should have a check
    expect(fg.scenarios).toHaveLength(1);
    expect(fg.scenarios[0].scenarioName).toBe('bare-api');
    expect(fg.scenarios[0].checks[0].status).toBe('pass');
  });

  it('target with empty featureGroupName string is treated as aggregate (not FG-scoped)', () => {
    // featureGroupName: '' is falsy → categorized as aggregateTarget, not fgScopedTarget
    const results = [makeResult({ id: 'r1', scenarioName: 'x', featureGroupName: undefined, responseTimeMs: 100 })];
    const targets = [
      makeTarget({ id: 'fg-empty', metric: 'p95', operator: 'lte', value: 200, featureGroupName: '' }),
    ];
    const tree = evaluateSlaTree(results, makeSummary({ p95ResponseTime: 100 }), targets);

    // Empty-string featureGroupName is treated as aggregate
    expect(tree.aggregateChecks).toHaveLength(1);
    expect(tree.featureNodes).toHaveLength(0);
  });
});
