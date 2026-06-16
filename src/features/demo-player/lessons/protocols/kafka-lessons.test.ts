/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { kafkaTemplatesLesson } from './kafka-templates';
import { kafkaPublishLesson } from './kafka-publish';
import { kafkaConsumeLesson } from './kafka-consume';
import { kafkaQuickStartLesson } from './kafka-quick-start';
import { kafkaHeadersFiltersLesson } from './kafka-headers-filters';
import { kafkaTopicExplorerLesson } from './kafka-topic-explorer';
import { kafkaSchemaRegistryLesson } from './kafka-schema-registry';
import { kafkaStreamModeLesson } from './kafka-stream-mode';
import { kafkaWorkflowProduceLesson } from './kafka-workflow-produce';
import { kafkaWorkflowConsumeWaitLesson } from './kafka-workflow-consume-wait';
import { kafkaSecureLesson } from './kafka-secure';
import { kafkaTlsLesson } from './kafka-tls';
import { kafkaTestRunnerLesson } from './kafka-test-runner';
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
});

// ─── K1: kafka-quick-start ──────────────────────────────────────

describe('kafka-quick-start lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(kafkaQuickStartLesson.id).toBe('kafka-quick-start');
    expect(kafkaQuickStartLesson.domainId).toBe('protocols');
    expect(kafkaQuickStartLesson.category).toBe('kafka');
    expect(kafkaQuickStartLesson.name).toBe('Quick Start');
    expect(kafkaQuickStartLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaQuickStartLesson.initialTab).toBe('kafka-settings');
  });

  it('declares kafka-settings as initialTab (lesson lives on settings page)', () => {
    expect(kafkaQuickStartLesson.initialTab).toBe('kafka-settings');
  });

  it('declares allowedTabs for both settings and studio to prevent auto-exit', () => {
    expect(kafkaQuickStartLesson.allowedTabs).toContain('kafka-settings');
    expect(kafkaQuickStartLesson.allowedTabs).toContain('kafka-message-studio');
  });

  it('has concept with title, body, key terms, and SVG diagram', () => {
    expect(kafkaQuickStartLesson.concept.title).toBeTruthy();
    expect(kafkaQuickStartLesson.concept.body).toBeTruthy();
    expect(kafkaQuickStartLesson.concept.keyTerms).toBeDefined();
    expect(kafkaQuickStartLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaQuickStartLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 7 steps', () => {
    expect(kafkaQuickStartLesson.steps).toHaveLength(7);
  });

  it('all steps have required fields', () => {
    kafkaQuickStartLesson.steps.forEach((step) => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    });
  });

  it('step IDs are unique', () => {
    const ids = kafkaQuickStartLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaQuickStartLesson.steps.map((s) => s.id);
    expect(ids).toEqual(['ks-intro', 'ks-create', 'ks-fill', 'ks-save', 'ks-connect', 'ks-status', 'ks-studio']);
  });

  it('has dockerEndpoint for plaintext broker', () => {
    expect(kafkaQuickStartLesson.dockerEndpoint).toBe('http://localhost:18080');
  });

  it('has dockerCommand for plaintext stack', () => {
    expect(kafkaQuickStartLesson.dockerCommand).toContain('docker compose up');
  });

  it('has no setup function (starts directly on kafka-settings)', () => {
    expect(kafkaQuickStartLesson.setup).toBeUndefined();
  });

  it('has no cleanup function (cluster config persists for subsequent lessons)', () => {
    expect(kafkaQuickStartLesson.cleanup).toBeUndefined();
  });

  it('step ks-intro has highlight and no action (informational)', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-intro')!;
    expect(step.highlight).toContain('kafka-settings-page');
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step ks-create action clicks empty-state btn if present, else add-cluster btn', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-create')!;
    const ctx = makeCtx();

    // Case 1: empty-state button present — should click it
    const emptyBtn = document.createElement('button');
    emptyBtn.setAttribute('data-testid', 'kafka-empty-create-btn');
    document.body.appendChild(emptyBtn);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
    document.body.innerHTML = '';
    vi.clearAllMocks();

    // Case 2: no empty-state btn, only add-cluster btn
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'kafka-add-cluster-btn');
    document.body.appendChild(addBtn);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('step ks-create does nothing when no btn is in DOM', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-create')!;
    const ctx = makeCtx();
    document.body.innerHTML = '';
    await step.action!(ctx); // should not throw
  });

  it('step ks-fill action fills the cluster name input', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-fill')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith('#kafka-cluster-name', 'Demo Cluster');
  });

  it('step ks-save action clicks the save button', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-save')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('kafka-save-cluster-btn'));
  });

  it('step ks-connect action waits for and clicks the connect button', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-connect')!;
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');
    document.body.appendChild(connectBtn);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('kafka-connect-btn'), 3000);
    expect(ctx.delay).toHaveBeenCalledWith(800);
  });

  it('step ks-connect skips click if connect btn is disabled', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-connect')!;
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');
    connectBtn.disabled = true;
    document.body.appendChild(connectBtn);
    const ctx = makeCtx();
    await step.action!(ctx);
    // waitFor is called, but no click
    expect(ctx.waitFor).toHaveBeenCalled();
    expect(ctx.delay).not.toHaveBeenCalledWith(800);
  });

  it('step ks-connect has a verify selector', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-connect')!;
    expect(step.verify).toContain('kafka-settings-list');
  });

  it('step ks-status has highlight and no action (informational)', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-status')!;
    expect(step.highlight).toContain('kafka-settings-list');
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step ks-studio uses preAction (not action) to navigate to kafka-message-studio', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-studio')!;
    expect(typeof step.preAction).toBe('function');
    expect(step.action).toBeUndefined();
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });
});

