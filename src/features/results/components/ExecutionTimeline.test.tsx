/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExecutionTimeline from './ExecutionTimeline';
import type { WorkflowExecutionTrace, ExecutionEvent } from '../../../shared/types';

let lastResizeObservers: ResizeObserverCallback[] = [];
class CaptureResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(cb: ResizeObserverCallback) {
    lastResizeObservers.push(cb);
  }
}
globalThis.ResizeObserver = CaptureResizeObserver as unknown as typeof ResizeObserver;

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
  beforeEach(() => {
    lastResizeObservers = [];
  });

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
    it('label rows tolerate missing optional click handlers', () => {
      render(
        <ExecutionTimeline trace={makeTrace()} selectedIteration={0} />,
      );
      expect(() =>
        fireEvent.click(screen.getByTestId('timeline-label-n1')),
      ).not.toThrow();
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

  describe('sub-workflow enhancements (8d)', () => {
    const subWorkflowEvent = makeEvent({
      nodeId: 'sub1',
      nodeType: 'subWorkflow',
      nodeLabel: 'Process Users',
      state: 'pass',
      durationMs: 300,
      details: {
        subWorkflowTrace: {
          iterations: [{ index: 0, passed: true, durationMs: 300, events: [], finalVariables: {}, traversedEdges: [] }],
          traversedEdges: [],
          workflowSnapshot: { nodes: [], edges: [] },
          workflowId: 'child-wf',
          workflowName: 'Child Workflow',
          totalIterations: 1,
          totalDurationMs: 300,
        },
      },
    });

    it('uses indigo fill for sub-workflow pass bars', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([subWorkflowEvent])}
          selectedIteration={0}
        />,
      );
      const bar = screen.getByTestId('timeline-bar-sub1');
      expect(bar.getAttribute('fill')).toBe('#818cf8');
    });

    it('uses red fill for failed sub-workflow bars (not indigo)', () => {
      const failedSub = { ...subWorkflowEvent, state: 'fail' as const };
      render(
        <ExecutionTimeline
          trace={makeTrace([failedSub])}
          selectedIteration={0}
        />,
      );
      const bar = screen.getByTestId('timeline-bar-sub1');
      expect(bar.getAttribute('fill')).toBe('#ef4444');
    });

    it('renders SUB badge for sub-workflow nodes', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([subWorkflowEvent])}
          selectedIteration={0}
        />,
      );
      const badge = screen.getByText('SUB');
      expect(badge).toBeInTheDocument();
      expect(badge.classList.contains('timeline-sub-badge')).toBe(true);
    });

    it('does not render SUB badge for HTTP nodes', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent()])}
          selectedIteration={0}
        />,
      );
      expect(screen.queryByText('SUB')).not.toBeInTheDocument();
    });

    it('renders indigo dot for sub-workflow label row', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([subWorkflowEvent])}
          selectedIteration={0}
        />,
      );
      const label = screen.getByTestId('timeline-label-sub1');
      const dot = label.querySelector('.timeline-node-dot');
      expect(dot?.classList.contains('timeline-dot-subworkflow')).toBe(true);
    });

    it('renders drill-down icon on sub-workflow bars', () => {
      const onDrillDown = vi.fn();
      render(
        <ExecutionTimeline
          trace={makeTrace([subWorkflowEvent])}
          selectedIteration={0}
          onDrillDown={onDrillDown}
        />,
      );
      expect(screen.getByTestId('timeline-drilldown-sub1')).toBeInTheDocument();
    });

    it('does not render drill-down icon for HTTP bars', () => {
      const onDrillDown = vi.fn();
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent()])}
          selectedIteration={0}
          onDrillDown={onDrillDown}
        />,
      );
      expect(screen.queryByTestId('timeline-drilldown-n1')).not.toBeInTheDocument();
    });

    it('does not render drill-down icon without onDrillDown prop', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([subWorkflowEvent])}
          selectedIteration={0}
        />,
      );
      expect(screen.queryByTestId('timeline-drilldown-sub1')).not.toBeInTheDocument();
    });

    it('does not render drill-down icon in aggregate mode', () => {
      const onDrillDown = vi.fn();
      render(
        <ExecutionTimeline
          trace={makeTrace([subWorkflowEvent], 3)}
          selectedIteration={undefined}
          onDrillDown={onDrillDown}
        />,
      );
      expect(screen.queryByTestId('timeline-drilldown-sub1')).not.toBeInTheDocument();
    });

    it('calls onDrillDown with child trace when drill-down icon is clicked', () => {
      const onDrillDown = vi.fn();
      render(
        <ExecutionTimeline
          trace={makeTrace([subWorkflowEvent])}
          selectedIteration={0}
          onDrillDown={onDrillDown}
        />,
      );
      fireEvent.click(screen.getByTestId('timeline-drilldown-sub1'));
      expect(onDrillDown).toHaveBeenCalledTimes(1);
      expect(onDrillDown).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'child-wf', workflowName: 'Child Workflow' }),
        'sub1',
      );
    });

    it('mixed HTTP and sub-workflow nodes: only sub-workflow gets indigo + badge', () => {
      const events = [
        makeEvent({ nodeId: 'n1', nodeLabel: 'Get Users', timestamp: 1000, durationMs: 100 }),
        { ...subWorkflowEvent, timestamp: 1100 },
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events)}
          selectedIteration={0}
        />,
      );
      expect(screen.getByTestId('timeline-bar-n1').getAttribute('fill')).toBe('#22c55e');
      expect(screen.getByTestId('timeline-bar-sub1').getAttribute('fill')).toBe('#818cf8');
      expect(screen.getAllByText('SUB')).toHaveLength(1);
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

  describe('layout and zoom behaviors', () => {
    it('updates chart width when ResizeObserver fires', () => {
      render(
        <ExecutionTimeline trace={makeTrace([makeEvent()])} selectedIteration={0} />,
      );
      expect(lastResizeObservers.length).toBeGreaterThan(0);
      const cb = lastResizeObservers[lastResizeObservers.length - 1];
      cb([{ contentRect: { width: 840 } }] as ResizeObserverEntry[], {} as ResizeObserver);
      fireEvent.mouseEnter(screen.getByTestId('timeline-bar-n1'));
      expect(screen.getByTestId('timeline-tooltip')).toBeInTheDocument();
    });

    it('zooms timeline with Ctrl+wheel and shows zoom badge', () => {
      render(
        <ExecutionTimeline trace={makeTrace([makeEvent()])} selectedIteration={0} />,
      );
      const scroll = screen.getByTestId('timeline-svg').parentElement!;
      fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -100 });
      expect(screen.getByTestId('timeline-zoom-badge')).toHaveTextContent(/11\d%/);
      fireEvent.wheel(scroll, { metaKey: true, deltaY: 100 });
      expect(screen.getByTestId('timeline-zoom-badge').textContent).toMatch(/^\d+%$/);
    });

    it('clamps zoom range', () => {
      render(
        <ExecutionTimeline trace={makeTrace([makeEvent()])} selectedIteration={0} />,
      );
      const scroll = screen.getByTestId('timeline-svg').parentElement!;
      for (let i = 0; i < 80; i++) {
        fireEvent.wheel(scroll, { ctrlKey: true, deltaY: -200 });
      }
      expect(screen.getByTestId('timeline-zoom-badge')).toHaveTextContent('1000%');
    });
  });

  describe('aggregate edge cases', () => {
    it('renders skipped snapshot rows when every iteration is unsampled', () => {
      const trace: WorkflowExecutionTrace = {
        ...makeTrace([makeEvent()], 2),
        workflowSnapshot: {
          nodes: [
            { id: 'n1', type: 'http', data: { label: 'Only Node' } },
          ],
          edges: [],
        },
        iterations: [
          { index: 0, passed: true, durationMs: 10, events: [makeEvent()], finalVariables: {}, traversedEdges: [], sampled: false },
          { index: 1, passed: true, durationMs: 10, events: [makeEvent({ timestamp: 2000 })], finalVariables: {}, traversedEdges: [], sampled: false },
        ],
      };
      render(<ExecutionTimeline trace={trace} selectedIteration={undefined} />);
      expect(screen.getByTestId('timeline-label-n1')).toBeInTheDocument();
      expect(screen.queryByTestId('timeline-avg-marker')).not.toBeInTheDocument();
    });

    it('hides avg/p95 markers when aggregate totalMs is zero', () => {
      const trace = makeTrace([], 1);
      trace.iterations = [{ index: 0, passed: true, durationMs: 0, events: [], finalVariables: {}, traversedEdges: [] }];
      render(<ExecutionTimeline trace={trace} selectedIteration={undefined} />);
      expect(screen.queryByTestId('timeline-avg-marker')).not.toBeInTheDocument();
    });

    it('does not show HTTP row in tooltip when statusCode is absent', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent({ details: undefined })])}
          selectedIteration={0}
        />,
      );
      fireEvent.mouseEnter(screen.getByTestId('timeline-bar-n1'));
      expect(screen.getByTestId('timeline-tooltip').textContent).not.toMatch(/HTTP/);
    });
  });

  describe('filter overlay', () => {
    it('uses generic matching copy when filtering by search alone', () => {
      render(
        <ExecutionTimeline
          trace={makeTrace([makeEvent({ nodeLabel: 'Alpha' })], 1)}
          selectedIteration={undefined}
          searchQuery="nomatchzzz"
          stateFilter="all"
        />,
      );

      expect(screen.getByTestId('timeline-no-matches')).toHaveTextContent('No matching nodes');
    });

    it('shows no-matches overlay for state filter with zero nodes', () => {
      const trace = makeTrace(
        [makeEvent({ nodeId: 'n1', state: 'pass' })],
        1,
      );
      render(
        <ExecutionTimeline
          trace={trace}
          selectedIteration={undefined}
          stateFilter="fail"
        />,
      );
      expect(screen.getByTestId('timeline-no-matches')).toHaveTextContent(/fail/);
    });

    it('shows matching strip for search hits in aggregate mode', () => {
      const events = [
        makeEvent({ nodeId: 'n1', nodeLabel: 'Alpha Node' }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'Beta Node', timestamp: 1200 }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events, 2)}
          selectedIteration={undefined}
          searchQuery="Alpha"
        />,
      );
      expect(screen.getByTestId('timeline-match-strip-n1')).toBeInTheDocument();
    });

    it('decorates timeline labels while search filters match subset of nodes', () => {
      const events = [
        makeEvent({ nodeId: 'n1', nodeLabel: 'Alpha Node', timestamp: 1000 }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'Beta Node', timestamp: 1200 }),
      ];
      render(
        <ExecutionTimeline
          trace={makeTrace(events, 2)}
          selectedIteration={undefined}
          searchQuery="Alpha"
        />,
      );
      expect(screen.getByTestId('timeline-label-n1')).toHaveClass('timeline-label-matched');
      expect(screen.getByTestId('timeline-label-n2')).not.toHaveClass('timeline-label-matched');
    });
  });

  describe('drill-down guards', () => {
    it('renders drill-down control but ignores click when child trace is missing', () => {
      const onDrillDown = vi.fn();
      const sub = makeEvent({
        nodeId: 'sub1',
        nodeType: 'subWorkflow',
        details: {},
      });
      render(
        <ExecutionTimeline trace={makeTrace([sub])} selectedIteration={0} onDrillDown={onDrillDown} />,
      );
      expect(screen.getByTestId('timeline-drilldown-sub1')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('timeline-drilldown-sub1'));
      expect(onDrillDown).not.toHaveBeenCalled();
    });
  });

  describe('dimmed aggregate bars', () => {
    it('uses dimmed pass color for semi-transparent aggregate overlays', () => {
      const events = [makeEvent({ nodeId: 'n1', timestamp: 1000, durationMs: 50 })];
      render(
        <ExecutionTimeline trace={makeTrace(events, 2)} selectedIteration={undefined} />,
      );
      const bars = screen.getAllByTestId('timeline-bar-n1');
      expect(bars.length).toBeGreaterThanOrEqual(2);
      const dimmed = bars.find(b => b.getAttribute('opacity') === '0.5');
      expect(dimmed?.getAttribute('fill')).toBe('rgba(34, 197, 94, 0.4)');
    });

    it('adds skipped snapshot-only rows while an iteration lacks events', () => {
      const trace: WorkflowExecutionTrace = {
        ...makeTrace([
          makeEvent({ nodeId: 'n1', nodeLabel: 'Hit', timestamp: 1000 }),
        ], 1),
        workflowSnapshot: {
          nodes: [
            { id: 'n1', type: 'http', data: { label: 'Executed' } },
            { id: 'n_skip', type: 'http', data: { label: 'Never Ran' } },
          ],
          edges: [
            { source: 'n1', target: 'n_skip' },
          ],
        },
      };

      render(
        <ExecutionTimeline trace={trace} selectedIteration={0} />,
      );

      expect(screen.getByTestId('timeline-bar-n1')).toBeInTheDocument();
      const skipLabel = screen.getByTestId('timeline-label-n_skip');
      expect(skipLabel.style.opacity).toBe('0.3');
      expect(screen.queryByTestId('timeline-bar-n_skip')).not.toBeInTheDocument();
    });

    it('appends orphan event nodes after topological ordering', () => {
      const orphanEvent = makeEvent({
        nodeId: 'orphan-extra',
        nodeLabel: 'Late discovery',
        timestamp: 5000,
      });
      const trace: WorkflowExecutionTrace = {
        ...makeTrace([orphanEvent], 1),
        workflowSnapshot: {
          nodes: [{ id: 'n1', type: 'http', data: { label: 'Declared' } }],
          edges: [],
        },
      };

      render(<ExecutionTimeline trace={trace} selectedIteration={0} />);

      expect(screen.getByTestId('timeline-label-n1')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-label-orphan-extra')).toBeInTheDocument();
    });

    it('dedupes aggregate node ids when the same node repeats across iterations', () => {
      const ev = (ts: number) =>
        makeEvent({ nodeId: 'n1', nodeLabel: 'Only', timestamp: ts, durationMs: 80 });
      const trace: WorkflowExecutionTrace = {
        ...makeTrace([ev(1000)], 3),
        iterations: [
          { index: 0, passed: true, durationMs: 200, events: [ev(1000)], finalVariables: {}, traversedEdges: [] },
          { index: 1, passed: true, durationMs: 200, events: [ev(2000)], finalVariables: {}, traversedEdges: [] },
          { index: 2, passed: true, durationMs: 200, events: [ev(3000)], finalVariables: {}, traversedEdges: [] },
        ],
      };

      render(
        <ExecutionTimeline trace={trace} selectedIteration={undefined} />,
      );

      expect(screen.getAllByTestId('timeline-bar-n1')).toHaveLength(3);
    });
  });
});
