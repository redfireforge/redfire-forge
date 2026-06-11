/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowExecSummary from './WorkflowExecSummary';
import type { RunProgress } from '../canvas/WorkflowToolbar';

const progress = (over: Partial<RunProgress> = {}): RunProgress => ({
  completed: 2,
  total: 4,
  failed: 0,
  elapsedMs: 2000,
  lastRunStatus: 'pass',
  ...over,
});

describe('WorkflowExecSummary', () => {
  it('returns null when runProgress is null', () => {
    const { container } = render(<WorkflowExecSummary runProgress={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when status is idle', () => {
    const { container } = render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'idle' })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders running state', () => {
    render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'running', completed: 1, total: 3 })} />);
    expect(screen.getByText('Running Quick Test…')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });

  it('renders pass state and opens console on click', async () => {
    const user = userEvent.setup();
    const onOpenConsole = vi.fn();
    render(
      <WorkflowExecSummary
        runProgress={progress({ lastRunStatus: 'pass', completed: 4, total: 4, elapsedMs: 3000 })}
        onOpenConsole={onOpenConsole}
      />,
    );
    expect(screen.getByText('All Steps Passed')).toBeTruthy();
    expect(screen.getByText(/Completed in 3\.0s/)).toBeTruthy();
    await user.click(screen.getByTitle('Click to open console'));
    expect(onOpenConsole).toHaveBeenCalledTimes(1);
  });

  it('renders fail state with failed step label', () => {
    render(
      <WorkflowExecSummary
        runProgress={progress({ lastRunStatus: 'fail', completed: 3, failed: 1, total: 4 })}
        failedStepLabel="Login"
      />,
    );
    expect(screen.getByText('1 Step Failed')).toBeTruthy();
    expect(screen.getByText(/"Login" — click to view error details/)).toBeTruthy();
  });

  it('renders fail state with plural and no label', () => {
    render(
      <WorkflowExecSummary
        runProgress={progress({ lastRunStatus: 'fail', completed: 3, failed: 2, total: 4 })}
      />,
    );
    expect(screen.getByText('2 Steps Failed')).toBeTruthy();
    expect(screen.getByText('Click to view error details')).toBeTruthy();
  });

  it('does not navigate when running (no button role)', () => {
    render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'running' })} onOpenConsole={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /click to open console/i })).toBeNull();
  });

  it('dismisses via close button', async () => {
    const user = userEvent.setup();
    render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'fail', failed: 1 })} />);
    expect(screen.getByText('1 Step Failed')).toBeTruthy();
    await user.click(screen.getByTitle('Dismiss'));
    expect(screen.queryByText('1 Step Failed')).toBeNull();
  });

  describe('auto-dismiss', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => { vi.useRealTimers(); });

    it('auto-dismisses pass results after 10s', () => {
      render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'pass' })} />);
      expect(screen.getByText('All Steps Passed')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(screen.queryByText('All Steps Passed')).toBeNull();
    });

    it('keeps showing fail results (no auto-dismiss)', () => {
      render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'fail', failed: 1 })} />);
      act(() => { vi.advanceTimersByTime(20_000); });
      expect(screen.getByText('1 Step Failed')).toBeTruthy();
    });
  });

  it('hides when transitioning to idle', () => {
    const { rerender, container } = render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'fail', failed: 1 })} />);
    expect(screen.getByText('1 Step Failed')).toBeTruthy();
    rerender(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'idle' })} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles zero total without crashing (0% width)', () => {
    render(<WorkflowExecSummary runProgress={progress({ lastRunStatus: 'running', completed: 0, total: 0 })} />);
    expect(screen.getByText('Running Quick Test…')).toBeTruthy();
  });
});
