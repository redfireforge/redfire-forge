/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowQuickTestFailurePanel from './WorkflowQuickTestFailurePanel';
import type { QuickTestFailureReport } from '../../utils/workflowRunErrors';

function makeReport(overrides: Partial<QuickTestFailureReport> = {}): QuickTestFailureReport {
  return {
    summary: 'Connection refused',
    failedSteps: [],
    passedSteps: [],
    variableSnapshot: {},
    hints: [],
    durationMs: 0,
    ...overrides,
  };
}

describe('WorkflowQuickTestFailurePanel', () => {
  it('renders failed step error and variable snapshot', () => {
    const report = makeReport({
      summary: '$ less_than 500 — got 28 (expected < 500)',
      failedSteps: [{
        nodeId: 'a',
        label: 'GraphQL Assert',
        state: 'fail',
        error: '$ less_than 500 — got 28 (expected < 500)',
      }],
      passedSteps: [{
        nodeId: 'q',
        label: 'GraphQL Query',
        state: 'pass',
        responseTimeMs: 22,
      }],
      variableSnapshot: { gqlLatency: '28' },
      durationMs: 88,
    });
    render(<WorkflowQuickTestFailurePanel report={report} />);
    expect(screen.getByText('Failed steps')).toBeTruthy();
    expect(screen.getByText('GraphQL Assert')).toBeTruthy();
    expect(screen.getByText('Assertion did not pass')).toBeTruthy();
    expect(screen.getByText('1 failed')).toBeTruthy();
    expect(screen.getByText('1 passed')).toBeTruthy();
    expect(screen.getByText('{{gqlLatency}}')).toBeTruthy();
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.getByText('88ms')).toBeTruthy();
  });

  it('shows raw summary as title for non-assert errors', () => {
    const { container } = render(<WorkflowQuickTestFailurePanel report={makeReport({ summary: 'ECONNREFUSED at localhost' })} />);
    expect(container.querySelector('.wf-qt-fail-hero-title')?.textContent).toBe('ECONNREFUSED at localhost');
    expect(screen.queryByText('Assertion did not pass')).toBeNull();
  });

  it('formats duration in seconds when above 1000ms', () => {
    render(<WorkflowQuickTestFailurePanel report={makeReport({ durationMs: 2500 })} />);
    expect(screen.getByText('2.5s')).toBeTruthy();
  });

  it('omits timing when response time is zero', () => {
    const report = makeReport({
      failedSteps: [{ nodeId: 'a', label: 'Step A', state: 'fail', responseTimeMs: 0 }],
    });
    render(<WorkflowQuickTestFailurePanel report={report} />);
    expect(screen.queryByText('0ms')).toBeNull();
  });

  it('shows HTTP status on failed steps', () => {
    const report = makeReport({
      failedSteps: [{
        nodeId: 'a',
        label: 'HTTP Step',
        state: 'fail',
        statusCode: 503,
        error: 'Service unavailable',
      }],
    });
    render(<WorkflowQuickTestFailurePanel report={report} />);
    expect(screen.getByText('HTTP 503')).toBeTruthy();
    expect(screen.getByText('Service unavailable')).toBeTruthy();
  });

  it('renders passed steps section with timing', () => {
    const report = makeReport({
      passedSteps: [{ nodeId: 'p', label: 'Setup', state: 'pass', responseTimeMs: 15 }],
    });
    render(<WorkflowQuickTestFailurePanel report={report} />);
    expect(screen.getByText('Passed steps')).toBeTruthy();
    expect(screen.getByText('Setup')).toBeTruthy();
    expect(screen.getByText('15ms')).toBeTruthy();
  });

  it('renders hints section', () => {
    render(<WorkflowQuickTestFailurePanel report={makeReport({ hints: ['Check endpoint URL', 'Verify auth token'] })} />);
    expect(screen.getByText('What to try')).toBeTruthy();
    expect(screen.getByText('Check endpoint URL')).toBeTruthy();
  });

  it('filters empty variable values and truncates long values', () => {
    const long = 'x'.repeat(130);
    const report = makeReport({
      variableSnapshot: { empty: '   ', short: 'ok', long },
    });
    render(<WorkflowQuickTestFailurePanel report={report} />);
    expect(screen.queryByText('{{empty}}')).toBeNull();
    expect(screen.getByText('{{short}}')).toBeTruthy();
    expect(screen.getByText(`${'x'.repeat(120)}…`)).toBeTruthy();
  });

  it('omits stats bar when no steps and no duration', () => {
    const { container } = render(<WorkflowQuickTestFailurePanel report={makeReport()} />);
    expect(container.querySelector('.wf-qt-fail-stats')).toBeNull();
  });
});
