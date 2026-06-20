/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { wsBasicsLesson } from './ws-basics';
import { makeCtx } from './ws-test-utils';

describe('ws-basics lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ── Structure ──────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(wsBasicsLesson.id).toBe('ws-basics');
    expect(wsBasicsLesson.domainId).toBe('protocols');
    expect(wsBasicsLesson.name).toBe('WebSocket Basics');
    expect(wsBasicsLesson.steps.length).toBeGreaterThan(0);
    expect(wsBasicsLesson.concept.title).toBeTruthy();
    expect(wsBasicsLesson.concept.body).toBeTruthy();
    expect(wsBasicsLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsBasicsLesson.setup).toBe('function');
    expect(typeof wsBasicsLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsBasicsLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms defined', () => {
    expect(wsBasicsLesson.concept.keyTerms).toBeDefined();
    expect(wsBasicsLesson.concept.keyTerms!.length).toBeGreaterThan(0);
  });

  it('has a diagram', () => {
    expect(wsBasicsLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsBasicsLesson.category).toBe('websocket');
  });

  it('has correct step IDs in order', () => {
    const ids = wsBasicsLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'ws-nav', 'ws-mock', 'ws-url', 'ws-connect',
      'ws-compose', 'ws-send', 'ws-events', 'ws-tabs', 'ws-disconnect',
    ]);
  });

  it('steps ws-mock, ws-connect, ws-send each have a verify selector', () => {
    const verify = (id: string) => wsBasicsLesson.steps.find(s => s.id === id)?.verify;
    expect(verify('ws-mock')).toBeTruthy();
    expect(verify('ws-connect')).toBeTruthy();
    expect(verify('ws-send')).toBeTruthy();
  });

  // ── Setup ──────────────────────────────────────────────────────

  it('setup resets flags and returns to client mode', async () => {
    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    // Must navigate to mock mode to potentially stop the server
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    // Must return to client mode
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    // Must navigate to connect tab and events tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('setup disconnects an active session (disconnect btn enabled)', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'disconnect-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    // Disconnect btn is enabled → should have clicked it
    // The raw click is via btn.click() directly, so we check delay was called (indicates btn.click() was called)
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

  it('setup stops mock server if the stop button is present and enabled', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-stop-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(500);
  });

  it('setup after setup resets _mockRunning flag — step 2 action can start mock again', async () => {
    // Run step 2 action to set _mockRunning = true
    const mockStep = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);
    const ctx = makeCtx();
    await mockStep.action!(ctx);
    ctx.click.mockClear();

    // Now run setup — _mockRunning should be reset
    await wsBasicsLesson.setup!(ctx);
    ctx.click.mockClear();

    // preAction + action should attempt to start the mock again
    await mockStep.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  it('ws-connect preAction starts mock server when start button is enabled', async () => {
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(startBtn);

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx); // ensures _mockRunning = false
    ctx.click.mockClear();
    ctx.waitFor.mockClear();

    await connectStep.preAction!(ctx);

    // Covers ensureMockRunning() branch that actively starts the mock server.
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-stop-btn'), expect.any(Number));
  });

  it('cleanup resets connection flags so preAction reconnects on next run', async () => {
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const composeStep = wsBasicsLesson.steps.find(s => s.id === 'ws-compose')!;

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await connectStep.action!(ctx); // sets _wsConnected = true

    await wsBasicsLesson.cleanup!(ctx); // resets _mockRunning/_wsConnected and runs wsCleanup
    ctx.click.mockClear();
    ctx.waitFor.mockClear();

    await composeStep.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'), expect.any(Number));
  });

  // ── Step: ws-nav ───────────────────────────────────────────────

  it('step ws-nav has no action and highlights mode-client', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-nav')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toContain('mode-client');
  });

  // ── Step: ws-mock ──────────────────────────────────────────────

  it('step ws-mock preAction clicks mock mode tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('step ws-mock action starts server when button is enabled', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
    // Rule 5: must wait for stop button to confirm server started, not fixed delay
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-stop-btn'), expect.any(Number));
  });

  it('step ws-mock action handles disabled button (server already running)', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    btn.disabled = true;
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    // click must NOT be called for a disabled button
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
    // But waitFor must not be called either (no connect initiated)
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('step ws-mock action handles missing button (no DOM element)', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('step ws-mock action sets _mockRunning so ensureMockRunning is no-op on subsequent steps', async () => {
    // After step 2 action sets _mockRunning = true, step 4 preAction must not click mode-mock again
    const mockStep = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await mockStep.action!(ctx);  // sets _mockRunning = true
    ctx.click.mockClear();

    await connectStep.preAction!(ctx);
    // ensureMockRunning is a no-op → mode-mock must NOT be clicked again
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    // Still navigates to connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  // ── Step: ws-url ───────────────────────────────────────────────

  it('step ws-url preAction switches to client mode and connect tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-url')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step ws-url action fills the WebSocket URL', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-url')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
  });

  // ── Step: ws-connect ───────────────────────────────────────────

  it('step ws-connect preAction ensures mock server running (calls mode-mock when _mockRunning=false)', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);  // resets _mockRunning = false
    ctx.click.mockClear();

    await step.preAction!(ctx);
    // _mockRunning = false → ensureMockRunning switches to Mock mode
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    // And returns to Client mode after
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    // Then navigates to connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step ws-connect preAction skips mock start when already running', async () => {
    // Run step 2 action to set _mockRunning = true
    const mockStep = wsBasicsLesson.steps.find(s => s.id === 'ws-mock')!;
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await mockStep.action!(ctx);
    ctx.click.mockClear();

    await connectStep.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  it('step ws-connect action clicks connect and uses waitFor (Rule 5)', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // Must waitFor STATUS_CONNECTED — no fixed delay (Rule 5)
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'), expect.any(Number));
  });

  it('step ws-connect action sets _wsConnected so subsequent preActions skip connect', async () => {
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const composeStep = wsBasicsLesson.steps.find(s => s.id === 'ws-compose')!;

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await connectStep.action!(ctx);  // sets _wsConnected = true
    ctx.click.mockClear();
    ctx.fill.mockClear();

    await composeStep.preAction!(ctx);
    // _wsConnected = true → ensureConnected is a no-op — must NOT click connect-btn
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  // ── Step: ws-compose ───────────────────────────────────────────

  it('step ws-compose preAction calls ensureConnected and navigates to compose', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-compose')!;
    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);  // resets flags
    ctx.click.mockClear();

    await step.preAction!(ctx);
    // ensureConnected → ensureMockRunning → clicks mode-mock, mode-client; then connect-btn + waitFor
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'), expect.any(Number));
    // Then navigates to compose tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step ws-compose preAction skips connect when already connected', async () => {
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const composeStep = wsBasicsLesson.steps.find(s => s.id === 'ws-compose')!;

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await connectStep.action!(ctx);  // sets _wsConnected = true
    ctx.click.mockClear();
    ctx.waitFor.mockClear();

    await composeStep.preAction!(ctx);
    // ensureConnected is a no-op (already connected)
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).not.toHaveBeenCalled();
    // Still navigates to compose
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step ws-compose action fills the message input', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-compose')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"hello"'),
    );
  });

  // ── Step: ws-send ──────────────────────────────────────────────

  it('step ws-send has a preAction (Rule 4 guard)', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-send')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step ws-send preAction ensures connected, navigates to compose, pre-fills message', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-send')!;
    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    ctx.click.mockClear();
    ctx.fill.mockClear();

    await step.preAction!(ctx);
    // Should ensure connected (mock + connect)
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // Should navigate to compose tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    // Should pre-fill message
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('"hello"'),
    );
  });

  it('step ws-send action clicks send button', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  // ── Step: ws-events ────────────────────────────────────────────

  it('step ws-events has a preAction (Rule 4 guard)', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-events')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step ws-events preAction calls ensureConnected when not yet connected', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-events')!;
    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    ctx.click.mockClear();

    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'), expect.any(Number));
  });

  it('step ws-events preAction is no-op when already connected', async () => {
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const eventsStep = wsBasicsLesson.steps.find(s => s.id === 'ws-events')!;

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await connectStep.action!(ctx);
    ctx.click.mockClear();
    ctx.waitFor.mockClear();

    await eventsStep.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('step ws-events action clicks the events tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-events')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ── Step: ws-tabs ──────────────────────────────────────────────

  it('step ws-tabs has no action (informational highlight only)', () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-tabs')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toContain('conn-tab-add');
  });

  // ── Step: ws-disconnect ────────────────────────────────────────

  it('step ws-disconnect preAction ensures connected and navigates to Connect tab', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-disconnect')!;
    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    ctx.click.mockClear();

    await step.preAction!(ctx);
    // Should ensure connected (so disconnect has something to close)
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // Should navigate to Connect tab so Disconnect button is visible
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step ws-disconnect preAction skips connect when already connected', async () => {
    const connectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-connect')!;
    const disconnectStep = wsBasicsLesson.steps.find(s => s.id === 'ws-disconnect')!;

    const ctx = makeCtx();
    await wsBasicsLesson.setup!(ctx);
    await connectStep.action!(ctx);
    ctx.click.mockClear();
    ctx.waitFor.mockClear();

    await disconnectStep.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    // But still navigates to connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step ws-disconnect action clicks disconnect button', async () => {
    const step = wsBasicsLesson.steps.find(s => s.id === 'ws-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-btn'));
  });
});

// ─── ws-auth-transport ──────────────────────────────────────────

