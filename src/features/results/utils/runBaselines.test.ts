import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage before importing module
vi.mock('../../../shared/utils/storage', () => {
  let store: Record<string, string> = {};
  return {
    readKey: vi.fn(async (key: string) => store[key] ?? null),
    writeKey: vi.fn(async (key: string, value: string) => { store[key] = value; }),
    __resetStore: () => { store = {}; },
  };
});

import {
  loadBaselines,
  markAsBaseline,
  unmarkBaseline,
  renameBaseline,
  isBaseline,
  compareRuns,
  computeTrend,
  loadRegressionThresholds,
  saveRegressionThresholds,
  resetRegressionThresholds,
  DEFAULT_THRESHOLDS,
  computeScopedTrend,
  computePerScenarioTrend,
  computeRunRegressionStatus,
  type BaselineMark,
} from './runBaselines';
import type { TestRun } from '@shared/types';
import { makeResult as _makeResult } from '../../../test-utils/factories';

function makeSummary(overrides: Partial<TestRun['summary']> = {}): TestRun['summary'] {
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

function makeRun(id: string, summaryOverrides: Partial<TestRun['summary']> = {}, results: TestRun['results'] = []): TestRun {
  return {
    id,
    timestamp: Date.now(),
    config: {
      scenarios: [],
      concurrency: 5,
      iterations: 100,
      executionMode: 'pool' as const,
    } as TestRun['config'],
    summary: makeSummary(summaryOverrides),
    results,
  };
}

function makeResult(scenarioName: string, responseTimeMs: number, httpStatus = 200): TestRun['results'][0] {
  return _makeResult({
    scenarioName,
    url: 'http://test.com',
    httpStatus,
    responseTimeMs,
    responseBody: '',
    passed: httpStatus < 400,
  });
}

describe('Baseline CRUD', () => {
  beforeEach(async () => {
    const mod = await import('../../../shared/utils/storage');
    (mod as Record<string, unknown>).__resetStore?.();
  });

  it('loadBaselines returns empty array when nothing stored', async () => {
    expect(await loadBaselines()).toEqual([]);
  });

  it('markAsBaseline adds a baseline', async () => {
    const result = await markAsBaseline('run-1', 'Sprint 1');
    expect(result).toHaveLength(1);
    expect(result[0].runId).toBe('run-1');
    expect(result[0].label).toBe('Sprint 1');
  });

  it('markAsBaseline does not duplicate', async () => {
    await markAsBaseline('run-1');
    const result = await markAsBaseline('run-1');
    expect(result).toHaveLength(1);
  });

  it('unmarkBaseline removes a baseline', async () => {
    await markAsBaseline('run-1');
    await markAsBaseline('run-2');
    const result = await unmarkBaseline('run-1');
    expect(result).toHaveLength(1);
    expect(result[0].runId).toBe('run-2');
  });

  it('renameBaseline updates the label', async () => {
    await markAsBaseline('run-1', 'old');
    const result = await renameBaseline('run-1', 'new-label');
    expect(result[0].label).toBe('new-label');
  });

  it('isBaseline returns true for marked runs', () => {
    const baselines: BaselineMark[] = [{ runId: 'run-1', markedAt: Date.now() }];
    expect(isBaseline(baselines, 'run-1')).toBe(true);
    expect(isBaseline(baselines, 'run-2')).toBe(false);
  });

  it('caps at exactly MAX_BASELINES (10) when more than 10 are added', async () => {
    for (let i = 0; i < 12; i++) {
      await markAsBaseline(`run-${i}`);
    }
    const result = await loadBaselines();
    // Must be exactly 10 — the oldest entries are dropped
    expect(result.length).toBe(10);
    // The most recent 10 entries are kept (run-2 through run-11)
    expect(result.map((b) => b.runId)).toContain('run-11');
    expect(result.map((b) => b.runId)).not.toContain('run-0');
    expect(result.map((b) => b.runId)).not.toContain('run-1');
  });
});

describe('compareRuns', () => {
  it('detects no regressions for identical runs', () => {
    const run = makeRun('run-1');
    const result = compareRuns(run, run);
    expect(result.regressions).toHaveLength(0);
    expect(result.metricDeltas.every((d) => d.delta === 0)).toBe(true);
  });

  it('detects improvement when current is faster', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100, avgResponseTime: 50 });
    const current = makeRun('c', { p95ResponseTime: 80, avgResponseTime: 40 });
    const result = compareRuns(baseline, current);

    const p95 = result.metricDeltas.find((d) => d.metric === 'P95 Response Time');
    expect(p95?.improved).toBe(true);
    expect(p95?.regressed).toBe(false);
    expect(p95?.delta).toBe(-20);
  });

  it('treats small favorable deltas under threshold as no change', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100, tps: 100, errorRate: 2 });
    const current = makeRun('c', { p95ResponseTime: 95, tps: 105, errorRate: 1.5 });
    const result = compareRuns(baseline, current);

    const p95 = result.metricDeltas.find((d) => d.metric === 'P95 Response Time');
    const tps = result.metricDeltas.find((d) => d.metric === 'TPS');
    const er = result.metricDeltas.find((d) => d.metric === 'Error Rate');

    expect(p95?.improved).toBe(false); // -5% vs 10% threshold
    expect(tps?.improved).toBe(false); // +5% vs 10% threshold
    expect(er?.improved).toBe(false); // -0.5pp vs 1pp threshold
  });

  it('detects regression when P95 degrades beyond threshold', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 150 }); // +50% vs 10% threshold
    const result = compareRuns(baseline, current);

    const p95 = result.metricDeltas.find((d) => d.metric === 'P95 Response Time');
    expect(p95?.regressed).toBe(true);
    expect(result.regressions.length).toBeGreaterThan(0);
  });

  it('classifies large min/max changes using response-time thresholds', () => {
    const baseline = makeRun('b', { minResponseTime: 100, maxResponseTime: 120 });
    const current = makeRun('c', { minResponseTime: 140, maxResponseTime: 180 });
    const result = compareRuns(baseline, current);

    const min = result.metricDeltas.find((d) => d.metric === 'Min Response Time');
    const max = result.metricDeltas.find((d) => d.metric === 'Max Response Time');

    expect(min?.regressed).toBe(true); // +40% vs avgPercent threshold of 10%
    expect(max?.regressed).toBe(true); // +50% vs avgPercent threshold of 10%
  });

  it('detects critical regression when 2x threshold', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 125 }); // +25% vs 10% threshold → critical if > 20%
    const result = compareRuns(baseline, current);

    const p95Alert = result.regressions.find((r) => r.metric === 'P95 Response Time');
    expect(p95Alert?.severity).toBe('critical');
  });

  it('detects TPS regression when TPS drops', () => {
    const baseline = makeRun('b', { tps: 100 });
    const current = makeRun('c', { tps: 80 }); // -20% vs 10% threshold
    const result = compareRuns(baseline, current);

    const tps = result.metricDeltas.find((d) => d.metric === 'TPS');
    expect(tps?.regressed).toBe(true);
  });

  it('detects error rate regression', () => {
    const baseline = makeRun('b', { errorRate: 1 });
    const current = makeRun('c', { errorRate: 5 }); // +4pp vs 1pp threshold
    const result = compareRuns(baseline, current);

    const er = result.metricDeltas.find((d) => d.metric === 'Error Rate');
    expect(er?.regressed).toBe(true);
    // delta is absolute pp change (4pp), NOT relative % (400%)
    expect(er?.delta).toBe(4);

    // RegressionAlert.actual must be the absolute pp change (not relative %)
    const alert = result.regressions.find((r) => r.metric === 'Error Rate');
    expect(alert).toBeTruthy();
    expect(alert!.actual).toBe(4);          // 4 pp absolute change
    expect(alert!.threshold).toBe(1);       // default errorRateAbsolute = 1 pp
    expect(alert!.severity).toBe('critical'); // 4pp > 2 * 1pp threshold
  });

  it('computes scenario deltas', () => {
    const baseline = makeRun('b', {}, [
      makeResult('Login', 100),
      makeResult('Login', 120),
      makeResult('Search', 50),
    ]);
    const current = makeRun('c', {}, [
      makeResult('Login', 200),
      makeResult('Login', 220),
      makeResult('Search', 45),
    ]);
    const result = compareRuns(baseline, current);

    const loginDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'Login');
    expect(loginDelta).toBeTruthy();
    expect(loginDelta!.currentAvgTime).toBeGreaterThan(loginDelta!.baselineAvgTime);
    expect(loginDelta!.timeDelta).toBeGreaterThan(0);

    const searchDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'Search');
    expect(searchDelta).toBeTruthy();
    expect(searchDelta!.timeDelta).toBeLessThan(0); // improved
  });
});

