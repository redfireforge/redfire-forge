/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResultsMetricsCards } from './ResultsMetricsCards';
import { makeSummary } from '@test-utils/factories';
import type { TestRun, TestSummary } from '@shared/types';

function makeTestRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      concurrency: 5,
      iterations: 10,
      executionMode: 'batch',
      scenarioWeights: [],
    },
    summary: makeSummary(),
    results: [],
    ...overrides,
  } as TestRun;
}

describe('ResultsMetricsCards', () => {
  it('renders basic throughput metrics', () => {
    const summary = makeSummary({ tps: 100 });
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('TPS')).toBeInTheDocument();
    expect(screen.getByText('TPM')).toBeInTheDocument();
    expect(screen.getByText('TPH')).toBeInTheDocument();
    expect(screen.getByText('TPD')).toBeInTheDocument();
  });

  it('renders response time metrics', () => {
    const summary = makeSummary({
      avgResponseTime: 50,
      minResponseTime: 10,
      maxResponseTime: 200,
    });
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('50 ms')).toBeInTheDocument();
    expect(screen.getByText('10 ms')).toBeInTheDocument();
    expect(screen.getByText('200 ms')).toBeInTheDocument();
    expect(screen.getByText('Avg Response')).toBeInTheDocument();
    expect(screen.getByText('Min')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
  });

  it('renders percentile metrics', () => {
    const summary = makeSummary({
      p50ResponseTime: 45,
      p95ResponseTime: 90,
      p99ResponseTime: 95,
      p999ResponseTime: 99,
    });
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('45 ms')).toBeInTheDocument();
    expect(screen.getByText('90 ms')).toBeInTheDocument();
    expect(screen.getByText('95 ms')).toBeInTheDocument();
    expect(screen.getByText('99 ms')).toBeInTheDocument();
    expect(screen.getByText('P50')).toBeInTheDocument();
    expect(screen.getByText('P95')).toBeInTheDocument();
    expect(screen.getByText('P99')).toBeInTheDocument();
    expect(screen.getByText('P99.9')).toBeInTheDocument();
  });

  it('renders error rate with error class when > 0', () => {
    const summary = makeSummary({ errorRate: 15 });
    const { container } = render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('15%')).toBeInTheDocument();
    const errorCard = container.querySelector('.metric-card.error');
    expect(errorCard).toBeInTheDocument();
  });

  it('renders error rate with success class when 0', () => {
    const summary = makeSummary({ errorRate: 0 });
    const { container } = render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('0%')).toBeInTheDocument();
    const successCard = container.querySelector('.metric-card.success');
    expect(successCard).toBeInTheDocument();
  });

  it('renders total duration and requests', () => {
    const summary = makeSummary({
      totalDurationMs: 5500,
      totalRequests: 100,
    });
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('5.50s')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Total Duration')).toBeInTheDocument();
    expect(screen.getByText('Total Requests')).toBeInTheDocument();
  });

  it('renders validation failures', () => {
    const summary = makeSummary({ failedValidations: 5 });
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/Validation Failures/)).toBeInTheDocument();
  });

  it('renders avg iteration time for workflow runs', () => {
    const summary = makeSummary({ avgIterationTime: 250 });
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('250 ms')).toBeInTheDocument();
    expect(screen.getByText('Avg Iteration')).toBeInTheDocument();
  });

  it('renders constant-arrival metrics when applicable', () => {
    const summary = makeSummary({
      targetRps: 50,
      peakRps: 48,
      droppedRequests: 3,
    });
    const run = makeTestRun({
      config: {
        concurrency: 10,
        iterations: 100,
        executionMode: 'constant-arrival',
        scenarioWeights: [],
        arrivalRate: { targetRps: 50, durationSec: 60 },
      },
    });
    render(<ResultsMetricsCards summary={summary} selectedRun={run} />);
    
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Target RPS')).toBeInTheDocument();
    expect(screen.getByText('Peak RPS')).toBeInTheDocument();
    expect(screen.getByText(/Dropped Requests/)).toBeInTheDocument();
  });

  it('does not render constant-arrival metrics for batch runs', () => {
    const summary = makeSummary({ targetRps: 50, peakRps: 48 });
    const run = makeTestRun();
    render(<ResultsMetricsCards summary={summary} selectedRun={run} />);
    
    expect(screen.queryByText('Target RPS')).not.toBeInTheDocument();
    expect(screen.queryByText('Peak RPS')).not.toBeInTheDocument();
  });

  it('shows dash for undefined p50', () => {
    const summary: TestSummary = {
      ...makeSummary(),
      p50ResponseTime: undefined as unknown as number,
    };
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    
    expect(screen.getByText('— ms')).toBeInTheDocument();
  });

  it('shows dash for undefined p999', () => {
    const summary: TestSummary = {
      ...makeSummary(),
      p999ResponseTime: undefined as unknown as number,
    };
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    expect(screen.getAllByText('— ms').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render avg iteration card when avgIterationTime is undefined', () => {
    const summary = makeSummary();
    render(<ResultsMetricsCards summary={summary} selectedRun={makeTestRun()} />);
    expect(screen.queryByText('Avg Iteration')).not.toBeInTheDocument();
    expect(screen.getByText('Avg Response')).toBeInTheDocument();
  });

  it('does not render constant-arrival row when selectedRun is null', () => {
    const summary = makeSummary({ targetRps: 50, peakRps: 48, droppedRequests: 3 });
    render(<ResultsMetricsCards summary={summary} selectedRun={null} />);
    expect(screen.queryByText('Target RPS')).not.toBeInTheDocument();
    expect(screen.queryByText('Peak RPS')).not.toBeInTheDocument();
  });

  it('renders constant-arrival dropped requests with success class when zero', () => {
    const summary = makeSummary({
      targetRps: undefined,
      peakRps: undefined,
      droppedRequests: undefined,
    });
    const run = makeTestRun({
      config: {
        concurrency: 10,
        iterations: 100,
        executionMode: 'constant-arrival',
        scenarioWeights: [],
        arrivalRate: { targetRps: 50, durationSec: 60 },
      },
    });
    const { container } = render(<ResultsMetricsCards summary={summary} selectedRun={run} />);
    expect(screen.getByText('Target RPS')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Dropped Requests/)).toBeInTheDocument();
    const droppedCards = container.querySelectorAll('.metric-card.success');
    expect(droppedCards.length).toBeGreaterThanOrEqual(1);
    const droppedValue = screen.getByText(/Dropped Requests/).closest('.metric-card')?.querySelector('.metric-value');
    expect(droppedValue?.textContent).toBe('0');
  });
});
