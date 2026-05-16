/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { Edge, Node } from '@xyflow/react';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import type { BottleneckInsight } from '../utils/bottleneckAnalysis';

// Mock ResizeObserver for jsdom (needed by ReactFlow)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock ReactFlow to avoid complexity
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-flow-provider">{children}</div>,
  ReactFlow: () => <div data-testid="mock-reactflow" />,
  Controls: () => <div data-testid="mock-controls" />,
  MiniMap: () => <div data-testid="mock-minimap" />,
  Background: () => <div data-testid="mock-background" />,
  useReactFlow: () => ({ fitView: vi.fn(), getViewport: () => ({ x: 0, y: 0, zoom: 1 }) }),
  useNodesState: (initial: Node[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: Edge[]) => [initial, vi.fn()],
  MarkerType: { ArrowClosed: 'arrowclosed' },
}));

const lastCanvasTraceRef = vi.hoisted<{ current: WorkflowExecutionTrace | null }>(() => ({ current: null }));
const lastBottleneckCallbackRef = vi.hoisted<{
  current: ((insights: BottleneckInsight[]) => void) | null;
}>(() => ({ current: null }));

const mockCaptureScreenshot = vi.fn(() => Promise.resolve('data:image/png;base64,mockdata'));
const mockCaptureSvg = vi.fn(() => Promise.resolve('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E'));

vi.mock('./ResultsExplorerConsolePanel', () => ({
  default: ({
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
  ),
}));

vi.mock('./WorkflowExecutionCanvas', async () => {
  const React = await import('react');
  function MockCanvas(props: {
      trace: import('../../../shared/types').WorkflowExecutionTrace;
      fitViewTrigger?: number;
      onNodeClick?: (nodeId: string) => void;
      onNodeDoubleClick?: (nodeId: string) => void;
      onToggleMinimap?: () => void;
      onBottlenecksComputed?: (insights: import('../utils/bottleneckAnalysis').BottleneckInsight[]) => void;
      onScreenshotReady?: (fn: () => Promise<string>) => void;
      onSvgReady?: (fn: () => Promise<string>) => void;
      onForkJoinDetected?: (topology: import('../utils/forkJoinDetection').ForkJoinTopology) => void;
    }) {
      const { trace, onBottlenecksComputed, onForkJoinDetected } = props;
      React.useEffect(() => {
        lastCanvasTraceRef.current = trace;
        lastBottleneckCallbackRef.current = onBottlenecksComputed || null;
      }, [trace, onBottlenecksComputed]);

      React.useEffect(() => {
        onForkJoinDetected?.({
          pairs: [],
          assignments: new Map([['sub1', { forkId: 'f1', joinId: 'j1', branchIndex: 0 }]]),
        });
      }, [onForkJoinDetected]);

      if (props.onScreenshotReady) {
        props.onScreenshotReady(mockCaptureScreenshot);
      }
      if (props.onSvgReady) {
        props.onSvgReady(mockCaptureSvg);
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
    }
  return { default: MockCanvas };
});

vi.mock('./ResultsExplorerDetailPanel', () => ({
  default: ({
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
    events?: Array<{ details?: { subWorkflowTrace?: import('../../../shared/types').WorkflowExecutionTrace } }>;
    onDrillDown?: (childTrace: import('../../../shared/types').WorkflowExecutionTrace, parentNodeId: string) => void;
    nodeId?: string;
    onOpenMapper?: (traces: import('../../../shared/components/data-mapper/utils/mappingTrace').MappingTrace[], nodeLabel: string) => void;
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
            [{ mappingId: 'm1', sourcePath: 'a.b', sourceId: 's1', targetPath: 'x.y', targetValue: 'val', durationMs: 1.5 }],
            nodeLabel || 'Test Node',
          )}
        >
          Open in Mapper
        </button>
      )}
    </div>
  ),
}));

vi.mock('./IterationMatrixTable', () => ({
  default: ({
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
  ),
}));

const mockSaveJsonFile = vi.fn();
const mockSaveCsvFile = vi.fn();
const mockSavePngFile = vi.fn();
const mockSaveSvgFile = vi.fn();
const mockBuildExportFilename = vi.fn(({ level, name, ext }: { level: string; name?: string; ext?: string }) =>
  `${level}-${name || 'unknown'}.${ext || 'json'}`,
);

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveJsonFile: (...args: unknown[]) => mockSaveJsonFile(...args),
  saveCsvFile: (...args: unknown[]) => mockSaveCsvFile(...args),
  savePngFile: (...args: unknown[]) => mockSavePngFile(...args),
  saveSvgFile: (...args: unknown[]) => mockSaveSvgFile(...args),
  buildExportFilename: (...args: unknown[]) => mockBuildExportFilename(...args),
}));

import WorkflowResultsExplorerModal from './WorkflowResultsExplorerModal';

const mockTrace: WorkflowExecutionTrace = {
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
};

