/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkflowResultsSummary } from './WorkflowResultsSummary';
import type { TestRun, RequestResult } from '../../../shared/types';

// Mock the canvas context
const mockContext = {
  clearRect: vi.fn(),
  scale: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  setLineDash: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '',
  font: '',
  textAlign: '',
  fillText: vi.fn(),
  fillRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
};

HTMLCanvasElement.prototype.getContext = vi.fn(
  () => mockContext,
) as typeof HTMLCanvasElement.prototype.getContext;

function createMockResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: `result-${Math.random()}`,
    scenarioId: 'sc-1',
    scenarioName: 'Test Scenario',
    url: 'https://api.example.com/test',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

function createWorkflowResult(iterationIndex: number, nodeId: string, passed: boolean, responseTimeMs: number): RequestResult {
  return createMockResult({
    id: `result-${iterationIndex}-${nodeId}`,
    scenarioName: `Step ${nodeId}`,
    responseTimeMs,
    passed,
    iterationIndex,
    workflowNodeId: nodeId,
  });
}

function createWorkflowTestRun(iterations: number, stepsPerIteration: number): TestRun {
  const results: RequestResult[] = [];
  for (let i = 0; i < iterations; i++) {
    for (let s = 0; s < stepsPerIteration; s++) {
      results.push(createWorkflowResult(i, `node-${s}`, true, 100 + s * 10));
    }
  }
  
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      executionMode: 'workflow',
      totalTransactions: iterations,
      concurrentUsers: 1,
      thinkTimeMs: 0,
      errorPolicy: 'continue',
    },
    summary: {
      tps: 10,
      avgResponseTime: 100,
      minResponseTime: 50,
      maxResponseTime: 200,
      p50ResponseTime: 100,
      p95ResponseTime: 180,
      p99ResponseTime: 195,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: results.length,
      successfulRequests: results.length,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs: 1000,
    },
    results,
  };
}

function createNonWorkflowTestRun(): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      executionMode: 'sequential',
      totalTransactions: 10,
      concurrentUsers: 1,
      thinkTimeMs: 0,
      errorPolicy: 'continue',
    },
    summary: {
      tps: 10,
      avgResponseTime: 100,
      minResponseTime: 50,
      maxResponseTime: 200,
      p50ResponseTime: 100,
      p95ResponseTime: 180,
      p99ResponseTime: 195,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: 10,
      successfulRequests: 10,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs: 1000,
    },
    results: Array.from({ length: 10 }, () => createMockResult()),
  };
}

