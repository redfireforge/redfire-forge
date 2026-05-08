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
});
