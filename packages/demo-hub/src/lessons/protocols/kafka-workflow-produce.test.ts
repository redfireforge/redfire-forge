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

  it('has at least 11 steps with unique IDs including wp-variables', () => {
    expect(kafkaWorkflowProduceLesson.steps.length).toBeGreaterThanOrEqual(11);
    const ids = kafkaWorkflowProduceLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('wp-variables');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaWorkflowProduceLesson.setup).toBe('function');
    expect(typeof kafkaWorkflowProduceLesson.cleanup).toBe('function');
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaWorkflowProduceLesson.dockerEndpoint).toBeTruthy();
  });

  it('step wp-palette searches for kafka and highlights PAL_KAFKA_PRODUCE', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-palette')!;
    expect(step).toBeDefined();
    expect(step.highlight).toBe('.wf-palette-search');
    expect(step.verify).toBe('.wf-palette-block-kafkaProduce');

    // preAction clears any existing search value
    const input = document.createElement('input');
    input.className = 'wf-palette-search';
    input.value = 'old';
    document.body.appendChild(input);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(input.value).toBe('');
    document.body.removeChild(input);

    // action fills the search box
    const input2 = document.createElement('input');
    input2.className = 'wf-palette-search';
    input2.value = '';
    document.body.appendChild(input2);
    const kafkaBlock = document.createElement('div');
    kafkaBlock.className = 'wf-palette-block-kafkaProduce';
    document.body.appendChild(kafkaBlock);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith('.wf-palette-search', 'kafka');
    document.body.removeChild(input2);
    document.body.removeChild(kafkaBlock);
  });

  it('step wp-variables opens Variables modal and spotlights topic / runId', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-variables')!;
    expect(step).toBeDefined();
    expect(step.highlight).toBe('[data-testid="wf-toolbar-variables-btn"]');
    expect(step.verify).toBe('[data-testid="wf-toolbar-variables-btn"]');

    const varsBtn = document.createElement('button');
    varsBtn.setAttribute('data-testid', 'wf-toolbar-variables-btn');
    varsBtn.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'wf-config-modal wf-defaults-modal';
      for (const [key, value] of [
        ['topic', 'orders.created'],
        ['runId', 'demo-run-1'],
      ] as const) {
        const row = document.createElement('div');
        row.className = 'wf-config-kv-row wf-config-kv-row-vars';
        const keyInput = document.createElement('input');
        keyInput.className = 'wf-var-key-input';
        keyInput.value = key;
        const valInput = document.createElement('input');
        valInput.className = 'wf-var-value-input';
        valInput.value = value;
        row.appendChild(keyInput);
        row.appendChild(valInput);
        modal.appendChild(row);
      }
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-sm btn-ghost';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => modal.remove());
      modal.appendChild(cancel);
      document.body.appendChild(modal);
    });
    document.body.appendChild(varsBtn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="wf-toolbar-variables-btn"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('.wf-defaults-modal', 5000);
    // Modal closed via Cancel at end of the step
    expect(document.querySelector('.wf-defaults-modal')).toBeNull();
  });

  it('step wp-config action opens produce config modal and leaves it open', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-config')!;
    expect(step).toBeDefined();
    expect(step.highlight).toBe('.wf-node-kafkaProduce');
    expect(step.verify).toBe('[data-testid="kafka-produce-config"]');
    expect(typeof step.action).toBe('function');

    const node = document.createElement('div');
    node.className = 'wf-node-kafkaProduce';
    const dblclickSpy = vi.fn(() => {
      const panel = document.createElement('div');
      panel.setAttribute('data-testid', 'kafka-produce-config');
      document.body.appendChild(panel);
      const scroll = document.createElement('div');
      scroll.className = 'wf-config-modal-scroll';
      scroll.scrollTo = vi.fn();
      document.body.appendChild(scroll);
    });
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(document.querySelector('[data-testid="kafka-produce-config"]')).toBeTruthy();
  });

  it('step wp-open-console preAction closes config modal via footer Close button', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-open-console')!;
    expect(step.preAction).toBeDefined();
    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    const footer = document.createElement('div');
    footer.className = 'wf-config-modal-footer-actions';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-sm btn-ghost';
    closeBtn.textContent = 'Close';
    const clickSpy = vi.fn();
    closeBtn.addEventListener('click', clickSpy);
    footer.appendChild(closeBtn);
    modal.appendChild(footer);
    document.body.appendChild(modal);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
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
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
    expect(ctx.waitFor).toHaveBeenCalledWith('.wf-status-bar', 5000);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
  });

  it('step wp-fields preAction ensures produce config is open', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-fields')!;
    expect(step.preAction).toBeDefined();
    expect(step.highlight).toBe('[data-testid="kafka-produce-cluster-input"]');
    expect(step.verify).toBe('[data-testid="kafka-produce-body-textarea"]');

    const rfNode = document.createElement('div');
    rfNode.className = 'react-flow__node';
    rfNode.setAttribute('data-id', 'produce-1');
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaProduce';
    rfNode.appendChild(node);
    document.body.appendChild(rfNode);
    node.addEventListener('dblclick', () => {
      const modal = document.createElement('div');
      modal.className = 'wf-config-modal';
      const panel = document.createElement('div');
      panel.setAttribute('data-testid', 'kafka-produce-config');
      modal.appendChild(panel);
      const scroll = document.createElement('div');
      scroll.className = 'wf-config-modal-scroll';
      scroll.scrollTo = vi.fn();
      modal.appendChild(scroll);
      document.body.appendChild(modal);
    });

    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(document.querySelector('[data-testid="kafka-produce-config"]')).toBeTruthy();
  });

  it('step wp-fields action spotlights cluster, topic, and body fields', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-fields')!;
    expect(typeof step.action).toBe('function');
    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    const panel = document.createElement('div');
    panel.setAttribute('data-testid', 'kafka-produce-config');
    modal.appendChild(panel);
    const scroll = document.createElement('div');
    scroll.className = 'wf-config-modal-scroll';
    scroll.scrollTo = vi.fn();
    modal.appendChild(scroll);
    document.body.appendChild(modal);

    for (const [testid, tag] of [
      ['kafka-produce-cluster-input', 'input'],
      ['kafka-produce-topic-input', 'input'],
      ['kafka-produce-body-textarea', 'textarea'],
    ] as const) {
      const el = document.createElement(tag);
      el.setAttribute('data-testid', testid);
      const row = document.createElement('div');
      row.className = 'wf-config-field--row';
      row.appendChild(el);
      scroll.appendChild(row);
    }

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(scroll.scrollTo).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="kafka-produce-cluster-input"]', 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="kafka-produce-topic-input"]', 5000);
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="kafka-produce-body-textarea"]', 5000);
  });

  it('step wp-bindings action toggles the On checkbox off then on', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-bindings')!;
    expect(step.preAction).toBeDefined();
    expect(step.highlight).toBe('[data-testid="output-bindings-section"]');
    expect(step.verify).toBe('[data-testid="output-bindings-section"]');

    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    document.body.appendChild(modal);
    const section = document.createElement('div');
    section.setAttribute('data-testid', 'output-bindings-section');
    section.className = 'wf-kafka-section';
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'wf-kafka-bindings-col-on';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    // jsdom auto-toggles checked on .click(), so no manual flip needed in spy
    const clickSpy = vi.fn();
    checkbox.addEventListener('click', clickSpy);
    toggleWrap.appendChild(checkbox);
    section.appendChild(toggleWrap);
    document.body.appendChild(section);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="output-bindings-section"]', 5000);
    // Checkbox was clicked twice: off then back on
    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(checkbox.checked).toBe(true); // back on after demo (even clicks cancel out)
    document.body.removeChild(modal);
    document.body.removeChild(section);
  });

  it('step wp-bindings preAction checks the On checkbox if it starts unchecked', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-bindings')!;
    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    document.body.appendChild(modal);
    const section = document.createElement('div');
    section.setAttribute('data-testid', 'output-bindings-section');
    section.className = 'wf-kafka-section';
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'wf-kafka-bindings-col-on';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false; // starts unchecked
    const clickSpy = vi.fn();
    checkbox.addEventListener('click', clickSpy);
    toggleWrap.appendChild(checkbox);
    section.appendChild(toggleWrap);
    document.body.appendChild(section);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // jsdom auto-toggles checked on .click(), so after one click it becomes true
    expect(clickSpy).toHaveBeenCalled();
    expect(checkbox.checked).toBe(true);
    document.body.removeChild(modal);
    document.body.removeChild(section);
  });

  it('step wp-result action spotlights produce line and body line in console', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-result')!;
    expect(step.highlight).toBe('.wf-console-body');
    expect(typeof step.action).toBe('function');

    // Build a minimal console DOM with two log lines.
    const body = document.createElement('div');
    body.className = 'wf-console-body';

    const produceLine = document.createElement('div');
    produceLine.className = 'wf-cl-line';
    produceLine.textContent = '[Kafka Produce] PRODUCE orders.created';
    produceLine.scrollIntoView = vi.fn();
    body.appendChild(produceLine);

    const bodyLine = document.createElement('div');
    bodyLine.className = 'wf-cl-line';
    bodyLine.textContent = '[Kafka Produce] Body: {"demo":"workflow","runId":"demo-run-1"}';
    bodyLine.scrollIntoView = vi.fn();
    body.appendChild(bodyLine);

    document.body.appendChild(body);
    const ctx = makeCtx();
    await step.action!(ctx);

    // Both matching lines were scrolled into view and spotlighted.
    expect(produceLine.scrollIntoView).toHaveBeenCalled();
    expect(bodyLine.scrollIntoView).toHaveBeenCalled();

    document.body.removeChild(body);
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

  it('setup closes console when DOM elements are present', async () => {
    const consolePanel = document.createElement('div');
    consolePanel.className = 'wf-console-panel';
    document.body.appendChild(consolePanel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const badgeClickSpy = vi.fn();
    badge.addEventListener('click', badgeClickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await kafkaWorkflowProduceLesson.setup!(ctx);
    expect(badgeClickSpy).toHaveBeenCalled();
  });

  it('wp-intro action clicks Fit view when the button is present', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-intro')!;
    const fitBtn = document.createElement('button');
    fitBtn.title = 'Fit view';
    const fitClickSpy = vi.fn();
    fitBtn.addEventListener('click', fitClickSpy);
    document.body.appendChild(fitBtn);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(fitClickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(120);
  });

  it('wp-summary preAction closes console when panel is present', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-summary')!;
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
    await step.preAction!(ctx);
    expect(badgeClickSpy).toHaveBeenCalled();
    expect(document.querySelector('.wf-console-panel')).toBeNull();
  });

  it('has Docker badge tag', () => {
    expect(kafkaWorkflowProduceLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K10: kafka-workflow-consume-wait ───────────────────────────

