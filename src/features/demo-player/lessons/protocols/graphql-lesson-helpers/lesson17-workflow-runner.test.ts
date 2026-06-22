/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import {
  LESSON17_WF_NAME,
  resetGqlLesson17SessionFlags,
  gqlWorkflowRunnerLessonSetup,
  ensureLesson17WorkflowSelected,
  ensureLesson17ResultsOpen,
  selectGqlLatencyDemoWorkflow,
} from './lesson17-workflow-runner';

describe('lesson17-workflow-runner helpers (direct)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson17SessionFlags();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
  });

  it('selectGqlLatencyDemoWorkflow skips click when dropdown has no match', async () => {
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel">
        <div class="wfp-dropdown-item">Other Workflow</div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const item = document.querySelector<HTMLElement>('.wfp-dropdown-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureLesson17WorkflowSelected skips when vars section already visible', async () => {
    document.body.innerHTML = '<div class="workflow-vars-section"></div>';
    const ctx = makeCtx();
    await ensureLesson17WorkflowSelected(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson17WorkflowSelected(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('ensureLesson17ResultsOpen navigates to results when no view button', async () => {
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
      <div class="config-form"><div class="form-actions"><button class="btn-primary"></button></div></div>
    `;
    const ctx = makeCtx();
    await ensureLesson17ResultsOpen(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('ensureLesson17ResultsOpen skips when filter tabs already visible', async () => {
    document.body.innerHTML = `
      <div class="workflow-vars-section"></div>
      <div class="completion-section"></div>
      <div class="results-run-filter-tabs"></div>
      <div class="config-form"><div class="form-actions"><button class="btn-primary"></button></div></div>
    `;
    const ctx = makeCtx();
    await ensureLesson17ResultsOpen(ctx);
    vi.mocked(ctx.navigateToTab).mockClear();
    await ensureLesson17ResultsOpen(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('gqlWorkflowRunnerLessonSetup runs without workflow bridges', async () => {
    const ctx = makeCtx();
    await gqlWorkflowRunnerLessonSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('selectGqlLatencyDemoWorkflow picks exact name match over prefix copy', async () => {
    document.body.innerHTML = `
      <div data-testid="workflow-select"></div>
      <div class="wfp-dropdown-panel">
        <div class="wfp-dropdown-item">${LESSON17_WF_NAME} (2)</div>
        <div class="wfp-dropdown-item">${LESSON17_WF_NAME}</div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const items = document.querySelectorAll<HTMLElement>('.wfp-dropdown-item');
    const exactSpy = vi.spyOn(items[1], 'click');
    const copySpy = vi.spyOn(items[0], 'click');
    await selectGqlLatencyDemoWorkflow(ctx);
    expect(exactSpy).toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
  });
});
