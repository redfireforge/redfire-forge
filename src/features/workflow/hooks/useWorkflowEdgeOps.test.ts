/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import type { Connection, Edge } from '@xyflow/react';

vi.mock('@xyflow/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...mod,
    reconnectEdge: (oldEdge: Edge, connection: Connection, edges: Edge[]) => {
      const rest = edges.filter((e) => e.id !== oldEdge.id);
      return [
        ...rest,
        {
          ...oldEdge,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        },
      ];
    },
  };
});

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
    expect(e.get()).toHaveLength(1);
    expect(e.get()[0].label).toBe('No');
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
    rerender({ statuses: {} as Record<string, NodeRunStatus> });
    expect(e.get()[0]).toBe(firstEdge);
  });

  it('onReconnect processes edges through label mapping', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: null, label: undefined } as unknown as WorkflowRFEdge];
    const { result, e } = setup({ initialEdges: initial });
    act(() => result.current.onReconnect(initial[0], { source: 'a', target: 'b', sourceHandle: 'true', targetHandle: null }));
    expect(e.get()).toHaveLength(1);
    expect(e.get()[0].label).toBe('Yes');
  });

  it('onReconnect preserves label=No for false sourceHandle on matched edge', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'false' } as unknown as WorkflowRFEdge];
    const { result, e } = setup({ initialEdges: initial });
    act(() => result.current.onReconnect(initial[0], { source: 'a', target: 'b', sourceHandle: 'false', targetHandle: null }));
    expect(e.get()).toHaveLength(1);
    expect(e.get()[0].label).toBe('No');
  });

  it('assigns no className when source is fail and target is pass', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'fail' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBeUndefined();
  });

  it('assigns no className when only source has status', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBeUndefined();
  });

  it('drops non-string edge labels during persistence', async () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', label: 123 as unknown as string } as unknown as WorkflowRFEdge];
    const { result, update } = setup({ initialEdges: initial });
    act(() => result.current.onConnect({ source: 'a', target: 'c', sourceHandle: null, targetHandle: null }));
    await new Promise(r => queueMicrotask(() => r(null)));
    expect(update).toHaveBeenCalled();
    const callArgs = update.mock.calls[0][1] as { edges: Array<{ label?: string }> };
    const e1Edge = callArgs.edges.find((edge: { id?: string }) => (edge as { id: string }).id === 'e1');
    if (e1Edge) {
      expect(e1Edge.label).toBeUndefined();
    }
  });

  it('onConnect with non-boolean sourceHandle sets no label', () => {
    const { result, e } = setup();
    act(() => result.current.onConnect({ source: 'a', target: 'b', sourceHandle: 'output', targetHandle: null }));
    expect(e.get()[0].label).toBeUndefined();
  });

  it('onReconnect leaves other edges untouched when reconnecting one of multiple', () => {
    const e1 = { id: 'e1', source: 'a', target: 'b', sourceHandle: null } as unknown as WorkflowRFEdge;
    const e2 = { id: 'e2', source: 'b', target: 'a', sourceHandle: null } as unknown as WorkflowRFEdge;
    const { result, e } = setup({ initialEdges: [e1, e2] });
    act(() => result.current.onReconnect(e1, { source: 'a', target: 'c', sourceHandle: 'true', targetHandle: null }));
    const edges = e.get();
    expect(edges).toHaveLength(2);
    const other = edges.find((edge) => edge.id === 'e2');
    expect(other).toBe(e2);
  });

  it('onReconnect sets label undefined when sourceHandle is null', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: null } as unknown as WorkflowRFEdge];
    const { result, e } = setup({ initialEdges: initial });
    act(() => result.current.onReconnect(initial[0], { source: 'a', target: 'b', sourceHandle: null, targetHandle: null }));
    expect(e.get()[0].label).toBeUndefined();
  });

  it('onReconnect sets label undefined when sourceHandle is neither true nor false', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: null } as unknown as WorkflowRFEdge];
    const { result, e } = setup({ initialEdges: initial });
    act(() => result.current.onReconnect(initial[0], { source: 'a', target: 'b', sourceHandle: 'output', targetHandle: null }));
    expect(e.get()[0].label).toBeUndefined();
  });

  it('onConnect adds wf-edge-false-branch className for false sourceHandle', () => {
    const { result, e } = setup();
    act(() => result.current.onConnect({ source: 'a', target: 'b', sourceHandle: 'false', targetHandle: null }));
    expect(e.get()[0].className).toBe('wf-edge-false-branch');
  });

  it('onConnect adds no className for true sourceHandle', () => {
    const { result, e } = setup();
    act(() => result.current.onConnect({ source: 'a', target: 'b', sourceHandle: 'true', targetHandle: null }));
    expect(e.get()[0].className).toBeUndefined();
  });

  it('preserves false-branch class during execution state updates', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'false' } as unknown as WorkflowRFEdge];
    const { e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get()[0].className).toBe('wf-edge-false-branch wf-edge-pass');
  });

  it('preserves false-branch class when statuses are cleared', () => {
    const initial: WorkflowRFEdge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'false', className: 'wf-edge-false-branch wf-edge-pass' } as unknown as WorkflowRFEdge];
    const { rerender, e } = setup({
      initialEdges: initial,
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    rerender({ statuses: {} as Record<string, NodeRunStatus> });
    expect(e.get()[0].className).toBe('wf-edge-false-branch');
  });

  it('when clearing statuses, only strips className on edges that had one', () => {
    const bare = { id: 'e2', source: 'x', target: 'y' } as unknown as WorkflowRFEdge;
    const active = { id: 'e1', source: 'a', target: 'b' } as unknown as WorkflowRFEdge;
    const { rerender, e } = setup({
      initialEdges: [active, bare],
      nodeStatuses: { a: { state: 'pass' }, b: { state: 'pass' } } as unknown as Record<string, NodeRunStatus>,
    });
    expect(e.get().find((x) => x.id === 'e1')?.className).toBe('wf-edge-pass');
    expect(e.get().find((x) => x.id === 'e2')?.className).toBeUndefined();
    const bareBefore = e.get().find((x) => x.id === 'e2');
    rerender({ statuses: {} as Record<string, NodeRunStatus> });
    const edges = e.get();
    expect(edges.find((x) => x.id === 'e1')?.className).toBeUndefined();
    expect(edges.find((x) => x.id === 'e2')).toBe(bareBefore);
  });
});
