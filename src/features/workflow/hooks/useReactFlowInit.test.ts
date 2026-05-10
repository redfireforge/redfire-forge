/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowPreviewReactFlowInit } from './useWorkflowPreviewReactFlowInit';
import type { Workflow } from '../types/workflow';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import { getAutoLayoutNodes } from '../utils/workflowAutoLayout';

vi.mock('../utils/workflowAutoLayout', () => ({
  getAutoLayoutNodes: vi.fn((n: WorkflowRFNode[]) => n),
}));

const mockGetAutoLayout = vi.mocked(getAutoLayoutNodes);

const wf: Workflow = {
  id: 'pv-1',
  name: 'Preview',
  schemaVersion: 6,
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
};

describe('useWorkflowPreviewReactFlowInit (React Flow preview onInit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stable onInit callback', () => {
    const setLaidOutId = vi.fn();
    const { result, rerender } = renderHook(
      ({ w }) => useWorkflowPreviewReactFlowInit(w, setLaidOutId),
      { initialProps: { w: wf as Workflow | null } },
    );
    const first = result.current;
    rerender({ w: wf });
    expect(result.current).toBe(first);
  });

  it('runs layout pipeline when preview workflow exists and nodes are measured', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setLaidOutId = vi.fn();
    const laid: WorkflowRFNode[] = [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} as never }];
    mockGetAutoLayout.mockReturnValue(laid);

    const setNodes = vi.fn();
    const fitView = vi.fn();
    const instance = {
      getNodes: vi.fn(() => [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} as never }] as WorkflowRFNode[]),
      getEdges: vi.fn(() => [] as WorkflowRFEdge[]),
      setNodes,
      fitView,
    };

    const { result } = renderHook(() => useWorkflowPreviewReactFlowInit(wf, setLaidOutId));

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      await Promise.resolve();
      for (let i = 0; i < 4; i++) {
        // Flush nested rAF from useWorkflowPreviewReactFlowInit
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    });

    expect(mockGetAutoLayout).toHaveBeenCalled();
    expect(setNodes).toHaveBeenCalledWith(laid);
    expect(fitView).toHaveBeenCalledWith({ padding: 0.15, maxZoom: 1, duration: 0 });
    expect(setLaidOutId).toHaveBeenCalledWith('pv-1');
  });

  it('sets laid out id without layout when no measured nodes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setLaidOutId = vi.fn();

    const instance = {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      fitView: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowPreviewReactFlowInit(wf, setLaidOutId));

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(mockGetAutoLayout).not.toHaveBeenCalled();
    expect(setLaidOutId).toHaveBeenCalledWith('pv-1');
  });

  it('no-ops when previewWorkflow is null', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setLaidOutId = vi.fn();
    const instance = {
      getNodes: vi.fn(() => [{ id: 'x', type: 'start', position: { x: 0, y: 0 }, data: {} as never }]),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      fitView: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowPreviewReactFlowInit(null, setLaidOutId));

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(instance.getNodes).not.toHaveBeenCalled();
    expect(setLaidOutId).not.toHaveBeenCalled();
  });
});
