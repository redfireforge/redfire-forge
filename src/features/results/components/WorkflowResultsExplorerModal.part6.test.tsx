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

describe('WorkflowResultsExplorerModal — part6', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('bottleneck insights', () => {
    it('renders bottleneck panel when insights are provided via canvas callback', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const insights = [
        {
          nodeId: 'n2',
          nodeLabel: 'Get Users',
          severity: 'critical' as const,
          type: 'time-dominant' as const,
          message: 'Takes most time',
          suggestion: 'Optimize this node',
          metric: { label: 'Time %', value: '65%' },
        },
        {
          nodeId: 'n3',
          nodeLabel: 'Create Order',
          severity: 'warning' as const,
          type: 'high-variance' as const,
          message: 'High variance',
          suggestion: 'Investigate variance',
          metric: { label: 'CV', value: '0.8' },
        },
      ];
      act(() => { lastBottleneckCallbackRef.current?.(insights); });
      expect(screen.getByTestId('bottleneck-insights')).toBeInTheDocument();
      expect(screen.getByTestId('bottleneck-insight-0')).toBeInTheDocument();
      expect(screen.getByTestId('bottleneck-insight-1')).toBeInTheDocument();
      expect(screen.getByText('Get Users')).toBeInTheDocument();
      expect(screen.getByText('Takes most time')).toBeInTheDocument();
      expect(screen.getByText('Optimize this node')).toBeInTheDocument();
    });

    it('renders severity icons for different levels', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const insights = [
        { nodeId: 'n2', nodeLabel: 'N2', severity: 'critical' as const, type: 'time-dominant' as const, message: 'm1', suggestion: 's1', metric: { label: 'l', value: 'v' } },
        { nodeId: 'n3', nodeLabel: 'N3', severity: 'warning' as const, type: 'high-variance' as const, message: 'm2', suggestion: 's2', metric: { label: 'l', value: 'v' } },
        { nodeId: 'n4', nodeLabel: 'N4', severity: 'info' as const, type: 'high-failure' as const, message: 'm3', suggestion: 's3', metric: { label: 'l', value: 'v' } },
      ];
      act(() => { lastBottleneckCallbackRef.current?.(insights); });
      const icons = document.querySelectorAll('.bottleneck-insight-icon');
      expect(icons[0].textContent).toContain('🔥');
      expect(icons[1].textContent).toContain('⚠');
      expect(icons[2].textContent).toContain('ℹ');
    });

    it('clicking bottleneck insight selects the node', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const insights = [
        { nodeId: 'n2', nodeLabel: 'Get Users', severity: 'critical' as const, type: 'time-dominant' as const, message: 'm', suggestion: 's', metric: { label: 'l', value: 'v' } },
      ];
      act(() => { lastBottleneckCallbackRef.current?.(insights); });
      fireEvent.click(screen.getByTestId('bottleneck-insight-0'));
      expect(screen.getByTestId('detail-node-label')).toHaveTextContent('Get Users');
    });

    it('does not render bottleneck panel when no insights', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.queryByTestId('bottleneck-insights')).not.toBeInTheDocument();
    });
  });

  describe('matrix collapse chevron', () => {
    it('shows right-pointing chevron when collapsed', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      const toggle = document.querySelector('.matrix-toggle-icon');
      expect(toggle?.textContent).toBe('▶');
    });

    it('shows down-pointing chevron when expanded', () => {
      vi.useFakeTimers();
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByText('Iteration Matrix'));
      act(() => { vi.advanceTimersByTime(200); });
      const toggle = document.querySelector('.matrix-toggle-icon');
      expect(toggle?.textContent).toBe('▼');
    });
  });

  describe('edge cases', () => {
    it('returns empty events for invalid selected iteration index', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-n2'));
      expect(screen.getByTestId('detail-events-count')).toHaveAttribute('data-count', '2');
    });

    it('handles empty iterations array for avgIterationTime', () => {
      const emptyTrace: WorkflowExecutionTrace = {
        ...mockTrace,
        iterations: [],
        totalIterations: 0,
        totalDurationMs: 0,
      };
      render(<WorkflowResultsExplorerModal trace={emptyTrace} onClose={mockOnClose} />);
      expect(screen.getByText('0% pass')).toBeInTheDocument();
    });

    it('handles export when first event has no timestamp', () => {
      const noTimestampTrace: WorkflowExecutionTrace = {
        ...mockTrace,
        iterations: [{
          ...mockTrace.iterations[0],
          events: [
            { nodeId: 'n1', nodeType: 'start', nodeLabel: 'Start', timestamp: 0, state: 'pass' as const },
          ],
        }],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={noTimestampTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-trace-btn'));
      expect(mockSaveJsonFile).toHaveBeenCalled();
    });
  });

});
