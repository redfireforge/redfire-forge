/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkflowResultsSummary } from './WorkflowResultsSummary';
import type { TestRun, RequestResult } from '../../../shared/types';

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: crypto.randomUUID(),
    scenarioId: 's1',
    scenarioName: 'Test Request',
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

function makeWorkflowRun(results: RequestResult[]): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      executionMode: 'workflow',
      concurrency: 5,
      totalTransactions: 10,
      workflowId: 'wf-1',
    },
    results,
    summary: {
      totalRequests: results.length,
      successfulRequests: results.filter(r => r.passed).length,
      failedRequests: results.filter(r => !r.passed).length,
      avgResponseTime: Math.round(results.reduce((s, r) => s + r.responseTimeMs, 0) / results.length),
      minResponseTime: Math.min(...results.map(r => r.responseTimeMs)),
      maxResponseTime: Math.max(...results.map(r => r.responseTimeMs)),
      p95ResponseTime: 250,
      p99ResponseTime: 300,
      tps: 10,
      durationMs: 1000,
      totalIterations: 5,
      completedIterations: 5,
    },
  };
}

describe('WorkflowResultsSummary', () => {
  it('renders null for non-workflow runs', () => {
    const run: TestRun = {
      id: 'run-1',
      timestamp: Date.now(),
      config: { executionMode: 'batch', concurrency: 1, totalTransactions: 1 },
      results: [makeResult()],
      summary: {
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 0,
        avgResponseTime: 100,
        minResponseTime: 100,
        maxResponseTime: 100,
        p95ResponseTime: 100,
        p99ResponseTime: 100,
        tps: 1,
        durationMs: 100,
        totalIterations: 1,
        completedIterations: 1,
      },
    };
    const { container } = render(<WorkflowResultsSummary run={run} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when no workflow data in results', () => {
    const run = makeWorkflowRun([makeResult()]);
    const { container } = render(<WorkflowResultsSummary run={run} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders summary for workflow runs with iteration data', () => {
    const results = [
      makeResult({ iterationIndex: 0, workflowNodeId: 'step1', responseTimeMs: 100 }),
      makeResult({ iterationIndex: 0, workflowNodeId: 'step2', responseTimeMs: 150 }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'step1', responseTimeMs: 110 }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'step2', responseTimeMs: 160 }),
    ];
    const run = makeWorkflowRun(results);
    
    const { container } = render(<WorkflowResultsSummary run={run} />);
    
    expect(screen.getByText('Workflow Execution Summary')).toBeInTheDocument();
    const metaItems = container.querySelectorAll('.workflow-meta-item');
    expect(metaItems[0]).toHaveTextContent('2 iterations');
    expect(metaItems[1]).toHaveTextContent('2 steps');
    expect(metaItems[2]).toHaveTextContent('4 total requests');
  });

  it('displays per-step metrics table', () => {
    const results = [
      makeResult({ iterationIndex: 0, workflowNodeId: 'Create Order', responseTimeMs: 100, passed: true }),
      makeResult({ iterationIndex: 0, workflowNodeId: 'Get Order', responseTimeMs: 150, passed: true }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'Create Order', responseTimeMs: 120, passed: false, errorMessage: 'err' }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'Get Order', responseTimeMs: 140, passed: true }),
    ];
    const run = makeWorkflowRun(results);
    
    render(<WorkflowResultsSummary run={run} />);
    
    expect(screen.getByText('Per-Step Metrics')).toBeInTheDocument();
    expect(screen.getByText('Create Order')).toBeInTheDocument();
    expect(screen.getByText('Get Order')).toBeInTheDocument();
  });

  it('shows pass rate indicator with correct styling', () => {
    const results = [
      makeResult({ iterationIndex: 0, workflowNodeId: 'step1', passed: true }),
      makeResult({ iterationIndex: 0, workflowNodeId: 'step2', passed: true }),
    ];
    const run = makeWorkflowRun(results);
    
    render(<WorkflowResultsSummary run={run} />);
    
    const passRateContainer = screen.getByText('Pass Rate').closest('.workflow-pass-rate');
    expect(passRateContainer).toBeInTheDocument();
    expect(passRateContainer).toHaveClass('pass-rate-success');
    expect(passRateContainer?.querySelector('.pass-rate-value')).toHaveTextContent('100%');
  });

  it('expands per-iteration detail section when clicked', () => {
    const results = [
      makeResult({ iterationIndex: 0, workflowNodeId: 'step1' }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'step1' }),
    ];
    const run = makeWorkflowRun(results);
    
    render(<WorkflowResultsSummary run={run} />);
    
    expect(screen.queryByText('Iteration #0')).not.toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Per-Iteration Detail'));
    
    expect(screen.getByText('Iteration #0')).toBeInTheDocument();
    expect(screen.getByText('Iteration #1')).toBeInTheDocument();
  });

  it('calls onResultClick when iteration result is clicked', () => {
    const results = [
      makeResult({ iterationIndex: 0, workflowNodeId: 'step1', scenarioName: 'Create Order' }),
    ];
    const run = makeWorkflowRun(results);
    const onResultClick = vi.fn();
    
    render(<WorkflowResultsSummary run={run} onResultClick={onResultClick} />);
    
    fireEvent.click(screen.getByText('Per-Iteration Detail'));
    fireEvent.click(screen.getByText('Iteration #0'));
    fireEvent.click(screen.getByText('Create Order'));
    
    expect(onResultClick).toHaveBeenCalledWith(results[0]);
  });

  it('displays iteration pass/fail status correctly', () => {
    const results = [
      makeResult({ iterationIndex: 0, workflowNodeId: 'step1', passed: true }),
      makeResult({ iterationIndex: 0, workflowNodeId: 'step2', passed: true }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'step1', passed: true }),
      makeResult({ iterationIndex: 1, workflowNodeId: 'step2', passed: false, errorMessage: 'error' }),
    ];
    const run = makeWorkflowRun(results);
    
    render(<WorkflowResultsSummary run={run} />);
    
    fireEvent.click(screen.getByText('Per-Iteration Detail'));
    
    expect(screen.getByText('(2/2 passed)')).toBeInTheDocument();
    expect(screen.getByText('(1/2 passed)')).toBeInTheDocument();
  });
});
