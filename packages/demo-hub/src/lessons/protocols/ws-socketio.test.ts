/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsSocketIoLesson } from './ws-socketio';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('ws-socketio lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsSocketIoLesson.id).toBe('ws-socketio');
    expect(wsSocketIoLesson.domainId).toBe('protocols');
    expect(wsSocketIoLesson.category).toBe('websocket');
    expect(wsSocketIoLesson.name).toBe('Socket.IO Protocol');
    expect(wsSocketIoLesson.concept.title).toBeTruthy();
    expect(wsSocketIoLesson.concept.body).toBeTruthy();
    expect(wsSocketIoLesson.initialTab).toBe('websocket-studio');
    expect(wsSocketIoLesson.estimatedMinutes).toBe(4);
    expect(wsSocketIoLesson.steps.length).toBe(9);
  });

  it('has docker metadata', () => {
    expect(wsSocketIoLesson.tag).toBe('🐳 Docker');
    expect(wsSocketIoLesson.dockerEndpoint).toContain('localhost:3100');
    expect(wsSocketIoLesson.dockerCommand).toContain('socketio');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsSocketIoLesson.setup).toBe('function');
    expect(typeof wsSocketIoLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsSocketIoLesson.steps) {
      expect(step.id, `step.id missing`).toBeTruthy();
      expect(step.title, `step "${step.id}" missing title`).toBeTruthy();
      expect(step.description, `step "${step.id}" missing description`).toBeTruthy();
    }
  });

  it('has correct step IDs in order', () => {
    const ids = wsSocketIoLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'sio-intro',
      'sio-select-protocol',
      'sio-enter-url',
      'sio-connect',
      'sio-inspect-params',
      'sio-compose-event',
      'sio-send',
      'sio-namespace',
      'sio-disconnect',
    ]);
  });

  it('has key terms defined', () => {
    const terms = wsSocketIoLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('SID');
    expect(termNames).toContain('Namespace');
  });

  it('has a diagram', () => {
    expect(wsSocketIoLesson.concept.diagram).toBeTruthy();
    expect(wsSocketIoLesson.concept.diagram).toContain('Socket.IO');
  });

  // ─── Step: sio-intro ─────────────────────────────────────────

  it('step sio-intro action waits for the connect tab (already active from setup)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'), expect.any(Number));
  });

  // ─── Step: sio-select-protocol ───────────────────────────────

  it('step sio-select-protocol preAction silently switches to connect tab only if not already selected (Rule 4)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-select-protocol')!;
    expect(typeof step.preAction).toBe('function');

    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'left-tab-connect');
    document.body.appendChild(connectTab);
    const clickSpy = vi.spyOn(connectTab, 'click');

    const ctx = makeCtx();
    await step.preAction!(ctx);
    // PROTOCOL_SELECT lives inside the Connect panel — preAction ensures it is in the DOM
    // via a plain DOM click (not ctx.click) to avoid a visible ripple for this guard.
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step sio-select-protocol action does NOT re-navigate (preAction handled it)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-select-protocol')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step sio-select-protocol highlights protocol dropdown', () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-select-protocol')!;
    expect(step.highlight).toContain('protocol-select');
  });

  // ─── Step: sio-enter-url ─────────────────────────────────────

  it('step sio-enter-url preAction silently switches to connect tab only if not already selected (Rule 4)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-enter-url')!;
    expect(typeof step.preAction).toBe('function');

    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'left-tab-connect');
    document.body.appendChild(connectTab);
    const clickSpy = vi.spyOn(connectTab, 'click');

    const ctx = makeCtx();
    await step.preAction!(ctx);
    // URL_INPUT lives inside the Connect panel — preAction ensures it is in the DOM
    // via a plain DOM click (not ctx.click) to avoid a visible ripple for this guard.
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step sio-enter-url action does NOT re-navigate (preAction handled it)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-enter-url')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ─── Step: sio-connect ───────────────────────────────────────

  it('step sio-connect preAction silently switches to connect tab only if not already selected', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-connect')!;
    expect(typeof step.preAction).toBe('function');

    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'left-tab-connect');
    document.body.appendChild(connectTab);
    const clickSpy = vi.spyOn(connectTab, 'click');

    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step sio-connect action uses waitFor instead of fixed delay (Rule 5)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith('.ws-status-dot.connected');
    // After connecting, switches to Events to show handshake, then back to Connect for status badge
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step sio-connect action skips WS connect when already connected (replay guard)', async () => {
    document.body.innerHTML = '<div class="ws-status-dot connected"></div>';
    makeVisible(document.querySelector('.ws-status-dot.connected')!);
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // CONNECT_BTN should NOT be clicked because STATUS_CONNECTED is already present
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // But waitFor is still called
    expect(ctx.waitFor).toHaveBeenCalledWith('.ws-status-dot.connected');
    // Still navigates to Events and back
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Step: sio-inspect-params ────────────────────────────────

  it('step sio-inspect-params has a preAction that ensures connection and navigates to connect tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-inspect-params')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    // No STATUS_CONNECTED in DOM → ensureSioConnected should run
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith('.ws-status-dot.connected');
    // Then navigates to Connect tab so SIO_SERVER_PARAMS is visible
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step sio-inspect-params preAction skips connect when already connected', async () => {
    document.body.innerHTML = '<div class="ws-status-dot connected"></div>';
    makeVisible(document.querySelector('.ws-status-dot.connected')!);
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-inspect-params')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should not click connect button when already connected
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // But still navigates to Connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step sio-inspect-params action calls ctx.delay (observation pause)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-inspect-params')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(600);
  });

  // ─── Step: sio-compose-event ─────────────────────────────────

  it('step sio-compose-event preAction ensures connection then navigates to compose (Rule 4)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-compose-event')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    // No STATUS_CONNECTED → ensureSioConnected should run, then navigate to compose
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith('.ws-status-dot.connected');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step sio-compose-event preAction only navigates to compose when already connected', async () => {
    document.body.innerHTML = '<div class="ws-status-dot connected"></div>';
    makeVisible(document.querySelector('.ws-status-dot.connected')!);
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-compose-event')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step sio-compose-event action fills event name and payload (no nav — preAction handles that)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-compose-event')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Action only fills fields; navigation is in preAction
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('sio-event-name'),
      'message',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Hello Socket.IO'),
    );
  });

  // ─── Step: sio-send ──────────────────────────────────────────

  it('step sio-send has a preAction that ensures connection and pre-fills compose (Rule 4)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-send')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    // No STATUS_CONNECTED → ensureSioConnected should run
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith('.ws-status-dot.connected');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('sio-event-name'), 'message');
    expect(ctx.fill).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Hello Socket.IO'));
  });

  it('step sio-send action clicks send and then events tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Step: sio-namespace ─────────────────────────────────────

  it('step sio-namespace has a preAction that navigates to compose tab (Rule 4)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-namespace')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // SIO_NAMESPACE lives inside the Compose panel — preAction ensures it is in the DOM
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step sio-namespace action does nothing when namespace element is absent', async () => {
    // ns = null → scrollIntoView skipped (false branch of if (ns))
    document.body.innerHTML = '';
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-namespace')!;
    const ctx = makeCtx();
    await expect(step.action!(ctx)).resolves.not.toThrow();
  });

  it('step sio-namespace action does NOT re-navigate or fill namespace (preAction handled nav)', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-namespace')!;
    const ctx = makeCtx();
    // Add namespace element — action scrolls it into view, must not focus() (would trap ArrowRight)
    const nsEl = document.createElement('input');
    nsEl.setAttribute('data-testid', 'sio-namespace');
    nsEl.scrollIntoView = vi.fn();
    document.body.appendChild(nsEl);
    makeVisible(nsEl);
    await step.action!(ctx);
    // Action does not call click(left-tab-send) — that's preAction's job
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    // Must not fill /chat — server only handles root namespace
    expect(ctx.fill).not.toHaveBeenCalledWith(
      expect.stringContaining('sio-namespace'),
      expect.anything(),
    );
    // scrollIntoView called instead of focus() — keeps keyboard navigation working
    expect(nsEl.scrollIntoView).toHaveBeenCalled();
  });

  // ─── Step: sio-disconnect ────────────────────────────────────

  it('step sio-disconnect has a preAction that navigates to connect tab', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-disconnect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step sio-disconnect action clicks disconnect button with ctx.click for visual ripple', async () => {
    const step = wsSocketIoLesson.steps.find(s => s.id === 'sio-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-btn'));
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup navigates to client mode, connect tab, clears subprotocols, and pre-fills URL + protocol', async () => {
    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'left-tab-connect');
    document.body.appendChild(connectTab);
    const connectClickSpy = vi.spyOn(connectTab, 'click');

    const ctx = makeCtx();
    await wsSocketIoLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    // Connect tab switch uses a plain DOM click (not ctx.click) — no ripple during setup.
    expect(connectClickSpy).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('localhost:3100'),
    );
    // Must clear Subprotocols so stale values from other lessons don't pollute the config
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Subprotocols'),
      '',
    );
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'socket-io',
    );
  });

  it('cleanup calls reset protocol to raw', async () => {
    const ctx = makeCtx();
    await wsSocketIoLesson.cleanup!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'raw',
    );
  });
});

// ─── ws-stomp lesson ──────────────────────────────────────────

