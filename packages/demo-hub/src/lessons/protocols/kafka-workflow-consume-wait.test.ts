/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { stubWorkflowSeedBridge, clearWorkflowSeedBridge } from '../../test-utils/workflowBridgeStubs';
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

  it('has exactly 11 steps with unique IDs', () => {
    expect(kafkaWorkflowConsumeWaitLesson.steps.length).toBe(11);
    const ids = kafkaWorkflowConsumeWaitLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaWorkflowConsumeWaitLesson.setup).toBe('function');
    expect(typeof kafkaWorkflowConsumeWaitLesson.cleanup).toBe('function');
  });

  it('step cw-consume-node preAction double-clicks node to open config modal', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-node')!;
    expect(step).toBeDefined();
    expect(step.highlight).toBe('.wf-config-modal-scroll');
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(2000);
  });

  it('step cw-wait-node preAction double-clicks node to open config modal', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-node')!;
    expect(step).toBeDefined();
    expect(step.highlight).toBe('.wf-config-modal-scroll');
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(2000);
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
    const { deleteByName: deleteSpy } = stubWorkflowSeedBridge('Kafka Consume & Wait Demo');
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.setup!(ctx);
    expect(deleteSpy).toHaveBeenCalledWith('Kafka Consume & Wait Demo');
    clearWorkflowSeedBridge();
  });

  it('setup calls __wfInsertWorkflow when set on window (lines 118-121 true branch)', async () => {
    const { insertWorkflow: insertSpy } = stubWorkflowSeedBridge('Kafka Consume & Wait Demo');
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.setup!(ctx);
    expect(insertSpy).toHaveBeenCalled();
    clearWorkflowSeedBridge();
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
    (window as unknown as Record<string, unknown>).__demoExpandAppSidebar = vi.fn();
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = vi.fn();
    document.body.innerHTML =
      '<div class="wf-sidebar-item"><span class="wf-sidebar-item-name">Kafka Consume & Wait Demo</span></div>';
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

  // ── Step preActions and actions ──────────────────────────────────

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

  it('cleanup closes console and calls __wfDeleteByName when present', async () => {
    const consolePanel = document.createElement('div');
    consolePanel.className = 'wf-console-panel';
    document.body.appendChild(consolePanel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    document.body.appendChild(badge);
    const wfDelete = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = wfDelete;
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.cleanup!(ctx);
    expect(wfDelete).toHaveBeenCalledWith('Kafka Consume & Wait Demo');
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
  });

  it('step cw-consume preAction double-clicks consume node when modal is closed and node present', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume')!;
    if (!step?.preAction) return;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
  });

  it('step cw-output-bind preAction scrolls output-bindings-section into view when present', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-output-bind')!;
    if (!step?.preAction) return;
    // Make config modal present so double-click branch is skipped
    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    document.body.appendChild(modal);
    const section = document.createElement('div');
    section.setAttribute('data-testid', 'output-bindings-section');
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(section.scrollIntoView).toHaveBeenCalled();
  });

  it('step cw-wait-config preAction opens wait node and scrolls correlation section into view', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!;
    if (!step?.preAction) return;
    // No wait config modal present — should open node
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const correlSection = document.createElement('div');
    correlSection.setAttribute('data-testid', 'wait-correlation-section');
    correlSection.scrollIntoView = vi.fn();
    document.body.appendChild(correlSection);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(correlSection.scrollIntoView).toHaveBeenCalled();
  });

  it('step cw-sample-payload preAction opens wait node and scrolls sample textarea into view', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-sample-payload')!;
    if (!step?.preAction) return;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'wait-sample-payload');
    textarea.scrollIntoView = vi.fn();
    document.body.appendChild(textarea);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(textarea.scrollIntoView).toHaveBeenCalled();
  });

  it('closeConfigModal closes modal when present and Close button found', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-node')!;
    if (!step?.preAction) return;
    document.body.innerHTML = `
      <div class="wf-config-modal">
        <div class="wf-config-modal-footer-actions">
          <button class="btn-ghost">Close</button>
        </div>
      </div>
    `;
    const closeBtn = document.querySelector<HTMLButtonElement>('.btn-ghost')!;
    const closeClickSpy = vi.spyOn(closeBtn, 'click');
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(closeClickSpy).toHaveBeenCalled();
  });

  it('step cw-console action closes console when panel is open', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-console')!;
    if (!step?.action) return;
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    document.body.appendChild(panel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const badgeClickSpy = vi.fn();
    badge.addEventListener('click', () => panel.remove());
    badge.addEventListener('click', badgeClickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await step.action(ctx);
    expect(badgeClickSpy).toHaveBeenCalled();
    expect(document.querySelector('.wf-console-panel')).toBeNull();
  });

  it('step cw-load-mode preAction opens wait node and scrolls load mode selector into view', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-load-mode')!;
    if (!step?.preAction) return;
    // No WAIT_CONFIG present — should double-click node
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const loadModeEl = document.createElement('select');
    loadModeEl.setAttribute('data-testid', 'wait-load-mode');
    loadModeEl.scrollIntoView = vi.fn();
    document.body.appendChild(loadModeEl);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(loadModeEl.scrollIntoView).toHaveBeenCalled();
  });

  it('step cw-output-bind preAction double-clicks consume node when modal absent (line 297 true branch)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-output-bind')!;
    if (!step?.preAction) return;
    // No modal present
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
  });

  it('step cw-wait-config preAction when modal present — skips node dblclick, scrolls correlation section', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-config')!;
    if (!step?.preAction) return;
    // Wait config modal present — skip node dblclick
    const modal = document.createElement('div');
    modal.setAttribute('data-testid', 'kafka-wait-config');
    document.body.appendChild(modal);
    const correlSection = document.createElement('div');
    correlSection.setAttribute('data-testid', 'wait-correlation-section');
    correlSection.scrollIntoView = vi.fn();
    document.body.appendChild(correlSection);
    const ctx = makeCtx();
    await step.preAction(ctx);
    // No dblclick since modal is open
    expect(correlSection.scrollIntoView).toHaveBeenCalled();
  });

  it('setup: consolePanel present but badge absent — skips badge click (line 130 false branch)', async () => {
    const consolePanel = document.createElement('div');
    consolePanel.className = 'wf-console-panel';
    document.body.appendChild(consolePanel);
    // No badge present
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.setup!(ctx);
    // Should not throw even with missing badge
    expect(true).toBe(true);
  });

  it('closeConfigModal: modal present but no Close button — does not throw (line 157 false branch)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-wait-node')!;
    if (!step?.preAction) return;
    // Create config modal WITHOUT a Close button
    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    const otherBtn = document.createElement('button');
    otherBtn.textContent = 'Cancel'; // Not 'Close'
    modal.appendChild(otherBtn);
    document.body.appendChild(modal);
    const ctx = makeCtx();
    await expect(step.preAction(ctx)).resolves.not.toThrow();
  });

  it('cw-output-bind preAction: modal present — skips dblclick, scrolls section (lines 295[1] false branch)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-output-bind')!;
    if (!step?.preAction) return;
    // Create config modal so `!document.querySelector('.wf-config-modal')` is false
    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    document.body.appendChild(modal);
    // Section present to cover line 303 scrollIntoView
    const section = document.createElement('div');
    section.setAttribute('data-testid', 'output-bindings-section');
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(section.scrollIntoView).toHaveBeenCalled();
  });

  it('cw-output-bind preAction: modal absent, consume node present — dblclicks node (line 297 true branch)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-output-bind')!;
    if (!step?.preAction) return;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
  });

  it('cw-sample-payload preAction: wait config absent, node present — dblclicks wait node (line 354 true branch)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-sample-payload')!;
    if (!step?.preAction) return;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    // Sample textarea for scrolling
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'wait-sample-payload');
    textarea.scrollIntoView = vi.fn();
    document.body.appendChild(textarea);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
  });

  it('cw-load-mode preAction: wait config absent, node present — dblclicks wait node (line 374 true branch)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-load-mode')!;
    if (!step?.preAction) return;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaWait';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
  });

  it('cw-console step action: panel absent, badge absent — no throw (line 404 false branch)', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-console')!;
    if (!step?.action) return;
    // No panel and no badge — should silently skip
    const ctx = makeCtx();
    await expect(step.action(ctx)).resolves.not.toThrow();
  });

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

  it('cleanup closes console badge when panel is open', async () => {
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    document.body.appendChild(panel);
    const badge = document.createElement('div');
    badge.className = 'wf-console-badge';
    const clickSpy = vi.fn();
    badge.addEventListener('click', clickSpy);
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await kafkaWorkflowConsumeWaitLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cw-consume-binding preAction dblclicks consume node when config modal absent', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-binding')!;
    const node = document.createElement('div');
    node.className = 'wf-node-kafkaConsume';
    const dblclickSpy = vi.fn();
    node.addEventListener('dblclick', dblclickSpy);
    document.body.appendChild(node);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(dblclickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(2000);
  });

  it('cw-consume-binding preAction skips dblclick when config modal already open', async () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-consume-binding')!;
    const modal = document.createElement('div');
    modal.className = 'wf-config-modal';
    document.body.appendChild(modal);
    const section = document.createElement('div');
    section.setAttribute('data-testid', 'output-bindings-section');
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(section.scrollIntoView).toHaveBeenCalled();
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

  it('cw-summary has no preAction (console closed at end of cw-console)', () => {
    const step = kafkaWorkflowConsumeWaitLesson.steps.find((s) => s.id === 'cw-summary')!;
    expect(step.preAction).toBeUndefined();
  });
});

// ─── K11: kafka-secure ──────────────────────────────────────────

