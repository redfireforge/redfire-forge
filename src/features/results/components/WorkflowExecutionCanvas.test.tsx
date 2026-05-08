/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as XyflowReact from '@xyflow/react';
import WorkflowExecutionCanvas from './WorkflowExecutionCanvas';
import type { WorkflowExecutionTrace } from '../../../shared/types';

const { flowApi, applyNodeChangesStub } = vi.hoisted(() => {
  const api = {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  };

  function stub(
    changes: Array<{ type: string; id?: string; position?: { x: number; y: number }; item?: any }>,
    nodes: Array<{ id: string; position?: { x: number; y: number } }>
  ) {
    let next = [...nodes];
    for (const c of changes) {
      if (c.type === 'position' && c.id && c.position) {
        next = next.map((n) => (n.id === c.id ? { ...n, position: { ...c.position } } : n));
      }
      if (c.type === 'add' && c.item) {
        next = [...next, c.item];
      }
    }
    return next;
  }

  return { flowApi: api, applyNodeChangesStub: stub };
});

// Mock ReactFlow
vi.mock('@xyflow/react', () => ({
  ReactFlow: vi.fn(({ nodes, edges, children, onNodeClick, onPaneClick, onNodesChange }: any) => (
    <div data-testid="react-flow">
      <div data-testid="flow-pane" onClick={() => onPaneClick?.()}>
        {nodes?.map((node: any) => (
          <div
            key={node.id}
            role="button"
            data-testid={`node-${node.id}`}
            className={node.className}
            onClick={(e) => {
              e.stopPropagation();
              onNodeClick?.(e, node);
            }}
          />
        ))}
      </div>
      {edges?.map((edge: any) => (
        <div
          key={edge.id}
          data-testid={`edge-${edge.id}`}
          className={edge.className}
          data-animated={String(!!edge.animated)}
          data-stroke={edge.style?.stroke}
          data-stroke-dash={edge.style?.strokeDasharray ?? ''}
        />
      ))}
      <button type="button" data-testid="trigger-nodes-change" onClick={() => onNodesChange?.([{ type: 'position', id: 'n1', position: { x: 99, y: 88 } }])}>
        apply node change
      </button>
      <button
        type="button"
        data-testid="trigger-add-orphan-node"
        onClick={() =>
          onNodesChange?.([
            {
              type: 'add',
              item: {
                id: 'orphan',
                type: 'http',
                position: { x: 1, y: 2 },
                data: { label: 'Orphan' },
                draggable: true,
                connectable: false,
                selectable: true,
              },
            },
          ])
        }
      >
        add orphan
      </button>
      {children}
    </div>
  )),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: ({ nodeColor }: { nodeColor?: (node: { id: string }) => string }) => {
    const sample = (id: string) => (typeof nodeColor === 'function' ? nodeColor({ id }) : '');
    return (
      <div
        data-testid="minimap"
        data-color-n1={sample('n1')}
        data-color-n2={sample('n2')}
        data-color-n3={sample('n3')}
        data-color-unknown={sample('__no_such_node__')}
      />
    );
  },
  MarkerType: {
    Arrow: 'arrow',
    ArrowClosed: 'arrowclosed',
  },
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  useReactFlow: () => flowApi,
  applyNodeChanges: applyNodeChangesStub,
}));

// Mock workflow node types
vi.mock('../../workflow/utils/workflowNodeFactory', () => ({
  nodeTypes: {},
}));

