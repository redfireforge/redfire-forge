/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
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

function _createBranchingTrace(): WorkflowExecutionTrace {
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

    it('clears the save-flash highlight 1.2s after clicking save', async () => {
      vi.useFakeTimers();
      try {
        const trace = createMockTrace();
        const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
        const btn = getByTestId('save-layout-btn') as HTMLButtonElement;
        fireEvent.click(btn);
        expect(btn.className).toContain('save-flash');
        await act(async () => {
          vi.advanceTimersByTime(1300);
        });
        expect(btn.className).not.toContain('save-flash');
      } finally {
        vi.useRealTimers();
      }
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

});
