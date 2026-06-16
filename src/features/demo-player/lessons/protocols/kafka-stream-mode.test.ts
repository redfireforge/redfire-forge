/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
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
    expect(ids).toEqual(['sm-intro', 'sm-topic', 'sm-start', 'sm-live', 'sm-scroll', 'sm-row', 'sm-stop', 'sm-export']);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaStreamModeLesson.setup).toBe('function');
    expect(typeof kafkaStreamModeLesson.cleanup).toBe('function');
  });

  it('step sm-intro has preAction that clicks consume tab', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume'));
  });

  it('step sm-topic has preAction that selects stream mode, fills topic and position', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-topic')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stream'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('con-topic'), expect.stringContaining('redfireforge'));
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('con-pos'), 'latest');
  });

  it('step sm-start action clicks start stream button', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-start')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stream-start'));
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

  it('step sm-row action clicks first stream row when present (if(row) true branch)', async () => {
    const step = kafkaStreamModeLesson.steps.find((s) => s.id === 'sm-row')!;
    expect(step).toBeDefined();
    const zone = document.createElement('div');
    zone.setAttribute('data-testid', 'stream-results-zone');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    zone.appendChild(tbody);
    document.body.appendChild(zone);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── K9: kafka-workflow-produce ─────────────────────────────────

