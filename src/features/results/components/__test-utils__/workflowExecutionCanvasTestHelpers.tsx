/* eslint-disable react-refresh/only-export-components -- test helper file
   intentionally exports both fixture utilities and JSX render helpers. */
/**
 * Shared test helpers for WorkflowExecutionCanvas test splits.
 *
 * The vi.hoisted state (viewportState, flowApi, applyNodeChangesStub) and
 * vi.mock calls must remain per-file due to Vitest's per-file hoisting.
 * Everything that is pure data or a pure render helper lives here.
 *
 * IMPORTANT: This module must NOT import `../WorkflowExecutionCanvas`. The
 * tests dynamically import this module inside `vi.mock('@xyflow/react', ...)`
 * factories. WorkflowExecutionCanvas itself imports `@xyflow/react`, so any
 * such transitive import would cause a circular mock-resolution hang.
 */
import type { JSX, ReactNode, MouseEvent } from 'react';
import { useEffect, useRef } from 'react';
import { expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import type * as XyflowReact from '@xyflow/react';
import type { Edge, Node, NodeChange, ReactFlowInstance } from '@xyflow/react';
import type { WorkflowExecutionTrace } from '../../../../shared/types';

// ─── Mock @xyflow/react render builders ──────────────────────────────

export interface CanvasFlowApi {
  zoomIn: Mock;
  zoomOut: Mock;
  fitView: Mock;
  setViewport?: Mock;
  getNodes?: Mock;
}

export interface MockReactFlowProps {
  nodes?: Node[];
  edges?: Edge[];
  children?: ReactNode;
  onInit?: (instance: ReactFlowInstance<Node, Edge>) => void;
  onNodeClick?: (event: MouseEvent, node: Node) => void;
  onPaneClick?: () => void;
  onNodesChange?: (changes: NodeChange[]) => void;
  onNodeMouseEnter?: (event: MouseEvent, node: Node) => void;
  onNodeMouseLeave?: (event: MouseEvent, node: Node) => void;
}

/** Build the mock `ReactFlow` render function that closes over `flowApi`. */
export function buildMockReactFlowRenderer(flowApi: CanvasFlowApi) {
  return function MockReactFlow({
    nodes,
    edges,
    children,
    onInit,
    onNodeClick,
    onPaneClick,
    onNodesChange,
    onNodeMouseEnter,
    onNodeMouseLeave,
  }: MockReactFlowProps): JSX.Element {
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    const onInitRef = useRef(onInit);
    onInitRef.current = onInit;
    const didInitRef = useRef(false);

    useEffect(() => {
      if (didInitRef.current) return;
      didInitRef.current = true;
      const instance = {
        fitView: flowApi.fitView,
        setViewport: flowApi.setViewport ?? vi.fn(),
        getNodes: flowApi.getNodes ?? (() => nodesRef.current ?? []),
      } as unknown as ReactFlowInstance<Node, Edge>;
      onInitRef.current?.(instance);
    }, []);
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
        <button
          type="button"
          data-testid="trigger-nodes-change"
          onClick={() =>
            onNodesChange?.([{ type: 'position', id: 'n1', position: { x: 99, y: 88 } }])
          }
        >
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
  };
}

export function MockBackground(): JSX.Element {
  return <div data-testid="background" />;
}

export function MockControls(): JSX.Element {
  return <div data-testid="controls" />;
}

export function MockMiniMap({
  nodeColor,
}: {
  nodeColor?: (node: { id: string }) => string;
}): JSX.Element {
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
}

export function MockPanel({ children }: { children?: ReactNode }): JSX.Element {
  return <div data-testid="react-flow-panel">{children}</div>;
}

/** Default applyNodeChanges stub used by the mock factory. */
export function applyNodeChangesImpl(
  changes: NodeChange[],
  nodes: Node[],
): Node[] {
  let next = [...nodes];
  for (const c of changes) {
    if (c.type === 'position' && c.id && 'position' in c && c.position) {
      const newPos = { x: c.position.x ?? 0, y: c.position.y ?? 0 };
      next = next.map((n) =>
        n.id === c.id
          ? { ...n, position: newPos, positionAbsolute: undefined }
          : n,
      );
    }
    if (c.type === 'dimensions' && c.id) {
      next = next.map((n) =>
        n.id === c.id
          ? {
              ...n,
              measured: 'dimensions' in c && c.dimensions ? c.dimensions : n.measured,
            }
          : n,
      );
    }
    if (c.type === 'add' && 'item' in c && c.item) {
      next = [...next, c.item];
    }
  }
  return next;
}

export const xyflowMockStaticExports = {
  MarkerType: {
    Arrow: 'arrow',
    ArrowClosed: 'arrowclosed',
  },
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
} as const;

/** Minimal bounds helper for replayCanvasFitView in unit tests. */
export function mockGetNodesBounds(nodes: { width?: number; height?: number }[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: 0, y: 0, width: 220, height: 80 };
}

// ─── Trace fixture factories ─────────────────────────────────────────

export function createMockTrace(options?: {
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
  } as WorkflowExecutionTrace;
}

export function createEmptyWorkflowTrace(): WorkflowExecutionTrace {
  return {
    workflowId: 'wf-empty',
    workflowName: 'Empty',
    totalIterations: 0,
    totalDurationMs: 0,
    iterations: [],
    traversedEdges: [],
    workflowSnapshot: { nodes: [], edges: [] },
  } as WorkflowExecutionTrace;
}

export function createBranchingTrace(): WorkflowExecutionTrace {
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
  } as WorkflowExecutionTrace;
}

// ─── Misc test helpers ───────────────────────────────────────────────

/** Return the most recent props that were passed to the mocked ReactFlow component. */
export function getLastReactFlowProps(
  XyflowReactModule: typeof XyflowReact,
): Record<string, unknown> {
  const rf = vi.mocked(XyflowReactModule.ReactFlow);
  expect(rf.mock.calls.length).toBeGreaterThan(0);
  return rf.mock.calls[rf.mock.calls.length - 1][0] as Record<string, unknown>;
}
