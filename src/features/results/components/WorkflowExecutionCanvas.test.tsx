/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React, { useEffect } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import '@testing-library/jest-dom';
import * as XyflowReact from '@xyflow/react';
import type { Edge, Node, NodeChange, ReactFlowInstance } from '@xyflow/react';
import WorkflowExecutionCanvas, {
  type CanvasScreenshotFn,
  type CanvasSvgFn,
} from './WorkflowExecutionCanvas';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { captureCanvasScreenshot, captureCanvasSvg } from '../utils/canvasScreenshot';

const mockedCaptureScreenshot = vi.mocked(captureCanvasScreenshot);
const mockedCaptureSvg = vi.mocked(captureCanvasSvg);

const viewportState = vi.hoisted(() => ({
  x: 0,
  y: 0,
  zoom: 1,
}));

vi.mock('../utils/canvasScreenshot', () => ({
  captureCanvasScreenshot: vi.fn().mockResolvedValue('data:image/png;base64,xx'),
  captureCanvasSvg: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"/>'),
}));

const { flowApi, applyNodeChangesStub } = vi.hoisted(() => {
  const api = {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  };

  function stub(
    changes: import('@xyflow/react').NodeChange[],
    nodes: import('@xyflow/react').Node[],
  ) {
    let next = [...nodes];
    for (const c of changes) {
      if (c.type === 'position' && c.id && 'position' in c && c.position) {
        next = next.map((n) =>
          n.id === c.id ? { ...n, position: { ...c.position }, positionAbsolute: undefined } : n,
        );
      }
      if (c.type === 'dimensions' && c.id) {
        next = next.map((n) =>
          n.id === c.id
            ? { ...n, measured: ('dimensions' in c && c.dimensions) ? c.dimensions : n.measured }
            : n,
        );
      }
      if (c.type === 'add' && 'item' in c && c.item) {
        next = [...next, c.item];
      }
    }
    return next;
  }

  return { flowApi: api, applyNodeChangesStub: stub };
});

