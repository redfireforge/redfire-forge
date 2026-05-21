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

describe('WorkflowResultsExplorerModal — part3', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('export CSV', () => {
    it('renders the CSV export item in dropdown', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument();
    });

    it('calls saveCsvFile with CSV content on click', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      expect(mockSaveCsvFile).toHaveBeenCalledTimes(1);
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('Node');
      expect(csvContent).toContain('Pass Rate (%)');
      expect(csvContent).toContain('P95 (ms)');
    });

    it('includes HTTP node data in CSV', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('Get Users');
      expect(csvContent).toContain('Create Order');
    });

    it('builds filename with level "metrics" and ext "csv"', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      expect(mockBuildExportFilename).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'metrics', name: 'Test Workflow', ext: 'csv' }),
      );
    });

    it('hides CSV export when importedFileName is set', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} importedFileName="my-trace.json" />);
      expect(screen.queryByTestId('export-dropdown-trigger')).not.toBeInTheDocument();
    });

    it('closes export menu on mousedown outside', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('export-dropdown-menu')).not.toBeInTheDocument();
    });

    it('exports CSV rows with zero timing stats when durationMs omitted', () => {
      const traceNoDur: WorkflowExecutionTrace = {
        ...mockTrace,
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 100,
            traversedEdges: [],
            events: [
              { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 1, state: 'pass', details: { statusCode: 200 } },
            ],
          },
        ],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={traceNoDur} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('Get Users');
      expect(csvContent).toContain('"0","0","0"');
    });

    it('CSV skips http nodes that never executed', () => {
      const traceOrphan: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          ...mockTrace.workflowSnapshot,
          nodes: [
            ...mockTrace.workflowSnapshot.nodes,
            { id: 'n-orphan', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Never Run' } },
          ],
        },
      };
      render(<WorkflowResultsExplorerModal trace={traceOrphan} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).not.toContain('Never Run');
    });

    it('keeps export menu open when mousedown occurs inside menu', () => {
      render(<WorkflowResultsExplorerModal trace={mockTrace} onClose={mockOnClose} />);
      openExportMenu();
      const menu = screen.getByTestId('export-dropdown-menu');
      fireEvent.mouseDown(menu);
      expect(screen.getByTestId('export-dropdown-menu')).toBeInTheDocument();
    });

    it('CSV uses node data.name when label missing', () => {
      const traceName: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          nodes: [
            { id: 'nx', type: 'http', position: { x: 0, y: 0 }, data: { name: 'OnlyName' } },
          ],
          edges: [],
        },
        iterations: [
          {
            index: 0,
            passed: true,
            durationMs: 50,
            traversedEdges: [],
            events: [
              { nodeId: 'nx', nodeType: 'http', nodeLabel: 'nx', timestamp: 1, state: 'pass', durationMs: 10 },
            ],
          },
        ],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={traceName} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('OnlyName');
    });

    it('CSV escapes quotes in node labels', () => {
      const traceQuoted: WorkflowExecutionTrace = {
        ...mockTrace,
        workflowSnapshot: {
          ...mockTrace.workflowSnapshot,
          nodes: mockTrace.workflowSnapshot.nodes.map(n =>
            n.id === 'n2' ? { ...n, data: { label: 'Try "quotes"' } } : n,
          ),
        },
      };
      render(<WorkflowResultsExplorerModal trace={traceQuoted} onClose={mockOnClose} />);
      openExportMenu();
      fireEvent.click(screen.getByTestId('export-csv-btn'));
      const csvContent = mockSaveCsvFile.mock.calls[0][0] as string;
      expect(csvContent).toContain('""');
    });
  });

});