describe('computeTrend', () => {
  it('returns empty for less than 1 run', () => {
    expect(computeTrend([], [])).toEqual([]);
  });

  it('returns trend points in chronological order', () => {
    const runs = [
      { ...makeRun('r3'), timestamp: 3000 },
      { ...makeRun('r2'), timestamp: 2000 },
      { ...makeRun('r1'), timestamp: 1000 },
    ];
    const trend = computeTrend(runs, []);
    expect(trend[0].timestamp).toBe(1000);
    expect(trend[2].timestamp).toBe(3000);
  });

  it('includes baseline label in trend points', () => {
    const runs = [{ ...makeRun('r1'), timestamp: 1000 }];
    const baselines: BaselineMark[] = [{ runId: 'r1', markedAt: Date.now(), label: 'Sprint 1' }];
    const trend = computeTrend(runs, baselines);
    expect(trend[0].label).toBe('Sprint 1');
  });

  it('maps summary metrics to trend points', () => {
    const run = { ...makeRun('r1', { tps: 42, p95ResponseTime: 99, errorRate: 2.5 }), timestamp: 1000 };
    const trend = computeTrend([run], []);
    expect(trend[0].tps).toBe(42);
    expect(trend[0].p95ResponseTime).toBe(99);
    expect(trend[0].errorRate).toBe(2.5);
  });
});

