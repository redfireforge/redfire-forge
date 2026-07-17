/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import type { ExecutionEvent, WorkflowIterationTrace } from '../../../shared/types';
import { mockEvents, mockIterations } from './__test-utils__/resultsExplorerDetailPanelTestHelpers';

describe('ResultsExplorerDetailPanel — part5', () => {
  const mockOnIterationChange = vi.fn();
  const mockOnClose = vi.fn();

  afterEach(() => {
    cleanup();
    resetAllMocks();
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
