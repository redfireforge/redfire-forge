/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsTlsLesson } from './ws-tls';
import { makeCtx, makeVisible } from './ws-test-utils';

vi.mock('../../demoRipple', () => ({
  showSpotlightRing: vi.fn(() => vi.fn()),
  purgeAllSpotlightRings: vi.fn(),
}));

describe('ws-tls lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as { __demoPrepareWsTlsLesson?: unknown }).__demoPrepareWsTlsLesson;
    delete (window as unknown as { __demoApplyWsTlsConfig?: unknown }).__demoApplyWsTlsConfig;
  });

  it('has valid lesson structure', () => {
    expect(wsTlsLesson.id).toBe('ws-tls');
    expect(wsTlsLesson.domainId).toBe('protocols');
    expect(wsTlsLesson.name).toBe('Secure WebSocket — wss:// & TLS');
    expect(wsTlsLesson.steps.length).toBe(8);
    expect(wsTlsLesson.concept.title).toBeTruthy();
    expect(wsTlsLesson.initialTab).toBe('websocket-studio');
    expect(wsTlsLesson.skipStudioTabIsolation).toBe(true);
    expect(wsTlsLesson.estimatedMinutes).toBe(6);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsTlsLesson.setup).toBe('function');
    expect(typeof wsTlsLesson.cleanup).toBe('function');
  });

  it('all steps have required fields and pauseAfter', () => {
    for (const step of wsTlsLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has correct step IDs in viewer order', () => {
    expect(wsTlsLesson.steps.map((s) => s.id)).toEqual([
      'tls-intro',
      'tls-panel',
      'tls-connect',
      'tls-send',
      'tls-ca-cert',
      'tls-mtls',
      'tls-proxy-roundtrip',
      'tls-transport',
    ]);
  });

  it('has key terms and a diagram', () => {
    expect(wsTlsLesson.concept.keyTerms?.map((t) => t.term)).toEqual(
      expect.arrayContaining(['wss://', 'TLS', 'mTLS', 'rejectUnauthorized']),
    );
    expect(wsTlsLesson.concept.diagram).toBeTruthy();
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

    return { ca, clientCert, clientKey, skip, close };
  }

  // ── tls-intro ──────────────────────────────────────────────

  it('tls-intro fills wss:// once and spotlights TLS bar', async () => {
    const url = document.createElement('input');
    url.setAttribute('aria-label', 'WebSocket URL');
    document.body.appendChild(url);
    makeVisible(url);
    const panel = document.createElement('div');
    panel.setAttribute('data-testid', 'tls-panel');
    document.body.appendChild(panel);
    makeVisible(panel);

    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();

    await wsTlsLesson.steps.find((s) => s.id === 'tls-intro')!.action!(makeCtx());
    expect(url.value).toContain('wss://');
    expect(showSpotlightRing).toHaveBeenCalledWith(
      panel,
      expect.objectContaining({ steady: true }),
    );
  });

  // ── tls-panel ──────────────────────────────────────────────

  it('tls-panel opens Configure, spotlights notice, closes quietly', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();

    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'tls-close');
    const closeSpy = vi.fn();
    closeBtn.addEventListener('click', closeSpy);
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);

    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (String(sel).includes('tls-toggle') && !document.querySelector('[data-testid="tls-body"]')) {
        const body = document.createElement('div');
        body.setAttribute('data-testid', 'tls-body');
        document.body.appendChild(body);
        makeVisible(body);
        const notice = document.createElement('div');
        notice.setAttribute('data-testid', 'tls-proxy-notice');
        document.body.appendChild(notice);
        makeVisible(notice);
      }
    });
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (String(sel).includes('tls-body') && !document.querySelector('[data-testid="tls-body"]')) {
        const body = document.createElement('div');
        body.setAttribute('data-testid', 'tls-body');
        document.body.appendChild(body);
        makeVisible(body);
      }
    });

    await wsTlsLesson.steps.find((s) => s.id === 'tls-panel')!.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tls-toggle'));
    expect(closeSpy).toHaveBeenCalled();
    const noticeEl = vi.mocked(showSpotlightRing).mock.calls
      .map((c) => c[0] as HTMLElement)
      .find((el) => el?.getAttribute?.('data-testid') === 'tls-proxy-notice');
    expect(noticeEl).toBeTruthy();
  });

  // ── tls-connect ────────────────────────────────────────────

  it('tls-connect connects and spotlights Direct once', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();

    const transport = document.createElement('span');
    transport.setAttribute('data-testid', 'transport-badge');
    document.body.appendChild(transport);
    makeVisible(transport);

    // Pretend connect succeeds immediately
    const status = document.createElement('span');
    status.className = 'ws-status-dot connected';
    document.body.appendChild(status);
    makeVisible(status);

    const ctx = makeCtx();
    await wsTlsLesson.steps.find((s) => s.id === 'tls-connect')!.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(showSpotlightRing).toHaveBeenCalledWith(
      transport,
      expect.objectContaining({ steady: true }),
    );
  });

  // ── tls-send ───────────────────────────────────────────────

  it('tls-send fills message quietly and spotlights the echo row', async () => {
    const msg = document.createElement('textarea');
    msg.setAttribute('aria-label', 'Message input');
    document.body.appendChild(msg);
    makeVisible(msg);
    const row = document.createElement('div');
    row.setAttribute('data-testid', 'message-row');
    document.body.appendChild(row);
    makeVisible(row);

    const ctx = makeCtx();
    await wsTlsLesson.steps.find((s) => s.id === 'tls-send')!.action!(ctx);
    expect(msg.value).toContain('Hello over TLS');
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  // ── tls-ca-cert ────────────────────────────────────────────

  it('tls-ca-cert pastes CA once without a second ring on the same field', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();
    const { ca, clientCert } = mountTlsEditorDom();
    await wsTlsLesson.steps.find((s) => s.id === 'tls-ca-cert')!.action!(makeCtx());
    expect(ca.value).toContain('BEGIN CERTIFICATE');
    expect(clientCert.value).toBe('');
    // Reading spotlight already covers the CA field — action must not re-ring it.
    expect(showSpotlightRing).not.toHaveBeenCalled();
  });

  // ── tls-mtls ───────────────────────────────────────────────

  it('tls-mtls pastes client cert + key once then closes', async () => {
    const { clientCert, clientKey, close } = mountTlsEditorDom();
    const indicator = document.createElement('span');
    indicator.setAttribute('data-testid', 'tls-indicator');
    document.body.appendChild(indicator);
    makeVisible(indicator);
    const closeSpy = vi.fn();
    close.addEventListener('click', closeSpy);

    await wsTlsLesson.steps.find((s) => s.id === 'tls-mtls')!.action!(makeCtx());
    expect(clientCert.value).toContain('BEGIN CERTIFICATE');
    expect(clientKey.value).toContain('BEGIN PRIVATE KEY');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('tls-mtls preAction clears leftover client fields for a clean paste', async () => {
    const { ca, clientCert, clientKey } = mountTlsEditorDom();
    ca.value = '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----';
    clientCert.value = 'OLD';
    clientKey.value = 'OLD';
    await wsTlsLesson.steps.find((s) => s.id === 'tls-mtls')!.preAction!(makeCtx());
    expect(clientCert.value).toBe('');
    expect(clientKey.value).toBe('');
    expect(ca.value).toContain('BEGIN CERTIFICATE');
  });

  // ── tls-proxy-roundtrip ────────────────────────────────────

  it('tls-proxy-roundtrip does not reopen a modal tour — connects and spotlights Proxy', async () => {
    const apply = vi.fn();
    (window as unknown as { __demoApplyWsTlsConfig?: typeof apply }).__demoApplyWsTlsConfig = apply;

    const status = document.createElement('span');
    status.className = 'ws-status-dot connected';
    document.body.appendChild(status);
    makeVisible(status);

    const transport = document.createElement('span');
    transport.setAttribute('data-testid', 'transport-badge');
    document.body.appendChild(transport);
    makeVisible(transport);

    const msg = document.createElement('textarea');
    msg.setAttribute('aria-label', 'Message input');
    document.body.appendChild(msg);
    makeVisible(msg);

    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();

    const ctx = makeCtx();
    await wsTlsLesson.steps.find((s) => s.id === 'tls-proxy-roundtrip')!.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(msg.value).toContain('TLS config applied');
    // One transport payoff — not a stack of modal field holds
    expect(showSpotlightRing).toHaveBeenCalledWith(
      transport,
      expect.objectContaining({ steady: true }),
    );
  });

  it('tls-proxy-roundtrip preAction applies mTLS + skip-cert via bridge', async () => {
    const apply = vi.fn();
    (window as unknown as { __demoApplyWsTlsConfig?: typeof apply }).__demoApplyWsTlsConfig = apply;
    await wsTlsLesson.steps.find((s) => s.id === 'tls-proxy-roundtrip')!.preAction!(makeCtx());
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      rejectUnauthorized: false,
      caCert: expect.stringContaining('BEGIN CERTIFICATE'),
      clientCert: expect.stringContaining('BEGIN CERTIFICATE'),
      clientKey: expect.stringContaining('BEGIN PRIVATE KEY'),
    }));
  });

  // ── tls-transport ──────────────────────────────────────────

  it('tls-transport action does not double-spotlight the badge', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    vi.mocked(showSpotlightRing).mockClear();
    const badge = document.createElement('span');
    badge.setAttribute('data-testid', 'transport-badge');
    document.body.appendChild(badge);
    makeVisible(badge);

    await wsTlsLesson.steps.find((s) => s.id === 'tls-transport')!.action!(makeCtx());
    expect(showSpotlightRing).not.toHaveBeenCalled();
  });

  it('tls-transport preAction clears TLS quietly via bridge', async () => {
    const apply = vi.fn();
    (window as unknown as { __demoApplyWsTlsConfig?: typeof apply }).__demoApplyWsTlsConfig = apply;
    const status = document.createElement('span');
    status.className = 'ws-status-dot connected';
    document.body.appendChild(status);
    makeVisible(status);

    await wsTlsLesson.steps.find((s) => s.id === 'tls-transport')!.preAction!(makeCtx());
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      rejectUnauthorized: true,
      caCert: '',
      clientCert: '',
      clientKey: '',
    }));
  });

  // ── setup ──────────────────────────────────────────────────

  it('setup uses quiet bridge when available', async () => {
    const prepare = vi.fn(() => true);
    (window as unknown as { __demoPrepareWsTlsLesson?: () => boolean }).__demoPrepareWsTlsLesson = prepare;
    await wsTlsLesson.setup!(makeCtx());
    expect(prepare).toHaveBeenCalled();
  });
});
