/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import type { ExecutionEvent } from '../../../shared/types';
import { mockEvents, mockIterations } from './__test-utils__/resultsExplorerDetailPanelTestHelpers';

describe('ResultsExplorerDetailPanel — part2', () => {
  const mockOnIterationChange = vi.fn();
  const mockOnClose = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
