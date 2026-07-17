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

describe('WorkflowResultsExplorerModal — part9', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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

});
