import { describe, it, expect } from 'vitest';
import { generateComparisonMarkdown, generateComparisonJson } from './comparisonReport';
import type { RunComparison } from './runBaselines';
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
    p999ResponseTime: 190,
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

function makeRun(id: string, overrides: Partial<TestRun['summary']> = {}, timestamp = 1_700_000_000_000): TestRun {
  return {
    id,
    timestamp,
    config: {
      scenarios: [],
      concurrency: 5,
      iterations: 100,
      executionMode: 'pool' as const,
    } as TestRun['config'],
    summary: makeSummary(overrides),
    results: [],
  };
}

function makeComparison(
  baselineSummaryOverrides: Partial<TestRun['summary']> = {},
  currentSummaryOverrides: Partial<TestRun['summary']> = {},
): RunComparison {
  const baselineRun = makeRun('bl-001', baselineSummaryOverrides, 1_700_000_000_000);
  const currentRun = makeRun('cur-001', currentSummaryOverrides, 1_700_100_000_000);

  const metricDeltas = [
    {
      metric: 'Avg Response Time',
      baselineValue: 50,
      currentValue: 60,
      delta: 10,
      deltaPercent: 20,
      improved: false,
      regressed: true,
    },
    {
      metric: 'TPS',
      baselineValue: 100,
      currentValue: 90,
      delta: -10,
      deltaPercent: -10,
      improved: false,
      regressed: false,
    },
    {
      metric: 'Error Rate',
      baselineValue: 1,
      currentValue: 1.5,
      delta: 0.5,
      deltaPercent: 50,
      improved: false,
      regressed: false,
    },
  ];

  const regressions =
    currentSummaryOverrides.avgResponseTime !== undefined
      ? [{ metric: 'Avg Response Time', threshold: 10, actual: 20, severity: 'warning' as const }]
      : [];

  return {
    baselineRun,
    currentRun,
    metricDeltas,
    scenarioDeltas: [],
    regressions,
  };
}

// ── generateComparisonJson ─────────────────────────────────────────────────

describe('generateComparisonJson', () => {
  it('returns valid JSON', () => {
    const comparison = makeComparison();
    const json = generateComparisonJson(comparison);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes baseline and current summaries', () => {
    const comparison = makeComparison();
    const parsed = JSON.parse(generateComparisonJson(comparison));
    expect(parsed.baseline).toBeDefined();
    expect(parsed.current).toBeDefined();
    expect(parsed.baseline.summary).toBeDefined();
    expect(parsed.current.summary).toBeDefined();
  });

  it('strips results arrays — baseline and current have no results field', () => {
    const comparison = makeComparison();
    const parsed = JSON.parse(generateComparisonJson(comparison));
    expect(parsed.baseline.results).toBeUndefined();
    expect(parsed.current.results).toBeUndefined();
  });

  it('includes metricDeltas, scenarioDeltas, and regressions', () => {
    const comparison = makeComparison();
    const parsed = JSON.parse(generateComparisonJson(comparison));
    expect(Array.isArray(parsed.metricDeltas)).toBe(true);
    expect(Array.isArray(parsed.scenarioDeltas)).toBe(true);
    expect(Array.isArray(parsed.regressions)).toBe(true);
  });

  it('includes exportedAt ISO timestamp', () => {
    const comparison = makeComparison();
    const parsed = JSON.parse(generateComparisonJson(comparison));
    expect(typeof parsed.exportedAt).toBe('string');
    expect(() => new Date(parsed.exportedAt)).not.toThrow();
  });

  it('includes baselineLabel when provided', () => {
    const comparison = makeComparison();
    const parsed = JSON.parse(generateComparisonJson(comparison, 'Release v1.2'));
    expect(parsed.baseline.label).toBe('Release v1.2');
  });

  it('omits label on baseline when not provided', () => {
    const comparison = makeComparison();
    const parsed = JSON.parse(generateComparisonJson(comparison));
    expect(parsed.baseline.label).toBeUndefined();
  });

  it('round-trips metric delta values without loss', () => {
    const comparison = makeComparison();
    const parsed = JSON.parse(generateComparisonJson(comparison));
    expect(parsed.metricDeltas[0].metric).toBe('Avg Response Time');
    expect(parsed.metricDeltas[0].deltaPercent).toBe(20);
  });
});