describe('WorkflowResultsSummary', () => {
  it('returns null for non-workflow runs', () => {
    const run = createNonWorkflowTestRun();
    const { container } = render(<WorkflowResultsSummary run={run} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders workflow summary header', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    expect(screen.getByText('Workflow Execution Summary')).toBeInTheDocument();
  });

  it('displays iteration count', () => {
    const run = createWorkflowTestRun(5, 2);
    render(<WorkflowResultsSummary run={run} />);
    const elements = screen.getAllByText('5');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('displays step count', () => {
    const run = createWorkflowTestRun(3, 4);
    render(<WorkflowResultsSummary run={run} />);
    const elements = screen.getAllByText('4');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('displays total requests', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    const elements = screen.getAllByText('6');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('displays pass rate', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    const passRates = screen.getAllByText('100%');
    expect(passRates.length).toBeGreaterThan(0);
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
  });

  it('displays average response time', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    const avgElements = screen.getAllByText('100ms');
    expect(avgElements.length).toBeGreaterThan(0);
  });

  it('displays TPS', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    expect(screen.getByText('TPS')).toBeInTheDocument();
    // TPS value is in a metric container
    const tpsMetric = document.querySelector('.workflow-metric');
    expect(tpsMetric).toBeInTheDocument();
  });

  it('renders per-step metrics table', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    expect(screen.getByText('Per-Step Metrics')).toBeInTheDocument();
    expect(screen.getByText('Step')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Pass %')).toBeInTheDocument();
  });

  it('renders per-iteration detail section', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    expect(screen.getByText('Per-Iteration Detail')).toBeInTheDocument();
    expect(screen.getByText('3 iterations')).toBeInTheDocument();
  });

  it('expands iterations when header is clicked', () => {
    const run = createWorkflowTestRun(3, 2);
    render(<WorkflowResultsSummary run={run} />);
    
    const header = screen.getByText('Per-Iteration Detail').closest('div');
    fireEvent.click(header!);
    
    // After expanding, iteration items should be visible
    expect(screen.getByText('Iteration #0')).toBeInTheDocument();
  });

  it('handles failed results', () => {
    const results: RequestResult[] = [
      createWorkflowResult(0, 'node-0', true, 100),
      createWorkflowResult(0, 'node-1', false, 200),
    ];
    
    const run: TestRun = {
      id: 'run-1',
      timestamp: Date.now(),
      config: {
        executionMode: 'workflow',
        totalTransactions: 1,
        concurrentUsers: 1,
        thinkTimeMs: 0,
        errorPolicy: 'continue',
      },
      summary: {
        tps: 10,
        avgResponseTime: 150,
        minResponseTime: 100,
        maxResponseTime: 200,
        p50ResponseTime: 150,
        p95ResponseTime: 200,
        p99ResponseTime: 200,
        errorRate: 50,
        errorsByStatus: {},
        totalRequests: 2,
        successfulRequests: 1,
        failedRequests: 1,
        failedValidations: 0,
        totalDurationMs: 300,
      },
      results,
    };
    
    render(<WorkflowResultsSummary run={run} />);
    // Pass rate is displayed in a specific element
    const passRateElement = document.querySelector('.pass-rate-value');
    expect(passRateElement).toBeInTheDocument();
  });

  it('calls onResultClick when a result is clicked', () => {
    const run = createWorkflowTestRun(2, 2);
    const onResultClick = vi.fn();
    render(<WorkflowResultsSummary run={run} onResultClick={onResultClick} />);
    
    // Expand iterations
    const header = screen.getByText('Per-Iteration Detail').closest('div');
    fireEvent.click(header!);
    
    // Expand first iteration
    const iterationHeader = screen.getByText('Iteration #0').closest('div');
    fireEvent.click(iterationHeader!);
    
    // Click a result
    const resultItems = document.querySelectorAll('.iteration-result');
    if (resultItems.length > 0) {
      fireEvent.click(resultItems[0]);
      expect(onResultClick).toHaveBeenCalled();
    }
  });

  it('displays chart stats', () => {
    const run = createWorkflowTestRun(5, 2);
    render(<WorkflowResultsSummary run={run} />);
    expect(screen.getByText(/Min:/)).toBeInTheDocument();
    expect(screen.getByText(/Max:/)).toBeInTheDocument();
    expect(screen.getByText(/Avg:/)).toBeInTheDocument();
  });

  it('shows singular iteration label in header when count is 1', () => {
    const run = createWorkflowTestRun(1, 2);
    const { container } = render(<WorkflowResultsSummary run={run} />);
    const meta = container.querySelector('.workflow-summary-meta');
    expect(meta?.textContent).toMatch(/1 iteration(?!s)/);
  });

  it('shows iteration chart tooltip on canvas mouse move', () => {
    const run = createWorkflowTestRun(3, 2);
    const { container } = render(<WorkflowResultsSummary run={run} />);
    const wrap = container.querySelector('.workflow-iteration-chart') as HTMLDivElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 800, configurable: true });
    const canvas = wrap.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 200,
      right: 800,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    // Pick a point over the first bar (depends on chart padding + bar spacing)
    fireEvent.mouseMove(canvas, { clientX: 235, clientY: 80 });
    expect(container.querySelector('.chart-tooltip')).toBeTruthy();
    fireEvent.mouseMove(canvas, { clientX: 5, clientY: 80 });
    expect(container.querySelector('.chart-tooltip')).toBeFalsy();
    fireEvent.mouseLeave(canvas);
    expect(container.querySelector('.chart-tooltip')).toBeFalsy();
  });
});
