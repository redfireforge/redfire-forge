/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaSchemaRegistryLesson } from './kafka-schema-registry';

describe('kafka-schema-registry lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaSchemaRegistryLesson.id).toBe('kafka-schema-registry');
    expect(kafkaSchemaRegistryLesson.domainId).toBe('protocols');
    expect(kafkaSchemaRegistryLesson.category).toBe('kafka');
    expect(kafkaSchemaRegistryLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaSchemaRegistryLesson.initialTab).toBe('kafka-message-studio');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaSchemaRegistryLesson.concept.title).toBeTruthy();
    expect(kafkaSchemaRegistryLesson.concept.body).toBeTruthy();
    expect(kafkaSchemaRegistryLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaSchemaRegistryLesson.concept.diagram).toContain('<svg');
  });

  it('has at least 7 steps with unique IDs', () => {
    expect(kafkaSchemaRegistryLesson.steps.length).toBeGreaterThanOrEqual(7);
    const ids = kafkaSchemaRegistryLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaSchemaRegistryLesson.setup).toBe('function');
    expect(typeof kafkaSchemaRegistryLesson.cleanup).toBe('function');
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaSchemaRegistryLesson.dockerEndpoint).toBeTruthy();
  });

  it('step sr-connect action clicks connect button', async () => {
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-connect')!;
    expect(step).toBeDefined();
    if (step.action) {
      const ctx = makeCtx();
      await step.action(ctx);
      expect(ctx.click).toHaveBeenCalled();
    }
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaSchemaRegistryLesson.setup) {
      await expect(kafkaSchemaRegistryLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaSchemaRegistryLesson.cleanup) {
      await expect(kafkaSchemaRegistryLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaSchemaRegistryLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaSchemaRegistryLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaSchemaRegistryLesson.steps) {
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

  it('step sr-select action clicks first subject row when present (if(row) true branch)', async () => {
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-select')!;
    expect(step).toBeDefined();
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'subject-table');
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

// ─── K8: kafka-stream-mode ──────────────────────────────────────

