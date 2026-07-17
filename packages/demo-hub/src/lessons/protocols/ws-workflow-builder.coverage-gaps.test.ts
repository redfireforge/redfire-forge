/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsWorkflowBuilderLesson } from './ws-workflow-builder';
import { makeCtx } from './ws-test-utils';
import { WF } from '@shared/selectors';

describe('ws-workflow-builder wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('setup starts mock server via REST', async () => {
    const ctx = makeCtx();
    await wsWorkflowBuilderLesson.setup!(ctx);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ws/mock/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('first step preAction creates workflow when canvas is missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="wf-sidebar-new-btn"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item"></button>
      <input data-testid="wf-create-input" />
      <button data-testid="wf-create-ok"></button>
      <div data-testid="wf-canvas"></div>
    `;
    const createStep = wsWorkflowBuilderLesson.steps.find((s) => s.id === 'wf-create');
    expect(createStep?.preAction).toBeDefined();
    await createStep!.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
    expect(ctx.click).toHaveBeenCalledWith(WF.SIDEBAR_NEW_BTN);
  });
});
