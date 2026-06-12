/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowStatusBar from './WorkflowStatusBar';
import type { RunProgress } from './WorkflowToolbar';
import type { WorkflowRunHistoryEntry } from '../../hooks/useWorkflowRunCache';

vi.mock('../panels/WorkflowRunHistoryDropdown', () => ({
  default: ({ history }: { history: WorkflowRunHistoryEntry[] }) => (
    <div data-testid="run-history-dropdown">history:{history.length}</div>
  ),
}));

const baseProgress = (over: Partial<RunProgress> = {}): RunProgress => ({
  completed: 2,
  total: 4,
  failed: 0,
  elapsedMs: 1500,
  ...over,
});

describe('WorkflowStatusBar', () => {
  it('renders counts with no run status', () => {
    render(<WorkflowStatusBar nodeCount={3} edgeCount={2} variableCount={5} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders running progress', () => {
    render(
      <WorkflowStatusBar
        nodeCount={3}
        edgeCount={2}
        variableCount={1}
        lastRunStatus="running"
        runProgress={baseProgress({ lastRunStatus: 'running' })}
      />,
    );
    expect(screen.getByText(/Running step 2\/4/)).toBeTruthy();
    expect(screen.getByText(/1\.5s elapsed/)).toBeTruthy();
  });

  it('renders pass progress with elapsed', () => {
    render(
      <WorkflowStatusBar
        nodeCount={1}
        edgeCount={0}
        variableCount={0}
        lastRunStatus="pass"
        runProgress={baseProgress({ lastRunStatus: 'pass', completed: 4, failed: 0 })}
      />,
    );
    expect(screen.getByText(/4\/4 passed/)).toBeTruthy();
  });

  it('renders pass progress with zero elapsed (no duration suffix)', () => {
    render(
      <WorkflowStatusBar
        nodeCount={1}
        edgeCount={0}
        variableCount={0}
        lastRunStatus="pass"
        runProgress={baseProgress({ lastRunStatus: 'pass', completed: 4, elapsedMs: 0 })}
      />,
    );
    expect(screen.getByText(/4\/4 passed/)).toBeTruthy();
  });

  it('renders fail progress with passed and skipped counts', () => {
    render(
      <WorkflowStatusBar
        nodeCount={5}
        edgeCount={4}
        variableCount={0}
        lastRunStatus="fail"
        runProgress={baseProgress({ lastRunStatus: 'fail', completed: 3, failed: 1, total: 5, elapsedMs: 2000 })}
      />,
    );
    expect(screen.getByText(/1 failed/)).toBeTruthy();
    expect(screen.getByText('2 passed')).toBeTruthy();
    expect(screen.getByText('2 skipped')).toBeTruthy();
    expect(screen.getByText('2.0s')).toBeTruthy();
  });

  it('renders fail progress without elapsed', () => {
    render(
      <WorkflowStatusBar
        nodeCount={5}
        edgeCount={4}
        variableCount={0}
        lastRunStatus="fail"
        runProgress={baseProgress({ lastRunStatus: 'fail', completed: 1, failed: 1, total: 1, elapsedMs: 0 })}
      />,
    );
    expect(screen.getByText(/1 failed/)).toBeTruthy();
  });

  it('renders stopped progress', () => {
    render(
      <WorkflowStatusBar
        nodeCount={2}
        edgeCount={1}
        variableCount={0}
        lastRunStatus="stopped"
        runProgress={baseProgress({ lastRunStatus: 'stopped', completed: 1, total: 3, elapsedMs: 900 })}
      />,
    );
    expect(screen.getByText(/Stopped by user/)).toBeTruthy();
    expect(screen.getByText(/1\/3 completed/)).toBeTruthy();
  });

  it('renders stopped progress without elapsed', () => {
    render(
      <WorkflowStatusBar
        nodeCount={2}
        edgeCount={1}
        variableCount={0}
        lastRunStatus="stopped"
        runProgress={baseProgress({ lastRunStatus: 'stopped', completed: 1, total: 3, elapsedMs: 0 })}
      />,
    );
    expect(screen.getByText(/Stopped by user/)).toBeTruthy();
  });

  it('renders fallback pass/fail/stopped text when no runProgress', () => {
    const { rerender } = render(
      <WorkflowStatusBar nodeCount={1} edgeCount={0} variableCount={0} lastRunStatus="pass" lastRunTime={3000} />,
    );
    expect(screen.getByText(/PASS \(3\.0s\)/)).toBeTruthy();

    rerender(<WorkflowStatusBar nodeCount={1} edgeCount={0} variableCount={0} lastRunStatus="fail" lastRunTime={2000} />);
    expect(screen.getByText(/FAIL \(2\.0s\)/)).toBeTruthy();

    rerender(<WorkflowStatusBar nodeCount={1} edgeCount={0} variableCount={0} lastRunStatus="stopped" />);
    expect(screen.getByText(/STOPPED/)).toBeTruthy();

    rerender(<WorkflowStatusBar nodeCount={1} edgeCount={0} variableCount={0} lastRunStatus="idle" />);
    expect(screen.queryByText(/PASS|FAIL|STOPPED/)).toBeNull();
  });

  it('shows view full error button and fires callback', async () => {
    const user = userEvent.setup();
    const onOpenRunError = vi.fn();
    render(
      <WorkflowStatusBar
        nodeCount={1}
        edgeCount={0}
        variableCount={0}
        lastRunStatus="fail"
        lastRunError="boom"
        onOpenRunError={onOpenRunError}
      />,
    );
    await user.click(screen.getByRole('button', { name: /view full error/i }));
    expect(onOpenRunError).toHaveBeenCalledTimes(1);
  });

  it('does not show error button when not failed', () => {
    render(
      <WorkflowStatusBar
        nodeCount={1}
        edgeCount={0}
        variableCount={0}
        lastRunStatus="pass"
        lastRunError="boom"
      />,
    );
    expect(screen.queryByRole('button', { name: /view full error/i })).toBeNull();
  });

  it('toggles console badge with count', async () => {
    const user = userEvent.setup();
    const onToggleConsole = vi.fn();
    render(
      <WorkflowStatusBar
        nodeCount={1}
        edgeCount={0}
        variableCount={0}
        consoleLineCount={7}
        consoleOpen
        onToggleConsole={onToggleConsole}
      />,
    );
    expect(screen.getByText('7')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /console/i }));
    expect(onToggleConsole).toHaveBeenCalledTimes(1);
  });

  it('renders run history dropdown when all handlers provided', () => {
    render(
      <WorkflowStatusBar
        nodeCount={1}
        edgeCount={0}
        variableCount={0}
        runHistory={[]}
        onRestoreRunHistory={vi.fn()}
        onDeleteRunHistoryEntry={vi.fn()}
        onClearRunHistory={vi.fn()}
      />,
    );
    expect(screen.getByTestId('run-history-dropdown')).toBeTruthy();
  });

  it('omits run history dropdown when handlers missing', () => {
    render(<WorkflowStatusBar nodeCount={1} edgeCount={0} variableCount={0} />);
    expect(screen.queryByTestId('run-history-dropdown')).toBeNull();
  });
});
