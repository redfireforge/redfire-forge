/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { WorkflowExecutionTrace } from '@shared/types';
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

describe('WorkflowResultsExplorerModal — part11', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('modal interactions (timeline, export UX, shortcuts)', () => {
    it('closes export menu when clicking outside the dropdown', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();

      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('export-dropdown-menu')).not.toBeInTheDocument();
    });

    it('shows nodes OK subtitle when iteration pass rate is partial', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      expect(screen.getByText(/nodes OK/)).toBeInTheDocument();
    });

    it('switches to timeline view via header toggle and renders ExecutionTimeline', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('view-toggle-timeline'));
      expect(screen.getByTestId('execution-timeline')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('view-toggle-diagram'));
      expect(screen.getByTestId('mock-wf-canvas')).toBeInTheDocument();
    });

    it('toggles timeline vs diagram via T keyboard shortcut', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 't' });
      expect(screen.getByTestId('execution-timeline')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'T' });
      expect(screen.getByTestId('mock-wf-canvas')).toBeInTheDocument();
    });

    it('does not toggle view when T is pressed while textarea is focused', () => {
      render(
        <>
          <textarea data-testid="outside-ta" defaultValue="" />
          <WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />
        </>,
      );

      screen.getByTestId('outside-ta').focus();
      fireEvent.keyDown(window, { key: 't' });
      expect(screen.getByTestId('mock-wf-canvas')).toBeInTheDocument();
    });

    it('collapses detail panel via D keyboard shortcut', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'd' });
      expect(screen.queryByTestId('mock-detail-panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Select a Node')).not.toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'D' });
      expect(screen.getByText('Select a Node')).toBeInTheDocument();
    });

    it('collapses detail panel using the divider toggle button', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('detail-panel-toggle'));
      expect(screen.queryByText('Select a Node')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('detail-panel-toggle'));
      expect(screen.getByText('Select a Node')).toBeInTheDocument();
    });

    it('escapes double quotes inside CSV exports', () => {
      const q1Event = (
        iterationIndex: number,
      ) => ({
        nodeId: 'q1',
        nodeType: 'http' as const,
        nodeLabel: 'Quoted',
        timestamp: 1090 + iterationIndex * 1000,
        state: 'pass' as const,
        durationMs: 90,
        details: { statusCode: 200, method: 'GET', url: '/api/q1' },
      });
      const baseNodes = mockTrace.workflowSnapshot.nodes as WorkflowExecutionTrace['workflowSnapshot']['nodes'];
      const csvTrace: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          ...mockTrace.workflowSnapshot,
          nodes: [
            ...baseNodes,
            { id: 'q1', type: 'http', position: { x: 400, y: 0 }, data: { label: 'Say "hello"' } },
          ],
        },
        iterations: [
          {
            ...mockTrace.iterations[0],
            events: [...mockTrace.iterations[0].events, q1Event(0)],
          },
          {
            ...mockTrace.iterations[1],
            events: [...mockTrace.iterations[1].events, q1Event(1)],
          },
        ],
      };

      render(<WorkflowResultsExplorerModal trace={csvTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csv = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csv).toContain('Say ""hello""');
    });

    it('ignores slash focus shortcut when textarea is active', () => {
      render(
        <>
          <textarea data-testid="floating-ta" defaultValue="" />
          <WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />
        </>,
      );
      screen.getByTestId('floating-ta').focus();
      fireEvent.keyDown(window, { key: '/' });
      expect(document.activeElement).toBe(screen.getByTestId('floating-ta'));
    });
  });

});
