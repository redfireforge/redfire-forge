/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kafkaWorkflowConsumeWaitLesson } from './kafka-workflow-consume-wait';
import { makeCtx } from './ws-test-utils';

describe('kafka-workflow-consume-wait wrapper — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('walks all step preAction handlers with seeded DOM', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="wf-canvas"></div>`;
    for (const step of kafkaWorkflowConsumeWaitLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
    expect(kafkaWorkflowConsumeWaitLesson.steps.length).toBeGreaterThan(0);
  });

  it('setup and cleanup run without error', async () => {
    const ctx = makeCtx();
    if (kafkaWorkflowConsumeWaitLesson.setup) await kafkaWorkflowConsumeWaitLesson.setup(ctx);
    if (kafkaWorkflowConsumeWaitLesson.cleanup) await kafkaWorkflowConsumeWaitLesson.cleanup(ctx);
  });

  it('runs kafka consume-wait config modal steps with workflow canvas seeded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="wf-canvas"></div>
      <div class="wf-config-modal"></div>
      <div data-testid="kafka-wait-config"></div>
      <div data-testid="wait-correlation-section"></div>
      <textarea data-testid="wait-sample-payload"></textarea>
      <div data-testid="wait-load-mode"></div>
      <button data-testid="wf-config-save-btn"></button>
    `;
    const configSteps = kafkaWorkflowConsumeWaitLesson.steps.filter((s) =>
      ['cw-wait-config', 'cw-sample-payload', 'cw-load-mode'].includes(s.id),
    );
    for (const step of configSteps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('walks all kafka consume-wait lesson steps with canvas DOM', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="wf-canvas"></div>
      <div class="wf-config-modal"></div>
      <div data-testid="kafka-consume-config"></div>
      <div data-testid="output-bindings-section"></div>
      <div data-testid="kafka-wait-config"></div>
    `;
    for (const step of kafkaWorkflowConsumeWaitLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('runs individual step preActions with minimal canvas stub', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="wf-canvas"></div>`;
    for (const step of kafkaWorkflowConsumeWaitLesson.steps) {
      if (step.preAction) {
        await step.preAction(ctx);
      }
    }
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('setup falls back to the fit view control when the designer bridge is absent', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="wf-canvas"></div>
      <div class="wf-designer"><button title="Fit view"></button></div>
    `;
    const clickSpy = vi.spyOn(document.querySelector<HTMLElement>('.wf-designer button')!, 'click');
    if (kafkaWorkflowConsumeWaitLesson.setup) {
      await kafkaWorkflowConsumeWaitLesson.setup(ctx);
    }
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup fits through the bridge without touching the toolbar control', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="wf-canvas"></div>
      <div class="wf-designer"><button title="Fit view"></button></div>
    `;
    const clickSpy = vi.spyOn(document.querySelector<HTMLElement>('.wf-designer button')!, 'click');
    const fitBridge = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfFitView = fitBridge;
    if (kafkaWorkflowConsumeWaitLesson.setup) {
      await kafkaWorkflowConsumeWaitLesson.setup(ctx);
    }
    expect(fitBridge).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    delete (window as unknown as Record<string, unknown>).__wfFitView;
  });

  it('wait config preActions skip modal open when wait config already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="wf-canvas"></div>
      <div class="wf-config-modal">
        <div data-testid="kafka-wait-config"></div>
        <div data-testid="wait-correlation-section"></div>
        <textarea data-testid="wait-sample-payload"></textarea>
        <div data-testid="wait-load-mode"></div>
      </div>
    `;
    for (const id of ['cw-wait-config', 'cw-sample-payload', 'cw-load-mode']) {
      const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === id)!;
      await step.preAction!(ctx);
    }
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('cw-consume-node preAction closes an already-open consume modal', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-node')!;
    document.body.innerHTML = `
      <div class="wf-config-modal">
        <div data-testid="kafka-consume-config"></div>
        <div class="wf-config-modal-footer-actions">
          <button class="btn-ghost">Close</button>
        </div>
      </div>
    `;
    // Footer Close rolls the config back to the pre-open snapshot, so the modal is
    // dismissed through __wfCloseConfigModal (or, with no bridge, by dropping the shell).
    const closeSpy = vi.spyOn(document.querySelector<HTMLButtonElement>('.btn-ghost')!, 'click');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(document.querySelector('.wf-config-modal')).toBeNull();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('cw-load-mode action closes Wait config once without dropdown churn', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-load-mode')!;
    const select = document.createElement('div');
    select.setAttribute('data-testid', 'wait-load-mode');
    select.scrollIntoView = vi.fn();
    document.body.appendChild(select);

    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    const footer = document.createElement('div');
    footer.className = 'wf-config-modal-footer-actions';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-ghost';
    closeBtn.addEventListener('click', () => modal.remove());
    footer.appendChild(closeBtn);
    modal.appendChild(footer);
    document.body.appendChild(modal);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(select.scrollIntoView).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith('[data-testid="wait-load-mode"]');
    expect(document.querySelector('.wf-config-modal')).toBeNull();
  });
});