describe('loadBaselines edge cases', () => {
  it('returns empty array when storage throws or contains invalid JSON', async () => {
    const { readKey } = await import('../../../shared/utils/storage');
    vi.mocked(readKey).mockRejectedValueOnce(new Error('storage error'));
    expect(await loadBaselines()).toEqual([]);
  });

  it('returns empty array when stored data is not an array', async () => {
    const { writeKey } = await import('../../../shared/utils/storage');
    await writeKey('perf-test-baselines', JSON.stringify({ notAnArray: true }));
    expect(await loadBaselines()).toEqual([]);
  });
});

describe('compareRuns edge cases', () => {
  it('handles zero baseline values for percentage calculations', () => {
    const baseline = makeRun('b', { tps: 0, avgResponseTime: 0, errorRate: 0 });
    const current = makeRun('c', { tps: 100, avgResponseTime: 50, errorRate: 1 });
    const result = compareRuns(baseline, current);

    const tps = result.metricDeltas.find((d) => d.metric === 'TPS');
    expect(tps?.deltaPercent).toBe(0);

    const avg = result.metricDeltas.find((d) => d.metric === 'Avg Response Time');
    expect(avg?.deltaPercent).toBe(0);
  });

  it('handles scenarios that only exist in current run', () => {
    const baseline = makeRun('b', {}, [makeResult('Login', 100)]);
    const current = makeRun('c', {}, [makeResult('NewFeature', 50)]);
    const result = compareRuns(baseline, current);

    const newFeatureDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'NewFeature');
    expect(newFeatureDelta).toBeTruthy();
    expect(newFeatureDelta!.baselineAvgTime).toBe(0);
    expect(newFeatureDelta!.baselineCount).toBe(0);
  });

  it('handles scenarios that only exist in baseline run', () => {
    const baseline = makeRun('b', {}, [makeResult('OldFeature', 100)]);
    const current = makeRun('c', {}, [makeResult('Login', 50)]);
    const result = compareRuns(baseline, current);

    const oldFeatureDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'OldFeature');
    expect(oldFeatureDelta).toBeTruthy();
    expect(oldFeatureDelta!.currentAvgTime).toBe(0);
    expect(oldFeatureDelta!.currentCount).toBe(0);
  });

  it('detects critical TPS regression when drop exceeds 2x threshold', () => {
    const baseline = makeRun('b', { tps: 100 });
    const current = makeRun('c', { tps: 70 }); // -30% vs 10% threshold
    const result = compareRuns(baseline, current);

    const tpsAlert = result.regressions.find((r) => r.metric === 'TPS');
    expect(tpsAlert?.severity).toBe('critical');
  });

  it('detects critical error rate regression when 2x threshold', () => {
    const baseline = makeRun('b', { errorRate: 0 });
    const current = makeRun('c', { errorRate: 5 }); // +5pp vs 1pp threshold, > 2pp
    const result = compareRuns(baseline, current);

    const errorAlert = result.regressions.find((r) => r.metric === 'Error Rate');
    expect(errorAlert?.severity).toBe('critical');
  });

  it('detects P50 critical regression', () => {
    const baseline = makeRun('b', { p50ResponseTime: 100 });
    const current = makeRun('c', { p50ResponseTime: 145 }); // +45% vs 15% threshold, > 30%
    const result = compareRuns(baseline, current);

    const p50Alert = result.regressions.find((r) => r.metric === 'P50 Response Time');
    expect(p50Alert?.severity).toBe('critical');
  });

  it('detects P99 critical regression', () => {
    const baseline = makeRun('b', { p99ResponseTime: 100 });
    const current = makeRun('c', { p99ResponseTime: 140 }); // +40% vs 15% threshold, > 30%
    const result = compareRuns(baseline, current);

    const p99Alert = result.regressions.find((r) => r.metric === 'P99 Response Time');
    expect(p99Alert?.severity).toBe('critical');
  });

  it('detects avg response time critical regression', () => {
    const baseline = makeRun('b', { avgResponseTime: 100 });
    const current = makeRun('c', { avgResponseTime: 130 }); // +30% vs 10% threshold, > 20%
    const result = compareRuns(baseline, current);

    const avgAlert = result.regressions.find((r) => r.metric === 'Avg Response Time');
    expect(avgAlert?.severity).toBe('critical');
  });

  it('calculates scenario error rates correctly', () => {
    const baseline = makeRun('b', {}, [
      makeResult('Login', 100, 200),
      makeResult('Login', 110, 500),
      makeResult('Login', 120, 200),
    ]);
    const current = makeRun('c', {}, [
      makeResult('Login', 100, 200),
      makeResult('Login', 110, 200),
    ]);
    const result = compareRuns(baseline, current);

    const loginDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'Login');
    expect(loginDelta).toBeTruthy();
    expect(loginDelta!.baselineErrorRate).toBeCloseTo(33.33, 1); // 1 error out of 3
    expect(loginDelta!.currentErrorRate).toBe(0);
  });

  it('detects scenario regression when time delta exceeds threshold', () => {
    const baseline = makeRun('b', {}, [makeResult('Login', 100)]);
    const current = makeRun('c', {}, [makeResult('Login', 120)]); // +20% vs 10% threshold
    const result = compareRuns(baseline, current);

    const loginDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'Login');
    expect(loginDelta?.regressed).toBe(true);
  });

  it('per-scenario regression uses avgPercent threshold, not p95Percent (Bug P)', () => {
    // Custom thresholds: avgPercent=25% (permissive), p95Percent=5% (strict).
    // A +20% avg-time increase must NOT regress under avgPercent=25, but WOULD
    // regress if p95Percent=5 were used instead — confirming the right threshold.
    const baseline = makeRun('b', {}, [makeResult('Login', 100)]);
    const current = makeRun('c', {}, [makeResult('Login', 120)]); // +20% increase
    const customThresholds = { ...DEFAULT_THRESHOLDS, avgPercent: 25, p95Percent: 5 };
    const result = compareRuns(baseline, current, customThresholds);

    const loginDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'Login');
    expect(loginDelta?.regressed).toBe(false); // 20% < avgPercent threshold of 25%
  });

  it('handles status 0 as error', () => {
    const run = makeRun('r', {}, [
      makeResult('API', 100, 0), // status 0 = error (e.g., network failure)
      makeResult('API', 110, 200),
    ]);
    const result = compareRuns(run, run);

    const apiDelta = result.scenarioDeltas.find((d) => d.scenarioName === 'API');
    expect(apiDelta?.baselineErrorRate).toBe(50); // 1 error out of 2
  });
});

