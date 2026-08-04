/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsTlsLocalLesson } from './ws-tls-local';
import { makeCtx, makeVisible } from './ws-test-utils';

vi.mock('../../demoRipple', () => ({
  showSpotlightRing: vi.fn(() => vi.fn()),
  purgeAllSpotlightRings: vi.fn(),
}));

describe('ws-tls-local lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as { __demoPrepareWsTlsLesson?: unknown }).__demoPrepareWsTlsLesson;
    delete (window as unknown as { __demoApplyWsTlsConfig?: unknown }).__demoApplyWsTlsConfig;
  });

  // ── Structure ────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(wsTlsLocalLesson.id).toBe('ws-tls-local');
    expect(wsTlsLocalLesson.domainId).toBe('protocols');
    expect(wsTlsLocalLesson.category).toBe('websocket');
    expect(wsTlsLocalLesson.name).toBe('Local TLS Echo Server (Docker)');
    expect(wsTlsLocalLesson.initialTab).toBe('websocket-studio');
    expect(wsTlsLocalLesson.skipStudioTabIsolation).toBe(true);
    expect(wsTlsLocalLesson.estimatedMinutes).toBe(8);
    expect(wsTlsLocalLesson.steps.length).toBe(8);
  });

  it('has concept, setup, cleanup, and Docker gate', () => {
    expect(wsTlsLocalLesson.concept.title).toBeTruthy();
    expect(wsTlsLocalLesson.concept.body).toBeTruthy();
    expect(typeof wsTlsLocalLesson.setup).toBe('function');
    expect(typeof wsTlsLocalLesson.cleanup).toBe('function');
    expect(wsTlsLocalLesson.dockerEndpoint).toBeTruthy();
    expect(wsTlsLocalLesson.dockerCommand).toBeTruthy();
  });

  it('has correct step IDs in three-phase order', () => {
    expect(wsTlsLocalLesson.steps.map((s) => s.id)).toEqual([
      'local-tls-url',
      'local-tls-skip-cert',
      'local-tls-connect',
      'local-tls-ca-intro',
      'local-tls-ca-connect',
      'local-tls-mtls-intro',
      'local-tls-mtls-creds',
      'local-tls-mtls-connect',
    ]);
  });

  it('all steps have required fields and pauseAfter', () => {
    for (const step of wsTlsLocalLesson.steps) {
      expect(step.id).toContain('local-tls');
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.pauseAfter).toBe(true);
    }
  });

  function mountTlsEditorDom() {
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const body = document.createElement('div');
    body.setAttribute('data-testid', 'tls-body');
    document.body.appendChild(body);
    makeVisible(body);

    const skipWrap = document.createElement('label');
    skipWrap.setAttribute('data-testid', 'tls-skip-cert');
    const skip = document.createElement('input');
    skip.type = 'checkbox';
    skipWrap.appendChild(skip);
    document.body.appendChild(skipWrap);
    makeVisible(skipWrap);
    makeVisible(skip);

    const ca = document.createElement('textarea');
    ca.setAttribute('data-testid', 'tls-ca-cert');
    document.body.appendChild(ca);
    makeVisible(ca);

    const clientCert = document.createElement('textarea');
    clientCert.setAttribute('data-testid', 'tls-client-cert');
    document.body.appendChild(clientCert);
    makeVisible(clientCert);

    const clientKey = document.createElement('textarea');
    clientKey.setAttribute('data-testid', 'tls-client-key');
    document.body.appendChild(clientKey);
    makeVisible(clientKey);

    const save = document.createElement('button');
    save.setAttribute('data-testid', 'tls-save');
    document.body.appendChild(save);
    makeVisible(save);

    const close = document.createElement('button');
    close.setAttribute('data-testid', 'tls-close');
    document.body.appendChild(close);
    makeVisible(close);

    return { ca, clientCert, clientKey, skip, close, toggle };
  }

  // ── local-tls-url ──────────────────────────────────────────────

  it('local-tls-url fills wss:// once and spotlights TLS bar', async () => {
    const url = document.createElement('input');
    url.setAttribute('aria-label', 'WebSocket URL');
    document.body.appendChild(url);
    makeVisible(url);
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();

    const ctx = makeCtx();
    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-url')!.action!(ctx);
    expect(url.value).toBe('wss://localhost:8766');
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(showSpotlightRing).toHaveBeenCalledWith(
      toggle,
      expect.objectContaining({ steady: true }),
    );
  });

  it('local-tls-url preAction clears leftover URL quietly', async () => {
    const url = document.createElement('input');
    url.setAttribute('aria-label', 'WebSocket URL');
    url.value = 'wss://localhost:8766';
    document.body.appendChild(url);
    makeVisible(url);
    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-url')!.preAction!(makeCtx());
    expect(url.value).toBe('');
  });

  // ── local-tls-skip-cert ────────────────────────────────────────

  it('local-tls-skip-cert enables skip-cert then spotlights Proxy (no outline hack)', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();
    const { skip } = mountTlsEditorDom();
    const badge = document.createElement('span');
    badge.setAttribute('data-testid', 'transport-badge');
    document.body.appendChild(badge);
    makeVisible(badge);

    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-skip-cert')!.action!(makeCtx());
    expect(skip.checked).toBe(true);
    expect(showSpotlightRing).toHaveBeenCalledWith(
      badge,
      expect.objectContaining({ steady: true }),
    );
    expect(badge.style.outline).toBe('');
  });

  it('local-tls-skip-cert preAction expands TLS panel when closed', async () => {
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    const body = document.createElement('div');
    body.setAttribute('data-testid', 'tls-body');
    const clickSpy = vi.spyOn(toggle, 'dispatchEvent');
    toggle.addEventListener('click', () => {
      if (!document.querySelector('[data-testid="tls-body"]')) {
        document.body.appendChild(body);
        makeVisible(body);
        const skipWrap = document.createElement('label');
        skipWrap.setAttribute('data-testid', 'tls-skip-cert');
        const skip = document.createElement('input');
        skip.type = 'checkbox';
        skipWrap.appendChild(skip);
        document.body.appendChild(skipWrap);
        makeVisible(skipWrap);
        makeVisible(skip);
        const ca = document.createElement('textarea');
        ca.setAttribute('data-testid', 'tls-ca-cert');
        document.body.appendChild(ca);
        makeVisible(ca);
      }
    });
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const url = document.createElement('input');
    url.setAttribute('aria-label', 'WebSocket URL');
    document.body.appendChild(url);
    makeVisible(url);

    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-skip-cert')!.preAction!(makeCtx());
    expect(clickSpy.mock.calls.some((c) => c[0] instanceof MouseEvent)).toBe(true);
  });

  // ── connect / send phases ──────────────────────────────────────

  it('local-tls-connect sends phase-1 echo when connected and spotlights Proxy', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();
    const status = document.createElement('span');
    status.className = 'ws-status-dot connected';
    document.body.appendChild(status);
    makeVisible(status);
    const badge = document.createElement('span');
    badge.setAttribute('data-testid', 'transport-badge');
    document.body.appendChild(badge);
    makeVisible(badge);
    const msg = document.createElement('textarea');
    msg.setAttribute('aria-label', 'Message input');
    document.body.appendChild(msg);
    makeVisible(msg);

    const ctx = makeCtx();
    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-connect')!.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(msg.value).toContain('phase":1');
    expect(showSpotlightRing).toHaveBeenCalledWith(
      badge,
      expect.objectContaining({ steady: true }),
    );
  });

  it('local-tls-ca-connect and mtls-connect send phase messages when connected', async () => {
    for (const [id, needle] of [
      ['local-tls-ca-connect', 'ca-cert'],
      ['local-tls-mtls-connect', 'mtls'],
    ] as const) {
      document.body.innerHTML = '';
      const status = document.createElement('span');
      status.className = 'ws-status-dot connected';
      document.body.appendChild(status);
      makeVisible(status);
      const msg = document.createElement('textarea');
      msg.setAttribute('aria-label', 'Message input');
      document.body.appendChild(msg);
      makeVisible(msg);

      const ctx = makeCtx();
      await wsTlsLocalLesson.steps.find((s) => s.id === id)!.action!(ctx);
      expect(msg.value).toContain(needle);
      expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    }
  });

  // ── CA paste ───────────────────────────────────────────────────

  it('local-tls-ca-intro pastes CA without a second ring on the same field', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();
    const { ca, clientCert } = mountTlsEditorDom();
    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-ca-intro')!.action!(makeCtx());
    expect(ca.value).toContain('BEGIN CERTIFICATE');
    expect(clientCert.value).toBe('');
    expect(showSpotlightRing).not.toHaveBeenCalled();
  });

  it('local-tls-ca-intro preAction clears leftover CA for a clean paste', async () => {
    const { ca } = mountTlsEditorDom();
    ca.value = '-----BEGIN CERTIFICATE-----\nOLD\n-----END CERTIFICATE-----';
    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-ca-intro')!.preAction!(makeCtx());
    expect(ca.value).toBe('');
  });

  // ── mTLS intro / creds ─────────────────────────────────────────

  it('local-tls-mtls-intro only changes the URL — no modal churn in action', async () => {
    const url = document.createElement('input');
    url.setAttribute('aria-label', 'WebSocket URL');
    document.body.appendChild(url);
    makeVisible(url);
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const apply = vi.fn();
    (window as unknown as { __demoApplyWsTlsConfig?: typeof apply }).__demoApplyWsTlsConfig = apply;

    const ctx = makeCtx();
    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-mtls-intro')!.action!(ctx);
    expect(url.value).toBe('wss://localhost:8768');
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      caCert: expect.stringContaining('BEGIN CERTIFICATE'),
      clientCert: '',
      clientKey: '',
    }));
    expect(document.querySelector('[data-testid="tls-body"]')).toBeNull();
  });

  it('local-tls-mtls-creds pastes cert once (no ring) then key (with ring)', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();
    const { clientCert, clientKey, close } = mountTlsEditorDom();
    const indicator = document.createElement('span');
    indicator.setAttribute('data-testid', 'tls-indicator');
    document.body.appendChild(indicator);
    makeVisible(indicator);
    const closeSpy = vi.fn();
    close.addEventListener('click', closeSpy);

    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-mtls-creds')!.action!(makeCtx());
    expect(clientCert.value).toContain('BEGIN CERTIFICATE');
    expect(clientKey.value).toContain('BEGIN PRIVATE KEY');
    expect(closeSpy).toHaveBeenCalled();
    // Only the key field (+ indicator payoff) should receive action rings — not the cert.
    const ringTargets = vi.mocked(showSpotlightRing).mock.calls.map((c) => c[0] as HTMLElement);
    expect(ringTargets).toContain(clientKey);
    expect(ringTargets).not.toContain(clientCert);
  });

  it('local-tls-mtls-creds preAction clears leftover client fields', async () => {
    const { ca, clientCert, clientKey } = mountTlsEditorDom();
    ca.value = '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----';
    clientCert.value = 'OLD';
    clientKey.value = 'OLD';
    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-mtls-creds')!.preAction!(makeCtx());
    expect(clientCert.value).toBe('');
    expect(clientKey.value).toBe('');
    expect(ca.value).toContain('BEGIN CERTIFICATE');
  });

  // ── setup / cleanup ────────────────────────────────────────────

  it('setup uses quiet bridge when available', async () => {
    const prepare = vi.fn(() => true);
    (window as unknown as { __demoPrepareWsTlsLesson?: () => boolean }).__demoPrepareWsTlsLesson = prepare;
    await wsTlsLocalLesson.setup!(makeCtx());
    expect(prepare).toHaveBeenCalled();
  });

  it('cleanup uses quiet bridge when available', async () => {
    const prepare = vi.fn(() => true);
    (window as unknown as { __demoPrepareWsTlsLesson?: () => boolean }).__demoPrepareWsTlsLesson = prepare;
    await wsTlsLocalLesson.cleanup!(makeCtx());
    expect(prepare).toHaveBeenCalled();
  });

  it('setup / cleanup fall back quietly without bridge', async () => {
    await expect(wsTlsLocalLesson.setup!(makeCtx())).resolves.not.toThrow();
    await expect(wsTlsLocalLesson.cleanup!(makeCtx())).resolves.not.toThrow();
  });

  it('closeTlsModal is invoked from connect preAction when close button exists', async () => {
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'tls-close');
    let clicked = false;
    closeBtn.addEventListener('click', () => { clicked = true; });
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);

    await wsTlsLocalLesson.steps.find((s) => s.id === 'local-tls-connect')!.preAction!(makeCtx());
    expect(clicked).toBe(true);
  });

  it('all step preActions and actions run without throwing', async () => {
    for (const step of wsTlsLocalLesson.steps) {
      if (step.preAction) await expect(step.preAction(makeCtx())).resolves.not.toThrow();
      if (step.action) await expect(step.action(makeCtx())).resolves.not.toThrow();
    }
  });
});
