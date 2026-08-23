/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import type { ExecutionEvent, WorkflowIterationTrace } from '@shared/types';
import { mockEvents, mockIterations } from './__test-utils__/resultsExplorerDetailPanelTestHelpers';

describe('ResultsExplorerDetailPanel — part3', () => {
  const mockOnIterationChange = vi.fn();
  const mockOnClose = vi.fn();

  afterEach(() => {
    cleanup();
    resetAllMocks();
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

});
