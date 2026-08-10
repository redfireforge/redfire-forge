/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addWorkflowNode,
  addWorkflowNodeWithPreset,
  clearWorkflowSamplePreview,
  connectWorkflowNodes,
  deleteWorkflowByName,
  deselectAllWorkflowNodes,
  fitWorkflowCanvasView,
  getWorkflowByName,
  insertWorkflow,
  openWorkflowNodeConfig,
  patchDemoWorkflowNodeDataByType,
  patchWorkflowNodeDataByType,
  patchWorkflowByName,
  syncLiveWorkflowFromPatch,
  getSelectedWorkflowName,
  removeWorkflowEdge,
  closeWorkflowConfigModal,
  seedNamedWorkflow,
  setWorkflowConsoleFloatLayout,
  triggerWorkflowQuickTest,
  waitForWorkflowBridge,
} from './workflowDesignerAdapter';

describe('workflowDesignerAdapter', () => {
  beforeEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.__wfDeleteByName;
    delete w.__wfInsertWorkflow;
    delete w.__wfGetWorkflowByName;
    delete w.__wfFitView;
    delete w.__wfOpenNodeConfig;
    delete w.__wfConnect;
    delete w.__wfRemoveEdge;
    delete w.__wfPatchNodeDataByType;
    delete w.__wfPatchWorkflowByName;
    delete w.__wfSyncLiveWorkflowFromPatch;
    delete w.__wfGetSelectedName;
    delete w.__wfAddNode;
    delete w.__wfQuickTest;
    delete w.__wfSetConsoleFloatLayout;
    delete w.__wfSelectByName;
    delete w.__wfClearSamplePreview;
  });

  it('clearWorkflowSamplePreview calls bridge when present', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfClearSamplePreview = spy;
    clearWorkflowSamplePreview();
    expect(spy).toHaveBeenCalled();
  });

  it('clearWorkflowSamplePreview is a no-op when bridge missing', () => {
    expect(() => clearWorkflowSamplePreview()).not.toThrow();
  });

  it('deleteWorkflowByName returns false when bridge missing', () => {
    expect(deleteWorkflowByName('x')).toBe(false);
  });

  it('deleteWorkflowByName calls bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = spy;
    expect(deleteWorkflowByName('Demo WF')).toBe(true);
    expect(spy).toHaveBeenCalledWith('Demo WF');
  });

  it('getWorkflowByName returns null when bridge missing', () => {
    expect(getWorkflowByName('x')).toBeNull();
  });

  it('deselectAllWorkflowNodes and setWorkflowConsoleFloatLayout call bridges', () => {
    const deselectSpy = vi.fn();
    const layoutSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeselectAll = deselectSpy;
    (window as unknown as Record<string, unknown>).__wfSetConsoleFloatLayout = layoutSpy;
    deselectAllWorkflowNodes();
    setWorkflowConsoleFloatLayout();
    expect(deselectSpy).toHaveBeenCalled();
    expect(layoutSpy).toHaveBeenCalled();
  });

  it('fitWorkflowCanvasView delegates to bridge and returns false when unavailable', () => {
    expect(fitWorkflowCanvasView()).toBe(false);
    const fitSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfFitView = fitSpy;
    expect(fitWorkflowCanvasView()).toBe(true);
    expect(fitSpy).toHaveBeenCalledWith(undefined);
    expect(fitWorkflowCanvasView({ minZoom: 1 })).toBe(true);
    expect(fitSpy).toHaveBeenCalledWith({ minZoom: 1 });
  });

  it('connectWorkflowNodes returns false when bridge missing', () => {
    expect(connectWorkflowNodes('a', 'b')).toBe(false);
  });

  it('connectWorkflowNodes passes handle args', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = spy;
    expect(connectWorkflowNodes('a', 'b', 'out', 'in')).toBe(true);
    expect(spy).toHaveBeenCalledWith('a', 'b', 'out', 'in');
  });

  it('removeWorkflowEdge returns false when bridge missing', () => {
    expect(removeWorkflowEdge('a', 'b')).toBe(false);
  });

  it('removeWorkflowEdge calls bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfRemoveEdge = spy;
    expect(removeWorkflowEdge('assert', 'end')).toBe(true);
    expect(spy).toHaveBeenCalledWith('assert', 'end');
  });

  it('patchDemoWorkflowNodeDataByType aliases patchWorkflowNodeDataByType', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = spy;
    expect(patchDemoWorkflowNodeDataByType('graphqlQuery', { query: 'q' })).toBe(true);
    expect(patchWorkflowNodeDataByType('graphqlQuery', { query: 'q' })).toBe(true);
  });

  it('patchWorkflowByName delegates to bridge', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchWorkflowByName = spy;
    expect(patchWorkflowByName('GraphQL Latency Demo', { variables: { graphqlUrl: 'x' } })).toBe(true);
    expect(spy).toHaveBeenCalledWith('GraphQL Latency Demo', { variables: { graphqlUrl: 'x' } });
  });

  it('patchWorkflowByName returns false when bridge missing', () => {
    expect(patchWorkflowByName('wf', {})).toBe(false);
  });

  it('syncLiveWorkflowFromPatch delegates to bridge', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfSyncLiveWorkflowFromPatch = spy;
    expect(syncLiveWorkflowFromPatch('Variables Demo', { variables: { baseUrl: 'x' } })).toBe(true);
    expect(spy).toHaveBeenCalledWith('Variables Demo', { variables: { baseUrl: 'x' } });
  });

  it('syncLiveWorkflowFromPatch returns false when bridge missing', () => {
    expect(syncLiveWorkflowFromPatch('wf', {})).toBe(false);
  });

  it('getSelectedWorkflowName delegates to bridge', () => {
    (window as unknown as Record<string, unknown>).__wfGetSelectedName = () => 'Variables Demo';
    expect(getSelectedWorkflowName()).toBe('Variables Demo');
  });

  it('getSelectedWorkflowName returns undefined when bridge missing', () => {
    expect(getSelectedWorkflowName()).toBeUndefined();
  });

  it('insertWorkflow and addWorkflowNode delegate to bridges', () => {
    const insertSpy = vi.fn();
    const addSpy = vi.fn(() => 'node-1');
    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insertSpy;
    (window as unknown as Record<string, unknown>).__wfAddNode = addSpy;
    expect(insertWorkflow({ name: 'wf' })).toBe(true);
    expect(insertSpy).toHaveBeenCalledWith({ name: 'wf' });
    expect(addWorkflowNode('graphqlQuery')).toBe('node-1');
  });

  it('insertWorkflow returns false when bridge missing', () => {
    expect(insertWorkflow({ name: 'wf' })).toBe(false);
  });

  it('addWorkflowNodeWithPreset uses extended bridge signature when available', () => {
    const presetSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfAddNode = presetSpy;
    expect(
      addWorkflowNodeWithPreset('graphqlMutation', 'n1', 'Delete User', { x: 1, y: 2 }),
    ).toBe(true);
    expect(presetSpy).toHaveBeenCalledWith('graphqlMutation', 'n1', 'Delete User', { x: 1, y: 2 });
  });

  it('seedNamedWorkflow deletes, pauses, and inserts when bridges exist', async () => {
    const deleteSpy = vi.fn();
    const insertSpy = vi.fn();
    const selectSpy = vi.fn(() => true);
    const runnerSelectSpy = vi.fn(() => true);
    const wf = { name: 'Demo WF' };
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insertSpy;
    (window as unknown as Record<string, unknown>).__wfWorkflowsLoaded = true;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === 'Demo WF' ? wf : null;
    (window as unknown as Record<string, unknown>).__wfSelectByName = selectSpy;
    (window as unknown as Record<string, unknown>).__wfRunnerSelectByName = runnerSelectSpy;
    const delays: number[] = [];
    const ctx = { delay: async (ms: number) => { delays.push(ms); } };
    const ok = await seedNamedWorkflow(ctx, 'Demo WF', wf, {
      deleteDelayMs: 50,
      insertPreDelayMs: 25,
      insertDelayMs: 75,
      storeTimeoutMs: 0,
    });
    expect(ok).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith('Demo WF');
    expect(insertSpy).toHaveBeenCalledWith(wf);
    expect(selectSpy).toHaveBeenCalledWith('Demo WF');
    expect(runnerSelectSpy).toHaveBeenCalledWith('Demo WF');
    expect(delays).toEqual([50, 25, 75]);
  });

  it('seedNamedWorkflow returns false when bridge is unavailable', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const ctx = { delay: async () => {} };
    const ok = await seedNamedWorkflow(ctx, 'Demo WF', { name: 'Demo WF' }, { bridgeTimeoutMs: 0 });
    expect(ok).toBe(false);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('waitForWorkflowBridge resolves when bridge appears', async () => {
    const delays: number[] = [];
    const ctx = { delay: async (ms: number) => { delays.push(ms); } };
    let ready = await waitForWorkflowBridge(ctx, 0);
    expect(ready).toBe(false);

    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = vi.fn();
    ready = await waitForWorkflowBridge(ctx, 0);
    expect(ready).toBe(true);
  });

  it('triggerWorkflowQuickTest calls bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfQuickTest = spy;
    triggerWorkflowQuickTest();
    expect(spy).toHaveBeenCalled();
  });

  it('openWorkflowNodeConfig returns false when bridge missing', () => {
    expect(openWorkflowNodeConfig('n1')).toBe(false);
  });

  it('openWorkflowNodeConfig calls bridge with node id', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = spy;
    expect(openWorkflowNodeConfig('n1')).toBe(true);
    expect(spy).toHaveBeenCalledWith('n1');
  });

  it('closeWorkflowConfigModal calls bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfCloseConfigModal = spy;
    closeWorkflowConfigModal();
    expect(spy).toHaveBeenCalled();
  });
});
