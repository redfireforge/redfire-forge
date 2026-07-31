/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsTlsLesson } from './ws-tls';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('ws-tls lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsTlsLesson.id).toBe('ws-tls');
    expect(wsTlsLesson.domainId).toBe('protocols');
    expect(wsTlsLesson.name).toBe('Secure WebSocket — wss:// & TLS');
    expect(wsTlsLesson.steps.length).toBe(7);
    expect(wsTlsLesson.concept.title).toBeTruthy();
    expect(wsTlsLesson.concept.body).toBeTruthy();
    expect(wsTlsLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsTlsLesson.setup).toBe('function');
    expect(typeof wsTlsLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsTlsLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsTlsLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = wsTlsLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBe(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('wss://');
    expect(termNames).toContain('TLS');
    expect(termNames).toContain('mTLS');
    expect(termNames).toContain('rejectUnauthorized');
  });

  it('has a diagram', () => {
    expect(wsTlsLesson.concept.diagram).toBeTruthy();
  });

  it('has category set to websocket', () => {
    expect(wsTlsLesson.category).toBe('websocket');
  });

  it('has correct step IDs in order', () => {
    const ids = wsTlsLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'tls-intro', 'tls-panel', 'tls-connect', 'tls-send',
      'tls-skip-cert', 'tls-certs', 'tls-transport',
    ]);
  });

  it('estimated time is 4 minutes', () => {
    expect(wsTlsLesson.estimatedMinutes).toBe(4);
  });

  // ─── Step: tls-intro ──────────────────────────────────────

  it('step tls-intro highlights TLS toggle', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-intro')!;
    expect(step.highlight).toContain('tls-toggle');
  });

  it('step tls-intro preAction switches to Connect tab and pre-fills wss URL when empty', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('wss://'),
    );
  });

  it('step tls-intro preAction skips URL fill when wss:// already set', async () => {
    const urlInput = document.createElement('input');
    urlInput.setAttribute('aria-label', 'WebSocket URL');
    urlInput.value = 'wss://echo.websocket.org';
    document.body.appendChild(urlInput);
    makeVisible(urlInput);
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step tls-intro preAction closes TLS modal when close button is present', async () => {
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'tls-close');
    const clickSpy = vi.fn();
    closeBtn.addEventListener('click', clickSpy);
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-intro')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tls-intro action clears then fills wss:// URL', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('WebSocket URL'), '');
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('wss://'),
    );
  });

  // ─── Step: tls-panel ──────────────────────────────────────

  it('step tls-panel highlights TLS toggle', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-panel')!;
    expect(step.highlight).toContain('tls-toggle');
  });

  it('step tls-panel preAction switches to client mode, Connect tab, and fills wss:// URL', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-panel')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('wss://'),
    );
  });

  it('step tls-panel preAction skips fill when wss:// URL already set', async () => {
    const urlInput = document.createElement('input');
    urlInput.setAttribute('aria-label', 'WebSocket URL');
    urlInput.value = 'wss://echo.websocket.org';
    document.body.appendChild(urlInput);
    makeVisible(urlInput);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-panel')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step tls-panel action expands TLS panel', async () => {
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.onclick = vi.fn();
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-panel')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(toggle.onclick).toHaveBeenCalled();
  });

  it('step tls-panel does not click toggle if already expanded', async () => {
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.onclick = vi.fn();
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-panel')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(toggle.onclick).not.toHaveBeenCalled();
  });

  // ─── Step: tls-connect ────────────────────────────────────

  it('step tls-connect highlights connect button', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-connect')!;
    expect(step.highlight).toContain('connect-btn');
  });

  it('step tls-connect preAction switches to client mode, fills wss:// URL and ensures disconnected', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('wss://'),
    );
  });

  it('step tls-connect preAction closes TLS modal when close button is present', async () => {
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'tls-close');
    const clickSpy = vi.fn();
    closeBtn.addEventListener('click', clickSpy);
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-connect')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tls-connect preAction clicks disconnect btn if present', async () => {
    const discBtn = document.createElement('button');
    discBtn.setAttribute('data-testid', 'disconnect-btn');
    makeVisible(discBtn);
    document.body.appendChild(discBtn);
    makeVisible(discBtn);
    const clickSpy = vi.spyOn(discBtn, 'click');

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tls-connect action clicks connect', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step tls-connect has verify for connected status', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-connect')!;
    expect(step.verify).toContain('connected');
  });

  // ─── Step: tls-send ───────────────────────────────────────

  it('step tls-send highlights send button', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-send')!;
    expect(step.highlight).toContain('send-btn');
  });

  it('step tls-send preAction switches to compose tab', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step tls-send preAction connects if not already connected', async () => {
    // No ws-status-dot.connected in DOM → connection guard triggers
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('wss://'),
    );
  });

  it('step tls-send preAction skips connection when already connected', async () => {
    const statusDot = document.createElement('div');
    statusDot.className = 'ws-status-dot connected';
    document.body.appendChild(statusDot);
    makeVisible(statusDot);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step tls-send action fills message and sends', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('TLS'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  // ─── Step: tls-skip-cert ──────────────────────────────────

  it('step tls-skip-cert highlights skip-cert checkbox', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-skip-cert')!;
    expect(step.highlight).toContain('tls-skip-cert');
  });

  it('step tls-skip-cert preAction navigates to Connect tab first, then disconnects, and expands TLS panel', async () => {
    const discBtn = document.createElement('button');
    discBtn.setAttribute('data-testid', 'disconnect-btn');
    makeVisible(discBtn);
    document.body.appendChild(discBtn);
    makeVisible(discBtn);
    const discClickSpy = vi.spyOn(discBtn, 'click');

    // ensureTlsPanelExpanded uses dispatchEvent(MouseEvent('click')), not element.click()
    // so spy via addEventListener instead of vi.spyOn(element, 'click')
    const tlsToggle = document.createElement('button');
    tlsToggle.setAttribute('data-testid', 'tls-toggle');
    tlsToggle.setAttribute('aria-expanded', 'false');
    document.body.appendChild(tlsToggle);
    makeVisible(tlsToggle);
    const tlsClickEvents: Event[] = [];
    tlsToggle.addEventListener('click', (e) => tlsClickEvents.push(e));

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-skip-cert')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // Must switch to client mode and Connect tab BEFORE disconnecting (DISCONNECT_BTN
    // is only in the DOM when the Connect panel is rendered in client mode).
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(discClickSpy).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('wss://'),
    );
    expect(tlsClickEvents.length).toBeGreaterThan(0);
  });

  it('step tls-skip-cert action dispatches click on checkbox to enable skip-cert', async () => {
    const label = document.createElement('label');
    label.setAttribute('data-testid', 'tls-skip-cert');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    const clickSpy = vi.fn(() => { checkbox.checked = true; }); // simulate browser toggle
    checkbox.addEventListener('click', clickSpy);
    label.appendChild(checkbox);
    document.body.appendChild(label);
    makeVisible(label);
    makeVisible(checkbox);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-skip-cert')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // setSkipCert uses waitFor + MouseEvent click to update React controlled checkbox
    expect(clickSpy).toHaveBeenCalled();
    expect(checkbox.checked).toBe(true); // step 5 enables skip-cert
  });

  // ─── Step: tls-certs ──────────────────────────────────────

  it('step tls-certs highlights TLS body', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-certs')!;
    expect(step.highlight).toContain('tls-body');
  });

  it('step tls-certs preAction fills wss:// URL and expands TLS panel', async () => {
    const tlsToggle = document.createElement('button');
    tlsToggle.setAttribute('data-testid', 'tls-toggle');
    tlsToggle.setAttribute('aria-expanded', 'false');
    tlsToggle.onclick = vi.fn();
    document.body.appendChild(tlsToggle);
    makeVisible(tlsToggle);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-certs')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('wss://'),
    );
    expect(tlsToggle.onclick).toHaveBeenCalled();
  });

  it('step tls-certs preAction skips panel expand when already open', async () => {
    const tlsToggle = document.createElement('button');
    tlsToggle.setAttribute('data-testid', 'tls-toggle');
    tlsToggle.setAttribute('aria-expanded', 'true');
    tlsToggle.onclick = vi.fn();
    document.body.appendChild(tlsToggle);
    makeVisible(tlsToggle);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-certs')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(tlsToggle.onclick).not.toHaveBeenCalled();
  });

  it('step tls-certs action focuses CA cert textarea', async () => {
    const caCert = document.createElement('textarea');
    caCert.setAttribute('data-testid', 'tls-ca-cert');
    caCert.focus = vi.fn();
    document.body.appendChild(caCert);
    makeVisible(caCert);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-certs')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(caCert.focus).toHaveBeenCalled();
  });

  it('step tls-certs action is a no-op when CA cert textarea is absent', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-certs')!;
    await expect(step.action!(makeCtx())).resolves.not.toThrow();
  });

  // ─── Step: tls-transport ──────────────────────────────────

  it('step tls-transport highlights transport badge', () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-transport')!;
    expect(step.highlight).toContain('transport-badge');
  });

  it('step tls-transport preAction switches to client mode, resets skip-cert, and switches back to Connect tab', async () => {
    const label = document.createElement('label');
    label.setAttribute('data-testid', 'tls-skip-cert');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    const clickSpy = vi.fn(() => { checkbox.checked = false; }); // simulate browser toggle
    checkbox.addEventListener('click', clickSpy);
    label.appendChild(checkbox);
    document.body.appendChild(label);
    makeVisible(label);

    // Simulate connected status so preAction skips reconnect
    const statusEl = document.createElement('span');
    statusEl.className = 'ws-status-dot connected';
    document.body.appendChild(statusEl);
    makeVisible(statusEl);
    makeVisible(checkbox);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-transport')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    // setSkipCert uses waitFor + MouseEvent click to properly update React controlled checkbox
    expect(clickSpy).toHaveBeenCalled();
    expect(checkbox.checked).toBe(false); // skip-cert reset to false
    // Should NOT click Connect because already connected
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step tls-transport preAction closes TLS modal after resetting skip-cert', async () => {
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const label = document.createElement('label');
    label.setAttribute('data-testid', 'tls-skip-cert');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    label.appendChild(checkbox);
    document.body.appendChild(label);
    makeVisible(label);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'tls-close');
    const closeSpy = vi.fn();
    closeBtn.addEventListener('click', closeSpy);
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-transport')!;
    await step.preAction!(makeCtx());
    expect(closeSpy).toHaveBeenCalled();
  });

  it('step tls-transport preAction connects when disconnected and switches back to Connect tab', async () => {
    // No status-connected element → disconnected state

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-transport')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // Must switch to client mode + Connect tab, connect, then switch back to Connect tab
    // so the transport badge (inside the Connect panel) is in the DOM for the spotlight.
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step tls-transport action dispatches mouseover on transport badge', async () => {
    const badge = document.createElement('span');
    badge.setAttribute('data-testid', 'transport-badge');
    const spy = vi.fn();
    badge.addEventListener('mouseover', spy);
    document.body.appendChild(badge);
    makeVisible(badge);

    const step = wsTlsLesson.steps.find(s => s.id === 'tls-transport')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(spy).toHaveBeenCalled();
  });

  it('step tls-transport action is a no-op when transport badge is absent', async () => {
    const step = wsTlsLesson.steps.find(s => s.id === 'tls-transport')!;
    await expect(step.action!(makeCtx())).resolves.not.toThrow();
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup clears subprotocol and resets protocol to raw to undo GraphQL-WS demo leftovers', async () => {
    const ctx = makeCtx();
    await wsTlsLesson.setup!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Subprotocols'),
      '',
    );
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'raw',
    );
  });

  it('setup switches to client mode, disconnects, resets TLS skip-cert before clearing URL, and resets tabs', async () => {
    // Setup the TLS toggle so ensureTlsPanelExpanded can expand it
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'tls-toggle');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.onclick = vi.fn(() => toggle.setAttribute('aria-expanded', 'true'));
    document.body.appendChild(toggle);
    makeVisible(toggle);

    const label = document.createElement('label');
    label.setAttribute('data-testid', 'tls-skip-cert');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true; // Simulate skip-cert left enabled from a previous session
    const skipCertClickSpy = vi.fn(() => { checkbox.checked = false; }); // simulate browser toggle
    checkbox.addEventListener('click', skipCertClickSpy);
    label.appendChild(checkbox);
    document.body.appendChild(label);
    makeVisible(label);
    makeVisible(checkbox);

    const ctx = makeCtx();
    await wsTlsLesson.setup!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    // Must fill wss:// URL first (TLS panel appears), expand panel, reset skip-cert, then clear URL
    // Note: setup also clears the subprotocol field ('') before filling wss://, so we use
    // findLastIndex for the URL clear to skip the earlier subprotocol fill.
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const wssIdx = fillCalls.findIndex(([, v]) => String(v).startsWith('wss://'));
    const urlClearIdx = fillCalls.findLastIndex(([sel, v]) => v === '' && String(sel).includes('WebSocket URL'));
    expect(wssIdx).toBeGreaterThanOrEqual(0);
    expect(urlClearIdx).toBeGreaterThan(wssIdx);       // URL clear happens AFTER wss:// fill
    // setSkipCert uses waitFor + MouseEvent click to properly update React state
    expect(skipCertClickSpy).toHaveBeenCalled();
    expect(checkbox.checked).toBe(false);           // skip-cert was reset to false
  });

  it('cleanup switches to client mode, Connect tab, disconnects and clears URL', async () => {
    const ctx = makeCtx();
    await wsTlsLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('WebSocket URL'), '');
  });
});

// ─── ws-test-runner (Lesson 20) ──────────────────────────────────