// ── generateComparisonMarkdown ─────────────────────────────────────────────

describe('generateComparisonMarkdown', () => {
  it('returns a string containing a markdown header', () => {
    const comparison = makeComparison();
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('# Performance Comparison Report');
  });

  it('includes Metric Deltas section', () => {
    const comparison = makeComparison();
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('## Metric Deltas');
    expect(md).toContain('Avg Response Time');
    expect(md).toContain('TPS');
    expect(md).toContain('Error Rate');
  });

  it('uses pp unit for Error Rate delta column in Metric Deltas table (Bug L)', () => {
    // makeComparison Error Rate: delta=0.5, baseline=1%, current=1.5%
    const comparison = makeComparison();
    const md = generateComparisonMarkdown(comparison);
    // Delta column must show "+0.5 pp", NOT "+0.5%"
    expect(md).toContain('+0.5 pp');
    expect(md).not.toMatch(/\+0\.5%/);
    // Baseline/current value columns still use %
    expect(md).toContain('| 1%');
    expect(md).toContain('1.5%');
  });

  it('shows severity badge for regressed metrics in status column', () => {
    const comparison = makeComparison({ avgResponseTime: 50 }, { avgResponseTime: 60 });
    const md = generateComparisonMarkdown(comparison);
    // Regressions section summary
    expect(md).toContain('regression');
    // Status column in Metric Deltas table shows severity badge, not a generic "⚠ Regressed"
    expect(md).toContain('🟡 Warning');
  });

  it('shows no-regressions banner when regressions list is empty', () => {
    const comparison = makeComparison();
    comparison.regressions = [];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('No regressions detected');
    expect(md).not.toContain('## Regressions');
  });

  it('includes Regressions section when regressions exist', () => {
    const comparison = makeComparison({ avgResponseTime: 50 }, { avgResponseTime: 60 });
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('## Regressions');
    expect(md).toContain('Avg Response Time');
  });

  it('uses pp unit for Error Rate regression threshold/actual', () => {
    const comparison = makeComparison();
    comparison.regressions = [{ metric: 'Error Rate', threshold: 1, actual: 2, severity: 'warning' }];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain(' pp');
  });

  it('uses % unit for response-time regression threshold/actual', () => {
    const comparison = makeComparison({ avgResponseTime: 50 }, { avgResponseTime: 60 });
    const md = generateComparisonMarkdown(comparison);
    // Check the regression row — "10%" threshold
    expect(md).toMatch(/Avg Response Time.*10%/);
  });

  it('omits Per-Scenario section when scenarioDeltas is empty', () => {
    const comparison = makeComparison();
    comparison.scenarioDeltas = [];
    const md = generateComparisonMarkdown(comparison);
    expect(md).not.toContain('## Per-Scenario Deltas');
  });

  it('includes Per-Scenario section when scenarioDeltas present', () => {
    const comparison = makeComparison();
    comparison.scenarioDeltas = [
      {
        scenarioName: 'Login',
        featureGroupName: 'Auth',
        baselineAvgTime: 100,
        currentAvgTime: 130,
        baselineCount: 100,
        currentCount: 100,
        baselineErrorRate: 0,
        currentErrorRate: 0,
        timeDelta: 30,
        timeDeltaPercent: 30,
        regressed: true,
      },
    ];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('## Per-Scenario Deltas');
    expect(md).toContain('Auth / Login');
    expect(md).toContain('+30 ms');
    expect(md).toContain('⚠ Regressed');
  });

  it('includes baselineLabel in report when provided', () => {
    const comparison = makeComparison();
    const md = generateComparisonMarkdown(comparison, 'Sprint 3 Baseline');
    expect(md).toContain('Sprint 3 Baseline');
  });

  it('includes critical severity marker', () => {
    const comparison = makeComparison();
    comparison.regressions = [
      { metric: 'P95 Response Time', threshold: 10, actual: 25, severity: 'critical' },
    ];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('🔴 Critical');
  });

  it('includes warning severity marker', () => {
    const comparison = makeComparison({ avgResponseTime: 50 }, { avgResponseTime: 60 });
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('🟡 Warning');
  });

  it('shows -actual% for TPS regression in Regressions section (TPS drops, not rises)', () => {
    const comparison = makeComparison();
    comparison.regressions = [{ metric: 'TPS', threshold: 10, actual: 20, severity: 'warning' }];
    const md = generateComparisonMarkdown(comparison);
    // TPS regression = drop — must show '-20%', not '+20%'
    expect(md).toContain('-20%');
    expect(md).not.toMatch(/\|\s*TPS\s*\|[^|]*\|[^|]*\|\s*\+20%/);
  });

  it('shows per-scenario ✓ Faster status when timeDelta is negative', () => {
    const comparison = makeComparison();
    comparison.scenarioDeltas = [
      {
        scenarioName: 'Search',
        featureGroupName: undefined,
        baselineAvgTime: 100,
        currentAvgTime: 80,
        baselineCount: 50,
        currentCount: 50,
        baselineErrorRate: 0,
        currentErrorRate: 0,
        timeDelta: -20,
        timeDeltaPercent: -20,
        regressed: false,
      },
    ];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('✓ Faster');
    expect(md).toContain('Search'); // no featureGroupName prefix
    expect(md).toContain('-20 ms');
  });

  it('shows per-scenario — OK status when within threshold', () => {
    const comparison = makeComparison();
    comparison.scenarioDeltas = [
      {
        scenarioName: 'Checkout',
        featureGroupName: undefined,
        baselineAvgTime: 100,
        currentAvgTime: 103,
        baselineCount: 30,
        currentCount: 30,
        baselineErrorRate: 0,
        currentErrorRate: 0,
        timeDelta: 3,
        timeDeltaPercent: 3,
        regressed: false, // 3% < p95 threshold of 10%
      },
    ];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('— OK');
  });

  it('includes service name in header when svcName is set on current run', () => {
    const comparison = makeComparison();
    comparison.currentRun.svcName = 'order-service';
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('order-service');
  });

  it('includes environment name in header when envName is set on current run', () => {
    const comparison = makeComparison();
    comparison.currentRun.envName = 'production';
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('production');
  });

  it('uses plural "regressions" in banner when multiple regressions detected', () => {
    const comparison = makeComparison();
    comparison.regressions = [
      { metric: 'Avg Response Time', threshold: 10, actual: 20, severity: 'warning' },
      { metric: 'TPS', threshold: 5, actual: 15, severity: 'warning' },
    ];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('2 regressions detected');
  });

  it('shows 🔴 Critical in Metric Deltas table for a metric with critical regression', () => {
    const comparison = makeComparison();
    comparison.regressions = [{ metric: 'Avg Response Time', threshold: 10, actual: 25, severity: 'critical' }];
    const md = generateComparisonMarkdown(comparison);
    const line = md.split('\n').find((l) => l.includes('Avg Response Time') && l.includes('|'));
    expect(line).toContain('🔴 Critical');
  });

  it('shows ✓ Improved in Metric Deltas table for a metric with improved=true', () => {
    const comparison = makeComparison();
    comparison.metricDeltas = [
      { metric: 'TPS', baselineValue: 80, currentValue: 100, delta: 20, deltaPercent: 25, improved: true, regressed: false },
    ];
    const md = generateComparisonMarkdown(comparison);
    expect(md).toContain('✓ Improved');
  });
});
