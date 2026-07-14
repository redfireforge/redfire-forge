/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import type { BottleneckInsight } from '../utils/bottleneckAnalysis';

import { stubResizeObserver } from '../../../test-utils/domMocks';
import {
  mockTrace,
  makeMockConsolePanel,
  makeMockCanvas,
  makeMockDetailPanel,
  makeMockIterationMatrix,
  openExportMenu,
} from './__test-utils__/workflowResultsExplorerTestHelpers';

stubResizeObserver();

const lastCanvasTraceRef = vi.hoisted<{ current: WorkflowExecutionTrace | null }>(() => ({ current: null }));
const lastBottleneckCallbackRef = vi.hoisted<{
  current: ((insights: BottleneckInsight[]) => void) | null;
}>(() => ({ current: null }));

const {
  mockCaptureScreenshot,
  mockCaptureSvg,
  mockSaveJsonFile,
  mockSaveCsvFile,
  mockSavePngFile,
  mockSaveSvgFile,
  mockBuildExportFilename,
} = vi.hoisted(() => ({
  mockCaptureScreenshot: vi.fn(() => Promise.resolve('data:image/png;base64,mockdata')),
  mockCaptureSvg: vi.fn(() => Promise.resolve('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E')),
  mockSaveJsonFile: vi.fn(),
  mockSaveCsvFile: vi.fn(),
  mockSavePngFile: vi.fn(),
  mockSaveSvgFile: vi.fn(),
  mockBuildExportFilename: vi.fn(({ level, name, ext }: { level: string; name?: string; ext?: string }) =>
    `${level}-${name || 'unknown'}.${ext || 'json'}`,
  ),
}));

vi.mock('@xyflow/react', async () => {
  const h = await import('../../../test-utils/reactFlowMock');
  return h.buildReactFlowMock();
});
vi.mock('./ResultsExplorerConsolePanel', () => ({ default: makeMockConsolePanel() }));
vi.mock('./WorkflowExecutionCanvas', () => ({
  default: makeMockCanvas(lastCanvasTraceRef, lastBottleneckCallbackRef, {
    mockCaptureScreenshot,
    mockCaptureSvg,
  }),
}));
vi.mock('./ResultsExplorerDetailPanel', () => ({ default: makeMockDetailPanel() }));
vi.mock('./IterationMatrixTable', () => ({ default: makeMockIterationMatrix() }));

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveJsonFile: (...args: unknown[]) => mockSaveJsonFile(...args),
  saveCsvFile: (...args: unknown[]) => mockSaveCsvFile(...args),
  savePngFile: (...args: unknown[]) => mockSavePngFile(...args),
  saveSvgFile: (...args: unknown[]) => mockSaveSvgFile(...args),
  buildExportFilename: (...args: unknown[]) => mockBuildExportFilename(...args),
}));

import WorkflowResultsExplorerModal from './WorkflowResultsExplorerModal';

describe('WorkflowResultsExplorerModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
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

});
