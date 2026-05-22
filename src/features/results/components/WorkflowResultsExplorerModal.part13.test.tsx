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

describe('WorkflowResultsExplorerModal — part13', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastCanvasTraceRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('node double-click (sub-workflow drill)', () => {
    const childTrace: WorkflowExecutionTrace = {
      workflowId: 'child-wf-1',
      workflowName: 'Child Workflow',
      workflowSnapshot: {
        nodes: [
          { id: 'c1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Child Start' } },
          { id: 'c2', type: 'http', position: { x: 100, y: 0 }, data: { label: 'Child HTTP' } },
        ],
        edges: [{ id: 'ce1', source: 'c1', target: 'c2' }],
      },
      iterations: [{
        index: 0,
        passed: true,
        durationMs: 50,
        traversedEdges: ['ce1'],
        events: [
          { nodeId: 'c1', nodeType: 'start', nodeLabel: 'Child Start', timestamp: 1050, state: 'pass' },
          { nodeId: 'c2', nodeType: 'http', nodeLabel: 'Child HTTP', timestamp: 1060, state: 'pass', durationMs: 30 },
        ],
        finalVariables: {},
      }],
      traversedEdges: ['ce1'],
      totalIterations: 1,
      totalDurationMs: 50,
    };

    const baseSubWorkflowIter = {
      index: 0,
      passed: true,
      durationMs: 100,
      traversedEdges: ['pe1', 'pe2'] as string[],
      events: [
        { nodeId: 'p1', nodeType: 'start' as const, nodeLabel: 'Start', timestamp: 1000, state: 'pass' as const },
        {
          nodeId: 'sub1',
          nodeType: 'subWorkflow' as const,
          nodeLabel: 'Run Child',
          timestamp: 1010,
          state: 'pass' as const,
          durationMs: 50,
          details: {
            subWorkflowId: 'child-wf-1',
            subWorkflowPassed: true,
            subWorkflowTrace: childTrace,
          },
        },
        { nodeId: 'p2', nodeType: 'end' as const, nodeLabel: 'End', timestamp: 1060, state: 'pass' as const },
      ],
      finalVariables: {},
    };

    const traceWithSubWorkflow: WorkflowExecutionTrace = {
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
      iterations: [{ ...baseSubWorkflowIter }],
      traversedEdges: ['pe1', 'pe2'],
      totalIterations: 1,
      totalDurationMs: 100,
    };

    it('double-click drills into sub-workflow when child trace is present', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.getByTestId('sub-workflow-breadcrumb')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-1')).toHaveTextContent('Child Workflow');
    });

    it('double-click ignores empty node id', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-empty'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });

    it('double-click ignores non-subWorkflow nodes', () => {
      render(<WorkflowResultsExplorerModal trace={traceWithSubWorkflow} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-n2'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });

    it('double-click does not drill when subWorkflow details omit child trace', () => {
      const traceNoPayload: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [{
          ...baseSubWorkflowIter,
          events: baseSubWorkflowIter.events.map((e) => {
            if (e.nodeId !== 'sub1') return e;
            return {
              ...e,
              details: { subWorkflowId: 'child-wf-1', subWorkflowPassed: true },
            };
          }),
        }],
      };
      render(<WorkflowResultsExplorerModal trace={traceNoPayload} onClose={mockOnClose} />);
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });

    it('uses getIterationByIndex when an iteration is pinned for double-click context', () => {
      const subEventNoTrace = {
        nodeId: 'sub1',
        nodeType: 'subWorkflow' as const,
        nodeLabel: 'Run Child',
        timestamp: 1010,
        state: 'pass' as const,
        durationMs: 50,
        details: { subWorkflowId: 'child-wf-1', subWorkflowPassed: true },
      };
      const traceMulti: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [
          { ...baseSubWorkflowIter, index: 0, events: [...baseSubWorkflowIter.events.slice(0, 1), subEventNoTrace, baseSubWorkflowIter.events[2]] },
          { ...baseSubWorkflowIter, index: 1 },
        ],
        totalIterations: 2,
        totalDurationMs: 200,
      };

      render(<WorkflowResultsExplorerModal trace={traceMulti} onClose={mockOnClose} />);

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.getByTestId('sub-workflow-breadcrumb')).toBeInTheDocument();
    });

    it('uses last iteration when aggregate view looks up double-click context', () => {
      const subEventNoTrace = {
        nodeId: 'sub1',
        nodeType: 'subWorkflow' as const,
        nodeLabel: 'Run Child',
        timestamp: 1010,
        state: 'pass' as const,
        durationMs: 50,
        details: { subWorkflowId: 'child-wf-1', subWorkflowPassed: true },
      };
      const traceMulti: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [
          { ...baseSubWorkflowIter, index: 0, events: [...baseSubWorkflowIter.events.slice(0, 1), subEventNoTrace, baseSubWorkflowIter.events[2]] },
          { ...baseSubWorkflowIter, index: 1 },
        ],
        totalIterations: 2,
        totalDurationMs: 200,
      };

      render(<WorkflowResultsExplorerModal trace={traceMulti} onClose={mockOnClose} />);
      fireEvent.keyDown(window, { key: 'a' });

      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.getByTestId('sub-workflow-breadcrumb')).toBeInTheDocument();
    });

    it('returns early when pinned iteration lookup yields no iteration row', () => {
      const traceGapIndex: WorkflowExecutionTrace = {
        ...traceWithSubWorkflow,
        iterations: [{ ...baseSubWorkflowIter, index: 1 }],
        totalIterations: 1,
      };
      render(<WorkflowResultsExplorerModal trace={traceGapIndex} onClose={mockOnClose} />);

      fireEvent.click(screen.getByTestId('canvas-dbl-sub1'));
      expect(screen.queryByTestId('sub-workflow-breadcrumb')).not.toBeInTheDocument();
    });
  });

});
