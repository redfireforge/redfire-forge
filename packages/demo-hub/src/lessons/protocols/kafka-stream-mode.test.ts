/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';

vi.mock('../../demoRipple', () => ({ showSpotlightRing: vi.fn(() => vi.fn()), purgeAllSpotlightRings: vi.fn() }));

import { kafkaStreamModeLesson } from './kafka-stream-mode';

describe('kafka-stream-mode lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaStreamModeLesson.id).toBe('kafka-stream-mode');
    expect(kafkaStreamModeLesson.domainId).toBe('protocols');
    expect(kafkaStreamModeLesson.category).toBe('kafka');
    expect(kafkaStreamModeLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaStreamModeLesson.initialTab).toBe('kafka-message-studio');
    expect(kafkaStreamModeLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaStreamModeLesson.concept.title).toBeTruthy();
    expect(kafkaStreamModeLesson.concept.body).toBeTruthy();
    expect(kafkaStreamModeLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaStreamModeLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 8 steps with unique IDs', () => {
    expect(kafkaStreamModeLesson.steps.length).toBe(8);
    const ids = kafkaStreamModeLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaStreamModeLesson.steps.map((s) => s.id);
    expect(ids).toEqual(['sm-intro', 'sm-position', 'sm-start', 'sm-live', 'sm-scroll', 'sm-row', 'sm-stop', 'sm-export']);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaStreamModeLesson.setup).toBe('function');
    expect(typeof kafkaStreamModeLesson.cleanup).toBe('function');
  });

  it('step sm-intro highlights the stream mode button', () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-intro')!;
    expect(step.highlight).toContain('stream');
  });

  it('step sm-intro preAction waits for mode tabs quietly', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('con-mode-tabs'), expect.any(Number));
  });

  it('step sm-intro action selects stream mode and fills topic', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stream'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('con-topic'), 'orders.created');
  });

  it('setup does not tour Publish or Settings UI', async () => {
    const ctx = makeCtx();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { state: 'connected', clusterId: 'demo-cluster' } }),
    } as Response);
    await kafkaStreamModeLesson.setup!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    fetchSpy.mockRestore();
  });


  it('step sm-position has highlight on position select and action opens dropdown', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-position')!;
    expect(step.highlight).toContain('con-position-select');
    const ctx = makeCtx();
    // DOM is empty — action should complete without throwing
    await expect(step.action!(ctx)).resolves.not.toThrow();
  });

  it('step sm-position action clicks cs-trigger and earliest item when present', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-position')!;
    // Build fake CustomSelect DOM
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-testid', 'con-position-select');
    const trigger = document.createElement('button');
    trigger.className = 'cs-trigger';
    trigger.textContent = 'Latest';
    wrapper.appendChild(trigger);
    document.body.appendChild(wrapper);
    // Build portaled menu
    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    const earliest = document.createElement('div');
    earliest.className = 'cs-item';
    earliest.textContent = 'Earliest';
    const earliestClickSpy = vi.fn();
    earliest.addEventListener('click', earliestClickSpy);
    menu.appendChild(earliest);
    document.body.appendChild(menu);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-position-select'));
    expect(earliestClickSpy).toHaveBeenCalled();
  });

  it('step sm-start action clicks start stream button', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-start')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stream-start'));
  });

  it('step sm-scroll has an action that demonstrates auto-scroll', () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-scroll')!;
    expect(typeof step.action).toBe('function');
    expect(typeof step.preAction).toBe('function');
    expect(step.description).toMatch(/Newest/i);
  });

  it('step sm-scroll action clicks ↓ Newest when table overflows', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-scroll')!;
    const zone = document.createElement('div');
    zone.setAttribute('data-testid', 'stream-results-zone');
    zone.scrollIntoView = vi.fn();
    const wrap = document.createElement('div');
    wrap.setAttribute('data-testid', 'stream-table-wrap');
    wrap.className = 'kafka-ms-stream-table-wrap';
    Object.defineProperty(wrap, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 200, configurable: true });
    wrap.scrollTop = 400;
    zone.appendChild(wrap);
    const scrollBtn = document.createElement('button');
    scrollBtn.setAttribute('data-testid', 'stream-scroll-bottom-btn');
    zone.appendChild(scrollBtn);
    document.body.appendChild(zone);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { state: 'connected', clusterId: 'demo-cluster' } }),
    } as Response);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stream-scroll-bottom'));
    expect(wrap.scrollTop).toBe(0);
    fetchSpy.mockRestore();
  });

  it('step sm-stop action clicks stop stream button', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-stop')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stream-stop'));
  });

  it('step sm-export action clicks export stream button', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-export')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stream-export'));
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaStreamModeLesson.setup) {
      await expect(kafkaStreamModeLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaStreamModeLesson.cleanup) {
      await expect(kafkaStreamModeLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaStreamModeLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaStreamModeLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaStreamModeLesson.steps) {
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

  it('step sm-row highlights the first stream row', () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-row')!;
    expect(step.highlight).toContain('stream-row-0');
  });

  it('step sm-row action clicks first stream row and waits for detail modal', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-row')!;
    expect(step).toBeDefined();
    const zone = document.createElement('div');
    zone.setAttribute('data-testid', 'stream-results-zone');
    const row = document.createElement('tr');
    row.setAttribute('data-testid', 'stream-row-0');
    row.scrollIntoView = vi.fn();
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    zone.appendChild(row);
    document.body.appendChild(zone);
    const modal = document.createElement('div');
    modal.setAttribute('data-testid', 'kafka-message-detail-modal');
    document.body.appendChild(modal);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('kafka-message-detail-modal'),
      expect.any(Number),
    );
  });

  it('step sm-row preAction clicks streamBtn when not active and scrolls table to top', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-row')!;
    // Create a stream mode button WITHOUT 'active' class
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'con-mode-stream');
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);
    document.body.appendChild(btn);
    // Create stream results zone with the table wrapper
    const zone = document.createElement('div');
    zone.setAttribute('data-testid', 'stream-results-zone');
    zone.scrollIntoView = vi.fn();
    const tableWrap = document.createElement('div');
    tableWrap.setAttribute('data-testid', 'stream-table-wrap');
    tableWrap.className = 'kafka-ms-stream-table-wrap';
    const scrollToSpy = vi.fn();
    tableWrap.scrollTo = scrollToSpy;
    zone.appendChild(tableWrap);
    document.body.appendChild(zone);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    // Table wrapper is scrolled to top so the first row is fully visible
    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(zone.scrollIntoView).toHaveBeenCalled();
  });
  it('has Docker badge tag', () => {
    expect(kafkaStreamModeLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K9: kafka-workflow-produce ─────────────────────────────────

