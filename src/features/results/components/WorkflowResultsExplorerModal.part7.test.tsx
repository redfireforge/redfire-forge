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

describe('WorkflowResultsExplorerModal — part7', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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
