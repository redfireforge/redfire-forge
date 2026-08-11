/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaTemplatesLesson } from './kafka-templates';

const removeKafkaTemplatesByName = vi.fn().mockResolvedValue(undefined);

vi.mock('../setup-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../setup-helpers')>();
  return {
    ...actual,
    preparePlaintextKafkaStudio: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../adapters/kafkaStudioAdapter', () => ({
  removeKafkaTemplatesByName: (...args: unknown[]) => removeKafkaTemplatesByName(...args),
}));

describe('kafka-templates lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.clearAllMocks();
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

  it('has exactly 8 steps', () => {
    expect(kafkaTemplatesLesson.steps.length).toBe(8);
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
      'tmpl-switch-consume',
      'tmpl-consume',
      'tmpl-persist',
    ]);
  });

  it('has no dockerEndpoint — works without a broker', () => {
    expect(kafkaTemplatesLesson.dockerEndpoint).toBeUndefined();
    expect(kafkaTemplatesLesson.dockerCommand).toBeUndefined();
    expect(kafkaTemplatesLesson.tag).toBeUndefined();
  });

  it('has a setup function that cleans stale templates and resets form', async () => {
    expect(typeof kafkaTemplatesLesson.setup).toBe('function');
    const { preparePlaintextKafkaStudio } = await import('../setup-helpers');
    const ctx = makeCtx();
    await kafkaTemplatesLesson.setup!(ctx);
    expect(preparePlaintextKafkaStudio).toHaveBeenCalled();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-publish'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-topic'), '');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-body'), '');
  });

  it('prepareBeforeNavigate clears stale demo templates then connects Kafka', async () => {
    const conKey = 'perf-test-kafka-consume-templates-v1';
    localStorage.setItem(conKey, JSON.stringify([{ id: 'c', name: 'Audit Consumer' }]));
    const { preparePlaintextKafkaStudio } = await import('../setup-helpers');
    await kafkaTemplatesLesson.prepareBeforeNavigate!();
    expect(JSON.parse(localStorage.getItem(conKey) ?? '[]')).toEqual([]);
    expect(preparePlaintextKafkaStudio).toHaveBeenCalled();
  });

  it('setup removes stale publish and consume demo templates from localStorage', async () => {
    const pubKey = 'perf-test-kafka-publish-templates-v1';
    const conKey = 'perf-test-kafka-consume-templates-v1';
    localStorage.setItem(pubKey, JSON.stringify([
      { id: 'a', name: 'Orders Template' },
      { id: 'b', name: 'Other' },
    ]));
    localStorage.setItem(conKey, JSON.stringify([
      { id: 'c', name: 'Audit Consumer' },
      { id: 'd', name: 'Keep Me' },
    ]));
    const ctx = makeCtx();
    await kafkaTemplatesLesson.setup!(ctx);
    const pubRemaining = JSON.parse(localStorage.getItem(pubKey) ?? '[]') as Array<{ name: string }>;
    const conRemaining = JSON.parse(localStorage.getItem(conKey) ?? '[]') as Array<{ name: string }>;
    expect(pubRemaining).toEqual([{ id: 'b', name: 'Other' }]);
    expect(conRemaining).toEqual([{ id: 'd', name: 'Keep Me' }]);
    expect(removeKafkaTemplatesByName).toHaveBeenCalledWith(['Orders Template', 'Audit Consumer']);
  });

  it('has a cleanup function', () => {
    expect(typeof kafkaTemplatesLesson.cleanup).toBe('function');
  });

  it('step tmpl-intro highlights the template controls container', () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-intro')!;
    expect(step.highlight).toContain('kafka-ms-template-controls');
    expect(typeof step.action).toBe('function');
  });

  it('step tmpl-fill-pub action fills topic and body', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-fill-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-topic'), 'orders.events');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-body'), '{"type":"test","source":"template-demo","priority":"high"}');
  });

  it('step tmpl-fill-pub has no preAction', () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-fill-pub')!;
    expect(step.preAction).toBeUndefined();
  });

  it('step tmpl-save-pub action clicks Save, waits for input, fills name, clicks confirm', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-save-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should click Save button (1) then click confirm button (2)
    expect(ctx.click).toHaveBeenCalledTimes(2);
    // Should wait for save input to appear
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('kafka-ms-template-save-input'),
      3000,
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('kafka-ms-template-save-input'),
      'Orders Template',
    );
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1][0]).toContain('kafka-ms-template-confirm-btn');
    // Should wait for save button to reappear (confirms save completed)
    const waitForCalls = (ctx.waitFor as ReturnType<typeof vi.fn>).mock.calls;
    expect(waitForCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('step tmpl-load-pub action clears topic, opens dropdown, waits for items, clicks template', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-load-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('kms-pub-topic'), '');
    // click × 2: Load button, then template item
    expect(ctx.click).toHaveBeenCalledTimes(2);
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      'kafka-ms-template-dropdown-anchor',
    );
    // Should wait for template items before clicking
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('kafka-ms-template-item'),
      3000,
    );
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain(
      'kafka-ms-template-item',
    );
  });

  it('step tmpl-delete-pub action opens dropdown, waits for delete button, clicks it', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-delete-pub')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledTimes(2);
    // Should wait for delete button to appear
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('kafka-ms-template-item-delete'),
      3000,
    );
    expect((ctx.click as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain(
      'kafka-ms-template-item-delete',
    );
  });

  it('step tmpl-switch-consume highlights the Consume tab', () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-switch-consume')!;
    expect(step.highlight).toContain('tab-consume');
  });

  it('step tmpl-switch-consume preAction stays on Publish after clearing templates', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-switch-consume')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(removeKafkaTemplatesByName).toHaveBeenCalledWith(['Orders Template', 'Audit Consumer']);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-publish'));
  });

  it('step tmpl-switch-consume action clicks the Consume tab', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-switch-consume')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-consume'));
  });

  it('step tmpl-consume preAction clears stale templates then clicks the Consume tab', async () => {
    const conKey = 'perf-test-kafka-consume-templates-v1';
    localStorage.setItem(conKey, JSON.stringify([
      { id: 'c', name: 'Audit Consumer' },
    ]));
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-consume')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const remaining = JSON.parse(localStorage.getItem(conKey) ?? '[]') as unknown[];
    expect(remaining).toEqual([]);
    expect(removeKafkaTemplatesByName).toHaveBeenCalledWith(['Orders Template', 'Audit Consumer']);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-consume'));
  });

  it('step tmpl-consume highlights the template controls container', () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-consume')!;
    expect(step.highlight).toContain('kafka-ms-template-controls');
  });

  it('step tmpl-persist preAction clicks the Publish tab', async () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-publish'));
  });

  it('step tmpl-persist highlights the template controls container', () => {
    const step = kafkaTemplatesLesson.steps.find((s) => s.id === 'tmpl-persist')!;
    expect(step.highlight).toContain('kafka-ms-template-controls');
  });

  it('cleanup removes publish and consume demo templates from localStorage', async () => {
    const pubKey = 'perf-test-kafka-publish-templates-v1';
    const conKey = 'perf-test-kafka-consume-templates-v1';
    localStorage.setItem(pubKey, JSON.stringify([
      { id: 'a', name: 'Orders Template' },
      { id: 'b', name: 'Another Template' },
    ]));
    localStorage.setItem(conKey, JSON.stringify([
      { id: 'c', name: 'Audit Consumer' },
      { id: 'd', name: 'User Template' },
    ]));

    await kafkaTemplatesLesson.cleanup!(undefined as unknown as Parameters<typeof kafkaTemplatesLesson.cleanup>[0]);

    const pubRemaining = JSON.parse(localStorage.getItem(pubKey) ?? '[]') as Array<{ name: string }>;
    const conRemaining = JSON.parse(localStorage.getItem(conKey) ?? '[]') as Array<{ name: string }>;
    expect(pubRemaining).toEqual([{ id: 'b', name: 'Another Template' }]);
    expect(conRemaining).toEqual([{ id: 'd', name: 'User Template' }]);
    expect(removeKafkaTemplatesByName).toHaveBeenCalledWith(['Orders Template', 'Audit Consumer']);
  });

  it('cleanup is a no-op when localStorage is empty', async () => {
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

  // ── All preActions/actions run without throwing ─────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaTemplatesLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaTemplatesLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });
});

// ─── K2: kafka-publish ─────────────────────────────────────────────────────