describe('WorkflowResultsExplorerModal', () => {
  const mockOnClose = vi.fn();

  /** Open the export dropdown so menu items become visible */
  function openExportMenu() {
    fireEvent.click(screen.getByTestId('export-dropdown-trigger'));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders modal with workflow name', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.getAllByText('Test Workflow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Results Explorer')).toBeInTheDocument();
  });

  it('shows pass rate in header', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.getByText('50% pass')).toBeInTheDocument();
  });

  it('displays total iterations count', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    // The text appears multiple times (header + matrix), use getAllBy
    expect(screen.getAllByText('2 iterations').length).toBeGreaterThan(0);
  });

  it('shows empty state when no node is selected', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.getByText('Select a Node')).toBeInTheDocument();
    expect(screen.getByText('Click on a node in the diagram to view its execution details')).toBeInTheDocument();
  });

  it('displays summary stats in empty state', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.getByText('Iterations')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Avg Duration')).toBeInTheDocument();
  });

  it('shows iteration matrix when more than 1 iteration', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.getByText('Iteration Matrix')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });

  it('hides iteration matrix for single iteration traces', () => {
    const singleIterTrace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [mockTrace.iterations[0]],
      totalIterations: 1,
    };
    render(<WorkflowResultsExplorerModal trace={singleIterTrace} onClose={mockOnClose} />);
    expect(screen.queryByText('Iteration Matrix')).not.toBeInTheDocument();
  });

  it('shows keyboard shortcuts in footer', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.getByText(/← → iterate/)).toBeInTheDocument();
    expect(screen.getByText(/A all/)).toBeInTheDocument();
    expect(screen.getByText(/M matrix/)).toBeInTheDocument();
  });

  it('displays Full Trace badge when fullTraceCaptured is true', () => {
    const traceWithFullCapture: WorkflowExecutionTrace = {
      ...mockTrace,
      fullTraceCaptured: true,
    };
    render(<WorkflowResultsExplorerModal trace={traceWithFullCapture} onClose={mockOnClose} />);
    expect(screen.getByText('Full Trace')).toBeInTheDocument();
  });

  it('shows 100% pass in header when all iterations passed', () => {
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [
        { ...mockTrace.iterations[0], passed: true },
        { ...mockTrace.iterations[1], passed: true },
      ],
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    expect(screen.getByText('100% pass')).toBeInTheDocument();
  });

  it('shows 0% pass in header when all iterations failed', () => {
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [
        { ...mockTrace.iterations[0], passed: false },
        { ...mockTrace.iterations[1], passed: false },
      ],
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    expect(screen.getByText('0% pass')).toBeInTheDocument();
  });

  it('uses singular iteration wording for single iteration traces', () => {
    const singleIterTrace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [mockTrace.iterations[0]],
      totalIterations: 1,
    };
    render(<WorkflowResultsExplorerModal trace={singleIterTrace} onClose={mockOnClose} />);
    expect(screen.getByText('1 iteration')).toBeInTheDocument();
    expect(screen.queryByText('1 iterations')).not.toBeInTheDocument();
  });

  it('shows pinned iteration footer for single iteration traces', () => {
    const singleIterTrace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [mockTrace.iterations[0]],
      totalIterations: 1,
    };
    render(<WorkflowResultsExplorerModal trace={singleIterTrace} onClose={mockOnClose} />);
    expect(screen.getByText(/Iteration #1 — Passed — 250ms/)).toBeInTheDocument();
    expect(screen.queryByText('Avg HTTP:')).not.toBeInTheDocument();
  });

  it('shows aggregate footer metrics while viewing every iteration', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.getByText('Avg HTTP:')).toBeInTheDocument();
    expect(screen.getByText('Avg Iteration:')).toBeInTheDocument();
    expect(screen.getByText('Total:')).toBeInTheDocument();
  });

  it('uses em dash footer when averages cannot be computed for HTTP durations', () => {
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: mockTrace.iterations.map(iter => ({
        ...iter,
        events: iter.events.filter(e => e.nodeType !== 'http'),
      })),
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    const label = screen.getByText('Avg HTTP:');
    expect(label.nextElementSibling?.textContent).toBe('—');
  });

  it('formats aggregate duration strings for totals and averages', () => {
    const httpEvent = (durationMs: number) => ({
      nodeId: 'n2',
      nodeType: 'http' as const,
      nodeLabel: 'Hop',
      timestamp: 1,
      state: 'pass' as const,
      durationMs,
    });
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      totalDurationMs: 5420,
      iterations: [
        { index: 0, passed: true, durationMs: 40, traversedEdges: [], events: [httpEvent(1500)] },
        { index: 1, passed: true, durationMs: 60, traversedEdges: [], events: [httpEvent(2800)] },
      ],
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    const summary = screen.getByText('Avg HTTP:').closest('.results-explorer-footer-info');
    expect(summary?.textContent).toContain('2.15s');
    expect(summary?.textContent).toContain('50ms');
    expect(summary?.textContent).toContain('5.42s');
  });

  it('renders pinned iteration durations with thresholds', () => {
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [
        {
          index: 0,
          passed: true,
          durationMs: 0.3,
          traversedEdges: [],
          events: [{ nodeId: 'n1', nodeType: 'start' as const, nodeLabel: 'S', timestamp: 1, state: 'pass' }],
        },
        mockTrace.iterations[1],
      ],
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Iteration #1 — Passed — <1ms/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Iteration #2 — Failed — 300ms/)).toBeInTheDocument();
  });

  it('shows failed label when pinning a failed iteration', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Iteration #2 — Failed — 300ms/)).toBeInTheDocument();
  });

  it('pins iteration via ArrowRight keyboard navigation', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
  });

  it('pins last iteration via ArrowLeft when viewing all iterations', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Iteration #2/)).toBeInTheDocument();
  });

  it('keeps pinned first iteration after extra ArrowLeft presses', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
  });

  it('does not advance past final iteration via ArrowRight', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Iteration #2/)).toBeInTheDocument();
  });

  it('keyboard A returns to aggregated iteration view', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(screen.getByText('Avg HTTP:')).toBeInTheDocument();
  });

  it('does not trigger all-iteration reset when Ctrl+A is pressed', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(screen.queryByText('Avg HTTP:')).not.toBeInTheDocument();
  });

  it('does not trigger all-iteration reset when Cmd+A is pressed', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'a', metaKey: true });
    expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
    expect(screen.queryByText('Avg HTTP:')).not.toBeInTheDocument();
  });

  it('closes detail selection before closing modal via Escape', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-pick-n2'));
    expect(screen.getByTestId('mock-detail-panel')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('keyboard M toggles matrix expansion twice', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(screen.queryByTestId('mock-iteration-matrix')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'm' });
    expect(screen.getByTestId('mock-iteration-matrix')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'M' });
    expect(screen.queryByTestId('mock-iteration-matrix')).not.toBeInTheDocument();
  });

  it('advances canvas fit helper after collapsing the matrix controls', () => {
    vi.useFakeTimers();
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    const before = screen.getByTestId('canvas-fit-trigger').textContent;
    act(() => {
      fireEvent.click(screen.getByText('Iteration Matrix'));
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('canvas-fit-trigger').textContent).not.toBe(before);
    vi.useRealTimers();
  });

  it('restores empty detail state after closing the detail drawer', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-pick-n2'));
    expect(screen.getByTestId('mock-detail-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('detail-close'));
    expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
    expect(screen.getByText('Select a Node')).toBeInTheDocument();
  });

  it('ignores invalid node selections gracefully', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-pick-missing'));
    expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('canvas-pick-empty'));
    expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
  });

  it('prefers data.name fallback when labeling nodes', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-pick-n-name'));
    expect(screen.getByTestId('detail-node-label')).toHaveTextContent('NameOnly');
  });

  it('falls back to node id when labels are missing', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-pick-bare'));
    expect(screen.getByTestId('detail-node-label')).toHaveTextContent('bare');
  });

  it('renders em dash when pinned iteration duration is null', () => {
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [
        { ...mockTrace.iterations[0], durationMs: null as unknown as number },
        mockTrace.iterations[1],
      ],
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Iteration #1 — Passed — —/)).toBeInTheDocument();
  });

  it('pins iteration and selection from iteration matrix callbacks', async () => {
    const user = userEvent.setup();
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    await user.keyboard('m');
    fireEvent.click(screen.getByTestId('matrix-cell-select'));
    expect(screen.getByTestId('mock-detail-panel')).toBeInTheDocument();
    expect(screen.getByText(/Iteration #2/)).toBeInTheDocument();
  });

  it('selects pinned iteration rows from iteration matrix callbacks', async () => {
    const user = userEvent.setup();
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    await user.keyboard('m');
    fireEvent.click(screen.getByTestId('matrix-select-iter-0'));
    expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
  });

  it('scopes canvas trace props to the selected iteration', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    expect(lastCanvasTraceRef.current?.totalIterations).toBe(2);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(lastCanvasTraceRef.current?.totalIterations).toBe(1);
    expect(lastCanvasTraceRef.current?.iterations?.length).toBe(1);
  });

  it('hides failed badge summary when nothing failed', () => {
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [
        { ...mockTrace.iterations[0], passed: true },
        { ...mockTrace.iterations[1], passed: true },
      ],
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    expect(screen.queryByText(/^\d+\s+failed$/)).not.toBeInTheDocument();
  });

  it('responds to iteration changes from detail panel callbacks', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-pick-n2'));
    fireEvent.click(screen.getByTestId('detail-iter-one'));
    expect(screen.getByText(/Iteration #2/)).toBeInTheDocument();
  });

  it('passes flattened events across every iteration unless pinned', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-pick-n2'));
    expect(screen.getByTestId('detail-events-count')).toHaveAttribute('data-count', '2');
  });

  it('scopes detail events while an iteration stays pinned', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.click(screen.getByTestId('canvas-pick-n2'));
    expect(screen.getByTestId('detail-events-count')).toHaveAttribute('data-count', '1');
  });

  it('handles minimap toggling without crashing', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('canvas-toggle-minimap'));
    fireEvent.click(screen.getByTestId('canvas-toggle-minimap'));
    expect(screen.getByTestId('mock-wf-canvas')).toBeInTheDocument();
  });

  it('ignores arrow iteration shortcuts when only one iteration exists', () => {
    const trace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [mockTrace.iterations[0]],
      totalIterations: 1,
    };
    render(<WorkflowResultsExplorerModal trace={trace} onClose={mockOnClose} />);
    const before = screen.getByText(/Iteration #1/).textContent;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Iteration #1/).textContent).toBe(before);
  });

  it('closes from footer Close control', () => {
    render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
    const closeButtons = screen.getAllByRole('button', { name: /^Close$/i });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  describe('export dropdown', () => {
    it('renders the export dropdown trigger', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByTestId('export-dropdown-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('export-dropdown-trigger')).toHaveTextContent('Export');
    });

    it('opens menu on trigger click', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.queryByTestId('export-dropdown-menu')).not.toBeInTheDocument();
      openExportMenu();
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();
    });

    it('closes menu on second trigger click', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('export-dropdown-trigger'));
      expect(screen.queryByTestId('export-dropdown-menu')).not.toBeInTheDocument();
    });

    it('hides dropdown for imported traces', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} importedFileName="test.json" />);
      expect(screen.queryByTestId('export-dropdown-trigger')).not.toBeInTheDocument();
    });
  });

  describe('export trace as JSON', () => {
    it('renders the export JSON item in dropdown', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-trace-btn')).toBeInTheDocument();
    });

    it('calls saveJsonFile with trace data when clicked', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-trace-btn'));
      expect(mockSaveJsonFile).toHaveBeenCalledTimes(1);
      expect(mockSaveJsonFile).toHaveBeenCalledWith(mockTrace, expect.any(String));
    });

    it('builds filename with workflow name and level "trace"', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-trace-btn'));
      expect(mockBuildExportFilename).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'trace',
          name: 'Test Workflow',
        }),
      );
    });

    it('uses the generated filename for saveJsonFile', () => {
      mockBuildExportFilename.mockReturnValueOnce('trace-my-workflow.json');
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-trace-btn'));
      expect(mockSaveJsonFile).toHaveBeenCalledWith(mockTrace, 'trace-my-workflow.json');
    });

    it('closes dropdown after clicking export JSON', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-trace-btn'));
      expect(screen.queryByTestId('export-dropdown-menu')).not.toBeInTheDocument();
    });
  });

  describe('imported trace', () => {
    it('shows imported badge with filename when importedFileName is set', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} importedFileName="my-trace.json" />);
      const badge = screen.getByTestId('imported-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain('my-trace.json');
    });

    it('hides export dropdown when importedFileName is set', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} importedFileName="my-trace.json" />);
      expect(screen.queryByTestId('export-dropdown-trigger')).not.toBeInTheDocument();
    });

    it('shows export dropdown when importedFileName is not set', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByTestId('export-dropdown-trigger')).toBeInTheDocument();
      expect(screen.queryByTestId('imported-badge')).not.toBeInTheDocument();
    });
  });

  describe('keyboard shortcut: Space toggles aggregate', () => {
    it('toggles from aggregate to iteration 0 on Space', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      // Initially aggregate — footer shows Avg HTTP
      expect(screen.getByText(/Avg HTTP/)).toBeInTheDocument();

      act(() => { fireEvent.keyDown(window, { key: ' ' }); });
      // Should now show iteration #1
      expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
    });

    it('toggles back from iteration to aggregate on second Space', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: ' ' }); });
      expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();

      act(() => { fireEvent.keyDown(window, { key: ' ' }); });
      expect(screen.getByText(/Avg HTTP/)).toBeInTheDocument();
    });
  });

  describe('keyboard shortcut: number keys jump to iteration', () => {
    it('pressing 1 jumps to iteration #1', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      act(() => { fireEvent.keyDown(window, { key: '1' }); });
      expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
    });

    it('pressing 2 jumps to iteration #2', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      act(() => { fireEvent.keyDown(window, { key: '2' }); });
      expect(screen.getByText(/Iteration #2/)).toBeInTheDocument();
    });

    it('pressing a number beyond total iterations does nothing', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      act(() => { fireEvent.keyDown(window, { key: '9' }); });
      // Should remain in aggregate view
      expect(screen.getByText(/Avg HTTP/)).toBeInTheDocument();
    });
  });

  describe('export CSV', () => {
    it('renders the CSV export item in dropdown', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument();
    });

    it('calls saveCsvFile with CSV content on click', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      expect(mockSaveCsvFile).toHaveBeenCalledTimes(1);
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('Node');
      expect(csvContent).toContain('Pass Rate (%)');
      expect(csvContent).toContain('P95 (ms)');
    });

    it('includes HTTP node data in CSV', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('Get Users');
      expect(csvContent).toContain('Create Order');
    });

    it('builds filename with level "metrics" and ext "csv"', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      expect(mockBuildExportFilename).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'metrics', name: 'Test Workflow', ext: 'csv' }),
      );
    });

    it('hides CSV export when importedFileName is set', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} importedFileName="my-trace.json" />);
      expect(screen.queryByTestId('export-dropdown-trigger')).not.toBeInTheDocument();
    });

    it('closes export menu on mousedown outside', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('export-dropdown-menu')).not.toBeInTheDocument();
    });

    it('exports CSV rows with zero timing stats when durationMs omitted', () => {
      const traceNoDur: WorkflowExecutionTrace = {
        ...mockTrace,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 100,
            traversedEdges: [],
            events: [
              { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 1, state: 'pass', details: { statusCode: 200 } },
            ],
          },
        ],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={traceNoDur} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('Get Users');
      expect(csvContent).toContain('"0","0","0"');
    });

    it('CSV skips http nodes that never executed', () => {
      const traceOrphan: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          ...mockTrace.workflowSnapshot,
          nodes: [
            ...mockTrace.workflowSnapshot.nodes,
            { id: 'n-orphan', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Never Run' } },
          ],
        },
      };
      render(<WorkflowResultsExplorerModal trace={traceOrphan} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).not.toContain('Never Run');
    });

    it('keeps export menu open when mousedown occurs inside menu', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      const menu = screen.getByTestId('export-dropdown-menu');
      fireEvent.mouseDown(menu);
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();
    });

    it('CSV uses node data.name when label missing', () => {
      const traceName: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          nodes: [
            { id: 'nx', type: 'http', position: { x: 0, y: 0 }, data: { name: 'OnlyName' } },
          ],
          edges: [],
        },
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 50,
            traversedEdges: [],
            events: [
              { nodeId: 'nx', nodeType: 'http', nodeLabel: 'nx', timestamp: 1, state: 'pass', durationMs: 10 },
            ],
          },
        ],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={traceName} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('OnlyName');
    });

    it('CSV escapes quotes in node labels', () => {
      const traceQuoted: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          ...mockTrace.workflowSnapshot,
          nodes: mockTrace.workflowSnapshot.nodes.map(n =>
            n.id === 'n2' ? { ...n, data: { label: 'Try "quotes"' } } : n,
          ),
        },
      };
      render(<WorkflowResultsExplorerModal trace={traceQuoted} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('""');
    });
  });

  describe('footer shortcuts text', () => {
    it('includes new shortcuts in footer hint', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByText(/1-9 jump/)).toBeInTheDocument();
      expect(screen.getByText(/Space toggle/)).toBeInTheDocument();
    });
  });

  describe('iteration picker', () => {
    it('renders picker for multi-iteration traces', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('iter-picker-toggle')).toBeInTheDocument();
    });

    it('does not render picker for single-iteration traces', () => {
      const singleTrace: WorkflowExecutionTrace = {
        ...mockTrace,
        iterations: [mockTrace.iterations[0]],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={singleTrace} onClose={mockOnClose} />);
      expect(screen.queryByTestId('view-toggle')).not.toBeInTheDocument();
    });

    it('starts in aggregate mode', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByTestId('iter-picker-toggle').textContent).toMatch(/Aggregate/);
    });

    it('opens dropdown on toggle click', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('iter-picker-toggle'));
      expect(screen.getByTestId('iter-picker-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('iter-picker-aggregate')).toBeInTheDocument();
    });

    it('switches to single iteration when an iteration item is clicked', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('iter-picker-toggle'));
      fireEvent.click(screen.getByTestId('iter-picker-item-0'));
      expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
    });

    it('switches back to aggregate', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('iter-picker-toggle'));
      fireEvent.click(screen.getByTestId('iter-picker-item-0'));
      expect(screen.getByText(/Iteration #1/)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('iter-picker-toggle'));
      fireEvent.click(screen.getByTestId('iter-picker-aggregate'));
      expect(screen.getByTestId('iter-picker-toggle').textContent).toMatch(/Aggregate/);
    });

    it('selects a different iteration', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('iter-picker-toggle'));
      fireEvent.click(screen.getByTestId('iter-picker-item-1'));
      expect(screen.getByText(/Iteration #2/)).toBeInTheDocument();
    });
  });

  describe('sampled iterations', () => {
    const sampledTrace: WorkflowExecutionTrace = {
      ...mockTrace,
      iterations: [
        { ...mockTrace.iterations[0], sampled: true },
        { ...mockTrace.iterations[1], sampled: false },
      ],
    };

    it('shows sampled badge when some iterations are unsampled', () => {
      render(<WorkflowResultsExplorerModal trace={sampledTrace} onClose={mockOnClose} />);
      expect(screen.getByText(/Sampled/)).toBeInTheDocument();
      expect(screen.getByText(/1\/2/)).toBeInTheDocument();
    });

    it('falls back to full trace when pinned iteration is unsampled', () => {
      render(<WorkflowResultsExplorerModal trace={sampledTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(lastCanvasTraceRef.current.iterations.length).toBeGreaterThanOrEqual(1);
    });

    it('shows sampled run footer text for unsampled pinned iteration', () => {
      render(<WorkflowResultsExplorerModal trace={sampledTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByText(/Trace not captured \(sampled run\)/)).toBeInTheDocument();
    });
  });

  describe('search and filter', () => {
    it('renders search input', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByTestId('node-search-input')).toBeInTheDocument();
    });

    it('updates search query on input change', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const input = screen.getByTestId('node-search-input');
      fireEvent.change(input, { target: { value: 'Get' } });
      expect(input).toHaveValue('Get');
    });

    it('shows clear button when search query is non-empty', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.queryByTestId('node-search-clear')).not.toBeInTheDocument();
      fireEvent.change(screen.getByTestId('node-search-input'), { target: { value: 'test' } });
      expect(screen.getByTestId('node-search-clear')).toBeInTheDocument();
    });

    it('clears search on clear button click', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const input = screen.getByTestId('node-search-input');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByTestId('node-search-clear'));
      expect(input).toHaveValue('');
    });

    it('clears search on Escape inside input', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const input = screen.getByTestId('node-search-input');
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input).toHaveValue('');
    });

    it('toggles state filter buttons', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const passBtn = screen.getByTestId('node-filter-pass');
      fireEvent.click(passBtn);
      expect(passBtn).toHaveClass('active');
      fireEvent.click(passBtn);
      expect(passBtn).not.toHaveClass('active');
    });

    it('toggles between different state filters', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const failBtn = screen.getByTestId('node-filter-fail');
      const skipBtn = screen.getByTestId('node-filter-skipped');
      fireEvent.click(failBtn);
      expect(failBtn).toHaveClass('active');
      fireEvent.click(skipBtn);
      expect(skipBtn).toHaveClass('active');
      expect(failBtn).not.toHaveClass('active');
    });

    it('renders filter buttons with counts', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByTestId('node-filter-all')).toHaveTextContent('All');
      expect(screen.getByTestId('node-filter-pass')).toHaveTextContent(/Pass/);
      expect(screen.getByTestId('node-filter-fail')).toHaveTextContent(/Fail/);
      expect(screen.getByTestId('node-filter-skipped')).toHaveTextContent(/Skip/);
    });
  });

  describe('/ keyboard shortcut (focus search)', () => {
    it('focuses search input on / key press', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const input = screen.getByTestId('node-search-input');
      fireEvent.keyDown(window, { key: '/' });
      expect(document.activeElement).toBe(input);
    });

    it('ignores / when Ctrl or Meta is held', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const input = screen.getByTestId('node-search-input');
      fireEvent.keyDown(window, { key: '/', ctrlKey: true });
      expect(document.activeElement).not.toBe(input);
    });

    it('ignores / when an INPUT is already focused', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const input = screen.getByTestId('node-search-input');
      input.focus();
      const initialFocus = document.activeElement;
      fireEvent.keyDown(window, { key: '/' });
      expect(document.activeElement).toBe(initialFocus);
    });
  });

  describe('bottleneck insights', () => {
    it('renders bottleneck panel when insights are provided via canvas callback', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const insights = [
        {
          nodeId: 'n2',
          nodeLabel: 'Get Users',
          severity: 'critical' as const,
          type: 'time-dominant' as const,
          message: 'Takes most time',
          suggestion: 'Optimize this node',
          metric: { label: 'Time %', value: '65%' },
        },
        {
          nodeId: 'n3',
          nodeLabel: 'Create Order',
          severity: 'warning' as const,
          type: 'high-variance' as const,
          message: 'High variance',
          suggestion: 'Investigate variance',
          metric: { label: 'CV', value: '0.8' },
        },
      ];
      act(() => { lastBottleneckCallbackRef.current?.(insights); });
      expect(screen.getByTestId('bottleneck-insights')).toBeInTheDocument();
      expect(screen.getByTestId('bottleneck-insight-0')).toBeInTheDocument();
      expect(screen.getByTestId('bottleneck-insight-1')).toBeInTheDocument();
      expect(screen.getByText('Get Users')).toBeInTheDocument();
      expect(screen.getByText('Takes most time')).toBeInTheDocument();
      expect(screen.getByText('Optimize this node')).toBeInTheDocument();
    });

    it('renders severity icons for different levels', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const insights = [
        { nodeId: 'n2', nodeLabel: 'N2', severity: 'critical' as const, type: 'time-dominant' as const, message: 'm1', suggestion: 's1', metric: { label: 'l', value: 'v' } },
        { nodeId: 'n3', nodeLabel: 'N3', severity: 'warning' as const, type: 'high-variance' as const, message: 'm2', suggestion: 's2', metric: { label: 'l', value: 'v' } },
        { nodeId: 'n4', nodeLabel: 'N4', severity: 'info' as const, type: 'high-failure' as const, message: 'm3', suggestion: 's3', metric: { label: 'l', value: 'v' } },
      ];
      act(() => { lastBottleneckCallbackRef.current?.(insights); });
      const icons = document.querySelectorAll('.bottleneck-insight-icon');
      expect(icons[0].textContent).toContain('🔥');
      expect(icons[1].textContent).toContain('⚠');
      expect(icons[2].textContent).toContain('ℹ');
    });

    it('clicking bottleneck insight selects the node', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const insights = [
        { nodeId: 'n2', nodeLabel: 'Get Users', severity: 'critical' as const, type: 'time-dominant' as const, message: 'm', suggestion: 's', metric: { label: 'l', value: 'v' } },
      ];
      act(() => { lastBottleneckCallbackRef.current?.(insights); });
      fireEvent.click(screen.getByTestId('bottleneck-insight-0'));
      expect(screen.getByTestId('detail-node-label')).toHaveTextContent('Get Users');
    });

    it('does not render bottleneck panel when no insights', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.queryByTestId('bottleneck-insights')).not.toBeInTheDocument();
    });
  });

  describe('matrix collapse chevron', () => {
    it('shows right-pointing chevron when collapsed', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const toggle = document.querySelector('.matrix-toggle-icon');
      expect(toggle?.textContent).toBe('▶');
    });

    it('shows down-pointing chevron when expanded', () => {
      vi.useFakeTimers();
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByText('Iteration Matrix'));
      act(() => { vi.advanceTimersByTime(200); });
      const toggle = document.querySelector('.matrix-toggle-icon');
      expect(toggle?.textContent).toBe('▼');
    });
  });

  describe('edge cases', () => {
    it('returns empty events for invalid selected iteration index', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      expect(screen.getByTestId('detail-events-count')).toHaveAttribute('data-count', '2');
    });

    it('handles empty iterations array for avgIterationTime', () => {
      const emptyTrace: WorkflowExecutionTrace = {
        ...mockTrace,
        iterations: [],
        totalIterations: 0,
        totalDurationMs: 0,
      };
      render(<WorkflowResultsExplorerModal trace={emptyTrace} onClose={mockOnClose} />);
      expect(screen.getByText('0% pass')).toBeInTheDocument();
    });

    it('handles export when first event has no timestamp', () => {
      const noTimestampTrace: WorkflowExecutionTrace = {
        ...mockTrace,
        iterations: [{
          ...mockTrace.iterations[0],
          events: [
            { nodeId: 'n1', nodeType: 'start', nodeLabel: 'Start', timestamp: 0, state: 'pass' as const },
          ],
        }],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={noTimestampTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-trace-btn'));
      expect(mockSaveJsonFile).toHaveBeenCalled();
    });
  });

  describe('export PNG', () => {
    it('renders Export PNG item in dropdown', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-png-btn')).toBeInTheDocument();
      expect(screen.getByTestId('export-png-btn')).toHaveTextContent('Export PNG');
    });

    it('calls savePngFile when Export PNG is clicked', async () => {
      mockCaptureScreenshot.mockResolvedValue('data:image/png;base64,testdata');
      mockSavePngFile.mockResolvedValue(undefined);

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-png-btn'));
      });

      expect(mockCaptureScreenshot).toHaveBeenCalled();
      expect(mockSavePngFile).toHaveBeenCalledWith(
        'data:image/png;base64,testdata',
        expect.stringContaining('png'),
      );
    });

    it('shows busy state on trigger during export', async () => {
      let resolvePng!: (v: string) => void;
      mockCaptureScreenshot.mockReturnValue(new Promise<string>((resolve) => { resolvePng = resolve; }));

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-png-btn'));
      });

      expect(screen.getByTestId('export-dropdown-trigger')).toBeDisabled();
      expect(screen.getByTestId('export-dropdown-trigger')).toHaveTextContent('Exporting…');

      await act(async () => {
        resolvePng('data:image/png;base64,done');
      });

      expect(screen.getByTestId('export-dropdown-trigger')).not.toBeDisabled();
      expect(screen.getByTestId('export-dropdown-trigger')).toHaveTextContent('Export');
    });

    it('does not show Export PNG for imported traces', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} importedFileName="test.json" />);
      expect(screen.queryByTestId('export-dropdown-trigger')).not.toBeInTheDocument();
    });

    it('handles screenshot capture errors gracefully', async () => {
      mockCaptureScreenshot.mockRejectedValue(new Error('Canvas tainted'));

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-png-btn'));
      });

      expect(screen.getByTestId('export-dropdown-trigger')).not.toBeDisabled();
      expect(mockSavePngFile).not.toHaveBeenCalled();
    });

    it('handles savePngFile rejection after successful capture', async () => {
      mockCaptureScreenshot.mockResolvedValue('data:image/png;base64,x');
      mockSavePngFile.mockRejectedValueOnce(new Error('write failed'));

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-png-btn'));
      });

      expect(screen.getByTestId('export-dropdown-trigger')).not.toBeDisabled();
    });

    it('uses screenshot level and png extension in filename', async () => {
      mockCaptureScreenshot.mockResolvedValue('data:image/png;base64,x');
      mockSavePngFile.mockResolvedValue(undefined);

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-png-btn'));
      });

      expect(mockBuildExportFilename).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'screenshot', ext: 'png' }),
      );
    });
  });

  describe('export SVG', () => {
    it('renders Export SVG item in dropdown', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-svg-btn')).toBeInTheDocument();
      expect(screen.getByTestId('export-svg-btn')).toHaveTextContent('Export SVG');
    });

    it('calls saveSvgFile when Export SVG is clicked', async () => {
      mockCaptureSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E');
      mockSaveSvgFile.mockResolvedValue(undefined);

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-svg-btn'));
      });

      expect(mockCaptureSvg).toHaveBeenCalled();
      expect(mockSaveSvgFile).toHaveBeenCalledWith(
        'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
        expect.stringContaining('svg'),
      );
    });

    it('shows busy state on trigger during SVG export', async () => {
      let resolveSvg!: (v: string) => void;
      mockCaptureSvg.mockReturnValue(new Promise<string>((resolve) => { resolveSvg = resolve; }));

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-svg-btn'));
      });

      expect(screen.getByTestId('export-dropdown-trigger')).toBeDisabled();
      expect(screen.getByTestId('export-dropdown-trigger')).toHaveTextContent('Exporting…');

      await act(async () => {
        resolveSvg('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E');
      });

      expect(screen.getByTestId('export-dropdown-trigger')).not.toBeDisabled();
      expect(screen.getByTestId('export-dropdown-trigger')).toHaveTextContent('Export');
    });

    it('does not show Export SVG for imported traces', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} importedFileName="test.json" />);
      expect(screen.queryByTestId('export-dropdown-trigger')).not.toBeInTheDocument();
    });

    it('handles SVG capture errors gracefully', async () => {
      mockCaptureSvg.mockRejectedValue(new Error('SVG render failed'));

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-svg-btn'));
      });

      expect(screen.getByTestId('export-dropdown-trigger')).not.toBeDisabled();
      expect(mockSaveSvgFile).not.toHaveBeenCalled();
    });

    it('handles saveSvgFile rejection after successful capture', async () => {
      mockCaptureSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E');
      mockSaveSvgFile.mockRejectedValueOnce(new Error('write failed'));

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-svg-btn'));
      });

      expect(screen.getByTestId('export-dropdown-trigger')).not.toBeDisabled();
    });

    it('uses diagram level and svg extension in filename', async () => {
      mockCaptureSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E');
      mockSaveSvgFile.mockResolvedValue(undefined);

      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      await act(async () => {
        fireEvent.click(screen.getByTestId('export-svg-btn'));
      });

      expect(mockBuildExportFilename).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'diagram', ext: 'svg' }),
      );
    });
  });

  describe('smooth iteration transitions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('adds iteration-transitioning class to diagram panel when switching iterations', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });

      const diagram = document.querySelector('.results-explorer-diagram');
      expect(diagram?.classList.contains('iteration-transitioning')).toBe(true);
    });

    it('adds iteration-transitioning class to detail panel when switching iterations', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });

      const detail = document.querySelector('.results-explorer-detail');
      expect(detail?.classList.contains('iteration-transitioning')).toBe(true);
    });

    it('adds iteration-transitioning class to footer info when switching iterations', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });

      const footer = document.querySelector('.results-explorer-footer-info');
      expect(footer?.classList.contains('iteration-transitioning')).toBe(true);
    });

    it('removes iteration-transitioning class after timeout', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });
      expect(document.querySelector('.results-explorer-diagram')?.classList.contains('iteration-transitioning')).toBe(true);

      act(() => { vi.advanceTimersByTime(300); });
      expect(document.querySelector('.results-explorer-diagram')?.classList.contains('iteration-transitioning')).toBe(false);
    });

    it('does not add transition class on initial render', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      const diagram = document.querySelector('.results-explorer-diagram');
      expect(diagram?.classList.contains('iteration-transitioning')).toBe(false);
    });

    it('triggers transition on Space toggle (aggregate ↔ iteration)', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: ' ' }); });

      const diagram = document.querySelector('.results-explorer-diagram');
      expect(diagram?.classList.contains('iteration-transitioning')).toBe(true);

      act(() => { vi.advanceTimersByTime(300); });
      expect(diagram?.classList.contains('iteration-transitioning')).toBe(false);
    });

    it('triggers transition when selecting iteration via number key', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: '2' }); });

      const detail = document.querySelector('.results-explorer-detail');
      expect(detail?.classList.contains('iteration-transitioning')).toBe(true);

      act(() => { vi.advanceTimersByTime(300); });
      expect(detail?.classList.contains('iteration-transitioning')).toBe(false);
    });

    it('triggers transition when using matrix iteration select', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      fireEvent.keyDown(window, { key: 'm' });
      fireEvent.click(screen.getByTestId('matrix-select-iter-0'));

      const diagram = document.querySelector('.results-explorer-diagram');
      expect(diagram?.classList.contains('iteration-transitioning')).toBe(true);
    });

    it('cleans up previous timer when switching iterations rapidly', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);

      act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }); });
      act(() => { vi.advanceTimersByTime(100); });
      act(() => { fireEvent.keyDown(window, { key: 'a' }); });

      const diagram = document.querySelector('.results-explorer-diagram');
      expect(diagram?.classList.contains('iteration-transitioning')).toBe(true);

      act(() => { vi.advanceTimersByTime(300); });
      expect(diagram?.classList.contains('iteration-transitioning')).toBe(false);
    });
  });

  describe('Sub-workflow drill-down', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowId: 'child-wf-1',
      workflowName: 'Child Workflow',
      workflowSnapshot: {
        nodes: [
          { id: 'c1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Child Start' } },
          { id: 'c2', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Child HTTP' } },
        ],
        edges: [{ id: 'ce1', source: 'c1', target: 'c2' }],
      },
      iterations: [{
        index: 0,
        passed: true,
        durationMs: 50,
        traversedEdges: ['ce1'],
        events: [
          { nodeId: 'c1', nodeType: 'start', nodeLabel: 'Child Start', timestamp: 1050, state: 'pass' },
          { nodeId: 'c2', nodeType: 'http', nodeLabel: 'Child HTTP', timestamp: 1060, state: 'pass', durationMs: 30 },
        ],
        finalVariables: {},
      }],
      traversedEdges: ['ce1'],
      totalIterations: 1,
      totalDurationMs: 50,
    };

    const traceWithSubWorkflow: WorkflowExecutionTrace = {
      workflowId: 'parent-wf',
      workflowName: 'Parent Workflow',
      workflowSnapshot: {
        nodes: [
          { id: 'p1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
          { id: 'sub1', type: 'subWorkflow', position: { x: 100, y: 0 }, data: { label: 'Run Child' } },
          { id: 'p2', type: 'end', position: { x: 200, y: 0 }, data: { label: 'End' } },
        ],
        edges: [
          { id: 'pe1', source: 'p1', target: 'sub1' },
          { id: 'pe2', source: 'sub1', target: 'p2' },
        ],
      },
      iterations: [{
        index: 0,
        passed: true,
        durationMs: 100,
        traversedEdges: ['pe1', 'pe2'],
        events: [
          { nodeId: 'p1', nodeType: 'start', nodeLabel: 'Start', timestamp: 1000, state: 'pass' },
          {
            nodeId: 'sub1', nodeType: 'subWorkflow', nodeLabel: 'Run Child',
            timestamp: 1010, state: 'pass', durationMs: 50,
            details: {
              subWorkflowId: 'child-wf-1',
              subWorkflowPassed: true,
              subWorkflowTrace: childTrace,
            },
          },
          { nodeId: 'p2', nodeType: 'end', nodeLabel: 'End', timestamp: 1060, state: 'pass' },
        ],
        finalVariables: {},
      }],
      traversedEdges: ['pe1', 'pe2'],
      totalIterations: 1,
      totalDurationMs: 100,
    };

    it('does not show breadcrumb at root level', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });

    it('shows breadcrumb after drilling down into sub-workflow', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);

      fireEvent.click(screen.getByTestId('canvas-pick-sub1'));
      expect(screen.getByTestId('mock-drilldown-btn')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('mock-drilldown-btn'));

      expect(screen.getByTestId('sub-workflow-breadcrumb')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-0')).toHaveTextContent('Parent Workflow');
      expect(screen.getByTestId('breadcrumb-1')).toHaveTextContent('Child Workflow');

      fireEvent.click(screen.getByTestId('breadcrumb-0'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
      expect(screen.getAllByText('Parent Workflow').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('modal interactions (timeline, export UX, shortcuts)', () => {
    it('closes export menu when clicking outside the dropdown', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();

      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('export-dropdown-menu')).not.toBeInTheDocument();
    });

    it('shows nodes OK subtitle when iteration pass rate is partial', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByText(/nodes OK/)).toBeInTheDocument();
    });

    it('switches to timeline view via header toggle and renders ExecutionTimeline', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('view-toggle-timeline'));
      expect(screen.getByTestId('execution-timeline')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('view-toggle-diagram'));
      expect(screen.getByTestId('mock-wf-canvas')).toBeInTheDocument();
    });

    it('toggles timeline vs diagram via T keyboard shortcut', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 't' });
      expect(screen.getByTestId('execution-timeline')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'T' });
      expect(screen.getByTestId('mock-wf-canvas')).toBeInTheDocument();
    });

    it('does not toggle view when T is pressed while textarea is focused', () => {
      render(
        <>
          <textarea data-testid="outside-ta" defaultValue="" />
          <WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />
        </>,
      );

      screen.getByTestId('outside-ta').focus();
      fireEvent.keyDown(window, { key: 't' });
      expect(screen.getByTestId('mock-wf-canvas')).toBeInTheDocument();
    });

    it('collapses detail panel via D keyboard shortcut', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'd' });
      expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Select a Node')).not.toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'D' });
      expect(screen.getByText('Select a Node')).toBeInTheDocument();
    });

    it('collapses detail panel using the divider toggle button', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('detail-panel-toggle'));
      expect(screen.queryByText('Select a Node')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('detail-panel-toggle'));
      expect(screen.getByText('Select a Node')).toBeInTheDocument();
    });

    it('escapes double quotes inside CSV exports', () => {
      const q1Event = (
        iterationIndex: number,
      ) => ({
        nodeId: 'q1',
        nodeType: 'http' as const,
        nodeLabel: 'Quoted',
        timestamp: 1090 + iterationIndex * 1000,
        state: 'pass' as const,
        durationMs: 90,
        details: { statusCode: 200, method: 'GET', url: '/api/q1' },
      });
      const baseNodes = mockTrace.workflowSnapshot.nodes as WorkflowExecutionTrace['workflowSnapshot']['nodes'];
      const csvTrace: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          ...mockTrace.workflowSnapshot,
          nodes: [
            ...baseNodes,
            { id: 'q1', type: 'http', position: { x: 400, y: 0 }, data: { label: 'Say "hello"' } },
          ],
        },
        iterations: [
          {
            ...mockTrace.iterations[0],
            events: [...mockTrace.iterations[0].events, q1Event(0)],
          },
          {
            ...mockTrace.iterations[1],
            events: [...mockTrace.iterations[1].events, q1Event(1)],
          },
        ],
      };

      render(<WorkflowResultsExplorerModal trace={csvTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csv = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csv).toContain('Say ""hello""');
    });

    it('ignores slash focus shortcut when textarea is active', () => {
      render(
        <>
          <textarea data-testid="floating-ta" defaultValue="" />
          <WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />
        </>,
      );
      screen.getByTestId('floating-ta').focus();
      fireEvent.keyDown(window, { key: '/' });
      expect(document.activeElement).toBe(screen.getByTestId('floating-ta'));
    });
  });

  describe('workflow-info (empty detail panel)', () => {
    it('shows workflow name and Root Workflow at trace stack depth 1', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const info = screen.getByTestId('workflow-info');
      expect(info).toBeInTheDocument();
      expect(info.querySelector('.workflow-info-name')).toHaveTextContent('Test Workflow');
      expect(screen.getByText('Root Workflow')).toBeInTheDocument();
      expect(screen.queryByText(/^Parent:$/)).not.toBeInTheDocument();
    });
  });

  describe('console panel', () => {
    it('opens and closes via header console toggle', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.queryByTestId('mock-console-panel')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('console-toggle-btn-header'));
      expect(screen.getByTestId('mock-console-panel')).toBeInTheDocument();
      expect(screen.getByTestId('console-toggle-btn-header')).toHaveClass('view-toggle-active');
      fireEvent.click(screen.getByTestId('console-toggle-btn-header'));
      expect(screen.queryByTestId('mock-console-panel')).not.toBeInTheDocument();
    });

    it('toggles console with Cmd+J and Ctrl+J', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'j', metaKey: true });
      expect(screen.getByTestId('mock-console-panel')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
      expect(screen.queryByTestId('mock-console-panel')).not.toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
      expect(screen.getByTestId('mock-console-panel')).toBeInTheDocument();
    });

    it('closes console first on Escape before clearing node selection', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      fireEvent.keyDown(window, { key: 'j', metaKey: true });
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('mock-console-panel')).not.toBeInTheDocument();
      expect(screen.getByTestId('mock-detail-panel')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
    });

    it('closes console via panel onClose', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'j', metaKey: true });
      fireEvent.click(screen.getByTestId('mock-console-close'));
      expect(screen.queryByTestId('mock-console-panel')).not.toBeInTheDocument();
    });

    it('handleConsoleNodeSelect selects the node while console stays open', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'j', metaKey: true });
      fireEvent.click(screen.getByTestId('mock-console-select-node'));
      expect(screen.getByTestId('detail-node-label')).toHaveTextContent('Get Users');
      expect(screen.getByTestId('mock-console-panel')).toBeInTheDocument();
    });

    it('passes undefined iteration to console in aggregate view', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('console-toggle-btn-header'));
      expect(screen.getByTestId('mock-console-panel')).toHaveAttribute('data-has-iteration', '0');
    });

    it('passes pinned iteration trace to console', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.click(screen.getByTestId('console-toggle-btn-header'));
      expect(screen.getByTestId('mock-console-panel')).toHaveAttribute('data-has-iteration', '1');
    });

    it('forwards captureLevel to the console panel', () => {
      render(
        <WorkflowResultsExplorerModal
          trace={{ ...mockTrace, captureLevel: 'minimal' }}
          onClose={mockOnClose}
        />,
      );
      fireEvent.click(screen.getByTestId('console-toggle-btn-header'));
      expect(screen.getByTestId('mock-console-panel')).toHaveAttribute('data-capture-level', 'minimal');
    });
  });

  describe('node double-click (sub-workflow drill)', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowId: 'child-wf-1',
      workflowName: 'Child Workflow',
      workflowSnapshot: {
        nodes: [
          { id: 'c1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Child Start' } },
          { id: 'c2', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Child HTTP' } },
        ],
        edges: [{ id: 'ce1', source: 'c1', target: 'c2' }],
      },
      iterations: [{
        index: 0,
        passed: true,
        durationMs: 50,
        traversedEdges: ['ce1'],
        events: [
          { nodeId: 'c1', nodeType: 'start', nodeLabel: 'Child Start', timestamp: 1050, state: 'pass' },
          { nodeId: 'c2', nodeType: 'http', nodeLabel: 'Child HTTP', timestamp: 1060, state: 'pass', durationMs: 30 },
        ],
        finalVariables: {},
      }],
      traversedEdges: ['ce1'],
      totalIterations: 1,
      totalDurationMs: 50,
    };

    const baseSubWorkflowIter = {
      index: 0,
      passed: true,
      durationMs: 100,
      traversedEdges: ['pe1', 'pe2'] as string[],
      events: [
        { nodeId: 'p1', nodeType: 'start' as const, nodeLabel: 'Start', timestamp: 1000, state: 'pass' as const },
        {
          nodeId: 'sub1',
          nodeType: 'subWorkflow' as const,
          nodeLabel: 'Run Child',
          timestamp: 1010,
          state: 'pass' as const,
          durationMs: 50,
          details: {
            subWorkflowId: 'child-wf-1',
            subWorkflowPassed: true,
            subWorkflowTrace: childTrace,
          },
        },
        { nodeId: 'p2', nodeType: 'end' as const, nodeLabel: 'End', timestamp: 1060, state: 'pass' as const },
      ],
      finalVariables: {},
    };

    const traceWithSubWorkflow: WorkflowExecutionTrace = {
      workflowId: 'parent-wf',
      workflowName: 'Parent Workflow',
      workflowSnapshot: {
        nodes: [
          { id: 'p1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
          { id: 'sub1', type: 'subWorkflow', position: { x: 100, y: 0 }, data: { label: 'Run Child' } },
          { id: 'p2', type: 'end', position: { x: 200, y: 0 }, data: { label: 'End' } },
        ],
        edges: [
          { id: 'pe1', source: 'p1', target: 'sub1' },
          { id: 'pe2', source: 'sub1', target: 'p2' },
        ],
      },
      iterations: [{ ...baseSubWorkflowIter }],
      traversedEdges: ['pe1', 'pe2'],
      totalIterations: 1,
      totalDurationMs: 100,
    };

    it('double-click drills into sub-workflow when child trace is present', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.getByTestId('sub-workflow-breadcrumb')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-1')).toHaveTextContent('Child Workflow');
    });

    it('double-click ignores empty node id', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-empty'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });

    it('double-click ignores non-subWorkflow nodes', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-n2'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });

    it('double-click does not drill when subWorkflow details omit child trace', () => {
      const traceNoPayload: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [{
          ...baseSubWorkflowIter,
          events: baseSubWorkflowIter.events.map((e) => {
            if (e.nodeId !== 'sub1') return e;
            return {
              ...e,
              details: { subWorkflowId: 'child-wf-1', subWorkflowPassed: true },
            };
          }),
        }],
      };
      render(<WorkflowResultsExplorerModal trace={traceNoPayload} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });

    it('uses getIterationByIndex when an iteration is pinned for double-click context', () => {
      const subEventNoTrace = {
        nodeId: 'sub1',
        nodeType: 'subWorkflow' as const,
        nodeLabel: 'Run Child',
        timestamp: 1010,
        state: 'pass' as const,
        durationMs: 50,
        details: { subWorkflowId: 'child-wf-1', subWorkflowPassed: true },
      };
      const traceMulti: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [
          { ...baseSubWorkflowIter, index: 0, events: [...baseSubWorkflowIter.events.slice(0, 1), subEventNoTrace, baseSubWorkflowIter.events[2]] },
          { ...baseSubWorkflowIter, index: 1 },
        ],
        totalIterations: 2,
        totalDurationMs: 200,
      };

      render(<WorkflowResultsExplorerModal trace={traceMulti} onClose={mockOnClose} />);

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.getByTestId('sub-workflow-breadcrumb')).toBeInTheDocument();
    });

    it('uses last iteration when aggregate view looks up double-click context', () => {
      const subEventNoTrace = {
        nodeId: 'sub1',
        nodeType: 'subWorkflow' as const,
        nodeLabel: 'Run Child',
        timestamp: 1010,
        state: 'pass' as const,
        durationMs: 50,
        details: { subWorkflowId: 'child-wf-1', subWorkflowPassed: true },
      };
      const traceMulti: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [
          { ...baseSubWorkflowIter, index: 0, events: [...baseSubWorkflowIter.events.slice(0, 1), subEventNoTrace, baseSubWorkflowIter.events[2]] },
          { ...baseSubWorkflowIter, index: 1 },
        ],
        totalIterations: 2,
        totalDurationMs: 200,
      };

      render(<WorkflowResultsExplorerModal trace={traceMulti} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'a' });

      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.getByTestId('sub-workflow-breadcrumb')).toBeInTheDocument();
    });

    it('returns early when pinned iteration lookup yields no iteration row', () => {
      const traceGapIndex: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [{ ...baseSubWorkflowIter, index: 1 }],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={traceGapIndex} onClose={mockOnClose} />);

      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });
  });

  describe('workflow-info after sub-workflow drill-down', () => {
    /* reuses fixtures from sibling describe via inline minimal trace */
    it('shows parent workflow label in workflow-info on drilled child canvas', () => {
      const childTrace: WorkflowExecutionTrace = {
        workflowId: 'child-wf-1',
        workflowName: 'Child Workflow',
        workflowSnapshot: {
          nodes: [
            { id: 'c1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Child Start' } },
          ],
          edges: [],
        },
        iterations: [{
          index: 0,
          passed: true,
          durationMs: 10,
          traversedEdges: [],
          events: [{ nodeId: 'c1', nodeType: 'start' as const, nodeLabel: 'CS', timestamp: 1, state: 'pass' as const }],
          finalVariables: {},
        }],
        traversedEdges: [],
        totalIterations: 1,
        totalDurationMs: 10,
      };
      const parent: WorkflowExecutionTrace = {
        workflowId: 'parent-wf',
        workflowName: 'Parent Workflow',
        workflowSnapshot: {
          nodes: [
            { id: 'p1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            { id: 'sub1', type: 'subWorkflow', position: { x: 100, y: 0 }, data: { label: 'Run Child' } },
            { id: 'p2', type: 'end', position: { x: 200, y: 0 }, data: { label: 'End' } },
          ],
          edges: [
            { id: 'pe1', source: 'p1', target: 'sub1' },
            { id: 'pe2', source: 'sub1', target: 'p2' },
          ],
        },
        iterations: [{
          index: 0,
          passed: true,
          durationMs: 100,
          traversedEdges: ['pe1', 'pe2'],
          events: [
            { nodeId: 'p1', nodeType: 'start' as const, nodeLabel: 'Start', timestamp: 1000, state: 'pass' as const },
            {
              nodeId: 'sub1',
              nodeType: 'subWorkflow' as const,
              nodeLabel: 'Run Child',
              timestamp: 1010,
              state: 'pass' as const,
              details: {
                subWorkflowId: 'child-wf-1',
                subWorkflowPassed: true,
                subWorkflowTrace: childTrace,
              },
            },
            { nodeId: 'p2', nodeType: 'end' as const, nodeLabel: 'End', timestamp: 1060, state: 'pass' as const },
          ],
          finalVariables: {},
        }],
        traversedEdges: ['pe1', 'pe2'],
        totalIterations: 1,
        totalDurationMs: 100,
      };

      render(<WorkflowResultsExplorerModal trace={parent} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-sub1'));
      fireEvent.click(screen.getByTestId('mock-drilldown-btn'));

      const info = screen.getByTestId('workflow-info');
      expect(info.querySelector('.workflow-info-name')).toHaveTextContent('Child Workflow');
      expect(screen.getByText(/^Parent:$/)).toBeInTheDocument();
      expect(screen.getByTestId('workflow-info').querySelector('.workflow-info-parent-name'))
        .toHaveTextContent('Parent Workflow');
      expect(screen.queryByText('Root Workflow')).not.toBeInTheDocument();
    });
  });

  describe('mapping trace overlay', () => {
    it('shows "Open in Mapper" button when a node is selected', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      expect(screen.getByTestId('mock-open-mapper-btn')).toBeInTheDocument();
    });

    it('opens the mapping trace overlay when clicking "Open in Mapper"', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      fireEvent.click(screen.getByTestId('mock-open-mapper-btn'));
      expect(screen.getByTestId('mapper-trace-overlay')).toBeInTheDocument();
      expect(screen.getByText(/Mapping Traces/)).toBeInTheDocument();
      expect(screen.getByText('x.y')).toBeInTheDocument();
      expect(screen.getByText('a.b')).toBeInTheDocument();
    });

    it('shows pass/fail badges in the overlay', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      fireEvent.click(screen.getByTestId('mock-open-mapper-btn'));
      expect(screen.getByText('1 passed')).toBeInTheDocument();
      expect(screen.getByText('0 failed')).toBeInTheDocument();
    });

    it('closes the overlay when clicking the close button', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      fireEvent.click(screen.getByTestId('mock-open-mapper-btn'));
      expect(screen.getByTestId('mapper-trace-overlay')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Close mapping traces'));
      expect(screen.queryByTestId('mapper-trace-overlay')).not.toBeInTheDocument();
    });

    it('closes the overlay when pressing Escape', async () => {
      const user = userEvent.setup();
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      fireEvent.click(screen.getByTestId('mock-open-mapper-btn'));
      expect(screen.getByTestId('mapper-trace-overlay')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('mapper-trace-overlay')).not.toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('closes the overlay when clicking the backdrop', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      fireEvent.click(screen.getByTestId('mock-open-mapper-btn'));
      const backdrop = screen.getByTestId('mapper-trace-overlay').querySelector('.mapper-trace-overlay-backdrop')!;
      fireEvent.click(backdrop);
      expect(screen.queryByTestId('mapper-trace-overlay')).not.toBeInTheDocument();
    });
  });
});
