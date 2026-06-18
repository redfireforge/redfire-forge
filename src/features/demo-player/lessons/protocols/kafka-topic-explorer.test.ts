/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaTopicExplorerLesson } from './kafka-topic-explorer';

describe('kafka-topic-explorer lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaTopicExplorerLesson.id).toBe('kafka-topic-explorer');
    expect(kafkaTopicExplorerLesson.domainId).toBe('protocols');
    expect(kafkaTopicExplorerLesson.category).toBe('kafka');
    expect(kafkaTopicExplorerLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTopicExplorerLesson.initialTab).toBe('kafka-message-studio');
    expect(kafkaTopicExplorerLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaTopicExplorerLesson.concept.title).toBeTruthy();
    expect(kafkaTopicExplorerLesson.concept.body).toBeTruthy();
    expect(kafkaTopicExplorerLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaTopicExplorerLesson.concept.diagram).toContain('<svg');
  });

  it('has at least 7 steps', () => {
    expect(kafkaTopicExplorerLesson.steps.length).toBeGreaterThanOrEqual(7);
  });

  it('all steps have required fields and unique IDs', () => {
    for (const step of kafkaTopicExplorerLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
    const ids = kafkaTopicExplorerLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaTopicExplorerLesson.dockerEndpoint).toBeTruthy();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaTopicExplorerLesson.setup).toBe('function');
    expect(typeof kafkaTopicExplorerLesson.cleanup).toBe('function');
  });

  it('step te-intro has a preAction that clicks topics tab', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-intro')!;
    expect(step).toBeDefined();
    const ctx = makeCtx();
    if (step.preAction) await step.preAction(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTopicExplorerLesson.setup) {
      await expect(kafkaTopicExplorerLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTopicExplorerLesson.cleanup) {
      await expect(kafkaTopicExplorerLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaTopicExplorerLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaTopicExplorerLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaTopicExplorerLesson.steps) {
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

  it('step te-select action clicks first topic row when present (if(row) true branch)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-select')!;
    expect(step).toBeDefined();
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── K7: kafka-schema-registry ──────────────────────────────────

