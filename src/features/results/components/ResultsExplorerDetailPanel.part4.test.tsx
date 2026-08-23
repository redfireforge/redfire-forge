/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import type { ExecutionEvent, WorkflowIterationTrace } from '@shared/types';
import { mockEvents, mockIterations } from './__test-utils__/resultsExplorerDetailPanelTestHelpers';

describe('ResultsExplorerDetailPanel — part4', () => {
  const mockOnIterationChange = vi.fn();
  const mockOnClose = vi.fn();

  afterEach(() => {
    cleanup();
    resetAllMocks();
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
