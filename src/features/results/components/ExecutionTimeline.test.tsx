/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExecutionTimeline from './ExecutionTimeline';
import type { WorkflowExecutionTrace, ExecutionEvent } from '../../../shared/types';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

function makeEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    nodeId: 'n1',
    nodeType: 'http',
    nodeLabel: 'Get Users',
    timestamp: 1000,
    state: 'pass',
    durationMs: 100,
    ...overrides,
  };
}

function makeTrace(events: ExecutionEvent[] = [makeEvent()], iterations = 1): WorkflowExecutionTrace {
  const iters = Array.from({ length: iterations }, (_, i) => ({
    index: i,
    passed: true,
    durationMs: 500,
    events: events.map(e => ({ ...e, timestamp: e.timestamp + i * 1000 })),
    finalVariables: {},
    traversedEdges: ['e1'],
  }));

  return {
    iterations: iters,
    traversedEdges: ['e1'],
    workflowSnapshot: { nodes: [], edges: [] },
    workflowId: 'wf1',
    workflowName: 'Test Workflow',
    totalIterations: iterations,
    totalDurationMs: iterations * 500,
  };
}

describe('ExecutionTimeline', () => {
  describe('rendering', () => {
    it('renders the timeline container', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
        />,
      );
      expect(screen.getByTestId('execution-timeline')).toBeInTheDocument();
    });

    it('renders SVG element', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
        />,
      );
      expect(screen.getByTestId('timeline-svg')).toBeInTheDocument();
    });

    it('shows empty state when no events', () => {
      const trace = makeTrace([]);
      render(
        <ExecutionTimeline
          trace={trace}
          selectedIteration={0}
        />,
      );
      expect(screen.getByTestId('timeline-empty')).toBeInTheDocument();
      expect(screen.getByText('No execution events to display')).toBeInTheDocument();
    });

    it('renders bars for each event', () => {
      const events = [
        makeEvent({ nodeId: 'n1', nodeLabel: 'Get Users', timestamp: 1000, durationMs: 100 }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'Create Order', timestamp: 1100, durationMs: 200 }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events)}
          selectedIteration={0}
        />,
      );
      expect(screen.getByTestId('timeline-bar-n1')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-bar-n2')).toBeInTheDocument();
    });

    it('renders node labels', () => {
      const events = [
        makeEvent({ nodeId: 'n1', nodeLabel: 'Get Users' }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'Create Order', timestamp: 1100 }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events)}
          selectedIteration={0}
        />,
      );
      expect(screen.getByTestId('timeline-label-n1')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-label-n2')).toBeInTheDocument();
      expect(screen.getByText('Get Users')).toBeInTheDocument();
      expect(screen.getByText('Create Order')).toBeInTheDocument();
    });

    it('renders time axis ticks', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent({ durationMs: 500 })])}
          selectedIteration={0}
        />,
      );
      expect(screen.getByTestId('timeline-tick-0')).toBeInTheDocument();
    });
  });

  describe('colors', () => {
    it('uses green fill for pass bars', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent({ state: 'pass' })])}
          selectedIteration={0}
        />,
      );
      const bar = screen.getByTestId('timeline-bar-n1');
      expect(bar.getAttribute('fill')).toBe('#22c55e');
    });

    it('uses red fill for fail bars', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent({ state: 'fail' })])}
          selectedIteration={0}
        />,
      );
      const bar = screen.getByTestId('timeline-bar-n1');
      expect(bar.getAttribute('fill')).toBe('#ef4444');
    });

    it('uses gray fill for skipped bars', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent({ state: 'skipped' })])}
          selectedIteration={0}
        />,
      );
      const bar = screen.getByTestId('timeline-bar-n1');
      expect(bar.getAttribute('fill')).toBe('#64748b');
    });
  });

  describe('interaction', () => {
    it('calls onNodeClick when bar is clicked', () => {
      const onNodeClick = vi.fn();
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
          onNodeClick={onNodeClick}
        />,
      );
      fireEvent.click(screen.getByTestId('timeline-bar-n1'));
      expect(onNodeClick).toHaveBeenCalledWith('n1');
    });

    it('calls onNodeClick with empty string when pane is clicked', () => {
      const onNodeClick = vi.fn();
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
          onNodeClick={onNodeClick}
        />,
      );
      fireEvent.click(screen.getByTestId('timeline-svg'));
      expect(onNodeClick).toHaveBeenCalledWith('');
    });

    it('calls onNodeClick when label row is clicked', () => {
      const onNodeClick = vi.fn();
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
          onNodeClick={onNodeClick}
        />,
      );
      fireEvent.click(screen.getByTestId('timeline-label-n1'));
      expect(onNodeClick).toHaveBeenCalledWith('n1');
    });

    it('shows tooltip on bar hover', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent({
            nodeLabel: 'Get Users',
            durationMs: 150,
            details: { statusCode: 200, responseTimeMs: 150 },
          })])}
          selectedIteration={0}
        />,
      );
      fireEvent.mouseEnter(screen.getByTestId('timeline-bar-n1'));
      const tooltip = screen.getByTestId('timeline-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip.textContent).toContain('Get Users');
      expect(tooltip.textContent).toContain('150ms');
      expect(tooltip.textContent).toContain('200');
    });

    it('hides tooltip on bar mouse leave', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
        />,
      );
      fireEvent.mouseEnter(screen.getByTestId('timeline-bar-n1'));
      expect(screen.getByTestId('timeline-tooltip')).toBeInTheDocument();
      fireEvent.mouseLeave(screen.getByTestId('timeline-bar-n1'));
      expect(screen.queryByTestId('timeline-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('selected node', () => {
    it('highlights selected bar with white stroke', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
          selectedNodeId="n1"
        />,
      );
      const bar = screen.getByTestId('timeline-bar-n1');
      expect(bar.getAttribute('stroke')).toBe('#fff');
      expect(bar.getAttribute('stroke-width')).toBe('2');
    });

    it('non-selected bars have no stroke', () => {
      const events = [
        makeEvent({ nodeId: 'n1' }),
        makeEvent({ nodeId: 'n2', timestamp: 1200 }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events)}
          selectedIteration={0}
          selectedNodeId="n1"
        />,
      );
      const bar = screen.getByTestId('timeline-bar-n2');
      expect(bar.getAttribute('stroke')).toBe('none');
    });

    it('highlights selected label row', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
          selectedNodeId="n1"
        />,
      );
      const label = screen.getByTestId('timeline-label-n1');
      expect(label.classList.contains('timeline-label-selected')).toBe(true);
    });
  });

  describe('aggregate mode', () => {
    it('renders in aggregate mode when selectedIteration is undefined', () => {
      const trace = makeTrace([makeEvent()], 3);
      render(
        <ExecutionTimeline
          trace={trace}
          selectedIteration={undefined}
        />,
      );
      expect(screen.getByTestId('execution-timeline')).toBeInTheDocument();
    });

    it('shows avg marker in aggregate mode', () => {
      const trace = makeTrace([makeEvent()], 3);
      render(
        <ExecutionTimeline
          trace={trace}
          selectedIteration={undefined}
        />,
      );
      expect(screen.getByTestId('timeline-avg-marker')).toBeInTheDocument();
    });

    it('shows P95 marker in aggregate mode', () => {
      const trace = makeTrace([makeEvent()], 3);
      render(
        <ExecutionTimeline
          trace={trace}
          selectedIteration={undefined}
        />,
      );
      expect(screen.getByTestId('timeline-p95-marker')).toBeInTheDocument();
    });

    it('does not show markers in single-iteration mode', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
        />,
      );
      expect(screen.queryByTestId('timeline-avg-marker')).not.toBeInTheDocument();
      expect(screen.queryByTestId('timeline-p95-marker')).not.toBeInTheDocument();
    });
  });

  describe('zoom', () => {
    it('does not show zoom badge at default zoom', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace()}
          selectedIteration={0}
        />,
      );
      expect(screen.queryByTestId('timeline-zoom-badge')).not.toBeInTheDocument();
    });
  });

  describe('node rows', () => {
    it('each node gets its own row (different Y positions)', () => {
      const events = [
        makeEvent({ nodeId: 'n1', timestamp: 1000, durationMs: 200 }),
        makeEvent({ nodeId: 'n2', timestamp: 1050, durationMs: 100, nodeLabel: 'N2' }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events)}
          selectedIteration={0}
        />,
      );
      const bar1 = screen.getByTestId('timeline-bar-n1');
      const bar2 = screen.getByTestId('timeline-bar-n2');
      const y1 = Number(bar1.getAttribute('y'));
      const y2 = Number(bar2.getAttribute('y'));
      expect(y1).not.toBe(y2);
    });

    it('even sequential events from different nodes get different rows', () => {
      const events = [
        makeEvent({ nodeId: 'n1', timestamp: 1000, durationMs: 100 }),
        makeEvent({ nodeId: 'n2', timestamp: 1100, durationMs: 100, nodeLabel: 'N2' }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events)}
          selectedIteration={0}
        />,
      );
      const bar1 = screen.getByTestId('timeline-bar-n1');
      const bar2 = screen.getByTestId('timeline-bar-n2');
      const y1 = Number(bar1.getAttribute('y'));
      const y2 = Number(bar2.getAttribute('y'));
      expect(y1).not.toBe(y2);
    });

    it('rows are spaced consistently by ROW_HEIGHT', () => {
      const events = [
        makeEvent({ nodeId: 'n1', timestamp: 1000, durationMs: 100 }),
        makeEvent({ nodeId: 'n2', timestamp: 1100, durationMs: 100, nodeLabel: 'N2' }),
        makeEvent({ nodeId: 'n3', timestamp: 1200, durationMs: 100, nodeLabel: 'N3' }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events)}
          selectedIteration={0}
        />,
      );
      const y1 = Number(screen.getByTestId('timeline-bar-n1').getAttribute('y'));
      const y2 = Number(screen.getByTestId('timeline-bar-n2').getAttribute('y'));
      const y3 = Number(screen.getByTestId('timeline-bar-n3').getAttribute('y'));
      const spacing = y2 - y1;
      expect(spacing).toBeGreaterThan(0);
      expect(y3 - y2).toBe(spacing);
    });
  });
});
