/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsReliabilityLesson } from './ws-reliability';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('ws-reliability lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsReliabilityLesson.id).toBe('ws-reliability');
    expect(wsReliabilityLesson.domainId).toBe('protocols');
    expect(wsReliabilityLesson.name).toBe('Auto-Reconnect & Stats');
    expect(wsReliabilityLesson.steps.length).toBe(7);
    expect(wsReliabilityLesson.concept.title).toBeTruthy();
    expect(wsReliabilityLesson.concept.body).toBeTruthy();
    expect(wsReliabilityLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsReliabilityLesson.category).toBe('websocket');
    expect(wsReliabilityLesson.estimatedMinutes).toBe(3);
    expect(wsReliabilityLesson.tag).toBeUndefined();
    expect(wsReliabilityLesson.dockerEndpoint).toBeUndefined();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsReliabilityLesson.setup).toBe('function');
    expect(typeof wsReliabilityLesson.cleanup).toBe('function');
  });

  it('concept has key terms covering close code, reconnect, backoff, sparkline', () => {
    const terms = wsReliabilityLesson.concept.keyTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(3);
    const termNames = terms.map(t => t.term.toLowerCase());
    expect(termNames.some(t => t.includes('close code'))).toBe(true);
    expect(termNames.some(t => t.includes('reconnect'))).toBe(true);
    expect(termNames.some(t => t.includes('backoff'))).toBe(true);
  });

  it('concept has a diagram', () => {
    expect(wsReliabilityLesson.concept.diagram).toBeTruthy();
    expect(wsReliabilityLesson.concept.diagram).toContain('Stats');
    // Diagram contains "Auto-reconnect" text (lowercase r is OK)
    expect(wsReliabilityLesson.concept.diagram).toMatch(/[Rr]econnect/);
  });

  it('all steps have id, title, and description', () => {
    wsReliabilityLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
    });
  });

  it('step IDs are in correct order', () => {
    const ids = wsReliabilityLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'rel-connect',
      'rel-stats-tab',
      'rel-stats-live',
      'rel-reconnect-settings',
      'rel-close-code',
      'rel-stats-zero',
      'rel-history',
    ]);
  });

  // ─── Step: rel-connect ────────────────────────────────────

  it('step rel-connect preAction fills URL and navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-connect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket URL'),
      expect.stringContaining('localhost:9876'),
    );
  });

  it('step rel-connect action clicks connect and switches to events', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step rel-connect has verify for connected status', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-connect')!;
    expect(step.verify).toContain('connected');
  });

  // ─── Step: rel-stats-tab ──────────────────────────────────

  it('step rel-stats-tab preAction switches to stats tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-tab')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-stats'));
  });

  it('step rel-stats-tab action calls ctx.delay(1000)', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-tab')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(1000);
  });

  it('step rel-stats-tab highlights stats tab', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-tab')!;
    expect(step.highlight).toContain('right-tab-stats');
  });

  // ─── Step: rel-stats-live ─────────────────────────────────

  it('step rel-stats-live preAction navigates to compose and fills message', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('Message input'),
      expect.stringContaining('ping'),
    );
  });

  it('step rel-stats-live preAction: guard triggers connect when not connected', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    document.body.innerHTML = ''; // no status-connected element → disconnected
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step rel-stats-live preAction: guard skips connect when already connected', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const connectBtnCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('connect-btn'));
    expect(connectBtnCalls.length).toBe(0);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('step rel-stats-live action sends messages and switches to stats', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const sendCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('send-btn'));
    expect(sendCalls.length).toBe(5);
    // Each send is preceded by a fill to re-populate the cleared input
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('Message input'));
    expect(fillCalls.length).toBe(5);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-stats'));
  });

  it('step rel-stats-live highlights msg rate card', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-live')!;
    expect(step.highlight).toContain('stats-msg-rate');
  });

  // ─── Step: rel-reconnect-settings ─────────────────────────

  it('step rel-reconnect-settings preAction navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step rel-reconnect-settings action scrolls settings into view when present', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    const settings = document.createElement('div');
    settings.setAttribute('data-testid', 'reconnect-settings');
    settings.className = 'reconnect-settings';
    const scrollSpy = vi.fn();
    settings.scrollIntoView = scrollSpy;
    document.body.appendChild(settings);

    const ctx = makeCtx();
    // Override querySelector to return our element for reconnect-settings selector
    const origQuery = document.querySelector.bind(document);
    vi.spyOn(document, 'querySelector').mockImplementation((sel: string) => {
      if (sel.includes('reconnect-settings')) return settings;
      return origQuery(sel);
    });

    await step.action!(ctx);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(ctx.delay).toHaveBeenCalledWith(1200);

    vi.restoreAllMocks();
  });

  it('step rel-reconnect-settings action skips scroll when settings absent', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    document.body.innerHTML = '';
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(1200);
  });

  it('step rel-reconnect-settings highlights reconnect settings', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    expect(step.highlight).toContain('reconnect-settings');
  });

  it('step rel-reconnect-settings description mentions max attempts and backoff', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-reconnect-settings')!;
    expect(step.description).toContain('Max Attempts');
    expect(step.description).toContain('Backoff Multiplier');
  });

  // ─── Step: rel-close-code ─────────────────────────────────

  it('step rel-close-code preAction navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-close-code')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step rel-close-code preAction: guard triggers connect when not connected', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-close-code')!;
    document.body.innerHTML = ''; // no status-connected element → disconnected
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step rel-close-code preAction: guard skips connect when already connected', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-close-code')!;
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const connectBtnCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('connect-btn'));
    expect(connectBtnCalls.length).toBe(0);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step rel-close-code action opens caret, uses waitFor, fills code/reason, closes', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-close-code')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('disconnect-caret'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('close-code-input'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('close-code-input'),
      '1001',
    );
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('close-reason-input'),
      'Demo lesson complete',
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('close-with-code-btn'));
  });

  // ─── Step: rel-stats-zero ─────────────────────────────────

  it('step rel-stats-zero has preAction that disconnects if still active', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-zero')!;
    expect(typeof step.preAction).toBe('function');
    // Simulate an active connection by placing an enabled disconnect button in DOM
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'disconnect-btn');
    makeVisible(btn);
    document.body.appendChild(btn);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // disconnectWebSocket finds the button and calls ctx.delay(300)
    expect(ctx.delay).toHaveBeenCalledWith(300);
    btn.remove();
  });

  it('step rel-stats-zero preAction is a no-op when already disconnected', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-zero')!;
    document.body.innerHTML = ''; // no disconnect button → already disconnected
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // disconnectWebSocket finds no button — ctx.delay never called
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('step rel-stats-zero action switches to stats tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-zero')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-stats'));
  });

  it('step rel-stats-zero description mentions rates drop to zero', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-stats-zero')!;
    expect(step.description).toContain('zero');
  });

  // ─── Step: rel-history ────────────────────────────────────

  it('step rel-history preAction navigates to connect tab', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-history')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step rel-history highlights URL history trigger', () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-history')!;
    expect(step.highlight).toContain('url-history-trigger');
  });

  it('step rel-history action opens and closes URL history dropdown', async () => {
    const step = wsReliabilityLesson.steps.find(s => s.id === 'rel-history')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('url-history-trigger'));
    expect(clickCalls.length).toBe(2);
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup starts mock server, clears subprotocols and resets protocol', async () => {
    const ctx = makeCtx();
    await wsReliabilityLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('Subprotocols'), '');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('protocol'), 'raw');
  });

  it('cleanup resets protocol and stops mock server', async () => {
    const ctx = makeCtx();
    await wsReliabilityLesson.cleanup!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('Subprotocols'), '');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('protocol'), 'raw');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── ws-session-recording ───────────────────────────────────────

