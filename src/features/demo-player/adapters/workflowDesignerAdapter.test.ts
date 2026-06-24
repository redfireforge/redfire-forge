/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addWorkflowNode,
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  deleteWorkflowByName,
  deselectAllWorkflowNodes,
  getWorkflowByName,
  insertWorkflow,
  openWorkflowNodeConfig,
  patchDemoWorkflowNodeDataByType,
  patchWorkflowNodeDataByType,
  closeWorkflowConfigModal,
  seedNamedWorkflow,
  setWorkflowConsoleFloatLayout,
  triggerWorkflowQuickTest,
} from './workflowDesignerAdapter';

describe('workflowDesignerAdapter', () => {
  beforeEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.__wfDeleteByName;
    delete w.__wfInsertWorkflow;
    delete w.__wfGetWorkflowByName;
    delete w.__wfOpenNodeConfig;
    delete w.__wfConnect;
    delete w.__wfPatchNodeDataByType;
    delete w.__wfAddNode;
    delete w.__wfQuickTest;
    delete w.__wfSetConsoleFloatLayout;
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

  it('connectWorkflowNodes returns false when bridge missing', () => {
    expect(connectWorkflowNodes('a', 'b')).toBe(false);
  });

  it('connectWorkflowNodes passes handle args', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfConnect = spy;
    expect(connectWorkflowNodes('a', 'b', 'out', 'in')).toBe(true);
    expect(spy).toHaveBeenCalledWith('a', 'b', 'out', 'in');
  });

  it('patchDemoWorkflowNodeDataByType aliases patchWorkflowNodeDataByType', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataByType = spy;
    expect(patchDemoWorkflowNodeDataByType('graphqlQuery', { query: 'q' })).toBe(true);
    expect(patchWorkflowNodeDataByType('graphqlQuery', { query: 'q' })).toBe(true);
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
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insertSpy;
    const delays: number[] = [];
    const ctx = { delay: async (ms: number) => { delays.push(ms); } };
    await seedNamedWorkflow(ctx, 'Demo WF', { name: 'Demo WF' }, {
      deleteDelayMs: 50,
      insertPreDelayMs: 25,
      insertDelayMs: 75,
    });
    expect(deleteSpy).toHaveBeenCalledWith('Demo WF');
    expect(insertSpy).toHaveBeenCalledWith({ name: 'Demo WF' });
    expect(delays).toEqual([50, 25, 75]);
  });

  it('seedNamedWorkflow skips insertPreDelay when insert bridge is missing', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const delays: number[] = [];
    const ctx = { delay: async (ms: number) => { delays.push(ms); } };
    await seedNamedWorkflow(ctx, 'Demo WF', { name: 'Demo WF' }, {
      deleteDelayMs: 0,
      insertPreDelayMs: 100,
      insertDelayMs: 0,
    });
    expect(deleteSpy).toHaveBeenCalledWith('Demo WF');
    expect(delays).toEqual([]);
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
