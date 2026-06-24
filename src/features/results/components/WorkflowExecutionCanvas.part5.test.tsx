/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import * as XyflowReact from '@xyflow/react';
import WorkflowExecutionCanvas, {
  type _CanvasScreenshotFn,
  type _CanvasSvgFn,
} from './WorkflowExecutionCanvas';
import {
  createMockTrace,
} from './__test-utils__/workflowExecutionCanvasTestHelpers';
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
vi.mock('@xyflow/react', async () => {
  const helpers = await import('./__test-utils__/workflowExecutionCanvasTestHelpers');
  return {
    ReactFlow: vi.fn(helpers.buildMockReactFlowRenderer(flowApi)),
    Background: helpers.MockBackground,
    Controls: helpers.MockControls,
    MiniMap: helpers.MockMiniMap,
    MarkerType: helpers.xyflowMockStaticExports.MarkerType,
    Position: helpers.xyflowMockStaticExports.Position,
    useReactFlow: () => flowApi,
    useViewport: () => ({ x: viewportState.x, y: viewportState.y, zoom: viewportState.zoom }),
    applyNodeChanges: applyNodeChangesStub,
  };
});

// Mock workflow node types
vi.mock('../../workflow/utils/workflowNodeFactory', () => ({
  nodeTypes: {},
}));





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
    const { getByTestId, queryByTestId, container } = render(<WorkflowExecutionCanvas trace={trace} />);

    expect(getByTestId('react-flow')).toBeInTheDocument();
    expect(getByTestId('background')).toBeInTheDocument();
    // Check for custom controls (wf-pill-controls class)
    expect(container.querySelector('.wf-pill-controls')).toBeInTheDocument();
    expect(queryByTestId('minimap')).not.toBeInTheDocument();
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