describe('loadRegressionThresholds', () => {
  beforeEach(async () => {
    const mod = await import('../../../shared/utils/storage');
    (mod as Record<string, unknown>).__resetStore?.();
  });

  it('returns DEFAULT_THRESHOLDS when storage is empty', async () => {
    const t = await loadRegressionThresholds();
    expect(t).toEqual(DEFAULT_THRESHOLDS);
  });

  it('merges stored values with defaults (partial object)', async () => {
    await saveRegressionThresholds({ ...DEFAULT_THRESHOLDS, p95Percent: 5 });
    const t = await loadRegressionThresholds();
    expect(t.p95Percent).toBe(5);
    expect(t.p50Percent).toBe(DEFAULT_THRESHOLDS.p50Percent);
  });

  it('persists and retrieves all threshold values', async () => {
    const custom = { ...DEFAULT_THRESHOLDS, p50Percent: 20, tpsPercent: 25, errorRateAbsolute: 3 };
    await saveRegressionThresholds(custom);
    const loaded = await loadRegressionThresholds();
    expect(loaded).toEqual(custom);
  });

  it('resets to defaults after resetRegressionThresholds', async () => {
    await saveRegressionThresholds({ ...DEFAULT_THRESHOLDS, p95Percent: 99 });
    await resetRegressionThresholds();
    const t = await loadRegressionThresholds();
    expect(t).toEqual(DEFAULT_THRESHOLDS);
  });

  it('ignores null/string/negative values in stored JSON (falls back to defaults)', async () => {
    const mod = await import('../../../shared/utils/storage');
    // Manually write corrupt JSON to storage
    await (mod as Record<string, unknown> & { writeKey: (k: string, v: string) => Promise<void> })
      .writeKey('perf-test-regression-thresholds', JSON.stringify({
        p95Percent: null,           // null — should use default
        p50Percent: 'bad',          // string — should use default
        p99Percent: -5,             // negative — should use default
        avgPercent: 20,             // valid — should be used
        tpsPercent: Infinity,       // non-finite — should use default
      }));
    const t = await loadRegressionThresholds();
    expect(t.p95Percent).toBe(DEFAULT_THRESHOLDS.p95Percent);
    expect(t.p50Percent).toBe(DEFAULT_THRESHOLDS.p50Percent);
    expect(t.p99Percent).toBe(DEFAULT_THRESHOLDS.p99Percent);
    expect(t.avgPercent).toBe(20); // valid value preserved
    expect(t.tpsPercent).toBe(DEFAULT_THRESHOLDS.tpsPercent);
    // Properties not in DEFAULT_THRESHOLDS are not injected
    expect(Object.keys(t)).toEqual(Object.keys(DEFAULT_THRESHOLDS));
  });
});

