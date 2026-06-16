/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsSessionRecordingLesson } from './ws-session-recording';
import { makeCtx } from './ws-test-utils';

describe('ws-session-recording lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsSessionRecordingLesson.id).toBe('ws-session-recording');
    expect(wsSessionRecordingLesson.domainId).toBe('protocols');
    expect(wsSessionRecordingLesson.name).toBe('Session Recording & Replay');
    expect(wsSessionRecordingLesson.steps.length).toBe(7);
    expect(wsSessionRecordingLesson.concept.title).toBeTruthy();
    expect(wsSessionRecordingLesson.concept.body).toBeTruthy();
    expect(wsSessionRecordingLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsSessionRecordingLesson.category).toBe('websocket');
    expect(wsSessionRecordingLesson.estimatedMinutes).toBe(4);
    expect(wsSessionRecordingLesson.dockerEndpoint).toBeUndefined();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsSessionRecordingLesson.setup).toBe('function');
    expect(typeof wsSessionRecordingLesson.cleanup).toBe('function');
  });

  it('concept has key terms for recording format and replay speed', () => {
    const terms = wsSessionRecordingLesson.concept.keyTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(2);
    const termNames = terms.map(t => t.term.toLowerCase());
    expect(termNames.some(t => t.includes('recording'))).toBe(true);
    expect(termNames.some(t => t.includes('speed'))).toBe(true);
  });

  it('concept has a diagram', () => {
    expect(wsSessionRecordingLesson.concept.diagram).toBeTruthy();
    expect(wsSessionRecordingLesson.concept.diagram).toContain('Rec');
    expect(wsSessionRecordingLesson.concept.diagram).toContain('Replay');
  });

  it('all steps have id, title, and description', () => {
    wsSessionRecordingLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
    });
  });

  it('step IDs are in correct order', () => {
    const ids = wsSessionRecordingLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'rec-intro',
      'rec-start',
      'rec-capture',
      'rec-stop',
      'rec-import',
      'rec-play',
      'rec-exit',
    ]);
  });

  // ─── Step: rec-intro ──────────────────────────────────────

  it('step rec-intro has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-intro preAction connects and switches to events when not connected', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    const ctx = makeCtx();
    // DOM has no disconnect-btn → ensureConnected will connect
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rec-intro preAction skips connect when already connected', async () => {
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'disconnect-btn');
    // Not disabled = genuinely connected
    document.body.appendChild(disconnectBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rec-intro preAction connects when disconnect-btn is present but disabled (not actually connected)', async () => {
    // The Disconnect button is always in the DOM — just disabled when not connected.
    // ensureConnected must check !disabled, not merely existence.
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'disconnect-btn');
    disconnectBtn.disabled = true;
    document.body.appendChild(disconnectBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should still call connect-btn because the btn is disabled (= not connected)
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step rec-intro preAction stops active recording if running', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const clickSpy = vi.fn();
    stopBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-intro highlights rec start button', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    expect(step.highlight).toContain('start-recording-btn');
  });

  it('step rec-intro action calls ctx.delay(400) (line 256)', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-intro')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

  // ─── Step: rec-start ──────────────────────────────────────

  it('step rec-start has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-start preAction connects and navigates to events when not recording', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step rec-start preAction is a no-op when already recording', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rec-start action clicks rec button', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('start-recording-btn'));
  });

  it('step rec-start highlights start button (visible during reading before action fires)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-start')!;
    expect(step.highlight).toContain('start-recording-btn');
    expect(step.highlight).not.toContain('stop-recording-btn');
  });

  // ─── Step: rec-capture ────────────────────────────────────

  it('step rec-capture preAction fills message and switches to compose when recording active', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-capture')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('demo'),
    );
  });

  it('step rec-capture preAction starts recording when not active', async () => {
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'start-recording-btn');
    document.body.appendChild(startBtn);

    const clickSpy = vi.fn();
    startBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-capture')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
  });

  it('step rec-capture action sends 3 messages and switches to events', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-capture')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const sendCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('send-btn'));
    expect(sendCalls.length).toBe(3);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Step: rec-stop ───────────────────────────────────────

  it('step rec-stop has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-stop preAction starts recording when not active', async () => {
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'start-recording-btn');
    document.body.appendChild(startBtn);

    const clickSpy = vi.fn();
    startBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-stop preAction is a no-op when already recording', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step rec-stop action clicks stop button', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('stop-recording-btn'));
  });

  it('step rec-stop highlights stop button (not start button)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    expect(step.highlight).toContain('stop-recording-btn');
    expect(step.highlight).not.toContain('start-recording-btn');
  });

  // ─── Step: rec-import ─────────────────────────────────────

  it('step rec-import has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-import preAction stops active recording', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'stop-recording-btn');
    document.body.appendChild(stopBtn);

    const clickSpy = vi.fn();
    stopBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-import preAction exits active replay', async () => {
    const exitBtn = document.createElement('button');
    exitBtn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(exitBtn);

    const clickSpy = vi.fn();
    exitBtn.addEventListener('click', clickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step rec-import action injects a recording file', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn();
    input.addEventListener('change', changeSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(changeSpy).toHaveBeenCalled();
    const files = input.files;
    expect(files).toBeTruthy();
    expect(files!.length).toBe(1);
    expect(files![0]?.name).toBe('demo-recording.json');
  });

  it('step rec-import injected recording has short timing (under 6 s total)', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    const files = input.files;
    const text = await files![0]!.text();
    const recording = JSON.parse(text);
    expect(recording.metadata.durationMs).toBeLessThan(6000);
    expect(recording.events.length).toBe(12);
  });

  it('step rec-import highlights import button (not play button)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-import')!;
    expect(step.highlight).toContain('import-recording-btn');
    expect(step.highlight).not.toContain('start-replay-btn');
  });

  // ─── Step: rec-play ───────────────────────────────────────

  it('step rec-play has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-play preAction injects recording when no play button exists', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn();
    input.addEventListener('change', changeSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(changeSpy).toHaveBeenCalled();
  });

  it('step rec-play preAction skips injection when play button already exists', async () => {
    const playBtn = document.createElement('button');
    playBtn.setAttribute('data-testid', 'start-replay-btn');
    document.body.appendChild(playBtn);

    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn();
    input.addEventListener('change', changeSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('step rec-play action clicks play button', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('start-replay-btn'));
  });

  it('step rec-play highlights start-replay button (visible during reading before action fires)', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-play')!;
    expect(step.highlight).toContain('start-replay-btn');
    expect(step.highlight).not.toContain('replay-bar');
  });

  // ─── Step: rec-exit ───────────────────────────────────────

  it('step rec-exit has a preAction', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step rec-exit preAction injects a file and pauses replay when no exit or play button exists', async () => {
    // Scenario: replay auto-completed and recording was cleared from memory.
    // Neither exit button nor play button is in the DOM. Injection is required.
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'recording-file-input');
    document.body.appendChild(input);

    const changeSpy = vi.fn(() => {
      // Simulate React re-render: file loaded → play button appears
      const playBtn = document.createElement('button');
      playBtn.setAttribute('data-testid', 'start-replay-btn');
      playBtn.addEventListener('click', () => {
        playBtn.remove();
        const bar = document.createElement('div');
        bar.setAttribute('data-testid', 'replay-bar');
        document.body.appendChild(bar);
        const exitEl = document.createElement('button');
        exitEl.setAttribute('data-testid', 'replay-exit-btn');
        document.body.appendChild(exitEl);
        const ppBtn = document.createElement('button');
        ppBtn.setAttribute('data-testid', 'replay-playpause-btn');
        ppBtn.textContent = '⏸';
        document.body.appendChild(ppBtn);
      });
      document.body.appendChild(playBtn);
    });
    input.addEventListener('change', changeSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // File should have been injected (no exit button, no play button at start)
    expect(changeSpy).toHaveBeenCalled();
  });

  it('step rec-exit preAction uses existing play button when recording is still loaded in memory', async () => {
    // Scenario: play button already visible (e.g. replay completed but loadedRecording
    // race — in practice stopReplay clears it, but good defensive coverage).
    const playBtn = document.createElement('button');
    playBtn.setAttribute('data-testid', 'start-replay-btn');
    const playClickSpy = vi.fn(() => {
      playBtn.remove();
      const bar = document.createElement('div');
      bar.setAttribute('data-testid', 'replay-bar');
      document.body.appendChild(bar);
      const exitEl = document.createElement('button');
      exitEl.setAttribute('data-testid', 'replay-exit-btn');
      document.body.appendChild(exitEl);
      const ppBtn = document.createElement('button');
      ppBtn.setAttribute('data-testid', 'replay-playpause-btn');
      ppBtn.textContent = '⏸';
      document.body.appendChild(ppBtn);
    });
    playBtn.addEventListener('click', playClickSpy);
    document.body.appendChild(playBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // Should have clicked play directly without needing file injection
    expect(playClickSpy).toHaveBeenCalled();
  });

  it('step rec-exit preAction pauses an already-playing replay to keep exit button visible', async () => {
    // Simulate: replay already running (exit + playpause buttons in DOM)
    const exitBtn = document.createElement('button');
    exitBtn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(exitBtn);

    const ppBtn = document.createElement('button');
    ppBtn.setAttribute('data-testid', 'replay-playpause-btn');
    ppBtn.textContent = '⏸'; // Currently playing
    document.body.appendChild(ppBtn);

    const ppClickSpy = vi.fn();
    ppBtn.addEventListener('click', ppClickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ppClickSpy).toHaveBeenCalled(); // Should pause the replay
  });

  it('step rec-exit preAction skips pause when replay is already paused', async () => {
    const exitBtn = document.createElement('button');
    exitBtn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(exitBtn);

    const ppBtn = document.createElement('button');
    ppBtn.setAttribute('data-testid', 'replay-playpause-btn');
    ppBtn.textContent = '▶'; // Already paused
    document.body.appendChild(ppBtn);

    const ppClickSpy = vi.fn();
    ppBtn.addEventListener('click', ppClickSpy);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ppClickSpy).not.toHaveBeenCalled(); // Already paused — no-op
  });

  it('step rec-exit highlights replay exit button', () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    expect(step.highlight).toContain('replay-exit-btn');
  });

  it('step rec-exit action clicks exit when button exists', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'replay-exit-btn');
    document.body.appendChild(btn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('replay-exit-btn'));
  });

  it('step rec-exit action is a no-op when replay already ended', async () => {
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup starts mock server and clears protocol state', async () => {
    const ctx = makeCtx();
    await wsSessionRecordingLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('Subprotocols'), '');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('protocol'), 'raw');
  });

  it('cleanup stops mock server', async () => {
    const ctx = makeCtx();
    await wsSessionRecordingLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  // ─── Additional branch coverage ──────────────────────────────

  it('step rec-capture preAction skips start click when not recording and no startBtn (line 302 false)', async () => {
    // Not recording (no stop button) and no start button either → skip click, still fills compose
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-capture')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should still switch to compose and fill, but no startBtn click
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-compose'));
  });

  it('step rec-stop preAction skips start click when not recording and no startBtn (line 343 false)', async () => {
    // Not recording (no stop button) and no start button → skip click
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-stop')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // No startBtn click, no error
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('start-recording-btn'));
  });

  it('step rec-exit preAction skips pause when playBtn is null after injection (line 426 false)', async () => {
    // Neither exitBtn nor playBtn exists, and injectRecordingFile does NOT create playBtn
    // (no file input in DOM → injectRecordingFile is a no-op)
    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    // No file input → injectRecordingFile returns immediately; no playBtn added
    await step.preAction!(ctx);
    // Should complete without error; no playBtn click
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('start-replay-btn'));
  });

  it('step rec-exit preAction clicks playBtn but skips pauseBtn when pauseBtn absent (line 433 false)', async () => {
    // playBtn exists directly; click handler does NOT add a pauseBtn
    const playBtn = document.createElement('button');
    playBtn.setAttribute('data-testid', 'start-replay-btn');
    const playClickSpy = vi.fn(() => {
      playBtn.remove();
      const bar = document.createElement('div');
      bar.setAttribute('data-testid', 'replay-bar');
      document.body.appendChild(bar);
      // NOTE: no replay-playpause-btn added → pauseBtn will be null at line 433
    });
    playBtn.addEventListener('click', playClickSpy);
    document.body.appendChild(playBtn);

    const step = wsSessionRecordingLesson.steps.find(s => s.id === 'rec-exit')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // playBtn should have been clicked (line 427 covered)
    expect(playClickSpy).toHaveBeenCalled();
    // pauseBtn was null → no ctx.delay(300) for pause
  });
});

// ─── ws-power-user ──────────────────────────────────────────────

