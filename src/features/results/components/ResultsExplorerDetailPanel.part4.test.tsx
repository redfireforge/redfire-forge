/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import type { ExecutionEvent, WorkflowIterationTrace } from '../../../shared/types';

const mockEvents: ExecutionEvent[] = [
  {
    nodeId: 'http-1',
    nodeType: 'http',
    nodeLabel: 'Get Users',
    timestamp: 1000,
    state: 'pass',
    durationMs: 120,
    details: {
      statusCode: 200,
      method: 'GET',
      url: '/api/users',
      responseTimeMs: 120,
    },
  },
  {
    nodeId: 'http-1',
    nodeType: 'http',
    nodeLabel: 'Get Users',
    timestamp: 2000,
    state: 'fail',
    durationMs: 80,
    details: {
      statusCode: 500,
      method: 'GET',
      url: '/api/users',
      error: 'Internal Server Error',
      responseTimeMs: 80,
    },
  },
];

const mockIterations: WorkflowIterationTrace[] = [
  {
    index: 0,
    passed: true,
    durationMs: 250,
    traversedEdges: [],
    events: [mockEvents[0]],
  },
  {
    index: 1,
    passed: false,
    durationMs: 300,
    traversedEdges: [],
    events: [mockEvents[1]],
  },
];

describe('ResultsExplorerDetailPanel', () => {
  const mockOnIterationChange = vi.fn();
  const mockOnClose = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders node type and label', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('HTTP')).toBeInTheDocument();
    expect(screen.getByText('Get Users')).toBeInTheDocument();
  });

  it('shows quick stats', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('50% pass')).toBeInTheDocument();
    expect(screen.getByText('2 exec')).toBeInTheDocument();
    expect(screen.getByText('100ms avg')).toBeInTheDocument();
  });

  it('hides quick-stat average when no execution reports durationMs', () => {
    const noDur: ExecutionEvent[] = [
      { ...mockEvents[0], durationMs: undefined },
      { ...mockEvents[1], durationMs: undefined },
    ];
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={noDur}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/avg$/)).not.toBeInTheDocument();
  });

  it('renders tabs for HTTP nodes', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Response' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Variables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assertions' })).toBeInTheDocument();
  });

  it('enables Request/Response tabs with basic data even without full trace', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
        fullTraceCaptured={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Request' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Response' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Variables' })).toBeDisabled();
  });

  it('shows overview tab content by default', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('Executions')).toBeInTheDocument();
    expect(screen.getByText('Avg Duration')).toBeInTheDocument();
  });

  it('displays iteration selector when multiple iterations exist', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('All Iterations (Aggregate)')).toBeInTheDocument();
  });

  it('calls onIterationChange when iteration is selected', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '0' } });
    expect(mockOnIterationChange).toHaveBeenCalledWith(0);
    mockOnIterationChange.mockClear();
    fireEvent.change(select, { target: { value: 'all' } });
    expect(mockOnIterationChange).toHaveBeenCalledWith(undefined);
  });

  it('uses first event when a specific iteration index is selected', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={[mockEvents[0], { ...mockEvents[1], details: { ...mockEvents[1].details, statusCode: 418 } }]}
        iterations={mockIterations}
        selectedIteration={0}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.queryByText('418')).not.toBeInTheDocument();
  });

  it('returns to overview tab when Overview is clicked', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows per-iteration breakdown in aggregate view', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Per-Iteration Breakdown')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('shows neutral iteration marker for skipped executions', () => {
    const skippedEvent: ExecutionEvent = {
      nodeId: 'http-1',
      nodeType: 'http',
      nodeLabel: 'Get Users',
      timestamp: 3000,
      state: 'skipped',
      durationMs: 5,
      details: { method: 'GET', url: '/api/x' },
    };
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={[mockEvents[0], skippedEvent]}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    const rows = document.querySelectorAll('.iteration-row.skipped');
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveTextContent('○');
  });

  it('formats sub-millisecond and multi-second durations in iteration picker', () => {
    const iters: WorkflowIterationTrace[] = [
      { index: 0, passed: true, durationMs: 0.4, traversedEdges: [], events: [] },
      { index: 1, passed: false, durationMs: 1500, traversedEdges: [], events: [] },
    ];
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={iters}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('#1 — ✓ <1ms')).toBeInTheDocument();
    expect(screen.getByText('#2 — ✗ 1.50s')).toBeInTheDocument();
  });

  it('shows timing bar from responseTimeMs when durationMs is absent', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={[{
          nodeId: 'http-1',
          nodeType: 'http',
          nodeLabel: 'Get Users',
          timestamp: 1,
          state: 'pass',
          details: { method: 'GET', url: '/x', statusCode: 200, responseTimeMs: 99 },
        }]}
        iterations={[{ index: 0, passed: true, durationMs: 99, traversedEdges: [], events: [] }]}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(document.querySelector('.exec-timing-row')).toBeInTheDocument();
  });

  it('switches to assertions tab', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Assertions' }));
    expect(screen.getByText('No assertions defined for this node.')).toBeInTheDocument();
  });

  it('renders empty state when no events', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={[]}
        iterations={[]}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('No execution data available')).toBeInTheDocument();
  });

  it('shows status bar with pass/fail segments', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    // 1 pass, 1 fail = 50% each
    expect(screen.getByTitle('1 passed')).toBeInTheDocument();
    expect(screen.getByTitle('1 failed')).toBeInTheDocument();
  });

  it('shows current event details with status code', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Last Execution')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument(); // Last event is failed with 500
  });

  it('shows error message when event has error', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
  });

  it('handles single iteration without selector', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={[mockEvents[0]]}
        iterations={[mockIterations[0]]}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    // No combobox when only 1 iteration
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows 100% pass rate with green color', () => {
    const allPassEvents = [mockEvents[0], { ...mockEvents[0], timestamp: 3000 }];
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={allPassEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('100% pass')).toBeInTheDocument();
  });

  it('shows 0% pass rate with red color', () => {
    const allFailEvents = [mockEvents[1], { ...mockEvents[1], timestamp: 3000 }];
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={allFailEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('0% pass')).toBeInTheDocument();
  });

  it('shows timing stats (min/avg/max) for multiple executions', () => {
    render(
      <ResultsExplorerDetailPanel
        nodeId="http-1"
        nodeType="http"
        nodeLabel="Get Users"
        events={mockEvents}
        iterations={mockIterations}
        onIterationChange={mockOnIterationChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Min')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
  });

  describe('Mini Duration Histogram', () => {
    function makeManyEvents(count: number, failEvery = 0): { events: ExecutionEvent[]; iterations: WorkflowIterationTrace[] } {
      const events: ExecutionEvent[] = Array.from({ length: count }, (_, i) => ({
        nodeId: 'http-1',
        nodeType: 'http',
        nodeLabel: 'Get Users',
        timestamp: 1000 + i * 100,
        state: (failEvery > 0 && (i + 1) % failEvery === 0 ? 'fail' : 'pass') as 'pass' | 'fail',
        durationMs: 50 + i * 10 + Math.round(Math.sin(i) * 20),
        details: { statusCode: failEvery > 0 && (i + 1) % failEvery === 0 ? 500 : 200, method: 'GET', url: '/api/users' },
      }));
      const iterations: WorkflowIterationTrace[] = events.map((e, i) => ({
        index: i,
        passed: e.state === 'pass',
        durationMs: e.durationMs!,
        traversedEdges: [],
        events: [e],
      }));
      return { events, iterations };
    }

    it('renders histogram in aggregate view with 3+ durations', () => {
      const { events, iterations } = makeManyEvents(10);
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={events}
          iterations={iterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('mini-histogram')).toBeInTheDocument();
      expect(screen.getByText('Duration Distribution')).toBeInTheDocument();
    });

    it('shows Avg and P95 legend items', () => {
      const { events, iterations } = makeManyEvents(10);
      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={events}
          iterations={iterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      const legend = container.querySelector('.mini-histogram-legend')!;
      expect(legend).toBeTruthy();
      expect(legend.querySelector('.avg-legend')).toBeTruthy();
      expect(legend.querySelector('.p95-legend')).toBeTruthy();
      expect(legend.querySelector('.pass-legend')).toBeTruthy();
    });

    it('shows Fail legend when there are failed events', () => {
      const { events, iterations } = makeManyEvents(10, 3);
      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={events}
          iterations={iterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      const legend = container.querySelector('.mini-histogram-legend')!;
      expect(legend.querySelector('.fail-legend')).toBeTruthy();
    });

    it('does not render histogram in single iteration view', () => {
      const { events, iterations } = makeManyEvents(10);
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={[events[0]]}
          iterations={iterations}
          selectedIteration={0}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('mini-histogram')).not.toBeInTheDocument();
    });

    it('does not render histogram with fewer than 3 durations', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={mockEvents}
          iterations={mockIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('mini-histogram')).not.toBeInTheDocument();
    });

    it('renders 12 bars in the histogram', () => {
      const { events, iterations } = makeManyEvents(20);
      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={events}
          iterations={iterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      const bars = container.querySelectorAll('.mini-histogram-bar-wrap');
      expect(bars.length).toBe(12);
    });

    it('shows x-axis min and max labels', () => {
      const { events, iterations } = makeManyEvents(10);
      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={events}
          iterations={iterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      const xAxis = container.querySelector('.mini-histogram-x-axis');
      expect(xAxis).toBeTruthy();
      expect(xAxis!.children.length).toBe(2);
    });

    it('renders avg and p95 marker lines', () => {
      const { events, iterations } = makeManyEvents(20);
      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={events}
          iterations={iterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(container.querySelector('.mini-histogram-marker.avg')).toBeTruthy();
      expect(container.querySelector('.mini-histogram-marker.p95')).toBeTruthy();
    });

    it('renders fail segments in bars when failures exist', () => {
      const { events, iterations } = makeManyEvents(20, 4);
      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={events}
          iterations={iterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      const failBars = container.querySelectorAll('.mini-histogram-bar-fail');
      expect(failBars.length).toBeGreaterThan(0);
    });
  });

});