// Mock ReactFlow
vi.mock('@xyflow/react', () => ({
  ReactFlow: vi.fn(({
    nodes,
    edges,
    children,
    onInit,
    onNodeClick,
    onPaneClick,
    onNodesChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
  }: {
    nodes?: Node[];
    edges?: Edge[];
    children?: ReactNode;
    onInit?: (instance: ReactFlowInstance<Node, Edge>) => void;
    onNodeClick?: (event: MouseEvent, node: Node) => void;
    onPaneClick?: () => void;
    onNodesChange?: (changes: NodeChange[]) => void;
    onNodeMouseEnter?: (event: MouseEvent, node: Node) => void;
    onNodeMouseLeave?: (event: MouseEvent, node: Node) => void;
  }) => {
    useEffect(() => {
      const instance = { fitView: flowApi.fitView } as unknown as ReactFlowInstance<Node, Edge>;
      onInit?.(instance);
    }, [onInit]);
    return (
    <div data-testid="react-flow">
      <div data-testid="flow-pane" onClick={() => onPaneClick?.()}>
        {nodes?.map((node: Node) => (
          <div
            key={node.id}
            role="button"
            data-testid={`node-${node.id}`}
            className={node.className}
            style={node.style}
            onClick={(e) => {
              e.stopPropagation();
              onNodeClick?.(e, node);
            }}
            onMouseEnter={(e) => onNodeMouseEnter?.(e, node)}
            onMouseLeave={(e) => onNodeMouseLeave?.(e, node)}
          />
        ))}
      </div>
      {edges?.map((edge: Edge) => (
        <div
          key={edge.id}
          data-testid={`edge-${edge.id}`}
          className={edge.className}
          data-animated={String(!!edge.animated)}
          data-stroke={edge.style?.stroke}
          data-stroke-dash={edge.style?.strokeDasharray ?? ''}
          data-label={edge.label ?? ''}
        />
      ))}
      <button type="button" data-testid="trigger-nodes-change" onClick={() => onNodesChange?.([{ type: 'position', id: 'n1', position: { x: 99, y: 88 } }])}>
        apply node change
      </button>
      <button
        type="button"
        data-testid="trigger-dimensions-change"
        onClick={() =>
          onNodesChange?.([
            {
              type: 'dimensions',
              id: 'n1',
              dimensions: { width: 200, height: 60 },
              setAttributes: true,
            },
          ])
        }
      >
        apply dimensions change
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
    );
  }),
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
  useViewport: () => ({ x: viewportState.x, y: viewportState.y, zoom: viewportState.zoom }),
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

function createBranchingTrace(): WorkflowExecutionTrace {
  return {
    workflowId: 'wf-branch',
    workflowName: 'Branching Workflow',
    totalIterations: 4,
    totalDurationMs: 4000,
    iterations: [
      { index: 0, passed: true, durationMs: 1000, events: [
        { nodeId: 'n1', nodeType: 'http', nodeLabel: 'Request', timestamp: 0, state: 'pass', durationMs: 100 },
        { nodeId: 'n2', nodeType: 'condition', nodeLabel: 'Check', timestamp: 100, state: 'pass', durationMs: 1 },
        { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Yes Path', timestamp: 101, state: 'pass', durationMs: 50 },
      ], finalVariables: {}, traversedEdges: ['e1', 'e2'] },
      { index: 1, passed: true, durationMs: 1000, events: [
        { nodeId: 'n1', nodeType: 'http', nodeLabel: 'Request', timestamp: 0, state: 'pass', durationMs: 100 },
        { nodeId: 'n2', nodeType: 'condition', nodeLabel: 'Check', timestamp: 100, state: 'pass', durationMs: 1 },
        { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Yes Path', timestamp: 101, state: 'pass', durationMs: 50 },
      ], finalVariables: {}, traversedEdges: ['e1', 'e2'] },
      { index: 2, passed: true, durationMs: 1000, events: [
        { nodeId: 'n1', nodeType: 'http', nodeLabel: 'Request', timestamp: 0, state: 'pass', durationMs: 100 },
        { nodeId: 'n2', nodeType: 'condition', nodeLabel: 'Check', timestamp: 100, state: 'pass', durationMs: 1 },
        { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Yes Path', timestamp: 101, state: 'pass', durationMs: 50 },
      ], finalVariables: {}, traversedEdges: ['e1', 'e2'] },
      { index: 3, passed: false, durationMs: 1000, events: [
        { nodeId: 'n1', nodeType: 'http', nodeLabel: 'Request', timestamp: 0, state: 'pass', durationMs: 100 },
        { nodeId: 'n2', nodeType: 'condition', nodeLabel: 'Check', timestamp: 100, state: 'fail', durationMs: 1 },
        { nodeId: 'n4', nodeType: 'http', nodeLabel: 'No Path', timestamp: 101, state: 'fail', durationMs: 50 },
      ], finalVariables: {}, traversedEdges: ['e1', 'e3'] },
    ],
    traversedEdges: ['e1', 'e2', 'e3'],
    workflowSnapshot: {
      nodes: [
        { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Request' } },
        { id: 'n2', type: 'condition', position: { x: 0, y: 100 }, data: { label: 'Check' } },
        { id: 'n3', type: 'http', position: { x: -100, y: 200 }, data: { label: 'Yes Path' } },
        { id: 'n4', type: 'http', position: { x: 100, y: 200 }, data: { label: 'No Path' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n2', target: 'n4' },
      ],
    },
  };
}

function getLastReactFlowProps(): Record<string, unknown> {
  const rf = vi.mocked(XyflowReact.ReactFlow);
  expect(rf.mock.calls.length).toBeGreaterThan(0);
  return rf.mock.calls[rf.mock.calls.length - 1][0] as Record<string, unknown>;
}

describe('WorkflowExecutionCanvas', () => {
  beforeEach(() => {
    viewportState.x = 0;
    viewportState.y = 0;
    viewportState.zoom = 1;
    vi.mocked(XyflowReact.ReactFlow).mockClear();
    flowApi.zoomIn.mockClear();
    flowApi.zoomOut.mockClear();
    flowApi.fitView.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
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
      expect(flowApi.fitView).toHaveBeenCalledWith({ padding: 0.05, duration: 200 });
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

  describe('node hover tooltip', () => {
    function hoverNode(getByTestId: ReturnType<typeof render>['getByTestId'], nodeId: string) {
      const el = getByTestId(`node-${nodeId}`);
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ left: 100, top: 50, width: 220, height: 60, right: 320, bottom: 110 }),
      });
      fireEvent.mouseEnter(el);
    }

    it('shows tooltip on node hover', () => {
      const trace = createMockTrace();
      const { getByTestId, queryByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      expect(queryByTestId('node-tooltip')).not.toBeInTheDocument();

      hoverNode(getByTestId, 'n1');

      expect(getByTestId('node-tooltip')).toBeInTheDocument();
    });

    it('tooltip displays node label', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('Request');
    });

    it('tooltip displays pass status for passing node', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('Pass');
    });

    it('tooltip displays fail status for failing node', () => {
      const trace = createMockTrace({ iterations: 2, passedIterations: 1 });
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('Fail');
    });

    it('tooltip displays skipped status for unexecuted node', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n3');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('Skipped');
    });

    it('tooltip displays avg duration in ms', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('Avg:');
      expect(tooltip.textContent).toContain('ms');
    });

    it('tooltip displays avg duration in seconds for slow nodes', () => {
      const trace = createMockTrace();
      trace.iterations[0].events[0].durationMs = 2500;
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('2.50 s');
    });

    it('tooltip displays pass rate', () => {
      const trace = createMockTrace({ iterations: 4, passedIterations: 3 });
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('Pass rate:');
      expect(tooltip.textContent).toContain('75%');
    });

    it('tooltip displays execution count', () => {
      const trace = createMockTrace({ iterations: 3, passedIterations: 3 });
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).toContain('Executions: 3');
    });

    it('tooltip hides on mouse leave', () => {
      const trace = createMockTrace();
      const { getByTestId, queryByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n1');
      expect(getByTestId('node-tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(getByTestId('node-n1'));
      expect(queryByTestId('node-tooltip')).not.toBeInTheDocument();
    });

    it('does not show stats rows for skipped nodes with zero executions', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      hoverNode(getByTestId, 'n3');

      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.textContent).not.toContain('Avg:');
      expect(tooltip.textContent).not.toContain('Executions:');
    });

    it('shows bottleneck section when node has a bottleneck insight', () => {
      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-bottleneck-tip',
        workflowName: 'Bottleneck tooltip',
        totalIterations: 2,
        totalDurationMs: 2000,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'slow', nodeType: 'http', nodeLabel: 'Slow', timestamp: 0, state: 'pass', durationMs: 800 },
              { nodeId: 'fast', nodeType: 'http', nodeLabel: 'Fast', timestamp: 1, state: 'pass', durationMs: 100 },
            ],
            finalVariables: {},
          },
          {
            index: 1,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'slow', nodeType: 'http', nodeLabel: 'Slow', timestamp: 0, state: 'pass', durationMs: 800 },
              { nodeId: 'fast', nodeType: 'http', nodeLabel: 'Fast', timestamp: 1, state: 'pass', durationMs: 100 },
            ],
            finalVariables: {},
          },
        ],
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [
            { id: 'slow', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Slow' } },
            { id: 'fast', type: 'http', position: { x: 200, y: 0 }, data: { label: 'Fast' } },
          ],
          edges: [{ id: 'e1', source: 'slow', target: 'fast' }],
        },
      };
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      hoverNode(getByTestId, 'slow');
      const tooltip = getByTestId('node-tooltip');
      expect(tooltip.querySelector('.replay-tooltip-bottleneck')).toBeInTheDocument();
      expect(tooltip.querySelector('.replay-tooltip-bottleneck-critical')).toBeInTheDocument();
      expect(tooltip.textContent).toMatch(/Consumes|execution time/i);
    });
  });

  describe('edge traversal percentages', () => {
    it('shows percentage badges on branching edges', () => {
      const trace = createBranchingTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const badges = container.querySelectorAll('.edge-pct-badge');
      const texts = Array.from(badges).map(b => b.textContent);
      // e2 (yes path): 3/4 = 75%, e3 (no path): 1/4 = 25%
      expect(texts).toContain('75%');
      expect(texts).toContain('25%');
    });

    it('does not show percentage badge on non-branching edges', () => {
      const trace = createBranchingTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const badges = container.querySelectorAll('.edge-pct-badge');
      // Only 2 badges for the 2 branching edges (e2, e3), none for e1
      expect(badges).toHaveLength(2);
    });

    it('does not show percentage badges for single iteration', () => {
      const trace = createBranchingTrace();
      const singleIterTrace: WorkflowExecutionTrace = {
        ...trace,
        iterations: [trace.iterations[0]],
        traversedEdges: ['e1', 'e2'],
        totalIterations: 1,
      };
      const { container } = render(<WorkflowExecutionCanvas trace={singleIterTrace} />);

      const badges = container.querySelectorAll('.edge-pct-badge');
      expect(badges).toHaveLength(0);
    });

    it('shows 100% and 0% when all iterations take same branch', () => {
      const trace = createBranchingTrace();
      const allSamePath: WorkflowExecutionTrace = {
        ...trace,
        iterations: trace.iterations.map(iter => ({
          ...iter,
          passed: true,
          traversedEdges: ['e1', 'e2'],
        })),
      };
      const { container } = render(<WorkflowExecutionCanvas trace={allSamePath} />);

      const badges = container.querySelectorAll('.edge-pct-badge');
      const texts = Array.from(badges).map(b => b.textContent);
      expect(texts).toContain('100%');
      expect(texts).toContain('0%');
    });

    it('excludes sampled-out iterations from percentage calculation', () => {
      const trace = createBranchingTrace();
      const withSampling: WorkflowExecutionTrace = {
        ...trace,
        iterations: trace.iterations.map((iter, i) => ({
          ...iter,
          sampled: i !== 3 ? true : false,
        })),
      };
      const { container } = render(<WorkflowExecutionCanvas trace={withSampling} />);

      const badges = container.querySelectorAll('.edge-pct-badge');
      const texts = Array.from(badges).map(b => b.textContent);
      // Only 3 sampled iterations, all take e2
      expect(texts).toContain('100%');
      expect(texts).toContain('0%');
    });
  });

  describe('heatmap coloring', () => {
    function createHeatmapTrace(): WorkflowExecutionTrace {
      return {
        workflowId: 'wf-heat',
        workflowName: 'Heatmap Test',
        totalIterations: 2,
        totalDurationMs: 2000,
        iterations: [
          {
            index: 0, passed: true, durationMs: 1000, traversedEdges: ['e1', 'e2'],
            events: [
              { nodeId: 'n1', nodeType: 'http', nodeLabel: 'Fast', timestamp: 0, state: 'pass', durationMs: 20 },
              { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Slow', timestamp: 20, state: 'pass', durationMs: 500 },
            ], finalVariables: {},
          },
          {
            index: 1, passed: true, durationMs: 1000, traversedEdges: ['e1', 'e2'],
            events: [
              { nodeId: 'n1', nodeType: 'http', nodeLabel: 'Fast', timestamp: 0, state: 'pass', durationMs: 30 },
              { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Slow', timestamp: 30, state: 'pass', durationMs: 600 },
            ], finalVariables: {},
          },
        ],
        traversedEdges: ['e1', 'e2'],
        workflowSnapshot: {
          nodes: [
            { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Fast' } },
            { id: 'n2', type: 'http', position: { x: 0, y: 100 }, data: { label: 'Slow' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        },
      };
    }

    it('applies heatmap class to nodes with timing data', () => {
      const trace = createHeatmapTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const heatmapNodes = container.querySelectorAll('.replay-node-heatmap');
      expect(heatmapNodes.length).toBe(2);
    });

    it('sets --heatmap-color CSS variable on heatmap nodes', () => {
      const trace = createHeatmapTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const nodes = container.querySelectorAll('.replay-node-heatmap');
      const styleAttrs = Array.from(nodes).map(n => (n as HTMLElement).getAttribute('style') || '');
      expect(styleAttrs.every(s => s.includes('--heatmap-color'))).toBe(true);
      expect(styleAttrs.every(s => s.includes('rgb('))).toBe(true);
    });

    it('fastest node gets green heatmap color, slowest gets red', () => {
      const trace = createHeatmapTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const nodes = Array.from(container.querySelectorAll('.replay-node-heatmap'));
      const styleAttrs = nodes.map(n => (n as HTMLElement).getAttribute('style') || '');
      // n1 is fast (avg 25ms) → green-ish, n2 is slow (avg 550ms) → red-ish
      // Extract green channel from the rgb value in the style attribute
      const parseG = (s: string) => {
        const m = s.match(/rgb\(\d+, (\d+), \d+\)/);
        return m ? parseInt(m[1], 10) : 0;
      };
      expect(parseG(styleAttrs[0])).toBeGreaterThan(parseG(styleAttrs[1]));
    });

    it('does not apply heatmap when only one node has timing', () => {
      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-single',
        workflowName: 'Single Node',
        totalIterations: 1,
        totalDurationMs: 100,
        iterations: [{
          index: 0, passed: true, durationMs: 100, traversedEdges: ['e1'],
          events: [
            { nodeId: 'n1', nodeType: 'http', nodeLabel: 'Only', timestamp: 0, state: 'pass', durationMs: 50 },
            { nodeId: 'n2', nodeType: 'start', nodeLabel: 'Start', timestamp: 0, state: 'pass' },
          ], finalVariables: {},
        }],
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [
            { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Only' } },
            { id: 'n2', type: 'start', position: { x: 0, y: 100 }, data: { label: 'Start' } },
          ],
          edges: [{ id: 'e1', source: 'n2', target: 'n1' }],
        },
      };
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);

      const heatmapNodes = container.querySelectorAll('.replay-node-heatmap');
      expect(heatmapNodes.length).toBe(0);
    });

    it('does not apply heatmap when all timed nodes have the same average (max - min < 1)', () => {
      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-flat-heat',
        workflowName: 'Flat heatmap',
        totalIterations: 2,
        totalDurationMs: 2000,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'n1', nodeType: 'http', nodeLabel: 'A', timestamp: 0, state: 'pass', durationMs: 100 },
              { nodeId: 'n2', nodeType: 'http', nodeLabel: 'B', timestamp: 1, state: 'pass', durationMs: 100 },
            ],
            finalVariables: {},
          },
          {
            index: 1,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'n1', nodeType: 'http', nodeLabel: 'A', timestamp: 0, state: 'pass', durationMs: 100 },
              { nodeId: 'n2', nodeType: 'http', nodeLabel: 'B', timestamp: 1, state: 'pass', durationMs: 100 },
            ],
            finalVariables: {},
          },
        ],
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [
            { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'A' } },
            { id: 'n2', type: 'http', position: { x: 0, y: 100 }, data: { label: 'B' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        },
      };
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(container.querySelectorAll('.replay-node-heatmap')).toHaveLength(0);
    });

    it('does not apply heatmap to skipped nodes', () => {
      const trace = createHeatmapTrace();
      // Add a skipped node
      const withSkipped: WorkflowExecutionTrace = {
        ...trace,
        workflowSnapshot: {
          ...trace.workflowSnapshot,
          nodes: [
            ...trace.workflowSnapshot.nodes,
            { id: 'n3', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Skipped' } },
          ],
        },
      };
      const { container } = render(<WorkflowExecutionCanvas trace={withSkipped} />);

      const allNodes = container.querySelectorAll('.replay-node');
      const heatmapNodes = container.querySelectorAll('.replay-node-heatmap');
      expect(allNodes.length).toBe(3);
      expect(heatmapNodes.length).toBe(2);
    });
  });

  describe('search and state filter', () => {
    it('dims only non-matching nodes for searchQuery', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} searchQuery="Request" />);
      expect(getByTestId('node-n1').className).not.toContain('replay-node-dimmed');
      expect(getByTestId('node-n2').className).toContain('replay-node-dimmed');
      expect(getByTestId('node-n3').className).toContain('replay-node-dimmed');
    });

    it('dims nodes that do not contain a non-matching search string', () => {
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} searchQuery="zzzz-no-match" />);
      expect(getByTestId('node-n1').className).toContain('replay-node-dimmed');
      expect(getByTestId('node-n2').className).toContain('replay-node-dimmed');
    });

    it('dims nodes that fail stateFilter=pass while keeping passing nodes visible', () => {
      const trace = createMockTrace({ iterations: 2, passedIterations: 1 });
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} stateFilter="pass" />);
      expect(getByTestId('node-n1').className).toContain('replay-node-dimmed');
      expect(getByTestId('node-n2').className).not.toContain('replay-node-dimmed');
      expect(getByTestId('node-n3').className).toContain('replay-node-dimmed');
    });
  });

  describe('saved layout', () => {
    it('persists layout via save button using replayLayout: storage key', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      fireEvent.click(getByTestId('save-layout-btn'));
      expect(setItemSpy).toHaveBeenCalled();
      const [key] = setItemSpy.mock.calls[0];
      expect(key).toMatch(/^replayLayout:/);
      expect(key).toBe(`replayLayout:${trace.workflowId}`);
      setItemSpy.mockRestore();
    });

    it('restores node xy positions from localStorage on mount', () => {
      const trace = createMockTrace();
      const positions = { n1: { x: 42, y: 84 }, n2: { x: 10, y: 20 }, n3: { x: -5, y: 7 } };
      localStorage.setItem(`replayLayout:${trace.workflowId}`, JSON.stringify(positions));
      render(<WorkflowExecutionCanvas trace={trace} />);
      const nodes = getLastReactFlowProps().nodes as Array<{ id: string; position: { x: number; y: number } }>;
      expect(nodes.find((n) => n.id === 'n1')?.position).toEqual({ x: 42, y: 84 });
      expect(nodes.find((n) => n.id === 'n2')?.position).toEqual({ x: 10, y: 20 });
      expect(nodes.find((n) => n.id === 'n3')?.position).toEqual({ x: -5, y: 7 });
    });
  });

  describe('bottleneck styling and callback', () => {
    function createBottleneckTrace(): WorkflowExecutionTrace {
      return {
        workflowId: 'wf-bottleneck-style',
        workflowName: 'Bottleneck style',
        totalIterations: 2,
        totalDurationMs: 2000,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'slow', nodeType: 'http', nodeLabel: 'Slow', timestamp: 0, state: 'pass', durationMs: 800 },
              { nodeId: 'fast', nodeType: 'http', nodeLabel: 'Fast', timestamp: 1, state: 'pass', durationMs: 100 },
            ],
            finalVariables: {},
          },
          {
            index: 1,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'slow', nodeType: 'http', nodeLabel: 'Slow', timestamp: 0, state: 'pass', durationMs: 800 },
              { nodeId: 'fast', nodeType: 'http', nodeLabel: 'Fast', timestamp: 1, state: 'pass', durationMs: 100 },
            ],
            finalVariables: {},
          },
        ],
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [
            { id: 'slow', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Slow' } },
            { id: 'fast', type: 'http', position: { x: 200, y: 0 }, data: { label: 'Fast' } },
          ],
          edges: [{ id: 'e1', source: 'slow', target: 'fast' }],
        },
      };
    }

    it('applies bottleneck severity classes from bottleneck insights', () => {
      const trace = createBottleneckTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(getByTestId('node-slow').className).toContain('replay-node-bottleneck-critical');
      expect(getByTestId('node-fast').className).toContain('replay-node-bottleneck-info');
    });

    it('invokes onBottlenecksComputed with insights', () => {
      const onBottlenecksComputed = vi.fn();
      const trace = createBottleneckTrace();
      render(<WorkflowExecutionCanvas trace={trace} onBottlenecksComputed={onBottlenecksComputed} />);
      expect(onBottlenecksComputed).toHaveBeenCalled();
      const insights = onBottlenecksComputed.mock.calls[0][0];
      expect(Array.isArray(insights)).toBe(true);
      expect(insights.some((i: { nodeId: string }) => i.nodeId === 'slow')).toBe(true);
    });
  });

  describe('node label fallback for search matching', () => {
    function createTraceWithNameAndIdFallback(): WorkflowExecutionTrace {
      return {
        workflowId: 'wf-label-fallback',
        workflowName: 'Label fallback',
        totalIterations: 1,
        totalDurationMs: 500,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 500,
            traversedEdges: ['e1', 'e2'],
            events: [
              {
                nodeId: 'nameOnly',
                nodeType: 'http',
                nodeLabel: 'FromNameField',
                timestamp: 0,
                state: 'pass',
                durationMs: 50,
              },
              {
                nodeId: 'idonly',
                nodeType: 'http',
                nodeLabel: 'FallbackId',
                timestamp: 1,
                state: 'pass',
                durationMs: 40,
              },
            ],
            finalVariables: {},
          },
        ],
        traversedEdges: ['e1', 'e2'],
        workflowSnapshot: {
          nodes: [
            {
              id: 'nameOnly',
              type: 'http',
              position: { x: 0, y: 0 },
              data: { name: 'DisplayFromName' },
            },
            {
              id: 'idonly',
              type: 'http',
              position: { x: 0, y: 100 },
              data: {},
            },
          ],
          edges: [
            { id: 'e1', source: 'nameOnly', target: 'idonly' },
            { id: 'e2', source: 'idonly', target: 'nameOnly' },
          ],
        },
      };
    }

    it('matches search against data.name when label is absent', () => {
      const trace = createTraceWithNameAndIdFallback();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} searchQuery="displayfromname" />);
      expect(getByTestId('node-nameOnly').className).not.toContain('replay-node-dimmed');
      expect(getByTestId('node-idonly').className).toContain('replay-node-dimmed');
    });

    it('matches search against node id when label and name are absent', () => {
      const trace = createTraceWithNameAndIdFallback();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} searchQuery="idonly" />);
      expect(getByTestId('node-idonly').className).not.toContain('replay-node-dimmed');
    });
  });

  describe('onInit and dimensions fitView', () => {
    it('calls fitView after the first dimensions measurement (debounced)', () => {
      vi.useFakeTimers();
      try {
        const trace = createMockTrace();
        const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

        fireEvent.click(getByTestId('trigger-dimensions-change'));
        vi.advanceTimersByTime(149);
        expect(flowApi.fitView).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2);
        expect(flowApi.fitView).toHaveBeenCalledWith({ padding: 0.05, duration: 200 });

        fireEvent.click(getByTestId('trigger-dimensions-change'));
        vi.advanceTimersByTime(200);
        expect(flowApi.fitView).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reschedules fitView when dimensions changes fire back-to-back before the debounce elapses', () => {
      vi.useFakeTimers();
      try {
        const trace = createMockTrace();
        const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

        fireEvent.click(getByTestId('trigger-dimensions-change'));
        fireEvent.click(getByTestId('trigger-dimensions-change'));
        vi.advanceTimersByTime(200);

        expect(flowApi.fitView).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('screenshot and svg export hooks', () => {
    it('registers onScreenshotReady with a working capture function', async () => {
      let capture: CanvasScreenshotFn | undefined;
      const trace = createMockTrace();
      render(
        <WorkflowExecutionCanvas
          trace={trace}
          onScreenshotReady={(fn) => {
            capture = fn;
          }}
        />
      );
      expect(capture).toBeDefined();
      mockedCaptureScreenshot.mockClear();
      await expect(capture!()).resolves.toBe('data:image/png;base64,xx');
      expect(mockedCaptureScreenshot).toHaveBeenCalledTimes(1);
    });

    it('registers onSvgReady with a working capture function', async () => {
      let capture: CanvasSvgFn | undefined;
      const trace = createMockTrace();
      render(
        <WorkflowExecutionCanvas
          trace={trace}
          onSvgReady={(fn) => {
            capture = fn;
          }}
        />
      );
      expect(capture).toBeDefined();
      mockedCaptureSvg.mockClear();
      await expect(capture!()).resolves.toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
      expect(mockedCaptureSvg).toHaveBeenCalledTimes(1);
    });

    it('rejects PNG capture when the canvas container ref is detached', async () => {
      let capture: CanvasScreenshotFn | undefined;
      const trace = createMockTrace();
      const { unmount } = render(
        <WorkflowExecutionCanvas trace={trace} onScreenshotReady={(fn) => { capture = fn; }} />
      );

      await expect(async () => {
        unmount();
        await capture!();
      }).rejects.toThrow(/not mounted/i);
    });

    it('rejects SVG capture when the canvas container ref is detached', async () => {
      let capture: CanvasSvgFn | undefined;
      const trace = createMockTrace();
      const { unmount } = render(
        <WorkflowExecutionCanvas trace={trace} onSvgReady={(fn) => { capture = fn; }} />
      );

      await expect(async () => {
        unmount();
        await capture!();
      }).rejects.toThrow(/not mounted/i);
    });
  });

  function createForkJoinSwimLaneTrace(): WorkflowExecutionTrace {
    return {
      workflowId: 'wf-fork-swim',
      workflowName: 'Fork join swim lanes',
      totalIterations: 2,
      totalDurationMs: 20000,
      iterations: [
        {
          index: 0,
          passed: true,
          durationMs: 10000,
          traversedEdges: ['sf', 'fl', 'rj', 'je'],
          events: [
            { nodeId: 'leftBranch', nodeType: 'http', nodeLabel: 'Left branch', timestamp: 0, state: 'pass', durationMs: 920 },
            { nodeId: 'rightBranch', nodeType: 'http', nodeLabel: 'Right branch', timestamp: 0, state: 'pass', durationMs: 80 },
          ],
          finalVariables: {},
        },
        {
          index: 1,
          passed: true,
          durationMs: 10000,
          traversedEdges: ['sf', 'fl', 'rj', 'je'],
          events: [
            { nodeId: 'leftBranch', nodeType: 'http', nodeLabel: 'Left branch', timestamp: 0, state: 'pass', durationMs: 908 },
            { nodeId: 'rightBranch', nodeType: 'http', nodeLabel: 'Right branch', timestamp: 0, state: 'pass', durationMs: 92 },
          ],
          finalVariables: {},
        },
      ],
      traversedEdges: [],
      workflowSnapshot: {
        nodes: [
          { id: 'st', type: 'start', position: { x: 400, y: -40 }, data: { label: 'Start' } },
          { id: 'fork', type: 'fork', position: { x: 400, y: 40 }, data: { label: 'Fork' } },
          { id: 'leftBranch', type: 'http', position: { x: 140, y: 200 }, data: { label: 'Lane A Alpha' } },
          { id: 'rightBranch', type: 'http', position: { x: 660, y: 200 }, data: { label: 'Lane B Beta' } },
          {
            id: 'joinNode',
            type: 'join',
            position: { x: 400, y: 360 },
            data: { label: 'Join' },
          },
          { id: 'tail', type: 'http', position: { x: 400, y: 500 }, data: { label: 'Tail' } },
        ],
        edges: [
          { id: 'sf', source: 'st', target: 'fork' },
          { id: 'fl', source: 'fork', target: 'leftBranch' },
          { id: 'fr', source: 'fork', target: 'rightBranch' },
          { id: 'jl', source: 'leftBranch', target: 'joinNode' },
          { id: 'rj', source: 'rightBranch', target: 'joinNode' },
          { id: 'je', source: 'joinNode', target: 'tail' },
        ],
      },
    };
  }

  describe('fork/join swim lanes and callback', () => {
    it('renders swim lane overlays and critical path markup when topology is detected', () => {
      const trace = createForkJoinSwimLaneTrace();
      const { getByTestId, container } = render(<WorkflowExecutionCanvas trace={trace} />);

      expect(getByTestId('swim-lane-overlay')).toBeInTheDocument();
      expect(getByTestId('swim-lane-0')).toBeInTheDocument();
      expect(getByTestId('swim-lane-1')).toBeInTheDocument();
      expect(container.querySelector('.swim-lane-critical')).toBeInTheDocument();
      expect(container.querySelector('.swim-lane-critical-badge')).toBeInTheDocument();
      const dashed = container.querySelectorAll('.swim-lane:not(.swim-lane-critical)');
      expect(dashed.length).toBeGreaterThan(0);
    });

    it('invokes onForkJoinDetected with non-empty pairs', () => {
      const onForkJoinDetected = vi.fn();
      const trace = createForkJoinSwimLaneTrace();
      render(<WorkflowExecutionCanvas trace={trace} onForkJoinDetected={onForkJoinDetected} />);

      expect(onForkJoinDetected).toHaveBeenCalled();
      const topo = onForkJoinDetected.mock.calls[0][0];
      expect(topo.pairs.length).toBe(1);
      expect(topo.pairs[0].branches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('workflow snapshot refresh', () => {
    it('rebuilds internal nodes when workflowSnapshot.nodes array identity changes', () => {
      const trace = createMockTrace();
      const { rerender, getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);

      fireEvent.click(getByTestId('trigger-nodes-change'));
      let n1 = (getLastReactFlowProps().nodes as Array<{ id: string; position: { x: number; y: number } }>).find(
        (n) => n.id === 'n1',
      );
      expect(n1?.position).toEqual({ x: 99, y: 88 });

      const clonedNodes = (trace.workflowSnapshot.nodes as Array<{ id: string }>).map((n) => ({ ...n }));
      rerender(
        <WorkflowExecutionCanvas
          trace={{
            ...trace,
            workflowSnapshot: {
              ...trace.workflowSnapshot,
              nodes: clonedNodes,
            },
          }}
        />
      );

      n1 = (getLastReactFlowProps().nodes as Array<{ id: string; position: { x: number; y: number } }>).find(
        (n) => n.id === 'n1',
      );
      expect(n1?.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('layout storage resilience', () => {
    it('returns null-shaped behavior when persisted layout JSON is invalid', () => {
      localStorage.setItem(`replayLayout:${createMockTrace().workflowId}`, 'not-json-{');
      const trace = createMockTrace();
      render(<WorkflowExecutionCanvas trace={trace} />);

      const n1 = (getLastReactFlowProps().nodes as Array<{ id: string; position: { x: number; y: number } }>).find(
        (n) => n.id === 'n1'
      );
      expect(n1?.position).toEqual({ x: 0, y: 0 });
    });

    it('swallows quota errors when save layout cannot write to storage', () => {
      const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      const trace = createMockTrace();
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(() => fireEvent.click(getByTestId('save-layout-btn'))).not.toThrow();
      setSpy.mockRestore();
    });
  });

  describe('edge percentage overlay details', () => {
    function allSameBranchEdgeTrace(): WorkflowExecutionTrace {
      const trace = createBranchingTrace();
      return {
        ...trace,
        iterations: trace.iterations.map((iter) => ({
          ...iter,
          passed: true,
          traversedEdges: ['e1', 'e2'],
        })),
      };
    }

    it('adds edge-pct-zero class for 0% branching edges', () => {
      const trace = allSameBranchEdgeTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);
      expect(container.querySelector('.edge-pct-zero')).toBeInTheDocument();
    });

    it('clamps edge badge scale at very low zoom', () => {
      viewportState.zoom = 0.3;
      const trace = allSameBranchEdgeTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);
      const badge = container.querySelector('.edge-pct-badge') as HTMLElement | null;
      expect(badge?.getAttribute('style')).toContain('scale(0.6');
    });

    it('clamps edge badge scale at very high zoom', () => {
      viewportState.zoom = 3;
      const trace = allSameBranchEdgeTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);
      const badge = container.querySelector('.edge-pct-badge') as HTMLElement | null;
      expect(badge?.getAttribute('style')).toContain('scale(1.2');
    });
  });

  describe('tooltip label and bottleneck icons', () => {
    function hoverNode(getByTestId: ReturnType<typeof render>['getByTestId'], nodeId: string) {
      const el = getByTestId(`node-${nodeId}`);
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ left: 100, top: 50, width: 220, height: 60, right: 320, bottom: 110 }),
      });
      fireEvent.mouseEnter(el);
    }

    it('fallback tooltip label uses node id when data has no label', () => {
      const trace = createMockTrace();
      trace.workflowSnapshot = {
        ...trace.workflowSnapshot,
        nodes: (trace.workflowSnapshot.nodes as []).map((n: { id: string; data?: object }) =>
          n.id === 'n1'
            ? { ...n, data: {} }
            : n,
        ),
      };
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      hoverNode(getByTestId, 'n1');
      expect(getByTestId('node-tooltip').textContent).toContain('n1');
    });

    it('shows warning icon for bottleneck warning severity', () => {
      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-warning-bn',
        workflowName: 'Warning bottleneck',
        totalIterations: 2,
        totalDurationMs: 20000,
        iterations: Array.from({ length: 2 }, (_, i) => ({
          index: i,
          passed: true,
          durationMs: 10000,
          traversedEdges: ['e'],
          events: [
            {
              nodeId: 'heavy',
              nodeType: 'http',
              nodeLabel: 'Heavy endpoint',
              timestamp: 0,
              state: 'pass',
              durationMs: 4000,
            },
            {
              nodeId: 'light',
              nodeType: 'http',
              nodeLabel: 'Light',
              timestamp: 1,
              state: 'pass',
              durationMs: 1000,
            },
          ],
          finalVariables: {},
        })),
        traversedEdges: ['e'],
        workflowSnapshot: {
          nodes: [
            { id: 'heavy', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Heavy' } },
            { id: 'light', type: 'http', position: { x: 200, y: 0 }, data: { label: 'Light' } },
          ],
          edges: [{ id: 'e', source: 'heavy', target: 'light' }],
        },
      };
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      hoverNode(getByTestId, 'heavy');
      const tip = getByTestId('node-tooltip');
      expect(tip.querySelector('.replay-tooltip-bottleneck-warning')).toBeInTheDocument();
      expect(tip.textContent).toContain('⚠️');
    });

    it('shows info icon for bottleneck info severity', () => {
      const trace: WorkflowExecutionTrace = {
        workflowId: 'wf-info-bn',
        workflowName: 'Info bottleneck',
        totalIterations: 2,
        totalDurationMs: 20000,
        iterations: Array.from({ length: 2 }, (_, i) => ({
          index: i,
          passed: true,
          durationMs: 10000,
          traversedEdges: ['e'],
          events: [
            {
              nodeId: 'heavy',
              nodeType: 'http',
              nodeLabel: 'Heavy',
              timestamp: 0,
              state: 'pass',
              durationMs: 4000,
            },
            {
              nodeId: 'light',
              nodeType: 'http',
              nodeLabel: 'Light',
              timestamp: 1,
              state: 'pass',
              durationMs: 1500,
            },
          ],
          finalVariables: {},
        })),
        traversedEdges: ['e'],
        workflowSnapshot: {
          nodes: [
            { id: 'heavy', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Heavy' } },
            { id: 'light', type: 'http', position: { x: 200, y: 0 }, data: { label: 'Light' } },
          ],
          edges: [{ id: 'e', source: 'heavy', target: 'light' }],
        },
      };
      const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
      hoverNode(getByTestId, 'light');
      const tip = getByTestId('node-tooltip');
      expect(tip.querySelector('.replay-tooltip-bottleneck-info')).toBeInTheDocument();
      expect(tip.textContent).toContain('ℹ️');
    });
  });

  describe('heatmap color branches', () => {
    function createWideHeatmapTrace(): WorkflowExecutionTrace {
      return {
        workflowId: 'wf-wide-heat',
        workflowName: 'Wide heat split',
        totalIterations: 2,
        totalDurationMs: 2000,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'cool', nodeType: 'http', nodeLabel: 'Cool', timestamp: 0, state: 'pass', durationMs: 10 },
              { nodeId: 'warm', nodeType: 'http', nodeLabel: 'Warm', timestamp: 1, state: 'pass', durationMs: 80 },
              { nodeId: 'hot', nodeType: 'http', nodeLabel: 'Hot', timestamp: 2, state: 'pass', durationMs: 800 },
            ],
            finalVariables: {},
          },
          {
            index: 1,
            passed: true,
            durationMs: 1000,
            traversedEdges: ['e1'],
            events: [
              { nodeId: 'cool', nodeType: 'http', nodeLabel: 'Cool', timestamp: 0, state: 'pass', durationMs: 20 },
              { nodeId: 'warm', nodeType: 'http', nodeLabel: 'Warm', timestamp: 1, state: 'pass', durationMs: 90 },
              { nodeId: 'hot', nodeType: 'http', nodeLabel: 'Hot', timestamp: 2, state: 'pass', durationMs: 900 },
            ],
            finalVariables: {},
          },
        ],
        traversedEdges: ['e1'],
        workflowSnapshot: {
          nodes: [
            { id: 'cool', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Cool' } },
            { id: 'warm', type: 'http', position: { x: 0, y: 100 }, data: { label: 'Warm' } },
            { id: 'hot', type: 'http', position: { x: 0, y: 200 }, data: { label: 'Hot' } },
          ],
          edges: [
            { id: 'e1', source: 'cool', target: 'warm' },
            { id: 'e2', source: 'warm', target: 'hot' },
          ],
        },
      };
    }

    it('spans green and red heatmap tones across three divergent averages', () => {
      const trace = createWideHeatmapTrace();
      const { container } = render(<WorkflowExecutionCanvas trace={trace} />);
      const heatmaps = container.querySelectorAll('.replay-node-heatmap');
      expect(heatmaps.length).toBe(3);
      const greens = Array.from(heatmaps).map((n) => (n as HTMLElement).getAttribute('style') || '');
      const parseG = (s: string) => {
        const m = s.match(/rgb\(\d+, (\d+), \d+\)/);
        return m ? parseInt(m[1], 10) : 0;
      };
      expect(parseG(greens[0])).toBeGreaterThan(parseG(greens[1]));
      expect(parseG(greens[1])).toBeGreaterThan(parseG(greens[2]));
    });
  });
});
