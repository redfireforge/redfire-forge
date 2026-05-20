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