// ── Sprint 2: computeScopedTrend ──────────────────────────────────────────

describe('computeScopedTrend', () => {
  function makeRunWithMeta(id: string, svcName?: string, envName?: string, workflowName?: string, ts = Date.now()): TestRun {
    return { ...makeRun(id), timestamp: ts, svcName, envName, workflowName };
  }

  it('scope=all returns all runs (same as computeTrend)', () => {
    const runs = [
      makeRunWithMeta('r1', 'svc-a', 'prod'),
      makeRunWithMeta('r2', 'svc-b', 'staging'),
    ];
    const ref = runs[0];
    const scoped = computeScopedTrend(runs, ref, 'all', []);
    const all = computeTrend(runs, []);
    expect(scoped).toEqual(all);
  });

  it('scope=service filters to same svcName', () => {
    // Newest-first order (matches real ResultsDashboard runs array)
    const runs = [
      makeRunWithMeta('r3', 'svc-a', 'staging', undefined, 3000), // newest
      makeRunWithMeta('r2', 'svc-b', 'staging', undefined, 2000),
      makeRunWithMeta('r1', 'svc-a', 'prod', undefined, 1000),    // oldest
    ];
    const ref = runs[0]; // svc-a (r3)
    const scoped = computeScopedTrend(runs, ref, 'service', []);
    expect(scoped.map((p) => p.runId)).toEqual(['r1', 'r3']); // chronological (oldest first)
  });

  it('scope=env filters to same svcName + envName', () => {
    const runs = [
      makeRunWithMeta('r3', 'svc-a', 'prod', undefined, 3000),
      makeRunWithMeta('r2', 'svc-a', 'staging', undefined, 2000),
      makeRunWithMeta('r1', 'svc-a', 'prod', undefined, 1000),
    ];
    const ref = runs[0]; // svc-a prod (r3)
    const scoped = computeScopedTrend(runs, ref, 'env', []);
    expect(scoped.map((p) => p.runId)).toEqual(['r1', 'r3']);
  });

  it('scope=env with runs whose envName is undefined does not cross-match different services', () => {
    // Reference has svcName='svc-a' and envName=undefined (no env tagged).
    // Should only match other runs with svcName='svc-a' AND envName=undefined.
    // Should NOT match svc-b runs that also have no envName.
    const runs = [
      makeRunWithMeta('r3', 'svc-a', undefined, undefined, 3000), // ref (no env)
      makeRunWithMeta('r2', 'svc-b', undefined, undefined, 2000), // different svc, no env — must NOT match
      makeRunWithMeta('r1', 'svc-a', undefined, undefined, 1000), // same svc, no env — matches
    ];
    const ref = runs[0]; // svc-a, no envName
    const scoped = computeScopedTrend(runs, ref, 'env', []);
    expect(scoped.map((p) => p.runId)).toEqual(['r1', 'r3']); // r2 (svc-b) excluded
  });

  it('scope=workflow filters to same workflowName', () => {
    const runs = [
      makeRunWithMeta('r3', undefined, undefined, 'checkout', 3000),
      makeRunWithMeta('r2', undefined, undefined, 'catalog', 2000),
      makeRunWithMeta('r1', undefined, undefined, 'checkout', 1000),
    ];
    const ref = runs[0]; // checkout (r3)
    const scoped = computeScopedTrend(runs, ref, 'workflow', []);
    expect(scoped.map((p) => p.runId)).toEqual(['r1', 'r3']);
  });
});

