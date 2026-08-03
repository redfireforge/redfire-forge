/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaSecureLesson } from './kafka-secure';
import { KAFKA } from '@shared/selectors';

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

  it('saves before testing (Test Connection needs a saved selected cluster)', () => {
    const ids = kafkaSecureLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'sec-intro',
      'sec-broker',
      'sec-auth',
      'sec-creds',
      'sec-save',
      'sec-test',
      'sec-connect',
      'sec-publish',
      'sec-result',
    ]);
    expect(ids.indexOf('sec-save')).toBeLessThan(ids.indexOf('sec-test'));
  });

  it('has dockerEndpoint and dockerCommand', () => {
    expect(kafkaSecureLesson.dockerEndpoint).toBeTruthy();
    expect(kafkaSecureLesson.dockerCommand).toContain('secure');
  });

  it('step sec-intro action waits for the New Cluster button and clicks it', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-intro')!;
    const ctx = makeCtx();
    // preAction only clears stale card selection — no navigation/click choreography.
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(KAFKA.NEW_CLUSTER_BTN, expect.any(Number));
    expect(ctx.click).toHaveBeenCalledWith(KAFKA.NEW_CLUSTER_BTN);
  });

  it('step sec-auth action selects SCRAM-SHA-256', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-auth')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('auth-mode'), 'scram-sha-256');
  });

  it('step sec-creds highlights user field and fills username/password in preAction', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-creds')!;
    expect(step.highlight).toBe(KAFKA.AUTH_USER_INPUT);
    document.body.innerHTML = '<input id="kafka-auth-username" /><input id="kafka-auth-password" />';
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(KAFKA.AUTH_USER_INPUT, 'redfireforge-app');
    expect(ctx.fill).toHaveBeenCalledWith(KAFKA.AUTH_PASS_INPUT, 'app-password');
  });

  it('step sec-save clicks Save Cluster', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-save')!;
    expect(step.highlight).toBe(KAFKA.SAVE_BTN);
    document.body.innerHTML = '<button data-testid="kafka-save-cluster-btn"></button><button data-testid="kafka-test-btn"></button>';
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(KAFKA.SAVE_BTN);
  });

  it('step sec-test action clicks test button and spotlights the Verified badge', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-test')!;
    expect(step.highlight).toBe(KAFKA.TEST_BTN);
    expect(step.verify).toBe(KAFKA.TEST_RESULT);

    document.body.innerHTML = `
      <button data-testid="kafka-test-btn"></button>
      <span data-testid="kafka-test-result" class="kafka-test-result--ok">✓ Verified</span>
    `;

    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(KAFKA.TEST_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(KAFKA.TEST_RESULT, expect.any(Number));
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('step sec-test skips click when Test Connection is disabled', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-test')!;
    document.body.innerHTML = '<button data-testid="kafka-test-btn" disabled></button>';
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step sec-connect clicks Connect when enabled', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-connect')!;
    expect(step.highlight).toBe(KAFKA.CONNECT_BTN);
    document.body.innerHTML = `
      <button data-testid="kafka-connect-btn"></button>
      <button data-testid="kafka-disconnect-btn" disabled></button>
    `;
    const ctx = makeCtx();
    // After click, enable disconnect so the wait loop exits.
    ctx.click = vi.fn(async () => {
      const dc = document.querySelector<HTMLButtonElement>('[data-testid="kafka-disconnect-btn"]');
      if (dc) dc.disabled = false;
    });
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(KAFKA.CONNECT_BTN);
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

  it('step sec-save clicks Save and proceeds when Test Connection is already enabled', async () => {
    const step = kafkaSecureLesson.steps.find((s) => s.id === 'sec-save')!;
    document.body.innerHTML = `
      <button data-testid="kafka-save-cluster-btn"></button>
      <button data-testid="kafka-test-btn"></button>
    `;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(KAFKA.SAVE_BTN);
  });

  it('has Docker badge tag', () => {
    expect(kafkaSecureLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K12: kafka-tls ─────────────────────────────────────────────