// ─── K3: kafka-consume ─────────────────────────────────────────────────────

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

  it('has exactly 9 steps', () => {
    expect(kafkaConsumeLesson.steps).toHaveLength(9);
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
      'con-detail',
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

  it('step con-intro preAction clicks the Consume tab', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-consume'));
  });

  it('step con-topic action fills the topic input', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-topic')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('kms-con-topic'),
      'orders.created',
    );
  });

  it('step con-position action sets start position to earliest', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-position')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('kms-con-pos'),
      'earliest',
    );
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

  it('step con-table has highlight and no action (informational)', () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-table')!;
    expect(step.highlight).toContain('con-results-zone');
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step con-row action clicks the first result row', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-row')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-row-0'));
  });

  it('step con-detail has highlight and no action (informational)', () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-detail')!;
    expect(step.highlight).toContain('con-detail-pane');
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step con-export action clicks the export button', async () => {
    const step = kafkaConsumeLesson.steps.find((s) => s.id === 'con-export')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-export-btn'));
  });
});



// ─── K4: kafka-headers-filters ──────────────────────────────────

describe('kafka-headers-filters lesson', () => {
  it('has valid lesson structure', () => {
    expect(kafkaHeadersFiltersLesson.id).toBe('kafka-headers-filters');
    expect(kafkaHeadersFiltersLesson.domainId).toBe('protocols');
    expect(kafkaHeadersFiltersLesson.category).toBe('kafka');
    expect(kafkaHeadersFiltersLesson.name).toBe('Headers & Filters');
    expect(kafkaHeadersFiltersLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaHeadersFiltersLesson.initialTab).toBe('kafka-message-studio');
  });

  it('has allowedTabs including kafka-settings', () => {
    expect(kafkaHeadersFiltersLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has a dockerEndpoint and dockerCommand', () => {
    expect(kafkaHeadersFiltersLesson.dockerEndpoint).toBeTruthy();
    expect(kafkaHeadersFiltersLesson.dockerCommand).toBeTruthy();
  });

  it('has a setup function (kafkaPublishSetup)', () => {
    expect(typeof kafkaHeadersFiltersLesson.setup).toBe('function');
  });

  it('has a cleanup function', () => {
    expect(typeof kafkaHeadersFiltersLesson.cleanup).toBe('function');
  });

  it('has concept with title, body, and key terms', () => {
    expect(kafkaHeadersFiltersLesson.concept.title).toBeTruthy();
    expect(kafkaHeadersFiltersLesson.concept.body).toBeTruthy();
    expect(kafkaHeadersFiltersLesson.concept.keyTerms).toBeDefined();
    expect(kafkaHeadersFiltersLesson.concept.keyTerms!.length).toBeGreaterThan(0);
  });

  it('has an SVG diagram', () => {
    expect(kafkaHeadersFiltersLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 8 steps', () => {
    expect(kafkaHeadersFiltersLesson.steps.length).toBe(8);
  });

  it('all steps have required fields (id, title, description)', () => {
    for (const step of kafkaHeadersFiltersLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('step IDs are unique', () => {
    const ids = kafkaHeadersFiltersLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaHeadersFiltersLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'hf-headers-intro',
      'hf-add-header',
      'hf-fill-header',
      'hf-send-header',
      'hf-filter-intro',
      'hf-key-filter',
      'hf-jsonpath',
      'hf-detail',
    ]);
  });

  it('step hf-headers-intro has highlight and preAction but no action', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-headers-intro')!;
    expect(step.highlight).toBeTruthy();
    expect(typeof step.preAction).toBe('function');
    expect(step.action).toBeUndefined();
  });

  it('step hf-headers-intro preAction navigates to publish tab', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-headers-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('pub'));
  });

  it('step hf-add-header action clicks the add-header button', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-add-header')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('add-btn'));
  });

  it('step hf-fill-header has preAction that fills header + topic + key + body', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-fill-header')!;
    expect(typeof step.preAction).toBe('function');
    expect(step.action).toBeUndefined();
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[1]);
    expect(fillCalls).toContain('traceId');
    expect(fillCalls).toContain('abc-001');
    expect(fillCalls).toContain('headers.demo');
    expect(fillCalls).toContain('HDR-001');
    expect(fillCalls).toEqual(expect.arrayContaining([expect.stringContaining('"orderId"')]));
  });

  it('step hf-send-header action clicks send and waits for result', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-send-header')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('step hf-filter-intro has preAction to navigate to consume tab, no action', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-filter-intro')!;
    expect(typeof step.preAction).toBe('function');
    expect(step.action).toBeUndefined();
  });

  it('step hf-filter-intro preAction clicks consume tab', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-filter-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume'));
  });

  it('step hf-key-filter has both preAction and action', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
  });

  it('step hf-key-filter preAction fills topic, position, and key filter', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const fillSelectors = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(fillSelectors.some((s: string) => s.includes('con-topic'))).toBe(true);
    expect(fillSelectors.some((s: string) => s.includes('con-key'))).toBe(true);
  });

  it('step hf-key-filter action clicks consume and waits for results', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('results-zone'), expect.any(Number));
  });

  it('step hf-jsonpath preAction clears key filter and sets JSONPath fields', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-jsonpath')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const fillArgs = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const keyFilterClear = fillArgs.find((c: unknown[]) => (c[0] as string).includes('con-key') && c[1] === '');
    expect(keyFilterClear).toBeDefined();
    const jsonpathFill = fillArgs.find((c: unknown[]) => (c[1] as string).includes('$.status'));
    expect(jsonpathFill).toBeDefined();
    const jsonvalFill = fillArgs.find((c: unknown[]) => c[1] === 'CREATED');
    expect(jsonvalFill).toBeDefined();
  });

  it('step hf-detail action clicks first result row and waits for detail pane', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-detail')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('detail-pane'), expect.any(Number));
  });
});

