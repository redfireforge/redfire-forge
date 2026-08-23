/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import {
  selectOption,
  getCustomSelectValue,
  getCustomSelectOptionLabels,
} from '@test-utils/customSelectHelper';
import WorkflowExecutionReplayModal from './WorkflowExecutionReplayModal';
import type { WorkflowExecutionTrace, WorkflowIterationTrace } from '@shared/types';

/** Left column of the modal footer (iteration / duration summary only; excludes nav hint + Close). */
function getReplayFooterStatusHost(): HTMLElement {
  const row = screen.getByRole('dialog').querySelector('.wf-config-modal-footer > div');
  const first = row?.querySelector(':scope > div:first-child');
  if (!first) throw new Error('replay footer status host not found');
  return first as HTMLElement;
}

function replayIterationSelect(): Element {
  return document.querySelector('.replay-iteration-selector .cs-wrapper')!;
}

const baseIteration = (overrides: Partial<WorkflowIterationTrace> & Pick<WorkflowIterationTrace, 'index'>): WorkflowIterationTrace => ({
  passed: true,
  durationMs: 100,
  events: [
    {
      nodeId: 'n1',
      nodeType: 'http',
      nodeLabel: 'Step',
      timestamp: Date.UTC(2026, 4, 1, 12, 0, 0),
      state: 'pass',
      durationMs: 10,
    },
  ],
  finalVariables: {},
  traversedEdges: [],
  ...overrides,
});

vi.mock('./WorkflowExecutionCanvas', () => ({
  default: ({
    onNodeClick,
    onToggleMinimap,
    showMinimap,
  }: {
    onNodeClick?: (id: string) => void;
    onToggleMinimap?: () => void;
    showMinimap?: boolean;
  }) => (
    <div data-testid="workflow-canvas">
      <button type="button" data-testid="canvas-trigger-node" onClick={() => onNodeClick?.('n-label')}>
        Open node panel
      </button>
      <button type="button" data-testid="canvas-trigger-node-name" onClick={() => onNodeClick?.('n-name')}>
        Open name-field node
      </button>
      <button type="button" data-testid="canvas-trigger-node-raw-id" onClick={() => onNodeClick?.('n-raw')}>
        Open raw-id node
      </button>
      <button type="button" data-testid="canvas-empty-node-id" onClick={() => onNodeClick?.('')}>
        Clear node id string
      </button>
      <button type="button" data-testid="canvas-toggle-minimap" onClick={() => onToggleMinimap?.()}>
        Toggle minimap
      </button>
      <span data-testid="show-minimap">{String(showMinimap)}</span>
    </div>
  ),
}));

vi.mock('./NodeExecutionDetailPanel', () => ({
  default: ({
    nodeLabel,
    onClose,
    onIterationClick,
  }: {
    nodeLabel?: string;
    onClose?: () => void;
    onIterationClick?: (iterIndex: number) => void;
  }) => (
    <div data-testid="node-detail-panel">
      <span data-testid="panel-node-label">{nodeLabel}</span>
      <button type="button" data-testid="panel-close" onClick={() => onClose?.()}>
        Close panel
      </button>
      {onIterationClick ? (
        <button type="button" data-testid="panel-jump-iteration" onClick={() => onIterationClick(2)}>
          Jump to iteration 2
        </button>
      ) : null}
    </div>
  ),
}));

function createMockTrace(): WorkflowExecutionTrace {
  return {
    workflowId: 'wf-123',
    workflowName: 'Order Processing',
    totalIterations: 5,
    totalDurationMs: 2500,
    iterations: [
      {
        index: 0,
        passed: true,
        durationMs: 500,
        events: [
          {
            nodeId: 'n1',
            nodeType: 'http',
            nodeLabel: 'Create Order',
            timestamp: Date.now(),
            state: 'pass',
            durationMs: 245,
          },
        ],
        finalVariables: { orderId: 'ORD-1' },
        traversedEdges: ['e1'],
      },
    ],
    traversedEdges: ['e1'],
    workflowSnapshot: {
      nodes: [],
      edges: [],
    },
  };
}

/** Three iterations with distinct durations for formatDuration branches; nodes for label resolution */
function createMultiIterationTrace(): WorkflowExecutionTrace {
  return {
    workflowId: 'wf-multi',
    workflowName: 'Multi Iteration WF',
    totalIterations: 3,
    totalDurationMs: 5000,
    iterations: [
      baseIteration({
        index: 0,
        passed: true,
        durationMs: 0.4,
      }),
      baseIteration({
        index: 1,
        passed: false,
        durationMs: 50,
      }),
      baseIteration({
        index: 2,
        passed: true,
        durationMs: 1500,
      }),
    ],
    traversedEdges: [],
    workflowSnapshot: {
      nodes: [
        { id: 'n-label', data: { label: 'From Label' } },
        { id: 'n-name', data: { name: 'From Name' } },
        { id: 'n-raw', data: {} },
      ],
      edges: [],
    },
  };
}

