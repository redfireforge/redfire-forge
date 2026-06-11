/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowRunHistoryDropdown from './WorkflowRunHistoryDropdown';
import type { WorkflowRunHistoryEntry } from '../../hooks/useWorkflowRunCache';

vi.mock('../../../../shared/utils/formatRelativeTime', () => ({
  formatDurationCompactMs: (ms: number) => `${ms}ms`,
  formatRelativeTime: () => 'a moment ago',
  formatTimeWithSeconds: () => '12:00:00',
}));

const makeEntry = (over: Partial<WorkflowRunHistoryEntry> = {}): WorkflowRunHistoryEntry => ({
  id: 'e1',
  timestamp: Date.now(),
  durationMs: 1200,
  passed: true,
  nodeStatuses: {},
  variableSnapshot: null,
  stepsExecuted: 1,
  stepSummaries: [],
  error: null,
  ...over,
});

describe('WorkflowRunHistoryDropdown', () => {
  const handlers = {
    onRestore: vi.fn(),
    onDeleteEntry: vi.fn(),
    onClearHistory: vi.fn(),
  };

  it('disables trigger and shows default label when empty', () => {
    render(<WorkflowRunHistoryDropdown history={[]} activeEntryId={null} {...handlers} />);
    const trigger = screen.getByRole('button', { name: /run history/i });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows active entry label when an entry is active', () => {
    const entry = makeEntry({ id: 'active' });
    render(<WorkflowRunHistoryDropdown history={[entry]} activeEntryId="active" {...handlers} />);
    expect(screen.getByText(/a moment ago/)).toBeTruthy();
  });

  it('opens dropdown and groups entries across time buckets', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    const history = [
      makeEntry({ id: 'now', timestamp: now }),
      makeEntry({ id: 'today', timestamp: now - 30 * 60_000 }),
      makeEntry({ id: 'earlierday', timestamp: now - 6 * 60 * 60_000 }),
      makeEntry({ id: 'week', timestamp: now - 3 * 86_400_000 }),
      makeEntry({ id: 'old', timestamp: now - 30 * 86_400_000 }),
    ];
    render(<WorkflowRunHistoryDropdown history={history} activeEntryId={null} {...handlers} />);
    await user.click(screen.getByRole('button', { name: /run history/i }));
    expect(screen.getByText('Just Now')).toBeTruthy();
    expect(screen.getByText('Older')).toBeTruthy();
  });

  it('restores an entry and closes', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const entry = makeEntry({ id: 'e1', passed: false });
    render(<WorkflowRunHistoryDropdown history={[entry]} activeEntryId={null} {...handlers} onRestore={onRestore} />);
    await user.click(screen.getByRole('button', { name: /run history/i }));
    await user.click(screen.getByTitle('Click to restore this run on the canvas'));
    expect(onRestore).toHaveBeenCalledWith('e1');
  });

  it('deletes current run and clears history', async () => {
    const user = userEvent.setup();
    const onDeleteEntry = vi.fn();
    const onClearHistory = vi.fn();
    const entry = makeEntry({ id: 'e1' });
    render(
      <WorkflowRunHistoryDropdown
        history={[entry]}
        activeEntryId="e1"
        onRestore={vi.fn()}
        onDeleteEntry={onDeleteEntry}
        onClearHistory={onClearHistory}
      />,
    );
    await user.click(screen.getByRole('button', { name: /run history|a moment ago/i }));
    await user.click(screen.getByRole('button', { name: /Delete Current Run/i }));
    expect(onDeleteEntry).toHaveBeenCalledWith('e1');

    await user.click(screen.getByRole('button', { name: /a moment ago/i }));
    await user.click(screen.getByRole('button', { name: /Clear History/i }));
    expect(onClearHistory).toHaveBeenCalledTimes(1);
  });

  it('expands and collapses step details with counts and errors', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({
      id: 'e1',
      passed: false,
      error: 'run failed badly',
      stepSummaries: [
        { nodeId: 'n1', label: 'Step 1', state: 'pass', statusCode: 200, responseTimeMs: 50 },
        { nodeId: 'n2', label: 'Step 2', state: 'fail', statusCode: 500, error: 'oops' },
        { nodeId: 'n3', label: 'Step 3', state: 'skipped' },
      ],
    });
    render(<WorkflowRunHistoryDropdown history={[entry]} activeEntryId="e1" {...handlers} />);
    await user.click(screen.getByRole('button', { name: /a moment ago/i }));
    expect(screen.getByText('1 ✓')).toBeTruthy();
    expect(screen.getByText('1 ✗')).toBeTruthy();
    expect(screen.getByText('1 ⊘')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /3 steps/i }));
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('run failed badly')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Hide steps/i }));
    expect(screen.queryByText('Step 1')).toBeNull();
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({ id: 'e1' });
    render(
      <div>
        <WorkflowRunHistoryDropdown history={[entry]} activeEntryId={null} {...handlers} />
        <button type="button">outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /run history/i }));
    expect(screen.getByText('Just Now')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByText('Just Now')).toBeNull();
  });
});
