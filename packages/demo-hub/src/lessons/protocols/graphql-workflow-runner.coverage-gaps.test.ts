/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlWorkflowRunnerLesson } from './graphql-workflow-runner';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge, stubRunnerBridge } from '../../test-utils/workflowBridgeStubs';
import {
  LESSON17_WF_NAME,
} from './graphql-lesson-helpers';

describe('graphql-workflow-runner — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stubWorkflowSeedBridge(LESSON17_WF_NAME);
  });

  afterEach(() => {
    clearWorkflowSeedBridge();
  });

  it('gql17-runner-variables preAction re-selects when var row missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildRunnerDom();
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-runner-variables')!;
    await step.preAction!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql17-config-run action applies demo batch config', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <div class="resilience-field"></div>
        <div class="resilience-field">
          <input data-testid="workflow-runner-iterations" value="10" />
        </div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfRunnerApplyBatchConfig = vi.fn(() => true);
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-config-run')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(800);
  });

  it('gql17-results-dashboard preAction ensures results tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="results-run-filter-tabs"></div>
      <div data-testid="results-metrics-cards"></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-dashboard')!;
    await step.preAction!(ctx);
  });

  it('gql17-request-details action opens request details tab', async () => {
    const ctx = makeCtx();
    const tab = document.createElement('button');
    tab.className = 'results-view-tab';
    tab.textContent = 'Request Details';
    const clickSpy = vi.spyOn(tab, 'click');
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-run-filter-tabs"></div>
    `;
    document.body.appendChild(tab);
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-request-details')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gql17-export-results action closes explorer when open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-run-filter-tabs"></div>
      <div class="results-explorer-diagram" data-testid="results-explorer-diagram">
        <button data-testid="results-explorer-close-btn">Close</button>
      </div>
      <button data-testid="results-export-json-btn">Export JSON</button>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-export-results')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(800);
  });

  it('cleanup runs without error', async () => {
    const ctx = makeCtx();
    await gqlWorkflowRunnerLesson.cleanup!(ctx);
  });

  it('gql17-results-explorer preAction fits diagram when explorer already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-run-filter-tabs"></div>
      <div class="results-explorer-diagram" data-testid="results-explorer-diagram"></div>
      <div data-testid="results-explorer-console-body"></div>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await step.preAction!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('setup runs without error', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = buildRunnerDom();
    await gqlWorkflowRunnerLesson.setup!(ctx);
  });

  it('gql17-config-run action uses DOM fallback when batch bridge fails', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="workflow-runner-config-section">
        <label class="radio-label">Batch execution</label>
        <input type="radio" />
        <div class="resilience-field"><label>Iterations</label><input value="10" /></div>
        <div class="resilience-field"><label>Concurrency</label><input value="5" /></div>
      </div>
      <div class="wf-runner-inline-options">
        <label class="radio-label">Standard trace</label>
        <input type="radio" />
      </div>
    `;
    stubRunnerBridge({ applyBatchConfig: false, selectAndRun: false });
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-config-run')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql17-results-explorer action opens console when explorer ready', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-run-filter-tabs"></div>
      <button data-testid="view-toggle-diagram"></button>
      <button data-testid="console-toggle-btn-header"></button>
      <button data-testid="iter-picker-toggle"></button>
      <button data-testid="iter-picker-aggregate"></button>
      <div data-testid="results-console-body"><div class="re-console-line">GraphQL Query</div></div>
      <div data-testid="iter-picker-dropdown"></div>
      <button data-testid="iter-picker-item-0">#1</button>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('walks all gql17 step preActions and actions with runner DOM', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
      <div class="results-run-filter-tabs"></div>
      <button class="results-view-tab">Request Details</button>
      <button title="Explore execution results">Explore</button>
      <div class="results-explorer-diagram" data-testid="results-explorer-diagram"></div>
      <button data-testid="results-export-json-btn">Export</button>
    `;
    (window as unknown as Record<string, unknown>).__wfRunnerApplyBatchConfig = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    for (const step of gqlWorkflowRunnerLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('gql17-results-explorer action skips when console toggle missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-run-filter-tabs"></div>
      <div class="results-explorer-diagram"><div class="react-flow__node"></div></div>
    `;
    (window as unknown as Record<string, unknown>).__reExplorerFitView = vi.fn(() => true);
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql17-request-details action skips tab click when already active', async () => {
    const ctx = makeCtx();
    const tab = document.createElement('button');
    tab.className = 'results-view-tab active';
    tab.textContent = 'Request Details';
    const clickSpy = vi.spyOn(tab, 'click');
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-run-filter-tabs"></div>
    `;
    document.body.appendChild(tab);
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-request-details')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('gql17-runner-variables preAction skips reselect when var row exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="wfp-var-row"></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-runner-variables')!;
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('workflow-runner');
  });

  it('gql17-start-run action skips run when completion already visible', async () => {
    const ctx = makeCtx();
    stubRunnerBridge({ applyBatchConfig: true, selectAndRun: true });
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-start-run')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(vi.mocked(ctx.click).mock.calls.filter((c) => String(c[0]).includes('run')).length).toBe(0);
  });

  it('gql17-results-explorer preAction skips fit when diagram not open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="results-run-filter-tabs"></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-results-explorer')!;
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });

  it('gql17-view-results action opens results from completion banner', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      ${buildRunnerDom()}
      <div class="workflow-vars-section"></div>
      <div class="completion-section"><button class="btn-primary">View Full Results →</button></div>
    `;
    const step = gqlWorkflowRunnerLesson.steps.find((s) => s.id === 'gql17-view-results')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('.completion-section .btn-primary');
  });
});

function buildRunnerDom(): string {
  return `
    <div class="workflow-picker">
      <button data-testid="workflow-select">Select workflow</button>
    </div>
    <div class="workflow-runner-config-section"></div>
    <div class="config-form">
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-lg" data-testid="workflow-runner-run-btn">Run</button>
      </div>
    </div>
  `;
}
