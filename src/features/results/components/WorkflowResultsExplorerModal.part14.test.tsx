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

describe('WorkflowResultsExplorerModal — part14', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('workflow-info after sub-workflow drill-down', () => {
    /* reuses fixtures from sibling describe via inline minimal trace */
    it('shows parent workflow label in workflow-info on drilled child canvas', () => {
      const childTrace: WorkflowExecutionTrace = {
        workflowId: 'child-wf-1',
        workflowName: 'Child Workflow',
        workflowSnapshot: {
          nodes: [
            { id: 'c1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Child Start' } },
          ],
          edges: [],
        },
        iterations: [{
          index: 0,
          passed: true,
          durationMs: 10,
          traversedEdges: [],
          events: [{ nodeId: 'c1', nodeType: 'start' as const, nodeLabel: 'CS', timestamp: 1, state: 'pass' as const }],
          finalVariables: {},
        }],
        traversedEdges: [],
        totalIterations: 1,
        totalDurationMs: 10,
      };
      const parent: WorkflowExecutionTrace = {
        workflowId: 'parent-wf',
        workflowName: 'Parent Workflow',
        workflowSnapshot: {
          nodes: [
            { id: 'p1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
            { id: 'sub1', type: 'subWorkflow', position: { x: 100, y: 0 }, data: { label: 'Run Child' } },
            { id: 'p2', type: 'end', position: { x: 200, y: 0 }, data: { label: 'End' } },
          ],
          edges: [
            { id: 'pe1', source: 'p1', target: 'sub1' },
            { id: 'pe2', source: 'sub1', target: 'p2' },
          ],
        },
        iterations: [{
          index: 0,
          passed: true,
          durationMs: 100,
          traversedEdges: ['pe1', 'pe2'],
          events: [
            { nodeId: 'p1', nodeType: 'start' as const, nodeLabel: 'Start', timestamp: 1000, state: 'pass' as const },
            {
              nodeId: 'sub1',
              nodeType: 'subWorkflow' as const,
              nodeLabel: 'Run Child',
              timestamp: 1010,
              state: 'pass' as const,
              details: {
                subWorkflowId: 'child-wf-1',
                subWorkflowPassed: true,
                subWorkflowTrace: childTrace,
              },
            },
            { nodeId: 'p2', nodeType: 'end' as const, nodeLabel: 'End', timestamp: 1060, state: 'pass' as const },
          ],
          finalVariables: {},
        }],
        traversedEdges: ['pe1', 'pe2'],
        totalIterations: 1,
        totalDurationMs: 100,
      };

      render(<WorkflowResultsExplorerModal trace={parent} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-pick-sub1'));
      fireEvent.click(screen.getByTestId('mock-drilldown-btn'));

      const info = screen.getByTestId('workflow-info');
      expect(info.querySelector('.workflow-info-name')).toHaveTextContent('Child Workflow');
      expect(screen.getByText(/^Parent:$/)).toBeInTheDocument();
      expect(screen.getByTestId('workflow-info').querySelector('.workflow-info-parent-name'))
        .toHaveTextContent('Parent Workflow');
      expect(screen.queryByText('Root Workflow')).not.toBeInTheDocument();
    });
  });

});
