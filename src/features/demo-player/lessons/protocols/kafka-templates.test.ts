/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaTemplatesLesson } from './kafka-templates';

describe('kafka-templates lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('has valid lesson structure', () => {
    expect(kafkaTemplatesLesson.id).toBe('kafka-templates');
    expect(kafkaTemplatesLesson.domainId).toBe('protocols');
    expect(kafkaTemplatesLesson.category).toBe('kafka');
    expect(kafkaTemplatesLesson.name).toBe('Templates');
    expect(kafkaTemplatesLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTemplatesLesson.initialTab).toBe('kafka-message-studio');
  });

  it('has concept with title, body, and key terms', () => {
    expect(kafkaTemplatesLesson.concept.title).toBeTruthy();
    expect(kafkaTemplatesLesson.concept.body).toBeTruthy();
    expect(kafkaTemplatesLesson.concept.keyTerms).toBeDefined();
    expect(kafkaTemplatesLesson.concept.keyTerms!.length).toBeGreaterThan(0);
  });

  it('has an SVG diagram', () => {
    expect(kafkaTemplatesLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 7 steps', () => {
    expect(kafkaTemplatesLesson.steps.length).toBe(7);
  });

  it('all steps have required fields', () => {
    for (const step of kafkaTemplatesLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('step IDs are unique', () => {
    const ids = kafkaTemplatesLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaTemplatesLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'tmpl-intro',
      'tmpl-fill-pub',
      'tmpl-save-pub',
      'tmpl-load-pub',
      'tmpl-delete-pub',
      'tmpl-consume',
      'tmpl-persist',
    ]);
  });

  it('has no dockerEndpoint — works without a broker', () => {
    expect(kafkaTemplatesLesson.dockerEndpoint).toBeUndefined();
    expect(kafkaTemplatesLesson.dockerCommand).toBeUndefined();
  });

  it('has no setup function (initialTab handles navigation)', () => {
    expect(kafkaTemplatesLesson.setup).toBeUndefined();
  });

  it('has a cleanup function', () => {
    expect(typeof kafkaTemplatesLesson.cleanup).toBe('function');
  });

  it('step tmpl-intro has a highlight but no action', () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-intro')!;
    expect(step.highlight).toBeTruthy();
    expect(step.action).toBeUndefined();
  });

  it('step tmpl-fill-pub action fills topic and body', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-fill-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-topic'), 'orders.events');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-body'), '{"type":"test"}');
  });

  it('step tmpl-fill-pub has no preAction', () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-fill-pub')!;
    expect(step.preAction).toBeUndefined();
  });

  it('step tmpl-save-pub action clicks Save, fills name, clicks confirm', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-save-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should click Save button (1) then click confirm button (2)
    expect(ctx.click).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('kafka-ms-template-save-input'),
      'Orders Template',
    );
    // Confirm button must use the correct class (not the old .kafka-ms-template-btn selector)
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1][0]).toContain('kafka-ms-template-confirm-btn');
  });

  it('step tmpl-load-pub action clears topic, opens dropdown, and clicks template item', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-load-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // fill: clears the topic to make reload visually obvious
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-topic'), '');
    // click × 2: Load button, then template item
    expect(ctx.click).toHaveBeenCalledTimes(2);
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      'kafka-ms-template-dropdown-anchor',
    );
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain(
      'kafka-ms-template-item',
    );
  });

  it('step tmpl-delete-pub action opens dropdown and clicks delete button', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-delete-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledTimes(2);
    // Second call: delete button
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain(
      'kafka-ms-template-item-delete',
    );
  });

  it('step tmpl-consume preAction clicks the Consume tab', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-consume')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-consume'));
  });

  it('step tmpl-persist preAction clicks the Publish tab', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-publish'));
  });

  it('cleanup removes "Orders Template" from localStorage', async () => {
    // Seed a template in localStorage using the real key
    const key = 'perf-test-kafka-publish-templates-v1';
    const templates = [
      { id: 'a', name: 'Orders Template' },
      { id: 'b', name: 'Another Template' },
    ];
    localStorage.setItem(key, JSON.stringify(templates));

    await kafkaTemplatesLesson.cleanup!(undefined as unknown as Parameters<typeof kafkaTemplatesLesson.cleanup>[0]);

    const remaining = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{ name: string }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Another Template');
  });

  it('cleanup is a no-op when localStorage is empty', async () => {
    // Should not throw even when key is absent
    await expect(
      kafkaTemplatesLesson.cleanup!(undefined as unknown as Parameters<typeof kafkaTemplatesLesson.cleanup>[0]),
    ).resolves.toBeUndefined();
  });

  it('cleanup handles malformed localStorage gracefully', async () => {
    localStorage.setItem('perf-test-kafka-publish-templates-v1', 'not-json{{{');
    await expect(
      kafkaTemplatesLesson.cleanup!(undefined as unknown as Parameters<typeof kafkaTemplatesLesson.cleanup>[0]),
    ).resolves.toBeUndefined();
  });
});

// ─── K2: kafka-publish ─────────────────────────────────────────────────────