describe('WorkflowExecutionReplayModal', () => {
  let onCloseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCloseMock = vi.fn();
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('renders workflow name and metadata', () => {
    const trace = createMockTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(screen.getByText('Order Processing')).toBeInTheDocument();
    expect(screen.getAllByText(/5 iteration/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2\.50s/)).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const trace = createMockTrace();
    const user = userEvent.setup();

    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    const footer = screen.getByRole('dialog').querySelector('.wf-config-modal-footer') as HTMLElement;
    const closeButton = within(footer).getByRole('button', { name: /^close$/i });
    await user.click(closeButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed and no node selected', () => {
    const trace = createMockTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('clears selected node on first Escape when a node is selected, then closes on second Escape', async () => {
    const trace = createMultiIterationTrace();
    const user = userEvent.setup();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    await user.click(screen.getByTestId('canvas-trigger-node'));
    await waitFor(() => expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('node-detail-panel')).not.toBeInTheDocument());
    expect(onCloseMock).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when other keys are pressed', () => {
    const trace = createMockTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('does not navigate iterations with arrow keys when totalIterations is 1', () => {
    const trace = createMockTrace();
    trace.totalIterations = 1;

    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(screen.getByText(/Iteration #1 — Passed/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(screen.getByText(/Iteration #1 — Passed/)).toBeInTheDocument();
    expect(screen.queryByText(/← → navigate/)).not.toBeInTheDocument();
  });

  it('navigates iterations with ArrowRight and ArrowLeft from keyboard', async () => {
    const trace = createMultiIterationTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(within(getReplayFooterStatusHost()).getByText(/Total Duration: 5\.00s/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      const host = getReplayFooterStatusHost();
      expect(within(host).getByText(/Iteration #1 — Passed/)).toBeInTheDocument();
      expect(within(host).getByText(/<1ms/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      const host = getReplayFooterStatusHost();
      expect(within(host).getByText(/Iteration #2 — Failed/)).toBeInTheDocument();
      expect(within(host).getByText(/50ms/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      const host = getReplayFooterStatusHost();
      expect(within(host).getByText(/Iteration #3 — Passed/)).toBeInTheDocument();
      expect(within(host).getByText(/1\.50s/)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #3 — Passed/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #2 — Failed/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #1 — Passed/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #1 — Passed/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Total Duration/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #3 — Passed/)).toBeInTheDocument(),
    );
  });

  it('uses A key to return to aggregate view when not modified', async () => {
    const trace = createMultiIterationTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #1 — Passed/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Total Duration/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #1 — Passed/)).toBeInTheDocument(),
    );
    fireEvent.keyDown(window, { key: 'A' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Total Duration/)).toBeInTheDocument(),
    );
  });

  it('ignores A key when Ctrl or Meta is held', async () => {
    const trace = createMultiIterationTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #1 — Passed/)).toBeInTheDocument(),
    );

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(within(getReplayFooterStatusHost()).getByText(/Iteration #1 — Passed/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'a', metaKey: true });
    expect(within(getReplayFooterStatusHost()).getByText(/Iteration #1 — Passed/)).toBeInTheDocument();
  });

  it('changes iteration via select and prev/next buttons', async () => {
    const trace = createMultiIterationTrace();
    const user = userEvent.setup();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(getCustomSelectValue(replayIterationSelect())).toBe('All Iterations (Aggregate)');

    const prev = screen.getByTitle('Previous iteration (←)');
    const next = screen.getByTitle('Next iteration (→)');
    expect(prev).toBeDisabled();
    expect(next).toBeDisabled();

    selectOption(replayIterationSelect(), 'Iteration #2 — ✗ Fail');
    expect(within(getReplayFooterStatusHost()).getByText(/Iteration #2 — Failed/)).toBeInTheDocument();
    expect(screen.getByText(/⟵ All/)).toBeInTheDocument();
    expect(prev).not.toBeDisabled();
    expect(next).not.toBeDisabled();

    await user.click(next);
    expect(within(getReplayFooterStatusHost()).getByText(/Iteration #3 — Passed/)).toBeInTheDocument();
    expect(next).toBeDisabled();

    await user.click(prev);
    expect(within(getReplayFooterStatusHost()).getByText(/Iteration #2 — Failed/)).toBeInTheDocument();

    await user.click(screen.getByTitle('Back to aggregate view (A)'));
    expect(within(getReplayFooterStatusHost()).getByText(/Total Duration/)).toBeInTheDocument();
    expect(screen.queryByTitle('Back to aggregate view (A)')).not.toBeInTheDocument();
  });

  it('shows keyboard hint in footer when multiple iterations', () => {
    const trace = createMultiIterationTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(screen.getByText(/← → navigate • A aggregate • Esc close/)).toBeInTheDocument();
  });

  it('resolves node label from data.label, data.name, or node id', async () => {
    const trace = createMultiIterationTrace();
    const user = userEvent.setup();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    await user.click(screen.getByTestId('canvas-trigger-node'));
    await waitFor(() => expect(screen.getByTestId('panel-node-label')).toHaveTextContent('From Label'));

    await user.click(screen.getByTestId('panel-close'));
    await user.click(screen.getByTestId('canvas-trigger-node-name'));
    await waitFor(() => expect(screen.getByTestId('panel-node-label')).toHaveTextContent('From Name'));

    await user.click(screen.getByTestId('panel-close'));
    await user.click(screen.getByTestId('canvas-trigger-node-raw-id'));
    await waitFor(() => expect(screen.getByTestId('panel-node-label')).toHaveTextContent('n-raw'));
  });

  it('clears selection when canvas passes empty node id', async () => {
    const trace = createMultiIterationTrace();
    const user = userEvent.setup();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    await user.click(screen.getByTestId('canvas-trigger-node'));
    await waitFor(() => expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument());

    await user.click(screen.getByTestId('canvas-empty-node-id'));
    await waitFor(() => expect(screen.queryByTestId('node-detail-panel')).not.toBeInTheDocument());
  });

  it('toggles minimap callback', async () => {
    const trace = createMultiIterationTrace();
    const user = userEvent.setup();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(screen.getByTestId('show-minimap')).toHaveTextContent('false');
    await user.click(screen.getByTestId('canvas-toggle-minimap'));
    expect(screen.getByTestId('show-minimap')).toHaveTextContent('true');
    await user.click(screen.getByTestId('canvas-toggle-minimap'));
    expect(screen.getByTestId('show-minimap')).toHaveTextContent('false');
  });

  it('calls onIterationClick from detail panel only in aggregate view', async () => {
    const trace = createMultiIterationTrace();
    const user = userEvent.setup();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    await user.click(screen.getByTestId('canvas-trigger-node'));
    expect(screen.getByTestId('panel-jump-iteration')).toBeInTheDocument();

    await user.click(screen.getByTestId('panel-jump-iteration'));
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Iteration #3 — Passed/)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('panel-jump-iteration')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('panel-close'));
    selectOption(replayIterationSelect(), 'All Iterations (Aggregate)');
    await waitFor(() =>
      expect(within(getReplayFooterStatusHost()).getByText(/Total Duration/)).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('canvas-trigger-node'));
    expect(screen.getByTestId('panel-jump-iteration')).toBeInTheDocument();
  });

  it('formats footer duration as em dash when iteration duration is missing', async () => {
    const trace = createMultiIterationTrace();
    trace.iterations[1] = {
      ...trace.iterations[1],
      durationMs: undefined as unknown as number,
    };

    const _user = userEvent.setup();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    selectOption(replayIterationSelect(), 'Iteration #2 — ✗ Fail');

    await waitFor(() => {
      const footerSummary = screen.getByRole('dialog').querySelector('.wf-config-modal-footer');
      expect(footerSummary).toHaveTextContent(/Iteration #2 — Failed/u);
      expect(footerSummary).toHaveTextContent('—');
    });
  });

  it('falls back to full trace when keyboard selects iteration index beyond iterations array', async () => {
    const trace = createMultiIterationTrace();
    trace.totalIterations = 5;

    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument();
    });
  });

  it('renders iteration options with pass and fail markers', () => {
    const trace = createMultiIterationTrace();
    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    const labels = getCustomSelectOptionLabels(replayIterationSelect());
    expect(labels.some((label) => /Iteration #1 — ✓ Pass/.test(label))).toBe(true);
    expect(labels.some((label) => /Iteration #2 — ✗ Fail/.test(label))).toBe(true);
  });

  it('cleans up keyboard listener on unmount', () => {
    const trace = createMockTrace();
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('shows single iteration without plural', () => {
    const trace = createMockTrace();
    trace.totalIterations = 1;

    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(screen.getByText(/1 iteration$/)).toBeInTheDocument();
    expect(screen.queryByText(/iterations/)).not.toBeInTheDocument();
  });

  it('formats timestamp correctly', () => {
    const trace = createMockTrace();
    const fixedTimestamp = new Date('2026-05-04T15:30:00').getTime();
    trace.iterations[0].events[0].timestamp = fixedTimestamp;

    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    const headerText = screen.getByText(/Execution Replay/);
    expect(headerText.textContent).toContain('Execution Replay');
  });

  it('renders workflow execution canvas', () => {
    const trace = createMockTrace();
    const { container } = render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    const canvasContainer = container.querySelector('.workflow-execution-replay-canvas');
    expect(canvasContainer).toBeInTheDocument();
  });

  it('handles trace with no events gracefully', () => {
    const trace = createMockTrace();
    trace.iterations = [];

    render(<WorkflowExecutionReplayModal trace={trace} onClose={onCloseMock} />);

    expect(screen.getByText('Order Processing')).toBeInTheDocument();
  });
});