// ── Sprint 2: computePerScenarioTrend ─────────────────────────────────────

describe('computePerScenarioTrend', () => {
  it('returns empty result when no runs have results', () => {
    const runs = [makeRun('r1'), makeRun('r2')];
    const result = computePerScenarioTrend(runs, runs[0], 'all', []);
    expect(result.seriesKeys).toHaveLength(0);
    expect(result.scenarioNames).toHaveLength(0);
  });

  it('returns one series per unique scenario', () => {
    const r1 = { ...makeRun('r1', {}, [makeResult('Login', 100), makeResult('Search', 200)]), timestamp: 1000 };
    const r2 = { ...makeRun('r2', {}, [makeResult('Login', 110), makeResult('Search', 210)]), timestamp: 2000 };
    const result = computePerScenarioTrend([r1, r2], r1, 'all', []);
    expect(result.scenarioNames).toHaveLength(2);
    expect(result.scenarioNames).toContain('Login');
    expect(result.scenarioNames).toContain('Search');
    expect(result.seriesKeys).toHaveLength(2);
  });

  it('series keys are safe index-based strings (s0, s1, ...)', () => {
    const r1 = { ...makeRun('r1', {}, [makeResult('My/Scenario.Name', 100)]), timestamp: 1000 };
    const r2 = { ...makeRun('r2', {}, [makeResult('My/Scenario.Name', 110)]), timestamp: 2000 };
    const result = computePerScenarioTrend([r1, r2], r1, 'all', []);
    expect(result.seriesKeys).toEqual(['s0']);
    expect(result.scenarioNames).toEqual(['My/Scenario.Name']); // display name preserved
  });

  it('respects topN limit', () => {
    const scenarios = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const r1 = { ...makeRun('r1', {}, scenarios.map((s) => makeResult(s, 100))), timestamp: 1000 };
    const r2 = { ...makeRun('r2', {}, scenarios.map((s) => makeResult(s, 110))), timestamp: 2000 };
    const result = computePerScenarioTrend([r1, r2], r1, 'all', [], 3);
    expect(result.seriesKeys).toHaveLength(3);
  });

  it('data points are in chronological order', () => {
    const r1 = { ...makeRun('r1', {}, [makeResult('Login', 100)]), timestamp: 1000 };
    const r2 = { ...makeRun('r2', {}, [makeResult('Login', 200)]), timestamp: 500 }; // older
    const result = computePerScenarioTrend([r1, r2], r1, 'all', []);
    const points = result.data['s0'];
    expect(points[0].timestamp).toBe(500);
    expect(points[1].timestamp).toBe(1000);
  });

  it('isBaseline is true for baseline run, false for non-baseline', () => {
    const r1 = { ...makeRun('r1', {}, [makeResult('Login', 100)]), timestamp: 1000 };
    const r2 = { ...makeRun('r2', {}, [makeResult('Login', 110)]), timestamp: 2000 };
    const baselines: BaselineMark[] = [{ runId: 'r1', markedAt: 1 }];
    const result = computePerScenarioTrend([r1, r2], r1, 'all', baselines);
    const points = result.data['s0'];
    const pt1 = points.find((p) => p.runId === 'r1');
    const pt2 = points.find((p) => p.runId === 'r2');
    expect(pt1?.isBaseline).toBe(true);
    expect(pt2?.isBaseline).toBe(false);
  });
});

// ── Sprint 2: computeRunRegressionStatus ──────────────────────────────────

