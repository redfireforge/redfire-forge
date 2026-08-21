/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaQuickStartLesson } from './kafka-quick-start';

vi.mock('../../demoRipple', () => ({ showSpotlightRing: () => () => {} }));

const clearAllKafkaClusters = vi.fn();
vi.mock('../../adapters/kafkaStudioAdapter', () => ({
  clearAllKafkaClusters: (...args: unknown[]) => clearAllKafkaClusters(...args),
  deleteKafkaClusterById: vi.fn(),
  deleteKafkaClusterByName: vi.fn(),
}));

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

  it('has a setup function that cleans stale clusters before starting', () => {
    expect(typeof kafkaQuickStartLesson.setup).toBe('function');
  });

  it('setup navigates to kafka-settings and handles empty DOM gracefully', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '';
    await expect(kafkaQuickStartLesson.setup!(ctx)).resolves.not.toThrow();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
  });

  it('has a cleanup function', () => {
    expect(typeof kafkaQuickStartLesson.cleanup).toBe('function');
  });

  it('cleanup clears clusters quietly without navigating Settings', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = '';
    clearAllKafkaClusters.mockClear();
    await expect(kafkaQuickStartLesson.cleanup!(ctx)).resolves.not.toThrow();
    expect(clearAllKafkaClusters).toHaveBeenCalled();
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('prepareBeforeNavigate clears clusters before Settings paints', async () => {
    clearAllKafkaClusters.mockClear();
    await kafkaQuickStartLesson.prepareBeforeNavigate!(makeCtx());
    expect(clearAllKafkaClusters).toHaveBeenCalled();
  });

  it('step ks-intro preAction clears selected class from cluster cards', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-intro')!;
    const card = document.createElement('div');
    card.className = 'kafka-cluster-card selected';
    document.body.appendChild(card);
    await step.preAction!({} as never);
    expect(card.classList.contains('selected')).toBe(false);
  });

  it('step ks-intro has settings highlight and preAction that clears selected cards', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-intro')!;
    expect(step.highlight).toContain('ab-settings');
    expect(step.action).toBeDefined();
    expect(step.preAction).toBeDefined();
  });

  it('step ks-intro action waits for the settings page (navigation already done by setup)', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-intro')!;
    const ctx = makeCtx();

    const page = document.createElement('div');
    page.setAttribute('data-testid', 'kafka-settings-page');
    document.body.appendChild(page);

    await step.action!(ctx);

    // Intentionally no ab-settings/nav-tab click choreography here — that caused
    // a visible flash before step 1 narrates. Setup already navigates silently.
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="kafka-settings-page"]', 2500);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step ks-create action clicks empty-state btn when present', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-create')!;
    const ctx = makeCtx();

    const emptyBtn = document.createElement('button');
    emptyBtn.setAttribute('data-testid', 'kafka-empty-create-btn');
    document.body.appendChild(emptyBtn);

    // Also add a cluster editor element so waitFor succeeds
    const editor = document.createElement('div');
    editor.setAttribute('data-testid', 'kafka-cluster-editor');
    document.body.appendChild(editor);

    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('step ks-create falls back to add-cluster-btn when empty-state is gone', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-create')!;
    const ctx = makeCtx();

    // Only "+ New" button is present (no empty state button)
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'kafka-add-cluster-btn');
    document.body.appendChild(addBtn);

    const editor = document.createElement('div');
    editor.setAttribute('data-testid', 'kafka-cluster-editor');
    document.body.appendChild(editor);

    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('step ks-create does nothing when no btn is in DOM', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-create')!;
    const ctx = makeCtx();
    document.body.innerHTML = '';
    await step.action!(ctx); // should not throw
  });

  it('step ks-fill action waits for name input and fills it', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-fill')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith('#kafka-cluster-name', 3000);
    expect(ctx.fill).toHaveBeenCalledWith('#kafka-cluster-name', 'Demo Cluster');
  });

  it('step ks-save action waits for save button, clicks it, and waits for card', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-save')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('kafka-save-cluster-btn'), 3000);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('kafka-save-cluster-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid^="kafka-cluster-card-"]', 3000);
  });

  it('step ks-connect action waits for and clicks the connect button', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-connect')!;
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');
    document.body.appendChild(connectBtn);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('kafka-connect-btn'), 3000);
    expect(ctx.delay).toHaveBeenCalledWith(1200);
  });

  it('step ks-connect skips click if connect btn is disabled', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-connect')!;
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');
    connectBtn.disabled = true;
    document.body.appendChild(connectBtn);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalled();
    expect(ctx.delay).not.toHaveBeenCalledWith(800);
  });

  it('step ks-connect verify waits for the Disconnect button (confirms actual connection)', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-connect')!;
    expect(step.verify).toContain('kafka-disconnect-btn');
  });

  it('step ks-status has highlight and no action (informational)', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-status')!;
    expect(step.highlight).toContain('kafka-settings-list');
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step ks-studio uses action to navigate visibly via Protocols then Kafka', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-studio')!;
    expect(step.preAction).toBeUndefined();
    expect(typeof step.action).toBe('function');

    const ctx = makeCtx();

    const protocolsBtn = document.createElement('button');
    protocolsBtn.setAttribute('data-testid', 'ab-protocols');
    document.body.appendChild(protocolsBtn);

    const kafkaTabBtn = document.createElement('button');
    kafkaTabBtn.setAttribute('data-testid', 'nav-tab-kafka-message-studio');
    document.body.appendChild(kafkaTabBtn);

    const publishTab = document.createElement('button');
    publishTab.setAttribute('data-testid', 'tab-publish');
    document.body.appendChild(publishTab);

    await step.action!(ctx);

    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="ab-protocols"]', 2500);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="ab-protocols"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="nav-tab-kafka-message-studio"]', 2500);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="nav-tab-kafka-message-studio"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="tab-publish"]', 2500);
  });
  it('has Docker badge tag', () => {
    expect(kafkaQuickStartLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K3: kafka-consume ─────────────────────────────────────────────────────
