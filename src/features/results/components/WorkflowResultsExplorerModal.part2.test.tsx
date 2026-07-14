/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
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

describe('WorkflowResultsExplorerModal — part2', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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

});
