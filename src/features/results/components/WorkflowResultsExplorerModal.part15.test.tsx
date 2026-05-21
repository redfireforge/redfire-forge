/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

describe('WorkflowResultsExplorerModal — part15', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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
