/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaTlsLesson } from './kafka-tls';

describe('kafka-tls lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaTlsLesson.id).toBe('kafka-tls');
    expect(kafkaTlsLesson.domainId).toBe('protocols');
    expect(kafkaTlsLesson.category).toBe('kafka');
    expect(kafkaTlsLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTlsLesson.initialTab).toBe('kafka-settings');
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

  it('step tls-intro action waits for the settings page (navigation already done by setup)', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-intro')!;
    const ctx = makeCtx();
    // preAction only clears stale card selection — no navigation/click choreography,
    // avoiding a visible re-navigate flash before step 1 narrates.
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('kafka-settings-page'), expect.any(Number));
  });

  it('step tls-intro preAction removes selected class from cluster cards', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-intro')!;
    const selectedCard = document.createElement('div');
    selectedCard.className = 'kafka-cluster-card selected';
    document.body.appendChild(selectedCard);

    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(selectedCard.classList.contains('selected')).toBe(false);
  });

  it('step tls-auth action selects SCRAM-SHA-256 and fills credentials', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-auth')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('auth-mode'), 'scram-sha-256');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('username'), 'redfireforge-app');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('password'), 'app-password');
  });

  it('step tls-broker preAction clears/fills cluster name when name input exists', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-broker')!;
    const nameInput = document.createElement('input');
    nameInput.id = 'kafka-cluster-name';
    nameInput.value = 'old';
    document.body.appendChild(nameInput);

    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(nameInput.value).toBe('');
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('#kafka-cluster-name'),
      'Local TLS',
    );
    expect(ctx.delay).toHaveBeenCalledWith(100);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:19092'), '127.0.0.1:19095');
  });

  it('step tls-enable action clicks TLS toggle when NOT already checked (aria-checked=false)', async () => {
    // tls-enable logic: if (!checked) → click toggle to enable TLS
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-enable')!;
    const toggle = document.createElement('div');
    toggle.setAttribute('data-testid', 'kafka-tls-toggle');
    toggle.setAttribute('aria-checked', 'false');
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    document.body.appendChild(toggle);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(300);
  });

  it('step tls-enable action skips click when TLS toggle already checked', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-enable')!;
    const toggle = document.createElement('div');
    toggle.setAttribute('data-testid', 'kafka-tls-toggle');
    toggle.setAttribute('aria-checked', 'true');
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    document.body.appendChild(toggle);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('step tls-ca action clicks verifyToggle when checked (aria-checked=true)', async () => {
    // tls-ca logic: if (checked) → click to uncheck/disable cert verification for self-signed cert
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-ca')!;
    const toggle = document.createElement('div');
    toggle.setAttribute('data-testid', 'kafka-tls-verify-toggle');
    toggle.setAttribute('aria-checked', 'true');
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    document.body.appendChild(toggle);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(300);
  });

  it('step tls-ca action skips click when verifyToggle already unchecked', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-ca')!;
    const toggle = document.createElement('div');
    toggle.setAttribute('data-testid', 'kafka-tls-verify-toggle');
    toggle.setAttribute('aria-checked', 'false');
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    document.body.appendChild(toggle);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('step tls-save action clicks connectBtn when it exists', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-save')!;
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');
    const clickSpy = vi.fn();
    connectBtn.addEventListener('click', clickSpy);
    document.body.appendChild(connectBtn);
    // Disconnect button starts disabled; the poll loop waits for it to become enabled
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'kafka-disconnect-btn');
    disconnectBtn.disabled = true;
    document.body.appendChild(disconnectBtn);
    // Simulate connection completing after a short delay
    setTimeout(() => { disconnectBtn.disabled = false; }, 100);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('kafka-save-cluster-btn'));
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(500);
    expect(ctx.delay).toHaveBeenCalledWith(400);
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

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTlsLesson.setup) {
      await expect(kafkaTlsLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTlsLesson.cleanup) {
      await expect(kafkaTlsLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaTlsLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaTlsLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaTlsLesson.steps) {
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

  it('has Docker badge tag', () => {
    expect(kafkaTlsLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K13: kafka-test-runner ─────────────────────────────────────

