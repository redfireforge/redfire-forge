// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { RunComparisonPanel, TrendChart } from './RunComparisonPanel';
import type { TestRun } from '../../../shared/types';
import type { BaselineMark } from '../utils/runBaselines';

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => {
  const FakeChart = ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>;
  return {
    LineChart: FakeChart,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Legend: () => null,
  };
});

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

function makeRun(id: string, summaryOverrides: Partial<TestRun['summary']> = {}): TestRun {
  return {
    id,
    timestamp: Date.now(),
    config: {
      scenarios: [],
      concurrency: 5,
      totalTransactions: 100,
      executionMode: 'pool' as const,
    } as TestRun['config'],
    summary: makeSummary(summaryOverrides),
    results: [],
  };
}

describe('RunComparisonPanel', () => {
  it('renders comparison header', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    expect(container.querySelector('.run-comparison-panel')).toBeTruthy();
    expect(container.querySelector('.run-comparison-header')).toBeTruthy();
  });

  it('shows tabs: overview, scenarios, regressions, distribution', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    const tabs = container.querySelectorAll('.run-comparison-tab');
    expect(tabs.length).toBe(4);
    expect(tabs[0].textContent).toContain('Overview');
    expect(tabs[1].textContent).toContain('Per-Scenario');
    expect(tabs[2].textContent).toContain('Regressions');
    expect(tabs[3].textContent).toContain('Distribution');
  });

  it('renders metric delta table by default', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 150 });
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    expect(container.querySelector('.comparison-table')).toBeTruthy();
    expect(container.textContent).toContain('P95 Response Time');
  });

  it('shows regression alerts for regressed metrics', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 200 }); // +100%
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    expect(container.querySelector('.regression-alerts')).toBeTruthy();
    expect(container.querySelector('.regression-alert')).toBeTruthy();
  });

  it('shows no regression alerts for identical runs', () => {
    const run = makeRun('b');
    const { container } = render(<RunComparisonPanel baselineRun={run} currentRun={run} />);
    expect(container.querySelector('.regression-alerts')).toBeFalsy();
  });

  it('switches to regressions tab', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    const regressionsTab = container.querySelectorAll('.run-comparison-tab')[2];
    fireEvent.click(regressionsTab);
    expect(container.querySelector('.regression-pass')).toBeTruthy(); // no regressions
  });
});

describe('TrendChart', () => {
  it('shows hint when fewer than 2 runs', () => {
    const { container } = render(<TrendChart runs={[makeRun('r1')]} baselines={[]} />);
    expect(container.textContent).toContain('Need at least 2 runs');
  });

  it('renders chart for 2+ runs', () => {
    const runs = [
      { ...makeRun('r1'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const { container } = render(<TrendChart runs={runs} baselines={[]} />);
    expect(container.querySelector('.trend-chart-container')).toBeTruthy();
    expect(container.querySelector('[data-testid="chart"]')).toBeTruthy();
  });

  it('has metric selector', () => {
    const runs = [
      { ...makeRun('r1'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const { container } = render(<TrendChart runs={runs} baselines={[]} />);
    const select = container.querySelector('.trend-metric-select');
    expect(select).toBeTruthy();
    expect(select?.querySelectorAll('option').length).toBe(6);
  });
});
