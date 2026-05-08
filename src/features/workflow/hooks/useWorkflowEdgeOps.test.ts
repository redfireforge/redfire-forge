/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowEdgeOps } from './useWorkflowEdgeOps';
import type { WorkflowRFEdge, WorkflowRFNode } from '../utils/workflowNodeFactory';
import type { Workflow } from '../types/workflow';
import type { NodeRunStatus } from './useWorkflowRunCache';

const wf: Workflow = { id: 'w1' } as unknown as Workflow;

function makeEdges(initial: WorkflowRFEdge[] = []) {
  let edges = initial;
  const setEdges = vi.fn((u: unknown) => {
    edges = typeof u === 'function' ? (u as (e: WorkflowRFEdge[]) => WorkflowRFEdge[])(edges) : (u as WorkflowRFEdge[]);
  });
  return { setEdges, get: () => edges };
}

function setup(opts?: {
  selected?: Workflow | null;
  initialEdges?: WorkflowRFEdge[];
  nodeStatuses?: Record<string, NodeRunStatus>;
}) {
  const e = makeEdges(opts?.initialEdges);
  const update = vi.fn();
  const takeSnapshot = vi.fn();
  const serializeNodes = vi.fn((n: WorkflowRFNode[]) => n.map(x => ({ id: x.id })));
  const r = renderHook(({ statuses }) => useWorkflowEdgeOps({
    selected: opts && 'selected' in opts ? opts.selected ?? null : wf,
    nodes: [{ id: 'a' } as WorkflowRFNode, { id: 'b' } as WorkflowRFNode],
    setEdges: e.setEdges as unknown as React.Dispatch<React.SetStateAction<WorkflowRFEdge[]>>,
    serializeNodes,
    update,
    undoRedo: { takeSnapshot },
    nodeStatuses: statuses,
  }), { initialProps: { statuses: opts?.nodeStatuses ?? {} as Record<string, NodeRunStatus> } });
  return { ...r, e, update, takeSnapshot, serializeNodes };
}

describe('useWorkflowEdgeOps', () => {
  it('onConnect adds edge with uuid id and snapshot', async () => {
    const { result, e, takeSnapshot, update } = setup();
    act(() => result.current.onConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null }));
    expect(takeSnapshot).toHaveBeenCalledWith('Add connection');
    expect(e.get()).toHaveLength(1);
    expect(e.get()[0].source).toBe('a');
    expect(e.get()[0].id).toMatch(/[0-9a-f-]{36}/);
    await new Promise(r => queueMicrotask(() => r(null)));
    expect(update).toHaveBeenCalledWith('w1', expect.objectContaining({ edges: expect.any(Array) }));
  });

  it('onConnect labels true/false branches', () => {
    const { result, e } = setup();
    act(() => result.current.onConnect({ source: 'a', target: 'b', sourceHandle: 'true', targetHandle: null }));
    expect(e.get()[0].label).toBe('Yes');
    act(() => result.current.onConnect({ source: 'a', target: 'b', sourceHandle: 'false', targetHandle: null }));
    expect(e.get()[1].label).toBe('No');
  });

  it('onConnect skips persistence when no selected workflow', async () => {
    const { result, update } = setup({ selected: null });
    act(() => result.current.onConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null }));
    await new Promise(r => queueMicrotask(() => r(null)));
    expect(update).not.toHaveBeenCalled();
  });

  it('onReconnect calls setEdges with reconnected edges', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: null, label: 'Yes' } as unknown as WorkflowRFEdge];
    const { result, e } = setup({ initialEdges: initial });
    act(() => result.current.onReconnect(initial[0], { source: 'a', target: 'b', sourceHandle: 'false', targetHandle: null }));
    expect(e.setEdges).toHaveBeenCalled();
    expect(e.get().length).toBeGreaterThan(0);
  });

  it('applies edge classNames from nodeStatuses', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBe('wf-edge-pass');
  });

  it('marks running target as animated', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { b: { state: 'running' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBe('wf-edge-animated');
  });

  it('clears classNames when statuses become empty', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', className: 'wf-edge-pass' } as unknown as WorkflowRFEdge];
    const { rerender, e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    rerender({ statuses: {} as Record<string, NodeRunStatus> });
    expect(e.get()[0].className).toBeUndefined();
  });

  it('marks skipped targets', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'skipped' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBe('wf-edge-skipped');
  });

  it('marks edge as fail when source is pass and target is fail', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'fail' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBe('wf-edge-fail');
  });

  it('marks edge as fail when both source and target are fail', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'fail' }, b: { state: 'fail' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBe('wf-edge-fail');
  });


  it('does not modify edge when className is unchanged', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', className: 'wf-edge-pass' } as unknown as WorkflowRFEdge];
    const { e, rerender } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    const firstEdge = e.get()[0];
    // Re-render with same statuses - edge should not change identity
    rerender({ statuses: { a: { state: 'pass' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus> });
    expect(e.get()[0]).toBe(firstEdge);
  });

  it('does not reset edges when none have className', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e, rerender } = setup({
      initialEdges: initial,
      nodeStatuses: {},
    });
    const firstEdge = e.get()[0];
    // Re-render with empty statuses - edge should remain unchanged since it has no className
    rerender({ statuses: {} as Record<string, NodeRunStatus> });
    expect(e.get()[0]).toBe(firstEdge);
  });
});
