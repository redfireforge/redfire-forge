/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphqlCollectionRunnerPanel } from './GraphqlCollectionRunnerPanel';
import type { GraphqlCollectionRunnerPanelProps } from './GraphqlCollectionRunnerPanel';
import type { CollectionRunEvent, GraphqlCollectionItem } from '../../../shared/types/graphql';
import type { UseGraphqlCollectionRunnerResult } from '../hooks/useGraphqlCollectionRunner';

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveJsonFile: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(id: string, name: string): GraphqlCollectionItem {
  return { id, name, query: '', variables: '{}', headers: [], operationName: '' };
}

function makeRunner(overrides: Partial<UseGraphqlCollectionRunnerResult['state']> = {}): UseGraphqlCollectionRunnerResult {
  return {
    state: {
      running: false,
      paused: false,
      aborted: false,
      events: [],
      currentItemId: null,
      ...overrides,
    },
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    abort: vi.fn(),
    exportResults: vi.fn(() => '[]'),
  };
}

function makeResultEvent(
  itemId: string,
  overrides: Partial<CollectionRunEvent> = {},
): CollectionRunEvent {
  return {
    type: 'result',
    itemId,
    latencyMs: 50,
    tests: [],
    logs: [],
    ...overrides,
  };
}

function makeDefaultProps(
  overrides: Partial<GraphqlCollectionRunnerPanelProps> = {},
): GraphqlCollectionRunnerPanelProps {
  return {
    runner: makeRunner(),
    items: [makeItem('item-1', 'Query Users'), makeItem('item-2', 'Mutation Create')],
    collectionName: 'My Collection',
    ...overrides,
  };
}

