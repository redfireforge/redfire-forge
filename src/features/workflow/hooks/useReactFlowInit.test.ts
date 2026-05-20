/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowPreviewReactFlowInit } from './useWorkflowPreviewReactFlowInit';
import { Workflow } from '../types/workflow';
import { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
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
      ({ w }) => useWorkflowPreviewReactFlowInit(w, null, setLaidOutId),
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
      setViewport: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowPreviewReactFlowInit(wf, null, setLaidOutId));

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(150);
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
      setViewport: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowPreviewReactFlowInit(wf, null, setLaidOutId));

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(mockGetAutoLayout).not.toHaveBeenCalled();
    expect(setLaidOutId).toHaveBeenCalledWith('pv-1');
  });

  it('auto-layouts and fits when no preview and no saved viewport', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setLaidOutId = vi.fn();
    const laid: WorkflowRFNode[] = [{ id: 'x', type: 'start', position: { x: 10, y: 20 }, data: {} as never }];
    mockGetAutoLayout.mockReturnValue(laid);
    const instance = {
      getNodes: vi.fn(() => [{ id: 'x', type: 'start', position: { x: 0, y: 0 }, data: {} as never }] as WorkflowRFNode[]),
      getEdges: vi.fn(() => [] as WorkflowRFEdge[]),
      setNodes: vi.fn(),
      fitView: vi.fn(),
      setViewport: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowPreviewReactFlowInit(null, null, setLaidOutId));

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(150);
    });

    await act(async () => {
      await Promise.resolve();
      for (let i = 0; i < 4; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    });

    expect(mockGetAutoLayout).toHaveBeenCalled();
    expect(instance.setNodes).toHaveBeenCalledWith(laid);
    expect(instance.fitView).toHaveBeenCalledWith({ padding: 0.1, maxZoom: 1, duration: 200 });
    expect(setLaidOutId).not.toHaveBeenCalled();
  });

  it('first-load path skips layout when there are zero measured nodes (no saved viewport)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setLaidOutId = vi.fn();

    const instance = {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      fitView: vi.fn(),
      setViewport: vi.fn(),
    };

    const selectedNoViewport = { ...wf, id: 'no-vp', savedViewport: undefined };
    const { result } = renderHook(() =>
      useWorkflowPreviewReactFlowInit(null, selectedNoViewport, setLaidOutId),
    );

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(mockGetAutoLayout).not.toHaveBeenCalled();
    expect(instance.setNodes).not.toHaveBeenCalled();
    expect(instance.fitView).not.toHaveBeenCalled();
    expect(setLaidOutId).not.toHaveBeenCalled();
  });

  it('restores saved viewport when selectedWorkflow has savedViewport', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setLaidOutId = vi.fn();
    const savedVp = { x: 100, y: 200, zoom: 0.8 };
    const selectedWf = { ...wf, id: 'saved-1', savedViewport: savedVp };
    const instance = {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      fitView: vi.fn(),
      setViewport: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowPreviewReactFlowInit(null, selectedWf, setLaidOutId));

    await act(async () => {
      result.current(instance);
      vi.advanceTimersByTime(150);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    });

    expect(instance.setViewport).toHaveBeenCalledWith(savedVp, { duration: 0 });
    expect(instance.fitView).not.toHaveBeenCalled();
  });
});
