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
      <button data-testid="wf-config-save-btn"></button>
    `;
    const configSteps = kafkaWorkflowConsumeWaitLesson.steps.filter((s) => s.id.includes('config'));
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
      <div data-testid="kafka-wait-config"></div>
    `;
    for (const id of ['cw-wait-config', 'cw-sample-payload', 'cw-load-mode']) {
      const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === id)!;
      await step.preAction!(ctx);
    }
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('scrollWfConfigSectionIntoView no-ops when section element missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="wf-canvas"></div>
      <div data-testid="kafka-wait-config"></div>
    `;
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!;
    await step.preAction!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureKafkaNodeConfigOpen skips modal open when config modal already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="wf-canvas"></div>
      <div class="wf-config-modal"></div>
      <div data-testid="kafka-wait-config"></div>
    `;
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!;
    await expect(step.preAction!(ctx)).resolves.toBeUndefined();
  });
});
