/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaSecureLesson } from './kafka-secure';

describe('kafka-secure lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaSecureLesson.id).toBe('kafka-secure');
    expect(kafkaSecureLesson.domainId).toBe('protocols');
    expect(kafkaSecureLesson.category).toBe('kafka');
    expect(kafkaSecureLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaSecureLesson.initialTab).toBe('kafka-settings');
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
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('auth-mode'), 'scram-sha-256');
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

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaSecureLesson.setup) {
      await expect(kafkaSecureLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaSecureLesson.cleanup) {
      await expect(kafkaSecureLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaSecureLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaSecureLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaSecureLesson.steps) {
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

  it('step sec-broker preAction fills name when input exists (if(nameInput) true branch)', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-broker')!;
    expect(step).toBeDefined();
    const input = document.createElement('input');
    input.placeholder = 'cluster name';
    const focusSpy = vi.fn();
    input.addEventListener('focus', focusSpy);
    document.body.appendChild(input);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(focusSpy).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('step sec-save action clicks connectBtn when not disabled (if(connectBtn) true branch)', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-save')!;
    expect(step).toBeDefined();
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');
    const clickSpy = vi.fn();
    connectBtn.addEventListener('click', clickSpy);
    document.body.appendChild(connectBtn);
    // Disconnect button starts disabled; poll loop waits for it to become enabled
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'kafka-disconnect-btn');
    disconnectBtn.disabled = true;
    document.body.appendChild(disconnectBtn);
    setTimeout(() => { disconnectBtn.disabled = false; }, 100);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── K12: kafka-tls ─────────────────────────────────────────────

