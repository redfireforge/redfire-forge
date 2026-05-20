/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkflowExecutionTrace } from '../../../shared/types';
import { BottleneckInsight } from '../utils/bottleneckAnalysis';

import { stubResizeObserver } from '../../../test-utils/domMocks';

stubResizeObserver();

vi.mock('@xyflow/react', async () => {
  const h = await import('../../../test-utils/reactFlowMock');
  return h.buildReactFlowMock();
});

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

});
