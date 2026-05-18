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
  type BaselineMark,
} from './runBaselines';
import type { TestRun } from '../../../shared/types';

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
  return {
    id: crypto.randomUUID(),
    scenarioId: 's1',
    scenarioName,
    url: 'http://test.com',
    method: 'GET',
    httpStatus,
    responseTimeMs,
    responseBody: '',
    timestamp: Date.now(),
    passed: httpStatus < 400,
    validationMode: 'none' as const,
    failureDetails: [],
  };
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

  it('caps at MAX_BASELINES (10)', async () => {
    for (let i = 0; i < 12; i++) {
      await markAsBaseline(`run-${i}`);
    }
    const result = await loadBaselines();
    expect(result.length).toBeLessThanOrEqual(10);
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

  it('detects regression when P95 degrades beyond threshold', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 150 }); // +50% vs 10% threshold
    const result = compareRuns(baseline, current);

    const p95 = result.metricDeltas.find((d) => d.metric === 'P95 Response Time');
    expect(p95?.regressed).toBe(true);
    expect(result.regressions.length).toBeGreaterThan(0);
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