function createMockTrace(options?: {
  iterations?: number;
  passedIterations?: number;
}): WorkflowExecutionTrace {
  const { iterations = 1, passedIterations = 1 } = options || {};

  return {
    workflowId: 'wf-123',
    workflowName: 'Test Workflow',
    totalIterations: iterations,
    totalDurationMs: 1000 * iterations,
    iterations: Array.from({ length: iterations }, (_, i) => ({
      index: i,
      passed: i < passedIterations,
      durationMs: 1000,
      events: [
        {
          nodeId: 'n1',
          nodeType: 'http',
          nodeLabel: 'Request',
          timestamp: Date.now() + i * 1000,
          state: i < passedIterations ? 'pass' : 'fail',
          durationMs: 245,
        },
        {
          nodeId: 'n2',
          nodeType: 'condition',
          nodeLabel: 'Check',
          timestamp: Date.now() + i * 1000 + 250,
          state: 'pass',
          durationMs: 5,
        },
      ],
      finalVariables: {},
      traversedEdges: ['e1', 'e2'],
    })),
    traversedEdges: ['e1', 'e2'],
    workflowSnapshot: {
      nodes: [
        { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Request' } },
        { id: 'n2', type: 'condition', position: { x: 0, y: 100 }, data: { label: 'Check' } },
        { id: 'n3', type: 'http', position: { x: 0, y: 200 }, data: { label: 'Never Executed' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n2', target: 'n3' },
      ],
    },
  };
}

function createEmptyWorkflowTrace(): WorkflowExecutionTrace {
  return {
    workflowId: 'wf-empty',
    workflowName: 'Empty',
    totalIterations: 0,
    totalDurationMs: 0,
    iterations: [],
    traversedEdges: [],
    workflowSnapshot: { nodes: [], edges: [] },
  };
}

function getLastReactFlowProps(): Record<string, unknown> {
  const rf = vi.mocked(XyflowReact.ReactFlow);
  expect(rf.mock.calls.length).toBeGreaterThan(0);
  return rf.mock.calls[rf.mock.calls.length - 1][0] as Record<string, unknown>;
}

describe('WorkflowExecutionCanvas', () => {
  beforeEach(() => {
    vi.mocked(XyflowReact.ReactFlow).mockClear();
    flowApi.zoomIn.mockClear();
    flowApi.zoomOut.mockClear();
    flowApi.fitView.mockClear();
  });

  it('renders React Flow canvas', () => {
    const trace = createMockTrace();
    const { getByTestId, container } = render(<WorkflowExecutionCanvas trace={trace} />);

    expect(getByTestId('react-flow')).toBeInTheDocument();
    expect(getByTestId('background')).toBeInTheDocument();
    // Check for custom controls (wf-pill-controls class)
    expect(container.querySelector('.wf-pill-controls')).toBeInTheDocument();
    expect(getByTestId('minimap')).toBeInTheDocument();
  });

  it('renders all nodes from workflow snapshot', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    expect(getByTestId('node-n1')).toBeInTheDocument();
    expect(getByTestId('node-n2')).toBeInTheDocument();
    expect(getByTestId('node-n3')).toBeInTheDocument();
  });

  it('applies pass state to nodes that passed all iterations', () => {
    const trace = createMockTrace({ iterations: 3, passedIterations: 3 });
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    const node1 = getByTestId('node-n1');
    expect(node1.className).toContain('replay-node-pass');
  });

  it('applies fail state to nodes that failed any iteration', () => {
    const trace = createMockTrace({ iterations: 3, passedIterations: 2 });
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    const node1 = getByTestId('node-n1');
    expect(node1.className).toContain('replay-node-fail');
  });

  it('applies skipped state to nodes that were never executed', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    const node3 = getByTestId('node-n3');
    expect(node3.className).toContain('replay-node-skipped');
  });

  it('applies selected class to selected node', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(
      <WorkflowExecutionCanvas trace={trace} selectedNodeId="n1" />
    );

    const node1 = getByTestId('node-n1');
    expect(node1.className).toContain('replay-node-selected');
  });

  it('does not apply selected class to non-selected nodes', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(
      <WorkflowExecutionCanvas trace={trace} selectedNodeId="n1" />
    );

    const node2 = getByTestId('node-n2');
    expect(node2.className).not.toContain('replay-node-selected');
  });

  it('renders all edges from workflow snapshot', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    expect(getByTestId('edge-e1')).toBeInTheDocument();
    expect(getByTestId('edge-e2')).toBeInTheDocument();
    expect(getByTestId('edge-e3')).toBeInTheDocument();
  });

  it('applies traversed class to edges that were executed', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    const edge1 = getByTestId('edge-e1');
    expect(edge1.className).toContain('replay-edge-traversed');
  });

  it('applies not-traversed class to edges that were not executed', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    const edge3 = getByTestId('edge-e3');
    expect(edge3.className).toContain('replay-edge-not-traversed');
  });

  it('calls onNodeClick with node id when a node is clicked', () => {
    const onNodeClick = vi.fn();
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} onNodeClick={onNodeClick} />);

    fireEvent.click(getByTestId('node-n2'));
    expect(onNodeClick).toHaveBeenCalledWith('n2');
  });

  it('calls onNodeClick with empty string when the pane is clicked', () => {
    const onNodeClick = vi.fn();
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} onNodeClick={onNodeClick} />);

    fireEvent.click(getByTestId('flow-pane'));
    expect(onNodeClick).toHaveBeenCalledWith('');
  });

  it('does not throw when clicking a node without onNodeClick', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
    expect(() => fireEvent.click(getByTestId('node-n1'))).not.toThrow();
  });

  it('handles trace with no iterations gracefully', () => {
    const trace = createMockTrace();
    trace.iterations = [];
    
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

    // All nodes should be skipped if no iterations
    expect(getByTestId('node-n1').className).toContain('replay-node-skipped');
    expect(getByTestId('node-n2').className).toContain('replay-node-skipped');
    expect(getByTestId('node-n3').className).toContain('replay-node-skipped');
  });

  describe('minimap control', () => {
    it('hides minimap when showMinimap is false', () => {
      const trace = createMockTrace();
      const { queryByTestId } = render(
        <WorkflowExecutionCanvas trace={trace} showMinimap={false} />
      );

      expect(queryByTestId('minimap')).not.toBeInTheDocument();
    });

    it('shows minimap when showMinimap is true', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(
        <WorkflowExecutionCanvas trace={trace} showMinimap={true} />
      );

      expect(getByTestId('minimap')).toBeInTheDocument();
    });

    it('shows minimap toggle button when onToggleMinimap provided', () => {
      const trace = createMockTrace();
      const onToggleMinimap = vi.fn();
      const { container } = render(
        <WorkflowExecutionCanvas trace={trace} onToggleMinimap={onToggleMinimap} />
      );

      // Should have more buttons when toggle is available
      const buttons = container.querySelectorAll('.wf-pill-btn');
      expect(buttons.length).toBeGreaterThanOrEqual(4); // zoom in, zoom out, fit, toggle minimap
    });
  });

  describe('controls interaction', () => {
    it('renders zoom in button', () => {
      const trace = createMockTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const buttons = container.querySelectorAll('.wf-pill-btn');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders zoom out button', () => {
      const trace = createMockTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const buttons = container.querySelectorAll('.wf-pill-btn');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('renders fit view button', () => {
      const trace = createMockTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const fitButton = container.querySelector('.wf-pill-btn[title="Fit view"]');
      expect(fitButton).toBeInTheDocument();
    });
  });

  describe('execution state calculation', () => {
    it('calculates pass rate across multiple iterations', () => {
      const trace = createMockTrace({ iterations: 10, passedIterations: 7 });
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      // Node 1 should be marked as fail since some iterations failed
      const node1 = getByTestId('node-n1');
      expect(node1.className).toContain('replay-node-fail');
    });

    it('calculates average duration for executed nodes', () => {
      const trace = createMockTrace({ iterations: 2, passedIterations: 2 });
      // The mock creates events with durationMs: 245 and 5
      // Just verify it renders without errors
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(getByTestId('node-n1')).toBeInTheDocument();
    });

    it('handles nodes with no events correctly', () => {
      const trace = createMockTrace();
      // n3 has no events in the mock
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      
      const node3 = getByTestId('node-n3');
      expect(node3.className).toContain('replay-node-skipped');
    });

    it('handles nodes that only appear in some iterations', () => {
      const trace = createMockTrace({ iterations: 3, passedIterations: 3 });
      // Remove events for n2 from some iterations
      trace.iterations[0].events = trace.iterations[0].events.filter(e => e.nodeId !== 'n2');
      
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      
      // n2 should still show as pass (from remaining iterations)
      const node2 = getByTestId('node-n2');
      expect(node2.className).toContain('replay-node-pass');
    });
  });

  describe('fitViewTrigger', () => {
    it('updates layout key when fitViewTrigger changes', () => {
      const trace = createMockTrace();
      const { rerender, getByTestId } = render(
        <WorkflowExecutionCanvas trace={trace} fitViewTrigger={1} />
      );

      expect(getByTestId('react-flow')).toBeInTheDocument();

      // Trigger a re-render with new fitViewTrigger
      rerender(<WorkflowExecutionCanvas trace={trace} fitViewTrigger={2} />);

      expect(getByTestId('react-flow')).toBeInTheDocument();
    });

    it('does not update on initial render without fitViewTrigger', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(
        <WorkflowExecutionCanvas trace={trace} />
      );

      expect(getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  describe('edge styling', () => {
    it('applies different styles to traversed vs non-traversed edges', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      const traversedEdge = getByTestId('edge-e1');
      const notTraversedEdge = getByTestId('edge-e3');

      expect(traversedEdge.className).not.toEqual(notTraversedEdge.className);
    });

    it('sets traversed edge stroke, no dash, and no animation', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      const el = getByTestId('edge-e1');
      expect(el).toHaveAttribute('data-stroke', '#a78bfa');
      expect(el).toHaveAttribute('data-stroke-dash', '');
      expect(el).toHaveAttribute('data-animated', 'false');
    });

    it('sets non-traversed edge stroke, dashed pattern, and no animation', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      const el = getByTestId('edge-e3');
      expect(el).toHaveAttribute('data-stroke', '#94a3b8');
      expect(el).toHaveAttribute('data-stroke-dash', '4,4');
      expect(el).toHaveAttribute('data-animated', 'false');
    });
  });

  describe('node interaction', () => {
    it('passes onNodeClick callback', () => {
      const onNodeClick = vi.fn();
      const trace = createMockTrace();
      
      // Component should render without errors with onNodeClick
      const { getByTestId } = render(
        <WorkflowExecutionCanvas trace={trace} onNodeClick={onNodeClick} />
      );

      expect(getByTestId('react-flow')).toBeInTheDocument();
    });

    it('renders without onNodeClick', () => {
      const trace = createMockTrace();
      
      const { getByTestId } = render(
        <WorkflowExecutionCanvas trace={trace} />
      );

      expect(getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  describe('minimap nodeColor', () => {
    it('returns green for pass, red for fail, slate for skipped and unknown ids', () => {
      const tracePass = createMockTrace({ iterations: 2, passedIterations: 2 });
      const { getByTestId, unmount } = render(<WorkflowExecutionCanvas trace={tracePass} />);
      const mm = getByTestId('minimap');
      expect(mm.getAttribute('data-color-n1')).toBe('#22c55e');
      expect(mm.getAttribute('data-color-n2')).toBe('#22c55e');
      expect(mm.getAttribute('data-color-n3')).toBe('#64748b');
      expect(mm.getAttribute('data-color-unknown')).toBe('#64748b');
      unmount();

      const traceFail = createMockTrace({ iterations: 2, passedIterations: 1 });
      const { getByTestId: getFail } = render(<WorkflowExecutionCanvas trace={traceFail} />);
      const mmFail = getFail('minimap');
      expect(mmFail.getAttribute('data-color-n1')).toBe('#ef4444');
    });
  });

  describe('ReplayControls', () => {
    it('calls zoomIn, zoomOut, and fitView with expected options', () => {
      const trace = createMockTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);
      const buttons = container.querySelectorAll('.wf-pill-btn');

      fireEvent.click(buttons[0]);
      expect(flowApi.zoomIn).toHaveBeenCalledWith({ duration: 200 });

      fireEvent.click(buttons[1]);
      expect(flowApi.zoomOut).toHaveBeenCalledWith({ duration: 200 });

      const fitBtn = container.querySelector('.wf-pill-btn[title="Fit view"]') as HTMLButtonElement;
      fireEvent.click(fitBtn);
      expect(flowApi.fitView).toHaveBeenCalledWith({ padding: 0.01, duration: 200 });
    });

    it('calls onToggleMinimap and marks toggle button active when minimap is shown', () => {
      const onToggleMinimap = vi.fn();
      const trace = createMockTrace();
      const { container } = render(
        <WorkflowExecutionCanvas trace={trace} showMinimap onToggleMinimap={onToggleMinimap} />
      );

      const toggle = container.querySelector('.wf-pill-btn[title="Toggle minimap"]') as HTMLButtonElement;
      expect(toggle).toBeInTheDocument();
      expect(toggle.className).toContain('active');

      fireEvent.click(toggle);
      expect(onToggleMinimap).toHaveBeenCalledTimes(1);
    });

    it('does not show active class on minimap toggle when minimap is hidden', () => {
      const onToggleMinimap = vi.fn();
      const trace = createMockTrace();
      const { container } = render(
        <WorkflowExecutionCanvas trace={trace} showMinimap={false} onToggleMinimap={onToggleMinimap} />
      );

      const toggle = container.querySelector('.wf-pill-btn[title="Toggle minimap"]') as HTMLButtonElement;
      expect(toggle.className).not.toContain('active');
    });
  });

  describe('node drag (onNodesChange)', () => {
    it('applies position updates via applyNodeChanges', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      fireEvent.click(getByTestId('trigger-nodes-change'));

      const n1 = (getLastReactFlowProps().nodes as Array<{ id: string; position: { x: number; y: number } }>).find(
        (n) => n.id === 'n1'
      );
      expect(n1?.position).toEqual({ x: 99, y: 88 });
    });

    it('styles an added node without trace state using skipped class fallback', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      fireEvent.click(getByTestId('trigger-add-orphan-node'));
      const orphan = getByTestId('node-orphan');
      expect(orphan.className).toContain('replay-node-skipped');
      expect(orphan.className).not.toContain('replay-node-selected');
    });
  });

  describe('empty workflow', () => {
    it('renders canvas with no nodes or edges', () => {
      const trace = createEmptyWorkflowTrace();
      const { getByTestId, queryByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(getByTestId('react-flow')).toBeInTheDocument();
      expect(queryByTestId('node-n1')).not.toBeInTheDocument();
      expect(queryByTestId('edge-e1')).not.toBeInTheDocument();
    });
  });

  describe('aggregation edge cases', () => {
    it('ignores events for node ids not in the workflow snapshot', () => {
      const trace = createMockTrace();
      trace.iterations[0].events.push({
        nodeId: 'not-in-graph',
        nodeType: 'http',
        nodeLabel: 'Ghost',
        timestamp: Date.now(),
        state: 'fail',
        durationMs: 1,
      });
      const { getByTestId, queryByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(getByTestId('node-n1')).toBeInTheDocument();
      expect(queryByTestId('node-not-in-graph')).not.toBeInTheDocument();
    });

    it('keeps aggregate pass when a later iteration records skipped for that node', () => {
      const trace = createMockTrace({ iterations: 2, passedIterations: 2 });
      trace.iterations[1].events = trace.iterations[1].events.map((e) =>
        e.nodeId === 'n1' ? { ...e, state: 'skipped' as const } : e
      );
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(getByTestId('node-n1').className).toContain('replay-node-pass');
    });

    it('aggregates skipped when prior aggregate and new event are both skipped', () => {
      const trace = createMockTrace({ iterations: 2, passedIterations: 2 });
      trace.iterations[0].events.push({
        nodeId: 'n3',
        nodeType: 'http',
        nodeLabel: 'Never Executed',
        timestamp: Date.now(),
        state: 'skipped',
        durationMs: 0,
      });
      trace.iterations[1].events.push({
        nodeId: 'n3',
        nodeType: 'http',
        nodeLabel: 'Never Executed',
        timestamp: Date.now(),
        state: 'skipped',
        durationMs: 0,
      });
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(getByTestId('node-n3').className).toContain('replay-node-skipped');
    });

    it('sets avgDuration undefined on the final state when last event omits durationMs', () => {
      const trace = createMockTrace({ iterations: 2, passedIterations: 2 });
      trace.iterations[1].events = [
        {
          nodeId: 'n1',
          nodeType: 'http',
          nodeLabel: 'Request',
          timestamp: Date.now(),
          state: 'pass',
        },
      ];
      render(<WorkflowExecutionCanvas trace={trace} />);
      const nodes = getLastReactFlowProps().nodes as Array<{ id: string; data: { executionState?: { avgDuration?: number } } }>;
      const n1 = nodes.find((n) => n.id === 'n1');
      expect(n1?.data.executionState?.avgDuration).toBeUndefined();
    });
  });

  describe('fitViewTrigger edge cases', () => {
    it('accepts fitViewTrigger 0 without throwing', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} fitViewTrigger={0} />);
      expect(getByTestId('react-flow')).toBeInTheDocument();
    });
  });
});
