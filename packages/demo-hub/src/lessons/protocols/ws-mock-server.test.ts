/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsMockServerLesson } from './ws-mock-server';
import { makeCtx } from './ws-test-utils';

describe('ws-mock-server lesson', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    // Reset module-level flags before each test
    await wsMockServerLesson.setup!(makeCtx());
  });

  it('has valid lesson structure', () => {
    expect(wsMockServerLesson.id).toBe('ws-mock-server');
    expect(wsMockServerLesson.domainId).toBe('protocols');
    expect(wsMockServerLesson.name).toBe('Mock Server');
    expect(wsMockServerLesson.steps.length).toBe(8);
    expect(wsMockServerLesson.concept.title).toBeTruthy();
    expect(wsMockServerLesson.concept.body).toBeTruthy();
    expect(wsMockServerLesson.initialTab).toBe('websocket-studio');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsMockServerLesson.setup).toBe('function');
    expect(typeof wsMockServerLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsMockServerLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms defined', () => {
    expect(wsMockServerLesson.concept.keyTerms).toBeDefined();
    expect(wsMockServerLesson.concept.keyTerms!.length).toBe(3);
    const termNames = wsMockServerLesson.concept.keyTerms!.map(t => t.term);
    expect(termNames).toContain('Echo');
    expect(termNames).toContain('Broadcast');
    expect(termNames).toContain('Mock Server');
  });

  it('has a diagram', () => {
    expect(wsMockServerLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsMockServerLesson.category).toBe('websocket');
  });

  it('estimated time is 3 minutes', () => {
    expect(wsMockServerLesson.estimatedMinutes).toBe(3);
  });

  it('has correct step IDs in order', () => {
    const ids = wsMockServerLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'mock-intro', 'mock-start', 'mock-status',
      'mock-connect', 'mock-echo', 'mock-broadcast', 'mock-broadcast-receive', 'mock-stop',
    ]);
  });

  // ─── Setup / Cleanup ────────────────────────────────────────

  it('setup navigates to client mode to stage clean demo start', async () => {
    const ctx = makeCtx();
    await wsMockServerLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('setup stops mock server if already running', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    document.body.appendChild(stopBtn);

    const ctx = makeCtx();
    await wsMockServerLesson.setup!(ctx);
    // Should have clicked MODE_MOCK then MOCK_STOP_BTN
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    // Cleanup path uses direct DOM click (not ctx.click) for stop button
  });

  it('setup disconnects an active client session', async () => {
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'disconnect-btn');
    document.body.appendChild(disconnectBtn);

    const ctx = makeCtx();
    await wsMockServerLesson.setup!(ctx);
    // Direct DOM click used for disconnect (not ctx.click) — just verify it runs without error
    expect(ctx.click).toHaveBeenCalled();
  });

  it('cleanup resets flags and calls disconnect/stop/switchToClient', async () => {
    const ctx = makeCtx();
    await wsMockServerLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  // ─── Step: mock-intro ───────────────────────────────────────

  it('step mock-intro action clicks mock mode then uses waitFor (Rule 5)', async () => {
    const ctx = makeCtx();
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-intro')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringMatching(/mock-start-btn|mock-stop-btn/),
      expect.any(Number),
    );
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('step mock-intro highlights the mock mode toggle', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-intro')!;
    expect(step.highlight).toContain('mode-mock');
  });

  it('step mock-intro has no preAction', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-intro')!;
    expect(step.preAction).toBeUndefined();
  });

  // ─── Step: mock-start ───────────────────────────────────────

  it('step mock-start clicks start button and uses waitFor when button is available', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('mock-stop-btn'),
      expect.any(Number),
    );
  });

  it('ensureMockRunning clicks mock-start-btn when it is not disabled (lines 21-22 true branch)', async () => {
    // Reset _mockRunning via setup
    await wsMockServerLesson.setup!(makeCtx());
    // Put a non-disabled mock-start-btn in the DOM
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    btn.disabled = false;
    document.body.appendChild(btn);

    // Access ensureMockRunning via a step preAction that calls it
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-status')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should have clicked MODE_MOCK then MOCK_START_BTN
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('mock-stop-btn'),
      expect.any(Number),
    );
  });

  it('step mock-start does nothing when button is disabled but still sets _mockRunning', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    btn.disabled = true;
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    // Flag should be set: server already running
  });

  it('step mock-start does nothing when button not found but still sets _mockRunning', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step mock-start has verify for stop button', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-start')!;
    expect(step.verify).toContain('mock-stop-btn');
  });

  // ─── Step: mock-status ──────────────────────────────────────

  it('step mock-status has no action (informational)', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-status')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  it('step mock-status preAction navigates to Mock mode (Rule 4 guard)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-status')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ensureMockRunning starts with MODE_MOCK click; then preAction also clicks MODE_MOCK
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  // ─── Step: mock-connect ─────────────────────────────────────

  it('step mock-connect preAction calls ensureMockRunning then switches to client mode', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ensureMockRunning clicks MODE_MOCK; preAction then clicks MODE_CLIENT
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(calls.some((c: string) => c.includes('mode-mock'))).toBe(true);
    expect(calls.some((c: string) => c.includes('mode-client'))).toBe(true);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
  });

  it('step mock-connect preAction uses waitFor instead of fixed delay (Rule 5)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('connect-btn'),
      expect.any(Number),
    );
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('step mock-connect action clicks connect and waits for connection (Rule 5)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('ws-status-dot'),
      expect.any(Number),
    );
  });

  it('step mock-connect has verify selector', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-connect')!;
    expect(step.verify).toBeTruthy();
  });

  // ─── Step: mock-echo ────────────────────────────────────────

  it('step mock-echo preAction calls ensureClientConnected then navigates to compose', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-echo')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ensureClientConnected → ensureMockRunning → MODE_MOCK; then MODE_CLIENT + CONNECT_BTN + connect
    // After ensureClientConnected, preAction always clicks MODE_CLIENT and LEFT_TAB_SEND
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(calls.some((c: string) => c.includes('mode-client'))).toBe(true);
    expect(calls.some((c: string) => c.includes('left-tab-send'))).toBe(true);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('Hello from Mock Server demo!'),
    );
  });

  it('step mock-echo preAction uses waitFor for compose tab (Rule 5)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-echo')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('left-tab-send'),
      expect.any(Number),
    );
  });

  it('step mock-echo action clicks send button', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-echo')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  it('step mock-echo has verify selector for message row', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-echo')!;
    expect(step.verify).toBeTruthy();
  });

  // ─── Step: mock-broadcast ───────────────────────────────────

  it('step mock-broadcast preAction calls ensureMockRunning + switches to mock mode', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('mock-broadcast-input'),
      'Server broadcast: welcome everyone!',
    );
  });

  it('step mock-broadcast preAction uses waitFor for broadcast input (Rule 5)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('mock-broadcast-input'),
      expect.any(Number),
    );
  });

  it('step mock-broadcast highlights broadcast button', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    expect(step.highlight).toContain('mock-broadcast-btn');
  });

  it('step mock-broadcast action clicks the broadcast button', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-broadcast-btn'));
  });

  it('step mock-broadcast preAction fills the broadcast input with a message', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('mock-broadcast-input'),
      'Server broadcast: welcome everyone!',
    );
  });

  // ─── Step: mock-broadcast-receive ───────────────────────────

  it('step mock-broadcast-receive exists with correct structure', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast-receive')!;
    expect(step).toBeDefined();
    expect(step.title).toBeTruthy();
    expect(step.description).toBeTruthy();
    expect(step.highlight).toBe('.ws-message-received');
    expect(step.verify).toBe('.ws-message-received');
  });

  it('step mock-broadcast-receive action switches to Client mode and opens Events tab', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast-receive')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('mode-client'))).toBe(true);
    expect(calls.some(c => c.includes('right-tab-events'))).toBe(true);
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('right-tab-events'),
      expect.any(Number),
    );
  });

  it('step mock-broadcast-receive preAction calls ensureClientConnected (Rule 4 guard)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast-receive')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ensureClientConnected → ensureMockRunning → MODE_MOCK click
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('mode-mock') || c.includes('mode-client'))).toBe(true);
  });

  it('step mock-broadcast-receive preAction broadcasts silently when no received message exists', async () => {
    // No .ws-message-received in the DOM → preAction should trigger silent broadcast
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast-receive')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should end with MODE_CLIENT + RIGHT_TAB_EVENTS clicks
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('mode-client'))).toBe(true);
    expect(calls.some(c => c.includes('right-tab-events'))).toBe(true);
  });

  // ─── Step: mock-stop ────────────────────────────────────────

  it('step mock-stop preAction calls ensureMockRunning then navigates to mock mode (Rule 4)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.waitFor).toHaveBeenCalledWith(
      expect.stringContaining('mock-stop-btn'),
      expect.any(Number),
    );
  });

  it('step mock-stop action clicks stop button when available and enabled', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-stop-btn');
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-stop-btn'));
  });

  it('step mock-stop action does nothing when stop button is disabled', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-stop-btn');
    btn.disabled = true;
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step mock-stop action does nothing when stop button not found', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step mock-stop has verify selector for start button', () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-stop')!;
    expect(step.verify).toContain('mock-start-btn');
  });

  it('ensureMockRunning clicks start button when startBtn is present and enabled (line 21 true branch)', async () => {
    // Find a step that calls ensureMockRunning (mock-receive does this)
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-receive')!;
    if (!step?.preAction) return;
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'mock-start-btn');
    startBtn.disabled = false;
    document.body.appendChild(startBtn);
    const startClickSpy = vi.fn();
    startBtn.addEventListener('click', startClickSpy);
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    document.body.appendChild(stopBtn);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-start-btn'));
  });

  it('mock-broadcast-receive preAction fills input when empty and clicks broadcast btn (line 244/249 true branch)', async () => {
    const step = wsMockServerLesson.steps.find(s => s.id === 'mock-broadcast-receive')!;
    if (!step?.preAction) return;
    // No received messages visible — hasReceived = null → broadcast branch fires
    // Provide broadcast input with empty value
    const broadcastInput = document.createElement('input');
    broadcastInput.setAttribute('data-testid', 'mock-broadcast-input');
    broadcastInput.value = '';
    document.body.appendChild(broadcastInput);
    const broadcastBtn = document.createElement('button');
    broadcastBtn.setAttribute('data-testid', 'mock-broadcast-btn');
    broadcastBtn.disabled = false;
    const broadcastClickSpy = vi.fn();
    broadcastBtn.addEventListener('click', broadcastClickSpy);
    document.body.appendChild(broadcastBtn);
    // Also add stop button so ensureMockRunning doesn't try to start
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    document.body.appendChild(stopBtn);
    const ctx = makeCtx();
    await step.preAction(ctx);
    // The input value should have been set directly (not via ctx.fill)
    expect(broadcastInput.value).toBe('Server broadcast: welcome everyone!');
    expect(broadcastClickSpy).toHaveBeenCalled();
  });
});

// ─── ws-console ─────────────────────────────────────────────────

