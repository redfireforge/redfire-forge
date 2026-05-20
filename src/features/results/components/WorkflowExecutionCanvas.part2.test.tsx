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
  type _CanvasScreenshotFn,
  type _CanvasSvgFn,
} from './WorkflowExecutionCanvas';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { captureCanvasScreenshot, captureCanvasSvg } from '../utils/canvasScreenshot';

const _mockedCaptureScreenshot = vi.mocked(captureCanvasScreenshot);
const _mockedCaptureSvg = vi.mocked(captureCanvasSvg);

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

function _getLastReactFlowProps(): Record<string, unknown> {
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

});
