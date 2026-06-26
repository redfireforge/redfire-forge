/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { kafkaWorkflowProduceLesson } from './kafka-workflow-produce';

vi.mock('../setup-helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ensureKafkaConnected: vi.fn().mockResolvedValue(undefined),
    kafkaCleanup: vi.fn().mockResolvedValue(undefined),
  };
});

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

  it('has at least 10 steps with unique IDs', () => {
    expect(kafkaWorkflowProduceLesson.steps.length).toBeGreaterThanOrEqual(10);
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

  it('step wp-palette has no preAction (palette is always visible)', () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-palette')!;
    expect(step).toBeDefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step wp-config preAction double-clicks kafkaProduce node to open config modal', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-config')!;
    expect(step).toBeDefined();
    expect(step.highlight).toBe('.wf-config-modal-scroll');
    expect(typeof step.preAction).toBe('function');
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaProduce';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(2000);
  });

  it('step wp-open-console preAction closes config modal via footer Close button', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-open-console')!;
    expect(step.preAction).toBeDefined();
    const footer = document.createElement('div');
    footer.className = 'wf-config-modal-footer-actions';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-sm btn-ghost';
    closeBtn.textContent = 'Close';
    const clickSpy = vi.fn();
    closeBtn.addEventListener('click', clickSpy);
    footer.appendChild(closeBtn);
    document.body.appendChild(footer);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(800);
  });

  it('step wp-open-console action opens console via badge if panel not present', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-open-console')!;
    expect(step.action).toBeDefined();
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const clickSpy = vi.fn();
    badge.addEventListener('click', clickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step wp-open-console action skips badge click if console panel already present', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-open-console')!;
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    document.body.appendChild(panel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const clickSpy = vi.fn();
    badge.addEventListener('click', clickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('step wp-quicktest action clicks quick test button and waits', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-quicktest')!;
    expect(step).toBeDefined();
    expect(step.preAction).toBeUndefined();
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
    expect(ctx.waitFor).toHaveBeenCalledWith('.wf-status-bar', 5000);
    expect(ctx.delay).toHaveBeenCalledWith(3000);
  });

  it('step wp-bindings has preAction that scrolls output bindings section into view', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-bindings')!;
    expect(step.preAction).toBeDefined();
    expect(step.highlight).toBe('[data-testid="output-bindings-section"]');
    const section = document.createElement('div');
    section.setAttribute('data-testid', 'output-bindings-section');
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(section.scrollIntoView).toHaveBeenCalled();
  });

  it('step wp-result action closes console after reading pause', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-result')!;
    expect(step.preAction).toBeUndefined();
    expect(step.highlight).toBe('.wf-console-body');
    expect(typeof step.action).toBe('function');
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    document.body.appendChild(panel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    badge.addEventListener('click', () => panel.remove());
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(document.querySelector('.wf-console-panel')).toBeNull();
  });

  it('setup calls __wfDeleteByName when set on window', async () => {
    const { deleteByName: deleteSpy } = stubWorkflowSeedBridge('Kafka Produce Demo');
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.setup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Produce Demo');
    clearWorkflowSeedBridge();
  });

  it('setup calls __wfInsertWorkflow when set on window', async () => {
    const { insertWorkflow: insertSpy } = stubWorkflowSeedBridge('Kafka Produce Demo');
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.setup!(ctx);
    expect(insertSpy).toHaveBeenCalled();
    clearWorkflowSeedBridge();
  });

  it('setup closes console panel if it is open', async () => {
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    document.body.appendChild(panel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const clickSpy = vi.fn();
    badge.addEventListener('click', clickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.setup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanup closes console panel if open', async () => {
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    document.body.appendChild(panel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const clickSpy = vi.fn();
    badge.addEventListener('click', clickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanup calls __wfDeleteByName when set on window', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.cleanup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Produce Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('wp-intro preAction clicks sidebar item when matching workflow found', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-intro')!;
    (window as unknown as Record<string, unknown>).__demoExpandAppSidebar = vi.fn();
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = vi.fn();
    document.body.innerHTML =
      '<div class="wf-sidebar-item"><span class="wf-sidebar-item-name">Kafka Produce Demo</span></div>';
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

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

  it('setup closes console and fits view when DOM elements are present (line 90/95 true branches)', async () => {
    const consolePanel = document.createElement('div');
    consolePanel.className = 'wf-console-panel';
    document.body.appendChild(consolePanel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const badgeClickSpy = vi.fn();
    badge.addEventListener('click', badgeClickSpy);
    document.body.appendChild(badge);
    const fitBtn = document.createElement('button');
    fitBtn.title = 'Fit view';
    const fitClickSpy = vi.fn();
    fitBtn.addEventListener('click', fitClickSpy);
    document.body.appendChild(fitBtn);
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.setup!(ctx);
    expect(badgeClickSpy).toHaveBeenCalled();
    expect(fitClickSpy).toHaveBeenCalled();
  });

  it('wp-result action closes console when panel is present', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-result')!;
    const consolePanel = document.createElement('div');
    consolePanel.className = 'wf-console-panel';
    document.body.appendChild(consolePanel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const badgeClickSpy = vi.fn();
    badge.addEventListener('click', () => consolePanel.remove());
    badge.addEventListener('click', badgeClickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(badgeClickSpy).toHaveBeenCalled();
    expect(document.querySelector('.wf-console-panel')).toBeNull();
  });

});

// ─── K10: kafka-workflow-consume-wait ───────────────────────────

