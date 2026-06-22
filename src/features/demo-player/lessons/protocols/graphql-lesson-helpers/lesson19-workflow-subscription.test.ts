/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { WF } from '../../../../../shared/selectors';
import {
  LESSON19_WF_NAME,
  resetGqlLesson19SessionFlags,
  gqlWorkflowSubscriptionLessonSetup,
  ensureLesson19ConsoleOpen,
  ensureLesson19QuickTestRun,
  selectGqlOrderFlowDemoWorkflow,
} from './lesson19-workflow-subscription';

describe('lesson19-workflow-subscription helpers (direct)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson19SessionFlags();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
  });

  it('selectGqlOrderFlowDemoWorkflow skips click when no sidebar match', async () => {
    document.body.innerHTML = '<div class="wf-sidebar-item">Unrelated</div>';
    const ctx = makeCtx();
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    await selectGqlOrderFlowDemoWorkflow(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureLesson19ConsoleOpen skips when console already open', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-console-panel"></div>
      <div data-testid="gql-wf-assert-panel">
        <button class="wf-config-tab">Assertions</button>
        <div data-testid="gql-wf-assert-row"></div>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-subscription-panel">
        <button class="wf-config-tab">Output</button>
        <select data-testid="gql-wf-output-field-select"></select>
        <input data-testid="gql-wf-output-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="gql-wf-mutation-panel">
        <button class="wf-config-tab">Extraction</button>
        <input data-testid="gql-wf-extraction-jsonpath" />
        <input data-testid="gql-wf-extraction-varname" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <textarea data-testid="gql-wf-variables-editor"></textarea>
        <div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>
      </div>
      <div data-testid="exec-summary"></div>
      <button class="wf-quick-test-btn"></button>
    `;
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = vi.fn();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson19QuickTestRun(ctx);
    const badge = document.querySelector<HTMLElement>(WF.CONSOLE_BADGE);
    const badgeSpy = badge ? vi.spyOn(badge, 'click') : null;
    await ensureLesson19ConsoleOpen(ctx);
    expect(badgeSpy?.mock.calls.length ?? 0).toBe(0);
  });

  it('ensureLesson19QuickTestRun skips when exec summary present and flag set', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-console-panel"></div>
      <div data-testid="exec-summary"></div>
      <button class="wf-quick-test-btn"></button>
    `;
    const ctx = makeCtx();
    await ensureLesson19QuickTestRun(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson19QuickTestRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.QUICK_TEST_BTN);
  });

  it('gqlWorkflowSubscriptionLessonSetup runs without workflow bridges', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-sidebar-item">${LESSON19_WF_NAME}</div>
      <button title="Fit view"></button>
    `;
    const ctx = makeCtx();
    await gqlWorkflowSubscriptionLessonSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
  });
});
