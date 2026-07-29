/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveProgressPanel from './LiveProgressPanel';

vi.mock('./LiveCharts', () => ({
  LiveCharts: ({ data }: { data: unknown[] }) => <div data-testid="live-charts">{data.length} points</div>,
}));

vi.mock('./RunnerExecutionConfig', () => ({
  profileLabel: (type: string) => type === 'ramp-up' ? 'Ramp Up' : type === 'spike' ? 'Spike' : 'Constant',
}));

vi.mock('../utils/runnerProgressStorage', () => ({
  thinkTimeLabel: (cfg: { type: string; fixedMs?: number } | undefined) => {
    if (!cfg || cfg.type === 'none') return null;
    return `${cfg.fixedMs}ms think`;
  },
}));

vi.mock('../../../shared/utils/executionMode', () => ({
  getExecutionModeMeta: (mode: string) => ({
    progressLabel: mode === 'sequential' ? 'Sequential' : mode === 'concurrent' ? 'Concurrent' : 'Load Profile',
  }),
}));

describe('LiveProgressPanel', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const baseProps = {
    isRunning: true,
    completed: 50,
    total: 100,
    summary: null,
    timeSeries: [],
    profileMeta: null,
    executionMode: 'concurrent' as const,
    concurrency: 10,
    loadProfile: { type: 'constant' as const, maxConcurrency: 10, durationSec: 60 },
  };

  it('renders progress header', () => {
    render(<LiveProgressPanel {...baseProps} />);
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('shows progress percentage', () => {
    const { container } = render(<LiveProgressPanel {...baseProps} />);
    const progressText = container.querySelector('.progress-text');
    expect(progressText).toBeInTheDocument();
    expect(progressText!.textContent).toMatch(/50\s*\/\s*100.*50%/);
  });

  it('shows concurrency in mode tag', () => {
    render(<LiveProgressPanel {...baseProps} />);
    expect(screen.getByText(/C:10/)).toBeInTheDocument();
  });

  it('shows total in mode tag', () => {
    render(<LiveProgressPanel {...baseProps} />);
    expect(screen.getByText(/I:100/)).toBeInTheDocument();
  });

  it('shows C:1 for sequential mode', () => {
    render(<LiveProgressPanel {...baseProps} executionMode="sequential" />);
    expect(screen.getByText(/C:1/)).toBeInTheDocument();
  });

  it('shows time-based progress for load-profile mode', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        profileMeta={{ elapsedMs: 30000, durationMs: 60000, currentInFlight: 5, targetConcurrency: 10 }}
      />
    );
    expect(screen.getByText(/30\.0s/)).toBeInTheDocument();
  });

  it('shows think time label when provided', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        thinkTime={{ type: 'fixed', fixedMs: 500 }}
      />
    );
    expect(screen.getByText('500ms think')).toBeInTheDocument();
  });

  it('shows host label when provided', () => {
    render(<LiveProgressPanel {...baseProps} hostLabel="staging.api.com" />);
    expect(screen.getByText('staging.api.com')).toBeInTheDocument();
  });

  it('shows summary metrics when available', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        summary={{ tps: 42, avgResponseTime: 150, errorRate: 2.5, failedValidations: 3 }}
      />
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('150 ms')).toBeInTheDocument();
    expect(screen.getByText('2.5%')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows concurrency metric in time-based mode', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        summary={{ tps: 10, avgResponseTime: 100, errorRate: 0, failedValidations: 0 }}
        profileMeta={{ elapsedMs: 10000, durationMs: 60000, currentInFlight: 5, targetConcurrency: 10 }}
      />
    );
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
    expect(screen.getByText('Concurrency')).toBeInTheDocument();
  });

  it('shows LiveCharts when timeSeries has 2+ points', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        timeSeries={[{ t: 1, rt: 100, tps: 10, err: 0, c: 5 }, { t: 2, rt: 110, tps: 12, err: 0, c: 5 }]}
      />
    );
    expect(screen.getByTestId('live-charts')).toBeInTheDocument();
  });

  it('does not show LiveCharts when less than 2 points', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        timeSeries={[{ t: 1, rt: 100, tps: 10, err: 0, c: 5 }]}
      />
    );
    expect(screen.queryByTestId('live-charts')).not.toBeInTheDocument();
  });

  it('shows clear button when not running', () => {
    const onClear = vi.fn();
    render(<LiveProgressPanel {...baseProps} isRunning={false} onClear={onClear} />);
    expect(screen.getByText('✕ Clear')).toBeInTheDocument();
  });

  it('hides clear button when running', () => {
    render(<LiveProgressPanel {...baseProps} isRunning={true} onClear={vi.fn()} />);
    expect(screen.queryByText('✕ Clear')).not.toBeInTheDocument();
  });

  it('shows per-test progress breakdown', () => {
    const selectedTests = [
      { id: 't1', name: 'Test 1', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' as const } } },
    ];
    const liveResults = [
      { scenarioId: 't1', passed: true, responseTime: 100, httpStatus: 200 },
      { scenarioId: 't1', passed: false, responseTime: 200, httpStatus: 500 },
    ];
    render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults as never[]}
        selectedTests={selectedTests as never[]}
        weights={{ t1: 1 }}
      />
    );
    expect(screen.getByText('Test 1:')).toBeInTheDocument();
  });

  it('shows iterations label in workflow mode', () => {
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="workflow"
        total={5}
        completed={3}
      />
    );
    expect(screen.getByText(/iterations/)).toBeInTheDocument();
    const progressText = container.querySelector('.progress-text');
    expect(progressText?.textContent).toMatch(/3\s*\/\s*5.*iterations/);
  });

  it('shows both iterations and request counts in workflow mode when summary available', () => {
    const workflowSummary = {
      tps: 10, avgResponseTime: 50, minResponseTime: 10, maxResponseTime: 200,
      p50ResponseTime: 45, p95ResponseTime: 180, p99ResponseTime: 195,
      errorRate: 5, errorsByStatus: { 500: 2 },
      totalRequests: 40, successfulRequests: 38, failedRequests: 2, failedValidations: 0,
      totalDurationMs: 5000,
    };
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="workflow"
        total={10}
        completed={10}
        summary={workflowSummary}
      />
    );
    const progressText = container.querySelector('.progress-text');
    expect(progressText?.textContent).toMatch(/10\s*\/\s*10.*iterations/);
    expect(progressText?.textContent).toMatch(/38\s*\/\s*40.*requests.*95%/);
  });

  it('shows 0s and loadProfile duration when load-profile has null profileMeta', () => {
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        profileMeta={null}
        loadProfile={{ type: 'sustained', maxConcurrency: 10, durationSec: 90 }}
      />
    );
    const progressText = container.querySelector('.progress-text');
    expect(progressText?.textContent).toContain('0s');
    expect(progressText?.textContent).toMatch(/\/\s*90s/);
  });

  it('uses 0% progress when total is not positive in non-time-based mode', () => {
    const { container } = render(
      <LiveProgressPanel {...baseProps} total={0} completed={10} />
    );
    const bar = container.querySelector('.progress-bar') as HTMLElement | null;
    expect(bar?.style.width).toBe('0%');
    const progressText = container.querySelector('.progress-text');
    expect(progressText?.textContent).toMatch(/\(0%\)/);
  });

  it('shows ramp-up segment in time-based header for ramp-up profile', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        profileMeta={{ elapsedMs: 0, durationMs: 120000, currentInFlight: 1, targetConcurrency: 5 }}
        loadProfile={{ type: 'ramp-up', maxConcurrency: 5, durationSec: 120, rampUpSec: 30 }}
      />
    );
    expect(screen.getByText(/Ramp Up/)).toBeInTheDocument();
    expect(screen.getByText(/ramp 30s/)).toBeInTheDocument();
  });

  it('shows spike concurrency segment in time-based header for spike profile', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        profileMeta={{ elapsedMs: 0, durationMs: 60000, currentInFlight: 2, targetConcurrency: 4 }}
        loadProfile={{ type: 'spike', maxConcurrency: 4, durationSec: 60, spikeConcurrency: 25 }}
      />
    );
    expect(screen.getByText(/Spike/)).toBeInTheDocument();
    expect(screen.getByText(/spike to 25/)).toBeInTheDocument();
  });

  it('falls back to durationSec for ramp-up when rampUpSec omitted', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        profileMeta={{ elapsedMs: 0, durationMs: 60000, currentInFlight: 1, targetConcurrency: 2 }}
        loadProfile={{ type: 'ramp-up', maxConcurrency: 2, durationSec: 48 }}
      />
    );
    expect(screen.getByText(/ramp 48s/)).toBeInTheDocument();
  });

  it('falls back to maxConcurrency * 3 for spike when spikeConcurrency omitted', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        profileMeta={{ elapsedMs: 0, durationMs: 60000, currentInFlight: 1, targetConcurrency: 3 }}
        loadProfile={{ type: 'spike', maxConcurrency: 3, durationSec: 60 }}
      />
    );
    expect(screen.getByText(/spike to 9/)).toBeInTheDocument();
  });

  it('shows Avg Response info and Avg Iteration metric when avgIterationTime is set', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        summary={{
          tps: 1,
          avgResponseTime: 200,
          avgIterationTime: 500,
          errorRate: 0,
          failedValidations: 0,
        }}
      />
    );
    expect(screen.getByText('Avg Iteration')).toBeInTheDocument();
    expect(screen.getByText('500 ms')).toBeInTheDocument();
    expect(
      document.querySelector('[data-tooltip="Average duration of individual HTTP requests"]')
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-tooltip="Average duration of complete workflow iterations (all nodes)"]')
    ).toBeInTheDocument();
  });

  it('omits per-test rows when weight is 0', () => {
    const selectedTests = [
      { id: 't0', name: 'Hidden', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r0', values: {}, enabled: true }], source: { type: 'inline' as const } } },
      { id: 't1', name: 'Visible', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' as const } } },
    ];
    const liveResults = [
      { scenarioId: 't0', passed: true, responseTime: 50, httpStatus: 200 },
      { scenarioId: 't1', passed: true, responseTime: 50, httpStatus: 200 },
    ];
    render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults as never[]}
        selectedTests={selectedTests as never[]}
        weights={{ t0: 0, t1: 1 }}
      />
    );
    expect(screen.queryByText('Hidden:')).not.toBeInTheDocument();
    expect(screen.getByText('Visible:')).toBeInTheDocument();
  });

  it('per-test row shows only pass counts when all results passed', () => {
    const selectedTests = [
      { id: 't1', name: 'All pass', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' as const } } },
    ];
    const liveResults = [
      { scenarioId: 't1', passed: true, responseTime: 10, httpStatus: 200 },
      { scenarioId: 't1', passed: true, responseTime: 11, httpStatus: 200 },
    ];
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults as never[]}
        selectedTests={selectedTests as never[]}
        weights={{ t1: 1 }}
      />
    );
    expect(container.querySelector('.runner-per-test-pass')).toBeTruthy();
    expect(container.querySelector('.runner-per-test-fail')).toBeNull();
    expect(screen.getByText(/✓2/)).toBeInTheDocument();
  });

  it('per-test row shows only fail counts when all results failed', () => {
    const selectedTests = [
      { id: 't1', name: 'All fail', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' as const } } },
    ];
    const liveResults = [
      { scenarioId: 't1', passed: false, responseTime: 10, httpStatus: 500 },
    ];
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults as never[]}
        selectedTests={selectedTests as never[]}
        weights={{ t1: 1 }}
      />
    );
    expect(container.querySelector('.runner-per-test-pass')).toBeNull();
    expect(container.querySelector('.runner-per-test-fail')).toBeTruthy();
    expect(screen.getByText(/✗1/)).toBeInTheDocument();
  });

  it('uses time-based progress layout when concurrent run has total -1', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="concurrent"
        isRunning={true}
        total={-1}
        profileMeta={null}
        loadProfile={{ type: 'sustained', maxConcurrency: 8, durationSec: 45 }}
      />
    );
    expect(screen.queryByText(/C:10/)).not.toBeInTheDocument();
    expect(screen.getByText(/Constant/)).toBeInTheDocument();
    expect(screen.getByText(/Peak:8/)).toBeInTheDocument();
    expect(screen.getByText(/· 45s/)).toBeInTheDocument();
  });

  it('caps time-based progress bar at 100% when elapsed exceeds duration', () => {
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="load-profile"
        profileMeta={{ elapsedMs: 90000, durationMs: 60000, currentInFlight: 1, targetConcurrency: 5 }}
        loadProfile={{ type: 'constant', maxConcurrency: 5, durationSec: 60 }}
      />
    );
    const bar = container.querySelector('.progress-bar') as HTMLElement | null;
    expect(bar?.style.width).toBe('100%');
  });

  it('does not show per-test breakdown when no test has dataSource', () => {
    const selectedTests = [
      { id: 't1', name: 'No DS', url: '', method: 'GET' as const, headers: [] },
    ];
    const liveResults = [{ scenarioId: 't1', passed: true, responseTime: 10, httpStatus: 200 }] as never[];
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults}
        selectedTests={selectedTests as never[]}
        weights={{ t1: 1 }}
      />
    );
    expect(container.querySelector('.runner-per-test-progress')).toBeNull();
  });

  it('does not show per-test breakdown when weights is omitted', () => {
    const selectedTests = [
      { id: 't1', name: 'T1', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' as const } } },
    ];
    const liveResults = [{ scenarioId: 't1', passed: true, responseTime: 10, httpStatus: 200 }] as never[];
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults}
        selectedTests={selectedTests as never[]}
      />
    );
    expect(container.querySelector('.runner-per-test-progress')).toBeNull();
  });

  it('does not show per-test breakdown when liveResults is empty', () => {
    const selectedTests = [
      { id: 't1', name: 'T1', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' as const } } },
    ];
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={[]}
        selectedTests={selectedTests as never[]}
        weights={{ t1: 1 }}
      />
    );
    expect(container.querySelector('.runner-per-test-progress')).toBeNull();
  });

  it('per-test row uses only enabled dataSource rows as expected count', () => {
    const selectedTests = [
      {
        id: 't1',
        name: 'DS',
        url: '',
        method: 'GET',
        headers: [],
        dataSource: {
          columns: [],
          rows: [
            { id: 'r1', values: {}, enabled: false },
            { id: 'r2', values: {}, enabled: true },
          ],
          source: { type: 'inline' as const },
        },
      },
    ];
    const liveResults = [
      { scenarioId: 't1', passed: true, responseTime: 10, httpStatus: 200 },
    ] as never[];
    render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults}
        selectedTests={selectedTests as never[]}
        weights={{ t1: 1 }}
      />
    );
    expect(screen.getByText(/1\/1/)).toBeInTheDocument();
  });

  it('per-test row uses expectedRows 1 when a weighted test has no dataSource', () => {
    const selectedTests = [
      { id: 't1', name: 'With DS', url: '', method: 'GET', headers: [], dataSource: { columns: [], rows: [{ id: 'r1', values: {}, enabled: true }], source: { type: 'inline' as const } } },
      { id: 't2', name: 'Plain', url: '', method: 'GET', headers: [] },
    ];
    const liveResults = [
      { scenarioId: 't1', passed: true, responseTime: 5, httpStatus: 200 },
      { scenarioId: 't2', passed: true, responseTime: 6, httpStatus: 200 },
    ] as never[];
    render(
      <LiveProgressPanel
        {...baseProps}
        liveResults={liveResults}
        selectedTests={selectedTests as never[]}
        weights={{ t1: 1, t2: 1 }}
      />
    );
    expect(screen.getByText('Plain:')).toBeInTheDocument();
    const plainRow = screen.getByText('Plain:').closest('.runner-per-test-row');
    expect(plainRow?.textContent).toMatch(/1\/1/);
  });

  it('does not show clear button when onClear is omitted', () => {
    render(<LiveProgressPanel {...baseProps} isRunning={false} />);
    expect(screen.queryByText('✕ Clear')).not.toBeInTheDocument();
  });

  // --- Constant Arrival Rate ---
  it('shows arrival rate header tag for constant-arrival mode', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="constant-arrival"
        total={-1}
        arrivalRate={{ targetRps: 50, durationSec: 120 }}
      />
    );
    expect(screen.getByText(/Arrival Rate/)).toBeInTheDocument();
    expect(screen.getByText(/Target:50 RPS/)).toBeInTheDocument();
    expect(screen.getByText(/· 120s/)).toBeInTheDocument();
  });

  it('shows ramp info in arrival rate header tag', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="constant-arrival"
        total={-1}
        arrivalRate={{ targetRps: 100, durationSec: 60, ramp: { startRps: 10, endRps: 100, rampDurationSec: 15 } }}
      />
    );
    expect(screen.getByText(/ramp 10→100 RPS/)).toBeInTheDocument();
  });

  it('shows Target RPS, Actual RPS, and Dropped metric cards for arrival mode', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="constant-arrival"
        total={-1}
        arrivalRate={{ targetRps: 50, durationSec: 60 }}
        summary={{
          tps: 45, avgResponseTime: 100, minResponseTime: 10, maxResponseTime: 500,
          p95ResponseTime: 300, p99ResponseTime: 450, p50ResponseTime: 80, p999ResponseTime: 499,
          errorRate: 2, totalRequests: 1000, totalDurationMs: 60000, successfulRequests: 980,
          failedRequests: 20, failedValidations: 5, errorsByStatus: {},
        }}
        profileMeta={{
          elapsedMs: 30000, durationMs: 60000, currentInFlight: 12,
          targetConcurrency: 0,
          targetRps: 50, actualRps: 48.5, droppedRequests: 3,
        }}
      />
    );
    expect(screen.getByText('Target RPS')).toBeInTheDocument();
    expect(screen.getByText('Actual RPS')).toBeInTheDocument();
    expect(screen.getByText('Dropped')).toBeInTheDocument();
    expect(screen.getByText('In-Flight')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('48.5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show Concurrency label for arrival mode (shows In-Flight instead)', () => {
    render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="constant-arrival"
        total={-1}
        arrivalRate={{ targetRps: 10, durationSec: 30 }}
        summary={{
          tps: 10, avgResponseTime: 50, minResponseTime: 5, maxResponseTime: 200,
          p95ResponseTime: 150, p99ResponseTime: 180, p50ResponseTime: 40, p999ResponseTime: 199,
          errorRate: 0, totalRequests: 300, totalDurationMs: 30000, successfulRequests: 300,
          failedRequests: 0, failedValidations: 0, errorsByStatus: {},
        }}
        profileMeta={{
          elapsedMs: 15000, durationMs: 30000, currentInFlight: 5,
          targetConcurrency: 0,
          targetRps: 10, actualRps: 10, droppedRequests: 0,
        }}
      />
    );
    expect(screen.queryByText('Concurrency')).not.toBeInTheDocument();
    expect(screen.getByText('In-Flight')).toBeInTheDocument();
  });

  it('uses time-based progress bar for constant-arrival mode', () => {
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="constant-arrival"
        total={-1}
        arrivalRate={{ targetRps: 10, durationSec: 30 }}
        profileMeta={{
          elapsedMs: 15000, durationMs: 30000, currentInFlight: 5,
          targetConcurrency: 0,
          targetRps: 10, actualRps: 10, droppedRequests: 0,
        }}
      />
    );
    const progressText = container.querySelector('.progress-text');
    expect(progressText!.textContent).toMatch(/15\.0s.*30s/);
  });

  it('uses arrivalRate.durationSec as fallback when profileMeta is null in arrival mode', () => {
    const { container } = render(
      <LiveProgressPanel
        {...baseProps}
        executionMode="constant-arrival"
        total={-1}
        arrivalRate={{ targetRps: 10, durationSec: 45 }}
        profileMeta={null}
      />
    );
    const progressText = container.querySelector('.progress-text');
    expect(progressText!.textContent).toMatch(/0s.*\/.*45s/);
  });

  it('scrolls the progress section into view when a run is active', () => {
    render(<LiveProgressPanel {...baseProps} isRunning={true} />);

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('does not scroll when progress is shown for a finished saved run', () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(<LiveProgressPanel {...baseProps} isRunning={false} />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
