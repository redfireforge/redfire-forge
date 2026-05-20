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

function _createEmptyWorkflowTrace(): WorkflowExecutionTrace {
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

});
