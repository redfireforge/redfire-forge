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

  describe('Request Tab', () => {
    const eventsWithFullTrace: ExecutionEvent[] = [{
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
        request: {
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' },
          bodyTemplate: '{"name": "{{name}}"}',
          bodyResolved: '{"name": "John"}',
        },
        response: {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'X-Request-Id': 'abc123' },
          body: '{"id": 1, "name": "John"}',
          bodyTruncated: false,
        },
      },
    }];

    it('shows request details when full trace captured', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithFullTrace}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithFullTrace }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Request' }));
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('https://api.example.com/users')).toBeInTheDocument();
      expect(screen.getByText('Headers')).toBeInTheDocument();
    });

    it('shows basic request data and trace hint when full trace is off', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithFullTrace}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithFullTrace }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured={false}
        />
      );

      expect(screen.getByRole('button', { name: 'Request' })).not.toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Request' }));
      expect(screen.getByText(/Capture Full Trace/)).toBeInTheDocument();
    });

    it('toggles between template and resolved body', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithFullTrace}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithFullTrace }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Request' }));
      
      // Should show resolved by default
      expect(screen.getByText(/John/)).toBeInTheDocument();
      
      // Toggle to template
      const toggleBtn = screen.getByRole('button', { name: 'Show Template' });
      fireEvent.click(toggleBtn);
      expect(screen.getByText(/\{\{name\}\}/)).toBeInTheDocument();
    });
  });

  describe('Response Tab', () => {
    const eventsWithResponse: ExecutionEvent[] = [{
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
        request: { method: 'GET', url: '/api/users' },
        response: {
          statusCode: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: '{"users": []}',
          bodyTruncated: true,
        },
      },
    }];

    it('shows response details with truncated badge', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithResponse}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithResponse }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Response' }));
      expect(screen.getByText('Truncated')).toBeInTheDocument();
    });

    it('shows empty response when full trace has request but no response payload', () => {
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
            durationMs: 10,
            details: {
              request: { method: 'GET', url: '/x' },
            },
          }]}
          iterations={[{ index: 0, passed: true, durationMs: 10, traversedEdges: [], events: [] }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Response' }));
      expect(screen.getByText('No response data available')).toBeInTheDocument();
    });
  });

  describe('Variables Tab', () => {
    const eventsWithVariables: ExecutionEvent[] = [{
      nodeId: 'http-1',
      nodeType: 'http',
      nodeLabel: 'Get Users',
      timestamp: 1000,
      state: 'pass',
      durationMs: 120,
      details: {
        statusCode: 200,
        request: { method: 'GET', url: '/api' },
        extractedVariables: { token: 'abc123', userId: '42' },
        variablesSnapshot: { token: 'abc123', userId: '42', baseUrl: 'https://api.example.com' },
      },
    }];

    it('shows empty variable message when only webhook input exists', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="webhook-1"
          nodeType="webhook"
          nodeLabel="Hook"
          events={[{
            nodeId: 'webhook-1',
            nodeType: 'webhook',
            nodeLabel: 'Hook',
            timestamp: 1,
            state: 'pass',
            details: {
              webhookInput: { payload: '{}', method: 'POST', path: '/p' },
            },
          }]}
          iterations={[{ index: 0, passed: true, durationMs: 1, traversedEdges: [], events: [] }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      expect(screen.getByText('No variable data available')).toBeInTheDocument();
    });

    it('truncates long variable values', () => {
      const longVal = `${'x'.repeat(120)}end`;
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={[{
            ...eventsWithVariables[0],
            details: {
              ...eventsWithVariables[0].details,
              extractedVariables: { token: longVal },
              variablesSnapshot: { token: longVal, baseUrl: 'https://api.example.com' },
            },
          }]}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithVariables }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      expect(screen.getAllByText(`${'x'.repeat(100)}...`)).toHaveLength(2);
    });

    it('shows extracted and snapshot variables', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={eventsWithVariables}
          iterations={[{ index: 0, passed: true, durationMs: 120, traversedEdges: [], events: eventsWithVariables }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          fullTraceCaptured={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      expect(screen.getByText('Extracted by This Node')).toBeInTheDocument();
      expect(screen.getByText('All Variables (after this node)')).toBeInTheDocument();
      // token appears multiple times (in extracted and snapshot sections)
      expect(screen.getAllByText('token').length).toBeGreaterThan(0);
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

  describe('CorrelationWait timing split', () => {
    it('shows timing breakdown for nodes with waitDurationMs', () => {
      const cwEvents: ExecutionEvent[] = [
        {
          nodeId: 'cw-1',
          nodeType: 'correlationWait',
          nodeLabel: 'Wait for Approval',
          timestamp: Date.now(),
          state: 'pass',
          durationMs: 5200,
          details: { waitDurationMs: 5000 },
        },
        {
          nodeId: 'cw-1',
          nodeType: 'correlationWait',
          nodeLabel: 'Wait for Approval',
          timestamp: Date.now() + 6000,
          state: 'pass',
          durationMs: 4800,
          details: { waitDurationMs: 4600 },
        },
      ];
      const cwIterations = cwEvents.map((e, i) => ({
        index: i,
        passed: true,
        durationMs: e.durationMs!,
        events: [e],
        finalVariables: {} as Record<string, string>,
        traversedEdges: [],
      }));

      render(
        <ResultsExplorerDetailPanel
          nodeId="cw-1"
          nodeType="correlationWait"
          nodeLabel="Wait for Approval"
          events={cwEvents}
          iterations={cwIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Timing Breakdown')).toBeInTheDocument();
      expect(screen.getByText(/Wait for Event/)).toBeInTheDocument();
      expect(screen.getByText(/Processing/)).toBeInTheDocument();
    });

    it('does not show timing breakdown when waitDurationMs is absent', () => {
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

      expect(screen.queryByText('Timing Breakdown')).not.toBeInTheDocument();
    });
  });

  describe('P95 timing stat', () => {
    it('shows P95 in aggregate timing stats', () => {
      const manyEvents: ExecutionEvent[] = Array.from({ length: 20 }, (_, i) => ({
        nodeId: 'http-1',
        nodeType: 'http',
        nodeLabel: 'Get Users',
        timestamp: 1000 + i * 100,
        state: 'pass' as const,
        durationMs: 50 + i * 10,
        details: { statusCode: 200, method: 'GET', url: '/api/users', responseTimeMs: 50 + i * 10 },
      }));
      const manyIterations: WorkflowIterationTrace[] = manyEvents.map((e, i) => ({
        index: i,
        passed: true,
        durationMs: e.durationMs!,
        traversedEdges: [],
        events: [e],
      }));

      const { container } = render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={manyEvents}
          iterations={manyIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      const timingStats = container.querySelector('.explorer-timing-stats')!;
      expect(timingStats).toBeTruthy();
      const labels = Array.from(timingStats.querySelectorAll('.timing-label')).map(el => el.textContent);
      expect(labels).toContain('P95');
    });

    it('does not show P95 in single iteration view', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={[mockEvents[0]]}
          iterations={mockIterations}
          selectedIteration={0}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('P95')).not.toBeInTheDocument();
    });
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

  describe('branch comparison (fork/join)', () => {
    const forkJoinTopology = {
      pairs: [{
        forkId: 'fork-1',
        joinId: 'join-1',
        branches: [['a1', 'a2'], ['b1']],
      }],
      assignments: new Map([
        ['a1', { forkId: 'fork-1', joinId: 'join-1', branchIndex: 0 }],
        ['a2', { forkId: 'fork-1', joinId: 'join-1', branchIndex: 0 }],
        ['b1', { forkId: 'fork-1', joinId: 'join-1', branchIndex: 1 }],
      ]),
    };

    const forkEvents: ExecutionEvent[] = [
      { nodeId: 'fork-1', nodeType: 'fork', nodeLabel: 'Fork', timestamp: 1000, state: 'pass' },
    ];

    const forkIterations: WorkflowIterationTrace[] = [
      {
        index: 0,
        passed: true,
        durationMs: 300,
        traversedEdges: [],
        events: [
          { nodeId: 'fork-1', nodeType: 'fork', nodeLabel: 'Fork', timestamp: 1000, state: 'pass' },
          { nodeId: 'a1', nodeType: 'http', nodeLabel: 'A1', timestamp: 1010, state: 'pass', durationMs: 100 },
          { nodeId: 'a2', nodeType: 'http', nodeLabel: 'A2', timestamp: 1110, state: 'pass', durationMs: 50 },
          { nodeId: 'b1', nodeType: 'http', nodeLabel: 'B1', timestamp: 1010, state: 'pass', durationMs: 200 },
        ],
        finalVariables: {},
      },
    ];

    it('shows branch comparison table for fork node', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="fork-1"
          nodeType="fork"
          nodeLabel="Parallel Fork"
          events={forkEvents}
          iterations={forkIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          forkJoinTopology={forkJoinTopology}
        />
      );

      expect(screen.getByTestId('branch-comparison')).toBeInTheDocument();
      expect(screen.getByTestId('branch-comparison-table')).toBeInTheDocument();
      expect(screen.getByText('Parallel Branches')).toBeInTheDocument();
      expect(screen.getByText('2 branches')).toBeInTheDocument();
    });

    it('shows branch comparison table for join node', () => {
      const joinEvents: ExecutionEvent[] = [
        { nodeId: 'join-1', nodeType: 'join', nodeLabel: 'Join', timestamp: 1300, state: 'pass' },
      ];

      render(
        <ResultsExplorerDetailPanel
          nodeId="join-1"
          nodeType="join"
          nodeLabel="Join"
          events={joinEvents}
          iterations={forkIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          forkJoinTopology={forkJoinTopology}
        />
      );

      expect(screen.getByTestId('branch-comparison')).toBeInTheDocument();
    });

    it('marks the critical path branch', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="fork-1"
          nodeType="fork"
          nodeLabel="Fork"
          events={forkEvents}
          iterations={forkIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          forkJoinTopology={forkJoinTopology}
        />
      );

      expect(screen.getByTestId('critical-path-badge')).toBeInTheDocument();
    });

    it('does not show branch comparison for non-fork/join nodes', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={mockEvents}
          iterations={mockIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          forkJoinTopology={forkJoinTopology}
        />
      );

      expect(screen.queryByTestId('branch-comparison')).not.toBeInTheDocument();
    });

    it('does not show branch comparison when topology is not provided', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="fork-1"
          nodeType="fork"
          nodeLabel="Fork"
          events={forkEvents}
          iterations={forkIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('branch-comparison')).not.toBeInTheDocument();
    });

    it('shows branch labels and node counts', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="fork-1"
          nodeType="fork"
          nodeLabel="Fork"
          events={forkEvents}
          iterations={forkIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          forkJoinTopology={forkJoinTopology}
        />
      );

      // Branch labels derived from node labels: "A1 → A2" and "B1"
      expect(screen.getByText('A1 → A2')).toBeInTheDocument();
      expect(screen.getByText('B1')).toBeInTheDocument();
      const rows = screen.getAllByTestId(/branch-row-/);
      expect(rows).toHaveLength(2);
    });
  });

  describe('Sub-workflow drill-down', () => {
    const childTrace = {
      iterations: [{ index: 0, passed: true, durationMs: 50, events: [], finalVariables: {}, traversedEdges: [] }],
      traversedEdges: [],
      workflowSnapshot: { nodes: [], edges: [] },
      workflowId: 'child-wf-1',
      workflowName: 'Child Workflow',
      totalIterations: 1,
      totalDurationMs: 50,
    };

    const subWorkflowEvents: ExecutionEvent[] = [{
      nodeId: 'sub1',
      nodeType: 'subWorkflow',
      nodeLabel: 'Run Child',
      timestamp: 1000,
      state: 'pass',
      durationMs: 50,
      details: {
        subWorkflowId: 'child-wf-1',
        subWorkflowPassed: true,
        subWorkflowTrace: childTrace,
      },
    }];

    it('shows drill-down button when node is subWorkflow with trace', () => {
      const onDrillDown = vi.fn();
      render(
        <ResultsExplorerDetailPanel
          nodeId="sub1"
          nodeType="subWorkflow"
          nodeLabel="Run Child"
          events={subWorkflowEvents}
          iterations={[{ index: 0, passed: true, durationMs: 50, events: subWorkflowEvents, finalVariables: {}, traversedEdges: [] }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          onDrillDown={onDrillDown}
        />
      );

      const btn = screen.getByTestId('sub-workflow-drilldown-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent('View Sub-Workflow: Child Workflow');
    });

    it('calls onDrillDown with child trace and nodeId when clicked', () => {
      const onDrillDown = vi.fn();
      render(
        <ResultsExplorerDetailPanel
          nodeId="sub1"
          nodeType="subWorkflow"
          nodeLabel="Run Child"
          events={subWorkflowEvents}
          iterations={[{ index: 0, passed: true, durationMs: 50, events: subWorkflowEvents, finalVariables: {}, traversedEdges: [] }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          onDrillDown={onDrillDown}
        />
      );

      fireEvent.click(screen.getByTestId('sub-workflow-drilldown-btn'));
      expect(onDrillDown).toHaveBeenCalledWith(childTrace, 'sub1');
    });

    it('shows "trace not captured" when subWorkflow node has no trace', () => {
      const noTraceEvents: ExecutionEvent[] = [{
        nodeId: 'sub2',
        nodeType: 'subWorkflow',
        nodeLabel: 'Run Missing',
        timestamp: 1000,
        state: 'fail',
        durationMs: 10,
        details: {
          subWorkflowId: 'missing-wf',
          subWorkflowPassed: false,
        },
      }];

      render(
        <ResultsExplorerDetailPanel
          nodeId="sub2"
          nodeType="subWorkflow"
          nodeLabel="Run Missing"
          events={noTraceEvents}
          iterations={[{ index: 0, passed: false, durationMs: 10, events: noTraceEvents, finalVariables: {}, traversedEdges: [] }]}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          onDrillDown={vi.fn()}
        />
      );

      expect(screen.getByTestId('sub-workflow-no-trace')).toBeInTheDocument();
      expect(screen.queryByTestId('sub-workflow-drilldown-btn')).not.toBeInTheDocument();
    });

    it('does not show drill-down button for non-subWorkflow nodes', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1"
          nodeType="http"
          nodeLabel="Get Users"
          events={mockEvents}
          iterations={mockIterations}
          onIterationChange={mockOnIterationChange}
          onClose={mockOnClose}
          onDrillDown={vi.fn()}
        />
      );

      expect(screen.queryByTestId('sub-workflow-drilldown-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sub-workflow-no-trace')).not.toBeInTheDocument();
    });
  });
});
