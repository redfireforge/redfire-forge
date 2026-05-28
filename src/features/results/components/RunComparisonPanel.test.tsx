// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { RunComparisonPanel, TrendChart } from './RunComparisonPanel';
import type { TestRun, RequestResult } from '../../../shared/types';
import type { BaselineMark, RunComparison } from '../utils/runBaselines';
import * as saveFileMod from '../../../shared/utils/fileSaver';
import * as comparisonReportMod from '../utils/comparisonReport';
import * as runBaselines from '../utils/runBaselines';

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn(),
}));

vi.mock('../utils/comparisonReport', () => ({
  generateComparisonMarkdown: vi.fn(() => '# Comparison'),
  generateComparisonJson: vi.fn(() => '{}'),
}));

vi.mock('./ResponseTimeHistogram', () => ({
  ResponseTimeOverlayHistogram: () => <div data-testid="overlay-histogram" />,
}));

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => {
  const FakeChart = ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>;
  return {
    LineChart: FakeChart,
    Line: ({ dot: Dot }: { dot?: (p: Record<string, unknown>) => React.ReactNode }) => {
      if (!Dot) return null;
      const node = Dot({ cx: 4, cy: 5, payload: { runId: 'r-baseline' } } as Record<string, unknown>);
      return <div data-testid="line-with-dot">{node}</div>;
    },
    XAxis: ({ tickFormatter }: { tickFormatter?: (t: number) => string }) => {
      tickFormatter?.(1_700_000_000_000);
      return null;
    },
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: ({
      labelFormatter,
      formatter,
    }: {
      labelFormatter?: (t: unknown) => string;
      formatter?: (v: unknown, name: unknown) => unknown;
    }) => {
      labelFormatter?.(1_700_000_000_000);
      formatter?.(42, 'metric');
      // Also call with null to exercise the Bug D guard (value != null ? ... : '—')
      const nullResult = formatter?.(null, 'metric');
      const nullDisplay = Array.isArray(nullResult) ? String(nullResult[0]) : '';
      return <span data-testid="tooltip-null-display">{nullDisplay}</span>;
    },
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

function makeRun(id: string, summaryOverrides: Partial<TestRun['summary']> = {}, results: RequestResult[] = []): TestRun {
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

function makeReq(partial: Partial<RequestResult> & Pick<RequestResult, 'scenarioName'>): RequestResult {
  return {
    id: Math.random().toString(),
    scenarioId: 'sc-1',
    scenarioName: partial.scenarioName,
    url: 'http://localhost/x',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...partial,
  };
}

describe('RunComparisonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('can return to Overview tab from another tab', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[1]);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[0]);
    expect(container.querySelector('.comparison-table')).toBeTruthy();
  });

  it('renders metric delta table on overview with P95 delta row', () => {
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

  it('shows critical regression alert and regression list with metric deltas', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 250 });
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    const crit = container.querySelector('.regression-alert.regression-critical');
    expect(crit).toBeTruthy();
    expect(crit?.textContent).toContain('🔴');
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[2]);
    expect(container.querySelector('.regression-detail')).toBeTruthy();
    expect(container.querySelector('.regression-detail-body')).toBeTruthy();
  });

  it('shows per-scenario table with regression and faster rows', () => {
    const baseline = makeRun(
      'b',
      {},
      [
        makeReq({ scenarioName: 'Slow', featureGroupName: 'FG1', responseTimeMs: 50 }),
        makeReq({ scenarioName: 'Fast', featureGroupName: 'FG1', responseTimeMs: 200 }),
      ],
    );
    const current = makeRun(
      'c',
      {},
      [
        makeReq({ scenarioName: 'Slow', featureGroupName: 'FG1', responseTimeMs: 200 }),
        makeReq({ scenarioName: 'Fast', featureGroupName: 'FG1', responseTimeMs: 50 }),
      ],
    );
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[1]);
    expect(container.querySelector('.scenario-table')).toBeTruthy();
    expect(container.textContent).toContain('FG1');
    expect(container.querySelector('.row-regressed')).toBeTruthy();
    expect(container.querySelector('.status-improved')).toBeTruthy();
  });

  it('shows empty hint on scenarios tab when there is nothing to compare', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[1]);
    expect(container.querySelector('.empty-hint')).toBeTruthy();
  });

  it('renders distribution tab with overlay histogram', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[3]);
    expect(container.querySelector('[data-testid="overlay-histogram"]')).toBeTruthy();
  });

  it('shows scenario tab alert badge when a scenario regresses', () => {
    const baseline = makeRun('b', {}, [makeReq({ scenarioName: 'X', responseTimeMs: 10 })]);
    const current = makeRun('c', {}, [makeReq({ scenarioName: 'X', responseTimeMs: 500 })]);
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    expect(container.querySelector('.tab-alert')).toBeTruthy();
  });

  it('renders TPS improvement styling on overview when compare marks it improved', () => {
    const spy = vi.spyOn(runBaselines, 'compareRuns').mockReturnValue({
      metricDeltas: [{
        metric: 'TPS',
        baselineValue: 10,
        currentValue: 20,
        delta: 10,
        deltaPercent: 100,
        regressed: false,
        improved: true,
      }],
      scenarioDeltas: [],
      regressions: [],
    } as RunComparison);
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    expect(container.querySelector('.row-improved')).toBeTruthy();
    spy.mockRestore();
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
    expect(select?.querySelectorAll('option').length).toBe(7);
  });

  it('changes displayed metric when select changes', () => {
    const runs = [
      { ...makeRun('r1'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const { container } = render(<TrendChart runs={runs} baselines={[]} />);
    const select = container.querySelector('.trend-metric-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'tps' } });
    expect(select.value).toBe('tps');
  });

  it('renders Line dot renderer for baseline highlighting', () => {
    const runs = [
      { ...makeRun('r-baseline'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const baselines: BaselineMark[] = [{ runId: 'r-baseline', markedAt: 1 }];
    const { container } = render(<TrendChart runs={runs} baselines={baselines} />);
    expect(container.querySelector('[data-testid="line-with-dot"]')).toBeTruthy();
    expect(container.querySelector('circle[r="6"]')).toBeTruthy();
  });

  it('scope select renders with 4 options', () => {
    const runs = [
      { ...makeRun('r1'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const { container } = render(<TrendChart runs={runs} baselines={[]} />);
    const select = container.querySelector('.trend-scope-select');
    expect(select).toBeTruthy();
    expect(select?.querySelectorAll('option').length).toBe(4);
  });

  it('metric2 select renders and excludes the currently selected primary metric', () => {
    const runs = [
      { ...makeRun('r1'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const { container } = render(<TrendChart runs={runs} baselines={[]} />);
    const metric2Select = container.querySelector('.trend-metric-select2') as HTMLSelectElement;
    expect(metric2Select).toBeTruthy();
    // Default primary is p95ResponseTime — it should NOT appear in secondary options
    const options = [...metric2Select.querySelectorAll('option')].map((o) => o.getAttribute('value'));
    expect(options).not.toContain('p95ResponseTime');
    // All other 6 metrics + 'none' placeholder = 7 options
    expect(options.length).toBe(7);
  });

  it('metric2 resets to none when primary changes to same value (Bug A regression)', () => {
    const runs = [
      { ...makeRun('r1'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const { container } = render(<TrendChart runs={runs} baselines={[]} />);
    const metric1Select = container.querySelector('.trend-metric-select') as HTMLSelectElement;
    const metric2Select = container.querySelector('.trend-metric-select2') as HTMLSelectElement;

    // Set metric2 to 'tps'
    fireEvent.change(metric2Select, { target: { value: 'tps' } });
    expect(metric2Select.value).toBe('tps');

    // Now change metric1 to 'tps' — metric2 must clear to 'none'
    fireEvent.change(metric1Select, { target: { value: 'tps' } });
    expect(metric2Select.value).toBe('none');
  });

  it('per-scenario tab shows empty hint when no scenario data', () => {
    // Runs with no results — per-scenario data is empty
    const runs = [
      { ...makeRun('r1'), timestamp: 1000 },
      { ...makeRun('r2'), timestamp: 2000 },
    ];
    const { container } = render(<TrendChart runs={runs} baselines={[]} />);
    // Switch to Per-Scenario tab
    const tabs = container.querySelectorAll('.trend-chart-tab');
    fireEvent.click(tabs[1]); // Per-Scenario
    expect(container.textContent).toContain('No scenario data available');
  });

  it('per-scenario tooltip formatter shows "—" for null value, not "null ms" (Bug D regression)', () => {
    // Runs with scenario data so the per-scenario chart renders
    const r1 = { ...makeRun('r1', {}, [makeReq({ scenarioName: 'Login', responseTimeMs: 100 })]), timestamp: 1000 };
    const r2 = { ...makeRun('r2', {}, [makeReq({ scenarioName: 'Login', responseTimeMs: 110 })]), timestamp: 2000 };
    const { container } = render(<TrendChart runs={[r1, r2]} baselines={[]} />);
    // Switch to Per-Scenario tab so the per-scenario Tooltip formatter is active
    fireEvent.click(container.querySelectorAll('.trend-chart-tab')[1]);
    // The Tooltip mock calls formatter(null) — should return '—', not 'null ms'
    const nullDisplay = container.querySelector('[data-testid="tooltip-null-display"]');
    expect(nullDisplay?.textContent).toBe('—');
    expect(nullDisplay?.textContent).not.toContain('null');
  });
});

describe('RunComparisonPanel - edge cases', () => {
  it('shows status-neutral badge when scenario has no improvement', () => {
    const baseline = makeRun(
      'b',
      {},
      [makeReq({ scenarioName: 'Same', responseTimeMs: 100 })],
    );
    const current = makeRun(
      'c',
      {},
      [makeReq({ scenarioName: 'Same', responseTimeMs: 100 })],
    );
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[1]);
    expect(container.querySelector('.status-neutral')).toBeTruthy();
    expect(container.textContent).toContain('OK');
  });

  it('shows delta-worse class for increased error rate', () => {
    const baseline = makeRun(
      'b',
      {},
      [
        makeReq({ scenarioName: 'API', httpStatus: 200, responseTimeMs: 100 }),
        makeReq({ scenarioName: 'API', httpStatus: 200, responseTimeMs: 100 }),
      ],
    );
    const current = makeRun(
      'c',
      {},
      [
        makeReq({ scenarioName: 'API', httpStatus: 500, responseTimeMs: 100 }),
        makeReq({ scenarioName: 'API', httpStatus: 200, responseTimeMs: 100 }),
      ],
    );
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[1]);
    expect(container.querySelector('.delta-worse')).toBeTruthy();
  });

  it('does not show featureGroupName when it is undefined', () => {
    const baseline = makeRun(
      'b',
      {},
      [makeReq({ scenarioName: 'NoGroup', featureGroupName: undefined, responseTimeMs: 50 })],
    );
    const current = makeRun(
      'c',
      {},
      [makeReq({ scenarioName: 'NoGroup', featureGroupName: undefined, responseTimeMs: 100 })],
    );
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[1]);
    expect(container.querySelector('.scenario-fg')).toBeFalsy();
    expect(container.textContent).toContain('NoGroup');
  });

  it('shows warning regression alert for moderate regression', () => {
    const baseline = makeRun('b', { p95ResponseTime: 100 });
    const current = makeRun('c', { p95ResponseTime: 115 }); // +15%
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    const warning = container.querySelector('.regression-alert.regression-warning');
    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('🟡');
  });

  it('shows regression detail without delta body when metric is missing from deltas', () => {
    const spy = vi.spyOn(runBaselines, 'compareRuns').mockReturnValue({
      metricDeltas: [{ metric: 'TPS', baselineValue: 1, currentValue: 2, delta: 1, deltaPercent: 100, regressed: false, improved: true }],
      scenarioDeltas: [],
      regressions: [{ severity: 'warning' as const, metric: 'Ghost' }],
    } as RunComparison);
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[2]);
    expect(container.querySelector('.regression-detail')).toBeTruthy();
    expect(container.querySelector('.regression-detail-body')).toBeFalsy();
    spy.mockRestore();
  });

  it('shows rename button only when onRenameBaseline is provided', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container: withRename } = render(
      <RunComparisonPanel
        baselineRun={baseline}
        currentRun={current}
        onRenameBaseline={vi.fn()}
      />,
    );
    const { container: withoutRename } = render(
      <RunComparisonPanel baselineRun={baseline} currentRun={current} />,
    );
    expect(withRename.querySelector('.baseline-rename-btn')).toBeTruthy();
    expect(withoutRename.querySelector('.baseline-rename-btn')).toBeFalsy();
  });

  // ── Export button ────────────────────────────────────────────────────────

  it('renders Export button', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    const btn = container.querySelector('.run-comparison-export-btn');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toContain('Export');
  });

  it('shows export menu when Export button is clicked', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    expect(container.querySelector('.run-comparison-export-menu')).toBeFalsy();
    fireEvent.click(container.querySelector('.run-comparison-export-btn')!);
    expect(container.querySelector('.run-comparison-export-menu')).toBeTruthy();
  });

  it('hides export menu when Export button is clicked again', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    const btn = container.querySelector('.run-comparison-export-btn')!;
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(container.querySelector('.run-comparison-export-menu')).toBeFalsy();
  });

  it('calls generateComparisonMarkdown and saveFile when "Export as Markdown" is clicked', () => {
    const mockSaveFile = vi.mocked(saveFileMod.saveFile);
    const mockGenMd = vi.mocked(comparisonReportMod.generateComparisonMarkdown);
    mockSaveFile.mockResolvedValue(undefined);
    mockGenMd.mockReturnValue('# report');

    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(
      <RunComparisonPanel baselineRun={baseline} currentRun={current} baselineLabel="Sprint baseline" />,
    );
    fireEvent.click(container.querySelector('.run-comparison-export-btn')!);
    const menuBtns = container.querySelectorAll('.run-comparison-export-menu button');
    fireEvent.click(menuBtns[0]); // Export as Markdown

    expect(mockGenMd).toHaveBeenCalledWith(expect.any(Object), 'Sprint baseline');
    expect(mockSaveFile).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ filename: 'comparison-report.md', mimeType: 'text/markdown' }),
    );
  });

  it('calls generateComparisonJson and saveFile when "Export as JSON" is clicked', () => {
    const mockSaveFile = vi.mocked(saveFileMod.saveFile);
    const mockGenJson = vi.mocked(comparisonReportMod.generateComparisonJson);
    mockSaveFile.mockResolvedValue(undefined);
    mockGenJson.mockReturnValue('{"data":1}');

    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelector('.run-comparison-export-btn')!);
    const menuBtns = container.querySelectorAll('.run-comparison-export-menu button');
    fireEvent.click(menuBtns[1]); // Export as JSON

    expect(mockGenJson).toHaveBeenCalled();
    expect(mockSaveFile).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ filename: 'comparison-report.json', mimeType: 'application/json' }),
    );
  });

  it('hides export menu after choosing an export option', () => {
    vi.mocked(saveFileMod.saveFile).mockResolvedValue(undefined);
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelector('.run-comparison-export-btn')!);
    fireEvent.click(container.querySelectorAll('.run-comparison-export-menu button')[0]);
    expect(container.querySelector('.run-comparison-export-menu')).toBeFalsy();
  });

  // ── Rename interaction ────────────────────────────────────────────────────

  it('clicking rename button shows rename input pre-filled with baselineLabel', () => {
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(
      <RunComparisonPanel
        baselineRun={baseline}
        currentRun={current}
        baselineLabel="My Baseline"
        onRenameBaseline={vi.fn()}
      />,
    );
    const renameBtn = container.querySelector('.baseline-rename-btn') as HTMLElement;
    fireEvent.click(renameBtn);
    const input = container.querySelector('.baseline-rename-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('My Baseline');
  });

  it('rename blur commits and calls onRenameBaseline with trimmed value', () => {
    const onRename = vi.fn();
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(
      <RunComparisonPanel
        baselineRun={baseline}
        currentRun={current}
        baselineLabel="Old Label"
        onRenameBaseline={onRename}
      />,
    );
    fireEvent.click(container.querySelector('.baseline-rename-btn')!);
    const input = container.querySelector('.baseline-rename-input')!;
    fireEvent.change(input, { target: { value: '  New Label  ' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('b', 'New Label');
  });

  it('rename Escape cancels without calling onRenameBaseline', () => {
    const onRename = vi.fn();
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(
      <RunComparisonPanel
        baselineRun={baseline}
        currentRun={current}
        baselineLabel="Old Label"
        onRenameBaseline={onRename}
      />,
    );
    fireEvent.click(container.querySelector('.baseline-rename-btn')!);
    const input = container.querySelector('.baseline-rename-input')!;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(container.querySelector('.baseline-rename-input')).toBeNull();
  });

  it('rename blur with empty string does not call onRenameBaseline', () => {
    const onRename = vi.fn();
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(
      <RunComparisonPanel
        baselineRun={baseline}
        currentRun={current}
        baselineLabel="Label"
        onRenameBaseline={onRename}
      />,
    );
    fireEvent.click(container.querySelector('.baseline-rename-btn')!);
    const input = container.querySelector('.baseline-rename-input')!;
    fireEvent.change(input, { target: { value: '   ' } }); // only whitespace
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
  });

  // ── Unit display ──────────────────────────────────────────────────────────

  it('shows pp unit for Error Rate delta in overview table', () => {
    const spy = vi.spyOn(runBaselines, 'compareRuns').mockReturnValue({
      metricDeltas: [{
        metric: 'Error Rate',
        baselineValue: 1,
        currentValue: 4,
        delta: 3,
        deltaPercent: 300,
        regressed: true,
        improved: false,
      }],
      scenarioDeltas: [],
      regressions: [],
    } as RunComparison);
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    // Delta should show "pp", not bare "%" — "3 pp" not "3%"
    expect(container.textContent).toContain('pp');
    // Baseline and current should still show '%'
    expect(container.textContent).toContain('1%');
    expect(container.textContent).toContain('4%');
    spy.mockRestore();
  });

  it('shows ms unit on baseline/current in regression detail body', () => {
    const spy = vi.spyOn(runBaselines, 'compareRuns').mockReturnValue({
      metricDeltas: [{
        metric: 'P95 Response Time',
        baselineValue: 100,
        currentValue: 150,
        delta: 50,
        deltaPercent: 50,
        regressed: true,
        improved: false,
      }],
      scenarioDeltas: [],
      regressions: [{ metric: 'P95 Response Time', severity: 'warning' as const, threshold: 10, actual: 50 }],
    } as RunComparison);
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[2]); // Regressions tab
    expect(container.textContent).toContain('100 ms');
    expect(container.textContent).toContain('150 ms');
    // Delta display uses r.actual (+50%)
    expect(container.textContent).toContain('+50%');
    spy.mockRestore();
  });

  it('shows pp unit in regression detail delta for Error Rate (Bug K)', () => {
    const spy = vi.spyOn(runBaselines, 'compareRuns').mockReturnValue({
      metricDeltas: [{
        metric: 'Error Rate',
        baselineValue: 1,
        currentValue: 4,
        delta: 3,
        deltaPercent: 300,  // +300% relative — must NOT be shown
        regressed: true,
        improved: false,
      }],
      scenarioDeltas: [],
      // actual = d.delta = 3 (absolute pp change)
      regressions: [{ metric: 'Error Rate', severity: 'critical' as const, threshold: 1, actual: 3 }],
    } as RunComparison);
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[2]); // Regressions tab
    // Should show absolute pp change, not the misleading relative %
    expect(container.textContent).toContain('+3 pp');
    expect(container.textContent).not.toContain('+300%');
    // Baseline/current still show % unit
    expect(container.textContent).toContain('1%');
    expect(container.textContent).toContain('4%');
    spy.mockRestore();
  });

  it('shows negative % in regression detail delta for TPS drop (Bug K)', () => {
    const spy = vi.spyOn(runBaselines, 'compareRuns').mockReturnValue({
      metricDeltas: [{
        metric: 'TPS',
        baselineValue: 100,
        currentValue: 80,
        delta: -20,
        deltaPercent: -20,
        regressed: true,
        improved: false,
      }],
      scenarioDeltas: [],
      // actual = Math.abs(deltaPercent) = 20
      regressions: [{ metric: 'TPS', severity: 'critical' as const, threshold: 10, actual: 20 }],
    } as RunComparison);
    const baseline = makeRun('b');
    const current = makeRun('c');
    const { container } = render(<RunComparisonPanel baselineRun={baseline} currentRun={current} />);
    fireEvent.click(container.querySelectorAll('.run-comparison-tab')[2]); // Regressions tab
    // TPS: shows "-20%" (magnitude of drop, prepended with minus)
    expect(container.textContent).toContain('-20%');
    spy.mockRestore();
  });
});