describe('computeRunRegressionStatus', () => {
  it('returns no-baseline when there are no baselines', () => {
    const run = { ...makeRun('r1'), timestamp: 2000 };
    const allRuns = [makeRun('r0'), run];
    expect(computeRunRegressionStatus(run, allRuns, [])).toBe('no-baseline');
  });

  it('returns no-baseline when all baselines are newer than the run', () => {
    const run = { ...makeRun('r1'), timestamp: 1000 };
    const newerBaseline = { ...makeRun('bl'), timestamp: 2000 };
    const baselines: BaselineMark[] = [{ runId: 'bl', markedAt: 1 }];
    expect(computeRunRegressionStatus(run, [run, newerBaseline], baselines)).toBe('no-baseline');
  });

  it('returns pass when run is within thresholds vs nearest baseline', () => {
    const baseline = { ...makeRun('bl', { p95ResponseTime: 100, tps: 50, errorRate: 1, avgResponseTime: 50 }), timestamp: 1000 };
    // Minimal delta — well within defaults
    const run = { ...makeRun('r1', { p95ResponseTime: 105, tps: 49, errorRate: 1.1, avgResponseTime: 51 }), timestamp: 2000 };
    const baselines: BaselineMark[] = [{ runId: 'bl', markedAt: 1 }];
    expect(computeRunRegressionStatus(run, [baseline, run], baselines)).toBe('pass');
  });

  it('returns warn when run has a warning-level regression', () => {
    const baseline = { ...makeRun('bl', { p95ResponseTime: 100, tps: 50, errorRate: 1, avgResponseTime: 50 }), timestamp: 1000 };
    // p95 increased by 12% — above default threshold of 10%, below 2× (20%), so 'warning'
    const run = { ...makeRun('r1', { p95ResponseTime: 112, tps: 50, errorRate: 1, avgResponseTime: 50 }), timestamp: 2000 };
    const baselines: BaselineMark[] = [{ runId: 'bl', markedAt: 1 }];
    const status = computeRunRegressionStatus(run, [baseline, run], baselines);
    expect(status).toBe('warn');
  });

  it('returns critical when run has a critical regression', () => {
    const baseline = { ...makeRun('bl', { p95ResponseTime: 100, tps: 50, errorRate: 1, avgResponseTime: 50 }), timestamp: 1000 };
    // p95 increased by 25% — above 2× threshold (20%), so 'critical'
    const run = { ...makeRun('r1', { p95ResponseTime: 125, tps: 50, errorRate: 1, avgResponseTime: 50 }), timestamp: 2000 };
    const baselines: BaselineMark[] = [{ runId: 'bl', markedAt: 1 }];
    const status = computeRunRegressionStatus(run, [baseline, run], baselines);
    expect(status).toBe('critical');
  });

  it('uses the most recent prior baseline (not an older one)', () => {
    // Two baselines: bl-old (far away) and bl-near (close). Run should compare against bl-near.
    const blOld = { ...makeRun('bl-old', { p95ResponseTime: 1000 }), timestamp: 500 }; // very slow — would cause critical
    const blNear = { ...makeRun('bl-near', { p95ResponseTime: 100 }), timestamp: 1500 }; // close to run — no regression
    const run = { ...makeRun('r1', { p95ResponseTime: 103 }), timestamp: 2000 };
    const baselines: BaselineMark[] = [
      { runId: 'bl-old', markedAt: 1 },
      { runId: 'bl-near', markedAt: 2 },
    ];
    const status = computeRunRegressionStatus(run, [blOld, blNear, run], baselines);
    expect(status).toBe('pass'); // compared against bl-near, not bl-old
  });

  it('ignores baselines of a different run type (workflow vs non-workflow)', () => {
    // Workflow baseline — should NOT be used for a non-workflow run
    const wfBaseline = { ...makeRun('bl-wf', { p95ResponseTime: 100 }), timestamp: 1000,
      config: { ...makeRun('bl-wf').config, executionMode: 'workflow' as const } };
    // Non-workflow (pool) run — p95 doubled, would be 'critical' if compared against wfBaseline
    const run = { ...makeRun('r1', { p95ResponseTime: 200 }), timestamp: 2000 };
    const baselines: BaselineMark[] = [{ runId: 'bl-wf', markedAt: 1 }];
    // Only baseline is workflow type; run is non-workflow → no valid baseline
    expect(computeRunRegressionStatus(run, [wfBaseline, run], baselines)).toBe('no-baseline');
  });

  it('workflow run ignores non-workflow baselines', () => {
    // Non-workflow (pool) baseline — should NOT be used for a workflow run
    const nonWfBaseline = { ...makeRun('bl', { p95ResponseTime: 100 }), timestamp: 1000 };
    // Workflow run — p95 doubled, would be 'critical' if compared against nonWfBaseline
    const wfRun = {
      ...makeRun('r1', { p95ResponseTime: 200 }),
      timestamp: 2000,
      config: { ...makeRun('r1').config, executionMode: 'workflow' as const },
    };
    const baselines: BaselineMark[] = [{ runId: 'bl', markedAt: 1 }];
    // Only baseline is non-workflow; run is workflow → no valid baseline
    expect(computeRunRegressionStatus(wfRun, [nonWfBaseline, wfRun], baselines)).toBe('no-baseline');
  });
});

