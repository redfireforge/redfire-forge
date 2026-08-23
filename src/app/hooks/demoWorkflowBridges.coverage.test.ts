/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useDemoWorkflowBridge,
} from './useDemoWorkflowBridge';
import {
  useDemoWorkflowCanvasBridge,
  patchDemoWorkflowNodeDataById,
  patchDemoWorkflowNodeDataByType,
} from './useDemoWorkflowCanvasBridge';
import { useDemoWorkflowLivePatchSync } from './useDemoWorkflowLivePatchSync';
import { resetDemoWorkflowRunState, useDemoWorkflowRunBridge } from './useDemoWorkflowRunBridge';
import { closeDemoWorkflowConfigModal, useDemoWorkflowConfigModalBridge } from './useDemoWorkflowConfigModalBridge';
import type { Workflow } from '@workflow/types/workflow';

describe('demo workflow bridges coverage', () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.__wfDeleteByName;
    delete w.__wfInsertWorkflow;
    delete w.__wfGetWorkflowByName;
    delete w.__wfSelectByName;
    delete w.__wfRunnerSelectByName;
    delete w.__wfPatchWorkflowByName;
    delete w.__wfWorkflowsLoaded;
    delete w.__wfPatchNodeDataByType;
    delete w.__wfPatchNodeDataById;
    delete w.__wfSyncLiveWorkflowFromPatch;
    delete w.__wfResetRunState;
    delete w.__wfQuickTest;
    delete w.__wfCloseConfigModal;
  });

  it('covers workflow bridge operations and branches', () => {
    const remove = vi.fn();
    const insert = vi.fn();
    const select = vi.fn();
    const update = vi.fn();
    const selectRunner = vi.fn((name: string) => name === 'WF');
    const sync = vi.fn();
    (window as unknown as Record<string, unknown>).__wfSyncLiveWorkflowFromPatch = sync;

    const wf: Workflow = {
      id: 'wf-1',
      name: 'WF',
      nodes: [],
      edges: [],
      variables: {},
    };

    renderHook(() => useDemoWorkflowBridge([wf], remove, insert, select, true, update, selectRunner));

    const w = window as unknown as {
      __wfDeleteByName: (name: string) => void;
      __wfInsertWorkflow?: (workflow: Workflow) => void;
      __wfGetWorkflowByName: (name: string) => Workflow | null;
      __wfSelectByName: (name: string) => boolean;
      __wfRunnerSelectByName: (name: string) => boolean;
      __wfPatchWorkflowByName: (name: string, patch: Record<string, unknown>) => boolean;
      __wfWorkflowsLoaded: boolean;
    };
    w.__wfDeleteByName('WF');
    w.__wfDeleteByName('missing');
    expect(remove).toHaveBeenCalledWith('wf-1');

    w.__wfInsertWorkflow?.(wf);
    expect(insert).toHaveBeenCalledWith(wf);
    expect(w.__wfGetWorkflowByName('WF')).toBe(wf);
    expect(w.__wfGetWorkflowByName('missing')).toBeNull();

    expect(w.__wfSelectByName('WF')).toBe(true);
    expect(w.__wfSelectByName('missing')).toBe(false);
    expect(select).toHaveBeenCalledWith('wf-1');

    expect(w.__wfRunnerSelectByName('WF')).toBe(true);
    expect(w.__wfRunnerSelectByName('other')).toBe(false);

    expect(w.__wfPatchWorkflowByName('WF', { variables: { a: '1' } })).toBe(true);
    expect(w.__wfPatchWorkflowByName('missing', { variables: {} })).toBe(false);
    expect(update).toHaveBeenCalledWith('wf-1', { variables: { a: '1' } });
    expect(sync).toHaveBeenCalledWith('WF', { variables: { a: '1' } });

    expect(w.__wfWorkflowsLoaded).toBe(true);
  });

  it('covers select/runner/patch false branches when callbacks are absent', () => {
    renderHook(() => useDemoWorkflowBridge([], vi.fn()));
    const w = window as unknown as {
      __wfSelectByName: (name: string) => boolean;
      __wfRunnerSelectByName: (name: string) => boolean;
      __wfPatchWorkflowByName: (name: string, patch: Record<string, unknown>) => boolean;
    };
    expect(w.__wfSelectByName('WF')).toBe(false);
    expect(w.__wfRunnerSelectByName('WF')).toBe(false);
    expect(w.__wfPatchWorkflowByName('WF', { variables: {} })).toBe(false);
  });

  it('covers canvas bridge wrappers and miss paths', () => {
    const handleUpdateNode = vi.fn();
    const nodes = [
      { id: 'n1', type: 'graphqlQuery', position: { x: 0, y: 0 }, data: { label: 'Q' } },
    ] as never[];

    renderHook(() => useDemoWorkflowCanvasBridge(nodes, handleUpdateNode));

    expect(patchDemoWorkflowNodeDataByType('graphqlQuery', { endpoint: 'x' })).toBe(true);
    expect(patchDemoWorkflowNodeDataByType('missing', { endpoint: 'x' })).toBe(false);
    expect(patchDemoWorkflowNodeDataById('n1', { label: 'Updated' })).toBe(true);
    expect(patchDemoWorkflowNodeDataById('missing', { label: 'x' })).toBe(false);
    expect(handleUpdateNode).toHaveBeenCalledTimes(2);

    delete (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType;
    delete (window as unknown as Record<string, unknown>).__wfPatchNodeDataById;
    expect(patchDemoWorkflowNodeDataByType('graphqlQuery', {})).toBe(false);
    expect(patchDemoWorkflowNodeDataById('n1', {})).toBe(false);
  });

  it('covers live patch sync branches', () => {
    const setWorkflowVariables = vi.fn();
    const workflowVariablesRef = { current: {} as Record<string, string> };
    const handleUpdateNode = vi.fn();

    renderHook(() =>
      useDemoWorkflowLivePatchSync(
        'WF',
        [{ id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { inputVariables: {} } } as never],
        setWorkflowVariables,
        workflowVariablesRef,
        handleUpdateNode,
      ),
    );

    const sync = (window as unknown as Record<string, (name: string, patch: object) => boolean>)
      .__wfSyncLiveWorkflowFromPatch;

    expect(sync('other', { variables: { a: '1' } })).toBe(false);
    expect(sync('WF', {})).toBe(false);
    expect(sync('WF', { variables: { a: '1' } })).toBe(true);
    expect(sync('WF', {
      nodes: [{ id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { inputVariables: { v: 'x' } } }],
    })).toBe(true);
    expect(sync('WF', {
      nodes: [{ id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } }],
    })).toBe(false);

    expect(setWorkflowVariables).toHaveBeenCalledWith({ a: '1' });
    expect(handleUpdateNode).toHaveBeenCalledWith('start-1', { inputVariables: { v: 'x' } });
  });

  it('covers run/config modal bridge helpers', () => {
    const reset = vi.fn();
    const clear = vi.fn();
    const quickTest = vi.fn();
    renderHook(() => useDemoWorkflowRunBridge(reset, clear, quickTest));

    expect(resetDemoWorkflowRunState()).toBe(true);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);

    const quickBridge = (window as unknown as Record<string, () => void>).__wfQuickTest;
    quickBridge();
    expect(quickTest).toHaveBeenCalledTimes(1);

    delete (window as unknown as Record<string, unknown>).__wfResetRunState;
    expect(resetDemoWorkflowRunState()).toBe(false);

    const close = vi.fn();
    renderHook(() => useDemoWorkflowConfigModalBridge(close));
    closeDemoWorkflowConfigModal();
    expect(close).toHaveBeenCalledTimes(1);

    delete (window as unknown as Record<string, unknown>).__wfCloseConfigModal;
    expect(() => closeDemoWorkflowConfigModal()).not.toThrow();
  });
});