// ─── K6: kafka-topic-explorer ───────────────────────────────────

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
});

// ─── K7: kafka-schema-registry ──────────────────────────────────

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
});

// ─── K8: kafka-stream-mode ──────────────────────────────────────

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
});

// ─── K9: kafka-workflow-produce ─────────────────────────────────

describe('kafka-workflow-produce lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaWorkflowProduceLesson.id).toBe('kafka-workflow-produce');
    expect(kafkaWorkflowProduceLesson.domainId).toBe('protocols');
    expect(kafkaWorkflowProduceLesson.category).toBe('kafka');
    expect(kafkaWorkflowProduceLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaWorkflowProduceLesson.initialTab).toBeUndefined();
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaWorkflowProduceLesson.concept.title).toBeTruthy();
    expect(kafkaWorkflowProduceLesson.concept.body).toBeTruthy();
    expect(kafkaWorkflowProduceLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaWorkflowProduceLesson.concept.diagram).toContain('<svg');
  });

  it('has at least 8 steps with unique IDs', () => {
    expect(kafkaWorkflowProduceLesson.steps.length).toBeGreaterThanOrEqual(8);
    const ids = kafkaWorkflowProduceLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaWorkflowProduceLesson.setup).toBe('function');
    expect(typeof kafkaWorkflowProduceLesson.cleanup).toBe('function');
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaWorkflowProduceLesson.dockerEndpoint).toBeTruthy();
  });

  it('step wp-quicktest action clicks quick test button', async () => {
    const step = kafkaWorkflowProduceLesson.steps.find((s) => s.id === 'wp-quicktest')!;
    expect(step).toBeDefined();
    if (step.action) {
      const ctx = makeCtx();
      await step.action(ctx);
      expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('quick-test'));
    }
  });
});

// ─── K10: kafka-workflow-consume-wait ───────────────────────────

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

  it('has exactly 10 steps with unique IDs', () => {
    expect(kafkaWorkflowConsumeWaitLesson.steps.length).toBe(10);
    const ids = kafkaWorkflowConsumeWaitLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaWorkflowConsumeWaitLesson.setup).toBe('function');
    expect(typeof kafkaWorkflowConsumeWaitLesson.cleanup).toBe('function');
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
});

// ─── K11: kafka-secure ──────────────────────────────────────────

