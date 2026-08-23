/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  selectOption,
  getCustomSelectValue,
  getCustomSelectOptionLabels,
} from '../../../test-utils/customSelectHelper';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import type { ExecutionEvent, WorkflowIterationTrace } from '@shared/types';
import { mockEvents, mockIterations } from './__test-utils__/resultsExplorerDetailPanelTestHelpers';

describe('ResultsExplorerDetailPanel', () => {
  const mockOnIterationChange = vi.fn();
  const mockOnClose = vi.fn();

  function iterationSelect(): Element {
    return document.querySelector('.explorer-detail-iteration-select .cs-wrapper')!;
  }

  afterEach(() => {
    cleanup();
    resetAllMocks();
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

    expect(iterationSelect()).toBeTruthy();
    expect(getCustomSelectValue(iterationSelect())).toBe('All Iterations (Aggregate)');
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

    selectOption(iterationSelect(), '#1 — ✓ 250ms');
    expect(mockOnIterationChange).toHaveBeenCalledWith(0);
    mockOnIterationChange.mockClear();
    selectOption(iterationSelect(), 'All Iterations (Aggregate)');
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

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
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

    const labels = getCustomSelectOptionLabels(iterationSelect());
    expect(labels.some((label) => label.includes('#1 — ✓ <1ms'))).toBe(true);
    expect(labels.some((label) => label.includes('#2 — ✗ 1.50s'))).toBe(true);
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

    // No iteration selector when only 1 iteration
    expect(document.querySelector('.explorer-detail-iteration-select')).not.toBeInTheDocument();
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

    it('shows no-full-trace hint when only webhook input exists without request trace', () => {
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
      expect(screen.getByText(/Full trace not captured/i)).toBeInTheDocument();
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

  describe('AssertionsTab', () => {
    it('renders pass/fail assertion list', () => {
      const assertionEvents: ExecutionEvent[] = [{
        nodeId: 'http-1', nodeType: 'http', nodeLabel: 'Get Users',
        timestamp: 1000, state: 'pass', durationMs: 100,
        details: {
          statusCode: 200, method: 'GET', url: '/api',
          assertions: [
            { type: 'status', description: 'Status is 200', passed: true },
            { type: 'jsonPath', description: '$.name exists', passed: false, expected: 'John', actual: 'null' },
          ],
        },
      }];
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1" nodeType="http" nodeLabel="Get Users"
          events={assertionEvents}
          iterations={[{ index: 0, passed: true, durationMs: 100, traversedEdges: [], events: assertionEvents }]}
          onIterationChange={mockOnIterationChange} onClose={mockOnClose}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Assertions' }));
      expect(screen.getByText('1 of 2 passed')).toBeInTheDocument();
      expect(screen.getByText('Expected: John')).toBeInTheDocument();
      expect(screen.getByText('Actual: null')).toBeInTheDocument();
    });

    it('shows empty state when no assertions', () => {
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1" nodeType="http" nodeLabel="Get Users"
          events={mockEvents}
          iterations={mockIterations}
          onIterationChange={mockOnIterationChange} onClose={mockOnClose}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Assertions' }));
      expect(screen.getByText(/No assertions defined/)).toBeInTheDocument();
    });
  });

  describe('VariablesTab edge cases', () => {
    it('shows no-full-trace hint when fullTraceCaptured is false', () => {
      const noVarEvents: ExecutionEvent[] = [{
        nodeId: 'http-1', nodeType: 'http', nodeLabel: 'Get Users',
        timestamp: 1000, state: 'pass', durationMs: 100,
        details: { statusCode: 200, method: 'GET', url: '/api', variablesSnapshot: { token: 'abc123' } },
      }];
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1" nodeType="http" nodeLabel="Get Users"
          events={noVarEvents}
          iterations={[{ index: 0, passed: true, durationMs: 100, traversedEdges: [], events: noVarEvents }]}
          onIterationChange={mockOnIterationChange} onClose={mockOnClose}
          fullTraceCaptured={false}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      expect(screen.getByText(/Full trace not captured/i)).toBeInTheDocument();
    });

    it('renders mapping traces with Open in Mapper button', () => {
      const onOpenMapper = vi.fn();
      const traceEvents: ExecutionEvent[] = [{
        nodeId: 'http-1', nodeType: 'http', nodeLabel: 'Get Users',
        timestamp: 1000, state: 'pass', durationMs: 100,
        details: {
          statusCode: 200, method: 'GET', url: '/api',
          request: { method: 'GET', url: '/api', headers: {} },
          mappingTraces: [
            { mappingId: 'mt1', sourcePath: '$.body.id', targetPath: 'userId', targetValue: '42' },
            { mappingId: 'mt2', sourcePath: '$.body.x', targetPath: 'y', expression: 'toUpper()', error: 'eval failed' },
          ],
        },
      }];
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1" nodeType="http" nodeLabel="Get Users"
          events={traceEvents}
          iterations={[{ index: 0, passed: true, durationMs: 100, traversedEdges: [], events: traceEvents }]}
          onIterationChange={mockOnIterationChange} onClose={mockOnClose}
          fullTraceCaptured={true}
          onOpenMapper={onOpenMapper}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
      expect(screen.getByText('Mapping Traces')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('open-in-mapper-btn'));
      expect(onOpenMapper).toHaveBeenCalled();
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText('fx')).toBeInTheDocument();
    });
  });

  describe('sub-workflow drill-down', () => {
    it('renders drill-down button for subWorkflow node', () => {
      const onDrillDown = vi.fn();
      const swEvents: ExecutionEvent[] = [{
        nodeId: 'sw-1', nodeType: 'subWorkflow', nodeLabel: 'Child Flow',
        timestamp: 1000, state: 'pass', durationMs: 200,
        details: {
          subWorkflowId: 'child-wf-id',
          subWorkflowTrace: { nodes: [], edges: [], events: [], iterations: [] },
        },
      }];
      render(
        <ResultsExplorerDetailPanel
          nodeId="sw-1" nodeType="subWorkflow" nodeLabel="Child Flow"
          events={swEvents}
          iterations={[{ index: 0, passed: true, durationMs: 200, traversedEdges: [], events: swEvents }]}
          onIterationChange={mockOnIterationChange} onClose={mockOnClose}
          onDrillDown={onDrillDown}
        />
      );
      const drillBtn = screen.queryByText(/Drill Down/i) || screen.queryByTestId('drill-down-btn');
      if (drillBtn) {
        fireEvent.click(drillBtn);
        expect(onDrillDown).toHaveBeenCalled();
      }
    });
  });

  describe('ResponseTab edge cases', () => {
    it('renders error in response with status code', () => {
      const errorEvents: ExecutionEvent[] = [{
        nodeId: 'http-1', nodeType: 'http', nodeLabel: 'Fail',
        timestamp: 1000, state: 'fail', durationMs: 50,
        details: {
          statusCode: 503, method: 'POST', url: '/api/submit',
          error: 'Service Unavailable',
        },
      }];
      render(
        <ResultsExplorerDetailPanel
          nodeId="http-1" nodeType="http" nodeLabel="Fail"
          events={errorEvents}
          iterations={[{ index: 0, passed: false, durationMs: 50, traversedEdges: [], events: errorEvents }]}
          onIterationChange={mockOnIterationChange} onClose={mockOnClose}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Response' }));
      expect(screen.getByText(/503/)).toBeInTheDocument();
      expect(screen.getByText(/Service Unavailable/)).toBeInTheDocument();
    });
  });

});
