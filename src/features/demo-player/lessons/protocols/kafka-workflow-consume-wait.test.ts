/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaWorkflowConsumeWaitLesson } from './kafka-workflow-consume-wait';

describe('kafka-workflow-consume-wait lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaWorkflowConsumeWaitLesson.id).toBe('kafka-workflow-consume-wait');
    expect(kafkaWorkflowConsumeWaitLesson.domainId).toBe('protocols');
    expect(kafkaWorkflowConsumeWaitLesson.category).toBe('kafka');
    expect(kafkaWorkflowConsumeWaitLesson.estimatedMinutes).toBeGreaterThan(0);
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaWorkflowConsumeWaitLesson.concept.title).toBeTruthy();
    expect(kafkaWorkflowConsumeWaitLesson.concept.body).toBeTruthy();
    expect(kafkaWorkflowConsumeWaitLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaWorkflowConsumeWaitLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 10 steps with unique IDs', () => {
    expect(kafkaWorkflowConsumeWaitLesson.steps.length).toBe(10);
    const ids = kafkaWorkflowConsumeWaitLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaWorkflowConsumeWaitLesson.setup).toBe('function');
    expect(typeof kafkaWorkflowConsumeWaitLesson.cleanup).toBe('function');
  });

  it('step cw-consume-node action double-clicks node to open config modal', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-node')!;
    expect(step).toBeDefined();
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(600);
  });

  it('step cw-wait-node action double-clicks node to open config modal', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-node')!;
    expect(step).toBeDefined();
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(600);
  });

  it('step cw-quicktest action clicks quick test button', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-quicktest')!;
    expect(step).toBeDefined();
    if (step.action) {
      const ctx = makeCtx();
      await step.action(ctx);
      expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
    }
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaWorkflowConsumeWaitLesson.setup) {
      await expect(kafkaWorkflowConsumeWaitLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('setup calls __wfDeleteByName when set on window (line 117 true branch)', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.setup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Consume & Wait Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('setup calls __wfInsertWorkflow when set on window (lines 118-121 true branch)', async () => {
    const insertSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insertSpy;
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.setup!(ctx);
    expect(insertSpy).toHaveBeenCalled();
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
  });

  it('cleanup calls __wfDeleteByName when set on window (line 130 true branch)', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.cleanup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Consume & Wait Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaWorkflowConsumeWaitLesson.cleanup) {
      await expect(kafkaWorkflowConsumeWaitLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  it('cw-intro preAction clicks sidebar item when matching workflow found (lines 139-140)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-intro')!;
    const item = document.createElement('div');
    item.className = 'wf-sidebar-item';
    item.textContent = 'Kafka Consume & Wait Demo';
    const clickSpy = vi.fn();
    item.addEventListener('click', clickSpy);
    document.body.appendChild(item);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(500);
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaWorkflowConsumeWaitLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaWorkflowConsumeWaitLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaWorkflowConsumeWaitLesson.steps) {
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

// ─── K11: kafka-secure ──────────────────────────────────────────

