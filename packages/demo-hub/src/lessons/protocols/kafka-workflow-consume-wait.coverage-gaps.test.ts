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

  it('setup clicks fit view when fit button present', async () => {
    const ctx = makeCtx();
    const fitBtn = document.createElement('button');
    fitBtn.title = 'Fit view';
    const clickSpy = vi.spyOn(fitBtn, 'click');
    document.body.innerHTML = `<div data-testid="wf-canvas"></div>`;
    document.body.appendChild(fitBtn);
    if (kafkaWorkflowConsumeWaitLesson.setup) {
      await kafkaWorkflowConsumeWaitLesson.setup(ctx);
    }
    expect(clickSpy).toHaveBeenCalled();
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
    const closeBtn = document.querySelector<HTMLButtonElement>('.btn-ghost')!;
    const closeSpy = vi.spyOn(closeBtn, 'click');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('cw-load-mode action closes open cs-menu by second click', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-load-mode')!;
    const select = document.createElement('div');
    select.setAttribute('data-testid', 'wait-load-mode');
    document.body.appendChild(select);
    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    document.body.appendChild(menu);
    const card = document.createElement('section');
    card.className = 'wf-kafka-card';
    const titleEl = document.createElement('span');
    titleEl.className = 'wf-kafka-card-title-text';
    titleEl.textContent = 'Load test';
    card.appendChild(titleEl);
    document.body.appendChild(card);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="wait-load-mode"]');
  });
});