describe('RegressionAlert fields', () => {
  it('threshold field stores the configured threshold (not the actual delta) for P95', () => {
    // P95 default threshold is 10%. +15% regression — threshold should be 10, not 15.
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 115 });
    const result = compareRuns(baseline, current);
    const alert = result.regressions.find((r) => r.metric === 'P95 Response Time');
    expect(alert).toBeTruthy();
    expect(alert!.threshold).toBe(DEFAULT_THRESHOLDS.p95Percent); // 10, not 15
    expect(alert!.actual).toBeCloseTo(15, 0); // ~15% actual change
  });

  it('threshold field stores the configured threshold for TPS drop', () => {
    // TPS default threshold is 10%. -20% drop — threshold should be 10, not 20.
    const baseline = makeRun('b', { tps: 100 });
    const current = makeRun('c', { tps: 80 }); // -20%
    const result = compareRuns(baseline, current);
    const alert = result.regressions.find((r) => r.metric === 'TPS');
    expect(alert).toBeTruthy();
    expect(alert!.threshold).toBe(DEFAULT_THRESHOLDS.tpsPercent); // 10, not 20
    expect(alert!.actual).toBeCloseTo(20, 0); // 20% magnitude
  });

  it('threshold and actual fields are correct for error rate regression', () => {
    // Error rate threshold is 1pp absolute. +3pp regression.
    const baseline = makeRun('b', { errorRate: 1 });
    const current = makeRun('c', { errorRate: 4 }); // +3pp
    const result = compareRuns(baseline, current);
    const alert = result.regressions.find((r) => r.metric === 'Error Rate');
    expect(alert).toBeTruthy();
    expect(alert!.threshold).toBe(DEFAULT_THRESHOLDS.errorRateAbsolute); // 1
    expect(alert!.actual).toBeCloseTo(3, 1); // 3pp actual delta
  });

  describe('non-HTTP transport error counting', () => {
    it('failed Kafka produce results (passed=false) are counted as errors', () => {
      const baseline = makeRun('b', { errorRate: 0 }, [makeResult('http-get', 100, 200)]);
      const kafkaFailedResult: TestRun['results'][0] = {
        id: crypto.randomUUID(),
        scenarioId: 'k1',
        scenarioName: 'kafka-produce',
        url: '',
        method: 'KAFKA' as TestRun['results'][0]['method'],
        transportType: 'kafkaProduce',
        httpStatus: 0,
        responseTimeMs: 50,
        responseBody: '',
        timestamp: Date.now(),
        passed: false,
        validationMode: 'none' as const,
        failureDetails: [],
        errorMessage: 'Broker unreachable',
        kafkaResultMeta: { topic: 'orders', partition: 0, offset: 0 },
      };
      const current = makeRun('c', { errorRate: 0 }, [makeResult('http-get', 100, 200), kafkaFailedResult]);
      const comparison = compareRuns(baseline, current);

      const kafkaDelta = comparison.scenarioDeltas.find(d => d.scenarioName === 'kafka-produce');
      expect(kafkaDelta?.currentErrorRate).toBe(100);
    });

    it('passed Kafka results (httpStatus=0, passed=true) are NOT counted as errors', () => {
      const baseline = makeRun('b', { errorRate: 0 }, [makeResult('http-get', 100, 200)]);
      const kafkaPassedResult: TestRun['results'][0] = {
        id: crypto.randomUUID(),
        scenarioId: 'k1',
        scenarioName: 'kafka-produce',
        url: '',
        method: 'KAFKA' as TestRun['results'][0]['method'],
        transportType: 'kafkaProduce',
        httpStatus: 0,
        responseTimeMs: 50,
        responseBody: '',
        timestamp: Date.now(),
        passed: true,
        validationMode: 'none' as const,
        failureDetails: [],
        kafkaResultMeta: { topic: 'orders', partition: 0, offset: 0 },
      };
      const current = makeRun('c', { errorRate: 0 }, [makeResult('http-get', 100, 200), kafkaPassedResult]);
      const comparison = compareRuns(baseline, current);

      const kafkaDelta = comparison.scenarioDeltas.find(d => d.scenarioName === 'kafka-produce');
      expect(kafkaDelta?.currentErrorRate).toBe(0);
    });
  });
});
