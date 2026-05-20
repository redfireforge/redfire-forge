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

  describe('Variables Tab — Mapping Traces (9D)', () => {
    const mappingTraces = [
      {
        mappingId: 'm1',
        sourcePath: 'name',
        sourceValue: 'Alice',
        targetPath: 'userName',
        targetValue: 'Alice',
        timestamp: Date.now(),
        durationMs: 1,
      },
      {
        mappingId: 'm2',
        sourcePath: 'email',
        sourceValue: 'a@b.com',
        targetPath: 'userEmail',
        targetValue: undefined as unknown,
        error: 'Missing field',
        timestamp: Date.now(),
        durationMs: 0.5,
      },
    ];

    const eventsWithTraces: ExecutionEvent[] = [{
      nodeId: 'http-1',
      nodeType: 'http',
      nodeLabel: 'Get Users',
      timestamp: 1000,
      state: 'pass',
      durationMs: 120,
      details: {
        statusCode: 200,
        request: { method: 'GET', url: '/api' },
        mappingTraces,
      },
    }];

    it('shows Mapping Traces section when traces exist', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithTraces}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithTraces, finalVariables: {} }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      expect(screen.getByText('Mapping Traces')).toBeInTheDocument();
    });

    it('enables Variables tab when only mappingTraces exist', () => {
      const traceOnlyEvents: ExecutionEvent[] = [{
        nodeId: 'http-1',
        nodeType: 'http',
        nodeLabel: 'API',
        timestamp: 1000,
        state: 'pass',
        durationMs: 50,
        details: { statusCode: 200, mappingTraces },
      }];
      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="API"
          events={traceOnlyEvents}
          iterations={[{ index: 0, passed: true, durationMs: 50, traversedEdges: [], events: traceOnlyEvents, finalVariables: {} }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />,
      );
      const variablesBtn = screen.getByRole('button', { name: 'Variables' });
      expect((variablesBtn as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(variablesBtn);
      expect(container.querySelector('[data-testid="mapping-trace-m1"]')).toBeTruthy();
    });

    it('shows "Open in Mapper" button when onOpenMapper provided', () => {
      const onOpenMapper = vi.fn();
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithTraces}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithTraces, finalVariables: {} }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured
          onOpenMapper={onOpenMapper}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      const openBtn = screen.getByTestId('open-in-mapper-btn');
      expect(openBtn).toBeTruthy();
      fireEvent.click(openBtn);
      expect(onOpenMapper).toHaveBeenCalledTimes(1);
      expect(onOpenMapper.mock.calls[0][0]).toEqual(mappingTraces);
      expect(onOpenMapper.mock.calls[0][1]).toBe('Get Users');
    });

    it('does not show "Open in Mapper" when onOpenMapper not provided', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithTraces}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithTraces, finalVariables: {} }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      expect(screen.queryByTestId('open-in-mapper-btn')).toBeNull();
    });

    it('shows error styling for failed mapping traces', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithTraces}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithTraces, finalVariables: {} }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      const failRow = screen.getByTestId('mapping-trace-m2');
      expect(failRow.className).toContain('fail');
    });
  });

  describe('Assertions Tab', () => {
    const eventsWithAssertions: ExecutionEvent[] = [{
      nodeId: 'http-1',
      nodeType: 'http',
      nodeLabel: 'Get Users',
      timestamp: 1000,
      state: 'fail',
      durationMs: 120,
      details: {
        statusCode: 500,
        assertions: [
          { type: 'status', description: 'Status is 200', passed: false, expected: '200', actual: '500' },
          { type: 'body', description: 'Contains users', passed: true },
        ],
      },
    }];

    it('shows assertion results with pass/fail status', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithAssertions}
          iterations={[{ index: 0, passed: false, durationMs: 120, traversedEdges: [], events: eventsWithAssertions }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Assertions' }));
      expect(screen.getByText('1 of 2 passed')).toBeInTheDocument();
      expect(screen.getByText('Expected: 200')).toBeInTheDocument();
      expect(screen.getByText('Actual: 500')).toBeInTheDocument();
    });
  });

  describe('Webhook Trigger Node', () => {
    const webhookEvents: ExecutionEvent[] = [{
      nodeId: 'webhook-1',
      nodeType: 'webhookTrigger',
      nodeLabel: 'Order Webhook',
      timestamp: 1000,
      state: 'pass',
      durationMs: 50,
      details: {
        webhookInput: {
          method: 'POST',
          path: '/webhook/orders',
          payload: JSON.stringify({ orderId: 123, status: 'pending' }), // Must be string for rendering
        },
      },
    }];

    it('shows webhook input for webhook trigger nodes', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="webhook-1"
          nodeType="webhookTrigger"
          nodeLabel="Order Webhook"
          events={webhookEvents}
          iterations={[{ index: 0, passed: true, durationMs: 50, traversedEdges: [], events: webhookEvents }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Webhook Input')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('/webhook/orders')).toBeInTheDocument();
    });
  });

  describe('Non-HTTP nodes', () => {
    const scriptEvents: ExecutionEvent[] = [{
      nodeId: 'script-1',
      nodeType: 'script',
      nodeLabel: 'Transform Data',
      timestamp: 1000,
      state: 'pass',
      durationMs: 10,
      details: {},
    }];

    it('hides HTTP-specific tabs for non-HTTP nodes', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="script-1"
          nodeType="script"
          nodeLabel="Transform Data"
          events={scriptEvents}
          iterations={[{ index: 0, passed: true, durationMs: 10, traversedEdges: [], events: scriptEvents }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('button', { name: 'Request' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Response' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Assertions' })).not.toBeInTheDocument();
    });
  });

  describe('iteration click navigation', () => {
    it('calls onIterationChange when iteration row is clicked', () => {
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

      const iterationRow = screen.getByText('#1').closest('.iteration-row');
      fireEvent.click(iterationRow!);
      expect(mockOnIterationChange).toHaveBeenCalledWith(0);
    });
  });

});