describe('GraphqlCollectionRunnerPanel', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ── Basic render ─────────────────────────────────────────────────────────────

  it('renders the panel container', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps()} />);
    expect(screen.getByTestId('gql-runner-panel')).toBeInTheDocument();
  });

  it('shows the collection name in the header', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps()} />);
    expect(screen.getByTestId('gql-runner-title')).toHaveTextContent('My Collection');
  });

  it('renders the Results and Console tabs', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps()} />);
    expect(screen.getByTestId('gql-runner-tab-results')).toBeInTheDocument();
    expect(screen.getByTestId('gql-runner-tab-console')).toBeInTheDocument();
  });

  // ── Running state buttons ────────────────────────────────────────────────────

  it('shows Pause and Abort buttons when running and not paused', () => {
    const runner = makeRunner({ running: true, paused: false });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByTestId('gql-runner-pause')).toBeInTheDocument();
    expect(screen.getByTestId('gql-runner-abort')).toBeInTheDocument();
  });

  it('shows Resume and Abort buttons when running and paused', () => {
    const runner = makeRunner({ running: true, paused: true });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByTestId('gql-runner-resume')).toBeInTheDocument();
    expect(screen.getByTestId('gql-runner-abort')).toBeInTheDocument();
    expect(screen.queryByTestId('gql-runner-pause')).not.toBeInTheDocument();
  });

  it('does not show Pause/Resume/Abort when not running', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps()} />);
    expect(screen.queryByTestId('gql-runner-pause')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gql-runner-resume')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gql-runner-abort')).not.toBeInTheDocument();
  });

  it('calls runner.pause() when Pause is clicked', () => {
    const runner = makeRunner({ running: true, paused: false });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    fireEvent.click(screen.getByTestId('gql-runner-pause'));
    expect(runner.pause).toHaveBeenCalledTimes(1);
  });

  it('calls runner.resume() when Resume is clicked', () => {
    const runner = makeRunner({ running: true, paused: true });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    fireEvent.click(screen.getByTestId('gql-runner-resume'));
    expect(runner.resume).toHaveBeenCalledTimes(1);
  });

  it('calls runner.abort() when Abort is clicked', () => {
    const runner = makeRunner({ running: true });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    fireEvent.click(screen.getByTestId('gql-runner-abort'));
    expect(runner.abort).toHaveBeenCalledTimes(1);
  });

  // ── Export ───────────────────────────────────────────────────────────────────

  it('shows Export JSON button when not running and has results', () => {
    const runner = makeRunner({
      running: false,
      events: [makeResultEvent('item-1')],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByTestId('gql-runner-export')).toBeInTheDocument();
  });

  it('does not show Export JSON button when running', () => {
    const runner = makeRunner({
      running: true,
      events: [makeResultEvent('item-1')],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.queryByTestId('gql-runner-export')).not.toBeInTheDocument();
  });

  it('calls saveJsonFile with export payload on Export click', async () => {
    const { saveJsonFile } = await import('../../../shared/utils/fileSaver');
    const runner = makeRunner({
      running: false,
      events: [makeResultEvent('item-1')],
    });

    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner, collectionName: 'My Collection' })} />);
    fireEvent.click(screen.getByTestId('gql-runner-export'));
    await waitFor(() => {
      expect(saveJsonFile).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'My Collection',
          summary: { passed: 1, failed: 0, skipped: 0 },
          events: runner.state.events,
        }),
        expect.stringMatching(/^runner-results-my-collection-\d+\.json$/),
      );
    });
  });

  // ── Close button ─────────────────────────────────────────────────────────────

  it('shows Complete badge when run finished', () => {
    const runner = makeRunner({
      running: false,
      events: [makeResultEvent('item-1')],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByTestId('gql-runner-status-badge')).toHaveTextContent('Complete');
  });

  it('uses dedicated close button styling', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ onClose: vi.fn() })} />);
    expect(screen.getByTestId('gql-runner-close')).toHaveClass('gql-runner-close-btn');
  });

  it('does not show close button when onClose is not provided', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps()} />);
    expect(screen.queryByTestId('gql-runner-close')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('gql-runner-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Summary row ──────────────────────────────────────────────────────────────

  it('shows summary row with pass/fail counts when events exist', () => {
    const runner = makeRunner({
      running: false,
      events: [
        makeResultEvent('item-1'),
        makeResultEvent('item-2', { type: 'error', error: { message: 'Network error', phase: 'request' } }),
      ],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
  });

  it('shows "Done" label when finished without abort', () => {
    const runner = makeRunner({
      running: false,
      aborted: false,
      events: [makeResultEvent('item-1')],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows "Aborted" label when aborted', () => {
    const runner = makeRunner({
      running: false,
      aborted: true,
      events: [makeResultEvent('item-1')],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByTestId('gql-runner-status-badge')).toHaveTextContent('Aborted');
    expect(document.querySelector('.gql-runner-summary-aborted')).toHaveTextContent('Aborted');
  });

  it('shows skip count when skip events exist', () => {
    const runner = makeRunner({
      events: [
        makeResultEvent('item-1'),
        { type: 'skip', itemId: 'item-2', latencyMs: 0, tests: [], logs: [] },
      ],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
  });

  it('shows current item name when running', () => {
    const runner = makeRunner({
      running: true,
      currentItemId: 'item-1',
      events: [makeResultEvent('item-1')],
    });
    render(
      <GraphqlCollectionRunnerPanel
        {...makeDefaultProps({
          runner,
          items: [makeItem('item-1', 'Query Users')],
        })}
      />,
    );
    expect(screen.getByText(/Running: Query Users/)).toBeInTheDocument();
  });

  // ── Results table ─────────────────────────────────────────────────────────────

  it('renders result events in the results table', () => {
    const runner = makeRunner({
      events: [makeResultEvent('item-1')],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByTestId('gql-runner-table')).toBeInTheDocument();
    expect(screen.getByText('Query Users')).toBeInTheDocument();
  });

  it('shows "Starting…" when running with no events yet', () => {
    const runner = makeRunner({ running: true, events: [] });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByText('Starting…')).toBeInTheDocument();
  });

  it('shows latency in ms', () => {
    const runner = makeRunner({
      events: [makeResultEvent('item-1', { latencyMs: 123 })],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByText('123ms')).toBeInTheDocument();
  });

  it('shows dash when latency is undefined', () => {
    const runner = makeRunner({
      events: [makeResultEvent('item-1', { latencyMs: undefined })],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    // Latency cell shows '—' when latency is undefined
    const latencyCells = document.querySelectorAll('.gql-runner-row-latency');
    expect(latencyCells[0]?.textContent).toBe('—');
  });

  // ── Console tab ──────────────────────────────────────────────────────────────

  it('switches to console tab on click', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps()} />);
    fireEvent.click(screen.getByTestId('gql-runner-tab-console'));
    expect(screen.getByTestId('gql-runner-console')).toBeInTheDocument();
  });

  it('shows run summary lines in console when no script logs exist', () => {
    const runner = makeRunner({
      events: [makeResultEvent('item-1', { latencyMs: 58, logs: [] })],
    });
    render(
      <GraphqlCollectionRunnerPanel
        {...makeDefaultProps({
          runner,
          items: [makeItem('item-1', 'Lesson 8 Health')],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-runner-tab-console'));
    expect(screen.getByText('Completed in 58ms')).toBeInTheDocument();
    expect(screen.getByText('[Lesson 8 Health]')).toBeInTheDocument();
  });

  it('shows empty console message when no run has started', () => {
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps()} />);
    fireEvent.click(screen.getByTestId('gql-runner-tab-console'));
    expect(screen.getByTestId('gql-runner-console-empty')).toHaveTextContent('No run output yet');
  });

  it('shows waiting message in console tab when running with no output yet', () => {
    const runner = makeRunner({ running: true });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    fireEvent.click(screen.getByTestId('gql-runner-tab-console'));
    expect(screen.getByText(/Waiting for run output/)).toBeInTheDocument();
  });

  it('shows log entries in console tab', () => {
    const runner = makeRunner({
      events: [
        makeResultEvent('item-1', {
          logs: [{ level: 'log', message: 'Hello from script', timestamp: 1000 }],
        }),
      ],
    });
    render(
      <GraphqlCollectionRunnerPanel
        {...makeDefaultProps({
          runner,
          items: [makeItem('item-1', 'Query Users')],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-runner-tab-console'));
    expect(screen.getByText('Hello from script')).toBeInTheDocument();
    expect(screen.getByText('[Query Users]')).toBeInTheDocument();
  });

  it('shows log count badge on console tab', () => {
    const runner = makeRunner({
      events: [
        makeResultEvent('item-1', {
          logs: [{ level: 'log', message: 'msg', timestamp: 1000 }],
        }),
      ],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByText('1')).toBeInTheDocument(); // log count badge
  });

  it('clears log view when Clear button is clicked', () => {
    const runner = makeRunner({
      events: [
        makeResultEvent('item-1', {
          logs: [{ level: 'log', message: 'Old log', timestamp: 100 }],
        }),
      ],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    fireEvent.click(screen.getByTestId('gql-runner-tab-console'));
    expect(screen.getByText('Old log')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-runner-console-clear'));
    expect(screen.queryByText('Old log')).not.toBeInTheDocument();
  });

  // ── RunnerRow – script warnings ───────────────────────────────────────────────

  it('shows ⚠ warning indicator for result events with warn/error logs', () => {
    const runner = makeRunner({
      events: [
        makeResultEvent('item-1', {
          type: 'result',
          logs: [{ level: 'warn', message: 'Script warning!', timestamp: 1000 }],
        }),
      ],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByLabelText('Script warning')).toBeInTheDocument();
  });

  // ── RunnerRow – test counts ───────────────────────────────────────────────────

  it('displays test pass/fail counts in results table', () => {
    const runner = makeRunner({
      events: [
        makeResultEvent('item-1', {
          tests: [
            { name: 't1', passed: true },
            { name: 't2', passed: false },
          ],
        }),
      ],
    });
    render(<GraphqlCollectionRunnerPanel {...makeDefaultProps({ runner })} />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('(1 failed)'))).toBeInTheDocument();
  });
});
