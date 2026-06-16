/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { wsStompLesson } from './ws-stomp';
import { makeCtx } from './ws-test-utils';

describe('ws-stomp lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsStompLesson.id).toBe('ws-stomp');
    expect(wsStompLesson.domainId).toBe('protocols');
    expect(wsStompLesson.category).toBe('websocket');
    expect(wsStompLesson.name).toBe('STOMP / RabbitMQ');
    expect(wsStompLesson.concept.title).toBeTruthy();
    expect(wsStompLesson.concept.body).toBeTruthy();
    expect(wsStompLesson.initialTab).toBe('websocket-studio');
    expect(wsStompLesson.estimatedMinutes).toBe(4);
    expect(wsStompLesson.steps.length).toBe(8);
  });

  it('has docker metadata', () => {
    expect(wsStompLesson.tag).toBe('🐳 Docker');
    expect(wsStompLesson.dockerEndpoint).toContain('localhost:15674');
    expect(wsStompLesson.dockerCommand).toContain('stomp');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsStompLesson.setup).toBe('function');
    expect(typeof wsStompLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsStompLesson.steps) {
      expect(step.id, `step.id missing`).toBeTruthy();
      expect(step.title, `step "${step.id}" missing title`).toBeTruthy();
      expect(step.description, `step "${step.id}" missing description`).toBeTruthy();
    }
  });

  it('has correct step IDs in order', () => {
    const ids = wsStompLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'stomp-intro',
      'stomp-protocol',
      'stomp-connect-ws',
      'stomp-handshake',
      'stomp-subscribe',
      'stomp-send',
      'stomp-frames',
      'stomp-disconnect',
    ]);
  });

  it('all steps have pauseAfter: true for comfortable reading time', () => {
    for (const step of wsStompLesson.steps) {
      expect(step.pauseAfter, `step "${step.id}" should have pauseAfter: true`).toBe(true);
    }
  });

  it('has key terms defined covering STOMP concepts', () => {
    const terms = wsStompLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('STOMP Frame');
    expect(termNames).toContain('Destination');
    expect(termNames).toContain('SUBSCRIBE');
  });

  it('has a diagram describing the two-step handshake', () => {
    expect(wsStompLesson.concept.diagram).toBeTruthy();
    expect(wsStompLesson.concept.diagram).toContain('CONNECT');
    expect(wsStompLesson.concept.diagram).toContain('CONNECTED');
  });

  // ─── Step: stomp-intro ───────────────────────────────────────

  it('step stomp-intro clicks connect tab and highlights it', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(step.highlight).toContain('left-tab-connect');
  });

  // ─── Step: stomp-protocol ────────────────────────────────────

  it('step stomp-protocol highlights protocol dropdown', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-protocol')!;
    expect(step.highlight).toContain('protocol-select');
  });

  it('step stomp-protocol has a preAction that navigates to connect tab (Rule 4)', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-protocol')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // PROTOCOL_SELECT lives inside the Connect panel — preAction ensures it is in the DOM
    // before the spotlight fires (highlight runs before the action).
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step stomp-protocol action does NOT re-navigate (preAction handled it)', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-protocol')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Action only waits for observation; preAction handles the tab navigation
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ─── Step: stomp-connect-ws ──────────────────────────────────

  it('step stomp-connect-ws has a preAction that navigates to connect tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-connect-ws')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step stomp-connect-ws action does both WS connect and STOMP CONNECT in one action', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-connect-ws')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // WS transport: clicks Connect (guard passes when STATUS_CONNECTED absent in jsdom)
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // Uses waitFor instead of fixed delay for robust connection detection (Rule 5)
    expect(ctx.waitFor).toHaveBeenCalledWith(".ws-status-dot.connected");
    // Shows Events after WS connects
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    // Navigates to Compose to send STOMP CONNECT frame
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    // Selects CONNECT command
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('stomp-command'),
      'CONNECT',
    );
    // Fills virtual host, login, passcode
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('stomp-destination'), '/');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('stomp-login'), 'guest');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('stomp-passcode'), 'guest');
    // Sends the CONNECT frame
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  it('step stomp-connect-ws action skips WS connect when already connected (replay guard)', async () => {
    // Simulate already-connected state: STATUS_CONNECTED element (.ws-status-dot.connected) exists
    document.body.innerHTML = '<div class="ws-status-dot connected"></div>';
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-connect-ws')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // CONNECT_BTN should NOT be clicked because STATUS_CONNECTED is already present
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // But waitFor is still called to confirm status
    expect(ctx.waitFor).toHaveBeenCalledWith(".ws-status-dot.connected");
    // Still sends STOMP CONNECT frame
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  // ─── Step: stomp-handshake ───────────────────────────────────

  it('step stomp-handshake has a preAction that navigates to events tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-handshake')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step stomp-handshake highlights events tab (observation)', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-handshake')!;
    expect(step.highlight).toContain('right-tab-events');
  });

  it('step stomp-handshake description references handshake frames', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-handshake')!;
    expect(step.description).toContain('CONNECT');
    expect(step.description).toContain('CONNECTED');
  });

  it('step stomp-handshake action calls ctx.delay (observation pause)', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-handshake')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(600);
  });

  // ─── Step: stomp-subscribe ───────────────────────────────────

  it('step stomp-subscribe preAction navigates to compose, selects SUBSCRIBE, fills /queue/demo when connected', async () => {
    // Simulate connected state so ensureStompSession skips its reconnect logic
    document.body.innerHTML = '<div class="ws-status-dot connected"></div>';
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-subscribe')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('stomp-command'),
      'SUBSCRIBE',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('stomp-destination'),
      '/queue/demo',
    );
  });

  it('step stomp-subscribe preAction establishes STOMP session when not connected (Rule 4)', async () => {
    // No STATUS_CONNECTED in DOM → ensureStompSession should run
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-subscribe')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Connection sequence: WS connect + STOMP CONNECT frame
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(".ws-status-dot.connected");
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('stomp-command'), 'CONNECT');
    // Then sets up SUBSCRIBE compose state
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('stomp-command'), 'SUBSCRIBE');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('stomp-destination'), '/queue/demo');
  });

  it('step stomp-subscribe action clicks send (compose pre-populated by preAction)', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-subscribe')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  // ─── Step: stomp-send ────────────────────────────────────────

  it('step stomp-send has a preAction that navigates to compose and selects SEND when connected', async () => {
    // Simulate connected state so ensureStompSession skips its reconnect logic
    document.body.innerHTML = '<div class="ws-status-dot connected"></div>';
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-send')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('stomp-command'),
      'SEND',
    );
  });

  it('step stomp-send preAction establishes STOMP session when not connected (Rule 4)', async () => {
    // No STATUS_CONNECTED in DOM → ensureStompSession should run
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Connection sequence: WS connect + STOMP CONNECT
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(".ws-status-dot.connected");
    // After session established, selects SEND command
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('stomp-command'), 'SEND');
  });

  it('step stomp-send fills destination and body, clicks send, shows events', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('stomp-destination'),
      '/queue/demo',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('hello'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step stomp-send highlights send button', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-send')!;
    expect(step.highlight).toContain('send-btn');
  });

  // ─── Step: stomp-frames ──────────────────────────────────────

  it('step stomp-frames has a preAction that navigates to events tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-frames')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step stomp-frames highlights events tab', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-frames')!;
    expect(step.highlight).toContain('right-tab-events');
  });

  it('step stomp-frames description mentions all key STOMP frame types', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-frames')!;
    expect(step.description).toContain('CONNECTED');
    expect(step.description).toContain('SUBSCRIBE');
    expect(step.description).toContain('SEND');
    expect(step.description).toContain('MESSAGE');
    expect(step.description).toContain('HEARTBEAT');
  });

  it('step stomp-frames action calls ctx.delay (observation pause)', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-frames')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(600);
  });

  // ─── Step: stomp-disconnect ──────────────────────────────────

  it('step stomp-disconnect has a preAction that navigates to connect tab', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-disconnect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step stomp-disconnect action clicks disconnect button with ctx.click for visual ripple', async () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-btn'));
  });

  it('step stomp-disconnect highlights disconnect button', () => {
    const step = wsStompLesson.steps.find(s => s.id === 'stomp-disconnect')!;
    expect(step.highlight).toContain('disconnect-btn');
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup fills RabbitMQ URL, clears subprotocols, and selects stomp protocol', async () => {
    const ctx = makeCtx();
    await wsStompLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('localhost:15674'),
    );
    // Must clear Subprotocols to prevent stale "graphql-transport-ws" from breaking RabbitMQ handshake
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Subprotocols'),
      '',
    );
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'stomp',
    );
  });

  it('cleanup resets protocol to raw', async () => {
    const ctx = makeCtx();
    await wsStompLesson.cleanup!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('protocol-select'),
      'raw',
    );
  });

  // ─── resetStompCommand (module-level helper) ──────────────────

  it('cleanup resets STOMP command via DOM when select element exists', async () => {
    // Create a STOMP command select in the DOM with SEND and SUBSCRIBE options.
    // cleanup() → resetStompCommand() sets cmd.value='SEND' and dispatches 'change'.
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'stomp-command');
    const optSend = document.createElement('option');
    optSend.value = 'SEND';
    const optSub = document.createElement('option');
    optSub.value = 'SUBSCRIBE';
    optSub.selected = true;
    select.append(optSend, optSub);
    const changeSpy = vi.fn();
    select.addEventListener('change', changeSpy);
    document.body.appendChild(select);

    const ctx = makeCtx();
    await wsStompLesson.cleanup!(ctx);

    // resetStompCommand dispatched a change event on the select element
    expect(changeSpy).toHaveBeenCalled();
    // And the select value was reset to 'SEND'
    expect(select.value).toBe('SEND');

    document.body.removeChild(select);
  });
});

// ─── ws-graphql lesson ──────────────────────────────────────────

