/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { kafkaTemplatesLesson } from './kafka-templates';
import { kafkaPublishLesson } from './kafka-publish';
import type { DemoActionContext } from '../../types';

function makeCtx(): DemoActionContext {
  return {
    navigateToTab: vi.fn(),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    delay: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── K5: kafka-templates ────────────────────────────────────────

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

describe('kafka-publish lesson', () => {
  it('has valid lesson structure', () => {
    expect(kafkaPublishLesson.id).toBe('kafka-publish');
    expect(kafkaPublishLesson.domainId).toBe('protocols');
    expect(kafkaPublishLesson.category).toBe('kafka');
    expect(kafkaPublishLesson.name).toBe('Publish Studio');
    expect(kafkaPublishLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaPublishLesson.initialTab).toBe('kafka-message-studio');
  });

  it('declares kafka-settings in allowedTabs so setup navigation does not auto-exit demo', () => {
    expect(kafkaPublishLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has concept with title, body, key terms, and SVG diagram', () => {
    expect(kafkaPublishLesson.concept.title).toBeTruthy();
    expect(kafkaPublishLesson.concept.body).toBeTruthy();
    expect(kafkaPublishLesson.concept.keyTerms).toBeDefined();
    expect(kafkaPublishLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaPublishLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 9 steps', () => {
    expect(kafkaPublishLesson.steps).toHaveLength(9);
  });

  it('all steps have required fields', () => {
    for (const step of kafkaPublishLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('step IDs are unique', () => {
    const ids = kafkaPublishLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaPublishLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'pub-intro',
      'pub-topic',
      'pub-body',
      'pub-key',
      'pub-acks',
      'pub-format',
      'pub-send',
      'pub-result',
      'pub-clear',
    ]);
  });

  it('has dockerEndpoint for plaintext broker', () => {
    expect(kafkaPublishLesson.dockerEndpoint).toBe('http://localhost:18080');
  });

  it('has dockerCommand for plaintext stack', () => {
    expect(kafkaPublishLesson.dockerCommand).toContain('docker/kafka/plaintext');
  });

  it('has setup function (kafkaPublishSetup)', () => {
    expect(typeof kafkaPublishLesson.setup).toBe('function');
  });

  it('has cleanup function (kafkaCleanup)', () => {
    expect(typeof kafkaPublishLesson.cleanup).toBe('function');
  });

  it('step pub-intro has highlight and no action', () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-intro')!;
    expect(step.highlight).toBeTruthy();
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step pub-topic action fills the topic input', async () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-topic')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-topic'), 'orders.created');
  });

  it('step pub-body action fills the body textarea', async () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-body')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('kms-pub-body'),
      expect.stringContaining('orderId'),
    );
  });

  it('step pub-key action fills the key input', async () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-key')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('kms-pub-key'),
      'order-demo-001',
    );
  });

  it('step pub-acks has no action (informational)', () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-acks')!;
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step pub-format action clicks the format button', async () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-format')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('pub-format-btn'));
  });

  it('step pub-send action clicks Send and has verify selector', () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-send')!;
    expect(typeof step.action).toBe('function');
    expect(step.verify).toContain('pub-result');
  });

  it('step pub-send action clicks the send button', async () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('pub-send-btn'));
  });

  it('step pub-result has highlight but no action (informational)', () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-result')!;
    expect(step.highlight).toContain('pub-result');
    expect(step.action).toBeUndefined();
  });

  it('step pub-clear action clicks the clear button', async () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-clear')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('pub-clear-btn'));
  });
});

