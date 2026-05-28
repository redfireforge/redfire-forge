/**
 * Tests for Sprint 3 comparison reporter functions:
 *   - printComparisonSummary  (console table output)
 *   - buildComparisonMarkdown (Markdown report for --comparison-report flag)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { printComparisonSummary, buildComparisonMarkdown } from './reporters';
import type { RunComparison } from '../src/features/results/utils/runBaselines';
import type { TestRun } from '../src/types';
import { makeSummary } from './reporters.test.utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRun(id: string, overrides: Parameters<typeof makeSummary>[0] = {}): TestRun {
  return {
    id,
    timestamp: 1_700_000_000_000,
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

function makeComparison(opts: {
  hasCritical?: boolean;
  hasWarning?: boolean;
  hasImproved?: boolean;
} = {}): RunComparison {
  const metricDeltas = [
    {
      metric: 'Avg Response Time',
      baselineValue: 50,
      currentValue: opts.hasCritical || opts.hasWarning ? 70 : 50,
      delta: opts.hasCritical || opts.hasWarning ? 20 : 0,
      deltaPercent: opts.hasCritical || opts.hasWarning ? 40 : 0,
      regressed: opts.hasCritical || opts.hasWarning ? true : false,
      improved: false,
    },
    {
      metric: 'TPS',
      baselineValue: 100,
      currentValue: opts.hasImproved ? 120 : 100,
      delta: opts.hasImproved ? 20 : 0,
      deltaPercent: opts.hasImproved ? 20 : 0,
      regressed: false,
      improved: opts.hasImproved ? true : false,
    },
    {
      metric: 'Error Rate',
      baselineValue: 1,
      currentValue: 1,
      delta: 0,
      deltaPercent: 0,
      regressed: false,
      improved: false,
    },
  ];

  const regressions = opts.hasCritical
    ? [{ metric: 'Avg Response Time', threshold: 20, actual: 40, severity: 'critical' as const }]
    : opts.hasWarning
      ? [{ metric: 'Avg Response Time', threshold: 20, actual: 40, severity: 'warning' as const }]
      : [];

  return {
    baselineRun: makeRun('bl-001'),
    currentRun: makeRun('cur-001'),
    metricDeltas,
    scenarioDeltas: [],
    regressions,
  };
}

// ── printComparisonSummary ───────────────────────────────────────────────────

describe('printComparisonSummary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('does nothing when quiet is true', () => {
    printComparisonSummary(makeComparison(), { quiet: true });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('prints header and metric rows', () => {
    printComparisonSummary(makeComparison());
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Performance Regression Report');
    expect(output).toContain('Avg Response Time');
    expect(output).toContain('TPS');
    expect(output).toContain('Error Rate');
  });

  it('uses baselineLabel in header when provided', () => {
    printComparisonSummary(makeComparison(), { baselineLabel: 'Sprint 3 Baseline' });
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Sprint 3 Baseline');
  });

  it('prints "No regressions detected" when regressions list is empty', () => {
    printComparisonSummary(makeComparison());
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('No regressions detected');
  });

  it('prints regression count when regressions exist', () => {
    printComparisonSummary(makeComparison({ hasWarning: true }));
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('Regressions');
    expect(output).toContain('warning');
  });

  it('shows 🔴 CRITICAL label for critical severity', () => {
    printComparisonSummary(makeComparison({ hasCritical: true }));
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('🔴 CRITICAL');
  });

  it('shows 🟡 WARN label for warning severity', () => {
    printComparisonSummary(makeComparison({ hasWarning: true }));
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('🟡 WARN');
  });

  it('shows ✓ better for improved metrics', () => {
    printComparisonSummary(makeComparison({ hasImproved: true }));
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('✓ better');
  });

  it('shows — ok for neutral (no change) metrics', () => {
    printComparisonSummary(makeComparison());
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('— ok');
  });

  it('includes ms unit for response-time metrics', () => {
    printComparisonSummary(makeComparison());
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('ms');
  });

  it('includes % unit for Error Rate metric', () => {
    printComparisonSummary(makeComparison());
    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('%');
  });

  it('uses pp unit for Error Rate delta in console output (Bug M)', () => {
    const comparison = makeComparison();
    // Override with a non-zero Error Rate delta to test the unit
    comparison.metricDeltas = [{
      metric: 'Error Rate',
      baselineValue: 1,
      currentValue: 4,
      delta: 3,
      deltaPercent: 300,
      regressed: true,
      improved: false,
    }];
    comparison.regressions = [{ metric: 'Error Rate', threshold: 1, actual: 3, severity: 'critical' }];
    printComparisonSummary(comparison);
    const output = consoleSpy.mock.calls.flat().join('\n');
    // Delta column shows "+3 pp", not "+3%"
    expect(output).toContain('+3 pp');
    expect(output).not.toMatch(/\+3%/);
  });
});

// ── buildComparisonMarkdown ──────────────────────────────────────────────────

describe('buildComparisonMarkdown', () => {
  it('returns a string with a Markdown header', () => {
    const md = buildComparisonMarkdown(makeComparison());
    expect(md).toContain('# Performance Comparison Report');
  });

  it('includes Metric Deltas section with all metrics', () => {
    const md = buildComparisonMarkdown(makeComparison());
    expect(md).toContain('## Metric Deltas');
    expect(md).toContain('Avg Response Time');
    expect(md).toContain('TPS');
    expect(md).toContain('Error Rate');
  });

  it('shows "No regressions detected" banner when no regressions', () => {
    const md = buildComparisonMarkdown(makeComparison());
    expect(md).toContain('No regressions detected');
    expect(md).not.toContain('## Regressions');
  });

  it('includes Regressions section when regressions exist', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasWarning: true }));
    expect(md).toContain('## Regressions');
    expect(md).toContain('Avg Response Time');
  });

  it('shows 🔴 Critical for critical severity in Regressions section', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasCritical: true }));
    expect(md).toContain('🔴 Critical');
  });

  it('shows 🟡 Warning for warning severity in Regressions section', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasWarning: true }));
    expect(md).toContain('🟡 Warning');
  });

  it('shows severity badge in Metric Deltas status column', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasWarning: true }));
    // Status column for Avg Response Time should show 🟡 Warning
    expect(md).toContain('🟡 Warning');
  });

  it('shows 🔴 Critical in Metric Deltas status column for critical regression', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasCritical: true }));
    expect(md).toContain('🔴 Critical');
  });

  it('shows ✓ Improved in Metric Deltas status column for improved metrics', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasImproved: true }));
    expect(md).toContain('✓ Improved');
  });

  it('shows — No change in Metric Deltas for neutral metrics', () => {
    const md = buildComparisonMarkdown(makeComparison());
    expect(md).toContain('— No change');
  });

  it('includes baselineLabel in the header table when provided', () => {
    const md = buildComparisonMarkdown(makeComparison(), 'Sprint 3 Baseline');
    expect(md).toContain('Sprint 3 Baseline');
  });

  it('uses pp unit for Error Rate in Regressions section', () => {
    const comparison = makeComparison();
    comparison.regressions = [{ metric: 'Error Rate', threshold: 2, actual: 4, severity: 'warning' }];
    const md = buildComparisonMarkdown(comparison);
    expect(md).toContain(' pp');
  });

  it('uses pp unit for Error Rate delta column in Metric Deltas table (Bug M)', () => {
    const comparison = makeComparison();
    // Override with a non-zero Error Rate delta to test the Metric Deltas table unit
    comparison.metricDeltas = [{
      metric: 'Error Rate',
      baselineValue: 1,
      currentValue: 4,
      delta: 3,
      deltaPercent: 300,
      regressed: true,
      improved: false,
    }];
    comparison.regressions = [{ metric: 'Error Rate', threshold: 1, actual: 3, severity: 'critical' }];
    const md = buildComparisonMarkdown(comparison);
    // Delta column in Metric Deltas table must show "+3 pp" NOT "+3%"
    expect(md).toContain('+3 pp');
    expect(md).not.toMatch(/\+3%/);
    // Baseline/current value columns still use %
    expect(md).toContain('| 1%');
    expect(md).toContain('4%');
  });

  it('uses % unit for response-time metrics in Regressions section', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasWarning: true }));
    expect(md).toMatch(/Avg Response Time.*20%/);
  });

  it('shows -actual% for TPS regression in Regressions section (TPS drops, not rises)', () => {
    const comparison = makeComparison();
    comparison.regressions = [{ metric: 'TPS', threshold: 10, actual: 20, severity: 'warning' }];
    const md = buildComparisonMarkdown(comparison);
    // TPS regression = drop — must show '-20%', not '+20%'
    expect(md).toContain('-20%');
    expect(md).not.toMatch(/\|\s*TPS\s*\|[^|]*\|\s*10%\s*\|\s*\+20%/);
  });

  it('regression count badge in header when regressions exist', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasCritical: true }));
    expect(md).toContain('1 regression');
    expect(md).toContain('critical');
  });

  it('delta values include sign prefix for positive changes', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasWarning: true }));
    expect(md).toContain('+20');
  });

  it('produces valid pipe-delimited Markdown tables', () => {
    const md = buildComparisonMarkdown(makeComparison({ hasWarning: true }));
    const lines = md.split('\n').filter((l) => l.includes('|'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.startsWith('|')).toBe(true);
    }
  });
});
