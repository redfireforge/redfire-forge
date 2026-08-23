/**
 * Shared test helpers for WorkflowResultsExplorerModal test splits.
 *
 * Notes on Vitest hoisting:
 * - `vi.mock(...)` is hoisted only inside the file it's written in, so each
 *   test file still declares its own `vi.mock(...)` calls.
 * - `vi.hoisted(...)` refs cannot be re-used across files, so each file owns
 *   its own canvas/bottleneck refs via the factories below.
 * - The component factories here are PURE: they return mock components that
 *   accept hoisted-ref containers passed in from the test file.
 */
import React from 'react';
import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { WorkflowExecutionTrace } from '@shared/types';
import type { BottleneckInsight } from '../../utils/bottleneckAnalysis';
import type { MappingTrace } from '@shared/components/data-mapper/utils/mappingTrace';
import type { ForkJoinTopology } from '../../utils/forkJoinDetection';

// ─── Ref containers passed in by individual test files ─────────────────

export interface CanvasTraceRef {
  current: WorkflowExecutionTrace | null;
}

export interface BottleneckCallbackRef {
  current: ((insights: BottleneckInsight[]) => void) | null;
}

// ─── Canonical mock trace fixture ──────────────────────────────────────

// Mirrors the legacy shape from the original test file (pre-split). Uses
// `as unknown as WorkflowExecutionTrace` because the legacy fixture includes
// an `'end'` nodeType that is no longer in the strict union — production
// code under test still handles it for backwards compat, so the tests must
// continue to exercise that branch.
export const mockTrace = {
  workflowId: 'wf-1',
  workflowName: 'Test Workflow',
  workflowSnapshot: {
    nodes: [
      { id: 'n-name', type: 'http', position: { x: 40, y: 0 }, data: { name: 'NameOnly' } },
      { id: 'bare', type: 'http', position: { x: 35, y: 0 }, data: {} },
      { id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      { id: 'n2', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Get Users' } },
      { id: 'n3', type: 'http', position: { x: 200, y: 0 }, data: { label: 'Create Order' } },
      { id: 'n4', type: 'end', position: { x: 300, y: 0 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
  iterations: [
    {
      index: 0,
      passed: true,
      durationMs: 250,
      traversedEdges: ['e1', 'e2', 'e3'],
      events: [
        { nodeId: 'n1', nodeType: 'start', nodeLabel: 'Start', timestamp: 1000, state: 'pass' },
        { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 1100, state: 'pass', durationMs: 120, details: { statusCode: 200, method: 'GET', url: '/api/users' } },
        { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Create Order', timestamp: 1220, state: 'pass', durationMs: 80, details: { statusCode: 201, method: 'POST', url: '/api/orders' } },
        { nodeId: 'n4', nodeType: 'end', nodeLabel: 'End', timestamp: 1300, state: 'pass' },
      ],
    },
    {
      index: 1,
      passed: false,
      durationMs: 300,
      traversedEdges: ['e1', 'e2'],
      events: [
        { nodeId: 'n1', nodeType: 'start', nodeLabel: 'Start', timestamp: 2000, state: 'pass' },
        { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 2100, state: 'pass', durationMs: 150, details: { statusCode: 200, method: 'GET', url: '/api/users' } },
        { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Create Order', timestamp: 2250, state: 'fail', durationMs: 50, details: { statusCode: 500, method: 'POST', url: '/api/orders', error: 'Server Error' } },
      ],
    },
  ],
  traversedEdges: ['e1', 'e2', 'e3'],
  totalIterations: 2,
  totalDurationMs: 550,
  fullTraceCaptured: false,
} as unknown as WorkflowExecutionTrace;

// ─── Mock component factories ──────────────────────────────────────────

export function makeMockConsolePanel() {
  return ({
    captureLevel,
    iteration,
    onNodeSelect,
    onClose,
  }: {
    captureLevel?: string;
    iteration?: unknown;
    onNodeSelect?: (id: string) => void;
    onClose?: () => void;
  }) => (
    <div
      data-testid="mock-console-panel"
      data-capture-level={captureLevel ?? ''}
      data-has-iteration={iteration != null ? '1' : '0'}
    >
      <button type="button" data-testid="mock-console-select-node" onClick={() => onNodeSelect?.('n2')}>
        Console pick n2
      </button>
      <button type="button" data-testid="mock-console-close" onClick={() => onClose?.()}>
        Close console
      </button>
    </div>
  );
}

export interface CanvasMockHandles {
  mockCaptureScreenshot: () => Promise<string>;
  mockCaptureSvg: () => Promise<string>;
}

export function makeMockCanvas(
  canvasTraceRef: CanvasTraceRef,
  bottleneckCallbackRef: BottleneckCallbackRef,
  handles: CanvasMockHandles,
) {
  return function MockCanvas(props: {
    trace: WorkflowExecutionTrace;
    fitViewTrigger?: number;
    onNodeClick?: (nodeId: string) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
    onToggleMinimap?: () => void;
    onBottlenecksComputed?: (insights: BottleneckInsight[]) => void;
    onScreenshotReady?: (fn: () => Promise<string>) => void;
    onSvgReady?: (fn: () => Promise<string>) => void;
    onForkJoinDetected?: (topology: ForkJoinTopology) => void;
  }) {
    const { trace, onBottlenecksComputed, onForkJoinDetected } = props;
    React.useEffect(() => {
      canvasTraceRef.current = trace;
      bottleneckCallbackRef.current = onBottlenecksComputed || null;
    }, [trace, onBottlenecksComputed]);

    React.useEffect(() => {
      onForkJoinDetected?.({
        pairs: [],
        assignments: new Map([['sub1', { forkId: 'f1', joinId: 'j1', branchIndex: 0 }]]),
      });
    }, [onForkJoinDetected]);

    if (props.onScreenshotReady) {
      props.onScreenshotReady(handles.mockCaptureScreenshot);
    }
    if (props.onSvgReady) {
      props.onSvgReady(handles.mockCaptureSvg);
    }

    return (
      <div data-testid="mock-wf-canvas">
        <span data-testid="canvas-fit-trigger">{props.fitViewTrigger}</span>
        <button type="button" data-testid="canvas-pick-sub1" onClick={() => props.onNodeClick?.('sub1')}>
          Pick sub workflow
        </button>
        <button type="button" data-testid="canvas-pick-n-name" onClick={() => props.onNodeClick?.('n-name')}>
          Pick named node
        </button>
        <button type="button" data-testid="canvas-pick-bare" onClick={() => props.onNodeClick?.('bare')}>
          Pick bare node
        </button>
        <button type="button" data-testid="canvas-pick-n2" onClick={() => props.onNodeClick?.('n2')}>
          Pick n2
        </button>
        <button type="button" data-testid="canvas-pick-missing" onClick={() => props.onNodeClick?.('ghost-node')}>
          Pick missing node
        </button>
        <button type="button" data-testid="canvas-pick-empty" onClick={() => props.onNodeClick?.('')}>
          Pick empty id
        </button>
        <button type="button" data-testid="canvas-toggle-minimap" onClick={() => props.onToggleMinimap?.()}>
          Toggle minimap
        </button>
        <button type="button" data-testid="canvas-dbl-sub1" onClick={() => props.onNodeDoubleClick?.('sub1')}>
          Dbl-click sub workflow
        </button>
        <button type="button" data-testid="canvas-dbl-n2" onClick={() => props.onNodeDoubleClick?.('n2')}>
          Dbl-click http node
        </button>
        <button type="button" data-testid="canvas-dbl-empty" onClick={() => props.onNodeDoubleClick?.('')}>
          Dbl-click empty id
        </button>
      </div>
    );
  };
}

export function makeMockDetailPanel() {
  return ({
    onClose,
    onIterationChange,
    nodeLabel,
    events,
    onDrillDown,
    nodeId,
    onOpenMapper,
  }: {
    onClose?: () => void;
    onIterationChange?: (i: number) => void;
    nodeLabel?: string;
    events?: Array<{ details?: { subWorkflowTrace?: WorkflowExecutionTrace } }>;
    onDrillDown?: (childTrace: WorkflowExecutionTrace, parentNodeId: string) => void;
    nodeId?: string;
    onOpenMapper?: (traces: MappingTrace[], nodeLabel: string) => void;
  }) => (
    <div data-testid="mock-detail-panel">
      <span data-testid="detail-node-label">{nodeLabel}</span>
      <span data-testid="detail-events-count" data-count={events?.length ?? 0} />
      <button type="button" data-testid="detail-close" onClick={() => onClose?.()}>
        Close detail
      </button>
      <button type="button" data-testid="detail-iter-one" onClick={() => onIterationChange?.(1)}>
        Detail iter 1
      </button>
      {onDrillDown && events?.[0]?.details?.subWorkflowTrace && (
        <button
          type="button"
          data-testid="mock-drilldown-btn"
          onClick={() => onDrillDown(events[0].details!.subWorkflowTrace!, nodeId || '')}
        >
          Drill Down
        </button>
      )}
      {onOpenMapper && (
        <button
          type="button"
          data-testid="mock-open-mapper-btn"
          onClick={() => onOpenMapper(
            [{
              mappingId: 'm1',
              sourcePath: 'a.b',
              sourceId: 's1',
              sourceValue: 'src-val',
              evaluatedValue: 'val',
              targetPath: 'x.y',
              targetValue: 'val',
              timestamp: 0,
              durationMs: 1.5,
            }],
            nodeLabel || 'Test Node',
          )}
        >
          Open in Mapper
        </button>
      )}
    </div>
  );
}

export function makeMockIterationMatrix() {
  return ({
    onIterationSelect,
    onCellSelect,
  }: {
    onIterationSelect?: (index: number) => void;
    onCellSelect?: (iterationIndex: number, nodeId: string) => void;
  }) => (
    <div data-testid="mock-iteration-matrix">
      <button type="button" data-testid="matrix-select-iter-0" onClick={() => onIterationSelect?.(0)}>
        Matrix iter 0
      </button>
      <button type="button" data-testid="matrix-cell-select" onClick={() => onCellSelect?.(1, 'n3')}>
        Matrix cell
      </button>
    </div>
  );
}

// ─── Mock fn factories ─────────────────────────────────────────────────

export function createCaptureHandles(): CanvasMockHandles {
  return {
    mockCaptureScreenshot: vi.fn(() => Promise.resolve('data:image/png;base64,mockdata')),
    mockCaptureSvg: vi.fn(() => Promise.resolve('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E')),
  };
}

export interface FileSaverMocks {
  mockSaveJsonFile: ReturnType<typeof vi.fn>;
  mockSaveCsvFile: ReturnType<typeof vi.fn>;
  mockSavePngFile: ReturnType<typeof vi.fn>;
  mockSaveSvgFile: ReturnType<typeof vi.fn>;
  mockBuildExportFilename: ReturnType<typeof vi.fn>;
}

export function createFileSaverMocks(): FileSaverMocks {
  return {
    mockSaveJsonFile: vi.fn(),
    mockSaveCsvFile: vi.fn(),
    mockSavePngFile: vi.fn(),
    mockSaveSvgFile: vi.fn(),
    mockBuildExportFilename: vi.fn(({ level, name, ext }: { level: string; name?: string; ext?: string }) =>
      `${level}-${name || 'unknown'}.${ext || 'json'}`,
    ),
  };
}

// ─── Test helpers ──────────────────────────────────────────────────────

export function openExportMenu(): void {
  fireEvent.click(screen.getByTestId('export-dropdown-trigger'));
}
