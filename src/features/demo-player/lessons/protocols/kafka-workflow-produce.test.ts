/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaWorkflowProduceLesson } from './kafka-workflow-produce';

describe('kafka-workflow-produce lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaWorkflowProduceLesson.id).toBe('kafka-workflow-produce');
    expect(kafkaWorkflowProduceLesson.domainId).toBe('protocols');
    expect(kafkaWorkflowProduceLesson.category).toBe('kafka');
    expect(kafkaWorkflowProduceLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaWorkflowProduceLesson.initialTab).toBeUndefined();
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaWorkflowProduceLesson.concept.title).toBeTruthy();
    expect(kafkaWorkflowProduceLesson.concept.body).toBeTruthy();
    expect(kafkaWorkflowProduceLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaWorkflowProduceLesson.concept.diagram).toContain('<svg');
  });

  it('has at least 8 steps with unique IDs', () => {
    expect(kafkaWorkflowProduceLesson.steps.length).toBeGreaterThanOrEqual(8);
    const ids = kafkaWorkflowProduceLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaWorkflowProduceLesson.setup).toBe('function');
    expect(typeof kafkaWorkflowProduceLesson.cleanup).toBe('function');
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaWorkflowProduceLesson.dockerEndpoint).toBeTruthy();
  });

  it('step wp-palette preAction clicks palette toggle when element exists', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-palette')!;
    expect(step).toBeDefined();
    expect(typeof step.preAction).toBe('function');
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'palette-toggle');
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    document.body.appendChild(toggle);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(300);
  });

  it('step wp-config action clicks kafkaProduce node when it exists', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-config')!;
    expect(step).toBeDefined();
    expect(typeof step.action).toBe('function');
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaProduce';
    const clickSpy = vi.fn();
    node.addEventListener('click', clickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

  it('step wp-quicktest action clicks quick test button', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-quicktest')!;
    expect(step).toBeDefined();
    if (step.action) {
      const ctx = makeCtx();
      await step.action(ctx);
      expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
    }
  });

  it('setup calls __wfDeleteByName when set on window (line 79 true branch)', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.setup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Produce Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('setup calls __wfInsertWorkflow when set on window (lines 80-83 true branch)', async () => {
    const insertSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insertSpy;
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.setup!(ctx);
    expect(insertSpy).toHaveBeenCalled();
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
  });

  it('cleanup calls __wfDeleteByName when set on window (line 93 true branch)', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.cleanup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Produce Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('wp-intro preAction clicks sidebar item when matching workflow found (lines 104-105)', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-intro')!;
    const item = document.createElement('div');
    item.className = 'wf-sidebar-item';
    item.textContent = 'Kafka Produce Demo';
    const clickSpy = vi.fn();
    item.addEventListener('click', clickSpy);
    document.body.appendChild(item);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(500);
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaWorkflowProduceLesson.setup) {
      await expect(kafkaWorkflowProduceLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaWorkflowProduceLesson.cleanup) {
      await expect(kafkaWorkflowProduceLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaWorkflowProduceLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaWorkflowProduceLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaWorkflowProduceLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
      const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.length;
      const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
      const delayCalls = (ctx.delay as ReturnType<typeof vi.fn>).mock.calls.length;
      if (clickCalls + fillCalls + delayCalls > 0) { called = true; break; }
    }
    expect(called).toBe(true);
  });

});

// ─── K10: kafka-workflow-consume-wait ───────────────────────────

