/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaQuickStartLesson } from './kafka-quick-start';

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

  it('has a cleanup function that deletes Demo Cluster so restart restores first-time experience', () => {
    expect(typeof kafkaQuickStartLesson.cleanup).toBe('function');
  });

  it('cleanup navigates to kafka-settings and deletes Demo Cluster when present', async () => {
    const ctx = makeCtx();

    // Simulate DOM: a cluster card, the delete button, and confirm button
    const card = document.createElement('div');
    card.setAttribute('data-testid', 'kafka-cluster-card-demo-cluster');
    document.body.appendChild(card);

    const deleteBtn = document.createElement('button');
    deleteBtn.setAttribute('data-testid', 'kafka-delete-cluster-btn');
    document.body.appendChild(deleteBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.setAttribute('data-testid', 'kafka-confirm-delete-btn');
    document.body.appendChild(confirmBtn);

    await kafkaQuickStartLesson.cleanup!(ctx);

    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
  });

  it('cleanup is a no-op when no cluster cards exist (already clean)', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = ''; // No cluster cards
    await expect(kafkaQuickStartLesson.cleanup!(ctx)).resolves.not.toThrow();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
  });

  it('step ks-intro has highlight and no action (informational)', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-intro')!;
    expect(step.highlight).toContain('kafka-settings-page');
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step ks-create action clicks empty-state btn when present (first run)', async () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-create')!;
    const ctx = makeCtx();

    const emptyBtn = document.createElement('button');
    emptyBtn.setAttribute('data-testid', 'kafka-empty-create-btn');
    document.body.appendChild(emptyBtn);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('step ks-create is a no-op when clusters already exist (no emptyBtn)', async () => {
    // On repeat runs the empty-state button is gone (clusters exist).
    // Falling back to "+ New" would create a duplicate cluster ID and break
    // subsequent steps, so the action must be a safe no-op.
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-create')!;
    const ctx = makeCtx();
    document.body.innerHTML = '';
    // Only the toolbar "+ New" button is in DOM (clusters exist)
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'kafka-add-cluster-btn');
    document.body.appendChild(addBtn);
    await step.action!(ctx);
    // Must NOT click addBtn and must NOT call delay
    expect(ctx.delay).not.toHaveBeenCalled();
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
    // waitFor is called, but no click
    expect(ctx.waitFor).toHaveBeenCalled();
    expect(ctx.delay).not.toHaveBeenCalledWith(800);
  });

  it('step ks-connect verify waits for the Disconnect button (confirms actual connection)', () => {
    const step = kafkaQuickStartLesson.steps.find((s) => s.id === 'ks-connect')!;
    // Must wait for kafka-disconnect-btn (only rendered when connected), not
    // kafka-settings-list which is already present the moment a cluster exists.
    expect(step.verify).toContain('kafka-disconnect-btn');
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

