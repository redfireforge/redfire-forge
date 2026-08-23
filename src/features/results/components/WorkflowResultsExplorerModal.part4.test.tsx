/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { WorkflowExecutionTrace } from '@shared/types';
import type { BottleneckInsight } from '../utils/bottleneckAnalysis';

import { stubResizeObserver } from '@test-utils/domMocks';
import {
  mockTrace,
  makeMockConsolePanel,
  makeMockCanvas,
  makeMockDetailPanel,
  makeMockIterationMatrix,
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

describe('WorkflowResultsExplorerModal — part4', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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

});
