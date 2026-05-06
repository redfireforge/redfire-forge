/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
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
    render(<LiveProgressPanel {...baseProps} />);
    expect(screen.getByText(/50 \/ 100 \(50%\)/)).toBeInTheDocument();
  });

  it('shows concurrency in mode tag', () => {
    render(<LiveProgressPanel {...baseProps} />);
    expect(screen.getByText(/C:10/)).toBeInTheDocument();
  });

  it('shows total in mode tag', () => {
    render(<LiveProgressPanel {...baseProps} />);
    expect(screen.getByText(/T:100/)).toBeInTheDocument();
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
});