describe('kafka-secure lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaSecureLesson.id).toBe('kafka-secure');
    expect(kafkaSecureLesson.domainId).toBe('protocols');
    expect(kafkaSecureLesson.category).toBe('kafka');
    expect(kafkaSecureLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaSecureLesson.initialTab).toBe('kafka-message-studio');
    expect(kafkaSecureLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaSecureLesson.concept.title).toBeTruthy();
    expect(kafkaSecureLesson.concept.body).toBeTruthy();
    expect(kafkaSecureLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaSecureLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 9 steps with unique IDs', () => {
    expect(kafkaSecureLesson.steps.length).toBe(9);
    const ids = kafkaSecureLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaSecureLesson.steps.map((s) => s.id);
    expect(ids).toEqual(['sec-intro', 'sec-new', 'sec-broker', 'sec-auth', 'sec-creds', 'sec-test', 'sec-save', 'sec-publish', 'sec-result']);
  });

  it('has dockerEndpoint and dockerCommand', () => {
    expect(kafkaSecureLesson.dockerEndpoint).toBeTruthy();
    expect(kafkaSecureLesson.dockerCommand).toContain('secure');
  });

  it('step sec-intro has preAction navigating to kafka-settings', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
  });

  it('step sec-auth action selects SCRAM-SHA-256', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-auth')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('auth-mode'), 'SCRAM-SHA-256');
  });

  it('step sec-creds preAction fills username and password', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-creds')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('username'), 'redfireforge-app');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('password'), 'app-password');
  });

  it('step sec-test action clicks test button', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-test')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('test-btn'));
  });

  it('step sec-publish action clicks send button', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-publish')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });
});

// ─── K12: kafka-tls ─────────────────────────────────────────────

describe('kafka-tls lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaTlsLesson.id).toBe('kafka-tls');
    expect(kafkaTlsLesson.domainId).toBe('protocols');
    expect(kafkaTlsLesson.category).toBe('kafka');
    expect(kafkaTlsLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTlsLesson.initialTab).toBe('kafka-message-studio');
    expect(kafkaTlsLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaTlsLesson.concept.title).toBeTruthy();
    expect(kafkaTlsLesson.concept.body).toBeTruthy();
    expect(kafkaTlsLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaTlsLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 9 steps with unique IDs', () => {
    expect(kafkaTlsLesson.steps.length).toBe(9);
    const ids = kafkaTlsLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaTlsLesson.steps.map((s) => s.id);
    expect(ids).toEqual(['tls-intro', 'tls-new', 'tls-broker', 'tls-auth', 'tls-enable', 'tls-ca', 'tls-test', 'tls-save', 'tls-publish']);
  });

  it('has dockerEndpoint and dockerCommand', () => {
    expect(kafkaTlsLesson.dockerEndpoint).toBeTruthy();
    expect(kafkaTlsLesson.dockerCommand).toContain('tls');
  });

  it('step tls-intro has preAction navigating to kafka-settings', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
  });

  it('step tls-auth action selects SCRAM-SHA-256 and fills credentials', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-auth')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('auth-mode'), 'SCRAM-SHA-256');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('username'), 'redfireforge-app');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('password'), 'app-password');
  });

  it('step tls-test action clicks test button', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-test')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('test-btn'));
  });

  it('step tls-publish action clicks send button', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-publish')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });
});

// ─── K13: kafka-test-runner ─────────────────────────────────────

describe('kafka-test-runner lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaTestRunnerLesson.id).toBe('kafka-test-runner');
    expect(kafkaTestRunnerLesson.domainId).toBe('protocols');
    expect(kafkaTestRunnerLesson.category).toBe('kafka');
    expect(kafkaTestRunnerLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTestRunnerLesson.initialTab).toBeUndefined();
    expect(kafkaTestRunnerLesson.allowedTabs).toContain('results');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaTestRunnerLesson.concept.title).toBeTruthy();
    expect(kafkaTestRunnerLesson.concept.body).toBeTruthy();
    expect(kafkaTestRunnerLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaTestRunnerLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 8 steps with unique IDs', () => {
    expect(kafkaTestRunnerLesson.steps.length).toBe(8);
    const ids = kafkaTestRunnerLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaTestRunnerLesson.steps.map((s) => s.id);
    expect(ids).toEqual(['kr-intro', 'kr-pick', 'kr-vars', 'kr-iterations', 'kr-run', 'kr-results', 'kr-dashboard', 'kr-badges']);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaTestRunnerLesson.setup).toBe('function');
    expect(typeof kafkaTestRunnerLesson.cleanup).toBe('function');
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaTestRunnerLesson.dockerEndpoint).toBeTruthy();
  });

  it('step kr-pick action attempts to open workflow dropdown', async () => {
    const step = kafkaTestRunnerLesson.steps.find((s) => s.id === 'kr-pick')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });
});
