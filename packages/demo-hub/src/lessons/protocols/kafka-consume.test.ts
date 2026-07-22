/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaConsumeLesson } from './kafka-consume';

describe('kafka-consume lesson', () => {
  it('has valid lesson structure', () => {
    expect(kafkaConsumeLesson.id).toBe('kafka-consume');
    expect(kafkaConsumeLesson.domainId).toBe('protocols');
    expect(kafkaConsumeLesson.category).toBe('kafka');
    expect(kafkaConsumeLesson.name).toBe('Consume Studio');
    expect(kafkaConsumeLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaConsumeLesson.initialTab).toBe('kafka-message-studio');
  });

  it('declares kafka-settings in allowedTabs so setup navigation does not auto-exit demo', () => {
    expect(kafkaConsumeLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has concept with title, body, key terms, and SVG diagram', () => {
    expect(kafkaConsumeLesson.concept.title).toBeTruthy();
    expect(kafkaConsumeLesson.concept.body).toBeTruthy();
    expect(kafkaConsumeLesson.concept.keyTerms).toBeDefined();
    expect(kafkaConsumeLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaConsumeLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 8 steps', () => {
    expect(kafkaConsumeLesson.steps).toHaveLength(8);
  });

  it('all steps have required fields', () => {
    for (const step of kafkaConsumeLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('step IDs are unique', () => {
    const ids = kafkaConsumeLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaConsumeLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'con-intro',
      'con-topic',
      'con-position',
      'con-max',
      'con-consume',
      'con-table',
      'con-row',
      'con-export',
    ]);
  });

  it('has dockerEndpoint for plaintext broker', () => {
    expect(kafkaConsumeLesson.dockerEndpoint).toBe('http://localhost:18080');
  });

  it('has dockerCommand for plaintext stack', () => {
    expect(kafkaConsumeLesson.dockerCommand).toContain('docker/kafka/plaintext');
  });

  it('has setup function (kafkaPublishSetup)', () => {
    expect(typeof kafkaConsumeLesson.setup).toBe('function');
  });

  it('has cleanup function (kafkaCleanup)', () => {
    expect(typeof kafkaConsumeLesson.cleanup).toBe('function');
  });

  it('step con-intro preAction clicks the Consume tab and ensures Consume Once mode', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-consume'));
    // Also resets to "Consume Once" mode so con-consume-btn is always in DOM.
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-mode-once'));
  });

  it('step con-topic action fills the topic input', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-topic')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('kms-con-topic'),
      expect.stringContaining('orders.consume-demo'),
    );
  });

  it('step con-position action demonstrates position selection via DOM interaction', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-position')!;
    expect(step.action).toBeDefined();
    expect(step.highlight).toContain('con-position-select');
  });

  it('step con-max action fills max messages', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-max')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('kms-con-max'),
      '5',
    );
  });

  it('step con-consume action clicks Consume Once and has verify selector', () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-consume')!;
    expect(typeof step.action).toBe('function');
    expect(step.verify).toContain('con-results-zone');
  });

  it('step con-consume action clicks the consume button', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-consume')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-consume-btn'));
  });

  it('step con-table has highlight and preAction guard (informational)', () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-table')!;
    expect(step.highlight).toContain('con-results-zone');
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeDefined();
  });

  it('step con-row action clicks the first row and opens/closes the detail modal', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-row')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-row-0'));
    expect(step.preAction).toBeDefined();
  });

  it('step con-export action clicks the export button', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-export')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-export-btn'));
  });
  it('has Docker badge tag', () => {
    expect(kafkaConsumeLesson.tag).toBe('🐳 Docker');
  });

});



// ─── K4: kafka-headers-filters ──────────────────────────────────

