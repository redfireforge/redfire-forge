/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaPublishLesson } from './kafka-publish';

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

  it('step pub-intro has highlight, a preAction to switch to Publish tab, and no action', async () => {
    const step = kafkaPublishLesson.steps.find((s) => s.id === 'pub-intro')!;
    expect(step.highlight).toBeTruthy();
    expect(step.action).toBeUndefined();
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-publish'));
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
  it('has Docker badge tag', () => {
    expect(kafkaPublishLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K1: kafka-quick-start ──────────────────────────────────────

