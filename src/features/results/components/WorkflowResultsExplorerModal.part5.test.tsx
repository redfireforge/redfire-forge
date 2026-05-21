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

describe('WorkflowResultsExplorerModal — part5', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
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

});
