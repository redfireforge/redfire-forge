/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

describe('WorkflowResultsExplorerModal — part12', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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

});
