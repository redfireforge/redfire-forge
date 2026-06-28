/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoWorkflowBridge } from './useDemoWorkflowBridge';

describe('useDemoWorkflowBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
    delete (window as unknown as Record<string, unknown>).__wfGetWorkflowByName;
    delete (window as unknown as Record<string, unknown>).__wfSelectByName;
    delete (window as unknown as Record<string, unknown>).__wfRunnerSelectByName;
    delete (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName;
    delete (window as unknown as Record<string, unknown>).__wfWorkflowsLoaded;
  });

  it('exposes __wfDeleteByName on window', () => {
    const remove = vi.fn();
    renderHook(() => useDemoWorkflowBridge([{ id: '1', name: 'WF1' }], remove));
    expect((window as unknown as Record<string, unknown>).__wfDeleteByName).toBeTypeOf('function');
  });

  it('deletes workflow by name', () => {
    const remove = vi.fn();
    renderHook(() => useDemoWorkflowBridge([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }], remove));
    const fn = (window as unknown as Record<string, (name: string) => void>).__wfDeleteByName;
    fn('Beta');
    expect(remove).toHaveBeenCalledWith('b');
  });

  it('does nothing when workflow name not found', () => {
    const remove = vi.fn();
    renderHook(() => useDemoWorkflowBridge([{ id: 'a', name: 'Alpha' }], remove));
    const fn = (window as unknown as Record<string, (name: string) => void>).__wfDeleteByName;
    fn('NonExistent');
    expect(remove).not.toHaveBeenCalled();
  });

  it('cleans up on unmount', () => {
    const remove = vi.fn();
    const { unmount } = renderHook(() => useDemoWorkflowBridge([], remove));
    expect((window as unknown as Record<string, unknown>).__wfDeleteByName).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfDeleteByName).toBeUndefined();
  });

  // ── __wfInsertWorkflow ──

  it('does not expose __wfInsertWorkflow when insert is not provided', () => {
    const remove = vi.fn();
    renderHook(() => useDemoWorkflowBridge([], remove));
    expect((window as unknown as Record<string, unknown>).__wfInsertWorkflow).toBeUndefined();
  });

  it('exposes __wfInsertWorkflow on window when insert is provided', () => {
    const remove = vi.fn();
    const insert = vi.fn();
    renderHook(() => useDemoWorkflowBridge([], remove, insert));
    expect((window as unknown as Record<string, unknown>).__wfInsertWorkflow).toBeTypeOf('function');
  });

  it('calls insert when __wfInsertWorkflow is invoked', () => {
    const remove = vi.fn();
    const insert = vi.fn();
    renderHook(() => useDemoWorkflowBridge([], remove, insert));
    const fn = (window as unknown as Record<string, (wf: object) => void>).__wfInsertWorkflow;
    const wf = { id: 'x', name: 'Test WF' };
    fn(wf);
    expect(insert).toHaveBeenCalledWith(wf);
  });

  it('cleans up __wfInsertWorkflow on unmount', () => {
    const remove = vi.fn();
    const insert = vi.fn();
    const { unmount } = renderHook(() => useDemoWorkflowBridge([], remove, insert));
    expect((window as unknown as Record<string, unknown>).__wfInsertWorkflow).toBeDefined();
    unmount();
    expect((window as unknown as Record<string, unknown>).__wfInsertWorkflow).toBeUndefined();
  });

  it('__wfGetWorkflowByName returns workflow snapshot by name', () => {
    const wf = {
      id: 'wf-1',
      name: 'Demo WF',
      nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } }],
      edges: [],
      variables: {},
    } as import('../../features/workflow/types/workflow').Workflow;
    renderHook(() => useDemoWorkflowBridge([wf], vi.fn()));
    const get = (window as unknown as Record<string, (name: string) => typeof wf | null>).__wfGetWorkflowByName;
    expect(get('Demo WF')).toBe(wf);
    expect(get('Missing')).toBeNull();
  });

  it('__wfSelectByName selects workflow by exact name when select is provided', () => {
    const wf = { id: 'wf-1', name: 'Demo WF' } as import('../../features/workflow/types/workflow').Workflow;
    const select = vi.fn();
    renderHook(() => useDemoWorkflowBridge([wf], vi.fn(), vi.fn(), select));
    const fn = (window as unknown as Record<string, (name: string) => boolean>).__wfSelectByName;
    expect(fn('Demo WF')).toBe(true);
    expect(select).toHaveBeenCalledWith('wf-1');
    expect(fn('Missing')).toBe(false);
  });

  it('__wfRunnerSelectByName delegates to selectRunnerByName when provided', () => {
    const selectRunner = vi.fn((name: string) => name === 'GraphQL Latency Demo');
    renderHook(() => useDemoWorkflowBridge([], vi.fn(), undefined, undefined, false, undefined, selectRunner));
    const fn = (window as unknown as Record<string, (name: string) => boolean>).__wfRunnerSelectByName;
    expect(fn('GraphQL Latency Demo')).toBe(true);
    expect(selectRunner).toHaveBeenCalledWith('GraphQL Latency Demo');
    expect(fn('Missing')).toBe(false);
  });

  it('__wfGetWorkflowByName sees workflows updated on the same mount (ref, not stale closure)', () => {
    const remove = vi.fn();
    const { rerender } = renderHook(
      ({ list }) => useDemoWorkflowBridge(list, remove),
      { initialProps: { list: [] as import('../../features/workflow/types/workflow').Workflow[] } },
    );
    const get = (window as unknown as Record<string, (name: string) => unknown>).__wfGetWorkflowByName;
    expect(get('GraphQL User CRUD Demo')).toBeNull();

    const wf = {
      id: 'crud-1',
      name: 'GraphQL User CRUD Demo',
      nodes: [],
      edges: [],
    } as import('../../features/workflow/types/workflow').Workflow;
    rerender({ list: [wf] });
    expect(get('GraphQL User CRUD Demo')).toBe(wf);
  });

  it('exposes __wfWorkflowsLoaded when loaded flips true', () => {
    const { rerender } = renderHook(
      ({ loaded }) => useDemoWorkflowBridge([], vi.fn(), undefined, undefined, loaded),
      { initialProps: { loaded: false } },
    );
    expect((window as unknown as Record<string, unknown>).__wfWorkflowsLoaded).toBe(false);
    rerender({ loaded: true });
    expect((window as unknown as Record<string, unknown>).__wfWorkflowsLoaded).toBe(true);
  });

  it('__wfPatchWorkflowByName merges patch when update is provided', () => {
    const wf = {
      id: 'wf-1',
      name: 'GraphQL Latency Demo',
      nodes: [],
      edges: [],
      variables: {},
    } as import('../../features/workflow/types/workflow').Workflow;
    const update = vi.fn();
    const sync = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfSyncLiveWorkflowFromPatch = sync;
    renderHook(() => useDemoWorkflowBridge([wf], vi.fn(), undefined, undefined, true, update));
    const patch = (window as unknown as Record<string, (name: string, p: object) => boolean>).__wfPatchWorkflowByName;
    expect(patch('GraphQL Latency Demo', { variables: { graphqlUrl: 'http://localhost:4010/graphql' } })).toBe(true);
    expect(update).toHaveBeenCalledWith('wf-1', { variables: { graphqlUrl: 'http://localhost:4010/graphql' } });
    expect(sync).toHaveBeenCalledWith('GraphQL Latency Demo', { variables: { graphqlUrl: 'http://localhost:4010/graphql' } });
    expect(patch('Missing', { variables: {} })).toBe(false);
  });

  it('does not expose __wfPatchWorkflowByName when update is not provided', () => {
    renderHook(() => useDemoWorkflowBridge([], vi.fn()));
    expect((window as unknown as Record<string, unknown>).__wfPatchWorkflowByName).toBeTypeOf('function');
    const patch = (window as unknown as Record<string, (name: string, p: object) => boolean>).__wfPatchWorkflowByName;
    expect(patch('Any', { variables: {} })).toBe(false);
  });
});
