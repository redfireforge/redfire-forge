/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyRunnerBatchConfig,
  fitResultsExplorerDiagram,
  patchWorkflowNodeDataById,
  resetWorkflowRunState,
  selectAndRunRunnerWorkflow,
  selectRunnerWorkflowByName,
  selectWorkflowByName,
  triggerRunnerWorkflowRun,
  waitForResultsExplorerBridge,
  waitForRunnerBridge,
  waitForWorkflowsLoaded,
} from './workflowDesignerAdapter';

describe('workflowDesignerAdapter — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const w = window as unknown as Record<string, unknown>;
    for (const key of Object.keys(w).filter((k) => k.startsWith('__wf') || k.startsWith('__re'))) {
      delete w[key];
    }
  });

  it('selectWorkflowByName delegates to bridge', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfSelectByName = spy;
    expect(selectWorkflowByName('Demo WF')).toBe(true);
    expect(spy).toHaveBeenCalledWith('Demo WF');
  });

  it('selectRunnerWorkflowByName prefers applySelection bridge', () => {
    const applySpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfRunnerApplySelection = applySpy;
    expect(selectRunnerWorkflowByName('Demo WF')).toBe(true);
    expect(applySpy).toHaveBeenCalledWith('Demo WF');
  });

  it('selectRunnerWorkflowByName falls back to selectByName', () => {
    const selectSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfRunnerSelectByName = selectSpy;
    expect(selectRunnerWorkflowByName('Demo WF')).toBe(true);
    expect(selectSpy).toHaveBeenCalledWith('Demo WF');
  });

  it('triggerRunnerWorkflowRun uses bridge when available', () => {
    const runSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfRunnerTriggerRun = runSpy;
    expect(triggerRunnerWorkflowRun()).toBe(true);
    expect(runSpy).toHaveBeenCalled();
  });

  it('triggerRunnerWorkflowRun clicks Run Workflow button fallback', () => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Run Workflow';
    const form = document.createElement('div');
    form.className = 'config-form';
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.appendChild(btn);
    form.appendChild(actions);
    document.body.appendChild(form);
    const clickSpy = vi.spyOn(btn, 'click');
    expect(triggerRunnerWorkflowRun()).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('selectAndRunRunnerWorkflow uses selectAndRun bridge', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfRunnerSelectAndRun = spy;
    expect(selectAndRunRunnerWorkflow('Demo WF')).toBe(true);
    expect(spy).toHaveBeenCalledWith('Demo WF');
  });

  it('selectAndRunRunnerWorkflow composes select + run fallback', () => {
    const selectSpy = vi.fn(() => true);
    const runSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfRunnerSelectByName = selectSpy;
    (window as unknown as Record<string, unknown>).__wfRunnerTriggerRun = runSpy;
    expect(selectAndRunRunnerWorkflow('Demo WF')).toBe(true);
    expect(selectSpy).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalled();
  });

  it('applyRunnerBatchConfig and fitResultsExplorerDiagram delegate to bridges', () => {
    const batchSpy = vi.fn(() => true);
    const fitSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfRunnerApplyBatchConfig = batchSpy;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = fitSpy;
    expect(applyRunnerBatchConfig(5, 2, 'minimal')).toBe(true);
    expect(fitResultsExplorerDiagram()).toBe(true);
    expect(batchSpy).toHaveBeenCalledWith(5, 2, 'minimal');
    expect(fitSpy).toHaveBeenCalled();
  });

  it('waitForRunnerBridge and waitForResultsExplorerBridge poll until ready', async () => {
    const delays: number[] = [];
    const ctx = { delay: async (ms: number) => { delays.push(ms); } };
    expect(await waitForRunnerBridge(ctx, 0)).toBe(false);
    (window as unknown as Record<string, unknown>).__wfRunnerSelectAndRun = vi.fn();
    expect(await waitForRunnerBridge(ctx, 0)).toBe(true);

    expect(await waitForResultsExplorerBridge(ctx, 0)).toBe(false);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn();
    expect(await waitForResultsExplorerBridge(ctx, 0)).toBe(true);
  });

  it('waitForWorkflowsLoaded polls loaded flag', async () => {
    const ctx = { delay: async () => {} };
    expect(await waitForWorkflowsLoaded(ctx, 0)).toBe(false);
    (window as unknown as Record<string, unknown>).__wfWorkflowsLoaded = true;
    expect(await waitForWorkflowsLoaded(ctx, 0)).toBe(true);
  });

  it('patchWorkflowNodeDataById and resetWorkflowRunState delegate to bridges', () => {
    const patchSpy = vi.fn(() => true);
    const resetSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfPatchNodeDataById = patchSpy;
    (window as unknown as Record<string, unknown>).__wfResetRunState = resetSpy;
    expect(patchWorkflowNodeDataById('n1', { query: 'q' })).toBe(true);
    expect(resetWorkflowRunState()).toBe(true);
  });
});
