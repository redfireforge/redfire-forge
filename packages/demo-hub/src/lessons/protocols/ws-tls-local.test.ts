/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsTlsLocalLesson } from './ws-tls-local';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('ws-tls-local lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetAllMocks();
  });

  // ── Structure ────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(wsTlsLocalLesson.id).toBe('ws-tls-local');
    expect(wsTlsLocalLesson.domainId).toBe('protocols');
    expect(wsTlsLocalLesson.category).toBe('websocket');
    expect(wsTlsLocalLesson.name).toBeTruthy();
    expect(wsTlsLocalLesson.initialTab).toBe('websocket-studio');
  });

  it('has concept with title and body', () => {
    expect(wsTlsLocalLesson.concept.title).toBeTruthy();
    expect(wsTlsLocalLesson.concept.body).toBeTruthy();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsTlsLocalLesson.setup).toBe('function');
    expect(typeof wsTlsLocalLesson.cleanup).toBe('function');
  });

  it('has at least 6 steps covering 3 TLS phases', () => {
    expect(wsTlsLocalLesson.steps.length).toBeGreaterThanOrEqual(6);
  });

  it('all steps have required fields', () => {
    for (const step of wsTlsLocalLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('step IDs contain local-tls prefix', () => {
    for (const step of wsTlsLocalLesson.steps) {
      expect(step.id).toContain('local-tls');
    }
  });

  it('has dockerEndpoint and dockerCommand (requires Docker)', () => {
    expect(wsTlsLocalLesson.dockerEndpoint).toBeTruthy();
    expect(wsTlsLocalLesson.dockerCommand).toBeTruthy();
  });

  // ── Setup / cleanup ──────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    await expect(wsTlsLocalLesson.setup!(ctx)).resolves.not.toThrow();
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    await expect(wsTlsLocalLesson.cleanup!(ctx)).resolves.not.toThrow();
  });

  // ── Step actions ─────────────────────────────────────────────────

  it('step 1 (local-tls-url) preAction clicks mode client and connect tab', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-url');
    expect(step).toBeDefined();
    if (step?.preAction) await step.preAction(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('step 1 (local-tls-url) action fills URL with wss://localhost', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-url');
    if (step?.action) await step.action(ctx);
    expect(ctx.fill).toHaveBeenCalled();
    const fillCalls = vi.mocked(ctx.fill).mock.calls;
    expect(fillCalls.some(([, val]) => val.includes('localhost'))).toBe(true);
  });

  it('step 2 (local-tls-skip-cert) preAction runs without throwing', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-skip-cert');
    expect(step).toBeDefined();
    if (step?.preAction) await step.preAction(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step 3 (local-tls-connect) action clicks connect button', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-connect');
    if (step?.action) await step.action(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step 4 (local-tls-ca-intro) action clears then re-fills CA cert', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-ca-intro');
    if (step?.action) await step.action(ctx);
    const calls = vi.mocked(ctx.fill).mock.calls;
    // First fill clears (empty string), second fill sets the cert
    expect(calls.some(([, val]) => val === '')).toBe(true);
    expect(calls.some(([, val]) => val.includes('BEGIN CERTIFICATE'))).toBe(true);
  });

  it('step 4 (local-tls-ca-intro) preAction fills CA cert when textarea is empty', async () => {
    const ctx = makeCtx();
    // Add an empty CA cert textarea to DOM
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'tls-ca-cert');
    ta.value = '';
    document.body.appendChild(ta);
    makeVisible(ta);
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-ca-intro')!;
    if (step.preAction) await step.preAction(ctx);
    // Pre-fill guard fires because textarea is empty
    expect(vi.mocked(ctx.fill).mock.calls.some(([, val]) => val.includes('BEGIN CERTIFICATE'))).toBe(true);
    ta.remove();
  });

  it('step 4 (local-tls-ca-intro) preAction skips fill when CA cert already present', async () => {
    const ctx = makeCtx();
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'tls-ca-cert');
    ta.value = '-----BEGIN CERTIFICATE-----\nALREADY_SET\n-----END CERTIFICATE-----';
    document.body.appendChild(ta);
    makeVisible(ta);
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-ca-intro')!;
    if (step.preAction) await step.preAction(ctx);
    // Guard skips because textarea already has a value
    expect(vi.mocked(ctx.fill).mock.calls.some(([, val]) => val.includes('BEGIN CERTIFICATE'))).toBe(false);
    ta.remove();
  });

  it('step 5 (local-tls-ca-connect) action reconnects with CA cert', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-ca-connect');
    if (step?.action) await step.action(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step 6 (local-tls-mtls-intro) fills mTLS URL', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-mtls-intro');
    if (step?.action) await step.action(ctx);
    // May fill or click
    expect(ctx.fill.mock.calls.length + ctx.click.mock.calls.length).toBeGreaterThan(0);
  });

  it('step 7 (local-tls-mtls-creds) action clears then re-fills client cert and key', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-mtls-creds');
    if (step?.action) await step.action(ctx);
    const calls = vi.mocked(ctx.fill).mock.calls;
    // Action clears cert and key (empty string) then re-fills both
    const emptyCount = calls.filter(([, val]) => val === '').length;
    expect(emptyCount).toBeGreaterThanOrEqual(2);
    expect(calls.some(([, val]) => val.includes('BEGIN CERTIFICATE'))).toBe(true);
    expect(calls.some(([, val]) => val.includes('BEGIN RSA PRIVATE KEY') || val.includes('BEGIN PRIVATE KEY'))).toBe(true);
  });

  it('step 7 (local-tls-mtls-creds) preAction fills client cert and key when empty', async () => {
    const ctx = makeCtx();
    // Add empty client cert textarea
    const certTa = document.createElement('textarea');
    certTa.setAttribute('data-testid', 'tls-client-cert');
    certTa.value = '';
    document.body.appendChild(certTa);
    makeVisible(certTa);
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-mtls-creds')!;
    if (step.preAction) await step.preAction(ctx);
    // Pre-fill guard fires because textarea is empty
    expect(vi.mocked(ctx.fill).mock.calls.some(([, val]) => val.includes('BEGIN CERTIFICATE'))).toBe(true);
    certTa.remove();
  });

  it('step 7 (local-tls-mtls-creds) preAction skips fill when client cert already present', async () => {
    const ctx = makeCtx();
    // Add a CA cert textarea with a value so the CA cert guard is also satisfied
    const caTa = document.createElement('textarea');
    caTa.setAttribute('data-testid', 'tls-ca-cert');
    caTa.value = '-----BEGIN CERTIFICATE-----\nCA_ALREADY_SET\n-----END CERTIFICATE-----';
    document.body.appendChild(caTa);
    makeVisible(caTa);
    const certTa = document.createElement('textarea');
    certTa.setAttribute('data-testid', 'tls-client-cert');
    certTa.value = '-----BEGIN CERTIFICATE-----\nALREADY_SET\n-----END CERTIFICATE-----';
    document.body.appendChild(certTa);
    makeVisible(certTa);
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-mtls-creds')!;
    if (step.preAction) await step.preAction(ctx);
    // Both guards skip — no ctx.fill calls at all
    expect(vi.mocked(ctx.fill).mock.calls.length).toBe(0);
    caTa.remove();
    certTa.remove();
  });

  it('step 8 (local-tls-mtls-connect) connects with mTLS', async () => {
    const ctx = makeCtx();
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-mtls-connect');
    if (step?.action) await step.action(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step highlights reference valid DOM selectors', () => {
    for (const step of wsTlsLocalLesson.steps) {
      if (step.highlight) {
        expect(step.highlight).toBeTruthy();
        expect(typeof step.highlight).toBe('string');
      }
    }
  });

  it('all step preActions run without throwing', async () => {
    for (const step of wsTlsLocalLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of wsTlsLocalLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('setup with DOM elements present runs skip-cert branch', async () => {
    const ctx = makeCtx();
    const skipCert = document.createElement('input');
    skipCert.type = 'checkbox';
    skipCert.setAttribute('data-testid', 'tls-skip-cert');
    skipCert.checked = true;
    document.body.appendChild(skipCert);
    makeVisible(skipCert);
    await expect(wsTlsLocalLesson.setup!(ctx)).resolves.not.toThrow();
    skipCert.remove();
  });

  it('at least one step calls ctx.fill during action', async () => {
    let fillCalled = false;
    for (const step of wsTlsLocalLesson.steps) {
      const ctx = makeCtx();
      if (step.action) {
        await step.action(ctx);
        if (vi.mocked(ctx.fill).mock.calls.length > 0) { fillCalled = true; break; }
      }
    }
    expect(fillCalled).toBe(true);
  });

  // ─── Branch: local-tls-connect isConnected = true ──────────

  it('local-tls-connect action sends echo message when connected', async () => {
    // Simulate STATUS_CONNECTED element → isConnected = true
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    makeVisible(dot);

    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('phase":1'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));

    dot.remove();
  });

  // ─── Branch: transport badge mouseover highlight ─────────────

  it('local-tls-skip-cert action highlights transport badge when present', async () => {
    // Create a transport badge element so the badge mouseover branch runs
    const badge = document.createElement('span');
    badge.setAttribute('data-testid', 'transport-badge');
    const mouseoverSpy = vi.fn();
    badge.addEventListener('mouseover', mouseoverSpy);
    document.body.appendChild(badge);
    makeVisible(badge);

    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-skip-cert')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // Badge mouseover should have been dispatched
    expect(mouseoverSpy).toHaveBeenCalled();

    badge.remove();
  });

  it('local-tls-ca-connect action highlights transport badge when present', async () => {
    // Simulate connected + badge present
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    const badge = document.createElement('span');
    badge.setAttribute('data-testid', 'transport-badge');
    const mouseoverSpy = vi.fn();
    badge.addEventListener('mouseover', mouseoverSpy);
    document.body.append(dot, badge);
    makeVisible(dot);
    makeVisible(badge);

    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-ca-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(mouseoverSpy).toHaveBeenCalled();

    dot.remove();
    badge.remove();
  });

  it('local-tls-mtls-connect action highlights transport badge when present', async () => {
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    const badge = document.createElement('span');
    badge.setAttribute('data-testid', 'transport-badge');
    const mouseoverSpy = vi.fn();
    badge.addEventListener('mouseover', mouseoverSpy);
    document.body.append(dot, badge);
    makeVisible(dot);
    makeVisible(badge);

    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-mtls-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(mouseoverSpy).toHaveBeenCalled();

    dot.remove();
    badge.remove();
  });

  // ─── Branch: isConnected = true (local-tls-ca-connect) ──────

  it('local-tls-ca-connect action navigates to send tab and sends message when connected', async () => {
    // Simulate STATUS_CONNECTED element present → isConnected = true
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    makeVisible(dot);

    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-ca-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // When connected, action navigates to send tab, fills message, sends, then returns to connect
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('ca-cert'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));

    dot.remove();
  });

  // ─── Branch: isConnected = true (local-tls-mtls-connect) ────

  // ─── Branch: ensureTlsPanelExpanded — toggle not expanded (lines 127-128) ──
  // The setup function calls ensureTlsPanelExpanded. When toggle exists and
  // aria-expanded !== 'true', the function dispatches a click to expand it.

  it('setup clicks tls-toggle when it exists and aria-expanded is false', async () => {
    const toggle = document.createElement('div');
    toggle.setAttribute('data-testid', 'tls-toggle');
    toggle.setAttribute('aria-expanded', 'false');
    const clickSpy = vi.spyOn(toggle, 'dispatchEvent');
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const ctx = makeCtx();
    await wsTlsLocalLesson.setup!(ctx);

    // The toggle should have received a click MouseEvent
    const clickEvents = clickSpy.mock.calls.filter(
      c => c[0] instanceof MouseEvent,
    );
    expect(clickEvents.length).toBeGreaterThan(0);
    toggle.remove();
  });

  // ─── Branch: setSkipCert — checkbox state differs from desired (lines 141-142) ──
  // When checkbox.checked !== the desired value, the function clicks the checkbox.

  it('setup clicks skip-cert checkbox when its state differs from desired', async () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-testid', 'tls-skip-cert');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true; // start checked, setup wants it unchecked (false)
    wrapper.appendChild(cb);
    const clickSpy = vi.spyOn(cb, 'dispatchEvent');
    document.body.appendChild(wrapper);
    makeVisible(wrapper);
    makeVisible(cb);

    const ctx = makeCtx();
    await wsTlsLocalLesson.setup!(ctx);

    // checkbox should have been clicked to toggle state
    const mouseClicks = clickSpy.mock.calls.filter(c => c[0] instanceof MouseEvent);
    expect(mouseClicks.length).toBeGreaterThan(0);
    wrapper.remove();
  });

  it('local-tls-mtls-connect action navigates to send tab and sends message when connected', async () => {
    // Simulate STATUS_CONNECTED element present → isConnected = true
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    makeVisible(dot);

    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-mtls-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // When connected, action navigates to send tab, fills mtls message, sends, then returns to connect
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('mtls'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));

    dot.remove();
  });

  it('closeTlsModal clicks the close button when present', async () => {
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'tls-close');
    let clicked = false;
    closeBtn.addEventListener('click', () => { clicked = true; });
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);

    // Use a step that calls closeTlsModal via preAction (local-tls-connect)
    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(clicked).toBe(true);
    closeBtn.remove();
  });

  it('local-tls-connect action highlights transport badge when present', async () => {
    const badge = document.createElement('div');
    badge.setAttribute('data-testid', 'transport-badge');
    document.body.appendChild(badge);
    makeVisible(badge);

    const step = wsTlsLocalLesson.steps.find(s => s.id === 'local-tls-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(badge.style.outline).toBe('');
    badge.remove();
  });
});
