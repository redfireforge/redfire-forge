/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
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

describe('WorkflowResultsExplorerModal — part8', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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

});
