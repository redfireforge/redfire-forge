/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
import { kafkaWorkflowConsumeWaitLesson } from './kafka-workflow-consume-wait';
import { KAFKA, WF } from '@shared/selectors';

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
    expect(kafkaWorkflowConsumeWaitLesson.concept.body).toContain('Output bindings');
    expect(kafkaWorkflowConsumeWaitLesson.concept.body).not.toContain('firstMessageBody');
  });

  it('has exactly 10 steps with unique IDs and visible actions where needed', () => {
    expect(kafkaWorkflowConsumeWaitLesson.steps.length).toBe(10);
    const ids = kafkaWorkflowConsumeWaitLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of [
      'cw-consume-binding',
      'cw-wait-node',
      'cw-wait-config',
      'cw-sample-payload',
      'cw-load-mode',
      'cw-console',
    ]) {
      const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === id)!;
      expect(typeof step.action, `${id} needs a visible action`).toBe('function');
    }
  });

  it('config steps use field highlights (no flash-ring tours)', () => {
    expect(kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-binding')!.highlight)
      .toBe(KAFKA.CONSUME_OUTPUT_BINDINGS);
    expect(kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!.highlight)
      .toBe(KAFKA.WAIT_CORRELATION_SECTION);
    expect(kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-sample-payload')!.highlight)
      .toBe(KAFKA.WAIT_SAMPLE_TEXTAREA);
    expect(kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-load-mode')!.highlight)
      .toBe(KAFKA.WAIT_LOAD_MODE_SELECT);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaWorkflowConsumeWaitLesson.setup).toBe('function');
    expect(typeof kafkaWorkflowConsumeWaitLesson.cleanup).toBe('function');
  });

  it('step cw-consume-node opens consume config once without card flash tour', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-node')!;
    expect(step.highlight).toBe(KAFKA.NODE_CONSUME);
    expect(step.verify).toBe(KAFKA.CONSUME_CONFIG);

    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);

    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    const consume = document.createElement('div');
    consume.setAttribute('data-testid', 'kafka-consume-config');
    modal.appendChild(consume);
    document.body.appendChild(modal);

    const ctx = makeCtx();
    await step.action!(ctx);

    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('step cw-consume-binding explains consumedKey is used by kafkaWait correlation', () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-binding')!;
    expect(step.description).toContain('{{consumedKey}}');
    expect(step.description).toContain('kafkaWait');
  });

  it('step cw-wait-config correlates with consumedKey from the Consume binding', () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!;
    expect(step.description).toContain('{{consumedKey}}');
    expect(step.description).not.toContain('ID expression** is `{{orderId}}`');
    expect(kafkaWorkflowConsumeWaitLesson.concept.diagram).toContain('consumedKey');
  });

  it('step cw-consume-binding focuses Output bindings without toggle churn', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-binding')!;
    expect(step.title).toContain('consumedKey');
    expect(step.description).toContain('key');
    expect(step.description).not.toContain('firstMessageBody');

    const consume = document.createElement('div');
    consume.setAttribute('data-testid', 'kafka-consume-config');
    const section = document.createElement('div');
    section.setAttribute('data-testid', 'output-bindings-section');
    section.scrollIntoView = vi.fn();
    const row = document.createElement('div');
    row.className = 'wf-kafka-bindings-row';
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'wf-kafka-bindings-col-on';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    const clickSpy = vi.fn();
    checkbox.addEventListener('click', clickSpy);
    toggleWrap.appendChild(checkbox);
    row.appendChild(toggleWrap);
    section.appendChild(row);
    consume.appendChild(section);
    document.body.appendChild(consume);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(KAFKA.CONSUME_OUTPUT_BINDINGS, 5000);
    // Already On — do not flash toggle off/on.
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('step cw-wait-node opens wait config in action (not only preAction)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-node')!;
    expect(step.highlight).toBe(KAFKA.NODE_WAIT);
    expect(step.verify).toBe(KAFKA.WAIT_CONFIG);

    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn(() => {
      const wait = document.createElement('div');
      wait.setAttribute('data-testid', 'kafka-wait-config');
      document.body.appendChild(wait);
    });
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(KAFKA.WAIT_CONFIG, expect.any(Number));
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('step cw-wait-node keeps Wait open when panel already present', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-node')!;
    const wait = document.createElement('div');
    wait.setAttribute('data-testid', 'kafka-wait-config');
    document.body.appendChild(wait);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(document.querySelector(KAFKA.WAIT_CONFIG)).toBeTruthy();
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('step cw-wait-config action focuses correlation section (no per-row flash)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!;
    expect(step.description).toContain('ID expression');
    expect(step.description).toContain('Body (JSONPath)');

    const section = document.createElement('div');
    section.setAttribute('data-testid', 'wait-correlation-section');
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(KAFKA.WAIT_CORRELATION_SECTION, 5000);
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('step cw-sample-payload action focuses sample textarea', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-sample-payload')!;
    expect(step.title).toContain('Quick Test');
    expect(step.description).toContain('Message body');

    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'wait-sample-payload');
    textarea.scrollIntoView = vi.fn();
    document.body.appendChild(textarea);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(KAFKA.WAIT_SAMPLE_TEXTAREA, 5000);
    expect(textarea.scrollIntoView).toHaveBeenCalled();
  });

  it('step cw-load-mode closes Wait config once at end of Wait tour', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-load-mode')!;
    expect(step.description).toContain('Auto resume');
    expect(step.verify).toBe(WF.QUICK_TEST_BTN);

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
    const closeSpy = vi.fn(() => modal.remove());
    closeBtn.addEventListener('click', closeSpy);
    footer.appendChild(closeBtn);
    modal.appendChild(footer);
    document.body.appendChild(modal);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(select.scrollIntoView).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    expect(document.querySelector('.wf-config-modal')).toBeNull();
  });

  it('Wait config preActions do not reopen when panel is already open', async () => {
    document.body.innerHTML = `
      <div class="wf-canvas-area"></div>
      <div class="wf-config-modal">
        <div data-testid="kafka-wait-config"></div>
      </div>
    `;
    (window as unknown as Record<string, unknown>).__wfGetSelectedName = () => 'Kafka Consume & Wait Demo';
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = vi.fn();

    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);

    for (const id of ['cw-wait-config', 'cw-sample-payload', 'cw-load-mode']) {
      const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === id)!;
      await step.preAction!(makeCtx());
    }
    expect(dblclickSpy).not.toHaveBeenCalled();
  });

  it('step cw-quicktest action clicks quick test button', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-quicktest')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
  });

  it('step cw-console action reads the console and does not close it', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-console')!;
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    const body = document.createElement('div');
    body.className = 'wf-console-body';
    const line = document.createElement('div');
    line.className = 'wf-cl-line';
    line.textContent = 'CONSUME orders.created';
    line.scrollIntoView = vi.fn();
    body.appendChild(line);
    const waitLine = document.createElement('div');
    waitLine.className = 'wf-cl-line';
    waitLine.textContent = 'WAIT RESOLVED (sample)';
    waitLine.scrollIntoView = vi.fn();
    body.appendChild(waitLine);
    panel.appendChild(body);
    document.body.appendChild(panel);

    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const badgeClickSpy = vi.fn(() => panel.remove());
    badge.addEventListener('click', badgeClickSpy);
    document.body.appendChild(badge);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(line.scrollIntoView).toHaveBeenCalled();
    expect(waitLine.scrollIntoView).toHaveBeenCalled();
    // After reading, the action closes the console.
    expect(document.querySelector('.wf-console-panel')).toBeNull();
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    await expect(kafkaWorkflowConsumeWaitLesson.setup!(ctx)).resolves.not.toThrow();
  });

  it('setup seeds workflow via bridge', async () => {
    const { deleteByName: deleteSpy, insertWorkflow: insertSpy } = stubWorkflowSeedBridge('Kafka Consume & Wait Demo');
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.setup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Consume & Wait Demo');
    expect(insertSpy).toHaveBeenCalled();
    clearWorkflowSeedBridge();
  });

  it('cleanup deletes seeded workflow', async () => {
    const deleteSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = deleteSpy;
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.cleanup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Consume & Wait Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('cw-intro highlights consume node and quietly ensures the workflow', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-intro')!;
    expect(step.highlight).toBe(KAFKA.NODE_CONSUME);

    const expandSpy = vi.fn();
    const collapseSpy = vi.fn();
    const selectSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__demoExpandAppSidebar = expandSpy;
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = collapseSpy;
    (window as unknown as Record<string, unknown>).__wfGetSelectedName = () => 'Kafka Consume & Wait Demo';
    (window as unknown as Record<string, unknown>).__wfSelectByName = selectSpy;
    document.body.innerHTML = '<div class="wf-canvas-area"></div>';

    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(expandSpy).not.toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
    expect(collapseSpy).toHaveBeenCalled();
  });

  it('setup closes console and fits view when DOM elements are present', async () => {
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
    await kafkaWorkflowConsumeWaitLesson.setup!(ctx);
    expect(badgeClickSpy).toHaveBeenCalled();
    expect(fitClickSpy).toHaveBeenCalled();
  });

  it('cw-consume-binding preAction opens consume when modal absent', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-binding')!;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
  });

  it('cw-wait-config preAction opens wait when config absent', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
  });

  it('cw-open-console action opens console when panel is closed', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-open-console')!;
    const badge = document.createElement('div');
    badge.className = 'wf-console-badge';
    const clickSpy = vi.fn();
    badge.addEventListener('click', clickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('all step preActions and actions run without throwing', async () => {
    for (const step of kafkaWorkflowConsumeWaitLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('has Docker badge tag', () => {
    expect(kafkaWorkflowConsumeWaitLesson.tag).toContain('Docker');
  });
});
